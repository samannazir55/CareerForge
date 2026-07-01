import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
import type { Resume } from '@careerforge/schema';
import { env } from '../../config/env.js';
import { ConfigurationError } from '../../lib/errors.js';

const MODEL = 'claude-sonnet-4-6';

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ConfigurationError(
      'ANTHROPIC_API_KEY is not set. AI features require a real Anthropic API key. ' +
        'See apps/api/.env.example for setup instructions.',
    );
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
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
 * human-facing reply with both markers stripped out. */
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
    // Re-attach whatever came after the JSON object in case SUGGESTIONS
    // follows on the same tail (the common, prompted ordering).
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

export class AnthropicProvider implements AIProvider {
  async chat(messages: ChatMessage[], systemPrompt: string) {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return extractChatMarkers(text);
  }

  async scoreATS(resume: Resume, jobDescription?: string): Promise<ATSResult> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const prompt = jobDescription
      ? `Analyze this resume against the job description and return a JSON ATS score.\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`
      : `Analyze this resume for general ATS compatibility and return a JSON ATS score.\n\nRESUME:\n${resumeText}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You are an ATS expert. Return ONLY valid JSON with this exact shape:
{"score":0,"missingKeywords":[],"missingSections":[],"suggestions":[]}
score is 0-100. Arrays contain strings.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

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

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You are a job matching expert. Return ONLY valid JSON with this exact shape:
{"matchScore":0,"matchedKeywords":[],"missingKeywords":[],"suggestions":[]}
matchScore is 0-100. Arrays contain strings.`,
      messages: [
        {
          role: 'user',
          content: `Compare this resume to the job description.\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

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

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You are an expert cover letter writer. Write compelling, personalized cover letters.`,
      messages: [
        {
          role: 'user',
          content: `Write a ${tone} cover letter for this candidate.\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nWrite only the cover letter text, no explanations.`,
        },
      ],
    });

    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
  }

  async extractResumeFromText(rawText: string): Promise<Partial<Pick<Resume, 'title' | 'sections'>>> {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are a resume parser. Extract resume data and return ONLY valid JSON.
Return this shape: {"title":"Full Name","sections":[{"id":"uuid","type":"experience","title":"Experience","order":0,"fields":[],"entries":[{"id":"uuid","values":{}}]}]}
Use proper section types: experience, education, skills, certifications, projects, languages, references, summary.
For experience entries use keys: title, company, location, startDate, endDate, description.
For education entries use keys: degree, school, startDate, endDate.
For skills use key: name. Generate UUIDs as simple incrementing strings like "s1","s2","e1","e2".`,
      messages: [{ role: 'user', content: `Parse this resume:\n\n${rawText}` }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>>>(text, {});
  }
}
