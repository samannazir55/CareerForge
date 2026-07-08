import type { Resume } from '@careerforge/schema';

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
}
