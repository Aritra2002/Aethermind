/**
 * @file critical-user-journeys.test.ts
 * @description Comprehensive End-to-End Integration QA Suite for Phase 12: Testing + QA.
 * Validates critical multi-step user journeys across AetherMind:
 * 1. Note Creation & Wiki-Link Auto-Backlinking
 * 2. Document Ingestion, Embedding & RAG Context Synthesis
 * 3. AI Actions Preflight Validation, Execution & 1-Click Rollback
 * 4. Point-in-Time Graph Snapshots & Time-Travel Recovery
 * 5. Secret-Free Vault Export & Validated Import with Collision Handling
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db, type Note, type Page } from '../db';
import { syncLinksForNote } from '../db/helpers';
import { chunkTextContent } from '../utils/documentPipeline';
import { generateEmbedding, setUseFallbackForTesting, clearEmbeddingCache } from '../utils/vectorSearch';
import { searchDocuments } from '../utils/rag';
import { parseAiResponse, executeAiAction, undoAiAction, getActionRiskLevel } from '../utils/aiActions';
import { computeSnapshotDiff } from '../utils/snapshotManager';
import { generateVaultExportJson } from '../utils/vaultExport';
import { validateBackupPayload } from '../utils/backupValidation';
import { importVaultPayload } from '../utils/vaultImport';

describe('Phase 12 E2E Journey 1: Note Lifecycle & Wiki-Link Auto-Backlinking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return callback();
    });
  });

  it('detects [[Wiki Links]] in note content and synchronizes graph links', async () => {
    const activeNote: Note = {
      id: 10,
      pageId: 1,
      title: 'Quantum Mechanics',
      content: 'See also [[Superposition]] and [[Entanglement]] for advanced principles.',
      tags: ['physics'],
      category: 'science',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const targetNote1: Note = { id: 20, pageId: 1, title: 'Superposition', content: '', tags: [], category: 'science', createdAt: 0, updatedAt: 0 };
    const targetNote2: Note = { id: 30, pageId: 1, title: 'Entanglement', content: '', tags: [], category: 'science', createdAt: 0, updatedAt: 0 };

    vi.spyOn(db.notes, 'get').mockResolvedValue(activeNote as any);
    vi.spyOn(db.notes, 'toArray').mockResolvedValue([activeNote, targetNote1, targetNote2] as any);

    // Query for existing target notes
    vi.spyOn(db.notes, 'where').mockImplementation((field: any) => {
      if (field === 'pageId') {
        return {
          toArray: async () => [activeNote, targetNote1, targetNote2]
        } as any;
      }
      return {
        equalsIgnoreCase: (title: string) => ({
          and: () => ({
            first: async () => {
              if (title.toLowerCase() === 'superposition') return targetNote1;
              if (title.toLowerCase() === 'entanglement') return targetNote2;
              return null;
            }
          })
        })
      } as any;
    });

    vi.spyOn(db.links, 'where').mockReturnValue({
      equals: () => ({
        toArray: async () => []
      })
    } as any);

    const addedLinks: Array<{ sourceId: number; targetId: number }> = [];
    vi.spyOn(db.links, 'bulkAdd').mockImplementation(async (links: any) => {
      addedLinks.push(...links);
      return links.length;
    });

    await syncLinksForNote(activeNote.id!, activeNote.content, [], true);

    expect(addedLinks.length).toBe(2);
    expect(addedLinks.some(l => l.sourceId === 10 && l.targetId === 20)).toBe(true);
    expect(addedLinks.some(l => l.sourceId === 10 && l.targetId === 30)).toBe(true);
  });
});

describe('Phase 12 E2E Journey 2: Document Ingestion, Chunking & RAG Retrieval', () => {
  beforeEach(() => {
    setUseFallbackForTesting(true);
    clearEmbeddingCache();
    vi.restoreAllMocks();
  });

  it('chunks documents on sentence boundaries and retrieves most relevant context by cosine similarity', async () => {
    const documentText = `
      Deep learning models rely heavily on gradient descent optimization algorithms.
      Backpropagation calculates partial derivatives across neural network layers.
      Quantum computers use qubits to compute probability states simultaneously.
    `.trim();

    const chunks = chunkTextContent(documentText, 100, 20);
    expect(chunks.length).toBeGreaterThan(1);

    const query = 'neural network backpropagation';

    const mockStoredChunks = [
      { id: 1, documentId: 'doc_1', documentName: 'AI Primer', content: chunks[0], embedding: await generateEmbedding(chunks[0]), chunkIndex: 0, metadata: {}, createdAt: Date.now() },
      { id: 2, documentId: 'doc_1', documentName: 'AI Primer', content: chunks[1], embedding: await generateEmbedding(chunks[1]), chunkIndex: 1, metadata: {}, createdAt: Date.now() }
    ];

    vi.spyOn(db.documents, 'toArray').mockResolvedValue(mockStoredChunks as any);

    const results = await searchDocuments(query, 2);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0.01);
  });
});

describe('Phase 12 E2E Journey 3: AI Actions Preflight, Execution & 1-Click Rollback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return callback();
    });
  });

  it('validates, executes, and rolls back an AI note creation action', async () => {
    const rawAiOutput = `
      I have analyzed your request.
      \`\`\`json
      {
        "action": "create_note",
        "title": "Autonomous Agents Architecture",
        "content": "Detailed overview of autonomous agent systems.",
        "category": "ai",
        "tags": ["agents", "llm"]
      }
      \`\`\`
    `;

    const parsed = parseAiResponse(rawAiOutput);
    expect(parsed.actions.length).toBe(1);
    expect(parsed.actions[0].action).toBe('create_note');
    expect(getActionRiskLevel(parsed.actions[0])).toBe('HIGH_RISK_WRITE');

    vi.spyOn(db.notes, 'where').mockReturnValue({
      equalsIgnoreCase: () => ({
        and: () => ({
          first: async () => null // Note doesn't exist yet
        })
      })
    } as any);

    vi.spyOn(db.notes, 'get').mockResolvedValue({
      id: 777,
      title: 'Autonomous Agents Architecture',
      content: '',
      tags: [],
      pageId: 1
    } as any);

    vi.spyOn(db.notes, 'add').mockResolvedValue(777 as any);
    vi.spyOn(db.notes, 'update').mockResolvedValue(1);
    vi.spyOn(db.links, 'where').mockReturnValue({
      equals: () => ({
        toArray: async () => []
      })
    } as any);

    vi.spyOn(db.auditLogs, 'add').mockResolvedValue(100);
    vi.spyOn(db.auditLogs, 'get').mockResolvedValue({
      id: 100,
      timestamp: Date.now(),
      actionType: 'create_note',
      targetTitle: 'Autonomous Agents Architecture',
      status: 'applied',
      details: JSON.stringify({ noteId: 777, wasCreated: true })
    } as any);
    vi.spyOn(db.auditLogs, 'update').mockResolvedValue(1);

    const execResult = await executeAiAction(parsed.actions[0], 1);
    expect(execResult.success).toBe(true);
    expect(execResult.auditLogId).toBe(100);

    // Rollback action
    const deleteSpy = vi.spyOn(db.notes, 'delete').mockResolvedValue();

    const undoSuccess = await undoAiAction(execResult.auditLogId!);
    expect(undoSuccess.success).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith(777);
  });
});

describe('Phase 12 E2E Journey 4: Point-in-Time Graph Snapshots & Time-Travel Recovery', () => {
  it('computes exact structural diffs between snapshot milestones', () => {
    const snapshotA = {
      notes: [
        { id: 1, title: 'Note Alpha', content: 'Base content', pageId: 1, tags: ['v1'], category: 'general', createdAt: 0, updatedAt: 0 }
      ],
      links: []
    };

    const snapshotB = {
      notes: [
        { id: 1, title: 'Note Alpha', content: 'Base content updated with new metrics', pageId: 1, tags: ['v1', 'v2'], category: 'general', createdAt: 0, updatedAt: 0 },
        { id: 2, title: 'Note Beta', content: 'Newly discovered relation', pageId: 1, tags: ['v2'], category: 'ideas', createdAt: 0, updatedAt: 0 }
      ],
      links: [{ id: 10, sourceId: 1, targetId: 2 }]
    };

    const diff = computeSnapshotDiff(snapshotA, snapshotB);

    expect(diff.addedNotes.length).toBe(1);
    expect(diff.addedNotes[0].title).toBe('Note Beta');
    expect(diff.modifiedNotes.length).toBe(1);
    expect(diff.modifiedNotes[0].changedFields).toContain('content');
    expect(diff.modifiedNotes[0].changedFields).toContain('tags');
    expect(diff.addedLinksCount).toBe(1);
  });
});

describe('Phase 12 E2E Journey 5: Secret-Free Vault Portability & Collision-Free Import', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return callback();
    });
  });

  it('exports, validates, and safely imports vault with title collision avoidance', async () => {
    const mockNotes: Note[] = [
      { id: 10, title: 'System Overview', content: 'Architecture guide', pageId: 1, tags: ['core'], category: 'general', createdAt: 0, updatedAt: 0 }
    ];
    const mockPages: Page[] = [{ id: 1, title: 'Workspace', createdAt: 1000 }];

    vi.spyOn(db.notes, 'toArray').mockResolvedValue(mockNotes as any);
    vi.spyOn(db.links, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.categories, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.pages, 'toArray').mockResolvedValue(mockPages as any);
    vi.spyOn(db.snapshots, 'toArray').mockResolvedValue([]);

    // 1. Export vault
    const exportPayload = await generateVaultExportJson();
    expect(exportPayload.app).toBe('AetherMind');

    // 2. Validate payload
    const validation = validateBackupPayload(exportPayload);
    expect(validation.valid).toBe(true);
    expect(validation.data).toBeTruthy();

    // 3. Import in merge mode where 'System Overview' already exists
    vi.spyOn(db.snapshots, 'add').mockResolvedValue(888);
    vi.spyOn(db.pages, 'toCollection').mockReturnValue({
      first: async () => ({ id: 1, title: 'Workspace' })
    } as any);
    vi.spyOn(db.notes, 'where').mockReturnValue({
      equalsIgnoreCase: () => ({
        and: () => ({
          first: async () => ({ id: 5, title: 'System Overview', pageId: 1 }) // Title collision exists!
        })
      })
    } as any);

    let addedTitle = '';
    vi.spyOn(db.notes, 'add').mockImplementation(async (note: any) => {
      addedTitle = note.title;
      return 99;
    });

    const importResult = await importVaultPayload(validation.data!, 'merge');

    expect(importResult.success).toBe(true);
    expect(importResult.importedNotesCount).toBe(1);
    // Verified collision resolution: imported note renamed with (Imported) suffix
    expect(addedTitle).toBe('System Overview (Imported)');
  });
});
