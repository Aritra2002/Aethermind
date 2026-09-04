/**
 * @file googleEmbedding.ts
 * @description Google Gemini embedding adapter supporting text-embedding-004.
 */

import type { EmbeddingAdapter, EmbeddingModelMeta } from '../types';
import { EMBEDDING_MODELS } from '../types';

export class GoogleEmbeddingAdapter implements EmbeddingAdapter {
  readonly meta: EmbeddingModelMeta = EMBEDDING_MODELS['gemini-embedding-004'];
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || localStorage.getItem('aiApiKey') || '';
  }

  async embed(text: string): Promise<number[]> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return new Array(this.meta.dimension).fill(0);
    }

    if (!this.apiKey) {
      throw new Error('Google Gemini API key required for embeddings. Configure it in Settings > AI.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text: normalizedText }]
        }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Google Gemini embedding failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.embedding || !Array.isArray(data.embedding.values)) {
      throw new Error('Malformed embedding response from Google Gemini');
    }

    return data.embedding.values;
  }
}
