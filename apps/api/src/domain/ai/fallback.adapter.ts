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
    // fails to extract a usable RESUME_UPDATE (truncated/malformed JSON,
    // or narration that never reached a marker at all). That means a
    // garbled response comes back as a normal 200-shaped result, and
    // tryInOrder's catch-based fallback would never see it as a failure.
    //
    // Two layers here:
    //  1. Per provider, retry the SAME provider up to SAME_PROVIDER_RETRIES
    //     times on a degraded result before moving to the next provider (or
    //     giving up, if there is no next provider). A single sample landing
    //     on excessive reasoning/narration is often just bad luck for that
    //     particular completion, not a persistent property of the provider —
    //     this matters a lot when there's only one provider configured at
    //     all (no OpenRouter key), where "fall back to the next provider"
    //     isn't an option.
    //  2. If every attempt across every provider still comes back degraded,
    //     never surface the raw (likely narration-contaminated) reply text
    //     to the user — replace it with a short, safe, generic message
    //     instead. A visibly-broken response is worse than a slightly
    //     repetitive one.
    const SAME_PROVIDER_RETRIES = 2;
    let lastResult: Awaited<ReturnType<AIProvider['chat']>> | undefined;

    for (let i = 0; i < this.providers.length; i++) {
      const isLast = i === this.providers.length - 1;
      try {
        for (let attempt = 1; attempt <= SAME_PROVIDER_RETRIES; attempt++) {
          const result = await this.providers[i].chat(messages, systemPrompt);
          const attemptTag = attempt > 1 ? ` (retry ${attempt - 1})` : '';
          console.log(`[ai] chat served by ${this.labels[i]}${attemptTag}${result.degraded ? ' — degraded' : ''}`);
          if (!result.degraded) return result;
          lastResult = result;
          if (attempt < SAME_PROVIDER_RETRIES) {
            console.warn(`[ai] ${this.labels[i]} returned a degraded chat result, retrying same provider`);
          }
        }
        if (!isLast) {
          console.warn(`[ai] ${this.labels[i]} stayed degraded after retries, falling back to ${this.labels[i + 1]}`);
        }
      } catch (err) {
        if (isLast) throw err;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[ai] ${this.labels[i]} failed on chat, falling back to ${this.labels[i + 1]}: ${message}`);
      }
    }

    // Every provider (and every retry) still came back degraded. Keep
    // whatever resumeUpdate/suggestions happened to be extracted, if any,
    // but never show the user text that's likely leftover narration.
    //
    // IMPORTANT: this message must not sound like a success acknowledgment.
    // It previously read "Got it, thanks! Let's keep going" — which is
    // indistinguishable from a real "I saved that" reply, so a request that
    // silently failed to extract (e.g. asking to add a certifications
    // section) looked identical to one that worked. The user has no way to
    // know their data wasn't saved, which is worse than an honest failure:
    // it actively misleads them into believing something happened.
    console.warn('[ai] all providers stayed degraded on chat — returning an honest failure message');
    return {
      ...lastResult!,
      reply: "Sorry, I had trouble processing that — could you try sending it again, maybe with a bit more detail?",
    };
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

  completeRaw(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string> {
    return this.tryInOrder((p) => p.completeRaw(systemPrompt, userMessage, maxTokens), 'completeRaw');
  }
}
