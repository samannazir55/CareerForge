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

export interface LinkedInOptimization {
  headline: string; // optimized LinkedIn headline (220 chars max)
  summary: string; // About section (2600 chars max, first person)
  experienceBlurbs: Array<{
    title: string;
    company: string;
    bullets: string[]; // 3-5 achievement-focused bullet points
  }>;
  skills: string[]; // top 15 skills to add to profile
  recommendations: Array<{
    section: string; // e.g. "Headline", "About", "Skills"
    issue: string;
    fix: string;
  }>;
}

export interface CareerCoachContext {
  resumeSummary?: string; // brief text summary of user's experience level
  currentRole?: string;
  targetRole?: string;
  yearsExperience?: number;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  timeframe: string; // e.g. "This week", "Next 30 days", "3-6 months"
}

export interface CareerGrowthAnalysis {
  currentLevel: string;
  targetLevel: string;
  skillGaps: Array<{ skill: string; importance: 'critical' | 'important' | 'nice-to-have'; howToLearn: string }>;
  estimatedTimeToTransition: string;
  salaryRange: { current: string; target: string };
  roadmap: Array<{ phase: string; duration: string; goals: string[] }>;
  topRecommendations: string[];
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

  /**
   * Generate an optimized LinkedIn profile draft from a resume — headline,
   * About section, per-role achievement bullets, a keyword-dense skills
   * list, and a short audit of gaps in the profile as it likely stands
   * today. Optional targetRole steers keyword choices toward the role the
   * candidate is searching for rather than their current title.
   */
  optimizeLinkedIn(resume: Resume, targetRole?: string): Promise<LinkedInOptimization>;

  /**
   * A free-form career coaching chat turn. Unlike the resume-builder chat(),
   * this never extracts a resumeUpdate — the two markers it looks for
   * instead are SUGGESTIONS (contextual follow-up questions) and, only when
   * the reply contains a genuinely actionable task, ACTION_ITEMS. context
   * carries whatever the caller knows about the person (current/target
   * role, years of experience, a short resume summary) so advice is
   * personalized without re-sending the full resume on every turn.
   */
  coachChat(
    messages: ChatMessage[],
    context: CareerCoachContext,
  ): Promise<{ reply: string; suggestions?: string[]; actionItems?: ActionItem[] }>;

  /**
   * Analyzes the gap between a candidate's current resume and a target
   * role: skill gaps, a realistic timeline and salary comparison, and a
   * phased roadmap to close the gap.
   */
  analyseCareerGrowth(resume: Resume, targetRole: string): Promise<CareerGrowthAnalysis>;
}
