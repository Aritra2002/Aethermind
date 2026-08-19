/**
 * ============================================================================
 * db/helpers.ts — Dexie IndexedDB Entity Helpers & Bidirectional Graph Syncer
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides CRUD abstractions, wiki-link extraction `[[Note Title]]`, graph edge
 * synchronization, local RAG vector indexing, and default knowledge database seeding.
 */

import { db } from './index';
import type { Note, Link } from './index';
import { generateEmbedding } from '../utils/vectorSearch';
import { ingestNote, removeNoteFromRag } from '../utils/rag';

/**
 * Extracts wiki-link references (`[[Note Title]]`) from markdown text.
 * Ignores code blocks and inline backtick code snippets.
 * 
 * @param content - Raw markdown text
 * @returns Array of unique referenced note titles
 */
export function extractWikiLinks(content: string): string[] {
  // Strip code blocks and inline code to prevent false-positive links
  const withoutCode = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');

  const regex = /\[\[(.*?)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(withoutCode)) !== null) {
    const title = match[1].trim();
    if (title && !links.includes(title)) {
      links.push(title);
    }
  }
  return links;
}

/**
 * Synchronizes graph connection links in IndexedDB for a given note.
 * Parses markdown wiki-links and updates both incoming and outgoing graph edges.
 * 
 * @param noteId - ID of the source note
 * @param content - Markdown content to scan for wiki-links
 * @param linkedNoteIds - Explicitly connected note IDs
 * @param preventBlankNodes - If true, skips creating empty placeholder notes for missing targets
 */
export async function syncLinksForNote(noteId: number, content: string, linkedNoteIds: number[] = [], preventBlankNodes: boolean = false): Promise<void> {
  await db.transaction('rw', [db.notes, db.links], async () => {
    const sourceNote = await db.notes.get(noteId);
    if (!sourceNote) return;
    const pageId = sourceNote.pageId;

    const targetTitles = extractWikiLinks(content);
    
    // Find target notes, create empty placeholder notes if they don't exist yet
    const targetIds: number[] = [...linkedNoteIds];
    for (const title of targetTitles) {
      const existing = await db.notes.where('title').equalsIgnoreCase(title).and(n => n.pageId === pageId).first();
      if (existing) {
        targetIds.push(existing.id!);
      } else if (!preventBlankNodes) {
        const newNoteId = await db.notes.add({
          pageId,
          title,
          content: '',
          tags: [],
          category: 'general',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        targetIds.push(newNoteId);
      }
    }

    // Deduplicate targetIds
    const uniqueTargetIds = Array.from(new Set(targetIds));

    // Fetch current database links where this note is source OR target
    const existingLinksAsSource = await db.links.where('sourceId').equals(noteId).toArray();
    const existingLinksAsTarget = await db.links.where('targetId').equals(noteId).toArray();
    const existingTargetIdsFromSource = existingLinksAsSource.map(l => l.targetId);
    const existingSourceIdsFromTarget = existingLinksAsTarget.map(l => l.sourceId);
    const allExistingConnectedIds = new Set([...existingTargetIdsFromSource, ...existingSourceIdsFromTarget]);

    // Compute diffs
    const linksToAdd = uniqueTargetIds.filter(id => !allExistingConnectedIds.has(id) && id !== noteId);
    const linksToRemove = existingLinksAsSource.filter(l => !uniqueTargetIds.includes(l.targetId));

    // Apply database updates
    if (linksToAdd.length > 0) {
      const newLinks: Link[] = linksToAdd.map(targetId => ({
        sourceId: noteId,
        targetId
      }));
      await db.links.bulkAdd(newLinks);
    }

    if (linksToRemove.length > 0) {
      const idsToRemove = linksToRemove.map(l => l.id!);
      await db.links.bulkDelete(idsToRemove);
    }
  });
}

/**
 * Creates a new note in the specified page.
 * 
 * @param pageId - Page / graph partition identifier
 * @param title - Unique note title
 * @param category - Category bucket (defaults to 'general')
 * @returns Generated note primary key ID
 */
export async function createNote(pageId: number, title: string, category = 'general'): Promise<number> {
  const id = await db.transaction('rw', [db.notes], async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) throw new Error('Title cannot be empty');

    const existing = await db.notes.where('title').equalsIgnoreCase(normalizedTitle).and(n => n.pageId === pageId).first();
    if (existing) {
      return existing.id!;
    }

    const newId = await db.notes.add({
      pageId,
      title: normalizedTitle,
      content: '',
      tags: [],
      category,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return newId;
  });

  // Ingest into local RAG vector store
  ingestNote(id as number, title, '').catch(err => console.warn('RAG ingestion failed:', err));

  return id;
}

/**
 * Updates an existing note and triggers background vector re-embedding and link synchronization.
 * 
 * @param id - Note primary key ID
 * @param updates - Partial fields to update
 * @param preventBlankNodes - Whether to skip generating stub notes for new wiki-links
 */
export async function updateNote(id: number, updates: Partial<Note>, preventBlankNodes: boolean = false): Promise<void> {
  await db.transaction('rw', [db.notes, db.links], async () => {
    const updatedNote = {
      ...updates,
      updatedAt: Date.now()
    };

    await db.notes.update(id, updatedNote);

    // If content or explicit links changed, sync graph edges and re-calculate embedding
    if (updates.content !== undefined || updates.linkedNoteIds !== undefined) {
      const fullNote = await db.notes.get(id);
      if (fullNote) {
        await syncLinksForNote(id, fullNote.content, fullNote.linkedNoteIds || [], preventBlankNodes);
        if (updates.content !== undefined) {
          generateEmbedding(`${fullNote.title}\n\n${fullNote.content}`).then(emb => {
            db.notes.update(id, { embedding: emb });
          }).catch(err => console.warn('Embedding generation failed:', err));
        }
      }
    }
  });

  // Update RAG index
  if (updates.content !== undefined) {
    const fullNote = await db.notes.get(id);
    if (fullNote) {
      ingestNote(id, fullNote.title, fullNote.content).catch(err => console.warn('RAG re-ingestion failed:', err));
    }
  }
}

/**
 * Deletes a note from IndexedDB and cleans up all associated graph link connections and RAG embeddings.
 * 
 * @param id - Note primary key ID
 */
export async function deleteNote(id: number): Promise<void> {
  await db.transaction('rw', [db.notes, db.links], async () => {
    await db.notes.delete(id);

    const sourceLinks = await db.links.where('sourceId').equals(id).toArray();
    const targetLinks = await db.links.where('targetId').equals(id).toArray();
    
    const linkIdsToDelete = [...sourceLinks, ...targetLinks].map(l => l.id!);
    if (linkIdsToDelete.length > 0) {
      await db.links.bulkDelete(linkIdsToDelete);
    }
  });

  removeNoteFromRag(id).catch(err => console.warn('RAG removal failed:', err));
}

/**
 * Populates an empty database with introductory guide notes, sample graph links, and categories.
 */
export async function seedDatabase(): Promise<void> {
  // Seed default categories
  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    await db.categories.bulkPut([
      { id: 'general', label: 'General', color: '#818cf8' },
      { id: 'work', label: 'Work', color: '#34d399' },
      { id: 'personal', label: 'Personal', color: '#f43f5e' },
      { id: 'ideas', label: 'Ideas', color: '#fbbf24' }
    ]);
  }

  // Seed default graph page
  const pagesCount = await db.pages.count();
  if (pagesCount === 0) {
    await db.pages.put({
      id: 1,
      title: 'Graph',
      createdAt: Date.now()
    });
  }

  const notesCount = await db.notes.count();
  if (notesCount > 0) return; // Already seeded

  const fixedTimestamp = new Date('2026-06-01T19:24:00+05:30').getTime();

  // Starter onboarding knowledge network
  const notes: Note[] = [
    {
      pageId: 1,
      title: 'Welcome to AetherMind',
      content: 'Welcome to **AetherMind**! This is your local-first personal knowledge graph and mind mapper.\n\nHere, you can create nodes, jot down markdown notes, and connect ideas visually using wiki-style links. \n\nClick on the node [[Interactive Graph]] to learn how to navigate the network, or check [[Markdown Syntax]] to see how text renders.',
      tags: ['intro', 'guide'],
      category: 'general',
      createdAt: fixedTimestamp,
      updatedAt: fixedTimestamp
    },
    {
      pageId: 1,
      title: 'Interactive Graph',
      content: 'The panel on the left is a dynamic, force-directed network graph of your notes. \n\n### Navigation Controls:\n- **Drag** nodes to pin them in place.\n- **Double-Click** a pinned node to release it back to the simulation.\n- **Scroll** to zoom in and out of the canvas.\n- **Click** a node to open it in this editing sidebar.\n- **Double-Click** empty canvas space to create a brand new floating note.\n\nRead more about organizing files in [[Organizing Notes]].',
      tags: ['graph', 'guide'],
      category: 'work',
      createdAt: fixedTimestamp + 1000,
      updatedAt: fixedTimestamp + 1000
    },
    {
      pageId: 1,
      title: 'Markdown Syntax',
      content: 'AetherMind supports rich formatting via standard markdown.\n\n### Formatting Examples:\n- **Bold text** and *italic text*\n- [AetherMind File Links](https://example.com/PRD.md)\n- Lists:\n  1. First item\n  2. Second item\n\n### Code Blocks:\n```javascript\nconst hello = "AetherMind";\nconsole.log(`Welcome to ${hello}`);\n```\n\nYou can also link notes simply by typing their name inside double brackets. Try adding `[[New Ideas]]` somewhere in this file.',
      tags: ['markdown', 'editor'],
      category: 'work',
      createdAt: fixedTimestamp + 2000,
      updatedAt: fixedTimestamp + 2000
    },
    {
      pageId: 1,
      title: 'Organizing Notes',
      content: 'To help keep your mind mapper structured, you can assign categories and tags to your notes:\n\n- **Categories**: Colors nodes on the canvas. Try toggling between "work", "personal", and "ideas".\n- **Tags**: Click tags in the search selector on the left to highlight specific categories and dim out unrelated nodes.\n- **Timeline**: Drag the slider at the bottom to scrub through your node history.',
      tags: ['organization', 'tags'],
      category: 'personal',
      createdAt: fixedTimestamp + 3000,
      updatedAt: fixedTimestamp + 3000
    }
  ];

  const count = await db.notes.count();
  if (count > 0) return;
  
  await db.transaction('rw', [db.notes, db.links], async () => {
    const innerCount = await db.notes.count();
    if (innerCount > 0) return;

    const addedIds: number[] = [];
    for (const note of notes) {
      const id = await db.notes.add(note);
      addedIds.push(id);
    }

    // Connect graph edges based on wiki-link content
    await syncLinksForNote(addedIds[0], notes[0].content);
    await syncLinksForNote(addedIds[1], notes[1].content);
    await syncLinksForNote(addedIds[2], notes[2].content);
    await syncLinksForNote(addedIds[3], notes[3].content);
  });
}
