/**
 * @file ai-actions-safety.test.ts
 * @description Unit tests for AI action risk classification, JSON parsing, diff computation, and preflight guards.
 */

import { describe, it, expect } from 'vitest';
import {
  getActionRiskLevel,
  parseAiResponse,
  generateActionDiff,
  validateActionPreflight,
  type AiAction
} from '../utils/aiActions';

describe('AI Action Safety & Risk Classification', () => {
  it('correctly classifies action risk levels', () => {
    expect(getActionRiskLevel({ action: 'create_link', from: 'A', to: 'B' })).toBe('LOW_RISK_WRITE');
    expect(getActionRiskLevel({ action: 'create_note', title: 'New Note', content: 'Body' })).toBe('HIGH_RISK_WRITE');
    expect(getActionRiskLevel({ action: 'edit_note', title: 'Old Note', newContent: 'Updated Body' })).toBe('HIGH_RISK_WRITE');
    expect(getActionRiskLevel({ action: 'delete_link', from: 'A', to: 'B' })).toBe('HIGH_RISK_WRITE');
    expect(getActionRiskLevel({ action: 'delete_note', title: 'Target Note' })).toBe('DESTRUCTIVE');
  });

  it('parses markdown-fenced and bare JSON AI action blocks safely', () => {
    const rawAiText = `I have analyzed your request and created these notes:
\`\`\`json
[
  { "action": "create_note", "title": "Quantum Physics", "content": "Study of quanta", "tags": ["physics"] },
  { "action": "create_link", "from": "Quantum Physics", "to": "Thermodynamics" }
]
\`\`\`
Let me know if you want any edits.`;

    const parsed = parseAiResponse(rawAiText);
    expect(parsed).not.toBeNull();
    expect(parsed?.actions.length).toBe(2);
    expect(parsed?.actions[0].action).toBe('create_note');
    expect(parsed?.actions[1].action).toBe('create_link');
    expect(parsed?.explanation).toContain('I have analyzed your request');
  });

  it('computes accurate before/after diffs with risk classification', () => {
    const action: AiAction = {
      action: 'edit_note',
      title: 'Machine Learning',
      newTitle: 'Deep Learning',
      newContent: 'Advanced neural networks explanation.'
    };

    const existingNote = {
      title: 'Machine Learning',
      content: 'Basic ML concepts.',
      tags: ['ai']
    };

    const diff = generateActionDiff(action, existingNote);
    expect(diff.riskLevel).toBe('HIGH_RISK_WRITE');
    expect(diff.targetTitle).toBe('Machine Learning');
    expect(diff.changes.length).toBe(2); // title modify + content modify
    expect(diff.changes.some(c => c.field === 'title' && c.to === 'Deep Learning')).toBe(true);
  });

  it('rejects destructive preflight edits if new content is empty', async () => {
    const emptyEditAction: AiAction = {
      action: 'edit_note',
      title: 'Some Note',
      newContent: '   '
    };

    const preflight = await validateActionPreflight(emptyEditAction, 1);
    expect(preflight.blocked).toBe(true);
    expect(preflight.message).toContain('cannot be empty');
  });
});
