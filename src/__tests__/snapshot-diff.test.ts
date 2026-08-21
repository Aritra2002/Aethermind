/**
 * @file snapshot-diff.test.ts
 * @description Unit tests for Snapshot Diffing and Time Travel Management.
 */

import { describe, it, expect } from 'vitest';
import { computeSnapshotDiff } from '../utils/snapshotManager';
import type { Note, Link } from '../db';

describe('Snapshot Management & Diffing Suite', () => {
  const baseNotes: Note[] = [
    {
      id: 1,
      pageId: 1,
      title: 'Machine Learning',
      content: 'Supervised and Unsupervised Learning',
      tags: ['ai', 'ml'],
      category: 'research',
      createdAt: 1000,
      updatedAt: 1000,
      uuid: 'uuid-note-1'
    },
    {
      id: 2,
      pageId: 1,
      title: 'Neural Networks',
      content: 'Backpropagation and activations',
      tags: ['ai', 'deep-learning'],
      category: 'research',
      createdAt: 1000,
      updatedAt: 1000,
      uuid: 'uuid-note-2'
    }
  ];

  const baseLinks: Link[] = [
    { id: 1, sourceId: 1, targetId: 2 }
  ];

  it('identifies identical states with zero diffs', () => {
    const diff = computeSnapshotDiff(
      { notes: baseNotes, links: baseLinks },
      { notes: baseNotes, links: baseLinks }
    );

    expect(diff.addedNotes.length).toBe(0);
    expect(diff.removedNotes.length).toBe(0);
    expect(diff.modifiedNotes.length).toBe(0);
    expect(diff.addedLinksCount).toBe(0);
    expect(diff.removedLinksCount).toBe(0);
  });

  it('detects added, removed, and modified notes accurately', () => {
    const afterNotes: Note[] = [
      // Modified note 1: content and tags updated
      {
        id: 1,
        pageId: 1,
        title: 'Machine Learning',
        content: 'Supervised, Unsupervised, and Reinforcement Learning',
        tags: ['ai', 'ml', 'rl'],
        category: 'research',
        createdAt: 1000,
        updatedAt: 2000,
        uuid: 'uuid-note-1'
      },
      // Note 2 removed, Note 3 added
      {
        id: 3,
        pageId: 1,
        title: 'Transformers & LLMs',
        content: 'Self-attention mechanisms',
        tags: ['ai', 'nlp'],
        category: 'research',
        createdAt: 2000,
        updatedAt: 2000,
        uuid: 'uuid-note-3'
      }
    ];

    const afterLinks: Link[] = [
      { id: 1, sourceId: 1, targetId: 3 },
      { id: 2, sourceId: 3, targetId: 1 }
    ];

    const diff = computeSnapshotDiff(
      { notes: baseNotes, links: baseLinks },
      { notes: afterNotes, links: afterLinks }
    );

    // Added note
    expect(diff.addedNotes.length).toBe(1);
    expect(diff.addedNotes[0].title).toBe('Transformers & LLMs');

    // Removed note
    expect(diff.removedNotes.length).toBe(1);
    expect(diff.removedNotes[0].title).toBe('Neural Networks');

    // Modified note
    expect(diff.modifiedNotes.length).toBe(1);
    expect(diff.modifiedNotes[0].changedFields).toContain('content');
    expect(diff.modifiedNotes[0].changedFields).toContain('tags');

    // Links delta
    expect(diff.addedLinksCount).toBe(1); // 2 - 1 = 1
    expect(diff.removedLinksCount).toBe(0);
  });
});
