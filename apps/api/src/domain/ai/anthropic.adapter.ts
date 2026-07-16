import Anthropic from '@anthropic-ai/sdk';
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

  async optimizeLinkedIn(resume: Resume, targetRole?: string): Promise<LinkedInOptimization> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are a LinkedIn profile expert. Given this resume${targetRole ? ' and target role' : ''}, generate an optimized LinkedIn profile. Prioritize keyword density for recruiter searches, achievement-focused language, and first-person voice for the summary. Return ONLY valid JSON matching this exact shape, nothing else:
{"headline":"","summary":"","experienceBlurbs":[{"title":"","company":"","bullets":["",""]}],"skills":["",""],"recommendations":[{"section":"","issue":"","fix":""}]}
headline is max 220 characters. summary (the About section) is max 2600 characters, written in first person. experienceBlurbs has 3-5 achievement-focused bullets per role. skills lists the top 15 skills to add to the profile. recommendations is a short audit of gaps in the candidate's likely current profile (section names like "Headline", "About", "Skills", "Experience").`,
      messages: [
        {
          role: 'user',
          content: `RESUME:\n${resumeText}${targetRole ? `\n\nTARGET ROLE:\n${targetRole}` : ''}\n\nGenerate the optimized LinkedIn profile now.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

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

After your reply, append a new line starting with SUGGESTIONS: followed by a JSON array of 3 relevant follow-up questions the person could ask next, e.g. SUGGESTIONS:["...","...","..."]
If your reply includes specific, concrete tasks for the person to do, also append a new line starting with ACTION_ITEMS: followed by a JSON array matching this shape: [{"priority":"high","title":"...","description":"...","timeframe":"..."}]. priority is "high", "medium", or "low". timeframe is short, e.g. "This week", "Next 30 days", "3-6 months". Only include ACTION_ITEMS when there's a genuinely actionable task — most replies won't need one.`;

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

    return extractCoachMarkers(text);
  }

  async analyseCareerGrowth(resume: Resume, targetRole: string): Promise<CareerGrowthAnalysis> {
    const client = getClient();
    const resumeText = resumeToText(resume);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are a career strategist. Analyze the gap between this person's current experience (from their resume) and their target role. Return ONLY valid JSON matching this exact shape, nothing else:
{"currentLevel":"","targetLevel":"","skillGaps":[{"skill":"","importance":"critical","howToLearn":""}],"estimatedTimeToTransition":"","salaryRange":{"current":"","target":""},"roadmap":[{"phase":"","duration":"","goals":["",""]}],"topRecommendations":["",""]}
importance is "critical", "important", or "nice-to-have". Be realistic about timelines and salary ranges based on the industry — don't inflate or sugarcoat either.`,
      messages: [
        {
          role: 'user',
          content: `RESUME:\n${resumeText}\n\nTARGET ROLE:\n${targetRole}\n\nAnalyze the career growth path now.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

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
