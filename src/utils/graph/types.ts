/**
 * @file types.ts
 * @description Core types and interfaces for the graph algorithms and topology subsystem in AetherMind.
 */

/**
 * Top-level topology statistics describing the current knowledge graph state.
 */
export interface GraphStats {
  /** Total count of nodes currently in the graph. */
  totalNodes: number;
  /** Total count of link edges currently connecting nodes. */
  totalLinks: number;
  /** Graph density (ratio of actual links to possible links: 2*|E| / (|V|*(|V|-1))). */
  density: number;
  /** Number of isolated nodes with zero connected edges. */
  isolatedNodesCount: number;
  /** Average number of connections per node. */
  averageDegree: number;
  /** Ranked list of top hub nodes by total degree connectivity. */
  topHubs: Array<{
    noteId: number;
    title: string;
    degree: number;
    inDegree: number;
    outDegree: number;
    category?: string;
  }>;
}

/**
 * Result returned by the shortest path algorithm.
 */
export interface GraphPathResult {
  /** Whether a connected path exists between source and target. */
  found: boolean;
  /** Ordered array of node IDs from source to target. */
  pathNodeIds: number[];
  /** Ordered array of note titles along the path. */
  pathTitles: string[];
  /** Total number of hops (edges traversed). */
  distance: number;
}

/**
 * Configuration options for Neighborhood Focus Mode.
 */
export interface FocusModeConfig {
  /** Whether focus mode is currently active. */
  enabled: boolean;
  /** Primary note ID serving as the center of focus. */
  centerNoteId: number | null;
  /** Traversal radius: 1 for direct neighbors, 2 for 2-hop neighborhood. */
  depth: 1 | 2;
}

/**
 * Category cluster boundary polygon for visual cluster hull rendering.
 */
export interface ClusterHull {
  category: string;
  color: string;
  label: string;
  nodeCount: number;
  points: Array<[number, number]>;
}
