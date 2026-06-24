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
 * The env variable OPENROUTER_MODEL defaults to a reliable free model.
 * Change it to any model slug from openrouter.ai/models in Render env vars.
 */

const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

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

const RESUME_CHAT_SYSTEM = `You are CareerForge AI, a friendly resume-building assistant.
Help users build a professional resume through conversation.
Ask about experience, education, skills, and achievements one topic at a time.
Keep responses concise and encouraging.
When you have enough data to update the resume, append exactly:
RESUME_UPDATE:{"title":"Full Name","sections":[...]}
Use section types: experience, education, skills, certifications, projects, summary.
Only emit RESUME_UPDATE when you have meaningful new data.`;

export class OpenRouterProvider implements AIProvider {
  private model = DEFAULT_MODEL;

  async chat(messages: ChatMessage[], _systemPrompt: string) {
    const client = getClient();

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: RESUME_CHAT_SYSTEM },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 1024,
    });

    const text = response.choices[0]?.message?.content ?? '';

    if (text.includes('RESUME_UPDATE:')) {
      const idx = text.indexOf('RESUME_UPDATE:');
      const reply = text.slice(0, idx).trim();
      const jsonPart = text.slice(idx + 'RESUME_UPDATE:'.length);
      const resumeUpdate = safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>>>(jsonPart, {});
      return { reply, resumeUpdate };
    }

    return { reply: text };
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
