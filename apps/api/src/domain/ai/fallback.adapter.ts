import type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
import type { Resume } from '@careerforge/schema';

/**
 * Wraps an ordered list of AIProvider instances and tries them in order,
 * falling through to the next one whenever a call throws — a bad API key,
 * a network error, a rate limit, a deprecated/unknown model ID, a timeout,
 * whatever. Each method call is independent: one request falling back to
 * OpenRouter doesn't "stick" — the next request still tries the primary
 * provider first, so a transient Groq blip doesn't permanently switch you
 * over.
 *
 * Every provider except the last is caught and logged as a warning; the
 * last provider's error is the one that actually surfaces to the caller
 * (so error messages stay meaningful instead of always saying "Groq failed"
 * when the real problem is with whichever provider actually gave up).
 */
export class FallbackAIProvider implements AIProvider {
  constructor(
    private providers: AIProvider[],
    private labels: string[],
  ) {
    if (providers.length === 0) {
      throw new Error('FallbackAIProvider needs at least one provider');
    }
  }

  private async tryInOrder<T>(fn: (p: AIProvider) => Promise<T>, opName: string): Promise<T> {
    for (let i = 0; i < this.providers.length; i++) {
      const isLast = i === this.providers.length - 1;
      try {
        return await fn(this.providers[i]);
      } catch (err) {
        if (isLast) throw err;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[ai] ${this.labels[i]} failed on ${opName}, falling back to ${this.labels[i + 1]}: ${message}`,
        );
      }
    }
    // Unreachable — the loop above always returns or throws — but keeps
    // TypeScript happy about the function's return type.
    throw new Error('FallbackAIProvider: no provider available');
  }

  async chat(messages: ChatMessage[], systemPrompt: string) {
    // chat() is special-cased: parseChatResponse never throws, even when it
    // fails to extract a usable RESUME_UPDATE (truncated/malformed JSON
    // after a marker). That means a garbled response comes back as a normal
    // 200-shaped result, and tryInOrder's catch-based fallback would never
    // see it as a failure — the fallback chain would go entirely unused for
    // exactly the failure mode it exists to catch. Try each provider in
    // order and accept the first non-degraded result; if every provider
    // degrades, return the last one rather than erroring the whole request,
    // since a degraded-but-non-empty reply is still better than a hard 500.
    let lastResult: Awaited<ReturnType<AIProvider['chat']>> | undefined;
    for (let i = 0; i < this.providers.length; i++) {
      const isLast = i === this.providers.length - 1;
      try {
        const result = await this.providers[i].chat(messages, systemPrompt);
        console.log(`[ai] chat served by ${this.labels[i]}${result.degraded ? ' (degraded)' : ''}`);
        if (!result.degraded || isLast) return result;
        lastResult = result;
        console.warn(`[ai] ${this.labels[i]} returned a degraded chat result, falling back to ${this.labels[i + 1]}`);
      } catch (err) {
        if (isLast) throw err;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[ai] ${this.labels[i]} failed on chat, falling back to ${this.labels[i + 1]}: ${message}`);
      }
    }
    return lastResult!;
  }

  scoreATS(resume: Resume, jobDescription?: string): Promise<ATSResult> {
    return this.tryInOrder((p) => p.scoreATS(resume, jobDescription), 'scoreATS');
  }

  matchJobDescription(resume: Resume, jobDescription: string): Promise<JobMatchResult> {
    return this.tryInOrder((p) => p.matchJobDescription(resume, jobDescription), 'matchJobDescription');
  }

  generateCoverLetter(resume: Resume, jobDescription: string, tone?: string): Promise<string> {
    return this.tryInOrder((p) => p.generateCoverLetter(resume, jobDescription, tone), 'generateCoverLetter');
  }

  extractResumeFromText(rawText: string): Promise<Partial<Pick<Resume, 'title' | 'sections'>>> {
    return this.tryInOrder((p) => p.extractResumeFromText(rawText), 'extractResumeFromText');
  }
}
