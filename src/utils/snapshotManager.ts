/**
 * @file snapshotManager.ts
 * @description Point-in-time graph snapshot manager for AetherMind workspaces.
 * Facilitates saving, retrieving, deserializing, restoring, and deleting state snapshots
 * of notes and inter-note connection links for a specific page with full relational foreign-key integrity.
 */

import { db, type Note, type Link, type GraphSnapshot } from '../db';

/**
 * Creates and saves a new point-in-time snapshot of all notes and intra-page links for a given page.
 *
 * Serializes the notes and their associated links into JSON strings and inserts a new
 * record into the IndexedDB `snapshots` table.
 *
 * @param pageId - Primary key ID of the workspace page to snapshot.
 *
 * @returns A promise resolving to the auto-incremented primary key ID of the newly saved snapshot.
 */
export const saveSnapshot = async (pageId: number): Promise<number> => {
  // Query all notes belonging to the specified page
  const notes = await db.notes.where({ pageId }).toArray();
  const allLinks = await db.links.toArray();
  
  // Filter links to only include intra-page connections where both source and target notes exist on this page
  const currentNoteIds = new Set(notes.map(n => n.id!));
  const links = allLinks.filter(l => currentNoteIds.has(l.sourceId) && currentNoteIds.has(l.targetId));

  // Persist serialized snapshot record with current epoch timestamp
  const id = await db.snapshots.add({
    timestamp: Date.now(),
    pageId,
    notesData: JSON.stringify(notes),
    linksData: JSON.stringify(links),
  });

  return id as number;
};

/**
 * Retrieves all saved snapshots for a specific page, ordered chronologically in descending order (newest first).
 *
 * @param pageId - Primary key ID of the workspace page.
 *
 * @returns A promise resolving to an array of {@link GraphSnapshot} metadata records.
 */
export const getSnapshots = async (pageId: number): Promise<GraphSnapshot[]> => {
  const snapshots = await db.snapshots
    .where({ pageId })
    .sortBy('timestamp');
  return snapshots.reverse();
};

/**
 * Loads and deserializes note and link data from a stored snapshot record.
 *
 * @param snapshotId - Primary key ID of the snapshot to load.
 *
 * @returns A promise resolving to an object containing deserialized notes, links, and creation timestamp,
 *          or `null` if the snapshot record was not found.
 */
export const loadSnapshot = async (snapshotId: number): Promise<{ notes: Note[]; links: Link[]; timestamp: number } | null> => {
  const snapshot = await db.snapshots.get(snapshotId);
  if (!snapshot) return null;

  return {
    notes: JSON.parse(snapshot.notesData),
    links: JSON.parse(snapshot.linksData),
    timestamp: snapshot.timestamp,
  };
};

/**
 * Restores a workspace page to the exact state captured in a snapshot.
 * Runs atomically inside a Dexie read-write transaction:
 * 1. Purges existing notes and links associated with the page.
 * 2. Re-inserts historical notes, allocating fresh primary key IDs.
 * 3. Maps old note IDs to new note IDs via an ID translation lookup map (`idMap`).
 * 4. Re-creates links using the translated note IDs to preserve relational consistency.
 *
 * @param snapshotId - Primary key ID of the snapshot to restore.
 * @param pageId - Primary key ID of the destination workspace page.
 *
 * @throws {Error} If the specified snapshot record cannot be found.
 */
export const restoreSnapshot = async (snapshotId: number, pageId: number): Promise<void> => {
  const data = await loadSnapshot(snapshotId);
  if (!data) throw new Error('Snapshot not found');

  // Perform atomic replacement within a read-write transaction across notes and links tables
  await db.transaction('rw', [db.notes, db.links], async () => {
    // 1. Identify and remove all existing notes and links currently on this page
    const remainingNoteIds = (await db.notes.where({ pageId }).toArray()).map(n => n.id!);
    const allLinks = await db.links.toArray();
    const linksToDelete = allLinks.filter(l => remainingNoteIds.includes(l.sourceId) || remainingNoteIds.includes(l.targetId));
    await db.notes.where({ pageId }).delete();
    await db.links.bulkDelete(linksToDelete.map(l => l.id!));

    // 2. Re-insert notes with new IDs and build oldId -> newId mapping dictionary
    const idMap = new Map<number, number>();
    for (const note of data.notes) {
      const oldId = note.id!;
      const noteData = { ...note, pageId };
      delete (noteData as Record<string, unknown>).id;
      const newId = await db.notes.add(noteData);
      idMap.set(oldId, newId as number);
    }

    // 3. Re-create links using remapped source and target note IDs
    for (const link of data.links) {
      const newSourceId = idMap.get(link.sourceId);
      const newTargetId = idMap.get(link.targetId);
      if (!newSourceId || !newTargetId) continue;
      await db.links.add({
        sourceId: newSourceId,
        targetId: newTargetId,
      });
    }
  });
};

/**
 * Structural diff result between two snapshot states.
 */
export interface SnapshotDiff {
  addedNotes: Note[];
  removedNotes: Note[];
  modifiedNotes: {
    before: Note;
    after: Note;
    changedFields: string[];
  }[];
  addedLinksCount: number;
  removedLinksCount: number;
}

/**
 * Computes the difference between two snapshot datasets.
 * Matches notes by UUID (if present) or title.
 *
 * @param before - Base snapshot state
 * @param after - Target snapshot state
 * @returns Structured {@link SnapshotDiff} summary
 */
export function computeSnapshotDiff(
  before: { notes: Note[]; links: Link[] },
  after: { notes: Note[]; links: Link[] }
): SnapshotDiff {
  const getNoteKey = (n: Note) => n.uuid || n.title.toLowerCase().trim();

  const beforeMap = new Map<string, Note>();
  before.notes.forEach(n => beforeMap.set(getNoteKey(n), n));

  const afterMap = new Map<string, Note>();
  after.notes.forEach(n => afterMap.set(getNoteKey(n), n));

  const addedNotes: Note[] = [];
  const modifiedNotes: SnapshotDiff['modifiedNotes'] = [];

  for (const [key, afterNote] of afterMap.entries()) {
    const beforeNote = beforeMap.get(key);
    if (!beforeNote) {
      addedNotes.push(afterNote);
    } else {
      const changedFields: string[] = [];
      if (beforeNote.title !== afterNote.title) changedFields.push('title');
      if (beforeNote.content !== afterNote.content) changedFields.push('content');
      if (beforeNote.category !== afterNote.category) changedFields.push('category');
      if (JSON.stringify(beforeNote.tags) !== JSON.stringify(afterNote.tags)) changedFields.push('tags');
      if (beforeNote.color !== afterNote.color) changedFields.push('color');

      if (changedFields.length > 0) {
        modifiedNotes.push({
          before: beforeNote,
          after: afterNote,
          changedFields
        });
      }
    }
  }

  const removedNotes: Note[] = [];
  for (const [key, beforeNote] of beforeMap.entries()) {
    if (!afterMap.has(key)) {
      removedNotes.push(beforeNote);
    }
  }

  const beforeLinkCount = before.links.length;
  const afterLinkCount = after.links.length;

  return {
    addedNotes,
    removedNotes,
    modifiedNotes,
    addedLinksCount: Math.max(0, afterLinkCount - beforeLinkCount),
    removedLinksCount: Math.max(0, beforeLinkCount - afterLinkCount)
  };
}

/**
 * Deletes a saved snapshot record from IndexedDB.
 *
 * @param snapshotId - Primary key ID of the snapshot to delete.
 * @returns A promise that resolves when the snapshot is deleted.
 */
export const deleteSnapshot = async (snapshotId: number): Promise<void> => {
  await db.snapshots.delete(snapshotId);
};



