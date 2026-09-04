import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateEmbedding,
  cosineSimilarity,
  setUseFallbackForTesting,
  clearEmbeddingCache,
  getEmbeddingCacheSize,
  setActiveEmbeddingModel,
  getEmbeddingAdapter,
  validateVectorDimensions,
  EMBEDDING_MODELS
} from '../utils/vectorSearch';
import { chunkMarkdownStructural } from '../utils/rag';

describe('Multi-Model Embeddings and Dimension Safety', () => {
  beforeEach(() => {
    setUseFallbackForTesting(true);
    clearEmbeddingCache();
    setActiveEmbeddingModel('local-tfidf');
  });

  it('generates normalized 384-dimensional vector with TF-IDF fallback', async () => {
    const text = 'Knowledge graph and artificial intelligence operating system';
    const vec = await generateEmbedding(text);

    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBe(384);

    // Verify L2 normalization: sqrt(sum(v_i^2)) ≈ 1.0
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('caches generated embeddings in memory LRU cache for instant recall', async () => {
    expect(getEmbeddingCacheSize()).toBe(0);

    const query = 'Machine learning architectures in local databases';
    const vec1 = await generateEmbedding(query);
    expect(getEmbeddingCacheSize()).toBe(1);

    const vec2 = await generateEmbedding(query);
    expect(getEmbeddingCacheSize()).toBe(1);
    expect(vec1).toEqual(vec2);
  });

  it('safely rejects cosine similarity between mismatched vector dimensions', () => {
    const vec384 = new Array(384).fill(0.1);
    const vec1536 = new Array(1536).fill(0.1);

    expect(validateVectorDimensions(vec384, vec1536)).toBe(false);
    expect(cosineSimilarity(vec384, vec1536)).toBe(0);
    expect(cosineSimilarity([], vec384)).toBe(0);
    expect(cosineSimilarity(vec384, [])).toBe(0);
  });

  it('computes accurate cosine similarity between identical and orthogonal vectors', () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];

    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 5);
  });

  it('exposes known embedding models with accurate metadata', () => {
    expect(EMBEDDING_MODELS['local-minilm'].dimension).toBe(384);
    expect(EMBEDDING_MODELS['local-tfidf'].dimension).toBe(384);
    expect(EMBEDDING_MODELS['openai-3-small'].dimension).toBe(1536);
    expect(EMBEDDING_MODELS['openai-3-large'].dimension).toBe(3072);
    expect(EMBEDDING_MODELS['gemini-embedding-004'].dimension).toBe(768);
  });

  it('instantiates appropriate adapter for selected model config', () => {
    const localAdapter = getEmbeddingAdapter({ modelId: 'local-tfidf' });
    expect(localAdapter.meta.id).toBe('local-tfidf');
    expect(localAdapter.meta.dimension).toBe(384);

    const openaiAdapter = getEmbeddingAdapter({ modelId: 'openai-3-small', apiKey: 'test-key' });
    expect(openaiAdapter.meta.id).toBe('openai-3-small');
    expect(openaiAdapter.meta.dimension).toBe(1536);
  });
});

describe('Structural Markdown Chunking', () => {
  it('chunks documents respecting header boundaries and retains headerContext', () => {
    const doc = `# Introduction
AetherMind is a personal knowledge OS.

## Core Concepts
Knowledge graphs represent entities and relations.

## Architecture
Local-first IndexedDB storage.`;

    const chunks = chunkMarkdownStructural(doc, 500);
    expect(chunks.length).toBe(3);
    expect(chunks[0].headerContext).toBe('Introduction');
    expect(chunks[0].content).toContain('Introduction');
    expect(chunks[1].headerContext).toBe('Core Concepts');
    expect(chunks[1].content).toContain('Core Concepts');
    expect(chunks[2].headerContext).toBe('Architecture');
    expect(chunks[2].content).toContain('Architecture');
  });

  it('handles documents without headers by falling back to boundary chunking', () => {
    const rawText = 'Sentence one. Sentence two. Sentence three.';
    const chunks = chunkMarkdownStructural(rawText, 500);

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(rawText);
    expect(chunks[0].headerContext).toBeUndefined();
  });

  it('sub-chunks oversized sections cleanly', () => {
    const longParagraph = 'Word '.repeat(300);
    const doc = `# Section A\n${longParagraph}`;

    const chunks = chunkMarkdownStructural(doc, 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => {
      expect(c.headerContext).toBe('Section A');
      expect(c.content.length).toBeLessThanOrEqual(300);
    });
  });
});
