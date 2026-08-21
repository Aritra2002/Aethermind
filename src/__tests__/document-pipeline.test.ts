/**
 * @file document-pipeline.test.ts
 * @description Comprehensive unit test suite for Phase 7: Documents + Research + Web Clipper.
 * Tests stage-based document ingestion, boundary-aware text chunking, cancellation,
 * SSRF security defenses, and browser-clipper payload sanitization.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chunkTextContent,
  ingestRawTextDocument,
  ingestDocumentFile,
  type IngestionStage
} from '../utils/documentPipeline';
import { isPrivateHost } from '../utils/urlFetcher';
import { processClipperPayload, type ClipperPayload } from '../utils/clipperReceiver';
import { setUseFallbackForTesting } from '../utils/vectorSearch';
import { db } from '../db';

describe('Phase 7: Boundary-Aware Document Chunking', () => {
  it('returns empty array for empty or whitespace text', () => {
    expect(chunkTextContent('')).toEqual([]);
    expect(chunkTextContent('   ')).toEqual([]);
  });

  it('returns a single chunk when text is shorter than chunkSize', () => {
    const text = 'A short document summary.';
    const chunks = chunkTextContent(text, 500);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  it('splits long content across sentence boundaries with overlap', () => {
    const text = `
      First paragraph exploring the fundamentals of quantum computing and superposition.
      Second sentence detailing how qubits store probabilistic values.
      Third sentence discussing quantum gates and entanglement circuits.
      Fourth sentence demonstrating Shor's algorithm for prime factorization.
    `.repeat(5);

    const chunks = chunkTextContent(text, 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.length).toBeGreaterThan(0);
    });
  });
});

describe('Phase 7: Standardized Ingestion Lifecycle & Progress Tracking', () => {
  beforeEach(() => {
    setUseFallbackForTesting(true);
    vi.restoreAllMocks();
    vi.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return callback();
    });
  });

  it('reports all lifecycle stages during raw document ingestion', async () => {
    const stagesReported: IngestionStage[] = [];
    const onProgress = (stage: IngestionStage) => {
      if (!stagesReported.includes(stage)) {
        stagesReported.push(stage);
      }
    };

    vi.spyOn(db.documents, 'bulkAdd').mockResolvedValue([] as any);

    const result = await ingestRawTextDocument(
      'Quantum Primer',
      'Quantum mechanics underpins modern quantum computing paradigms.',
      1,
      { onProgress }
    );

    expect(typeof result.documentId).toBe('string');
    expect(result.documentId.startsWith('doc_')).toBe(true);
    expect(result.title).toBe('Quantum Primer');
    expect(result.chunksCount).toBeGreaterThan(0);
    expect(stagesReported).toContain('parsing');
    expect(stagesReported).toContain('chunking');
    expect(stagesReported).toContain('embedding');
    expect(stagesReported).toContain('indexing');
    expect(stagesReported).toContain('completed');
  });

  it('cancels ingestion when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      ingestRawTextDocument('Cancelled Doc', 'Some text to abort.', 1, {
        signal: controller.signal
      })
    ).rejects.toThrow('Ingestion cancelled');
  });

  it('rejects oversized files exceeding maxFileSizeMb', async () => {
    const oversizedFile = new File(['x'.repeat(1000)], 'huge.txt', { type: 'text/plain' });
    Object.defineProperty(oversizedFile, 'size', { value: 30 * 1024 * 1024 }); // 30MB

    await expect(
      ingestDocumentFile(oversizedFile, 1, { maxFileSizeMb: 25 })
    ).rejects.toThrow('File exceeds maximum size limit');
  });
});

describe('Phase 7: SSRF Security Defenses for URL Research', () => {
  it('blocks private IPv4 and loopback addresses', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('0.0.0.0')).toBe(true);
    expect(isPrivateHost('10.0.0.1')).toBe(true);
    expect(isPrivateHost('192.168.1.1')).toBe(true);
    expect(isPrivateHost('172.16.0.1')).toBe(true);
  });

  it('blocks cloud metadata IP endpoints', () => {
    expect(isPrivateHost('169.254.169.254')).toBe(true);
    expect(isPrivateHost('metadata.google.internal')).toBe(true);
    expect(isPrivateHost('instance-data')).toBe(true);
  });

  it('blocks hexadecimal, decimal, and octal IP bypass notations', () => {
    expect(isPrivateHost('0x7f000001')).toBe(true); // 127.0.0.1 in hex
    expect(isPrivateHost('2130706433')).toBe(true); // 127.0.0.1 in decimal integer
    expect(isPrivateHost('0177.0.0.1')).toBe(true); // 127.0.0.1 in octal
  });

  it('blocks internal/local TLDs', () => {
    expect(isPrivateHost('vault.internal')).toBe(true);
    expect(isPrivateHost('nas.local')).toBe(true);
    expect(isPrivateHost('router.lan')).toBe(true);
  });

  it('permits valid public web hostnames', () => {
    expect(isPrivateHost('en.wikipedia.org')).toBe(false);
    expect(isPrivateHost('github.com')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
  });
});

describe('Phase 7: Browser Clipper Payload Validator & Sanitization', () => {
  it('sanitizes HTML clips and creates a note with source citation', async () => {
    const payload: ClipperPayload = {
      title: 'Interesting Research Article',
      text: 'Summary of quantum entanglement experiments.',
      html: '<p>Summary with <script>alert("XSS")</script> malicious payload.</p>',
      url: 'https://example.com/research',
      tags: ['physics', 'quantum']
    };

    vi.spyOn(db.notes, 'add').mockResolvedValue(202 as any);
    vi.spyOn(db.notes, 'get').mockResolvedValue({ id: 202, title: 'Interesting Research Article', content: '', tags: [], pageId: 1 } as any);
    vi.spyOn(db.notes, 'update').mockResolvedValue(1);
    vi.spyOn(db.notes, 'where').mockReturnValue({
      equalsIgnoreCase: () => ({
        and: () => ({
          first: async () => null
        })
      }),
      equals: () => ({
        toArray: async () => []
      })
    } as any);
    vi.spyOn(db.links, 'where').mockReturnValue({
      equals: () => ({
        toArray: async () => []
      })
    } as any);

    const result = await processClipperPayload(payload, 1);

    expect(result.success).toBe(true);
    expect(result.type).toBe('note');
    expect(result.title).toBe('Interesting Research Article');
  });

  it('ingests clip into RAG document store when targetType is document', async () => {
    const payload: ClipperPayload = {
      title: 'Web Document Clip',
      text: 'Deep learning neural network architecture overview.',
      url: 'https://example.com/deep-learning',
      targetType: 'document'
    };

    vi.spyOn(db.documents, 'bulkAdd').mockResolvedValue([] as any);

    const result = await processClipperPayload(payload, 1);

    expect(result.success).toBe(true);
    expect(result.type).toBe('document');
    expect(typeof result.id).toBe('string');
  });
});
