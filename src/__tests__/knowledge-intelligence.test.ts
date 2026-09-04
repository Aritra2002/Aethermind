import { describe, it, expect } from 'vitest';
import { extractConceptsFromText } from '../utils/intelligence/conceptExtractor';
import { detectContradictions } from '../utils/intelligence/contradictionDetector';
import { detectKnowledgeGaps } from '../utils/intelligence/knowledgeGapDetector';
import type { Note, Link } from '../db';

describe('Knowledge Intelligence — Concept & Entity Extraction', () => {
  it('extracts technologies, capitalized concepts, and tags from markdown text', () => {
    const text = `# Architecture Overview
AetherMind leverages React, TypeScript, and IndexedDB with WebAssembly for offline intelligence.
The core engine employs Vector Search and Spaced Repetition for memory consolidation.
Related note: [[Graph Visualization]].
#architecture #ai`;

    const result = extractConceptsFromText(text, ['Graph Visualization', 'Other Note']);

    // Check technologies
    const techNames = result.entities.filter(e => e.type === 'technology').map(e => e.name);
    expect(techNames).toContain('React');
    expect(techNames).toContain('TypeScript');
    expect(techNames).toContain('IndexedDB');
    expect(techNames).toContain('WebAssembly');

    // Check capitalized multi-word concepts
    const conceptNames = result.entities.filter(e => e.type === 'concept').map(e => e.name);
    expect(conceptNames).toContain('Vector Search');
    expect(conceptNames).toContain('Spaced Repetition');
    expect(conceptNames).toContain('Graph Visualization');

    // Check candidate wiki-links and tags
    expect(result.suggestedWikiLinks).toContain('Graph Visualization');
    expect(result.keyTopics).toContain('architecture');
    expect(result.keyTopics).toContain('ai');
  });

  it('handles empty and whitespace-only text gracefully', () => {
    const result = extractConceptsFromText('   ', []);
    expect(result.entities).toEqual([]);
    expect(result.suggestedWikiLinks).toEqual([]);
    expect(result.keyTopics).toEqual([]);
  });
});

describe('Knowledge Intelligence — Contradiction Detection', () => {
  it('identifies direct polarity contradiction between related notes', () => {
    const notes: Note[] = [
      {
        id: 1,
        pageId: 1,
        title: 'IndexedDB Security',
        content: 'Client-side IndexedDB is safe and secure for caching encrypted local tokens.',
        tags: ['security'],
        category: 'work',
        createdAt: 1000,
        updatedAt: 1000
      },
      {
        id: 2,
        pageId: 1,
        title: 'Local Storage Policy',
        content: 'Client-side IndexedDB is unsafe and insecure for storing unencrypted secrets.',
        tags: ['security'],
        category: 'work',
        createdAt: 2000,
        updatedAt: 2000
      }
    ];

    const contradictions = detectContradictions(notes);
    expect(contradictions.length).toBeGreaterThan(0);
    expect(contradictions[0].claimA.noteId).toBe(1);
    expect(contradictions[0].claimB.noteId).toBe(2);
    expect(contradictions[0].type).toBe('direct_conflict');
  });

  it('distinguishes temporal evolution when statements are separated by significant time', () => {
    const oneYearMs = 1000 * 60 * 60 * 24 * 365;
    const notes: Note[] = [
      {
        id: 10,
        pageId: 1,
        title: 'Framework Evaluation 2024',
        content: 'WASM in browser is slow and unsupported for high-throughput transformers.',
        tags: ['web'],
        category: 'general',
        createdAt: 10000,
        updatedAt: 10000
      },
      {
        id: 11,
        pageId: 1,
        title: 'Framework Evaluation 2026',
        content: 'WASM in browser is fast and supported for all modern local transformer inference.',
        tags: ['web'],
        category: 'general',
        createdAt: 10000 + oneYearMs,
        updatedAt: 10000 + oneYearMs
      }
    ];

    const contradictions = detectContradictions(notes);
    expect(contradictions.length).toBeGreaterThan(0);
    expect(contradictions[0].type).toBe('temporal_evolution');
  });
});

describe('Knowledge Intelligence — Knowledge Gap Detection', () => {
  it('detects missing concept notes referenced in text', () => {
    const notes: Note[] = [
      {
        id: 101,
        pageId: 1,
        title: 'Quantum Computing Intro',
        content: 'Explores [[Quantum Teleportation]] and how qubits interact.',
        tags: ['quantum'],
        category: 'ideas',
        createdAt: 1000,
        updatedAt: 1000
      }
    ];
    const links: Link[] = [];

    const gaps = detectKnowledgeGaps(notes, links);
    const missingPageGap = gaps.find(g => g.type === 'missing_concept_page');
    expect(missingPageGap).toBeDefined();
    expect(missingPageGap?.title).toContain('Quantum Teleportation');
  });

  it('detects unresolved questions and research inquiries in notes', () => {
    const notes: Note[] = [
      {
        id: 102,
        pageId: 1,
        title: 'Memory Consolidation',
        content: 'TODO: Investigate how REM sleep cycles impact spaced repetition recall rates.',
        tags: ['neuroscience'],
        category: 'ideas',
        createdAt: 1000,
        updatedAt: 1000
      }
    ];
    const links: Link[] = [];

    const gaps = detectKnowledgeGaps(notes, links);
    const questionGap = gaps.find(g => g.type === 'unresolved_question');
    expect(questionGap).toBeDefined();
    expect(questionGap?.description).toContain('Investigate how REM sleep');
  });

  it('detects isolated nodes without any graph links', () => {
    const notes: Note[] = [
      {
        id: 201,
        pageId: 1,
        title: 'Orphan Thought',
        content: 'A solitary note with no graph links yet.',
        tags: [],
        category: 'general',
        createdAt: 1000,
        updatedAt: 1000
      },
      {
        id: 202,
        pageId: 1,
        title: 'Connected Note A',
        content: 'Connected.',
        tags: [],
        category: 'general',
        createdAt: 1000,
        updatedAt: 1000
      },
      {
        id: 203,
        pageId: 1,
        title: 'Connected Note B',
        content: 'Connected.',
        tags: [],
        category: 'general',
        createdAt: 1000,
        updatedAt: 1000
      }
    ];

    const links: Link[] = [
      { id: 1, sourceId: 202, targetId: 203 }
    ];

    const gaps = detectKnowledgeGaps(notes, links);
    const isolatedGap = gaps.find(g => g.type === 'isolated_island' && g.sourceNoteId === 201);
    expect(isolatedGap).toBeDefined();
    expect(isolatedGap?.title).toContain('Orphan Thought');
  });
});
