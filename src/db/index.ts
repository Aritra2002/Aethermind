/**
 * @file index.ts
 * @description IndexedDB database schema, migrations, and instance initialization for AetherMind.
 * Powered by Dexie.js, providing an offline-first, reactive client-side database
 * for managing workspace pages, notes, connections, categories, point-in-time snapshots,
 * and vector document chunks for Retrieval-Augmented Generation (RAG).
 */

import Dexie, { type Table } from 'dexie';

/**
 * Represents a workspace page (graph canvas) within AetherMind.
 * Pages serve as namespaces/canvases grouping related notes and links.
 */
export interface Page {
  /** Auto-incrementing primary key for the page. */
  id?: number;
  /** Display title of the page/graph workspace. */
  title: string;
  /** Unix epoch timestamp (in milliseconds) when the page was created. */
  createdAt: number;
}

/**
 * Represents an individual knowledge note in the graph.
 * Holds markdown content, metadata, visual node positioning coordinates,
 * flashcard/spaced-repetition metrics, and semantic vector embeddings.
 */
export interface Note {
  /** Auto-incrementing primary key for the note. */
  id?: number;
  /** Foreign key referencing the parent {@link Page} this note belongs to. */
  pageId: number;
  /** Unique title of the note (used for wiki-style `[[Note Title]]` links). */
  title: string;
  /** Full markdown content and body text of the note. */
  content: string;
  /** Array of tag labels associated with this note (indexed multi-entry). */
  tags: string[];
  /** Category identifier referencing {@link Category.id} (e.g., 'work', 'general'). */
  category: string;
  /** Optional custom hex color override for the note's node representation. */
  color?: string;
  /** Unix epoch timestamp (in milliseconds) when the note was created. */
  createdAt: number;
  /** Unix epoch timestamp (in milliseconds) when the note was last modified. */
  updatedAt: number;
  /** Fixed horizontal coordinate in D3 force-directed graph simulation (null if free). */
  fx?: number | null;
  /** Fixed vertical coordinate in D3 force-directed graph simulation (null if free). */
  fy?: number | null;
  /** D3 physics simulation velocity along the X axis. */
  vx?: number;
  /** D3 physics simulation velocity along the Y axis. */
  vy?: number;
  /** Array of IDs of other notes directly referenced or linked to this note. */
  linkedNoteIds?: number[];
  
  // Analytics & Flashcards (Spaced Repetition System / SuperMemo-2)
  /** Number of times the note has been viewed or opened. */
  visits?: number;
  /** Next scheduled review timestamp (in ms) for spaced repetition. */
  nextReview?: number;
  /** Current repetition interval in days for spaced repetition. */
  interval?: number;
  /** SuperMemo-2 ease factor reflecting recall difficulty (default 2.5). */
  ease?: number;
  
  // Semantic Search & AI
  /** High-dimensional vector embedding representing the note's semantic content. */
  embedding?: number[];

  // Rich Metadata & Lifecycle (Version 8)
  /** Unique stable UUID string for sync and deep linking. */
  uuid?: string;
  /** 1 if pinned/favorited, 0 otherwise (indexed number for Dexie boolean queries). */
  isFavorite?: number | boolean;
  /** 1 if archived, 0 otherwise. */
  isArchived?: number | boolean;
  /** 1 if moved to trash bin, 0 otherwise. */
  isTrash?: number | boolean;
  /** Unix epoch timestamp when the note was moved to trash. */
  trashDate?: number;
  /** Alternative alias titles for wiki-linking. */
  aliases?: string[];
  /** Original external source URL if imported from web or clipper. */
  sourceUrl?: string;
  /** Origin source category. */
  sourceType?: 'manual' | 'web-clipper' | 'pdf' | 'docx' | 'ai';
  /** Computed word count of note content. */
  wordCount?: number;
  /** Estimated reading time in minutes (assuming 200 wpm). */
  readingTime?: number;
  /** Short AI-generated or user summary of the note. */
  summary?: string;
}

/**
 * Audit log entry for tracking state changes executed by AI or user.
 */
export interface AuditLogEntry {
  /** Auto-incrementing primary key. */
  id?: number;
  /** Unix epoch timestamp when the action occurred. */
  timestamp: number;
  /** Action category (e.g. 'create_note', 'edit_note', 'delete_note', 'import_zip'). */
  actionType: string;
  /** Title or identifier of target entity. */
  targetTitle: string;
  /** Result status. */
  status: 'applied' | 'rejected' | 'failed' | 'restored';
  /** Human-readable details or diff summary. */
  details?: string;
  /** Optional error message if failed. */
  error?: string;
}

/**
 * Represents a directional or associative link between two notes in the graph.
 */
export interface Link {
  /** Auto-incrementing primary key for the link. */
  id?: number;
  /** Primary key ID of the source {@link Note}. */
  sourceId: number;
  /** Primary key ID of the target {@link Note}. */
  targetId: number;
  /** Optional AI-generated or user-provided explanation describing why these notes are connected. */
  explanation?: string;
}

/**
 * Represents a classification category used to group and color-code notes.
 */
export interface Category {
  /** Unique category identifier slug (e.g., 'work', 'general'). Primary key. */
  id: string;
  /** Human-readable display label for the category. */
  label: string;
  /** Hex color code associated with the category (e.g., '#7c3aed'). */
  color: string;
}

/**
 * Represents a point-in-time serialized snapshot of a graph workspace.
 * Used for version control, backup, and historical state restoration.
 */
export interface GraphSnapshot {
  /** Auto-incrementing primary key for the snapshot. */
  id?: number;
  /** Unix epoch timestamp (in milliseconds) when the snapshot was created. */
  timestamp: number;
  /** Primary key ID of the {@link Page} this snapshot belongs to. */
  pageId: number;
  /** JSON-serialized array of {@link Note} objects at snapshot time. */
  notesData: string;
  /** JSON-serialized array of {@link Link} objects at snapshot time. */
  linksData: string;
}

/**
 * Represents a chunk of text from an external ingested document or note,
 * augmented with vector embeddings for semantic search and RAG.
 */
export interface DocumentChunk {
  /** Auto-incrementing primary key for the chunk record. */
  id?: number;
  /** Unique identifier of the parent document (e.g., 'doc_171000_abc' or 'note_12'). */
  documentId: string;
  /** Original filename, note title, or source name. */
  documentName: string;
  /** Zero-based index of this chunk within the parent document. */
  chunkIndex: number;
  /** The plain text content slice of the chunk. */
  content: string;
  /** High-dimensional vector embedding for semantic similarity search. */
  embedding: number[];
  /** Arbitrary metadata dictionary associated with the chunk (e.g., totalChunks, type). */
  metadata: Record<string, unknown>;
  /** Unix epoch timestamp (in milliseconds) when the chunk was indexed. */
  createdAt: number;
}

/**
 * Dexie-backed IndexedDB database manager for AetherMind.
 * Manages database schemas, indices, version transitions, and migrations.
 */
export class AetherMindDB extends Dexie {
  /** Table containing workspace pages. */
  pages!: Table<Page, number>;
  /** Table containing knowledge notes. */
  notes!: Table<Note, number>;
  /** Table containing graph links connecting notes. */
  links!: Table<Link, number>;
  /** Table containing category definitions. */
  categories!: Table<Category, string>;
  /** Table containing historical graph snapshots. */
  snapshots!: Table<GraphSnapshot, number>;
  /** Table containing document chunks and embeddings for RAG. */
  documents!: Table<DocumentChunk, number>;
  /** Table containing historical audit logs. */
  auditLogs!: Table<AuditLogEntry, number>;

  /**
   * Initializes the IndexedDB database instance with all schema versions and migration rules.
   */
  constructor() {
    super('aether_mind_db');

    // Version 1: Initial schema for notes and links
    this.version(1).stores({
      notes: '++id, &title, *tags, category, createdAt, updatedAt',
      links: '++id, sourceId, targetId, [sourceId+targetId]'
    });

    // Version 2: Added categories lookup table
    this.version(2).stores({
      categories: 'id, label, color'
    });

    // Version 3: Added spaced repetition index (`nextReview`) to notes
    this.version(3).stores({
      notes: '++id, &title, *tags, category, createdAt, updatedAt, nextReview'
    });

    // Version 4: Multi-page workspace support (added pages table, pageId foreign key to notes)
    this.version(4).stores({
      pages: '++id, title',
      notes: '++id, pageId, title, *tags, category, createdAt, updatedAt, nextReview'
    }).upgrade(async tx => {
      // 1. Create a default "Graph" page for existing workspaces
      const defaultPageId = await tx.table('pages').add({
        title: 'Graph',
        createdAt: Date.now()
      });

      // 2. Migrate and assign all existing notes to this default page
      await tx.table('notes').toCollection().modify(note => {
        note.pageId = defaultPageId;
      });
    });

    // Version 5: Graph Snapshots table for versioning and restoration
    this.version(5).stores({
      snapshots: '++id, timestamp, pageId'
    });

    // Version 6: Added AI link explanations column to links table
    this.version(6).stores({
      links: '++id, sourceId, targetId, [sourceId+targetId], explanation'
    });

    // Version 7: Document chunks table for Retrieval-Augmented Generation (RAG)
    this.version(7).stores({
      documents: '++id, documentId, documentName, createdAt'
    });

    // Version 8: Note lifecycle states (isFavorite, isArchived, isTrash, uuid) and Audit Logs
    this.version(8).stores({
      notes: '++id, pageId, title, *tags, category, createdAt, updatedAt, nextReview, isFavorite, isArchived, isTrash, uuid',
      auditLogs: '++id, timestamp, actionType, targetTitle, status'
    }).upgrade(async tx => {
      await tx.table('notes').toCollection().modify((note: Partial<Note>) => {
        if (note.isFavorite === undefined) note.isFavorite = 0;
        if (note.isArchived === undefined) note.isArchived = 0;
        if (note.isTrash === undefined) note.isTrash = 0;
        if (!note.uuid) {
          note.uuid = 'note_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        }
        if (note.wordCount === undefined && note.content) {
          const words = note.content.trim().split(/\s+/).filter(Boolean).length;
          note.wordCount = words;
          note.readingTime = Math.ceil(words / 200);
        }
      });
    });
  }
}

/** Global singleton instance of {@link AetherMindDB}. */
export const db = new AetherMindDB();

export { notesRepository, type NoteFilterOptions } from './repositories/notesRepository';
export { linksRepository } from './repositories/linksRepository';
export { pagesRepository } from './repositories/pagesRepository';

