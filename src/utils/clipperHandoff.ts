/**
 * @file clipperHandoff.ts
 * @description Bridges the AetherMind web clipper browser extension to the app.
 *
 * Two delivery channels are supported (see web-clipper/popup.js):
 *  1. postMessage handoff — the extension injects a content script into the
 *     already-open AetherMind tab which posts { source: 'aethermind-clipper', payload }
 *     to the page; this module ingests the payload and replies with an ack
 *     { source: 'aethermind-clip-ack', ok, message }.
 *  2. URL hash deep link — when no app tab is open the extension opens
 *     <appUrl>#clip=<base64url JSON>; this module parses the hash on load /
 *     hashchange, ingests the clip, and strips the hash so reloads do not
 *     re-ingest the same clip.
 *
 * All payloads flow through `processClipperPayload` (sanitizer + validator),
 * so untrusted extension/clipboard content never reaches the graph unsanitized.
 */

import { processClipperPayload, type ClipperPayload, type ClipperResult } from './clipperReceiver';

/** Maximum encoded clip size accepted via the URL hash (safe under common URL limits). */
export const MAX_HASH_CLIP_BYTES = 64 * 1024;

/** Message identifiers shared with the web clipper extension (web-clipper/popup.js). */
export const CLIPPER_MESSAGE_SOURCE = 'aethermind-clipper';
export const CLIPPER_ACK_SOURCE = 'aethermind-clip-ack';

/** Uniform result surface used for both delivery channels and toasts. */
export interface ClipHandoffResult {
  ok: boolean;
  message: string;
}

/**
 * Decodes a base64url-encoded UTF-8 string (as produced by the extension popup).
 *
 * @param input - Base64url payload without padding
 * @returns Decoded string
 */
const base64UrlDecode = (input: string): string => {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/**
 * Parses a `#clip=<base64url JSON>` hash fragment into a validated clipper payload.
 *
 * @param hash - Full location.hash value (e.g. `#clip=eyJ0aXRsZSI6...`)
 * @returns Parsed payload, or null when the hash is absent/malformed/oversized
 */
export const parseHashClip = (hash: string): ClipperPayload | null => {
  if (!hash || !hash.startsWith('#clip=')) return null;
  const raw = hash.slice('#clip='.length);
  if (!raw || raw.length > MAX_HASH_CLIP_BYTES) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const payload = parsed as Partial<ClipperPayload>;
    if (typeof payload.title !== 'string' || !payload.title.trim()) return null;
    if (typeof payload.text !== 'string' || !payload.text.trim()) {
      if (typeof payload.html !== 'string' || !payload.html.trim()) return null;
    }
    return payload as ClipperPayload;
  } catch {
    return null;
  }
};

/**
 * Ingests a validated clipper payload into the active workspace page.
 * Thin wrapper around the existing receiver (sanitization + note/document creation).
 *
 * @param payload - Validated clip payload
 * @param pageId - Active workspace page ID
 * @returns Promise resolving to the ingestion result
 */
export const ingestClip = (payload: ClipperPayload, pageId: number): Promise<ClipperResult> =>
  processClipperPayload(payload, pageId);

/**
 * Handles `message` events originating from the extension's injected content script.
 * Ignores anything that is not a clipper payload from this document's own origin,
 * ingests the clip, and replies with an ack so the extension can show the outcome.
 *
 * @param event - Raw window message event
 * @param pageId - Active workspace page ID
 * @param onResult - Optional callback with the ack result (for toasts etc.)
 */
export const handleClipMessage = (
  event: MessageEvent,
  pageId: number,
  onResult?: (result: ClipHandoffResult) => void
): void => {
  const data = event.data;
  if (!data || typeof data !== 'object' || data.source !== CLIPPER_MESSAGE_SOURCE) return;
  // Only accept messages from this document's own origin (isolated content-script world shares it)
  if (event.origin !== window.location.origin) return;
  const payload = data.payload as ClipperPayload | undefined;
  if (!payload || typeof payload !== 'object') return;

  void ingestClip(payload, pageId)
    .then(result => {
      const ack: ClipHandoffResult = { ok: true, message: result.message };
      window.postMessage({ source: CLIPPER_ACK_SOURCE, ...ack }, window.location.origin);
      onResult?.(ack);
    })
    .catch(err => {
      const ack: ClipHandoffResult = {
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to ingest clip'
      };
      window.postMessage({ source: CLIPPER_ACK_SOURCE, ...ack }, window.location.origin);
      onResult?.(ack);
    });
};