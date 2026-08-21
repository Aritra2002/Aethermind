/**
 * @file algorithms.ts
 * @description High-performance graph algorithms including topology metrics, shortest path finding,
 * neighborhood extraction, and community clustering for the AetherMind knowledge graph.
 */

import type { Note, Link } from '../../db';
import type { GraphStats, GraphPathResult } from './types';

/**
 * Computes topological statistics and hub rankings for the current graph state.
 *
 * @param notes - Array of all active notes (vertices).
 * @param links - Array of active link connections (edges).
 * @returns {@link GraphStats} object containing density, isolated count, and top hubs.
 */
export function calculateGraphStats(notes: Note[], links: Link[]): GraphStats {
  const totalNodes = notes.length;
  const totalLinks = links.length;

  if (totalNodes === 0) {
    return {
      totalNodes: 0,
      totalLinks: 0,
      density: 0,
      isolatedNodesCount: 0,
      averageDegree: 0,
      topHubs: []
    };
  }

  // Build degree maps
  const inDegreeMap = new Map<number, number>();
  const outDegreeMap = new Map<number, number>();
  const noteMap = new Map<number, Note>();

  notes.forEach(note => {
    if (note.id !== undefined) {
      noteMap.set(note.id, note);
      inDegreeMap.set(note.id, 0);
      outDegreeMap.set(note.id, 0);
    }
  });

  links.forEach(link => {
    const sId = typeof link.sourceId === 'number' ? link.sourceId : (link.sourceId as { id?: number })?.id;
    const tId = typeof link.targetId === 'number' ? link.targetId : (link.targetId as { id?: number })?.id;

    if (sId !== undefined && outDegreeMap.has(sId)) {
      outDegreeMap.set(sId, (outDegreeMap.get(sId) || 0) + 1);
    }
    if (tId !== undefined && inDegreeMap.has(tId)) {
      inDegreeMap.set(tId, (inDegreeMap.get(tId) || 0) + 1);
    }
  });

  let isolatedNodesCount = 0;
  const hubList: Array<{
    noteId: number;
    title: string;
    degree: number;
    inDegree: number;
    outDegree: number;
    category?: string;
  }> = [];

  notes.forEach(note => {
    if (note.id !== undefined) {
      const inDeg = inDegreeMap.get(note.id) || 0;
      const outDeg = outDegreeMap.get(note.id) || 0;
      const totalDeg = inDeg + outDeg;

      if (totalDeg === 0) {
        isolatedNodesCount++;
      }

      hubList.push({
        noteId: note.id,
        title: note.title,
        degree: totalDeg,
        inDegree: inDeg,
        outDegree: outDeg,
        category: note.category
      });
    }
  });

  // Sort hubs by total degree descending
  hubList.sort((a, b) => b.degree - a.degree);

  // Graph density formula for undirected/bi-directional graphs: 2*|E| / (|V|*(|V|-1))
  const maxPossibleEdges = totalNodes > 1 ? (totalNodes * (totalNodes - 1)) / 2 : 0;
  const density = maxPossibleEdges > 0 ? Math.min(1, totalLinks / maxPossibleEdges) : 0;
  const averageDegree = totalNodes > 0 ? (2 * totalLinks) / totalNodes : 0;

  return {
    totalNodes,
    totalLinks,
    density: parseFloat(density.toFixed(4)),
    isolatedNodesCount,
    averageDegree: parseFloat(averageDegree.toFixed(2)),
    topHubs: hubList.slice(0, 5)
  };
}

/**
 * Finds the shortest path between two nodes using Breadth-First Search (BFS).
 *
 * @param sourceId - Starting note primary key ID.
 * @param targetId - Destination note primary key ID.
 * @param notes - All graph notes.
 * @param links - All graph link connections.
 * @returns {@link GraphPathResult} with path steps and distance.
 */
export function findShortestPath(
  sourceId: number,
  targetId: number,
  notes: Note[],
  links: Link[]
): GraphPathResult {
  if (sourceId === targetId) {
    const note = notes.find(n => n.id === sourceId);
    return {
      found: true,
      pathNodeIds: [sourceId],
      pathTitles: note ? [note.title] : [`#${sourceId}`],
      distance: 0
    };
  }

  // Build undirected adjacency list
  const adj = new Map<number, Set<number>>();
  const titleMap = new Map<number, string>();

  notes.forEach(n => {
    if (n.id !== undefined) {
      adj.set(n.id, new Set<number>());
      titleMap.set(n.id, n.title);
    }
  });

  links.forEach(l => {
    const sId = typeof l.sourceId === 'number' ? l.sourceId : (l.sourceId as { id?: number })?.id;
    const tId = typeof l.targetId === 'number' ? l.targetId : (l.targetId as { id?: number })?.id;

    if (sId !== undefined && tId !== undefined && adj.has(sId) && adj.has(tId)) {
      adj.get(sId)?.add(tId);
      adj.get(tId)?.add(sId);
    }
  });

  if (!adj.has(sourceId) || !adj.has(targetId)) {
    return { found: false, pathNodeIds: [], pathTitles: [], distance: -1 };
  }

  // BFS queue: [currentNodeId, pathArray]
  const queue: Array<[number, number[]]> = [[sourceId, [sourceId]]];
  const visited = new Set<number>([sourceId]);

  while (queue.length > 0) {
    const [current, path] = queue.shift()!;

    if (current === targetId) {
      return {
        found: true,
        pathNodeIds: path,
        pathTitles: path.map(id => titleMap.get(id) || `#${id}`),
        distance: path.length - 1
      };
    }

    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([neighbor, [...path, neighbor]]);
        }
      }
    }
  }

  return { found: false, pathNodeIds: [], pathTitles: [], distance: -1 };
}

/**
 * Computes the set of all node IDs within a given hop radius (1-hop or 2-hop) from an active note.
 *
 * @param activeNoteId - Center note ID.
 * @param links - Graph links.
 * @param depth - Number of hops (1 or 2).
 * @returns Set of reachable node IDs including the center note.
 */
export function getNeighborhood(
  activeNoteId: number,
  links: Link[],
  depth: 1 | 2 = 1
): Set<number> {
  const neighborhood = new Set<number>([activeNoteId]);
  if (!activeNoteId) return neighborhood;

  // Build adjacency list
  const adj = new Map<number, Set<number>>();
  links.forEach(l => {
    const sId = typeof l.sourceId === 'number' ? l.sourceId : (l.sourceId as { id?: number })?.id;
    const tId = typeof l.targetId === 'number' ? l.targetId : (l.targetId as { id?: number })?.id;

    if (sId !== undefined && tId !== undefined) {
      if (!adj.has(sId)) adj.set(sId, new Set());
      if (!adj.has(tId)) adj.set(tId, new Set());
      adj.get(sId)?.add(tId);
      adj.get(tId)?.add(sId);
    }
  });

  // 1-hop direct neighbors
  const directNeighbors = adj.get(activeNoteId);
  if (directNeighbors) {
    for (const n of directNeighbors) {
      neighborhood.add(n);
    }
  }

  // 2-hop neighbors if depth === 2
  if (depth === 2 && directNeighbors) {
    for (const direct of directNeighbors) {
      const secondHop = adj.get(direct);
      if (secondHop) {
        for (const n2 of secondHop) {
          neighborhood.add(n2);
        }
      }
    }
  }

  return neighborhood;
}
