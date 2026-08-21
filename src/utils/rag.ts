/**
 * @file rag.ts
 * @description Client-side Retrieval-Augmented Generation (RAG) pipeline for AetherMind.
 * Implements sliding-window semantic text chunking with natural boundary detection,
 * vector embedding generation, IndexedDB storage, atomic note synchronization,
 * cosine-similarity semantic retrieval, document catalog management, and prompt context synthesis.
 */

import { db, type DocumentChunk } from '../db';
import { generateEmbedding, cosineSimilarity } from './vectorSearch';
import { tokenizeText, scoreBM25Note } from './search/bm25';

/**
 * Splits a long text document into smaller, overlapping segments suitable for embedding and retrieval.
 * Prioritizes natural text boundaries (double newlines, single newlines, sentence periods, and spaces)
 * within a trailing search window to avoid cutting words or thoughts mid-sentence.
 *
 * @param text - The raw source text string to chunk.
 * @param chunkSize - Maximum target character length per chunk (default: 1000).
 * @param overlap - Number of characters to overlap between consecutive chunks (default: 200).
 *
 * @returns An array of trimmed plain text chunk strings.
 */
export const chunkText = (text: string, chunkSize: number = 1000, overlap: number = 200): string[] => {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    // If the remaining text is within chunkSize, take the remainder and complete
    if (end >= text.length) {
      chunks.push(text.slice(start).trim());
      break;
    }

    // Inspect the last 300 characters of the window to find a natural break point
    const searchArea = text.slice(Math.max(start, end - 300), end);
    let breakIdx = searchArea.lastIndexOf('\n\n');
    if (breakIdx === -1) breakIdx = searchArea.lastIndexOf('\n');
    if (breakIdx === -1) breakIdx = searchArea.lastIndexOf('. ');
    if (breakIdx === -1) breakIdx = searchArea.lastIndexOf(' ');

    // Adjust the end index if a natural separator is located
    if (breakIdx !== -1) {
      end = Math.max(start, end - 300) + breakIdx + 1;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    
    // Advance starting position accounting for the overlapping character window
    start = end - overlap;
  }

  return chunks;
};

/**
 * Generates a unique document identifier incorporating a timestamp and random alphanumeric suffix.
 *
 * @returns A unique document identifier string (e.g., `doc_1710000000_abc1234`).
 */
const generateDocId = (): string => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * Ingests an external document into the local RAG vector store.
 * Chunks the text content, computes vector embeddings for each chunk, and bulk-inserts
 * the records into IndexedDB.
 *
 * @param name - Human-readable display name or filename of the document.
 * @param content - Full text body of the document.
 * @param metadata - Optional key-value metadata to attach to all chunks (e.g., author, source URL).
 * @param onProgress - Optional callback invoked with status messages during processing.
 *
 * @returns A promise resolving to an object with the generated `documentId` and total `chunkCount`.
 */
export const ingestDocument = async (
  name: string,
  content: string,
  metadata: Record<string, unknown> = {},
  onProgress?: (msg: string) => void
): Promise<{ documentId: string; chunkCount: number }> => {
  const documentId = generateDocId();
  const chunks = chunkText(content);

  if (onProgress) onProgress(`Embedding ${chunks.length} chunks...`);

  const chunkDocs: Omit<DocumentChunk, 'id'>[] = [];

  // Compute vector embeddings sequentially for each text segment
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(`Embedding chunk ${i + 1}/${chunks.length}...`);
    const embedding = await generateEmbedding(chunks[i]);
    chunkDocs.push({
      documentId,
      documentName: name,
      chunkIndex: i,
      content: chunks[i],
      embedding,
      metadata: { ...metadata, totalChunks: chunks.length },
      createdAt: Date.now(),
    });
  }

  // Bulk-insert the newly created chunks into IndexedDB
  await db.documents.bulkAdd(chunkDocs as DocumentChunk[]);

  if (onProgress) onProgress(`Ingested ${chunks.length} chunks from "${name}"`);
  return { documentId, chunkCount: chunks.length };
};

/**
 * Synchronizes an internal note into the RAG document store for unified semantic querying.
 * Pre-computes embeddings outside the database transaction, then atomically replaces any
 * previous chunks belonging to the note.
 *
 * @param noteId - Primary key ID of the note.
 * @param title - Current title of the note.
 * @param content - Current markdown content body of the note.
 *
 * @returns A promise that resolves when the note is indexed.
 */
export const ingestNote = async (noteId: number, title: string, content: string): Promise<void> => {
  if (!content.trim()) return;

  const text = `${title}\n\n${content}`;
  const chunks = chunkText(text, 800, 150);

  const chunkDocs: Omit<DocumentChunk, 'id'>[] = [];

  // Embed all chunks first before acquiring a database write lock
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    chunkDocs.push({
      documentId: `note_${noteId}`,
      documentName: `[Note] ${title}`,
      chunkIndex: i,
      content: chunks[i],
      embedding,
      metadata: { type: 'note', noteId },
      createdAt: Date.now(),
    });
  }

  // Atomically replace old chunks with new ones within a read-write transaction
  await db.transaction('rw', db.documents, async () => {
    await db.documents.where('documentId').equals(`note_${noteId}`).delete();
    await db.documents.bulkAdd(chunkDocs as DocumentChunk[]);
  });
};

/**
 * Removes all indexed RAG chunks associated with a specific note ID.
 *
 * @param noteId - Primary key ID of the note to de-index.
 *
 * @returns A promise that resolves when note chunks are deleted.
 */
export const removeNoteFromRag = async (noteId: number): Promise<void> => {
  await db.documents.where('documentId').equals(`note_${noteId}`).delete();
};

/**
 * Executes a semantic similarity search across all stored document and note chunks.
 * Generates an embedding for the search query and calculates cosine similarity scores
 * against every indexed chunk.
 *
 * @param query - The user search query or question text.
 * @param limit - Maximum number of top matching chunks to return (default: 5).
 *
 * @returns A promise resolving to an array of matching {@link DocumentChunk} items sorted by descending score.
 */
export const searchDocuments = async (
  query: string,
  limit: number = 5
): Promise<Array<DocumentChunk & { score: number }>> => {
  const queryEmbedding = await generateEmbedding(query);
  const chunks = await db.documents.toArray();

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Lists all distinct documents in the RAG store with aggregated chunk counts and creation dates.
 *
 * @returns A promise resolving to a list of unique document descriptors sorted by newest first.
 */
export const listDocuments = async (): Promise<{ documentId: string; documentName: string; chunkCount: number; createdAt: number }[]> => {
  const chunks = await db.documents.toArray();
  const docMap = new Map<string, { documentId: string; documentName: string; chunkCount: number; createdAt: number }>();

  // Aggregate chunk counts per document identifier
  for (const chunk of chunks) {
    const existing = docMap.get(chunk.documentId);
    if (existing) {
      existing.chunkCount++;
    } else {
      docMap.set(chunk.documentId, {
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        chunkCount: 1,
        createdAt: chunk.createdAt,
      });
    }
  }

  return Array.from(docMap.values()).sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Deletes an entire document and all of its constituent indexed chunks from the RAG store.
 *
 * @param documentId - Unique identifier of the document to remove.
 *
 * @returns A promise resolving to the total number of deleted chunk records.
 */
export const deleteDocument = async (documentId: string): Promise<number> => {
  return await db.documents.where('documentId').equals(documentId).delete();
};

/**
 * Structured citation representing an evidence snippet used in RAG generation.
 */
export interface RagCitation {
  /** 1-based citation reference index for referencing in answers like [1]. */
  index: number;
  /** Unique document identifier. */
  sourceId: string;
  /** Human-readable document or note title. */
  sourceName: string;
  /** Zero-based chunk slice index within parent document. */
  chunkIndex: number;
  /** Extracted excerpt text snippet. */
  content: string;
  /** Combined relevance score between 0.0 and 1.0. */
  score: number;
  /** Whether the source is an existing workspace note. */
  isNote: boolean;
  /** Foreign key note ID if isNote is true. */
  noteId?: number;
}

/**
 * Searches stored document chunks and notes using hybrid dense vector + BM25 keyword ranking.
 *
 * @param query - Search query text
 * @param limit - Maximum number of citations to return (default: 5)
 * @param typeFilter - Optional filter by source type ('all' | 'notes' | 'documents')
 * @returns Ranked array of {@link RagCitation} objects.
 */
export const searchHybridRag = async (
  query: string,
  limit: number = 5,
  typeFilter: 'all' | 'notes' | 'documents' = 'all'
): Promise<RagCitation[]> => {
  const queryTrimmed = query.trim();
  if (!queryTrimmed) return [];

  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(queryTrimmed);
  } catch (e) {
    console.warn('RAG embedding failed, using BM25 lexical fallback:', e);
  }

  let chunks = await db.documents.toArray();

  if (typeFilter === 'notes') {
    chunks = chunks.filter(c => c.metadata?.type === 'note');
  } else if (typeFilter === 'documents') {
    chunks = chunks.filter(c => c.metadata?.type !== 'note');
  }

  if (chunks.length === 0) return [];

  const queryTokens = tokenizeText(queryTrimmed, true);
  const avgDocLength = chunks.reduce((acc, c) => acc + (c.content?.length || 0), 0) / chunks.length;

  const scored = chunks.map(chunk => {
    const vectorScore = queryEmbedding && chunk.embedding
      ? Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding))
      : 0;

    const bm25Result = scoreBM25Note(
      queryTokens,
      {
        title: chunk.documentName,
        content: chunk.content
      },
      avgDocLength
    );

    // Hybrid blend: 60% semantic + 40% BM25 lexical
    const finalScore = queryEmbedding
      ? Math.min(1.0, 0.6 * vectorScore + 0.4 * bm25Result.score)
      : bm25Result.score;

    const isNote = chunk.metadata?.type === 'note';
    const noteId = typeof chunk.metadata?.noteId === 'number' ? chunk.metadata.noteId : undefined;

    return {
      sourceId: chunk.documentId,
      sourceName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: finalScore,
      isNote,
      noteId
    };
  });

  const topResults = scored
    .filter(item => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return topResults.map((item, idx) => ({
    ...item,
    index: idx + 1
  }));
};

/**
 * Formats an array of scored semantic search results into an annotated context string
 * suitable for inclusion in an LLM prompt.
 *
 * @param results - Array of {@link DocumentChunk} items with similarity scores.
 *
 * @returns A formatted string containing labeled source sections separated by dividers.
 */
export const buildRagContext = (results: Array<DocumentChunk & { score: number }>): string => {
  if (results.length === 0) return '';

  return results
    .map((r, i) => `[Source ${i + 1}: "${r.documentName}" (score: ${r.score.toFixed(3)})]\n${r.content}`)
    .join('\n\n---\n\n');
};

/**
 * Formats structured RAG citations into an unambiguous LLM prompt context block.
 *
 * @param citations - Array of {@link RagCitation} records
 * @returns Guarded prompt context string with numbered citations.
 */
export const buildRagContextWithCitations = (citations: RagCitation[]): string => {
  if (citations.length === 0) return '';

  return citations
    .map(c => `[Citation ${c.index}: "${c.sourceName}" (Score: ${(c.score * 100).toFixed(0)}%)]\n${c.content}`)
    .join('\n\n---\n\n');
};

