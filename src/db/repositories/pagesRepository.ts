/**
 * @file pagesRepository.ts
 * @description Type-safe repository abstraction for Workspace Pages in Dexie IndexedDB.
 */

import { db, type Page } from '../index';
import { removeNoteFromRag } from '../../utils/rag';

export class PagesRepository {
  /**
   * Retrieves all workspace pages ordered by creation time.
   */
  async getAll(): Promise<Page[]> {
    return db.pages.orderBy('createdAt').toArray();
  }

  /**
   * Retrieves a page by primary key ID.
   */
  async getById(id: number): Promise<Page | undefined> {
    return db.pages.get(id);
  }

  /**
   * Creates a new workspace page.
   */
  async create(title: string): Promise<number> {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error('Page title cannot be empty');

    const id = await db.pages.add({
      title: cleanTitle,
      createdAt: Date.now()
    });

    return id as number;
  }

  /**
   * Renames a workspace page.
   */
  async rename(id: number, newTitle: string): Promise<void> {
    const cleanTitle = newTitle.trim();
    if (!cleanTitle) throw new Error('Page title cannot be empty');
    await db.pages.update(id, { title: cleanTitle });
  }

  /**
   * Deletes a page and executes a clean cascading purge of all associated notes, links, RAG vectors, and snapshots.
   */
  async deleteWithCascade(pageId: number): Promise<{ deletedNotes: number; deletedLinks: number; deletedSnapshots: number }> {
    const pageNotes = await db.notes.where('pageId').equals(pageId).toArray();
    const noteIds = pageNotes.map(n => n.id!);

    let deletedLinksCount = 0;
    let deletedSnapshotsCount = 0;

    await db.transaction('rw', [db.pages, db.notes, db.links, db.snapshots], async () => {
      // 1. Delete page
      await db.pages.delete(pageId);

      // 2. Delete child notes
      await db.notes.where('pageId').equals(pageId).delete();

      // 3. Delete links connecting these notes
      if (noteIds.length > 0) {
        const allLinks = await db.links.toArray();
        const noteIdSet = new Set(noteIds);
        const linksToDelete = allLinks.filter(l => noteIdSet.has(l.sourceId) || noteIdSet.has(l.targetId));
        deletedLinksCount = linksToDelete.length;
        if (deletedLinksCount > 0) {
          await db.links.bulkDelete(linksToDelete.map(l => l.id!));
        }
      }

      // 4. Delete snapshots for this page
      const snapshots = await db.snapshots.where('pageId').equals(pageId).toArray();
      deletedSnapshotsCount = snapshots.length;
      if (deletedSnapshotsCount > 0) {
        await db.snapshots.where('pageId').equals(pageId).delete();
      }
    });

    // Clean up RAG vectors in background
    for (const noteId of noteIds) {
      removeNoteFromRag(noteId).catch(err => console.warn('RAG purge failed during page cascade:', err));
    }

    return {
      deletedNotes: noteIds.length,
      deletedLinks: deletedLinksCount,
      deletedSnapshots: deletedSnapshotsCount
    };
  }
}

export const pagesRepository = new PagesRepository();
