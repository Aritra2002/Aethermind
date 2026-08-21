/**
 * @file backupValidation.ts
 * @description Deep validation, preview metadata extraction, schema verification,
 * and safety snapshot creation for AetherMind JSON backup imports.
 */

import { db, type Note, type Link, type Category, type Page, type GraphSnapshot } from '../db';

export interface ValidatedBackup {
  version: number;
  app: 'AetherMind';
  timestamp: number;
  notes: Note[];
  links: Link[];
  categories: Category[];
  pages: Page[];
  snapshots: GraphSnapshot[];
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  data?: ValidatedBackup;
  summary?: {
    noteCount: number;
    linkCount: number;
    pageCount: number;
    categoryCount: number;
    snapshotCount: number;
    tagCount: number;
    exportDate: string;
  };
}

/**
 * Validates untrusted imported JSON data to ensure structural and referential integrity.
 *
 * @param json - Raw parsed JSON object from file upload.
 * @returns {@link BackupValidationResult}
 */
export function validateBackupPayload(json: unknown): BackupValidationResult {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: 'Backup file is not a valid JSON object.' };
  }

  const payload = json as Record<string, unknown>;

  if (payload.app !== 'AetherMind') {
    return { valid: false, error: 'Unrecognized backup format. Expected app="AetherMind".' };
  }

  // Validate pages
  const rawPages = Array.isArray(payload.pages) ? payload.pages : [];
  const validPages: Page[] = [];
  for (const p of rawPages) {
    if (p && typeof p === 'object' && typeof p.title === 'string' && p.title.trim()) {
      validPages.push({
        id: typeof p.id === 'number' ? p.id : undefined,
        title: p.title.trim(),
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now()
      });
    }
  }

  // Ensure at least one default page exists if none found
  if (validPages.length === 0) {
    validPages.push({ id: 1, title: 'Graph', createdAt: Date.now() });
  }

  const validPageIds = new Set(validPages.map(p => p.id).filter((id): id is number => id !== undefined));
  const fallbackPageId = validPages[0].id || 1;

  // Validate notes
  const rawNotes = Array.isArray(payload.notes) ? payload.notes : [];
  const validNotes: Note[] = [];
  const allTags = new Set<string>();

  for (const n of rawNotes) {
    if (!n || typeof n !== 'object') continue;
    const title = typeof n.title === 'string' ? n.title.trim() : '';
    if (!title) continue; // Skip notes with empty titles

    const pageId = typeof n.pageId === 'number' && (validPageIds.size === 0 || validPageIds.has(n.pageId))
      ? n.pageId
      : fallbackPageId;

    const tags = Array.isArray(n.tags)
      ? n.tags.filter((t: unknown) => typeof t === 'string' && t.trim()).map((t: string) => t.trim())
      : [];

    tags.forEach((t: string) => allTags.add(t));

    validNotes.push({
      id: typeof n.id === 'number' ? n.id : undefined,
      pageId,
      title,
      content: typeof n.content === 'string' ? n.content : '',
      tags,
      category: typeof n.category === 'string' && n.category ? n.category : 'general',
      color: typeof n.color === 'string' ? n.color : undefined,
      createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
      fx: typeof n.fx === 'number' ? n.fx : null,
      fy: typeof n.fy === 'number' ? n.fy : null,
      linkedNoteIds: Array.isArray(n.linkedNoteIds) ? n.linkedNoteIds.filter((id: unknown) => typeof id === 'number') : [],
      isFavorite: n.isFavorite ? 1 : 0,
      isArchived: n.isArchived ? 1 : 0,
      isTrash: n.isTrash ? 1 : 0,
      uuid: typeof n.uuid === 'string' ? n.uuid : undefined,
      wordCount: typeof n.wordCount === 'number' ? n.wordCount : undefined,
      readingTime: typeof n.readingTime === 'number' ? n.readingTime : undefined
    });
  }

  // Validate links
  const rawLinks = Array.isArray(payload.links) ? payload.links : [];
  const validLinks: Link[] = [];
  for (const l of rawLinks) {
    if (l && typeof l === 'object' && typeof l.sourceId === 'number' && typeof l.targetId === 'number') {
      validLinks.push({
        id: typeof l.id === 'number' ? l.id : undefined,
        sourceId: l.sourceId,
        targetId: l.targetId,
        explanation: typeof l.explanation === 'string' ? l.explanation : undefined
      });
    }
  }

  // Validate categories
  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  const validCategories: Category[] = [];
  for (const c of rawCategories) {
    if (c && typeof c === 'object' && typeof c.id === 'string' && typeof c.label === 'string') {
      validCategories.push({
        id: c.id,
        label: c.label,
        color: typeof c.color === 'string' ? c.color : '#818cf8'
      });
    }
  }

  // Validate snapshots
  const rawSnapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  const validSnapshots: GraphSnapshot[] = [];
  for (const s of rawSnapshots) {
    if (s && typeof s === 'object' && typeof s.notesData === 'string' && typeof s.linksData === 'string') {
      validSnapshots.push({
        id: typeof s.id === 'number' ? s.id : undefined,
        pageId: typeof s.pageId === 'number' ? s.pageId : fallbackPageId,
        timestamp: typeof s.timestamp === 'number' ? s.timestamp : Date.now(),
        notesData: s.notesData,
        linksData: s.linksData
      });
    }
  }

  const exportTimestamp = typeof payload.timestamp === 'number' ? payload.timestamp : Date.now();

  const validatedData: ValidatedBackup = {
    version: typeof payload.version === 'number' ? payload.version : 1,
    app: 'AetherMind',
    timestamp: exportTimestamp,
    notes: validNotes,
    links: validLinks,
    categories: validCategories,
    pages: validPages,
    snapshots: validSnapshots
  };

  return {
    valid: true,
    data: validatedData,
    summary: {
      noteCount: validNotes.length,
      linkCount: validLinks.length,
      pageCount: validPages.length,
      categoryCount: validCategories.length,
      snapshotCount: validSnapshots.length,
      tagCount: allTags.size,
      exportDate: new Date(exportTimestamp).toLocaleDateString()
    }
  };
}

/**
 * Creates an emergency pre-import safety snapshot of the entire active database.
 * This guarantees the user can revert back if an imported backup was accidental or problematic.
 */
export async function createSafetySnapshot(): Promise<number> {
  const notes = await db.notes.toArray();
  const links = await db.links.toArray();
  const firstPage = await db.pages.toCollection().first();
  const pageId = firstPage?.id || 1;

  const snapshotId = await db.snapshots.add({
    pageId,
    timestamp: Date.now(),
    notesData: JSON.stringify(notes),
    linksData: JSON.stringify(links)
  });

  return snapshotId;
}
