import type { AIProvider } from './ai.provider.js';
import { AnthropicProvider } from './anthropic.adapter.js';
import { OpenRouterProvider } from './openrouter.adapter.js';
import { GroqProvider } from './groq.adapter.js';
import { FallbackAIProvider } from './fallback.adapter.js';
import { env } from '../../config/env.js';
import { ConfigurationError } from '../../lib/errors.js';

export function createAIProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    // Every case below goes through FallbackAIProvider, even when only one
    // provider ends up in the list. That's not just for the multi-provider
    // fallback — FallbackAIProvider.chat() is also what actually *acts* on
    // a `degraded` chat result (narration leakage, truncated/malformed
    // RESUME_UPDATE JSON — see chatResponseParser) by retrying the same
    // provider a couple of times before giving up. A bare adapter instance
    // computes `degraded` but has no way to do anything about it, so it
    // silently returns a garbled result as if it were a normal success.
    // That mattered most for the 'openrouter' case specifically: it's the
    // default AI_PROVIDER, and its default model (OPENROUTER_MODEL,
    // currently a free 3B-parameter model — deliberately kept on the free
    // tier until this app is actually live) is exactly the kind of model
    // that produces degraded output under this system prompt's "restate
    // everything gathered so far" instruction. Previously only the 'groq'
    // case got this protection; 'openrouter' and 'anthropic' got a bare,
    // unprotected adapter.
    case 'openrouter': {
      const providers: AIProvider[] = [new OpenRouterProvider()];
      const labels = ['OpenRouter'];
      // Optional second tier: if a paid Anthropic key happens to be
      // configured alongside the (free) OpenRouter default, fall back to
      // it when OpenRouter fails outright or stays degraded after retries.
      if (env.ANTHROPIC_API_KEY) {
        providers.push(new AnthropicProvider());
        labels.push('Anthropic');
      }
      return new FallbackAIProvider(providers, labels);
    }
    case 'anthropic': {
      const providers: AIProvider[] = [new AnthropicProvider()];
      const labels = ['Anthropic'];
      if (env.OPENROUTER_API_KEY) {
        providers.push(new OpenRouterProvider());
        labels.push('OpenRouter');
      }
      return new FallbackAIProvider(providers, labels);
    }
    case 'groq': {
      // Groq is fast and free, but it's a single point of failure — model
      // deprecations, rate limits, or outages there shouldn't take the AI
      // features down entirely. When an OpenRouter key is also configured,
      // fall back to it on any failure or degraded chat result.
      const providers: AIProvider[] = [new GroqProvider()];
      const labels = ['Groq'];
      if (env.OPENROUTER_API_KEY) {
        providers.push(new OpenRouterProvider());
        labels.push('OpenRouter');
      }
      return new FallbackAIProvider(providers, labels);
    }
    default:
      throw new ConfigurationError(
        `Unknown AI_PROVIDER: ${env.AI_PROVIDER}. Supported: openrouter, anthropic, groq`,
      );
  }
}

export const aiProvider = createAIProvider();
export type { AIProvider, ChatMessage, ATSResult, JobMatchResult, InterviewQuestion, AnswerEvaluation, LinkedInOptimization } from './ai.provider.js';
