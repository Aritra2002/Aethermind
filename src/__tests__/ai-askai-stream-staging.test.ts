/**
 * @file ai-askai-stream-staging.test.ts
 * @description Regression coverage for the Ask-AI streaming + action-staging
 * pipeline, mirroring the qa_bot mock-SSE scenarios (qa_bot/_f2_mock.py) and the
 * format drift observed from the local Qwen3 model during QA:
 *
 * 1. F2: `reasoning_content` deltas stream through the OpenAI-compatible
 *    adapter's `onReasoning` callback while visible `content` stays separate —
 *    this powers the Ask AI modal's live "Thinking…" reasoning feed.
 * 2. F3: action JSON arrives in three shapes (```json-fenced, embedded in prose
 *    without fences, and pure JSON with no explanation). `parseAiResponse` must
 *    stage all of them so the confirm card + Apply flow can run.
 *
 * These replay canned SSE streams through the REAL adapter code (fetch mocked),
 * so they run on every `npm test` without a model or browser.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAIAdapter } from '../utils/ai/adapters/openai';
import { parseAiResponse } from '../utils/aiActions';
import type { AIConfig, AIRequestOptions } from '../utils/ai/types';

/** Builds one `data: {...}\n\n` SSE event (OpenAI chat-completion chunk). */
const sse = (delta?: string, reasoning?: string): string => {
  const d: Record<string, string> = {};
  if (delta !== undefined) d.content = delta;
  if (reasoning !== undefined) d.reasoning_content = reasoning;
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: d, finish_reason: null }] })}\n\n`;
};

const sseDone = 'data: [DONE]\n\n';

/** Returns a mock fetch Response that streams the given SSE events. */
function streamResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const ev of events) controller.enqueue(encoder.encode(ev));
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  });
}

const CONFIG: AIConfig = {
  provider: 'custom',
  baseUrl: 'http://local.test/v1',
  apiKey: '',
  model: 'mock-model',
  clientSpoof: 'none'
};

describe('Ask-AI streaming pipeline (F2: reasoning surfaced before content)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('streams reasoning_content via onReasoning and returns only visible content', async () => {
    const reasoningParts = ['Let me plan', ' the note structure', ' and its content.'];
    const contentParts = ['Here is the note:\n\n```json\n', '[{"action":"create_note","title":"X"}]', '\n```'];
    const events = [
      ...reasoningParts.map(r => sse(undefined, r)),
      ...contentParts.map(c => sse(c)),
      sseDone
    ];

    const fetchMock = vi.fn(async () => streamResponse(events));
    global.fetch = fetchMock as any;

    const receivedReasoning: string[] = [];
    const receivedContent: string[] = [];
    const adapter = new OpenAIAdapter();
    const options: AIRequestOptions = {
      systemPrompt: 'sys',
      userPrompt: 'user',
      onReasoning: (acc) => receivedReasoning.push(acc),
      onStream: (acc) => receivedContent.push(acc)
    };

    const result = await adapter.call(CONFIG, options);

    // The adapter forwards reasoning deltas as they accumulate (the modal's
    // live "Thinking…" feed) and never mixes them into visible content.
    expect(receivedReasoning).toHaveLength(3);
    expect(receivedReasoning[receivedReasoning.length - 1]).toBe(reasoningParts.join(''));
    expect(receivedContent[receivedContent.length - 1]).toBe(contentParts.join(''));
    expect(result).toBe(contentParts.join(''));
    expect(result).not.toContain('Let me plan');

    // Request went to the resolved /chat/completions endpoint
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toBe('http://local.test/v1/chat/completions');
  });

  it('does not call onReasoning when the stream has no reasoning deltas', async () => {
    const events = [sse('plain answer'), sseDone];
    global.fetch = vi.fn(async () => streamResponse(events)) as any;

    const onReasoning = vi.fn();
    const adapter = new OpenAIAdapter();
    await adapter.call(CONFIG, {
      systemPrompt: 'sys',
      userPrompt: 'user',
      onReasoning,
      onStream: () => {}
    });

    expect(onReasoning).not.toHaveBeenCalled();
  });
});

describe('Ask-AI action staging (F3: parser accepts every model output shape)', () => {
  // The three real shapes observed from the local Qwen3 model during QA.
  it('stages a ```json-fenced action block', () => {
    const raw = `Here is the created note:\n\n\`\`\`json\n[{ "action": "create_note", "title": "Mock Milestone A", "content": "# Mock Milestone A\\n\\nCreated during deterministic mock testing.", "tags": ["mock"] }]\n\`\`\`\n\nI have created the note **Mock Milestone A** for you.`;
    const parsed = parseAiResponse(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.actions).toHaveLength(1);
    expect(parsed?.actions[0].action).toBe('create_note');
    expect(parsed?.actions[0].title).toBe('Mock Milestone A');
    expect(parsed?.explanation).toContain('I have created the note');
  });

  it('stages an action array embedded in prose WITHOUT fences (format drift)', () => {
    const raw = 'Sure! Here is the action payload: [ { "action": "create_note", "title": "Mock Milestone B", "content": "Body B from unfenced JSON.", "tags": ["mock"] } ] and I have created that note for you.';
    const parsed = parseAiResponse(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.actions).toHaveLength(1);
    expect(parsed?.actions[0].title).toBe('Mock Milestone B');
    // JSON payload is stripped from the user-facing explanation
    expect(parsed?.explanation).toContain('I have created that note');
    expect(parsed?.explanation).not.toContain('"action"');
  });

  it('stages a pure JSON payload with no explanation prose', () => {
    const raw = '```json\n[{ "action": "create_note", "title": "Mock Milestone C", "content": "Body C pure json.", "tags": ["mock"] }]\n```';
    const parsed = parseAiResponse(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.actions).toHaveLength(1);
    expect(parsed?.actions[0].title).toBe('Mock Milestone C');
    expect(parsed?.explanation.trim()).toBe('');
  });

  it('rejects prose that merely mentions "action" with no real payload', () => {
    const raw = 'The action you requested cannot be performed because no notes match.';
    expect(parseAiResponse(raw)).toBeNull();
  });

  it('keeps the rich streamed content free of reasoning when staging later', async () => {
    // Full round trip: adapter stream -> parse (fenced), as handleAskAi does.
    const raw = 'Done:\n\n```json\n[{ "action": "edit_note", "title": "Local AI Milestone", "newContent": "Updated body" }]\n```\nEdited.';
    const events = [
      sse(undefined, 'I will edit the note content.'),
      sse(raw),
      sseDone
    ];
    global.fetch = vi.fn(async () => streamResponse(events)) as any;

    const receivedContent: string[] = [];
    const adapter = new OpenAIAdapter();
    const text = await adapter.call(CONFIG, {
      systemPrompt: 'sys',
      userPrompt: 'user',
      onStream: (acc) => receivedContent.push(acc)
    });

    const parsed = parseAiResponse(text);
    expect(parsed?.actions[0].action).toBe('edit_note');
    expect(parsed?.actions[0].title).toBe('Local AI Milestone');
    expect(text).not.toContain('I will edit');
  });
});
