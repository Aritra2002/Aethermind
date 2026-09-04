/**
 * @file index.ts
 * @description Central multi-model embedding manager, LRU cache, and vector space compatibility engine for AetherMind.
 */

import type { EmbeddingAdapter, EmbeddingConfig, EmbeddingModelId, EmbeddingModelMeta } from './types';
import { LocalMiniLMAdapter, LocalTfIdfAdapter, setLocalFallbackForTesting } from './adapters/localMiniLM';
import { OpenAIEmbeddingAdapter } from './adapters/openaiEmbedding';
import { GoogleEmbeddingAdapter } from './adapters/googleEmbedding';
import { db } from '../../db';

export * from './types';
export { setLocalFallbackForTesting };

const MAX_CACHE_SIZE = 500;
const CACHE = new Map<string, number[]>();

function getSafeStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function setSafeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

export function clearEmbeddingCache() {
  CACHE.clear();
}

export function getEmbeddingCacheSize(): number {
  return CACHE.size;
}

export function getActiveEmbeddingConfig(): EmbeddingConfig {
  const modelId = (getSafeStorage('aethermind-embedding-model') as EmbeddingModelId) || 'local-minilm';
  return {
    modelId,
    apiKey: getSafeStorage('aiApiKey') || '',
    baseUrl: getSafeStorage('aiBaseUrl') || ''
  };
}

export function setActiveEmbeddingModel(modelId: EmbeddingModelId) {
  setSafeStorage('aethermind-embedding-model', modelId);
  clearEmbeddingCache();
}

export function getEmbeddingAdapter(config?: EmbeddingConfig): EmbeddingAdapter {
  const active = config || getActiveEmbeddingConfig();
  switch (active.modelId) {
    case 'local-tfidf':
      return new LocalTfIdfAdapter();
    case 'openai-3-small':
      return new OpenAIEmbeddingAdapter('openai-3-small', active.apiKey, active.baseUrl);
    case 'openai-3-large':
      return new OpenAIEmbeddingAdapter('openai-3-large', active.apiKey, active.baseUrl);
    case 'gemini-embedding-004':
      return new GoogleEmbeddingAdapter(active.apiKey);
    case 'local-minilm':
    default:
      return new LocalMiniLMAdapter();
  }
}

export async function generateEmbeddingWithModel(
  text: string,
  config?: EmbeddingConfig
): Promise<{ embedding: number[]; meta: EmbeddingModelMeta }> {
  const normalizedText = text.trim();
  const adapter = getEmbeddingAdapter(config);
  const meta = adapter.meta;

  if (!normalizedText) {
    return { embedding: new Array(meta.dimension).fill(0), meta };
  }

  const cacheKey = `${meta.id}:${normalizedText}`;
  if (CACHE.has(cacheKey)) {
    const cached = CACHE.get(cacheKey)!;
    CACHE.delete(cacheKey);
    CACHE.set(cacheKey, cached);
    return { embedding: cached, meta };
  }

  const embedding = await adapter.embed(normalizedText);

  if (CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey !== undefined) {
      CACHE.delete(oldestKey);
    }
  }
  CACHE.set(cacheKey, embedding);

  return { embedding, meta };
}

/**
 * Validates that two vectors share identical dimensions to prevent vector space corruption.
 */
export function validateVectorDimensions(a: number[], b: number[]): boolean {
  return Array.isArray(a) && Array.isArray(b) && a.length > 0 && a.length === b.length;
}

/**
 * Migrates and re-embeds all existing notes and RAG document chunks when switching embedding models.
 */
export async function migrateEmbeddingModel(
  newModelId: EmbeddingModelId,
  onProgress?: (progress: { current: number; total: number; title: string }) => void
): Promise<{ migratedNotes: number; migratedChunks: number }> {
  setActiveEmbeddingModel(newModelId);
  const adapter = getEmbeddingAdapter({ modelId: newModelId });

  const notes = await db.notes.toArray();
  const chunks = await db.documents.toArray();
  const total = notes.length + chunks.length;

  let current = 0;
  let migratedNotes = 0;
  let migratedChunks = 0;

  // 1. Re-embed notes
  for (const note of notes) {
    current++;
    if (onProgress) onProgress({ current, total, title: note.title });
    try {
      const text = `${note.title}\n\n${note.content || ''}`;
      const embedding = await adapter.embed(text);
      await db.notes.update(note.id!, { embedding });
      migratedNotes++;
    } catch (e) {
      console.warn(`Failed re-embedding note ${note.title}:`, e);
    }
  }

  // 2. Re-embed document chunks
  for (const chunk of chunks) {
    current++;
    if (onProgress) onProgress({ current, total, title: chunk.documentName });
    try {
      const embedding = await adapter.embed(chunk.content);
      await db.documents.update(chunk.id!, { embedding });
      migratedChunks++;
    } catch (e) {
      console.warn(`Failed re-embedding chunk ${chunk.documentName}:`, e);
    }
  }

  return { migratedNotes, migratedChunks };
}
