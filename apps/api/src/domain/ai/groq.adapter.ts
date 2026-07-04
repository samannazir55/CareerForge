import OpenAI from 'openai';
import type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
import type { Resume } from '@careerforge/schema';
import { env } from '../../config/env.js';
import { ConfigurationError } from '../../lib/errors.js';
import { parseChatResponse } from './chatResponseParser.js';

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
      max_tokens: 2048,
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

  async extractResumeFromText(rawText: string): Promise<Partial<Pick<Resume, 'title' | 'sections'>>> {
    const client = getClient();

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a resume parser. Extract resume data and return ONLY valid JSON.
Return this shape: {"title":"Full Name","sections":[{"id":"s1","type":"experience","title":"Experience","order":0,"fields":[],"entries":[{"id":"e1","values":{"title":"Job Title","company":"Company","description":"..."}}]}]}
Use section types: experience, education, skills, certifications, projects, languages, summary.
For experience: keys title, company, location, startDate, endDate, description.
For education: keys degree, school, startDate, endDate.
For skills: key name. Use simple IDs like s1, s2, e1, e2.`,
        },
        { role: 'user', content: `Parse this resume:\n\n${rawText}` },
      ],
      max_tokens: 2048,
    });

    const text = response.choices[0]?.message?.content ?? '';
    return safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>>>(text, {});
  }
}
