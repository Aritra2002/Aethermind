/**
 * @file vaultExport.ts
 * @description Deterministic, secret-free vault export utility for AetherMind.
 * Generates clean JSON backups, ZIP archives with YAML-frontmatter Markdown notes,
 * and standalone offline HTML bundles, ensuring zero API keys or credentials leak.
 */

import { db, type Note, type Link, type Category, type Page, type GraphSnapshot } from '../db';
import type { ValidatedBackup } from './backupValidation';
import { exportToHtml } from './exportHtml';

/**
 * Generates a complete, deterministic, secret-free JSON backup payload of the vault.
 *
 * @param pageId - Optional page ID to export only a single page/canvas, or all pages if omitted.
 * @returns Promise resolving to {@link ValidatedBackup} object.
 */
export async function generateVaultExportJson(pageId?: number): Promise<ValidatedBackup> {
  let notes: Note[];
  let links: Link[];
  let pages: Page[];
  let snapshots: GraphSnapshot[];

  if (pageId !== undefined) {
    notes = await db.notes.where({ pageId }).toArray();
    pages = await db.pages.where({ id: pageId }).toArray();
    snapshots = await db.snapshots.where({ pageId }).toArray();

    const noteIds = new Set(notes.map(n => n.id!));
    const allLinks = await db.links.toArray();
    links = allLinks.filter(l => noteIds.has(l.sourceId) && noteIds.has(l.targetId));
  } else {
    notes = await db.notes.toArray();
    links = await db.links.toArray();
    pages = await db.pages.toArray();
    snapshots = await db.snapshots.toArray();
  }

  const categories = await db.categories.toArray();

  // Sanitize notes data ensuring no internal secrets are serialized
  const cleanNotes: Note[] = notes.map(n => ({
    id: n.id,
    pageId: n.pageId,
    title: n.title,
    content: n.content || '',
    tags: Array.isArray(n.tags) ? n.tags : [],
    category: n.category || 'general',
    color: n.color,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    fx: n.fx,
    fy: n.fy,
    linkedNoteIds: n.linkedNoteIds,
    isFavorite: n.isFavorite,
    isArchived: n.isArchived,
    isTrash: n.isTrash,
    uuid: n.uuid,
    wordCount: n.wordCount,
    readingTime: n.readingTime
  }));

  const cleanLinks: Link[] = links.map(l => ({
    id: l.id,
    sourceId: l.sourceId,
    targetId: l.targetId,
    explanation: l.explanation
  }));

  const cleanCategories: Category[] = categories.map(c => ({
    id: c.id,
    label: c.label,
    color: c.color
  }));

  const cleanPages: Page[] = pages.map(p => ({
    id: p.id,
    title: p.title,
    createdAt: p.createdAt
  }));

  const cleanSnapshots: GraphSnapshot[] = snapshots.map(s => ({
    id: s.id,
    pageId: s.pageId,
    timestamp: s.timestamp,
    notesData: s.notesData,
    linksData: s.linksData
  }));

  return {
    version: 1,
    app: 'AetherMind',
    timestamp: Date.now(),
    notes: cleanNotes,
    links: cleanLinks,
    categories: cleanCategories,
    pages: cleanPages,
    snapshots: cleanSnapshots
  };
}

/**
 * Downloads a complete JSON backup file to the user's filesystem.
 *
 * @param pageId - Optional page ID to export.
 */
export async function downloadVaultJson(pageId?: number): Promise<void> {
  const data = await generateVaultExportJson(pageId);
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `aethermind-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports vault notes into a ZIP archive containing individual Markdown files with YAML frontmatter.
 *
 * @param pageId - Optional page ID to export.
 * @returns Promise resolving to a Blob representing the ZIP archive.
 */
export async function generateVaultZip(pageId?: number): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const backupData = await generateVaultExportJson(pageId);

  // 1. Add structured graph data JSON
  zip.file('graph_data.json', JSON.stringify({
    notes: backupData.notes,
    links: backupData.links,
    categories: backupData.categories,
    pages: backupData.pages
  }, null, 2));

  // 2. Add individual markdown files
  const notesFolder = zip.folder('notes');
  if (notesFolder) {
    backupData.notes.forEach(note => {
      const safeTitle = (note.title || `note-${note.id}`).replace(/[/\\?%*:|"<>]/g, '_');
      const filename = `${safeTitle}.md`;

      const tagsList = note.tags && note.tags.length > 0 ? `\ntags: [${note.tags.join(', ')}]` : '';
      const frontmatter = `---
title: "${note.title}"
category: "${note.category || 'general'}"${tagsList}
created: ${new Date(note.createdAt).toISOString()}
updated: ${new Date(note.updatedAt).toISOString()}
---

`;

      notesFolder.file(filename, frontmatter + (note.content || ''));
    });
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Generates and downloads a single-file standalone interactive HTML document of the vault.
 *
 * @param pageId - Target page ID (defaults to 1).
 * @param pageTitle - Page title label.
 */
export async function exportVaultHtml(pageId: number = 1, pageTitle: string = 'AetherMind Vault'): Promise<void> {
  await exportToHtml(pageId, pageTitle);
}
