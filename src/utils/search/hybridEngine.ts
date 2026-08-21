/**
 * @file hybridEngine.ts
 * @description Unified hybrid search engine combining multi-field BM25 lexical ranking,
 * dense vector cosine similarity, and metadata facet filtering with Reciprocal Rank Fusion (RRF).
 */

import { db, type Note } from '../../db';
import type { SearchQuery, SearchResult, SearchFacets, SearchHighlight } from './types';
import { scoreBM25Note, tokenizeText, extractSearchSnippet } from './bm25';
import { generateEmbedding, cosineSimilarity } from '../vectorSearch';

/**
 * Calculates facet distribution counts across a list of notes.
 */
export const calculateSearchFacets = (notes: Note[]): SearchFacets => {
  const categoryCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  for (const note of notes) {
    if (note.category) {
      categoryCounts[note.category] = (categoryCounts[note.category] || 0) + 1;
    }
    if (note.tags && Array.isArray(note.tags)) {
      for (const tag of note.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  return {
    categoryCounts,
    tagCounts,
    totalMatching: notes.length
  };
};

/**
 * Filters notes based on metadata attributes before or during ranking.
 */
export const filterNotesByMetadata = (notes: Note[], query: SearchQuery): Note[] => {
  return notes.filter(note => {
    // 1. Trash status (exclude trash unless explicitly included)
    if (!query.includeTrash && Number(note.isTrash) === 1) return false;

    // 2. Page / Workspace filter
    if (query.pageId !== undefined && note.pageId !== query.pageId) return false;

    // 3. Category filter
    if (query.category && note.category !== query.category) return false;

    // 4. Tags filter (must match at least one of the queried tags)
    if (query.tags && query.tags.length > 0) {
      const noteTags = note.tags || [];
      const hasMatchingTag = query.tags.some(t =>
        noteTags.some(nt => nt.toLowerCase() === t.toLowerCase())
      );
      if (!hasMatchingTag) return false;
    }

    // 5. Favorite filter
    if (query.isFavorite !== undefined && Boolean(note.isFavorite) !== query.isFavorite) return false;

    // 6. Archived filter
    if (query.isArchived !== undefined && Boolean(note.isArchived) !== query.isArchived) return false;

    // 7. Date range filter
    const noteTimestamp = note.updatedAt || note.createdAt || 0;
    if (query.dateFrom !== undefined && noteTimestamp < query.dateFrom) return false;
    if (query.dateTo !== undefined && noteTimestamp > query.dateTo) return false;

    return true;
  });
};

/**
 * Executes a unified search across notes using BM25 lexical ranking, dense vector similarity,
 * or hybrid Reciprocal Rank Fusion.
 *
 * @param query - Structured {@link SearchQuery} parameters
 * @param candidateNotes - Optional pre-loaded notes array (defaults to fetching from IndexedDB)
 * @returns Array of ranked {@link SearchResult} items
 */
export const executeUnifiedSearch = async (
  query: SearchQuery,
  candidateNotes?: Note[]
): Promise<{ results: SearchResult[]; facets: SearchFacets }> => {
  const queryText = query.text.trim();
  const limit = query.limit || 10;
  const mode = query.mode || 'hybrid';
  const alpha = query.alpha !== undefined ? query.alpha : 0.65;

  // Retrieve candidate notes from Dexie if not passed directly
  const allNotes = candidateNotes || (await db.notes.toArray());
  const filteredNotes = filterNotesByMetadata(allNotes, query);

  // If no text query is provided, return metadata-filtered notes sorted by newest first
  if (!queryText) {
    const facets = calculateSearchFacets(filteredNotes);
    const sorted = filteredNotes
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .slice(0, limit)
      .map(note => ({
        note,
        score: 1.0,
        lexicalScore: 1.0,
        vectorScore: 0,
        matchedFields: [] as ('title' | 'tag' | 'content' | 'semantic')[],
        highlights: [] as SearchHighlight[]
      }));

    return { results: sorted, facets };
  }

  const queryTokens = tokenizeText(queryText, true);
  const avgDocLength = filteredNotes.length > 0
    ? filteredNotes.reduce((acc, n) => acc + (n.content?.length || 0), 0) / filteredNotes.length
    : 150;

  // Precompute query embedding if semantic or hybrid mode is requested
  let queryEmbedding: number[] | null = null;
  if (mode === 'hybrid' || mode === 'semantic') {
    try {
      queryEmbedding = await generateEmbedding(queryText);
    } catch (e) {
      console.warn('Vector embedding generation failed, falling back to lexical search:', e);
    }
  }

  const scoredResults: SearchResult[] = [];

  for (const note of filteredNotes) {
    let lexicalScore = 0;
    let vectorScore = 0;
    const matchedFieldsSet = new Set<'title' | 'tag' | 'content' | 'semantic'>();
    let isFuzzyMatch = false;

    // 1. Lexical Scoring (BM25 + Multi-field)
    if (mode === 'hybrid' || mode === 'lexical' || !queryEmbedding) {
      const bm25Result = scoreBM25Note(
        queryTokens,
        {
          title: note.title,
          tags: note.tags,
          content: note.content || ''
        },
        avgDocLength
      );

      lexicalScore = bm25Result.score;
      bm25Result.matchedFields.forEach(f => matchedFieldsSet.add(f));
      if (bm25Result.isFuzzy) isFuzzyMatch = true;
    }

    // 2. Vector Semantic Scoring
    if ((mode === 'hybrid' || mode === 'semantic') && queryEmbedding && note.embedding) {
      const sim = cosineSimilarity(queryEmbedding, note.embedding);
      vectorScore = Math.max(0, sim);
      if (vectorScore > 0.35) {
        matchedFieldsSet.add('semantic');
      }
    }

    // 3. Composite Score Calculation
    let compositeScore: number;
    if (mode === 'lexical') {
      compositeScore = lexicalScore;
    } else if (mode === 'semantic') {
      compositeScore = vectorScore;
    } else {
      // Hybrid mode: Linear blend of vector and lexical scores
      compositeScore = alpha * vectorScore + (1 - alpha) * lexicalScore;
      
      // Bonus boost for exact title phrase matches
      if (note.title.toLowerCase() === queryText.toLowerCase()) {
        compositeScore = Math.min(1.0, compositeScore + 0.35);
      } else if (note.title.toLowerCase().includes(queryText.toLowerCase())) {
        compositeScore = Math.min(1.0, compositeScore + 0.15);
      }
    }

    // Threshold filter: only include relevant results
    if (compositeScore > 0.05 || matchedFieldsSet.size > 0) {
      const highlights: SearchHighlight[] = [];
      if (note.content) {
        const snippet = extractSearchSnippet(note.content, queryTokens, 140);
        if (snippet) {
          highlights.push({
            field: 'content',
            snippet,
            matchIndices: []
          });
        }
      }

      scoredResults.push({
        note,
        score: compositeScore,
        lexicalScore,
        vectorScore,
        matchedFields: Array.from(matchedFieldsSet),
        highlights,
        isFuzzyMatch
      });
    }
  }

  // Sort descending by composite score
  scoredResults.sort((a, b) => b.score - a.score);

  const facets = calculateSearchFacets(filteredNotes);

  return {
    results: scoredResults.slice(0, limit),
    facets
  };
};
