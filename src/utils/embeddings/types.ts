/**
 * @file types.ts
 * @description Types and configuration contracts for multi-model embedding engines in AetherMind.
 */

export type EmbeddingModelId =
  | 'local-minilm'
  | 'local-tfidf'
  | 'openai-3-small'
  | 'openai-3-large'
  | 'gemini-embedding-004'
  | 'custom';

export interface EmbeddingModelMeta {
  id: EmbeddingModelId;
  name: string;
  provider: 'local' | 'openai' | 'google' | 'custom';
  dimension: number;
  description: string;
  isLocal: boolean;
}

export interface EmbeddingConfig {
  modelId: EmbeddingModelId;
  apiKey?: string;
  baseUrl?: string;
  customDimension?: number;
}

export interface EmbeddingAdapter {
  readonly meta: EmbeddingModelMeta;
  embed(text: string): Promise<number[]>;
}

export const EMBEDDING_MODELS: Record<EmbeddingModelId, EmbeddingModelMeta> = {
  'local-minilm': {
    id: 'local-minilm',
    name: 'All-MiniLM-L6-v2 (Local WASM)',
    provider: 'local',
    dimension: 384,
    description: 'Runs offline in-browser using WebAssembly. Fast and private.',
    isLocal: true
  },
  'local-tfidf': {
    id: 'local-tfidf',
    name: 'TF-IDF Feature Hashing (Local JS)',
    provider: 'local',
    dimension: 384,
    description: 'Instant zero-dependency lexical vector hashing.',
    isLocal: true
  },
  'openai-3-small': {
    id: 'openai-3-small',
    name: 'OpenAI text-embedding-3-small',
    provider: 'openai',
    dimension: 1536,
    description: 'High semantic precision via OpenAI API.',
    isLocal: false
  },
  'openai-3-large': {
    id: 'openai-3-large',
    name: 'OpenAI text-embedding-3-large',
    provider: 'openai',
    dimension: 3072,
    description: 'Maximum precision high-dimensional embedding via OpenAI API.',
    isLocal: false
  },
  'gemini-embedding-004': {
    id: 'gemini-embedding-004',
    name: 'Google Gemini text-embedding-004',
    provider: 'google',
    dimension: 768,
    description: 'Google AI Studio multi-lingual semantic embeddings.',
    isLocal: false
  },
  'custom': {
    id: 'custom',
    name: 'Custom Embedding API',
    provider: 'custom',
    dimension: 384,
    description: 'User-configured custom embedding endpoint.',
    isLocal: false
  }
};
