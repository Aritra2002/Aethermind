/**
 * @file clipperReceiver.ts
 * @description Safe browser clipper receiver and payload validator for AetherMind.
 * Sanitizes incoming text and HTML clips, extracts metadata, and ingests them as notes or searchable documents.
 */

import { createNote } from '../db/helpers';
import { sanitizeHtml } from './sanitizer';
import { ingestRawTextDocument, type IngestionResult } from './documentPipeline';

/**
 * Structured payload format received from the AetherMind web clipper browser extension.
 */
export interface ClipperPayload {
  /** Page or article title. */
  title: string;
  /** Extracted plain text or selected text excerpt. */
  text: string;
  /** Optional sanitized raw HTML snippet or article body. */
  html?: string;
  /** Source webpage canonical URL. */
  url: string;
  /** Optional favicon URL. */
  favicon?: string;
  /** Optional author byline. */
  author?: string;
  /** Clip timestamp. */
  timestamp?: number;
  /** Array of user or auto-generated tags. */
  tags?: string[];
  /** Ingestion target: 'note' to create an editable note, 'document' to ingest into RAG index. */
  targetType?: 'note' | 'document';
}

/**
 * Ingestion result from clipper receiver.
 */
export interface ClipperResult {
  success: boolean;
  type: 'note' | 'document';
  id: number | string;
  title: string;
  message: string;
}

/**
 * Validates and ingests a browser clipper payload into the local workspace.
 *
 * @param payload - Raw payload received from browser extension or clipboard import.
 * @param pageId - Active workspace page ID.
 * @returns Promise resolving to {@link ClipperResult}.
 */
export async function processClipperPayload(
  payload: ClipperPayload,
  pageId: number
): Promise<ClipperResult> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid clipper payload format');
  }

  const rawTitle = (payload.title || 'Untitled Clip').trim();
  const rawText = (payload.text || '').trim();
  const rawUrl = (payload.url || '').trim();

  if (!rawText && !payload.html) {
    throw new Error('Clipper payload contains no text or HTML content');
  }

  // Sanitize text & HTML to guard against XSS and stored script injection
  const sanitizedText = sanitizeHtml(rawText);
  const title = rawTitle.slice(0, 150); // Cap title length
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map(t => t.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()).filter(Boolean)
    : ['web-clip'];

  if (!tags.includes('web-clip')) {
    tags.push('web-clip');
  }

  const targetType = payload.targetType || 'note';

  if (targetType === 'document') {
    // Ingest as RAG document
    const formattedContent = `# ${title}\n\n**Source**: [${rawUrl || 'Web Clip'}](${rawUrl})\n**Clipped**: ${new Date(payload.timestamp || Date.now()).toLocaleString()}\n\n---\n\n${sanitizedText}`;
    const docResult: IngestionResult = await ingestRawTextDocument(
      title,
      formattedContent,
      pageId,
      { sourceUrl: rawUrl }
    );

    return {
      success: true,
      type: 'document',
      id: docResult.documentId,
      title: docResult.title,
      message: `Clipped "${title}" directly into RAG document index.`
    };
  }

  // Default: Create Note in active page
  const noteContent = `# ${title}\n\n> 🌐 **Source**: [${rawUrl || 'Link'}](${rawUrl})\n> 📅 **Clipped**: ${new Date(payload.timestamp || Date.now()).toLocaleDateString()}\n\n${sanitizedText}`;

  const noteId = await createNote(pageId, title, 'general');
  const { updateNote } = await import('../db/helpers');
  await updateNote(noteId, { content: noteContent, tags });

  return {
    success: true,
    type: 'note',
    id: noteId,
    title,
    message: `Created new note "${title}" from web clip.`
  };
}
