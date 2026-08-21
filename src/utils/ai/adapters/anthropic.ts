/**
 * @file anthropic.ts
 * @description Anthropic Claude provider adapter supporting Messages API and token streaming.
 */

import type { AIConfig, AIProviderAdapter, AIRequestOptions, ModelInfo } from '../types';
import { redactSecrets, getClientSpoofHeaders, resolveEndpoint, processSseStream } from './base';

export class AnthropicAdapter implements AIProviderAdapter {
  readonly id = 'anthropic' as const;

  async call(config: AIConfig, options: AIRequestOptions): Promise<string> {
    const isStream = !!options.onStream;
    let endpoint = config.baseUrl.trim();

    if (!endpoint.endsWith('/v1/messages')) {
      endpoint = resolveEndpoint(endpoint, '/v1/messages', config.proxyUrl);
    } else if (config.proxyUrl) {
      endpoint = `${config.proxyUrl.trim().replace(/\/+$/, '')}?url=${encodeURIComponent(endpoint)}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      ...getClientSpoofHeaders(config)
    };

    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    const payload = {
      model: config.model || 'claude-3-5-sonnet-20240620',
      max_tokens: options.maxTokens || 4096,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: options.userPrompt }],
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
          throw new Error('Authentication failed (401): Invalid Anthropic API key.');
        }
        throw new Error(`Anthropic API returned ${response.status}: ${redactSecrets(errDetails)}`);
      }

      if (isStream) {
        let fullText = '';
        await processSseStream(
          response,
          (dataStr) => {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta') {
                const delta = parsed.delta?.text || '';
                if (delta) {
                  fullText += delta;
                  options.onStream?.(fullText, delta);
                }
              }
            } catch (err) {
              console.debug('Failed to parse Anthropic stream chunk', err);
            }
          },
          options.signal
        );
        return fullText;
      } else {
        const data = await response.json();
        return data.content?.[0]?.text || '';
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        error.message = redactSecrets(error.message);
      }
      throw error;
    }
  }

  async detectModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
    ];
  }
}
