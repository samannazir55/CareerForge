import OpenAI from 'openai';
import type {
  AIProvider,
  ChatMessage,
  ATSResult,
  JobMatchResult,
  InterviewQuestion,
  AnswerEvaluation,
  LinkedInOptimization,
  CareerCoachContext,
  ActionItem,
  CareerGrowthAnalysis,
} from './ai.provider.js';
import type { Resume, Section } from '@careerforge/schema';
import { env } from '../../config/env.js';
import { ConfigurationError, BadGatewayError } from '../../lib/errors.js';
import { parseChatResponse, extractResumeJson, extractTailoredSections } from './chatResponseParser.js';
import { TAILOR_RESUME_SYSTEM_PROMPT } from './tailorPrompt.js';

/**
 * Groq adapter. Groq exposes an OpenAI-compatible API (LPU-accelerated
 * inference — noticeably faster time-to-first-token than most other free
 * tiers) so we use the openai npm package with a custom baseURL, same
 * pattern as the OpenRouter adapter.
 *
 * IMPORTANT — Groq deprecated `llama-3.1-8b-instant` and
 * `llama-3.3-70b-versatile` on 2026-06-17 (see
 * console.groq.com/docs/deprecations). Requests against those model IDs
 * now fail, which is the most likely explanation for "Render was having
 * issues with it" — not a Render-side problem, a stale model ID. Groq's
 * own recommended replacements are `openai/gpt-oss-20b` (for the 8B
 * model) and `openai/gpt-oss-120b` / `qwen/qwen3.6-27b` (for the 70B
 * model), which is why gpt-oss-20b is the default here.
 *
 * The model is set via the GROQ_MODEL env var (Render → API service →
 * Environment) — changeable without a code deployment. Check
 * console.groq.com/docs/models for the current free-tier roster before
 * picking a different one; Groq's free lineup has churned a few times
 * this year.
 */

const DEFAULT_MODEL = env.GROQ_MODEL;

function getClient(): OpenAI {
  if (!env.GROQ_API_KEY) {
    throw new ConfigurationError(
      'GROQ_API_KEY is not set. Add it in Render environment variables. ' +
        'Get a key at console.groq.com — free tier available, no credit card required.',
    );
  }
  return new OpenAI({
    apiKey: env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

function resumeToText(resume: Resume): string {
  const lines: string[] = [`Resume: ${resume.title}`];
  for (const section of resume.sections.sort((a, b) => a.order - b.order)) {
    lines.push(`\n## ${section.title}`);
    for (const entry of section.entries) {
      const values = Object.values(entry.values).filter(Boolean).join(' | ');
      lines.push(`  - ${values}`);
    }
  }
  return lines.join('\n');
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeJsonParseArray<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? (JSON.parse(match[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

// See openrouter.adapter.ts for the full rationale — same balanced-bracket
// scan, duplicated here since this file keeps its own local
// safeJsonParse/safeJsonParseArray rather than sharing chatResponseParser's.
function extractBalancedArray(text: string, fromIdx: number): { value: unknown; endIdx: number } | null {
  const start = text.indexOf('[', fromIdx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return { value: JSON.parse(candidate), endIdx: i + 1 };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractCoachMarkers(rawText: string): { reply: string; suggestions?: string[]; actionItems?: ActionItem[] } {
  let text = rawText;
  let suggestions: string[] | undefined;
  let actionItems: ActionItem[] | undefined;

  const suggestionsMarker = text.match(/SUGGESTIONS\s*:?/i);
  if (suggestionsMarker) {
    const markerStart = suggestionsMarker.index!;
    const afterMarker = markerStart + suggestionsMarker[0].length;
    const extracted = extractBalancedArray(text, afterMarker);
    if (extracted && Array.isArray(extracted.value)) {
      suggestions = extracted.value.filter((s): s is string => typeof s === 'string');
      text = (text.slice(0, markerStart) + text.slice(extracted.endIdx)).trim();
    } else {
      text = (text.slice(0, markerStart) + text.slice(afterMarker)).trim();
    }
  }

  const actionItemsMarker = text.match(/ACTION_ITEMS\s*:?/i);
  if (actionItemsMarker) {
    const markerStart = actionItemsMarker.index!;
    const afterMarker = markerStart + actionItemsMarker[0].length;
    const extracted = extractBalancedArray(text, afterMarker);
    if (extracted && Array.isArray(extracted.value)) {
      actionItems = extracted.value as ActionItem[];
      text = (text.slice(0, markerStart) + text.slice(extracted.endIdx)).trim();
    } else {
      text = (text.slice(0, markerStart) + text.slice(afterMarker)).trim();
    }
  }

  return { reply: text.trim(), suggestions, actionItems };
}

export class GroqProvider implements AIProvider {
  private model = DEFAULT_MODEL;

  async chat(messages: ChatMessage[], systemPrompt: string) {
    const client = getClient();

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 4096,
      // openai/gpt-oss-* are reasoning models: they run an internal analysis
      // pass before producing the final answer, and that pass counts against
      // max_tokens same as the visible output. Two settings matter here:
      //   - include_reasoning: false drops the reasoning content instead of
      //     exposing it (gpt-oss doesn't support reasoning_format like other
      //     Groq reasoning models do; include_reasoning is the only lever,
      //     and Groq's own community forum has reports of reasoning bleeding
      //     into `message.content` on this model family when left on).
      //   - reasoning_effort: 'low' keeps the internal analysis pass short,
      //     which both reduces the odds of a leak and leaves more of the
      //     shared token budget for the actual RESUME_UPDATE JSON, so it's
      //     less likely to get cut off mid-object on longer conversations.
      include_reasoning: false,
      reasoning_effort: 'low',
      // include_reasoning / reasoning_effort are Groq-specific extensions to
      // the OpenAI-compatible endpoint that the `openai` SDK's TS types
      // don't model. `as any` on the argument bypasses the excess-property
      // check without touching overload resolution; asserting the awaited
      // result's type below is what keeps `stream` absent from the
      // inferred type, so `create()` still resolves to its non-streaming
      // overload (`ChatCompletion`, which has `.choices`) instead of the
      // streaming one (`Stream<ChatCompletionChunk>`, which doesn't).
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';

    // Same tolerant parsing as the OpenRouter adapter — handles the
    // "RESUME_UPDATE:" colon format, the "<RESUME_UPDATE>...</RESUME_UPDATE>"
    // tag format, a bare "RESUME_UPDATE" marker, and a bare-JSON-with-no-
    // marker response, since model formatting compliance varies even across
    // "good" free models — see chatResponseParser for the extraction rules.
    return parseChatResponse(text);
  }

  async scoreATS(resume: Resume, jobDescription?: string): Promise<ATSResult> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const prompt = jobDescription
      ? `Analyze this resume against the job description for ATS compatibility.\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`
      : `Analyze this resume for general ATS compatibility.\n\nRESUME:\n${resumeText}`;

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are an ATS expert. Return ONLY valid JSON: {"score":0,"missingKeywords":[],"missingSections":[],"suggestions":[]}. score is 0-100.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 512,
    });

    const text = response.choices[0]?.message?.content ?? '';
    return safeJsonParse<ATSResult>(text, {
      score: 0,
      missingKeywords: [],
      missingSections: [],
      suggestions: ['Unable to analyze at this time. Please try again.'],
    });
  }

  async matchJobDescription(resume: Resume, jobDescription: string): Promise<JobMatchResult> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a job matching expert. Return ONLY valid JSON: {"matchScore":0,"matchedKeywords":[],"missingKeywords":[],"suggestions":[]}. matchScore is 0-100.',
        },
        {
          role: 'user',
          content: `Compare this resume to the job description.\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`,
        },
      ],
      max_tokens: 512,
    });

    const text = response.choices[0]?.message?.content ?? '';
    return safeJsonParse<JobMatchResult>(text, {
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: ['Unable to analyze at this time. Please try again.'],
    });
  }

  async generateCoverLetter(resume: Resume, jobDescription: string, tone = 'professional'): Promise<string> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert cover letter writer. Write compelling, personalized cover letters. Return only the letter text.',
        },
        {
          role: 'user',
          content: `Write a ${tone} cover letter for this candidate.\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`,
        },
      ],
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  async tailorResume(resume: Resume, jobDescription: string): Promise<Section[]> {
    const client = getClient();

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: TAILOR_RESUME_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Candidate's resume sections (JSON):\n${JSON.stringify(resume.sections)}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nReturn the rewritten sections array now.`,
        },
      ],
      max_tokens: 4096,
      // Same reasoning-suppression as this adapter's other calls — a
      // "return ONLY a JSON array" instruction doesn't stop a reasoning
      // model from prefacing it with analysis text, and extractTailoredSections
      // would otherwise have to scan past that preamble.
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';
    const sections = extractTailoredSections(text);
    if (!sections) {
      throw new BadGatewayError('The AI did not return a usable tailored resume. Please try again.');
    }
    return sections;
  }

  async extractResumeFromText(rawText: string): Promise<Partial<Pick<Resume, 'title' | 'sections'>>> {
    const client = getClient();

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a resume parser. Extract resume data and return ONLY valid JSON.
Return this shape: {"title":"Full Name","sections":[{"id":"s1","type":"experience","title":"Experience","order":0,"fields":[],"entries":[{"id":"e1","values":{"title":"Job Title","company":"Company","description":"..."}}]}]}
Use section types: experience, education, skills, certifications, projects, languages, summary.
For experience: keys title, company, location, startDate, endDate, description.
For education: keys degree, school, startDate, endDate.
Dates must be in YYYY-MM format (e.g. "2023-09"). If the source only gives a year, use YYYY-01. If a role is current/ongoing, use an empty string for endDate.
For skills: key name. Use simple IDs like s1, s2, e1, e2.`,
        },
        { role: 'user', content: `Parse this resume:\n\n${rawText}` },
      ],
      max_tokens: 4096,
      // Same reasoning-suppression as chat() — this prompt says "return
      // ONLY valid JSON" but a reasoning model can still preface its answer
      // with analysis text regardless of instructions, and parsing a full
      // resume gives it plenty to reason about. See chat() for the full
      // explanation of why these two settings matter for gpt-oss models.
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';
    // extractResumeJson scans for the first *plausible* balanced JSON object
    // rather than a single greedy brace-to-brace regex match — the same fix
    // as chat(), applied here because this call site had the identical bug:
    // any reasoning preamble before the JSON caused the old greedy match to
    // either fail outright or capture a corrupted span, silently falling
    // back to `{}` with no signal to the caller that extraction failed.
    return extractResumeJson(text) ?? {};
  }

  async completeRaw(systemPrompt: string, userMessage: string, maxTokens = 4096): Promise<string> {
    const client = getClient();

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      // Same reasoning-suppression as the other calls on this adapter —
      // a caller asking for a specific delimited output format (e.g. the
      // admin template generator's ===NAME===/===HTML=== sections) doesn't
      // want a reasoning preamble mixed into that output.
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    return response.choices[0]?.message?.content ?? '';
  }

  async generateInterviewQuestions(resume: Resume, jobDescription: string, count = 10): Promise<InterviewQuestion[]> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert interview coach. Generate exactly ${count} realistic interview questions tailored to the candidate's resume and the target job description. Use a mix of categories (behavioural, technical, situational, culture) and difficulties (easy, medium, hard). For each question include a short one-line tip the candidate should read before answering. Return ONLY a valid JSON array matching this shape, nothing else:
[{"id":"q1","question":"...","category":"behavioural","difficulty":"medium","tip":"..."}]`,
        },
        {
          role: 'user',
          content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nGenerate ${count} interview questions now.`,
        },
      ],
      max_tokens: 4096,
      // Same reasoning-suppression as this adapter's other JSON-returning
      // calls — a "return ONLY a JSON array" instruction doesn't stop a
      // reasoning model from prefacing it with analysis text.
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';
    return safeJsonParseArray<InterviewQuestion[]>(text, []);
  }

  async evaluateAnswer(question: string, answer: string, jobDescription: string): Promise<AnswerEvaluation> {
    const client = getClient();

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert interview coach evaluating a candidate\'s answer against the job context. Return ONLY valid JSON: {"score":0,"strengths":[],"improvements":[],"idealAnswer":""}. score is 0-100. strengths and improvements are short bullet-point strings. idealAnswer is a short paragraph describing what a great answer would cover.',
        },
        {
          role: 'user',
          content: `JOB DESCRIPTION:\n${jobDescription}\n\nQUESTION:\n${question}\n\nCANDIDATE'S ANSWER:\n${answer}`,
        },
      ],
      max_tokens: 1024,
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';
    return safeJsonParse<AnswerEvaluation>(text, {
      score: 0,
      strengths: [],
      improvements: [],
      idealAnswer: 'Unable to evaluate this answer right now. Please try again.',
    });
  }

  async optimizeLinkedIn(resume: Resume, targetRole?: string): Promise<LinkedInOptimization> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a LinkedIn profile expert. Given this resume${targetRole ? ' and target role' : ''}, generate an optimized LinkedIn profile. Prioritize keyword density for recruiter searches, achievement-focused language, and first-person voice for the summary. Return ONLY valid JSON matching this exact shape, nothing else:
{"headline":"","summary":"","experienceBlurbs":[{"title":"","company":"","bullets":["",""]}],"skills":["",""],"recommendations":[{"section":"","issue":"","fix":""}]}
headline is max 220 characters. summary (the About section) is max 2600 characters, written in first person. experienceBlurbs has 3-5 achievement-focused bullets per role. skills lists the top 15 skills to add to the profile. recommendations is a short audit of gaps in the candidate's likely current profile (section names like "Headline", "About", "Skills", "Experience").`,
        },
        {
          role: 'user',
          content: `RESUME:\n${resumeText}${targetRole ? `\n\nTARGET ROLE:\n${targetRole}` : ''}\n\nGenerate the optimized LinkedIn profile now.`,
        },
      ],
      max_tokens: 4096,
      // Same reasoning-suppression as this adapter's other JSON-returning
      // calls — see chat() for the full explanation.
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';
    return safeJsonParse<LinkedInOptimization>(text, {
      headline: '',
      summary: '',
      experienceBlurbs: [],
      skills: [],
      recommendations: [
        {
          section: 'General',
          issue: 'Unable to generate LinkedIn suggestions right now.',
          fix: 'Please try again in a moment.',
        },
      ],
    });
  }

  async coachChat(
    messages: ChatMessage[],
    context: CareerCoachContext,
  ): Promise<{ reply: string; suggestions?: string[]; actionItems?: ActionItem[] }> {
    const client = getClient();

    const contextLines: string[] = [];
    if (context.currentRole) contextLines.push(`Current role: ${context.currentRole}`);
    if (context.targetRole) contextLines.push(`Target role: ${context.targetRole}`);
    if (context.yearsExperience !== undefined) contextLines.push(`Years of experience: ${context.yearsExperience}`);
    if (context.resumeSummary) contextLines.push(`Resume summary: ${context.resumeSummary}`);

    const systemPrompt = `You are an expert career coach with 20 years of experience. You give direct, actionable, personalized advice. Keep replies concise.${
      contextLines.length ? `\n\nWhat you know about this person:\n${contextLines.join('\n')}` : ''
    }

After your reply, append a new line starting with SUGGESTIONS: followed by a JSON array of 3 short replies the person could literally tap and send as their next message — concrete answers or reactions to what you just said, grounded in their situation. They are never questions or instructions directed back at the person, and never generic category labels for what's missing. Keep each under 8 words.
  Good (you just asked what's holding them back from applying): ["Not sure my resume is strong enough","Worried I lack enough experience","Don't know where to start"]
  Bad: ["What's holding you back?","Tell me your concerns","Share more details"]
Append them as: SUGGESTIONS:["...","...","..."]
If your reply includes specific, concrete tasks for the person to do, also append a new line starting with ACTION_ITEMS: followed by a JSON array matching this shape: [{"priority":"high","title":"...","description":"...","timeframe":"..."}]. priority is "high", "medium", or "low". timeframe is short, e.g. "This week", "Next 30 days", "3-6 months". Only include ACTION_ITEMS when there's a genuinely actionable task — most replies won't need one.`;

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 2048,
      // Same reasoning-suppression as this adapter's other calls — see
      // chat() for the full explanation.
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';
    return extractCoachMarkers(text);
  }

  async analyseCareerGrowth(resume: Resume, targetRole: string): Promise<CareerGrowthAnalysis> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = (await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a career strategist. Analyze the gap between this person's current experience (from their resume) and their target role. Return ONLY valid JSON matching this exact shape, nothing else:
{"currentLevel":"","targetLevel":"","skillGaps":[{"skill":"","importance":"critical","howToLearn":""}],"estimatedTimeToTransition":"","salaryRange":{"current":"","target":""},"roadmap":[{"phase":"","duration":"","goals":["",""]}],"topRecommendations":["",""]}
importance is "critical", "important", or "nice-to-have". Be realistic about timelines and salary ranges based on the industry — don't inflate or sugarcoat either.`,
        },
        {
          role: 'user',
          content: `RESUME:\n${resumeText}\n\nTARGET ROLE:\n${targetRole}\n\nAnalyze the career growth path now.`,
        },
      ],
      max_tokens: 4096,
      include_reasoning: false,
      reasoning_effort: 'low',
    } as any)) as OpenAI.Chat.Completions.ChatCompletion;

    const text = response.choices[0]?.message?.content ?? '';
    return safeJsonParse<CareerGrowthAnalysis>(text, {
      currentLevel: 'Unknown',
      targetLevel: targetRole,
      skillGaps: [],
      estimatedTimeToTransition: 'Unable to estimate right now.',
      salaryRange: { current: '', target: '' },
      roadmap: [],
      topRecommendations: ['Unable to analyze this right now. Please try again.'],
    });
  }
}
