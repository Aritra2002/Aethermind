/**
 * @file linksRepository.ts
 * @description Type-safe repository abstraction for Graph Links in Dexie IndexedDB.
 */

import { db, type Link } from '../index';

export class LinksRepository {
  /**
   * Retrieves all links in the database.
   */
  async getAll(): Promise<Link[]> {
    return db.links.toArray();
  }

  /**
   * Retrieves links for a given page by checking whether both source and target notes exist on that page.
   */
  async getByPage(pageId: number): Promise<Link[]> {
    const pageNotes = await db.notes.where('pageId').equals(pageId).toArray();
    const validNoteIds = new Set(pageNotes.map(n => n.id!));
    const allLinks = await db.links.toArray();
    return allLinks.filter(l => validNoteIds.has(l.sourceId) && validNoteIds.has(l.targetId));
  }

  /**
   * Retrieves all incoming and outgoing links for a specific note.
   */
  async getByNote(noteId: number): Promise<Link[]> {
    const sourceLinks = await db.links.where('sourceId').equals(noteId).toArray();
    const targetLinks = await db.links.where('targetId').equals(noteId).toArray();
    return [...sourceLinks, ...targetLinks];
  }

  /**
   * Creates a directional link between two notes if one does not already exist.
   */
  async create(sourceId: number, targetId: number, explanation?: string): Promise<number | null> {
    if (sourceId === targetId) return null; // No self-loops

    const existing = await db.links
      .where('[sourceId+targetId]')
      .equals([sourceId, targetId])
      .first();

    if (existing) return existing.id || null;

    const id = await db.links.add({
      sourceId,
      targetId,
      explanation
    });

    return id as number;
  }

  /**
   * Deletes a link by ID.
   */
  async delete(id: number): Promise<void> {
    await db.links.delete(id);
  }

  /**
   * Deletes links connecting a specific pair of notes.
   */
  async deleteByPair(sourceId: number, targetId: number): Promise<number> {
    const links = await db.links
      .filter(l => (l.sourceId === sourceId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === sourceId))
      .toArray();

    const ids = links.map(l => l.id!);
    if (ids.length > 0) {
      await db.links.bulkDelete(ids);
    }
    return ids.length;
  }

  /**
   * Finds and deletes orphan links whose source or target notes no longer exist.
   */
  async cleanOrphanLinks(): Promise<number> {
    const allNotes = await db.notes.toArray();
    const noteIds = new Set(allNotes.map(n => n.id!));
    const allLinks = await db.links.toArray();

    const orphanLinkIds = allLinks
      .filter(l => !noteIds.has(l.sourceId) || !noteIds.has(l.targetId))
      .map(l => l.id!);

    if (orphanLinkIds.length > 0) {
      await db.links.bulkDelete(orphanLinkIds);
    }

    return orphanLinkIds.length;
  }
}

export const linksRepository = new LinksRepository();
