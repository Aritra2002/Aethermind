/**
 * @file vectorSearch.ts
 * @description Local vector embedding, semantic search, and graph clustering engine for AetherMind.
 * Employs a hybrid embedding architecture:
 * 1. Primary: `@xenova/transformers` running the `Xenova/all-MiniLM-L6-v2` transformer model via WebAssembly (384-dim dense vectors).
 * 2. Fallback: Pure JavaScript term-frequency / inverse-document-frequency (TF-IDF) feature hashing (384-dim normalized sparse vectors).
 * Includes vector cosine similarity scoring, batch note re-indexing, semantic search across notes,
 * and automated AI semantic clustering for disconnected graph nodes.
 */

import { db, type Note } from '../db';

/** Pipeline interface representing the HuggingFace Xenova feature extraction pipeline. */
type FeatureExtractionPipeline = (text: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array | number[] }>;

/** Cached instance of the loaded Hugging Face feature extraction pipeline. */
let embedder: FeatureExtractionPipeline | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transformersModule: any = null;
/** Global flag tracking whether the transformer pipeline failed and fallback TF-IDF should be used permanently. */
let useFallback = false;

/**
 * Sets the fallback flag (used in unit test environments to guarantee instant, offline execution).
 */
export const setUseFallbackForTesting = (flag: boolean) => {
  useFallback = flag;
};

/** Standard vector dimensionality (384 dimensions matches all-MiniLM-L6-v2). */
const FALLBACK_DIM = 384;

// --- Fallback TF-IDF Embedding (pure JS, no WASM needed) ---

/**
 * Splits text into lowercase alphanumeric word tokens.
 *
 * @param text - Source string to tokenize.
 * @returns Array of word tokens.
 */
const tokenize = (text: string): string[] => text.toLowerCase().match(/\b\w+\b/g) || [];

/**
 * Deterministically hashes a token string to a fixed vector bucket index `[0, FALLBACK_DIM - 1]`.
 *
 * @param token - String token to hash.
 * @returns Bucket index in the range `[0, FALLBACK_DIM - 1]`.
 */
const hashToken = (token: string): number => {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % FALLBACK_DIM;
};

/**
 * Generates a normalized 384-dimensional feature-hashed TF-IDF vector embedding from an array of tokens.
 *
 * @param tokens - Array of string tokens.
 * @returns L2-normalized 384-element numeric array.
 */
const tfidfEmbed = (tokens: string[]): number[] => {
  // Compute term frequencies (TF)
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const total = tokens.length || 1;

  // Distribute weights across hashed dimensions with sub-linear frequency dampening
  const vec = new Array(FALLBACK_DIM).fill(0);
  for (const [token, count] of Object.entries(tf)) {
    const weight = (count / total) * (1 + Math.log(1 + count));
    vec[hashToken(token)] += weight;
  }

  // Normalize to unit length (L2 norm)
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
};

// --- Transformer Embedding (requires WASM) ---

/**
 * Lazily imports `@xenova/transformers` and initializes the `Xenova/all-MiniLM-L6-v2` feature extraction pipeline.
 *
 * @returns A promise resolving to the initialized pipeline, or `null` if WASM loading fails.
 */
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

/**
 * Initializes and retrieves the singleton feature extraction embedder pipeline.
 *
 * @returns A promise resolving to the active embedder pipeline or `null` if in fallback mode.
 */
export const initEmbedder = async () => {
  if (useFallback) return null;
  if (!embedder) {
    embedder = await initTransformer();
  }
  return embedder;
};

/** Maximum capacity of the in-memory LRU embedding cache */
const MAX_EMBEDDING_CACHE_SIZE = 500;

/** In-memory LRU cache storing text -> vector embedding arrays */
const EMBEDDING_CACHE = new Map<string, number[]>();

/**
 * Clears the in-memory embedding cache (useful for testing or manual cache purge).
 */
export const clearEmbeddingCache = () => {
  EMBEDDING_CACHE.clear();
};

/**
 * Retrieves the current number of cached embeddings in memory.
 */
export const getEmbeddingCacheSize = (): number => EMBEDDING_CACHE.size;

/**
 * Generates a high-dimensional dense vector embedding for a given text string.
 * Automatically tries the local ONNX/WASM transformer pipeline first; if unavailable
 * or if a runtime exception occurs, transparently falls back to deterministic TF-IDF feature hashing.
 *
 * Utilizes an in-memory LRU cache to deliver instant (0ms) responses for repeated queries or note texts.
 *
 * @param text - The text content to embed.
 * @returns A promise resolving to a 384-element normalized vector array of numbers.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return new Array(FALLBACK_DIM).fill(0);
  }

  // Check LRU cache hit
  if (EMBEDDING_CACHE.has(normalizedText)) {
    const cached = EMBEDDING_CACHE.get(normalizedText)!;
    // Refresh LRU access order
    EMBEDDING_CACHE.delete(normalizedText);
    EMBEDDING_CACHE.set(normalizedText, cached);
    return cached;
  }

  let vector: number[];

  // Use TF-IDF fallback immediately if already flagged
  if (useFallback) {
    vector = tfidfEmbed(tokenize(normalizedText));
  } else {
    const e = await initEmbedder();
    if (!e) {
      vector = tfidfEmbed(tokenize(normalizedText));
    } else {
      try {
        const output = await e(normalizedText, { pooling: 'mean', normalize: true });
        vector = Array.from(output.data);
      } catch {
        // Transformer failed at runtime, switch to fallback permanently
        useFallback = true;
        console.warn('Transformer failed at runtime, switching to TF-IDF fallback');
        vector = tfidfEmbed(tokenize(normalizedText));
      }
    }
  }

  // Enforce LRU cache capacity
  if (EMBEDDING_CACHE.size >= MAX_EMBEDDING_CACHE_SIZE) {
    const oldestKey = EMBEDDING_CACHE.keys().next().value;
    if (oldestKey !== undefined) {
      EMBEDDING_CACHE.delete(oldestKey);
    }
  }
  EMBEDDING_CACHE.set(normalizedText, vector);

  return vector;
};

/**
 * Computes the cosine similarity metric between two normalized or arbitrary-magnitude numeric vectors.
 *
 * @param a - First numerical vector array.
 * @param b - Second numerical vector array.
 *
 * @returns Similarity score in the range `[-1.0, 1.0]`, where 1.0 represents identical orientation.
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
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
 *
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
  const docTokens = tokenize(docText);
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

  const queryTokens = tokenize(queryTrimmed);
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
 *
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
 *
 * Algorithm:
 * 1. Ensures all notes are indexed with embeddings.
 * 2. Identifies "orphan" nodes (nodes with 0 incoming or outgoing links).
 * 3. Compares each unlinked note's embedding against all other notes.
 * 4. Creates a new bidirectional connection link if cosine similarity exceeds 0.6 threshold.
 *
 * @param onProgress - Optional callback reporting clustering status and results.
 *
 * @returns A promise that resolves when clustering completes.
 */
export const clusterUnlinkedNotes = async (onProgress?: (msg: string) => void) => {
  // First ensure all notes have embeddings
  await reindexNotes(onProgress);

  const notes = await db.notes.toArray();
  // Find nodes with no links (we consider links where source or target is this node)
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
      if (score > bestScore && score > 0.6) { // 0.6 threshold for similarity
        bestScore = score;
        bestMatch = target;
      }
    }

    if (bestMatch && source.id && bestMatch.id) {
      // Create a link if one does not already exist
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

