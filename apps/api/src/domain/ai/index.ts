import type { AIProvider } from './ai.provider.js';
import { AnthropicProvider } from './anthropic.adapter.js';
import { OpenRouterProvider } from './openrouter.adapter.js';
import { env } from '../../config/env.js';
import { ConfigurationError } from '../../lib/errors.js';

export function createAIProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case 'openrouter':
      return new OpenRouterProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new ConfigurationError(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}. Supported: openrouter, anthropic`);
  }
}

export const aiProvider = createAIProvider();
export type { AIProvider, ChatMessage, ATSResult, JobMatchResult } from './ai.provider.js';
