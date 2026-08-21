/**
 * @file vaultImport.ts
 * @description Safe vault import engine with schema validation, collision handling,
 * foreign-key ID remapping, automatic safety rollback snapshotting, and atomic transactions.
 */

import { db, type Note, type Page } from '../db';
import type { ValidatedBackup } from './backupValidation';
import { createSafetySnapshot } from './backupValidation';
import { restoreSnapshot } from './snapshotManager';

/**
 * Result payload returned after executing a vault import.
 */
export interface ImportResult {
  success: boolean;
  mode: 'merge' | 'replace';
  importedNotesCount: number;
  importedLinksCount: number;
  importedPagesCount: number;
  safetySnapshotId: number;
  message: string;
}

/**
 * Imports a validated backup payload into the database with atomic transaction safety.
 *
 * @param backup - Validated backup payload.
 * @param mode - 'replace' to wipe and overwrite existing vault, 'merge' to integrate into current vault safely.
 * @returns Promise resolving to {@link ImportResult}.
 */
export async function importVaultPayload(
  backup: ValidatedBackup,
  mode: 'merge' | 'replace' = 'merge'
): Promise<ImportResult> {
  // 1. Always create an emergency pre-import safety snapshot before any mutation
  const safetySnapshotId = await createSafetySnapshot();

  try {
    let importedNotesCount = 0;
    let importedLinksCount = 0;
    let importedPagesCount = 0;

    if (mode === 'replace') {
      // REPLACE MODE: Atomic wipe and fresh restore
      await db.transaction('rw', [db.notes, db.links, db.categories, db.pages, db.snapshots], async () => {
        await db.notes.clear();
        await db.links.clear();
        await db.categories.clear();
        await db.pages.clear();

        // 1. Restore categories
        for (const cat of backup.categories) {
          await db.categories.put(cat);
        }

        // 2. Restore pages and map oldPageId -> newPageId
        const pageIdMap = new Map<number, number>();
        for (const page of backup.pages) {
          const oldPageId = page.id || 1;
          const pageData: Page = { title: page.title, createdAt: page.createdAt };
          const newPageId = await db.pages.add(pageData);
          pageIdMap.set(oldPageId, newPageId);
          importedPagesCount++;
        }

        // 3. Restore notes and map oldNoteId -> newNoteId
        const noteIdMap = new Map<number, number>();
        for (const note of backup.notes) {
          const oldNoteId = note.id!;
          const targetPageId = pageIdMap.get(note.pageId) || (backup.pages[0]?.id ? pageIdMap.get(backup.pages[0].id) : 1) || 1;

          const noteData: Note = {
            ...note,
            pageId: targetPageId
          };
          delete noteData.id;

          const newNoteId = await db.notes.add(noteData);
          noteIdMap.set(oldNoteId, newNoteId);
          importedNotesCount++;
        }

        // 4. Restore links using remapped note IDs
        for (const link of backup.links) {
          const newSourceId = noteIdMap.get(link.sourceId);
          const newTargetId = noteIdMap.get(link.targetId);

          if (newSourceId && newTargetId && newSourceId !== newTargetId) {
            await db.links.add({
              sourceId: newSourceId,
              targetId: newTargetId,
              explanation: link.explanation
            });
            importedLinksCount++;
          }
        }
      });

      return {
        success: true,
        mode: 'replace',
        importedNotesCount,
        importedLinksCount,
        importedPagesCount,
        safetySnapshotId,
        message: `Successfully restored ${importedNotesCount} notes and ${importedLinksCount} links.`
      };
    }

    // MERGE MODE: Integrate into existing vault without overwriting
    await db.transaction('rw', [db.notes, db.links, db.categories, db.pages], async () => {
      // 1. Merge categories
      for (const cat of backup.categories) {
        const existingCat = await db.categories.get(cat.id);
        if (!existingCat) {
          await db.categories.add(cat);
        }
      }

      // 2. Merge pages
      const pageIdMap = new Map<number, number>();
      const existingPages = await db.pages.toArray();
      const existingPageMap = new Map<string, number>(existingPages.map(p => [p.title.toLowerCase(), p.id!]));

      for (const page of backup.pages) {
        const oldPageId = page.id || 1;
        const normalizedTitle = page.title.toLowerCase();

        if (existingPageMap.has(normalizedTitle)) {
          pageIdMap.set(oldPageId, existingPageMap.get(normalizedTitle)!);
        } else {
          const newPageId = await db.pages.add({ title: page.title, createdAt: page.createdAt });
          pageIdMap.set(oldPageId, newPageId);
          existingPageMap.set(normalizedTitle, newPageId);
          importedPagesCount++;
        }
      }

      // Fallback page ID
      const defaultPageId = existingPages[0]?.id || 1;

      // 3. Merge notes with title collision resolution
      const noteIdMap = new Map<number, number>();

      for (const note of backup.notes) {
        const oldNoteId = note.id!;
        const targetPageId = pageIdMap.get(note.pageId) || defaultPageId;

        // Check for existing note with identical title on the same page
        const existingNote = await db.notes
          .where('title')
          .equalsIgnoreCase(note.title)
          .and(n => n.pageId === targetPageId)
          .first();

        let finalTitle = note.title;
        if (existingNote) {
          finalTitle = `${note.title} (Imported)`;
        }

        const noteData: Note = {
          ...note,
          title: finalTitle,
          pageId: targetPageId
        };
        delete noteData.id;

        const newNoteId = await db.notes.add(noteData);
        noteIdMap.set(oldNoteId, newNoteId);
        importedNotesCount++;
      }

      // 4. Merge links using remapped IDs
      for (const link of backup.links) {
        const newSourceId = noteIdMap.get(link.sourceId);
        const newTargetId = noteIdMap.get(link.targetId);

        if (newSourceId && newTargetId && newSourceId !== newTargetId) {
          // Check if identical link already exists
          const existingLink = await db.links
            .where({ sourceId: newSourceId, targetId: newTargetId })
            .first();

          if (!existingLink) {
            await db.links.add({
              sourceId: newSourceId,
              targetId: newTargetId,
              explanation: link.explanation
            });
            importedLinksCount++;
          }
        }
      }
    });

    return {
      success: true,
      mode: 'merge',
      importedNotesCount,
      importedLinksCount,
      importedPagesCount,
      safetySnapshotId,
      message: `Merged ${importedNotesCount} notes and ${importedLinksCount} links into vault.`
    };
  } catch (error) {
    throw new Error(`Import failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

/**
 * Reverts the database state to an emergency pre-import safety snapshot.
 *
 * @param safetySnapshotId - Primary key ID of the safety snapshot.
 * @param pageId - Target workspace page ID.
 */
export async function rollbackToSafetySnapshot(safetySnapshotId: number, pageId: number = 1): Promise<void> {
  await restoreSnapshot(safetySnapshotId, pageId);
}
