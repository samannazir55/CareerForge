import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ChatMessage, ATSResult, JobMatchResult, InterviewQuestion, AnswerEvaluation } from './ai.provider.js';
import type { Resume, Section } from '@careerforge/schema';
import { env } from '../../config/env.js';
import { ConfigurationError, BadGatewayError } from '../../lib/errors.js';
import { parseChatResponse, extractResumeJson, extractTailoredSections } from './chatResponseParser.js';
import { TAILOR_RESUME_SYSTEM_PROMPT } from './tailorPrompt.js';

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

function safeJsonParseArray<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? (JSON.parse(match[0]) as T) : fallback;
  } catch {
    return fallback;
  }
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

    // Tolerant of both the "RESUME_UPDATE:" colon format the system prompt
    // asks for and a "<RESUME_UPDATE>...</RESUME_UPDATE>" tag format —
    // see chatResponseParser for why both are handled.
    return parseChatResponse(text);
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

  async tailorResume(resume: Resume, jobDescription: string): Promise<Section[]> {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: TAILOR_RESUME_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Candidate's resume sections (JSON):\n${JSON.stringify(resume.sections)}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nReturn the rewritten sections array now.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const sections = extractTailoredSections(text);
    if (!sections) {
      throw new BadGatewayError('The AI did not return a usable tailored resume. Please try again.');
    }
    return sections;
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
Dates must be in YYYY-MM format (e.g. "2023-09"). If the source only gives a year, use YYYY-01. If a role is current/ongoing, use an empty string for endDate.
For skills use key: name. Generate UUIDs as simple incrementing strings like "s1","s2","e1","e2".`,
      messages: [{ role: 'user', content: `Parse this resume:\n\n${rawText}` }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return extractResumeJson(text) ?? {};
  }

  async completeRaw(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<string> {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
  }

  async generateInterviewQuestions(resume: Resume, jobDescription: string, count = 10): Promise<InterviewQuestion[]> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are an expert interview coach. Generate exactly ${count} realistic interview questions tailored to the candidate's resume and the target job description. Use a mix of categories (behavioural, technical, situational, culture) and difficulties (easy, medium, hard). For each question include a short one-line tip the candidate should read before answering. Return ONLY a valid JSON array matching this shape, nothing else:
[{"id":"q1","question":"...","category":"behavioural","difficulty":"medium","tip":"..."}]`,
      messages: [
        {
          role: 'user',
          content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nGenerate ${count} interview questions now.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return safeJsonParseArray<InterviewQuestion[]>(text, []);
  }

  async evaluateAnswer(question: string, answer: string, jobDescription: string): Promise<AnswerEvaluation> {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        'You are an expert interview coach evaluating a candidate\'s answer against the job context. Return ONLY valid JSON with this exact shape: {"score":0,"strengths":[],"improvements":[],"idealAnswer":""}. score is 0-100. strengths and improvements are short bullet-point strings. idealAnswer is a short paragraph describing what a great answer would cover.',
      messages: [
        {
          role: 'user',
          content: `JOB DESCRIPTION:\n${jobDescription}\n\nQUESTION:\n${question}\n\nCANDIDATE'S ANSWER:\n${answer}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return safeJsonParse<AnswerEvaluation>(text, {
      score: 0,
      strengths: [],
      improvements: [],
      idealAnswer: 'Unable to evaluate this answer right now. Please try again.',
    });
  }
}
