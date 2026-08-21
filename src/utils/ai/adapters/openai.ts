/**
 * @file openai.ts
 * @description OpenAI and OpenAI-compatible provider adapter (OpenAI, DeepSeek, OpenRouter, Vercel, Custom/Ollama/LM Studio).
 */

import type { AIConfig, AIProviderAdapter, AIRequestOptions, ModelInfo } from '../types';
import { redactSecrets, getClientSpoofHeaders, resolveEndpoint, processSseStream } from './base';

export class OpenAIAdapter implements AIProviderAdapter {
  readonly id = 'openai' as const;

  /**
   * Executes an OpenAI chat completion request with SSE streaming support.
   */
  async call(config: AIConfig, options: AIRequestOptions): Promise<string> {
    const isStream = !!options.onStream;
    let endpoint = config.baseUrl.trim();

    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = resolveEndpoint(endpoint, '/chat/completions', config.proxyUrl);
    } else if (config.proxyUrl) {
      endpoint = `${config.proxyUrl.trim().replace(/\/+$/, '')}?url=${encodeURIComponent(endpoint)}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getClientSpoofHeaders(config)
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    if (config.provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'AetherMind Knowledge Agent';
    }

    const payload = {
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt }
      ],
      stream: isStream,
      temperature: options.temperature ?? 0.7
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: options.signal
      });

      if (!response.ok) {
        let errDetails = '';
        try {
          const errJson = await response.json();
          errDetails = errJson.error?.message || JSON.stringify(errJson);
        } catch {
          errDetails = await response.text().catch(() => 'No error response body');
        }

        if (response.status === 401) {
          throw new Error(`Authentication failed (401): Check your API key for ${config.provider}.`);
        }
        throw new Error(`${config.provider} API returned ${response.status}: ${redactSecrets(errDetails)}`);
      }

      if (isStream) {
        let fullText = '';
        await processSseStream(
          response,
          (dataStr) => {
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                options.onStream?.(fullText, delta);
              }
            } catch (err) {
              console.debug('Failed to parse SSE token chunk', err);
            }
          },
          options.signal
        );
        return fullText;
      } else {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (error: unknown) {
      if (error instanceof TypeError && error.message === 'Failed to fetch' && endpoint.includes('11434')) {
        throw new Error(
          'Failed to connect to Ollama. This is likely a CORS issue. Please restart Ollama with OLLAMA_ORIGINS="*" or "https://aritra2002.github.io".',
          { cause: error }
        );
      }
      if (error instanceof Error) {
        error.message = redactSecrets(error.message);
      }
      throw error;
    }
  }

  /**
   * Discovers available models from the standard `/v1/models` route.
   */
  async detectModels(config: AIConfig): Promise<ModelInfo[]> {
    let cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    if (cleanBase.endsWith('/chat/completions')) {
      cleanBase = cleanBase.replace(/\/chat\/completions$/, '');
    }

    const endpoint = resolveEndpoint(cleanBase, '/models', config.proxyUrl);
    const headers: Record<string, string> = {
      ...getClientSpoofHeaders(config)
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(endpoint, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch models: HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawList = Array.isArray(data) ? data : data.data || [];

    return rawList.map((m: { id?: string; name?: string }) => ({
      id: m.id || m.name || String(m),
      name: m.name || m.id || String(m)
    }));
  }
}
