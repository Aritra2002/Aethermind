/**
 * @file ask-ai-modal-reasoning.test.tsx
 * @description Renders AskAiModal in jsdom with the AI layer mocked and asserts
 * the F2 UX contract: a reasoning feed streams live, then collapses into an
 * inspectable "Model reasoning / reasoned m:ss" summary once visible content
 * starts, and expands again on click.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AskAiModal } from '../components/AskAiModal';

// --- module mocks (heavy/browser-only dependencies) ---
const callAIMock = vi.hoisted(() => vi.fn());

vi.mock('../utils/aiClient', () => ({
  callAI: callAIMock
}));

vi.mock('../utils/rag', () => ({
  searchHybridRag: vi.fn(async () => []),
  buildRagContextWithCitations: vi.fn(() => '')
}));

vi.mock('../utils/urlFetcher', () => ({
  fetchUrlContent: vi.fn(async () => null)
}));

vi.mock('../utils/aiActions', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../utils/aiActions')>();
  return {
    ...mod,
    executeAiAction: vi.fn(async () => ({ success: true, message: 'ok', auditLogId: 1 })),
    validateActionPreflight: vi.fn(async () => ({ blocked: false }))
  };
});

vi.mock('../components/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('../db', () => ({
  db: {
    notes: {
      where: () => ({ equalsIgnoreCase: () => ({ and: () => ({ first: async () => null }) }) })
    },
    links: {
      where: () => ({ equalsIgnoreCase: () => ({ and: () => ({ first: async () => null }) }) })
    },
    auditLogs: { add: async () => 1 }
  }
}));

vi.mock('../utils/cacheEngine', () => ({
  ragSearchCache: { getWithTtl: () => null, set: () => {} }
}));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('AskAiModal reasoning summary (F2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    callAIMock.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const renderModal = async () => {
    await act(async () => {
      root.render(
        <AskAiModal isOpen onClose={() => {}} activePageId={1} onJumpToNote={() => {}} />
      );
    });
    // component auto-focuses the input after 50ms
    await new Promise(r => setTimeout(r, 80));
  };

  const submitQuery = async () => {
    const input = container.querySelector('input[placeholder*="explore"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, 'What notes are in my graph?');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const send = container.querySelector('button[title="Send query"]') as HTMLButtonElement;
    await act(async () => {
      send.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('streams reasoning live, then collapses into an expandable "reasoned m:ss" summary', async () => {
    callAIMock.mockImplementation(
      async (_sys: string, _user: string, onStream?: (t: string, d?: string) => void, _sig?: unknown, _tmp?: unknown, onReasoning?: (t: string, d?: string) => void) => {
        // reasoning deltas arrive BEFORE any visible content
        onReasoning?.('Let me plan', 'Let me plan');
        onReasoning?.('Let me plan the answer.', ' the answer.');
        // then visible content streams
        onStream?.('Here are your notes: Welcome to AetherMind', 'Here are your notes: ');
        onStream?.('Here are your notes: Welcome to AetherMind, Interactive Graph', 'Welcome to AetherMind, Interactive Graph');
        return 'Here are your notes: Welcome to AetherMind, Interactive Graph';
      }
    );

    await renderModal();
    await submitQuery();
    // flush the async handler chain
    await act(async () => { await Promise.resolve(); });

    const text = () => container.textContent || '';

    // visible answer rendered
    expect(text()).toContain('Here are your notes');

    // reasoning header persisted with a frozen duration
    expect(text()).toContain('Model reasoning');
    expect(text()).toMatch(/reasoned 0:0\d/);

    // auto-collapsed once content started: raw reasoning text hidden
    expect(text()).not.toContain('Let me plan the answer.');

    // click header -> reasoning expands again
    const header = container.querySelector('button[aria-expanded="false"]') as HTMLButtonElement;
    expect(header).not.toBeNull();
    act(() => header.click());
    expect(text()).toContain('Let me plan the answer.');
  });

  it('shows the live "thinking…" counter while only reasoning has arrived', async () => {
    callAIMock.mockImplementation(
      async (_sys: string, _user: string, onStream?: (t: string, d?: string) => void, _sig?: unknown, _tmp?: unknown, onReasoning?: (t: string, d?: string) => void) => {
        onReasoning?.('Thinking step one', 'Thinking step one');
        // never call onStream: content never arrives in this scenario
        await new Promise(res => setTimeout(res, 50));
        return '';
      }
    );

    await renderModal();
    await submitQuery();
    await act(async () => { await Promise.resolve(); });

    const text = () => container.textContent || '';
    // live elapsed counter, still "thinking…" (not frozen "reasoned")
    expect(text()).toContain('Model reasoning');
    expect(text()).toMatch(/thinking… 0:0\d/);
    // reasoning visible while loading (expanded)
    expect(text()).toContain('Thinking step one');
  });
});