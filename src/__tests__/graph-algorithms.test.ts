/**
 * @file graph-algorithms.test.ts
 * @description Comprehensive unit test suite for Phase 6: Knowledge Graph Algorithms Subsystem.
 * Tests graph topology statistics, shortest path BFS algorithm, and 1-hop / 2-hop neighborhood extraction.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGraphStats,
  findShortestPath,
  getNeighborhood
} from '../utils/graph/algorithms';
import type { Note, Link } from '../db';

describe('Phase 6: Graph Topology Statistics', () => {
  it('handles empty notes gracefully', () => {
    const stats = calculateGraphStats([], []);
    expect(stats.totalNodes).toBe(0);
    expect(stats.totalLinks).toBe(0);
    expect(stats.density).toBe(0);
    expect(stats.isolatedNodesCount).toBe(0);
    expect(stats.topHubs).toEqual([]);
  });

  it('calculates density, average degree, and hub rankings accurately', () => {
    const notes: Note[] = [
      { id: 1, title: 'Central Hub', content: '', pageId: 1, category: 'tech' },
      { id: 2, title: 'Leaf A', content: '', pageId: 1, category: 'tech' },
      { id: 3, title: 'Leaf B', content: '', pageId: 1, category: 'design' },
      { id: 4, title: 'Leaf C', content: '', pageId: 1, category: 'general' },
      { id: 5, title: 'Isolated Node', content: '', pageId: 1, category: 'general' }
    ];

    const links: Link[] = [
      { id: 10, sourceId: 1, targetId: 2 },
      { id: 11, sourceId: 1, targetId: 3 },
      { id: 12, sourceId: 1, targetId: 4 },
      { id: 13, sourceId: 2, targetId: 3 }
    ];

    const stats = calculateGraphStats(notes, links);

    expect(stats.totalNodes).toBe(5);
    expect(stats.totalLinks).toBe(4);
    expect(stats.isolatedNodesCount).toBe(1); // Node 5 has 0 links
    expect(stats.topHubs.length).toBe(5);
    expect(stats.topHubs[0].noteId).toBe(1);
    expect(stats.topHubs[0].title).toBe('Central Hub');
    expect(stats.topHubs[0].degree).toBe(3); // Connected to 2, 3, 4
    expect(stats.averageDegree).toBe(1.6); // (2 * 4) / 5 = 1.6
  });
});

describe('Phase 6: Shortest Path Finder (BFS)', () => {
  const sampleNotes: Note[] = [
    { id: 1, title: 'Node 1', content: '', pageId: 1 },
    { id: 2, title: 'Node 2', content: '', pageId: 1 },
    { id: 3, title: 'Node 3', content: '', pageId: 1 },
    { id: 4, title: 'Node 4', content: '', pageId: 1 },
    { id: 5, title: 'Disconnected Node', content: '', pageId: 1 }
  ];

  const sampleLinks: Link[] = [
    { id: 101, sourceId: 1, targetId: 2 },
    { id: 102, sourceId: 2, targetId: 3 },
    { id: 103, sourceId: 3, targetId: 4 }
  ];

  it('returns distance 0 when source and target are the same', () => {
    const result = findShortestPath(1, 1, sampleNotes, sampleLinks);
    expect(result.found).toBe(true);
    expect(result.distance).toBe(0);
    expect(result.pathNodeIds).toEqual([1]);
    expect(result.pathTitles).toEqual(['Node 1']);
  });

  it('finds optimal multi-hop path across connected graph', () => {
    const result = findShortestPath(1, 4, sampleNotes, sampleLinks);
    expect(result.found).toBe(true);
    expect(result.distance).toBe(3);
    expect(result.pathNodeIds).toEqual([1, 2, 3, 4]);
    expect(result.pathTitles).toEqual(['Node 1', 'Node 2', 'Node 3', 'Node 4']);
  });

  it('returns found: false when no connected path exists', () => {
    const result = findShortestPath(1, 5, sampleNotes, sampleLinks);
    expect(result.found).toBe(false);
    expect(result.distance).toBe(-1);
    expect(result.pathNodeIds).toEqual([]);
  });
});

describe('Phase 6: Neighborhood Extraction (Focus Mode)', () => {
  const links: Link[] = [
    { id: 1, sourceId: 10, targetId: 20 },
    { id: 2, sourceId: 10, targetId: 30 },
    { id: 3, sourceId: 20, targetId: 40 },
    { id: 4, sourceId: 40, targetId: 50 }
  ];

  it('extracts 1-hop direct neighbors around active note', () => {
    const hood1 = getNeighborhood(10, links, 1);
    expect(hood1.has(10)).toBe(true); // Center
    expect(hood1.has(20)).toBe(true); // Direct
    expect(hood1.has(30)).toBe(true); // Direct
    expect(hood1.has(40)).toBe(false); // 2-hop away
    expect(hood1.size).toBe(3);
  });

  it('extracts 2-hop radius around active note', () => {
    const hood2 = getNeighborhood(10, links, 2);
    expect(hood2.has(10)).toBe(true);
    expect(hood2.has(20)).toBe(true);
    expect(hood2.has(30)).toBe(true);
    expect(hood2.has(40)).toBe(true); // Reached via 20
    expect(hood2.has(50)).toBe(false); // 3-hop away
    expect(hood2.size).toBe(4);
  });

  it('returns only the node itself for isolated node', () => {
    const hood = getNeighborhood(999, links, 1);
    expect(hood.size).toBe(1);
    expect(hood.has(999)).toBe(true);
  });
});
