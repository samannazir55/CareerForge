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
}
