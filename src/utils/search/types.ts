/**
 * @file types.ts
 * @description Type definitions for AetherMind's unified search and ranking engine.
 */

import type { Note } from '../../db';

/**
 * Search mode options:
 * - 'hybrid': Combines BM25 lexical ranking and dense vector cosine similarity using Reciprocal Rank Fusion (RRF).
 * - 'lexical': Fast keyword BM25 + fuzzy token matching.
 * - 'semantic': Dense vector embeddings only.
 */
export type SearchMode = 'hybrid' | 'lexical' | 'semantic';

/**
 * Multi-criteria search query configuration.
 */
export interface SearchQuery {
  /** Text query string entered by the user. */
  text: string;
  /** Search execution mode (default: 'hybrid'). */
  mode?: SearchMode;
  /** Filter by workspace page ID. */
  pageId?: number;
  /** Filter by category ID (e.g., 'work', 'ideas', 'personal'). */
  category?: string;
  /** Filter by one or more tag strings (AND/OR logic). */
  tags?: string[];
  /** Filter favorites only. */
  isFavorite?: boolean;
  /** Filter archived notes. */
  isArchived?: boolean;
  /** Include trashed notes (default: false). */
  includeTrash?: boolean;
  /** Minimum updated/created timestamp. */
  dateFrom?: number;
  /** Maximum updated/created timestamp. */
  dateTo?: number;
  /** Maximum number of results to return (default: 10). */
  limit?: number;
  /** Weight factor for vector similarity in hybrid mode `[0.0, 1.0]` (default: 0.65). */
  alpha?: number;
}

/**
 * Highlighting span for search query matches in text.
 */
export interface SearchHighlight {
  field: 'title' | 'tag' | 'content';
  snippet: string;
  matchIndices: [number, number][];
}

/**
 * Rich ranked search result item.
 */
export interface SearchResult {
  /** The matched note entity. */
  note: Note;
  /** Final normalized composite score `[0.0, 1.0]`. */
  score: number;
  /** BM25 lexical score component `[0.0, 1.0]`. */
  lexicalScore: number;
  /** Vector semantic score component `[0.0, 1.0]`. */
  vectorScore: number;
  /** Which fields matched the query. */
  matchedFields: ('title' | 'tag' | 'content' | 'semantic')[];
  /** Highlighted text excerpts. */
  highlights: SearchHighlight[];
  /** Whether the match was fuzzy typo-corrected. */
  isFuzzyMatch?: boolean;
}

/**
 * Facet aggregation counts for filter badges.
 */
export interface SearchFacets {
  categoryCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  totalMatching: number;
}
