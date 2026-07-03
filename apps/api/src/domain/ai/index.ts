import type { AIProvider } from './ai.provider.js';
import { AnthropicProvider } from './anthropic.adapter.js';
import { OpenRouterProvider } from './openrouter.adapter.js';
import { GroqProvider } from './groq.adapter.js';
import { FallbackAIProvider } from './fallback.adapter.js';
import { env } from '../../config/env.js';
import { ConfigurationError } from '../../lib/errors.js';

export function createAIProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case 'openrouter':
      return new OpenRouterProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'groq':
      // Groq is fast and free, but it's a single point of failure — model
      // deprecations, rate limits, or outages there shouldn't take the AI
      // features down entirely. When an OpenRouter key is also configured,
      // wrap Groq with an automatic fallback to OpenRouter on any failure.
      // Without an OpenRouter key there's nothing to fall back to, so it
      // just runs Groq alone (same as before).
      if (env.OPENROUTER_API_KEY) {
        return new FallbackAIProvider(
          [new GroqProvider(), new OpenRouterProvider()],
          ['Groq', 'OpenRouter'],
        );
      }
      return new GroqProvider();
    default:
      throw new ConfigurationError(
        `Unknown AI_PROVIDER: ${env.AI_PROVIDER}. Supported: openrouter, anthropic, groq`,
      );
  }
}

export const aiProvider = createAIProvider();
export type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
