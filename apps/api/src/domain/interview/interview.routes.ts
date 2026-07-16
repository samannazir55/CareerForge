import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { aiProvider, type InterviewQuestion, type AnswerEvaluation } from '../ai/index.js';
import { prisma } from '../../lib/prisma.js';
import { runMigrations } from '@careerforge/schema';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import rateLimit from 'express-rate-limit';

// Same cast used by resume.service.ts and admin/auditLog.ts for every
// hand-built object headed into a Prisma Json column — Prisma's generated
// input types don't structurally accept a plain `unknown`/interface value
// even when the shape is already Json-safe.
const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export const interviewRouter = Router();

// Same rationale as aiRouter's rate limit — these endpoints all make LLM
// calls, which are more expensive (time and cost) than a typical CRUD
// request.
const interviewRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many interview requests. Please wait a moment.' } },
});

const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 20;

/** Loads a resume row and runs it through migrations, throwing NotFoundError
 * if it doesn't exist or isn't owned by the requesting user. Same pattern
 * used across ai.routes.ts for every endpoint that needs the full Resume
 * shape rather than just the DB row. */
async function loadOwnedResume(resumeId: string, userId: string) {
  const row = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!row || row.ownerId !== userId) throw new NotFoundError('Resume not found.');

  const { payload: resume } = runMigrations({
    schemaVersion: row.schemaVersion,
    migrationVersion: row.migrationVersion,
    payload: {
      id: row.id,
      ownerId: row.ownerId,
      title: row.title,
      theme: row.theme,
      sections: row.sections,
      schemaVersion: row.schemaVersion,
      migrationVersion: row.migrationVersion,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  });

  return { row, resume };
}

/**
 * POST /api/interview/questions
 * Body: { resumeId, jobDescription, count? }
 * Returns: { questions: InterviewQuestion[] }
 */
interviewRouter.post(
  '/questions',
  requireAuth,
  requireVerifiedEmail,
  interviewRateLimit,
  asyncHandler(async (req, res) => {
    const { resumeId, jobDescription, count } = req.body as {
      resumeId?: string;
      jobDescription?: string;
      count?: number;
    };
    if (!resumeId) throw new BadRequestError('resumeId is required.');
    if (!jobDescription?.trim()) throw new BadRequestError('jobDescription is required.');

    const clampedCount =
      count !== undefined ? Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.round(count))) : undefined;

    const { resume } = await loadOwnedResume(resumeId, req.user!.id);

    const questions = await aiProvider.generateInterviewQuestions(resume as any, jobDescription, clampedCount);

    // Same reasoning as ai.routes.ts's /import endpoint: an empty array is
    // ambiguous between "the model legitimately found nothing to ask" (never
    // actually happens for this prompt) and "JSON extraction quietly
    // failed" (safeJsonParseArray's fallback). Treat it as a failure so the
    // UI's loading/error state can offer a retry instead of silently moving
    // the user into a practice session with zero questions.
    if (questions.length === 0) {
      throw new BadRequestError(
        "Couldn't generate interview questions right now. Please try again.",
        'GENERATION_FAILED',
      );
    }

    res.status(200).json({ questions });
  }),
);

/**
 * POST /api/interview/evaluate
 * Body: { question, answer, jobDescription }
 * Returns: { evaluation: AnswerEvaluation }
 */
interviewRouter.post(
  '/evaluate',
  requireAuth,
  requireVerifiedEmail,
  interviewRateLimit,
  asyncHandler(async (req, res) => {
    const { question, answer, jobDescription } = req.body as {
      question?: string;
      answer?: string;
      jobDescription?: string;
    };
    if (!question?.trim()) throw new BadRequestError('question is required.');
    if (!answer?.trim()) throw new BadRequestError('answer is required.');
    if (!jobDescription?.trim()) throw new BadRequestError('jobDescription is required.');

    const evaluation = await aiProvider.evaluateAnswer(question, answer, jobDescription);
    res.status(200).json({ evaluation });
  }),
);

/**
 * POST /api/interview/session
 * Body: { resumeId, jobDescription, questions, answers }
 * Saves the full session to ConversationSession + ConversationMessage, and
 * returns a fresh overall score + summary computed server-side (the client
 * only sends raw questions/answers, not the per-question scores it showed
 * during practice, so those are the source of truth here).
 * Returns: { sessionId, overallScore, summary }
 */
interviewRouter.post(
  '/session',
  requireAuth,
  requireVerifiedEmail,
  interviewRateLimit,
  asyncHandler(async (req, res) => {
    const { resumeId, jobDescription, questions, answers } = req.body as {
      resumeId?: string;
      jobDescription?: string;
      questions?: InterviewQuestion[];
      answers?: Record<string, string>;
    };
    if (!resumeId) throw new BadRequestError('resumeId is required.');
    if (!jobDescription?.trim()) throw new BadRequestError('jobDescription is required.');
    if (!questions?.length) throw new BadRequestError('questions array is required.');
    if (!answers) throw new BadRequestError('answers is required.');

    const { row } = await loadOwnedResume(resumeId, req.user!.id);

    // Evaluate every answered question concurrently — independent reads of
    // the same job context, not a pipeline, same rationale as the
    // Promise.all in ai.routes.ts's /tailor-resume.
    const evaluations = await Promise.all(
      questions.map(async (question) => {
        const answer = answers[question.id]?.trim() ?? '';
        const evaluation: AnswerEvaluation = answer
          ? await aiProvider.evaluateAnswer(question.question, answer, jobDescription)
          : { score: 0, strengths: [], improvements: ['No answer was given for this question.'], idealAnswer: '' };
        return { question, answer, evaluation };
      }),
    );

    const overallScore = Math.round(
      evaluations.reduce((sum, e) => sum + e.evaluation.score, 0) / evaluations.length,
    );

    // Tally strengths/improvements across every answer and surface the ones
    // that came up most often, rather than just concatenating everything —
    // a session summary listing every single note from every question stops
    // being a "summary" past 3-4 questions.
    const tally = (pick: (e: AnswerEvaluation) => string[]) => {
      const counts = new Map<string, number>();
      for (const { evaluation } of evaluations) {
        for (const item of pick(evaluation)) {
          counts.set(item, (counts.get(item) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([item]) => item);
    };
    const topStrengths = tally((e) => e.strengths);
    const topImprovements = tally((e) => e.improvements);

    const summary =
      `You scored an average of ${overallScore}/100 across ${evaluations.length} question${evaluations.length === 1 ? '' : 's'}.` +
      (topStrengths.length ? ` You did well on: ${topStrengths.join('; ')}.` : '') +
      (topImprovements.length ? ` Focus next on: ${topImprovements.join('; ')}.` : '');

    const session = await prisma.conversationSession.create({
      data: {
        userId: req.user!.id,
        title: `Interview prep — ${row.title}`,
        context: toJson({ resumeId, jobDescription, overallScore, questionCount: evaluations.length }),
        messages: {
          create: evaluations.flatMap(({ question, answer, evaluation }) => [
            {
              role: 'assistant',
              content: question.question,
              toolCalls: toJson({ category: question.category, difficulty: question.difficulty, tip: question.tip }),
            },
            { role: 'user', content: answer },
            {
              role: 'assistant',
              content: evaluation.idealAnswer,
              toolCalls: toJson(evaluation),
            },
          ]),
        },
      },
    });

    res.status(200).json({ sessionId: session.id, overallScore, summary });
  }),
);
