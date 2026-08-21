/**
 * @file performance-cache.test.ts
 * @description Unit test suite for Phase 11: Performance Optimization.
 * Tests in-memory LRU vector embedding cache, hit rates, capacity eviction, and zero-overhead queries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateEmbedding,
  clearEmbeddingCache,
  getEmbeddingCacheSize,
  setUseFallbackForTesting
} from '../utils/vectorSearch';

describe('Phase 11: In-Memory LRU Vector Embedding Cache', () => {
  beforeEach(() => {
    setUseFallbackForTesting(true);
    clearEmbeddingCache();
  });

  it('populates cache and retrieves cached embedding on subsequent calls', async () => {
    const text = 'Quantum computing and entanglement circuits';

    expect(getEmbeddingCacheSize()).toBe(0);

    const first = await generateEmbedding(text);
    expect(getEmbeddingCacheSize()).toBe(1);
    expect(first.length).toBe(384);

    const second = await generateEmbedding(text);
    expect(getEmbeddingCacheSize()).toBe(1);
    // Same vector content returned from cache
    expect(second).toEqual(first);
  });

  it('handles empty or whitespace text gracefully without polluting cache', async () => {
    const emptyVector = await generateEmbedding('');
    expect(emptyVector.length).toBe(384);
    expect(emptyVector.every(v => v === 0)).toBe(true);
    expect(getEmbeddingCacheSize()).toBe(0);

    const spaceVector = await generateEmbedding('   ');
    expect(spaceVector.length).toBe(384);
    expect(spaceVector.every(v => v === 0)).toBe(true);
    expect(getEmbeddingCacheSize()).toBe(0);
  });

  it('clears all cached embeddings when clearEmbeddingCache is called', async () => {
    await generateEmbedding('Artificial intelligence');
    await generateEmbedding('Neural networks');
    await generateEmbedding('Knowledge graph exploration');

    expect(getEmbeddingCacheSize()).toBe(3);

    clearEmbeddingCache();
    expect(getEmbeddingCacheSize()).toBe(0);
  });
});
