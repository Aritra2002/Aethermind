/**
 * @file ai-actions-safety.test.ts
 * @description Unit tests for AI action risk classification, JSON parsing, diff computation, and preflight guards.
 */

import { describe, it, expect } from 'vitest';
import {
  getActionRiskLevel,
  parseAiResponse,
  extractJsonCandidate,
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

  it('parses an action array embedded in prose WITHOUT markdown fences (format drift)', () => {
    // Real-world sample: a local quantized model dropped the ```json fences and
    // wrote the array inline in a sentence. Previously this returned null and the
    // action was never staged.
    const rawAiText = `Here is the created note: { "action": "create_note", "title": "Local AI Milestone", "content": "Created by the local AI during QA testing. It should connect concepts about knowledge graphs and local-first software.", "tags": ["qa-ai"] } I've created the note "Local AI Milestone" with the requested content.`;

    const parsed = parseAiResponse(rawAiText);
    expect(parsed).not.toBeNull();
    expect(parsed?.actions.length).toBe(1);
    expect(parsed?.actions[0].action).toBe('create_note');
    expect(parsed?.actions[0].title).toBe('Local AI Milestone');
    expect(parsed?.actions[0].tags).toEqual(['qa-ai']);
    // The JSON payload is stripped out of the user-facing explanation
    expect(parsed?.explanation).toContain('I\'ve created the note');
    expect(parsed?.explanation).not.toContain('"action"');
  });

  it('extracts a tags/links JSON object embedded in prose (editor Auto-Tag path)', () => {
    // Model buried the strict JSON the Auto-Tag prompt asked for inside a sentence.
    const raw = 'Here are my suggestions: {\n  "tags": ["qa", "local-first"],\n  "links": ["Interactive Graph"]\n} Hope that helps!';
    const candidate = extractJsonCandidate(raw, '"tags"');
    expect(candidate).not.toBeNull();
    const obj = JSON.parse(candidate as string) as { tags: string[]; links: string[] };
    expect(obj.tags).toEqual(['qa', 'local-first']);
    expect(obj.links).toEqual(['Interactive Graph']);
  });

  it('returns null when the key is only mentioned in prose', () => {
    expect(extractJsonCandidate('The tags feature is disabled for this note.', '"tags"')).toBeNull();
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
