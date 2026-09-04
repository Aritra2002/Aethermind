// @vitest-environment jsdom
/**
 * @file clipper-handoff.test.ts
 * @description Unit tests for the web clipper smart-tab handoff bridge:
 * `#clip=` hash parsing, message-origin guarding, ack protocol, and size caps.
 * The receiver itself (processClipperPayload) is mocked here — its sanitization
 * behavior is covered by document-pipeline.test.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseHashClip,
  handleClipMessage,
  ingestClip,
  MAX_HASH_CLIP_BYTES,
  CLIPPER_MESSAGE_SOURCE,
  CLIPPER_ACK_SOURCE
} from '../utils/clipperHandoff';
import { processClipperPayload } from '../utils/clipperReceiver';

vi.mock('../utils/clipperReceiver', () => ({
  processClipperPayload: vi.fn()
}));

const mockProcess = vi.mocked(processClipperPayload);

/** Base64url encoder matching the extension popup (UTF-8 safe). */
const toBase64Url = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const samplePayload = {
  title: 'Research Article',
  text: 'Body text of the article.',
  url: 'https://example.com/research',
  tags: ['web-clip'],
  targetType: 'note'
};

describe('clipperHandoff — #clip= hash parsing', () => {
  it('round-trips a valid base64url JSON payload', () => {
    const encoded = toBase64Url(JSON.stringify(samplePayload));
    const parsed = parseHashClip('#clip=' + encoded);
    expect(parsed).toEqual(samplePayload);
  });

  it('accepts html-only payloads (no text)', () => {
    const htmlPayload = { title: 'Clip', html: '<p>Article</p>', url: 'https://example.com' };
    const parsed = parseHashClip('#clip=' + toBase64Url(JSON.stringify(htmlPayload)));
    expect(parsed).toEqual(htmlPayload);
  });

  it('rejects non-clip and empty hashes', () => {
    expect(parseHashClip('')).toBeNull();
    expect(parseHashClip('#other=123')).toBeNull();
    expect(parseHashClip('#clip=')).toBeNull();
  });

  it('rejects malformed base64', () => {
    expect(parseHashClip('#clip=!!!not-base64!!!')).toBeNull();
  });

  it('rejects invalid JSON', () => {
    expect(parseHashClip('#clip=' + toBase64Url('not json'))).toBeNull();
  });

  it('rejects payloads missing required fields', () => {
    expect(parseHashClip('#clip=' + toBase64Url(JSON.stringify({})))).toBeNull();
    expect(parseHashClip('#clip=' + toBase64Url(JSON.stringify({ title: '', text: 'x' })))).toBeNull();
    expect(parseHashClip('#clip=' + toBase64Url(JSON.stringify({ title: 'T', text: '   ' })))).toBeNull();
  });

  it('rejects hashes exceeding the size cap', () => {
    const oversized = '#clip=' + 'a'.repeat(MAX_HASH_CLIP_BYTES + 1);
    expect(parseHashClip(oversized)).toBeNull();
  });
});

describe('clipperHandoff — postMessage handoff', () => {
  beforeEach(() => {
    mockProcess.mockReset();
  });

  it('ignores messages from foreign origins', () => {
    const event = new MessageEvent('message', {
      data: { source: CLIPPER_MESSAGE_SOURCE, payload: samplePayload },
      origin: 'https://evil.example'
    });
    handleClipMessage(event, 1);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('ignores messages with the wrong source marker', () => {
    const event = new MessageEvent('message', {
      data: { source: 'some-other-extension', payload: samplePayload },
      origin: window.location.origin
    });
    handleClipMessage(event, 1);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('ingests a valid payload from the app origin and acks success', async () => {
    mockProcess.mockResolvedValue({
      success: true,
      type: 'note',
      id: 7,
      title: 'Research Article',
      message: 'Created new note "Research Article" from web clip.'
    } as any);

    const ackPromise = new Promise<{ ok: boolean; message: string }>((resolve) => {
      const onAck = (e: MessageEvent) => {
        const d = e.data;
        if (d && d.source === CLIPPER_ACK_SOURCE) {
          window.removeEventListener('message', onAck);
          resolve(d);
        }
      };
      window.addEventListener('message', onAck);
    });

    const onResult = vi.fn();
    handleClipMessage(
      new MessageEvent('message', {
        data: { source: CLIPPER_MESSAGE_SOURCE, payload: samplePayload },
        origin: window.location.origin
      }),
      1,
      onResult
    );

    const ack = await ackPromise;
    expect(ack.ok).toBe(true);
    expect(ack.message).toContain('Created new note');
    expect(mockProcess).toHaveBeenCalledWith(samplePayload, 1);
    await new Promise(r => setTimeout(r, 0));
    expect(onResult).toHaveBeenCalledWith({ ok: true, message: expect.stringContaining('Created new note') });
  });

  it('acks failure when ingestion throws', async () => {
    mockProcess.mockRejectedValue(new Error('Clipper payload contains no text or HTML content'));

    const ackPromise = new Promise<{ ok: boolean; message: string }>((resolve) => {
      const onAck = (e: MessageEvent) => {
        const d = e.data;
        if (d && d.source === CLIPPER_ACK_SOURCE) {
          window.removeEventListener('message', onAck);
          resolve(d);
        }
      };
      window.addEventListener('message', onAck);
    });

    const onResult = vi.fn();
    handleClipMessage(
      new MessageEvent('message', {
        data: { source: CLIPPER_MESSAGE_SOURCE, payload: samplePayload },
        origin: window.location.origin
      }),
      1,
      onResult
    );

    const ack = await ackPromise;
    expect(ack.ok).toBe(false);
    expect(ack.message).toContain('no text or HTML');
    await new Promise(r => setTimeout(r, 0));
    expect(onResult).toHaveBeenCalledWith({ ok: false, message: expect.stringContaining('no text or HTML') });
  });

  it('ingestClip passes the payload and page through to the receiver', async () => {
    mockProcess.mockResolvedValue({ success: true, type: 'note', id: 9, title: 'T', message: 'ok' } as any);
    const result = await ingestClip(samplePayload, 5);
    expect(mockProcess).toHaveBeenCalledWith(samplePayload, 5);
    expect(result.id).toBe(9);
  });
});