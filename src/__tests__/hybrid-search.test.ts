/**
 * @file hybrid-search.test.ts
 * @description Comprehensive unit test suite for Phase 4: Search + RAG Engine.
 * Verifies BM25 multi-field scoring, fuzzy typo tolerance, metadata facet filtering,
 * hybrid Reciprocal Rank Fusion, background indexing queue, and RAG citation synthesis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  tokenizeText,
  levenshteinDistance,
  isTokenMatch,
  scoreBM25Note,
  extractSearchSnippet
} from '../utils/search/bm25';
import {
  filterNotesByMetadata,
  calculateSearchFacets,
  executeUnifiedSearch
} from '../utils/search/hybridEngine';
import * as vectorSearchModule from '../utils/vectorSearch';
import { detectStaleNotes, indexNotesBackground } from '../utils/vectorSearch';
import { searchHybridRag, buildRagContextWithCitations } from '../utils/rag';
import { db, type Note } from '../db';

describe('Phase 4: Unified Search & BM25 Ranking Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vectorSearchModule, 'generateEmbedding').mockResolvedValue(new Array(384).fill(0.05));
  });
  describe('Tokenization & Fuzzy Distance', () => {
    it('tokenizes and normalizes text with stopword filtering', () => {
      const text = 'The quick Brown Fox jumps over the lazy dog!';
      const tokensWithoutStopwords = tokenizeText(text, true);
      expect(tokensWithoutStopwords).toContain('quick');
      expect(tokensWithoutStopwords).toContain('brown');
      expect(tokensWithoutStopwords).toContain('fox');
      expect(tokensWithoutStopwords).not.toContain('the');
    });

    it('calculates correct Levenshtein distances', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('quantum', 'quantm')).toBe(1);
      expect(levenshteinDistance('graph', 'graph')).toBe(0);
      expect(levenshteinDistance('', 'test')).toBe(4);
    });

    it('matches exact, prefix, substring, and fuzzy tokens', () => {
      // Exact match
      const exact = isTokenMatch('neural', 'neural');
      expect(exact.matched).toBe(true);
      expect(exact.isFuzzy).toBe(false);

      // Prefix match
      const prefix = isTokenMatch('transformers', 'trans');
      expect(prefix.matched).toBe(true);
      expect(prefix.isFuzzy).toBe(false);

      // Fuzzy typo match
      const fuzzy = isTokenMatch('algorithm', 'algoritm');
      expect(fuzzy.matched).toBe(true);
      expect(fuzzy.isFuzzy).toBe(true);

      // Non-match
      const nonMatch = isTokenMatch('banana', 'computer');
      expect(nonMatch.matched).toBe(false);
    });
  });

  describe('BM25 Multi-Field Scoring', () => {
    it('prioritizes title matches over content matches due to 3x field weight', () => {
      const query = ['machine', 'learning'];

      // Note A: matches query in title
      const noteA = scoreBM25Note(query, {
        title: 'Machine Learning Fundamentals',
        content: 'Overview of artificial intelligence techniques.'
      });

      // Note B: matches query only in content
      const noteB = scoreBM25Note(query, {
        title: 'Data Science Guide',
        content: 'This guide covers machine learning models and pipelines.'
      });

      expect(noteA.score).toBeGreaterThan(noteB.score);
      expect(noteA.matchedFields).toContain('title');
      expect(noteB.matchedFields).toContain('content');
    });

    it('extracts contextual search snippets around matched query terms', () => {
      const content = 'Introduction. A neural network is a network of artificial neurons. Neural networks are used in deep learning.';
      const snippet = extractSearchSnippet(content, ['neural']);
      expect(snippet.toLowerCase()).toContain('neural');
    });
  });

  describe('Metadata Filtering & Facet Aggregation', () => {
    const mockNotes: Note[] = [
      { id: 1, title: 'AI Research', content: 'Notes on LLMs', category: 'work', tags: ['ai', 'nlp'], isFavorite: true, pageId: 1, createdAt: 1000 },
      { id: 2, title: 'Book List', content: 'Sci-fi novels', category: 'personal', tags: ['books'], isFavorite: false, pageId: 1, createdAt: 2000 },
      { id: 3, title: 'Startup Ideas', content: 'Knowledge graph tool', category: 'ideas', tags: ['startup', 'ai'], isFavorite: true, pageId: 2, createdAt: 3000 },
      { id: 4, title: 'Old Draft', content: 'Trashed draft', isTrash: 1, category: 'work', tags: [], isFavorite: false, pageId: 1, createdAt: 4000 }
    ];

    it('filters notes accurately by category, tags, favorites, and trash status', () => {
      // Filter category
      const workNotes = filterNotesByMetadata(mockNotes, { text: '', category: 'work' });
      expect(workNotes.map(n => n.id)).toEqual([1]); // Note 4 is in trash

      // Filter tags
      const aiNotes = filterNotesByMetadata(mockNotes, { text: '', tags: ['ai'] });
      expect(aiNotes.map(n => n.id)).toEqual([1, 3]);

      // Filter favorite
      const favNotes = filterNotesByMetadata(mockNotes, { text: '', isFavorite: true });
      expect(favNotes.map(n => n.id)).toEqual([1, 3]);

      // Filter page ID
      const page2Notes = filterNotesByMetadata(mockNotes, { text: '', pageId: 2 });
      expect(page2Notes.map(n => n.id)).toEqual([3]);
    });

    it('aggregates facet counts for categories and tags', () => {
      const activeNotes = mockNotes.filter(n => Number(n.isTrash) !== 1);
      const facets = calculateSearchFacets(activeNotes);

      expect(facets.categoryCounts['work']).toBe(1);
      expect(facets.categoryCounts['personal']).toBe(1);
      expect(facets.categoryCounts['ideas']).toBe(1);
      expect(facets.tagCounts['ai']).toBe(2);
      expect(facets.totalMatching).toBe(3);
    });
  });

  describe('Unified Search Execution', () => {
    const candidateNotes: Note[] = [
      { id: 1, title: 'Graph Neural Networks', content: 'Message passing on graphs', category: 'work', tags: ['gnn', 'ai'], createdAt: 100 },
      { id: 2, title: 'Cooking Recipes', content: 'Italian pasta and pizza', category: 'personal', tags: ['food'], createdAt: 200 },
      { id: 3, title: 'Vector Database Engine', content: 'HNSW indexing for embeddings', category: 'ideas', tags: ['search', 'vector'], createdAt: 300 }
    ];

    it('returns ranked results with matched field indicators', async () => {
      const { results } = await executeUnifiedSearch(
        { text: 'neural networks', mode: 'lexical' },
        candidateNotes
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].note.title).toBe('Graph Neural Networks');
      expect(results[0].matchedFields).toContain('title');
      expect(results[0].score).toBeGreaterThan(0);
    });
  });
});

describe('Phase 4: RAG Engine & Background Vector Indexing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vectorSearchModule.setUseFallbackForTesting(true);
    vi.spyOn(vectorSearchModule, 'generateEmbedding').mockResolvedValue(new Array(384).fill(0.05));
  });

  it('detects stale notes missing embeddings', async () => {
    const mockDbNotes: Note[] = [
      { id: 10, title: 'Indexed Note', content: 'Has embedding', embedding: [0.1, 0.2] },
      { id: 11, title: 'Stale Note', content: 'No embedding' },
      { id: 12, title: 'Trashed Note', content: 'No embedding', isTrash: 1 }
    ];

    vi.spyOn(db.notes, 'toArray').mockResolvedValue(mockDbNotes);

    const stale = await detectStaleNotes();
    expect(stale.length).toBe(1);
    expect(stale[0].id).toBe(11);
  });

  it('processes stale notes incrementally in background queue', async () => {
    const mockDbNotes: Note[] = [
      { id: 20, title: 'Unindexed Note A', content: 'Text A' },
      { id: 21, title: 'Unindexed Note B', content: 'Text B' }
    ];

    vi.spyOn(db.notes, 'toArray').mockResolvedValue(mockDbNotes);
    const updateSpy = vi.spyOn(db.notes, 'update').mockResolvedValue(1);

    const progressReports: number[] = [];
    const count = await indexNotesBackground(p => {
      progressReports.push(p.current);
    }, 1);

    expect(count).toBe(2);
    expect(progressReports).toEqual([1, 2]);
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });

  it('searches hybrid RAG and builds structured citations with provenance', async () => {
    vi.spyOn(db.documents, 'toArray').mockResolvedValue([
      {
        id: 1,
        documentId: 'doc_1',
        documentName: 'Research Paper.pdf',
        chunkIndex: 0,
        content: 'Quantum computing leverages quantum superposition and entanglement.',
        embedding: new Array(384).fill(0.05),
        createdAt: 1000
      },
      {
        id: 2,
        documentId: 'note_5',
        documentName: '[Note] Quantum Notes',
        chunkIndex: 0,
        content: 'Quantum algorithms such as Shor and Grover.',
        embedding: new Array(384).fill(0.04),
        metadata: { type: 'note', noteId: 5 },
        createdAt: 2000
      }
    ]);

    const citations = await searchHybridRag('quantum computing', 5);
    expect(citations.length).toBeGreaterThan(0);
    expect(citations[0].index).toBe(1);
    expect(citations[0].sourceName).toBeDefined();

    const formattedPromptContext = buildRagContextWithCitations(citations);
    expect(formattedPromptContext).toContain('[Citation 1:');
    expect(formattedPromptContext).toContain('Quantum');
  });
});
