import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { aiProvider } from './index.js';
import { prisma } from '../../lib/prisma.js';
import { runMigrations, mergeResumeSections, type Section } from '@careerforge/schema';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import rateLimit from 'express-rate-limit';

export const aiRouter = Router();

// AI endpoints are more expensive — tighter rate limit than auth endpoints
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' } },
});

const RESUME_CHAT_SYSTEM_PROMPT = `You are CareerForge AI, a friendly resume-building assistant.
Your goal is to help users build a professional resume through conversation.
Ask about their experience, education, skills, projects, and achievements one topic at a time.
Keep responses concise and encouraging.

Your reply must begin directly with what you'd actually say to the user — never with
narration about your own task or reasoning process. Do not write sentences like "We need
to...", "I need to emit...", "We have collected...", or "Need to produce..." anywhere in
your reply; that is internal planning, not a message to the user, and must never appear
in the response. If you catch yourself about to describe what you're going to do, skip
straight to doing it instead.

When you have gathered enough information to update the resume (at least name and one section),
append "RESUME_UPDATE:" followed by a JSON object with the resume data.
The JSON should have this shape. Every value shown below in angle brackets is a
placeholder describing what belongs there, not literal text — never output the
placeholder itself; always substitute the user's real information. If you don't
yet have real data for a field or an entire section, leave it out rather than
filling it with a guess or with the placeholder text shown here.
For "summary", "experience", "education", "skills", "certifications", "projects",
"languages", and "references" sections, always send "fields": [] — the app fills
in the correct field definitions for these itself, so you don't need to
reproduce them. Only include a real "fields" array for a "custom" section.
{
  "title": "<the person's full name>",
  "sections": [
    {
      "id": "<uuid>",
      "type": "summary",
      "title": "Summary",
      "order": 0,
      "fields": [],
      "entries": [
        {
          "id": "<uuid>",
          "values": {
            "jobTitle": "<their current job title>",
            "email": "<their email>",
            "phone": "<their phone>",
            "location": "<their city, state>",
            "text": "<2-3 sentence professional summary>"
          }
        }
      ]
    },
    {
      "id": "<uuid>",
      "type": "experience",
      "title": "Experience",
      "order": 1,
      "fields": [],
      "entries": [
        {
          "id": "<uuid>",
          "values": {
            "title": "<job title>",
            "company": "<company name>",
            "location": "<city, country>",
            "startDate": "<YYYY-MM>",
            "endDate": "<YYYY-MM, or empty string if current>",
            "description": "<1-3 achievement lines, one per \\n>"
          }
        }
      ]
    }
  ]
}

Only emit RESUME_UPDATE when you have meaningful data to add, not on every message.
CRITICAL: the moment the user states a fact, put it in RESUME_UPDATE that same turn.
Never say "I'll add that" or "I'll create an entry" without actually including the
JSON in that same response — if you say it, emit it, in the same reply, not later.
Every user message that adds or changes information must produce a RESUME_UPDATE
containing that information merged with everything gathered so far in the conversation.
Always use real UUIDs (e.g. crypto.randomUUID() format) for id fields.
Dates must be in YYYY-MM format.

Ask ONE specific follow-up at a time, grounded in what the user just said — reference
their actual company/role/detail by name, don't ask generic template questions. If they
gave a vague answer (e.g. "you can write whatever"), don't just accept a placeholder —
ask a targeted question that gets the one or two concrete details you need (e.g. what
the role actually involved, or one concrete result) to write something specific rather
than generic filler.

After every response, suggest 2-3 natural follow-up replies the user could send.
Append them as: SUGGESTIONS:["Software Engineer","Product Manager","Data Analyst"] (an
illustrative example only — always replace with suggestions relevant to what you just asked).
Keep suggestions short (under 8 words each) and relevant to what you just asked.
If you also emit RESUME_UPDATE, put SUGGESTIONS after it.

SUGGESTIONS must be things the USER could literally tap and send as their next
message — concrete answers to the question you just asked, grounded in what
they've told you so far. They are never questions or instructions directed
back at the user, and never generic category labels for what's missing.
  Good (user asked about a Lecturer role, MS Mathematics): ["Mathematics Lecturer", "Assistant Professor", "Lecturer at NUST"]
  Bad: ["Tell me your target job", "Share your background details", "Mention a key achievement"]
If you don't have enough context yet to suggest concrete answers, it's fine to
suggest 2-3 short, plausible answers to your own question rather than meta
instructions about answering it.`;

aiRouter.post(
  '/chat',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const { messages, resumeId } = req.body as {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      resumeId?: string;
    };

    if (!messages?.length) throw new BadRequestError('messages array is required.');

    const result = await aiProvider.chat(messages, RESUME_CHAT_SYSTEM_PROMPT);

    // The "click Import to paste your existing CV" nudge used to be a prompt
    // instruction asking the model to detect "this is my second reply" and
    // reword a canned message in its own voice. That's unnecessary risk for
    // a fixed message: it asked the model to reason about conversation state
    // inline, which is exactly the kind of multi-clause conditional that
    // caused it to narrate its own compliance-checking instead of just
    // answering (see the "We need to follow rules..." leak). The trigger
    // condition is fully known from the request itself, so it's applied
    // here deterministically instead — no wording risk, and by construction
    // it can only ever fire once, on exactly the assistant's second reply.
    const assistantTurnsSoFar = messages.filter((m) => m.role === 'assistant').length;
    if (assistantTurnsSoFar === 1 && result.reply) {
      result.reply = `${result.reply}\n\n💡 By the way — if you have an existing CV, you can click the Import button at the top of the chat to paste it in and I'll pull all your details automatically. Otherwise, let's keep going!`;
    }

    // If the AI returned a resume update and we have a resumeId, persist it.
    //
    // IMPORTANT: this used to overwrite the row's entire `sections` column
    // with whatever `result.resumeUpdate.sections` contained for this single
    // turn. The system prompt asks the model to re-include everything
    // gathered "so far, merged" on every turn, but that makes data integrity
    // depend entirely on the model's memory across a growing conversation —
    // something weaker/free models are unreliable at. If a turn's update
    // only mentioned e.g. the summary section, a blind overwrite silently
    // deleted every other previously-saved section. mergeResumeSections is
    // the same by-type merge policy the client uses for its live preview
    // state, so a section the model doesn't re-state this turn is left
    // alone instead of being wiped.
    if (result.resumeUpdate && resumeId) {
      const row = await prisma.resume.findUnique({ where: { id: resumeId } });
      if (row && row.ownerId === req.user!.id) {
        const toJson = (v: unknown) => v as any;
        const mergedSections = result.resumeUpdate.sections
          ? mergeResumeSections(row.sections as unknown as Section[], result.resumeUpdate.sections)
          : undefined;
        await prisma.resume.update({
          where: { id: resumeId },
          data: {
            ...(result.resumeUpdate.title ? { title: result.resumeUpdate.title } : {}),
            ...(mergedSections ? { sections: toJson(mergedSections) } : {}),
          },
        });
      }
    }

    res.status(200).json(result);
  }),
);

aiRouter.post(
  '/ats-score',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const { resumeId, jobDescription } = req.body as { resumeId?: string; jobDescription?: string };
    if (!resumeId) throw new BadRequestError('resumeId is required.');

    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row || row.ownerId !== req.user!.id) throw new NotFoundError('Resume not found.');

    const { payload: resume } = runMigrations({
      schemaVersion: row.schemaVersion,
      migrationVersion: row.migrationVersion,
      payload: { id: row.id, ownerId: row.ownerId, title: row.title, theme: row.theme, sections: row.sections, schemaVersion: row.schemaVersion, migrationVersion: row.migrationVersion, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() },
    });

    const result = await aiProvider.scoreATS(resume as any, jobDescription);
    res.status(200).json(result);
  }),
);

aiRouter.post(
  '/job-match',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const { resumeId, jobDescription } = req.body as { resumeId?: string; jobDescription?: string };
    if (!resumeId) throw new BadRequestError('resumeId is required.');
    if (!jobDescription) throw new BadRequestError('jobDescription is required.');

    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row || row.ownerId !== req.user!.id) throw new NotFoundError('Resume not found.');

    const { payload: resume } = runMigrations({
      schemaVersion: row.schemaVersion,
      migrationVersion: row.migrationVersion,
      payload: { id: row.id, ownerId: row.ownerId, title: row.title, theme: row.theme, sections: row.sections, schemaVersion: row.schemaVersion, migrationVersion: row.migrationVersion, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() },
    });

    const result = await aiProvider.matchJobDescription(resume as any, jobDescription);
    res.status(200).json(result);
  }),
);

aiRouter.post(
  '/cover-letter',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const { resumeId, jobDescription, tone } = req.body as {
      resumeId?: string;
      jobDescription?: string;
      tone?: string;
    };
    if (!resumeId) throw new BadRequestError('resumeId is required.');
    if (!jobDescription) throw new BadRequestError('jobDescription is required.');

    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row || row.ownerId !== req.user!.id) throw new NotFoundError('Resume not found.');

    const { payload: resume } = runMigrations({
      schemaVersion: row.schemaVersion,
      migrationVersion: row.migrationVersion,
      payload: { id: row.id, ownerId: row.ownerId, title: row.title, theme: row.theme, sections: row.sections, schemaVersion: row.schemaVersion, migrationVersion: row.migrationVersion, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() },
    });

    const coverLetter = await aiProvider.generateCoverLetter(resume as any, jobDescription, tone);
    res.status(200).json({ coverLetter });
  }),
);

aiRouter.post(
  '/import',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const { rawText } = req.body as { rawText?: string };
    if (!rawText?.trim()) throw new BadRequestError('rawText is required.');

    const extracted = await aiProvider.extractResumeFromText(rawText);

    // An empty {} here is indistinguishable, on its own, from "the model
    // genuinely found nothing" vs "JSON extraction quietly failed" — both
    // adapters fall back to {} rather than throwing (see chatResponseParser
    // / extractResumeJson). Given the input was a real file the user chose
    // to import, a fully-empty result is far more likely to mean extraction
    // failed than that their resume had no name and no sections. Treat it
    // as a failure so the UI's existing error/retry state (ImportResumeModal
    // already has one) fires, instead of declaring success and silently
    // leaving the sample resume in place with no indication anything went
    // wrong — which is exactly the "AI said it imported my resume but the
    // preview never changed" bug this closes.
    const hasUsableContent =
      (typeof extracted.title === 'string' && extracted.title.trim().length > 1) ||
      (Array.isArray(extracted.sections) && extracted.sections.some((s) => (s.entries?.length ?? 0) > 0));
    if (!hasUsableContent) {
      throw new BadRequestError(
        "Couldn't extract details from this file — try pasting the text directly, or fill in your details manually.",
        'EXTRACTION_FAILED',
      );
    }

    res.status(200).json({ extracted });
  }),
);