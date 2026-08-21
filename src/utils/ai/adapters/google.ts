/**
 * @file google.ts
 * @description Google Gemini provider adapter with OpenAI-compatible gateway and token streaming.
 */

import type { AIConfig, AIProviderAdapter, AIRequestOptions, ModelInfo } from '../types';
import { redactSecrets, getClientSpoofHeaders, resolveEndpoint, processSseStream } from './base';

export class GoogleAdapter implements AIProviderAdapter {
  readonly id = 'google' as const;

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
      headers['x-goog-api-key'] = config.apiKey;
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const payload = {
      model: config.model || 'gemini-2.5-flash',
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
          throw new Error('Authentication failed (401): Invalid Google Gemini API key.');
        }
        throw new Error(`Google API returned ${response.status}: ${redactSecrets(errDetails)}`);
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
              console.debug('Failed to parse Gemini SSE token chunk', err);
            }
          },
          options.signal
        );
        return fullText;
      } else {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ];
  }
}
