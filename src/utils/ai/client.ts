/**
 * @file client.ts
 * @description Main client entrypoint for AI dispatch, model detection, and configuration.
 */

import type { AIConfig, AIProvider, AIRequestOptions, ModelInfo } from './types';
import { registry } from './registry';
import { redactSecrets } from './adapters/base';
import { withRetry } from './retry';
import { aiStopManager } from '../aiStopManager';

/**
 * Retrieves the current AI configuration from browser `localStorage` with provider-specific defaults.
 */
export const getAIConfig = (): AIConfig => {
  const provider = (localStorage.getItem('aiProvider') as AIProvider) || 'openai';
  const defaultBaseUrl: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    openrouter: 'https://openrouter.ai/api/v1',
  };
  const defaultModel: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20240620',
    deepseek: 'deepseek-chat',
    google: 'gemini-2.5-flash',
    openrouter: 'google/gemini-2.5-flash',
  };

  let clientSpoof = localStorage.getItem('aiClientSpoof') as AIConfig['clientSpoof'];
  if (!clientSpoof) clientSpoof = 'none';

  let customClientHeaders: Record<string, string> | undefined;
  try {
    const rawHeaders = localStorage.getItem('aiCustomClientHeaders');
    if (rawHeaders) customClientHeaders = JSON.parse(rawHeaders);
  } catch {
    customClientHeaders = undefined;
  }

  return {
    provider,
    baseUrl: localStorage.getItem('aiBaseUrl') || defaultBaseUrl[provider] || '',
    apiKey: localStorage.getItem('aiApiKey') || '',
    model: localStorage.getItem('aiModel') || defaultModel[provider] || '',
    proxyUrl: localStorage.getItem('aiProxyUrl') || undefined,
    clientSpoof,
    customClientHeaders
  };
};

/**
 * Persists updated AI connection settings into browser `localStorage`.
 */
export const setAIConfig = (config: AIConfig) => {
  localStorage.setItem('aiProvider', config.provider);
  localStorage.setItem('aiBaseUrl', config.baseUrl);
  localStorage.setItem('aiApiKey', config.apiKey);
  localStorage.setItem('aiModel', config.model);
  if (config.proxyUrl) {
    localStorage.setItem('aiProxyUrl', config.proxyUrl);
  } else {
    localStorage.removeItem('aiProxyUrl');
  }
  if (config.clientSpoof) {
    localStorage.setItem('aiClientSpoof', config.clientSpoof);
  }
  if (config.customClientHeaders) {
    localStorage.setItem('aiCustomClientHeaders', JSON.stringify(config.customClientHeaders));
  } else {
    localStorage.removeItem('aiCustomClientHeaders');
  }
};

/**
 * Dispatches a prompt to the configured AI provider with optional real-time token streaming.
 */
export const callAI = async (
  systemPrompt: string,
  userPrompt: string,
  onStream?: (accumulatedText: string, delta?: string) => void,
  signal?: AbortSignal,
  temperature?: number
): Promise<string> => {
  const config = getAIConfig();

  if (!config.apiKey && config.provider !== 'custom') {
    throw new Error(`API key required for ${config.provider}. Configure it in Settings > AI.`);
  }

  if (!config.baseUrl) {
    throw new Error(`Base URL required for ${config.provider}. Configure it in Settings > AI.`);
  }

  const internalController = new AbortController();
  const unregister = aiStopManager.register(internalController);

  if (signal) {
    if (signal.aborted) {
      unregister();
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => internalController.abort(), { once: true });
  }

  const adapter = registry.get(config.provider);
  const options: AIRequestOptions = {
    systemPrompt,
    userPrompt,
    onStream,
    signal: internalController.signal,
    temperature
  };

  try {
    return await withRetry(
      () => adapter.call(config, options),
      { signal: options.signal, maxRetries: 2 }
    );
  } finally {
    unregister();
  }
};

/**
 * Discovers available models from an API endpoint.
 */
export async function detectModels(
  baseUrl: string,
  apiKey?: string,
  provider?: AIProvider
): Promise<ModelInfo[]> {
  const targetProvider = provider || (localStorage.getItem('aiProvider') as AIProvider) || 'custom';
  const adapter = registry.get(targetProvider);

  if (adapter.detectModels) {
    const config: AIConfig = {
      provider: targetProvider,
      baseUrl,
      apiKey: apiKey || '',
      model: '',
      clientSpoof: (localStorage.getItem('aiClientSpoof') as AIConfig['clientSpoof']) || 'none'
    };
    return adapter.detectModels(config);
  }

  return [];
}

export { redactSecrets };
