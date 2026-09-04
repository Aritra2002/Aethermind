/**
 * @file openaiEmbedding.ts
 * @description OpenAI text embeddings API adapter supporting text-embedding-3-small and text-embedding-3-large.
 */

import type { EmbeddingAdapter, EmbeddingModelMeta } from '../types';
import { EMBEDDING_MODELS } from '../types';

export class OpenAIEmbeddingAdapter implements EmbeddingAdapter {
  readonly meta: EmbeddingModelMeta;
  private apiKey: string;
  private baseUrl: string;

  constructor(modelId: 'openai-3-small' | 'openai-3-large' = 'openai-3-small', apiKey?: string, baseUrl?: string) {
    this.meta = EMBEDDING_MODELS[modelId];
    this.apiKey = apiKey || localStorage.getItem('aiApiKey') || '';
    this.baseUrl = baseUrl || localStorage.getItem('aiBaseUrl') || 'https://api.openai.com/v1';
  }

  async embed(text: string): Promise<number[]> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return new Array(this.meta.dimension).fill(0);
    }

    if (!this.apiKey) {
      throw new Error('OpenAI API key required for cloud embeddings. Configure it in Settings > AI.');
    }

    const modelName = this.meta.id === 'openai-3-large' ? 'text-embedding-3-large' : 'text-embedding-3-small';
    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/embeddings`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        input: normalizedText,
        model: modelName
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenAI embedding failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.data || !data.data[0] || !Array.isArray(data.data[0].embedding)) {
      throw new Error('Malformed embedding response from OpenAI');
    }

    return data.data[0].embedding;
  }
}
