/**
 * @file ai-platform-actions.test.ts
 * @description Comprehensive unit test suite for Phase 5: AI Platform + AI Actions Subsystem.
 * Tests exponential backoff retry, strict action parsing, risk classification,
 * preflight validation, transactional execution, and 1-click action rollback/undo.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, defaultIsRetryable } from '../utils/ai/retry';
import {
  parseAiResponse,
  getActionRiskLevel,
  generateActionDiff,
  validateActionPreflight,
  executeAiAction,
  undoAiAction,
  getAiActionHistory,
  type AiAction
} from '../utils/aiActions';
import { db, type Note } from '../db';

describe('Phase 5: AI Platform Resilience & Retry', () => {
  it('detects retryable rate limit (429) and gateway (503) errors', () => {
    expect(defaultIsRetryable(new Error('HTTP 429 Too Many Requests'))).toBe(true);
    expect(defaultIsRetryable(new Error('503 Service Unavailable'))).toBe(true);
    expect(defaultIsRetryable(new Error('Failed to fetch'))).toBe(true);
    expect(defaultIsRetryable(new Error('401 Unauthorized'))).toBe(false);
    expect(defaultIsRetryable(new Error('Invalid prompt schema'))).toBe(false);
  });

  it('succeeds without retry on successful call', async () => {
    const mockFn = vi.fn().mockResolvedValue('AI Response');
    const result = await withRetry(mockFn, { maxRetries: 3 });

    expect(result).toBe('AI Response');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures with exponential backoff and succeeds', async () => {
    let attempt = 0;
    const mockFn = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt < 2) {
        throw new Error('429 Rate Limit Exceeded');
      }
      return 'Recovered Response';
    });

    const result = await withRetry(mockFn, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 50
    });

    expect(result).toBe('Recovered Response');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('throws after exceeding maxRetries on persistent errors', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('503 Server Error'));

    await expect(
      withRetry(mockFn, {
        maxRetries: 2,
        initialDelayMs: 5,
        maxDelayMs: 20
      })
    ).rejects.toThrow('503 Server Error');

    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe('Phase 5: Strict AI Action Parsing, Validation & Risk Policy', () => {
  it('extracts valid JSON action blocks from LLM markdown responses', () => {
    const rawAiOutput = `
I have analyzed your request and created a plan.

\`\`\`json
{
  "action": "create_note",
  "title": "Quantum Computing",
  "content": "# Quantum Computing\\nExploration of qubits and superposition.",
  "tags": ["quantum", "physics"],
  "linkTo": ["Artificial Intelligence"]
}
\`\`\`

Let me know if you want to expand on this topic!
`;

    const { actions, cleanedText } = parseAiResponse(rawAiOutput);

    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('create_note');
    if (actions[0].action === 'create_note') {
      expect(actions[0].title).toBe('Quantum Computing');
      expect(actions[0].tags).toEqual(['quantum', 'physics']);
      expect(actions[0].linkTo).toEqual(['Artificial Intelligence']);
    }
    expect(cleanedText).toContain('I have analyzed your request');
    expect(cleanedText).not.toContain('```json');
  });

  it('classifies risk levels accurately per safety policy', () => {
    const createLink: AiAction = { action: 'create_link', from: 'A', to: 'B' };
    const createNote: AiAction = { action: 'create_note', title: 'Note', content: 'Body' };
    const editNote: AiAction = { action: 'edit_note', title: 'Note', newContent: 'Updated' };
    const deleteNote: AiAction = { action: 'delete_note', title: 'Note' };

    expect(getActionRiskLevel(createLink)).toBe('LOW_RISK_WRITE');
    expect(getActionRiskLevel(createNote)).toBe('HIGH_RISK_WRITE');
    expect(getActionRiskLevel(editNote)).toBe('HIGH_RISK_WRITE');
    expect(getActionRiskLevel(deleteNote)).toBe('DESTRUCTIVE');
  });

  it('generates before/after diffs with field change descriptors', () => {
    const editAction: AiAction = {
      action: 'edit_note',
      title: 'Original Title',
      newTitle: 'Renamed Title',
      newContent: 'New body content'
    };

    const existing = {
      title: 'Original Title',
      content: 'Old body content',
      tags: ['tag1']
    };

    const diff = generateActionDiff(editAction, existing);

    expect(diff.riskLevel).toBe('HIGH_RISK_WRITE');
    expect(diff.changes.length).toBe(2);
    expect(diff.changes[0].field).toBe('title');
    expect(diff.changes[0].from).toBe('Original Title');
    expect(diff.changes[0].to).toBe('Renamed Title');
    expect(diff.changes[1].field).toBe('content');
  });

  it('blocks empty content on edit_note during preflight validation', async () => {
    const invalidEdit: AiAction = {
      action: 'edit_note',
      title: 'Valid Note',
      newContent: '   '
    };

    const check = await validateActionPreflight(invalidEdit, 1);
    expect(check.blocked).toBe(true);
    expect(check.message).toContain('cannot be empty');
  });
});

describe('Phase 5: Transactional Execution & 1-Click Action Rollback (Undo)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return callback();
    });
  });

  it('executes create_link and records audit log', async () => {
    const mockFromNote: Note = { id: 101, title: 'Alpha', content: '', pageId: 1 };
    const mockToNote: Note = { id: 102, title: 'Beta', content: '', pageId: 1 };

    vi.spyOn(db.notes, 'where').mockImplementation(() => ({
      equalsIgnoreCase: (val: string) => ({
        and: () => ({
          first: async () => (val === 'Alpha' ? mockFromNote : val === 'Beta' ? mockToNote : null)
        })
      })
    } as any));

    vi.spyOn(db.links, 'where').mockReturnValue({
      first: async () => null
    } as any);

    const addLinkSpy = vi.spyOn(db.links, 'add').mockResolvedValue(501 as any);
    const addAuditSpy = vi.spyOn(db.auditLogs, 'add').mockResolvedValue(999);

    const action: AiAction = { action: 'create_link', from: 'Alpha', to: 'Beta' };
    const result = await executeAiAction(action, 1);

    expect(result.success).toBe(true);
    expect(addLinkSpy).toHaveBeenCalledWith({ sourceId: 101, targetId: 102 });
    expect(addAuditSpy).toHaveBeenCalled();
  });

  it('undoes create_note action cleanly by ID', async () => {
    const auditRecord = {
      id: 888,
      timestamp: 1000,
      actionType: 'create_note',
      targetTitle: 'Temporary Note',
      status: 'applied',
      details: JSON.stringify({ noteId: 300, wasCreated: true })
    };

    vi.spyOn(db.auditLogs, 'get').mockResolvedValue(auditRecord as any);
    const updateAuditSpy = vi.spyOn(db.auditLogs, 'update').mockResolvedValue(1);
    const deleteNoteSpy = vi.spyOn(db.notes, 'delete').mockResolvedValue();
    vi.spyOn(db.links, 'where').mockReturnValue({
      equals: () => ({
        toArray: async () => []
      }),
      delete: async () => 0
    } as any);

    const undoResult = await undoAiAction(888);

    expect(undoResult.success).toBe(true);
    expect(deleteNoteSpy).toHaveBeenCalledWith(300);
    expect(updateAuditSpy).toHaveBeenCalledWith(888, { status: 'restored' });
  });

  it('retrieves recent action history sorted by timestamp', async () => {
    const mockLogs = [
      { id: 1, timestamp: 100, actionType: 'create_note', targetTitle: 'Note 1' },
      { id: 2, timestamp: 500, actionType: 'edit_note', targetTitle: 'Note 2' },
      { id: 3, timestamp: 300, actionType: 'delete_note', targetTitle: 'Note 3' }
    ];

    vi.spyOn(db.auditLogs, 'toArray').mockResolvedValue(mockLogs as any);

    const history = await getAiActionHistory(2);
    expect(history.length).toBe(2);
    expect(history[0].id).toBe(2); // Newest first (ts: 500)
    expect(history[1].id).toBe(3); // Next (ts: 300)
  });
});
