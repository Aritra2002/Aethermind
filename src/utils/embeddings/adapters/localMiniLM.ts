/**
 * @file localMiniLM.ts
 * @description Local in-browser feature extraction adapter running Xenova/all-MiniLM-L6-v2 via WASM/ONNX
 * with deterministic TF-IDF feature hashing fallback.
 */

import type { EmbeddingAdapter, EmbeddingModelMeta } from '../types';
import { EMBEDDING_MODELS } from '../types';

type FeatureExtractionPipeline = (text: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array | number[] }>;

let embedder: FeatureExtractionPipeline | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transformersModule: any = null;
let useFallback = false;

const FALLBACK_DIM = 384;

export const setLocalFallbackForTesting = (flag: boolean) => {
  useFallback = flag;
};

const tokenize = (text: string): string[] => text.toLowerCase().match(/\b\w+\b/g) || [];

const hashToken = (token: string): number => {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % FALLBACK_DIM;
};

export const tfidfEmbed = (tokens: string[]): number[] => {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const total = tokens.length || 1;

  const vec = new Array(FALLBACK_DIM).fill(0);
  for (const [token, count] of Object.entries(tf)) {
    const weight = (count / total) * (1 + Math.log(1 + count));
    vec[hashToken(token)] += weight;
  }

  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
};

const initTransformer = async (): Promise<FeatureExtractionPipeline | null> => {
  try {
    if (!transformersModule) {
      transformersModule = await import('@xenova/transformers');
      transformersModule.env.allowLocalModels = false;
      transformersModule.env.useBrowserCache = false;
    }
    const pipe = await transformersModule.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as unknown as FeatureExtractionPipeline;
    return pipe;
  } catch (e) {
    console.warn('Transformer WASM unavailable, using TF-IDF fallback:', e);
    useFallback = true;
    return null;
  }
};

export class LocalMiniLMAdapter implements EmbeddingAdapter {
  readonly meta: EmbeddingModelMeta = EMBEDDING_MODELS['local-minilm'];

  async embed(text: string): Promise<number[]> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return new Array(this.meta.dimension).fill(0);
    }

    if (useFallback) {
      return tfidfEmbed(tokenize(normalizedText));
    }

    if (!embedder) {
      embedder = await initTransformer();
    }

    if (!embedder) {
      return tfidfEmbed(tokenize(normalizedText));
    }

    try {
      const output = await embedder(normalizedText, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch {
      useFallback = true;
      console.warn('Transformer failed at runtime, switching to TF-IDF fallback');
      return tfidfEmbed(tokenize(normalizedText));
    }
  }
}

export class LocalTfIdfAdapter implements EmbeddingAdapter {
  readonly meta: EmbeddingModelMeta = EMBEDDING_MODELS['local-tfidf'];

  async embed(text: string): Promise<number[]> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return new Array(this.meta.dimension).fill(0);
    }
    return tfidfEmbed(tokenize(normalizedText));
  }
}
