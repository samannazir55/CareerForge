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
    case 'groq': {
      // Groq is fast and free, but it's a single point of failure — model
      // deprecations, rate limits, or outages there shouldn't take the AI
      // features down entirely. When an OpenRouter key is also configured,
      // fall back to it on any failure or degraded chat result.
      //
      // FallbackAIProvider is used even with just Groq alone: its chat()
      // method also retries the *same* provider on a degraded result (a
      // marker-less narration/truncation — see chatResponseParser) before
      // giving up, which matters regardless of whether a second provider
      // is configured. Without this wrapper, a lone GroqProvider had no way
      // to act on its own degraded flag at all — it was computed and
      // silently discarded.
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
export type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
