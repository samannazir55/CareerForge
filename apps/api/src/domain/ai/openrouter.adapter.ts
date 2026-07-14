import OpenAI from 'openai';
import type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
import type { Resume } from '@careerforge/schema';
import { env } from '../../config/env.js';
import { ConfigurationError } from '../../lib/errors.js';
import { parseChatResponse, extractResumeJson } from './chatResponseParser.js';

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
      'HTTP-Referer': env.FRONTEND_URL || 'https://corvyx.app',
      'X-Title': 'Corvyx',
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
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content ?? '';

    // Tolerant of both the "RESUME_UPDATE:" colon format the system prompt
    // asks for and the "<RESUME_UPDATE>...</RESUME_UPDATE>" tag format this
    // (free, weaker) model sometimes emits instead — see chatResponseParser
    // for why that matters.
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
Dates must be in YYYY-MM format (e.g. "2023-09"). If the source only gives a year, use YYYY-01. If a role is current/ongoing, use an empty string for endDate.
For skills: key name. Use simple IDs like s1, s2, e1, e2.`,
        },
        { role: 'user', content: `Parse this resume:\n\n${rawText}` },
      ],
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content ?? '';
    // See groq.adapter.ts — same fix, same reason: the old greedy
    // safeJsonParse silently fell back to {} the moment any preamble text
    // preceded the JSON, with no signal to the caller that extraction
    // actually failed.
    return extractResumeJson(text) ?? {};
  }

  async completeRaw(systemPrompt: string, userMessage: string, maxTokens = 4096): Promise<string> {
    const client = getClient();

    // Streamed rather than a single blocking response: a non-streamed
    // request has to sit silently until the ENTIRE completion is ready
    // before anything comes back over the wire. At ~16k output tokens
    // (bulk template generation) that can take well over a minute, and
    // most infra between here and OpenRouter — proxies, load balancers,
    // OpenRouter's own edge — has an idle/response timeout well under
    // that, which is what an ECONNRESET mid-request almost always is.
    // Streaming avoids the whole class of failure: bytes keep arriving
    // the entire time, so nothing in the path sees an idle connection to
    // kill. The accumulated text is identical either way — this doesn't
    // change what completeRaw returns to callers, just how it gets it.
    const stream = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      stream: true,
    });

    let text = '';
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? '';
    }
    return text;
  }
}