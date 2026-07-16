import type { Resume, Section } from '@careerforge/schema';

/**
 * AI provider abstraction. All LLM-specific code lives in the adapters.
 * The rest of the application depends only on this interface.
 * Switching models or providers is a config change, not a code change.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ATSResult {
  score: number; // 0–100
  missingKeywords: string[];
  missingSections: string[];
  suggestions: string[];
}

export interface JobMatchResult {
  matchScore: number; // 0–100
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

export interface InterviewQuestion {
  id: string;
  question: string;
  category: 'behavioural' | 'technical' | 'situational' | 'culture';
  difficulty: 'easy' | 'medium' | 'hard';
  tip: string; // one-line hint before answering
}

export interface AnswerEvaluation {
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
  idealAnswer: string; // what a great answer would cover
}

export interface AIProvider {
  /**
   * Send a message in an ongoing resume-building conversation.
   * Returns the assistant's reply and an optional partial resume update
   * when the AI has gathered enough information.
   */
  chat(messages: ChatMessage[], systemPrompt: string): Promise<{
    reply: string;
    resumeUpdate?: Partial<Pick<Resume, 'title' | 'sections'>>;
    suggestions?: string[];
    /**
     * True when a RESUME_UPDATE marker was present in the raw model output
     * but its JSON payload didn't extract cleanly (truncated/malformed).
     * A "degraded" chat result is still a 200-shaped success — it's the
     * caller's signal that this particular completion is worth retrying
     * against a different provider, since a thrown exception never occurs
     * in this failure mode.
     */
    degraded?: boolean;
  }>;

  /**
   * Score a resume against ATS requirements.
   */
  scoreATS(resume: Resume, jobDescription?: string): Promise<ATSResult>;

  /**
   * Compare a resume against a job description.
   */
  matchJobDescription(resume: Resume, jobDescription: string): Promise<JobMatchResult>;

  /**
   * Generate a cover letter from resume data and a job description.
   */
  generateCoverLetter(resume: Resume, jobDescription: string, tone?: string): Promise<string>;

  /**
   * Rewrite a resume's sections to better match a specific job description
   * — sharpening the summary and experience bullet points to surface
   * relevant keywords/skills already present in the candidate's real
   * experience. Must not invent employers, titles, dates, or skills the
   * candidate doesn't already have; only emphasis/wording changes.
   * Returns the full replacement `sections` array (same ids/order/fields
   * as the input — only entry `values` text changes) — the caller decides
   * what to do with it (here: persist as a new resume, never overwriting
   * the original).
   */
  tailorResume(resume: Resume, jobDescription: string): Promise<Section[]>;

  /**
   * Extract structured resume data from raw text (PDF/DOCX import path).
   */
  extractResumeFromText(rawText: string): Promise<Partial<Pick<Resume, 'title' | 'sections'>>>;

  /**
   * Generic single-turn completion: a system prompt + one user message in,
   * raw text out. No resume-domain parsing, no JSON extraction — the
   * caller owns the output format entirely. For features that need an
   * arbitrary, provider-agnostic completion (e.g. the admin AI template
   * generator) rather than one of the resume-specific operations above.
   */
  completeRaw(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string>;

  /**
   * Generate a set of mock interview questions tailored to the candidate's
   * resume and a target job description — a mix of categories/difficulties
   * so a practice session doesn't feel one-note.
   */
  generateInterviewQuestions(resume: Resume, jobDescription: string, count?: number): Promise<InterviewQuestion[]>;

  /**
   * Evaluate a candidate's spoken/written answer to a single interview
   * question against the job context, returning a score plus concrete
   * feedback the candidate can act on before the next question.
   */
  evaluateAnswer(question: string, answer: string, jobDescription: string): Promise<AnswerEvaluation>;
}
