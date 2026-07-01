import OpenAI from 'openai';
import type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
import type { Resume } from '@careerforge/schema';
import { env } from '../../config/env.js';
import { ConfigurationError } from '../../lib/errors.js';

/**
 * OpenRouter adapter. OpenRouter exposes an OpenAI-compatible API so we
 * use the openai npm package with a custom baseURL. No additional package
 * needed. Model selection uses a cheap/fast default that can be changed
 * via OPENROUTER_MODEL without a code deployment.
 *
 * Free models on OpenRouter (good for development):
 *   meta-llama/llama-3.1-8b-instruct:free
 *   mistralai/mistral-7b-instruct:free
 *   google/gemma-2-9b-it:free
 *
 * The model is set via the OPENROUTER_MODEL env var (Render → API service →
 * Environment). Change it to any model slug from openrouter.ai/models without
 * a code deployment — no rebuild needed, just update the env var and restart.
 */

const DEFAULT_MODEL = env.OPENROUTER_MODEL;

function getClient(): OpenAI {
  if (!env.OPENROUTER_API_KEY) {
    throw new ConfigurationError(
      'OPENROUTER_API_KEY is not set. Add it in Render environment variables. ' +
        'Get a key at openrouter.ai — free tier available.',
    );
  }
  return new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': env.FRONTEND_URL || 'https://careerforge.app',
      'X-Title': 'CareerForge',
    },
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

/** Same idea as safeJsonParse but for arrays — used for the SUGGESTIONS
 * marker, which the model is asked to emit as a JSON array of strings
 * rather than an object. safeJsonParse's regex only matches `{...}` and
 * would never match `[...]`. */
function safeJsonArrayParse(text: string): string[] {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Extracts the RESUME_UPDATE and/or SUGGESTIONS markers from a raw model
 * response, in whichever order they actually appear (the prompt requests
 * SUGGESTIONS after RESUME_UPDATE, but the model isn't always compliant —
 * this handles either order rather than assuming one). Returns the
 * human-facing reply with both markers stripped out. Shared logic with
 * anthropic.adapter.ts — kept duplicated rather than extracted to a
 * shared file because the two adapters' build setups are independent
 * and this is a small, stable amount of code.
 */
function extractChatMarkers(rawText: string): {
  reply: string;
  resumeUpdate?: Partial<Pick<Resume, 'title' | 'sections'>>;
  suggestions?: string[];
} {
  let reply = rawText;
  let resumeUpdate: Partial<Pick<Resume, 'title' | 'sections'>> | undefined;
  let suggestions: string[] | undefined;

  const resumeIdx = reply.indexOf('RESUME_UPDATE:');
  if (resumeIdx !== -1) {
    const before = reply.slice(0, resumeIdx);
    const after = reply.slice(resumeIdx + 'RESUME_UPDATE:'.length);
    resumeUpdate = safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>>>(after, {});
    const objMatch = after.match(/\{[\s\S]*\}/);
    const tail = objMatch ? after.slice(after.indexOf(objMatch[0]) + objMatch[0].length) : '';
    reply = before + tail;
  }

  const suggestionsIdx = reply.indexOf('SUGGESTIONS:');
  if (suggestionsIdx !== -1) {
    const before = reply.slice(0, suggestionsIdx);
    const after = reply.slice(suggestionsIdx + 'SUGGESTIONS:'.length);
    const parsed = safeJsonArrayParse(after);
    if (parsed.length > 0) suggestions = parsed;
    const arrMatch = after.match(/\[[\s\S]*\]/);
    const tail = arrMatch ? after.slice(after.indexOf(arrMatch[0]) + arrMatch[0].length) : '';
    reply = before + tail;
  }

  return { reply: reply.trim(), resumeUpdate, suggestions };
}

/** Safely extracts content from an OpenAI-compatible chat completion response.
 * Guards against `choices` being `undefined`, which happens when OpenRouter
 * returns an error JSON body with HTTP 200 (rate-limit / model-unavailable
 * responses that some providers surface as 200+error rather than 4xx). */
function extractChoiceText(
  response: { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } },
): string {
  if (response.error?.message) {
    throw new Error(`OpenRouter: ${response.error.message}`);
  }
  return response.choices?.[0]?.message?.content ?? '';
}

export class OpenRouterProvider implements AIProvider {
  private model = DEFAULT_MODEL;

  async chat(messages: ChatMessage[], systemPrompt: string) {
    const client = getClient();

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 1024,
    });

    const text = extractChoiceText(response);
    return extractChatMarkers(text);
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

    const text = extractChoiceText(response);
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

    const text = extractChoiceText(response);
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

    return extractChoiceText(response);
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

    const text = extractChoiceText(response);
    return safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>>>(text, {});
  }
}
