/**
 * @file backup-validation.test.ts
 * @description Unit tests for backup schema validation, malicious payload filtering, and preview generation.
 */

import { describe, it, expect } from 'vitest';
import { validateBackupPayload } from '../utils/backupValidation';

describe('Backup Validation & Integrity Checks', () => {
  it('rejects non-object or null payloads', () => {
    expect(validateBackupPayload(null).valid).toBe(false);
    expect(validateBackupPayload('invalid string').valid).toBe(false);
    expect(validateBackupPayload(12345).valid).toBe(false);
  });

  it('rejects payloads missing app="AetherMind"', () => {
    const invalid = { app: 'OtherApp', notes: [] };
    const result = validateBackupPayload(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unrecognized backup format');
  });

  it('successfully validates well-formed backup payloads and extracts summary metrics', () => {
    const validPayload = {
      app: 'AetherMind',
      version: 1,
      timestamp: 1718000000000,
      pages: [{ id: 1, title: 'Main Page', createdAt: 1718000000000 }],
      notes: [
        { id: 10, pageId: 1, title: 'Note Alpha', content: '# Hello', tags: ['work', 'ai'] },
        { id: 11, pageId: 1, title: 'Note Beta', content: 'Connecting [[Note Alpha]]', tags: ['work'] }
      ],
      links: [
        { id: 100, sourceId: 11, targetId: 10 }
      ],
      categories: [
        { id: 'work', label: 'Work', color: '#34d399' }
      ],
      snapshots: []
    };

    const result = validateBackupPayload(validPayload);
    expect(result.valid).toBe(true);
    expect(result.data?.notes.length).toBe(2);
    expect(result.summary?.noteCount).toBe(2);
    expect(result.summary?.linkCount).toBe(1);
    expect(result.summary?.tagCount).toBe(2); // 'work', 'ai'
  });

  it('sanitizes and defaults missing note fields safely', () => {
    const loosePayload = {
      app: 'AetherMind',
      notes: [
        { title: 'Sparse Note' } // missing content, tags, category, pageId
      ]
    };

    const result = validateBackupPayload(loosePayload);
    expect(result.valid).toBe(true);
    const note = result.data?.notes[0];
    expect(note?.title).toBe('Sparse Note');
    expect(note?.content).toBe('');
    expect(note?.tags).toEqual([]);
    expect(note?.category).toBe('general');
    expect(note?.pageId).toBe(1);
  });

  it('filters out corrupted note entries with empty titles', () => {
    const payload = {
      app: 'AetherMind',
      notes: [
        { title: '' },
        { title: '   ' },
        { content: 'No title provided' },
        { title: 'Valid Note', content: 'Some content' }
      ]
    };

    const result = validateBackupPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.data?.notes.length).toBe(1);
    expect(result.data?.notes[0].title).toBe('Valid Note');
  });
});
