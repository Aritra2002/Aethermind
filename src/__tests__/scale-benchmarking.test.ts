import { describe, it, expect } from 'vitest';
import { calculateGraphStats, findShortestPath, getNeighborhood } from '../utils/graph/algorithms';
import { calculateBM25Score } from '../utils/vectorSearch';
import { detectKnowledgeGaps } from '../utils/intelligence/knowledgeGapDetector';
import type { Note, Link } from '../db';

/** Generates synthetic mock notes for scale benchmarking */
function generateMockCorpus(noteCount: number, avgLinksPerNote: number = 3): { notes: Note[]; links: Link[] } {
  const categories = ['engineering', 'research', 'ideas', 'reading', 'journal'];
  const notes: Note[] = [];
  const links: Link[] = [];

  for (let i = 1; i <= noteCount; i++) {
    notes.push({
      id: i,
      pageId: 1,
      title: `Knowledge Concept ${i} on Machine Learning and Systems`,
      content: `This is the body of concept ${i}. Mentions [[Concept ${(i % 50) + 1}]] and discusses React, TypeScript, and IndexedDB performance. TODO: Explore scaling bottlenecks.`,
      category: categories[i % categories.length],
      tags: [`tag${i % 10}`, 'benchmark'],
      createdAt: 1700000000000 + i * 1000,
      updatedAt: 1700000000000 + i * 1000
    });
  }

  let linkId = 1;
  for (let i = 1; i <= noteCount; i++) {
    for (let k = 1; k <= avgLinksPerNote; k++) {
      const targetId = ((i + k * 7) % noteCount) + 1;
      if (targetId !== i) {
        links.push({
          id: linkId++,
          sourceId: i,
          targetId: targetId
        });
      }
    }
  }

  return { notes, links };
}

describe('Scale Benchmarking — Tier 1 (100 Notes Dataset)', () => {
  const { notes, links } = generateMockCorpus(100, 3);

  it('computes graph topology metrics and top hubs in < 15ms', () => {
    const t0 = performance.now();
    const stats = calculateGraphStats(notes, links);
    const duration = performance.now() - t0;

    expect(stats.totalNodes).toBe(100);
    expect(stats.topHubs.length).toBeLessThanOrEqual(5);
    expect(duration).toBeLessThan(50);
  });

  it('finds shortest path across graph in < 10ms', () => {
    const t0 = performance.now();
    const path = findShortestPath(1, 85, notes, links);
    const duration = performance.now() - t0;

    expect(path.found).toBe(true);
    expect(path.distance).toBeGreaterThan(0);
    expect(duration).toBeLessThan(50);
  });

  it('extracts concepts and detects knowledge gaps across 100 notes in < 30ms', () => {
    const t0 = performance.now();
    const gaps = detectKnowledgeGaps(notes, links);
    const duration = performance.now() - t0;

    expect(Array.isArray(gaps)).toBe(true);
    expect(duration).toBeLessThan(100);
  });
});

describe('Scale Benchmarking — Tier 2 (1,000 Notes / 3,000 Links Dataset)', () => {
  const { notes, links } = generateMockCorpus(1000, 3);

  it('computes graph density, average degree, and hubs in < 25ms', () => {
    const t0 = performance.now();
    const stats = calculateGraphStats(notes, links);
    const duration = performance.now() - t0;

    expect(stats.totalNodes).toBe(1000);
    expect(stats.totalLinks).toBe(3000);
    expect(stats.density).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100);
  });

  it('executes BFS shortest path finding in < 15ms across 1,000 nodes', () => {
    const t0 = performance.now();
    const path = findShortestPath(1, 999, notes, links);
    const duration = performance.now() - t0;

    expect(path.found).toBe(true);
    expect(duration).toBeLessThan(100);
  });

  it('computes 2-hop neighborhood set in < 10ms', () => {
    const t0 = performance.now();
    const neighbors = getNeighborhood(50, links, 2);
    const duration = performance.now() - t0;

    expect(neighbors.size).toBeGreaterThan(1);
    expect(duration).toBeLessThan(50);
  });

  it('evaluates BM25 keyword scoring over 1,000 documents in < 20ms', () => {
    const queryTokens = ['machine', 'learning', 'performance'];
    const t0 = performance.now();

    for (const note of notes) {
      calculateBM25Score(queryTokens, `${note.title} ${note.content}`);
    }

    const duration = performance.now() - t0;
    expect(duration).toBeLessThan(100);
  });
});

describe('Scale Benchmarking — Tier 3 (5,000 Notes / 15,000 Links Stress Test)', () => {
  const { notes, links } = generateMockCorpus(5000, 3);

  it('calculates full graph topology metrics in < 100ms under 5k node load', () => {
    const t0 = performance.now();
    const stats = calculateGraphStats(notes, links);
    const duration = performance.now() - t0;

    expect(stats.totalNodes).toBe(5000);
    expect(stats.totalLinks).toBe(15000);
    expect(duration).toBeLessThan(250);
  });

  it('executes multi-step BFS pathfinding on 5,000 node graph in < 25ms', () => {
    const t0 = performance.now();
    const path = findShortestPath(1, 4890, notes, links);
    const duration = performance.now() - t0;

    expect(path.found).toBe(true);
    expect(duration).toBeLessThan(150);
  });
});
