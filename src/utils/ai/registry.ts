/**
 * @file registry.ts
 * @description Provider adapter registry and dynamic resolver for AetherMind AI connections.
 */

import type { AIProvider, AIProviderAdapter } from './types';
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';
import { GoogleAdapter } from './adapters/google';

class AdapterRegistry {
  private adapters = new Map<AIProvider, AIProviderAdapter>();
  private defaultAdapter: AIProviderAdapter;

  constructor() {
    const openAiAdapter = new OpenAIAdapter();
    this.defaultAdapter = openAiAdapter;

    this.adapters.set('openai', openAiAdapter);
    this.adapters.set('deepseek', openAiAdapter);
    this.adapters.set('openrouter', openAiAdapter);
    this.adapters.set('vercel', openAiAdapter);
    this.adapters.set('custom', openAiAdapter);

    this.adapters.set('anthropic', new AnthropicAdapter());
    this.adapters.set('google', new GoogleAdapter());
  }

  /**
   * Registers or overrides an adapter for a specific provider identifier.
   */
  register(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Resolves the appropriate adapter for a given provider.
   */
  get(provider: AIProvider): AIProviderAdapter {
    return this.adapters.get(provider) || this.defaultAdapter;
  }
}

export const registry = new AdapterRegistry();
