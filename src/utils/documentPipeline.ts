/**
 * @file documentPipeline.ts
 * @description Standardized stage-based document ingestion and indexing pipeline for AetherMind.
 * Enforces the strict lifecycle: upload → extract → parse → chunk → embed → index → complete.
 * Supports PDF, Markdown, text, and web clips with real-time progress callbacks and cancellation.
 */

import { db, type DocumentChunk } from '../db';
import { extractTextFromPDF } from './pdf';
import { generateEmbedding } from './vectorSearch';
import { sanitizeHtml } from './sanitizer';

/**
 * Standardized lifecycle stages for document ingestion.
 */
export type IngestionStage =
  | 'uploading'
  | 'extracting'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'error';

/**
 * Real-time progress callback signature.
 */
export type IngestionProgressCallback = (
  stage: IngestionStage,
  progress: number,
  message?: string
) => void;

/**
 * Configuration options for document ingestion.
 */
export interface IngestionOptions {
  /** Optional callback for tracking stage-by-stage progress. */
  onProgress?: IngestionProgressCallback;
  /** Optional AbortSignal to cancel pending ingestion operations. */
  signal?: AbortSignal;
  /** Maximum allowable file size in megabytes (default: 25MB). */
  maxFileSizeMb?: number;
  /** Custom document title override. */
  customTitle?: string;
  /** Original web URL source if ingested from online research. */
  sourceUrl?: string;
}

/**
 * Ingestion result payload returned upon successful completion.
 */
export interface IngestionResult {
  documentId: string;
  title: string;
  fileType: string;
  fileSize: number;
  chunksCount: number;
  totalCharacters: number;
}

/**
 * Splits normalized text into overlapping chunks respecting sentence and paragraph boundaries.
 *
 * @param text - Plain text to chunk.
 * @param chunkSize - Maximum character length per chunk (default: 500).
 * @param overlap - Character overlap between consecutive chunks (default: 100).
 * @returns Array of text chunk strings.
 */
export function chunkTextContent(
  text: string,
  chunkSize: number = 500,
  overlap: number = 100
): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < clean.length) {
      // Find sentence or paragraph boundary near endIndex
      const slice = clean.substring(startIndex, endIndex);
      const lastNewline = slice.lastIndexOf('\n');
      const lastPeriod = slice.lastIndexOf('. ');
      const lastQuestion = slice.lastIndexOf('? ');
      const lastExclamation = slice.lastIndexOf('! ');

      const boundary = Math.max(lastNewline, lastPeriod, lastQuestion, lastExclamation);
      if (boundary > chunkSize * 0.5) {
        endIndex = startIndex + boundary + 1;
      }
    } else {
      endIndex = clean.length;
    }

    const chunk = clean.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = endIndex - overlap;
    if (startIndex >= clean.length || endIndex >= clean.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Ingests an uploaded File (PDF, Markdown, TXT) through the full stage lifecycle into IndexedDB.
 *
 * @param file - The browser File object to ingest.
 * @param pageId - Primary key ID of the target workspace page.
 * @param options - Ingestion options including progress handler and cancellation signal.
 * @returns Promise resolving to {@link IngestionResult}.
 */
export async function ingestDocumentFile(
  file: File,
  pageId: number,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const {
    onProgress,
    signal,
    maxFileSizeMb = 25,
    customTitle,
    sourceUrl
  } = options;

  const notify = (stage: IngestionStage, progress: number, message?: string) => {
    if (onProgress) onProgress(stage, progress, message);
  };

  try {
    // 1. UPLOAD & VALIDATE STAGE
    notify('uploading', 10, `Validating ${file.name}...`);
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    const maxSizeBytes = maxFileSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error(`File exceeds maximum size limit of ${maxFileSizeMb}MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
    }

    const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const supportedTypes = ['pdf', 'md', 'txt', 'json', 'csv', 'html'];
    if (!supportedTypes.includes(fileType)) {
      throw new Error(`Unsupported file type ".${fileType}". Supported: ${supportedTypes.join(', ')}`);
    }

    // 2. EXTRACT STAGE
    notify('extracting', 25, `Extracting text content from ${file.name}...`);
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    let extractedText = '';
    if (fileType === 'pdf') {
      extractedText = await extractTextFromPDF(file);
    } else {
      extractedText = await file.text();
    }

    if (!extractedText || !extractedText.trim()) {
      throw new Error(`Extracted text from "${file.name}" is empty.`);
    }

    // 3. PARSE STAGE
    notify('parsing', 40, 'Parsing and sanitizing document content...');
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    const sanitizedContent = sanitizeHtml(extractedText.replace(/\r\n/g, '\n')).trim();
    const title = customTitle || file.name.replace(/\.[^/.]+$/, '');

    // 4. CHUNK STAGE
    notify('chunking', 55, 'Generating boundary-aware text chunks...');
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    const chunks = chunkTextContent(sanitizedContent, 500, 100);
    if (chunks.length === 0) {
      throw new Error('No valid text chunks generated from document.');
    }

    // 5. EMBED STAGE
    notify('embedding', 70, `Generating embeddings for ${chunks.length} chunks...`);
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    const embeddedChunks: Array<{ text: string; embedding: number[] }> = [];
    for (let i = 0; i < chunks.length; i++) {
      if (signal?.aborted) throw new Error('Ingestion cancelled');

      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      embeddedChunks.push({ text: chunk, embedding });

      const embedProgress = 70 + Math.round(((i + 1) / chunks.length) * 20);
      notify('embedding', embedProgress, `Embedding chunk ${i + 1}/${chunks.length}...`);
    }

    // 6. INDEX STAGE
    notify('indexing', 95, 'Storing document and chunks in local database...');
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const chunkRecords: Array<Omit<DocumentChunk, 'id'>> = embeddedChunks.map((ec, index) => ({
      documentId,
      documentName: title,
      chunkIndex: index,
      content: ec.text,
      embedding: ec.embedding,
      metadata: {
        pageId,
        fileType,
        sourceUrl: sourceUrl || undefined,
        totalChunks: chunks.length,
        fileSize: file.size
      },
      createdAt: Date.now()
    }));

    await db.documents.bulkAdd(chunkRecords as DocumentChunk[]);

    // 7. COMPLETE STAGE
    notify('completed', 100, `Successfully ingested "${title}" with ${chunks.length} chunks.`);

    return {
      documentId,
      title,
      fileType,
      fileSize: file.size,
      chunksCount: chunks.length,
      totalCharacters: sanitizedContent.length
    };
  } catch (error) {
    notify('error', 0, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Ingests raw text or web research articles directly through the pipeline.
 *
 * @param title - Headline title of the research note/document.
 * @param content - Plain text or Markdown content.
 * @param pageId - Target page ID.
 * @param options - Ingestion options.
 * @returns Promise resolving to {@link IngestionResult}.
 */
export async function ingestRawTextDocument(
  title: string,
  content: string,
  pageId: number,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const { onProgress, signal, sourceUrl } = options;

  const notify = (stage: IngestionStage, progress: number, message?: string) => {
    if (onProgress) onProgress(stage, progress, message);
  };

  try {
    notify('parsing', 20, `Parsing content for "${title}"...`);
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    const sanitizedContent = sanitizeHtml(content.replace(/\r\n/g, '\n')).trim();
    if (!sanitizedContent) throw new Error('Content cannot be empty');

    notify('chunking', 40, 'Generating boundary-aware text chunks...');
    if (signal?.aborted) throw new Error('Ingestion cancelled');

    const chunks = chunkTextContent(sanitizedContent, 500, 100);

    notify('embedding', 60, `Generating embeddings for ${chunks.length} chunks...`);
    const embeddedChunks: Array<{ text: string; embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i++) {
      if (signal?.aborted) throw new Error('Ingestion cancelled');
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      embeddedChunks.push({ text: chunk, embedding });
    }

    notify('indexing', 90, 'Storing document in local database...');
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const chunkRecords: Array<Omit<DocumentChunk, 'id'>> = embeddedChunks.map((ec, index) => ({
      documentId,
      documentName: title,
      chunkIndex: index,
      content: ec.text,
      embedding: ec.embedding,
      metadata: {
        pageId,
        fileType: 'md',
        sourceUrl: sourceUrl || undefined,
        totalChunks: chunks.length,
        fileSize: new Blob([sanitizedContent]).size
      },
      createdAt: Date.now()
    }));

    await db.documents.bulkAdd(chunkRecords as DocumentChunk[]);

    notify('completed', 100, `Successfully ingested "${title}" with ${chunks.length} chunks.`);

    return {
      documentId,
      title,
      fileType: 'md',
      fileSize: new Blob([sanitizedContent]).size,
      chunksCount: chunks.length,
      totalCharacters: sanitizedContent.length
    };
  } catch (error) {
    notify('error', 0, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
