/**
 * @file cache-engine-ttl.test.ts
 * @description Unit test suite for the cacheEngine TTL behavior added for the
 * polish pass: getWithTtl expiry/eviction semantics, LRU recency interplay,
 * and the ragSearchCache round-trip used to skip repeated RAG retrieval.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { aiResponseCache, ragSearchCache } from '../utils/cacheEngine';

describe('cacheEngine: getWithTtl TTL semantics', () => {
  beforeEach(() => {
    aiResponseCache.clear();
    ragSearchCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves fresh values and uses absolute TTL from insertion', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    aiResponseCache.set('k1', 'v1');

    // Still fresh at t+30s (under the 60s TTL)
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    expect(aiResponseCache.getWithTtl('k1', 60_000)).toBe('v1');

    // A read refreshes LRU recency but NOT the TTL window (absolute expiry):
    // the entry inserted at t0 is gone by t+90s even though it was read at t+30s
    expect(aiResponseCache.get('k1')).toBe('v1');
    vi.setSystemTime(new Date('2026-01-01T00:01:30Z'));
    expect(aiResponseCache.getWithTtl('k1', 60_000)).toBeUndefined();
  });

  it('repeated reads return the same unwrapped value (LRU refresh regression)', () => {
    aiResponseCache.set('k1', 'v1');

    // Recency refresh must re-store the raw value, not the cache-entry wrapper,
    // otherwise the second read returns a nested object instead of 'v1'.
    expect(aiResponseCache.get('k1')).toBe('v1');
    expect(aiResponseCache.get('k1')).toBe('v1');
    expect(aiResponseCache.getWithTtl('k1', 60_000)).toBe('v1');
    expect(aiResponseCache.getWithTtl('k1', 60_000)).toBe('v1');
    expect(aiResponseCache.get('k1')).toBe('v1');
  });

  it('returns undefined and evicts the entry once it is expired', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    aiResponseCache.set('k1', 'v1');

    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    expect(aiResponseCache.getWithTtl('k1', 60_000)).toBeUndefined();
    // Expired entry was eagerly evicted from the backing map
    expect(aiResponseCache.size).toBe(0);
  });

  it('does not evict on a plain get (TTL is opt-in)', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    aiResponseCache.set('k1', 'v1');

    // Plain get still returns the value long after the TTL window
    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'));
    expect(aiResponseCache.get('k1')).toBe('v1');
    expect(aiResponseCache.size).toBe(1);
  });

  it('coexists with LRU capacity eviction (oldest entry dropped first)', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    // Fill the capacity-50 cache, then touch k0 so it becomes most-recently-used
    for (let i = 0; i < 50; i++) aiResponseCache.set(`k${i}`, `v${i}`);
    expect(aiResponseCache.get('k0')).toBe('v0');

    // Adding one more entry evicts the least-recently-used key (k1), not k0
    aiResponseCache.set('overflow', 'x');
    expect(aiResponseCache.get('k1')).toBeUndefined();
    expect(aiResponseCache.get('k0')).toBe('v0');
    expect(aiResponseCache.size).toBe(50);
  });
});

describe('cacheEngine: ragSearchCache round-trip', () => {
  beforeEach(() => {
    ragSearchCache.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves a full RAG entry (context + citations)', () => {
    const entry = {
      context: '[Citation 1: Alpha]: ...content...',
      citations: [
        { index: 1, sourceId: 'n1', sourceName: 'Alpha', chunkIndex: 0, content: '...', score: 0.82, isNote: true, noteId: 1 }
      ]
    };
    ragSearchCache.set('rag:auto:all:what do i know about x', entry);

    const hit = ragSearchCache.getWithTtl('rag:auto:all:what do i know about x', 5 * 60 * 1000);
    expect(hit).toEqual(entry);
    expect(hit?.citations[0].sourceName).toBe('Alpha');
  });

  it('serves a repeated question inside the TTL window and expires it afterwards', () => {
    const entry = { context: 'ctx', citations: [] };
    ragSearchCache.set('rag:vault:notes:my notes on react', entry);

    // Three minutes pass (still within the 5-minute absolute TTL) -> cache hit
    vi.setSystemTime(new Date('2026-01-01T00:03:00Z'));
    expect(ragSearchCache.getWithTtl('rag:vault:notes:my notes on react', 5 * 60 * 1000)).toBe(entry);

    // A hit does not extend the absolute TTL: past 5 minutes the entry is evicted
    vi.setSystemTime(new Date('2026-01-01T00:06:00Z'));
    expect(ragSearchCache.getWithTtl('rag:vault:notes:my notes on react', 5 * 60 * 1000)).toBeUndefined();
    expect(ragSearchCache.size).toBe(0);
  });

  it('keeps distinct queries independent', () => {
    ragSearchCache.set('rag:auto:all:first', { context: 'one', citations: [] });
    ragSearchCache.set('rag:auto:all:second', { context: 'two', citations: [] });

    expect(ragSearchCache.getWithTtl('rag:auto:all:first', 5 * 60 * 1000)?.context).toBe('one');
    expect(ragSearchCache.getWithTtl('rag:auto:all:second', 5 * 60 * 1000)?.context).toBe('two');
  });
});
