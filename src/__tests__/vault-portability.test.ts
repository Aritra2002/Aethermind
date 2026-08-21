/**
 * @file vault-portability.test.ts
 * @description Comprehensive unit test suite for Phase 8: Import/Export + History & Snapshots.
 * Tests secret-free JSON export, schema validation, merge/replace import modes with ID remapping,
 * emergency safety snapshots, and snapshot diff computation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVaultExportJson } from '../utils/vaultExport';
import { validateBackupPayload, type ValidatedBackup } from '../utils/backupValidation';
import { importVaultPayload, rollbackToSafetySnapshot } from '../utils/vaultImport';
import { computeSnapshotDiff } from '../utils/snapshotManager';
import { db, type Note, type Link, type Category, type Page } from '../db';

describe('Phase 8: Secret-Free Vault Exporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports vault data deterministically without leaking secrets', async () => {
    const mockNotes: Note[] = [
      { id: 1, title: 'Note A', content: 'Secret API Key: sk-12345 should not leak', pageId: 1, tags: ['safe'], category: 'general' }
    ];
    const mockLinks: Link[] = [{ id: 10, sourceId: 1, targetId: 2 }];
    const mockCategories: Category[] = [{ id: 'general', label: 'General', color: '#818cf8' }];
    const mockPages: Page[] = [{ id: 1, title: 'Main Graph', createdAt: 1000 }];

    vi.spyOn(db.notes, 'toArray').mockResolvedValue(mockNotes as any);
    vi.spyOn(db.links, 'toArray').mockResolvedValue(mockLinks as any);
    vi.spyOn(db.categories, 'toArray').mockResolvedValue(mockCategories as any);
    vi.spyOn(db.pages, 'toArray').mockResolvedValue(mockPages as any);
    vi.spyOn(db.snapshots, 'toArray').mockResolvedValue([] as any);

    const exportData = await generateVaultExportJson();

    expect(exportData.app).toBe('AetherMind');
    expect(exportData.version).toBe(1);
    expect(exportData.notes.length).toBe(1);
    expect(exportData.links.length).toBe(1);
    expect(exportData.categories.length).toBe(1);
    expect(exportData.pages.length).toBe(1);

    // Verify no extraneous secret keys are in the root payload
    const rawKeys = Object.keys(exportData);
    expect(rawKeys).not.toContain('apiKey');
    expect(rawKeys).not.toContain('openAiKey');
    expect(rawKeys).not.toContain('password');
    expect(rawKeys).not.toContain('token');
  });
});

describe('Phase 8: Backup Payload Validation', () => {
  it('validates a compliant AetherMind backup payload', () => {
    const rawBackup = {
      app: 'AetherMind',
      version: 1,
      timestamp: Date.now(),
      notes: [{ id: 1, title: 'Valid Note', content: 'Content', pageId: 1, tags: ['tech'] }],
      links: [{ sourceId: 1, targetId: 2 }],
      categories: [{ id: 'general', label: 'General', color: '#818cf8' }],
      pages: [{ id: 1, title: 'Graph' }],
      snapshots: []
    };

    const validation = validateBackupPayload(rawBackup);
    expect(validation.valid).toBe(true);
    expect(validation.data?.notes.length).toBe(1);
    expect(validation.summary?.noteCount).toBe(1);
  });

  it('rejects non-AetherMind payloads', () => {
    const invalidBackup = { app: 'OtherApp', notes: [] };
    const validation = validateBackupPayload(invalidBackup);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Unrecognized backup format');
  });

  it('provides fallback page if imported backup has missing pages', () => {
    const backupNoPages = {
      app: 'AetherMind',
      version: 1,
      notes: [{ title: 'Note 1', content: '' }],
      links: [],
      categories: []
    };

    const validation = validateBackupPayload(backupNoPages);
    expect(validation.valid).toBe(true);
    expect(validation.data?.pages.length).toBe(1);
    expect(validation.data?.pages[0].title).toBe('Graph');
  });
});

describe('Phase 8: Safe Vault Importer (Merge & Replace)', () => {
  const sampleBackup: ValidatedBackup = {
    app: 'AetherMind',
    version: 1,
    timestamp: Date.now(),
    pages: [{ id: 10, title: 'Research' }],
    categories: [{ id: 'tech', label: 'Technology', color: '#6366f1' }],
    notes: [
      { id: 100, pageId: 10, title: 'Quantum', content: 'Quantum body', tags: ['physics'], category: 'tech' },
      { id: 101, pageId: 10, title: 'AI', content: 'AI body', tags: ['ml'], category: 'tech' }
    ],
    links: [{ id: 50, sourceId: 100, targetId: 101 }],
    snapshots: []
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return callback();
    });
  });

  it('imports vault in merge mode and creates pre-import safety snapshot', async () => {
    vi.spyOn(db.notes, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.links, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.pages, 'toCollection').mockReturnValue({
      first: async () => ({ id: 1, title: 'Research' })
    } as any);
    vi.spyOn(db.snapshots, 'add').mockResolvedValue(999);
    vi.spyOn(db.pages, 'toArray').mockResolvedValue([{ id: 1, title: 'Research' }] as any);
    vi.spyOn(db.categories, 'get').mockResolvedValue(null as any);
    vi.spyOn(db.categories, 'add').mockResolvedValue('tech' as any);

    vi.spyOn(db.notes, 'where').mockReturnValue({
      equalsIgnoreCase: () => ({
        and: () => ({
          first: async () => null // No title collision
        })
      })
    } as any);

    let nextNoteId = 500;
    vi.spyOn(db.notes, 'add').mockImplementation(async () => {
      return nextNoteId++;
    });

    vi.spyOn(db.links, 'where').mockReturnValue({
      first: async () => null
    } as any);

    const addLinkSpy = vi.spyOn(db.links, 'add').mockResolvedValue(600 as any);

    const result = await importVaultPayload(sampleBackup, 'merge');

    expect(result.success).toBe(true);
    expect(result.mode).toBe('merge');
    expect(result.importedNotesCount).toBe(2);
    expect(result.safetySnapshotId).toBe(999);
    expect(addLinkSpy).toHaveBeenCalledWith({
      sourceId: 500,
      targetId: 501,
      explanation: undefined
    });
  });

  it('triggers rollback to safety snapshot', async () => {
    const mockSnapshot = {
      id: 999,
      pageId: 1,
      timestamp: Date.now(),
      notesData: JSON.stringify([{ id: 1, title: 'Original Note', pageId: 1 }]),
      linksData: JSON.stringify([])
    };

    vi.spyOn(db.snapshots, 'get').mockResolvedValue(mockSnapshot as any);
    vi.spyOn(db.notes, 'where').mockReturnValue({
      toArray: async () => [],
      delete: async () => 0
    } as any);
    vi.spyOn(db.links, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.links, 'bulkDelete').mockResolvedValue();
    vi.spyOn(db.notes, 'add').mockResolvedValue(1);

    await expect(rollbackToSafetySnapshot(999, 1)).resolves.not.toThrow();
  });
});

describe('Phase 8: Snapshot History & Diff Computation', () => {
  it('computes field-level diffs between two snapshot versions', () => {
    const beforeState = {
      notes: [
        { id: 1, title: 'Note 1', content: 'Initial text', pageId: 1, tags: ['a'], category: 'general' },
        { id: 2, title: 'Deleted Note', content: 'Will be removed', pageId: 1, tags: [], category: 'general' }
      ],
      links: [{ id: 10, sourceId: 1, targetId: 2 }]
    };

    const afterState = {
      notes: [
        { id: 1, title: 'Note 1', content: 'Updated text with more insights', pageId: 1, tags: ['a', 'b'], category: 'tech' },
        { id: 3, title: 'New Note', content: 'Freshly created note', pageId: 1, tags: [], category: 'tech' }
      ],
      links: []
    };

    const diff = computeSnapshotDiff(beforeState, afterState);

    expect(diff.addedNotes.length).toBe(1);
    expect(diff.addedNotes[0].title).toBe('New Note');
    expect(diff.removedNotes.length).toBe(1);
    expect(diff.removedNotes[0].title).toBe('Deleted Note');
    expect(diff.modifiedNotes.length).toBe(1);
    expect(diff.modifiedNotes[0].changedFields).toContain('content');
    expect(diff.modifiedNotes[0].changedFields).toContain('tags');
    expect(diff.modifiedNotes[0].changedFields).toContain('category');
    expect(diff.removedLinksCount).toBe(1);
  });
});
