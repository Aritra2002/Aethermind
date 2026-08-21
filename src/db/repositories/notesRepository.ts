/**
 * @file notesRepository.ts
 * @description Type-safe repository abstraction for Knowledge Notes in Dexie IndexedDB.
 */

import { db, type Note } from '../index';

export interface NoteFilterOptions {
  pageId?: number;
  category?: string;
  tag?: string;
  searchQuery?: string;
  status?: 'active' | 'archived' | 'trash' | 'all';
  isFavorite?: boolean;
}

export class NotesRepository {
  /**
   * Computes word count and reading time metrics for text.
   */
  computeTextMetrics(content: string): { wordCount: number; readingTime: number } {
    if (!content || !content.trim()) {
      return { wordCount: 0, readingTime: 0 };
    }
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return {
      wordCount: words,
      readingTime: Math.max(1, Math.ceil(words / 200))
    };
  }

  /**
   * Generates a unique stable UUID for notes.
   */
  generateUuid(): string {
    return 'note_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }

  /**
   * Retrieves a note by primary key ID.
   */
  async getById(id: number): Promise<Note | undefined> {
    return db.notes.get(id);
  }

  /**
   * Retrieves a note by unique UUID.
   */
  async getByUuid(uuid: string): Promise<Note | undefined> {
    return db.notes.where('uuid').equals(uuid).first();
  }

  /**
   * Retrieves a note by title within a specific workspace page.
   */
  async getByTitle(title: string, pageId: number): Promise<Note | undefined> {
    return db.notes.where('title').equalsIgnoreCase(title.trim()).and(n => n.pageId === pageId).first();
  }

  /**
   * Queries notes based on filters.
   */
  async query(options: NoteFilterOptions = {}): Promise<Note[]> {
    let collection = db.notes.toCollection();

    if (options.pageId !== undefined) {
      collection = db.notes.where('pageId').equals(options.pageId);
    }

    let notes = await collection.toArray();

    if (options.status && options.status !== 'all') {
      if (options.status === 'active') {
        notes = notes.filter(n => Number(n.isTrash) !== 1 && Number(n.isArchived) !== 1);
      } else if (options.status === 'archived') {
        notes = notes.filter(n => Number(n.isArchived) === 1 && Number(n.isTrash) !== 1);
      } else if (options.status === 'trash') {
        notes = notes.filter(n => Number(n.isTrash) === 1);
      }
    }

    if (options.category) {
      notes = notes.filter(n => n.category === options.category);
    }

    if (options.tag) {
      notes = notes.filter(n => Array.isArray(n.tags) && n.tags.includes(options.tag!));
    }

    if (options.isFavorite !== undefined) {
      notes = notes.filter(n => (Number(n.isFavorite) === 1) === options.isFavorite);
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.toLowerCase().trim();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    return notes;
  }

  /**
   * Creates a new note record with computed metrics and unique UUID.
   */
  async create(noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<number> {
    const now = Date.now();
    const metrics = this.computeTextMetrics(noteData.content || '');
    
    const record: Note = {
      ...noteData,
      title: noteData.title.trim(),
      uuid: noteData.uuid || this.generateUuid(),
      wordCount: metrics.wordCount,
      readingTime: metrics.readingTime,
      isFavorite: noteData.isFavorite ? 1 : 0,
      isArchived: noteData.isArchived ? 1 : 0,
      isTrash: noteData.isTrash ? 1 : 0,
      createdAt: noteData.createdAt || now,
      updatedAt: noteData.updatedAt || now
    };

    return (await db.notes.add(record)) as number;
  }

  /**
   * Updates an existing note and refreshes text metrics if content was modified.
   */
  async update(id: number, updates: Partial<Note>): Promise<void> {
    const patch: Partial<Note> = {
      ...updates,
      updatedAt: Date.now()
    };

    if (updates.content !== undefined) {
      const metrics = this.computeTextMetrics(updates.content);
      patch.wordCount = metrics.wordCount;
      patch.readingTime = metrics.readingTime;
    }

    if (updates.isFavorite !== undefined) {
      patch.isFavorite = updates.isFavorite ? 1 : 0;
    }
    if (updates.isArchived !== undefined) {
      patch.isArchived = updates.isArchived ? 1 : 0;
    }
    if (updates.isTrash !== undefined) {
      patch.isTrash = updates.isTrash ? 1 : 0;
    }

    await db.notes.update(id, patch);
  }

  /**
   * Permanently deletes a note by ID.
   */
  async delete(id: number): Promise<void> {
    await db.notes.delete(id);
  }
}

export const notesRepository = new NotesRepository();
