/**
 * @file cacheEngine.ts
 * @description Performance Caching Engine for AetherMind.
 * Implements high-speed in-memory caches inspired by Linear and Layers.to architectures:
 * 1. Spatial Memory Cache: Retains node coordinates across selection, edit, and layout events
 *    to eliminate jitter and simulation explosions.
 * 2. AI Response LRU Cache: Caches auto-summaries and generated tags to eliminate redundant LLM calls.
 * 3. Vector Similarity Cache: Accelerates similarity computations for Connection Discovery.
 */

export interface CachedNodePosition {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * 1. Spatial Layout Cache (Graph Memory)
 */
class SpatialLayoutCache {
  private cache = new Map<number, CachedNodePosition>();

  getPosition(noteId: number): CachedNodePosition | undefined {
    return this.cache.get(noteId);
  }

  setPosition(noteId: number, pos: CachedNodePosition): void {
    this.cache.set(noteId, pos);
  }

  has(noteId: number): boolean {
    return this.cache.has(noteId);
  }

  delete(noteId: number): boolean {
    return this.cache.delete(noteId);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export const spatialLayoutCache = new SpatialLayoutCache();

/**
 * 2. AI Response LRU Cache
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class LRUCache<T> {
  private capacity: number;
  private map = new Map<string, CacheEntry<T>>();

  constructor(capacity = 50) {
    this.capacity = capacity;
  }

  get(key: string): T | undefined {
    const item = this.map.get(key);
    if (!item) return undefined;
    // Refresh recency for LRU eviction order. Note: `this.map` is a raw Map, so
    // this re-stores the *entry object* itself (not via LRUCache#set), which
    // preserves the entry's original insert timestamp for absolute-TTL reads.
    this.map.delete(key);
    this.map.set(key, item);
    return item.value;
  }

  /**
   * Retrieves a value only if it is fresh enough (younger than `ttlMs`).
   * TTL is absolute — measured from the original insert — and expired entries
   * are evicted eagerly so they never linger in memory.
   */
  getWithTtl(key: string, ttlMs: number): T | undefined {
    const item = this.map.get(key);
    if (!item) return undefined;
    if (Date.now() - item.timestamp > ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency for LRU eviction order (timestamp is preserved).
    this.map.delete(key);
    this.map.set(key, item);
    return item.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Evict oldest entry (first key in map)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export const aiResponseCache = new LRUCache<string | string[]>(50);

/**
 * RAG Retrieval Cache — stores synthesized retrieval results (context string +
 * citations) keyed by normalized query + scope. Repeated questions skip the
 * expensive embedding + BM25 pass entirely; a 5-minute TTL keeps entries fresh
 * as notes evolve. Structural mirror of {@link RagCitation} from rag.ts so this
 * low-level module stays dependency-free.
 */
export interface RagCacheEntry {
  /** Pre-synthesized retrieval context fed directly into the AI prompt. */
  context: string;
  /** Citations rendered in the UI citation panel. */
  citations: Array<{
    index: number;
    sourceId: string;
    sourceName: string;
    chunkIndex: number;
    content: string;
    score: number;
    isNote: boolean;
    noteId?: number;
  }>;
}

export const ragSearchCache = new LRUCache<RagCacheEntry>(25);

/**
 * Generates a stable DJB2 hash key for note content and prompt type.
 */
export const generateAiCacheKey = (
  noteId: number | undefined,
  title: string,
  content: string,
  type: 'summary' | 'tags'
): string => {
  const raw = `${noteId || 'draft'}:${title}:${content.length}:${content.slice(0, 500)}:${type}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return `ai_${type}_${(hash >>> 0).toString(16)}`;
};

/**
 * 3. Vector Similarity Cache
 */
class VectorSimilarityCache {
  private map = new Map<string, number>();

  private makeKey(idA: number, idB: number): string {
    return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
  }

  get(idA: number, idB: number): number | undefined {
    return this.map.get(this.makeKey(idA, idB));
  }

  set(idA: number, idB: number, similarity: number): void {
    this.map.set(this.makeKey(idA, idB), similarity);
  }

  clear(): void {
    this.map.clear();
  }
}

export const vectorSimilarityCache = new VectorSimilarityCache();
