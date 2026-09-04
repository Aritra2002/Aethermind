/**
 * @file vectorSearch.ts
 * @description Local vector embedding, semantic search, and graph clustering engine for AetherMind.
 * Employs a multi-model embedding architecture supporting local WASM/ONNX transformers,
 * TF-IDF feature hashing, OpenAI embeddings, and Google Gemini embeddings.
 * Includes dimension-safe cosine similarity scoring, batch re-indexing, semantic search across notes,
 * and automated AI semantic clustering for disconnected graph nodes.
 */

import { db, type Note } from '../db';
import {
  generateEmbeddingWithModel,
  setLocalFallbackForTesting as setEmbeddingsFallback,
  clearEmbeddingCache as clearCache,
  getEmbeddingCacheSize as getCacheSize,
  type EmbeddingConfig
} from './embeddings';

export * from './embeddings';

/**
 * Sets the fallback flag (used in unit test environments to guarantee instant, offline execution).
 */
export const setUseFallbackForTesting = (flag: boolean) => {
  setEmbeddingsFallback(flag);
};

export const clearEmbeddingCache = clearCache;
export const getEmbeddingCacheSize = getCacheSize;

/**
 * Generates a high-dimensional dense vector embedding for a given text string
 * using the active or specified embedding model adapter.
 */
export const generateEmbedding = async (text: string, config?: EmbeddingConfig): Promise<number[]> => {
  const result = await generateEmbeddingWithModel(text, config);
  return result.embedding;
};

/**
 * Computes the cosine similarity metric between two numeric vectors.
 * Strictly verifies identical dimensionality to prevent cross-model vector corruption.
 *
 * @param a - First numerical vector array.
 * @param b - Second numerical vector array.
 * @returns Similarity score in the range `[-1.0, 1.0]`, or `0` if empty or dimensions mismatch.
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Identifies notes in the database that lack vector embeddings or require re-indexing.
 *
 * @returns A promise resolving to an array of notes needing embedding.
 */
export const detectStaleNotes = async (): Promise<Note[]> => {
  const notes = await db.notes.toArray();
  return notes.filter(n => Number(n.isTrash) !== 1 && (!n.embedding || n.embedding.length === 0));
};

/**
 * Throttled background indexing queue that processes un-embedded notes incrementally
 * using micro-delays between items to prevent UI jank.
 *
 * @param onProgress - Optional callback reporting indexing progress
 * @param batchSize - Number of items before yielding thread (default: 5)
 * @returns A promise resolving to the number of indexed notes
 */
export const indexNotesBackground = async (
  onProgress?: (progress: { current: number; total: number; noteTitle: string }) => void,
  batchSize: number = 5
): Promise<number> => {
  const staleNotes = await detectStaleNotes();
  const total = staleNotes.length;
  if (total === 0) return 0;

  let processed = 0;

  for (let i = 0; i < total; i++) {
    const note = staleNotes[i];
    if (!note.id) continue;

    if (onProgress) {
      onProgress({ current: i + 1, total, noteTitle: note.title });
    }

    try {
      const text = `${note.title}\n\n${note.content || ''}`;
      const embedding = await generateEmbedding(text);
      await db.notes.update(note.id, { embedding });
      processed++;
    } catch (e) {
      console.warn(`Failed background embedding for note "${note.title}":`, e);
    }

    // Yield control back to browser event loop every batchSize items
    if ((i + 1) % batchSize === 0) {
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  return processed;
};

/**
 * Scans all notes in the database and computes vector embeddings for any notes lacking an embedding.
 *
 * @param onProgress - Optional callback reporting indexing status and current note title.
 * @returns A promise that resolves when all notes have embeddings persisted to IndexedDB.
 */
export const reindexNotes = async (onProgress?: (msg: string) => void) => {
  const stale = await detectStaleNotes();
  for (let i = 0; i < stale.length; i++) {
    const note = stale[i];
    if (onProgress) onProgress(`Indexing ${i + 1}/${stale.length}: ${note.title}`);
    const text = `${note.title}\n\n${note.content || ''}`;
    const embedding = await generateEmbedding(text);
    await db.notes.update(note.id!, { embedding });
  }
  if (onProgress) onProgress('Indexing complete!');
};

/**
 * Computes BM25 keyword relevance score between a query and document text.
 *
 * @param queryTokens - Tokenized search query
 * @param docText - Document content to score
 * @param avgDocLength - Average document character/word length across corpus
 * @returns Normalized BM25 score between 0.0 and 1.0
 */
export const calculateBM25Score = (
  queryTokens: string[],
  docText: string,
  avgDocLength: number = 200
): number => {
  if (!queryTokens.length || !docText) return 0;
  const docTokens = docText.toLowerCase().match(/\b\w+\b/g) || [];
  const docLen = docTokens.length || 1;
  if (docLen === 0) return 0;

  const k1 = 1.2;
  const b = 0.75;
  const lenNorm = 1 - b + b * (docLen / (avgDocLength || 1));

  // Count term frequencies
  const tfMap: Record<string, number> = {};
  for (const t of docTokens) tfMap[t] = (tfMap[t] || 0) + 1;

  let rawScore = 0;
  for (const q of queryTokens) {
    const tf = tfMap[q] || 0;
    if (tf > 0) {
      const termScore = (tf * (k1 + 1)) / (tf + k1 * lenNorm);
      rawScore += termScore;
    }
  }

  // Normalize roughly between 0.0 and 1.0
  return Math.min(1.0, rawScore / Math.max(1, queryTokens.length * 1.5));
};

/**
 * Performs hybrid search combining keyword BM25 scoring and dense vector cosine similarity.
 *
 * @param query - User search query
 * @param pageId - Optional filter by workspace page ID
 * @param limit - Maximum results to return
 * @param alpha - Weight between vector similarity (alpha = 1.0) and keyword BM25 (alpha = 0.0). Default: 0.65.
 * @returns Ranked notes with hybrid score breakdown
 */
export const hybridSearchNotes = async (
  query: string,
  pageId?: number,
  limit: number = 8,
  alpha: number = 0.65
): Promise<Array<Note & { score: number; vectorScore: number; keywordScore: number }>> => {
  const queryTrimmed = query.trim();
  if (!queryTrimmed) return [];

  let notes = await db.notes.toArray();
  if (pageId !== undefined) {
    notes = notes.filter(n => n.pageId === pageId);
  }
  // Filter out trashed notes by default
  notes = notes.filter(n => Number(n.isTrash) !== 1);

  if (notes.length === 0) return [];

  const queryTokens = queryTrimmed.toLowerCase().match(/\b\w+\b/g) || [];
  const queryEmbedding = await generateEmbedding(queryTrimmed);
  const avgDocLength = notes.reduce((acc, n) => acc + (n.content?.length || 0), 0) / notes.length;

  const scoredNotes = notes.map(note => {
    // Vector similarity score
    const vectorScore = note.embedding
      ? Math.max(0, cosineSimilarity(queryEmbedding, note.embedding))
      : 0;

    // Keyword BM25 score
    const textToMatch = `${note.title} ${note.tags?.join(' ') || ''} ${note.content}`;
    const keywordScore = calculateBM25Score(queryTokens, textToMatch, avgDocLength);

    // Exact title match boost
    let titleBoost = 0;
    if (note.title.toLowerCase() === queryTrimmed.toLowerCase()) {
      titleBoost = 0.3;
    } else if (note.title.toLowerCase().includes(queryTrimmed.toLowerCase())) {
      titleBoost = 0.15;
    }

    const hybridScore = Math.min(1.0, alpha * vectorScore + (1 - alpha) * keywordScore + titleBoost);

    return {
      ...note,
      score: hybridScore,
      vectorScore,
      keywordScore
    };
  });

  return scoredNotes
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Performs semantic similarity search across all notes in the database.
 * Computes the embedding for the search query and ranks notes by cosine similarity.
 *
 * @param query - The natural language query to match against notes.
 * @param limit - Maximum number of top matching notes to return (default: 5).
 * @returns A promise resolving to an array of matching {@link Note} records augmented with `score: number`.
 */
export const semanticSearch = async (query: string, limit: number = 5): Promise<Array<Note & { score: number }>> => {
  const queryEmbedding = await generateEmbedding(query);
  const notes = await db.notes.toArray();

  const results = notes
    .filter(n => n.embedding && Number(n.isTrash) !== 1)
    .map(n => ({
      ...n,
      score: cosineSimilarity(queryEmbedding, n.embedding!)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
};

/**
 * Automatically discovers semantic relationships and creates graph links between unlinked notes.
 */
export const clusterUnlinkedNotes = async (onProgress?: (msg: string) => void) => {
  // First ensure all notes have embeddings
  await reindexNotes(onProgress);

  const notes = await db.notes.toArray();
  const links = await db.links.toArray();
  const linkedIds = new Set(links.flatMap(l => [l.sourceId, l.targetId]));

  const unlinkedNotes = notes.filter(n => !linkedIds.has(n.id!));

  if (onProgress) onProgress(`Clustering ${unlinkedNotes.length} unlinked notes...`);

  let newLinks = 0;
  for (const source of unlinkedNotes) {
    if (!source.embedding) continue;

    let bestMatch: Note | null = null;
    let bestScore = -1;

    for (const target of notes) {
      if (source.id === target.id || !target.embedding) continue;

      const score = cosineSimilarity(source.embedding, target.embedding);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = target;
      }
    }

    if (bestMatch && source.id && bestMatch.id) {
      const linkExists = await db.links.where({ sourceId: source.id, targetId: bestMatch.id }).first() ||
                         await db.links.where({ sourceId: bestMatch.id, targetId: source.id }).first();

      if (!linkExists) {
        await db.links.add({ sourceId: source.id, targetId: bestMatch.id });
        newLinks++;
      }
    }
  }

  if (onProgress) onProgress(`Clustering complete! Found ${newLinks} new semantic links.`);
};
