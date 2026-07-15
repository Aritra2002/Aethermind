import { db } from './index';
import type { Note, Link } from './index';
import { generateEmbedding } from '../utils/vectorSearch';

// Helper to extract wiki-links from markdown content
export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[(.*?)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const title = match[1].trim();
    if (title && !links.includes(title)) {
      links.push(title);
    }
  }
  return links;
}

// Sync links for a specific note based on its current content
export async function syncLinksForNote(noteId: number, content: string, linkedNoteIds: number[] = [], preventBlankNodes: boolean = false): Promise<void> {
  await db.transaction('rw', [db.notes, db.links], async () => {
    const sourceNote = await db.notes.get(noteId);
    if (!sourceNote) return;
    const pageId = sourceNote.pageId;

    const targetTitles = extractWikiLinks(content);
    
    // Find target notes, create empty normal notes if they don't exist yet
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

    // Fetch current database links where this note is the source
    const existingLinks = await db.links.where('sourceId').equals(noteId).toArray();
    const existingTargetIds = existingLinks.map(l => l.targetId);

    // Links to add
    const linksToAdd = uniqueTargetIds.filter(id => !existingTargetIds.includes(id) && id !== noteId);
    // Links to remove
    const linksToRemove = existingLinks.filter(l => !uniqueTargetIds.includes(l.targetId));

    // Perform database changes
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

// Create a new note
export async function createNote(pageId: number, title: string, category = 'general'): Promise<number> {
  return await db.transaction('rw', [db.notes], async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) throw new Error('Title cannot be empty');

    // Check if a note exists with this title in the current page
    const existing = await db.notes.where('title').equalsIgnoreCase(normalizedTitle).and(n => n.pageId === pageId).first();
    if (existing) {
      return existing.id!;
    }

    const id = await db.notes.add({
      pageId,
      title: normalizedTitle,
      content: '',
      tags: [],
      category,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return id;
  });
}

// Update an existing note
export async function updateNote(id: number, updates: Partial<Note>, preventBlankNodes: boolean = false): Promise<void> {
  await db.transaction('rw', [db.notes, db.links], async () => {
    const updatedNote = {
      ...updates,
      updatedAt: Date.now()
    };

    await db.notes.update(id, updatedNote);

    // If content or explicit links were updated, sync the links and recalculate embedding!
    if (updates.content !== undefined || updates.linkedNoteIds !== undefined) {
      const fullNote = await db.notes.get(id);
      if (fullNote) {
        await syncLinksForNote(id, fullNote.content, fullNote.linkedNoteIds || [], preventBlankNodes);
        // Recalculate embedding in the background
        if (updates.content !== undefined) {
          generateEmbedding(`${fullNote.title}\n\n${fullNote.content}`).then(emb => {
            db.notes.update(id, { embedding: emb });
          }).catch(() => {});
        }
      }
    }
  });
}

// Delete note and clean up its links
export async function deleteNote(id: number): Promise<void> {
  await db.transaction('rw', [db.notes, db.links], async () => {
    // Delete the note
    await db.notes.delete(id);

    // Find and delete links where this note is source or target
    const sourceLinks = await db.links.where('sourceId').equals(id).toArray();
    const targetLinks = await db.links.where('targetId').equals(id).toArray();
    
    const linkIdsToDelete = [...sourceLinks, ...targetLinks].map(l => l.id!);
    if (linkIdsToDelete.length > 0) {
      await db.links.bulkDelete(linkIdsToDelete);
    }
  });
}

// Seed Database with Demo Notes
export async function seedDatabase(): Promise<void> {
  // Seed categories if empty
  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    await db.categories.bulkPut([
      { id: 'general', label: 'General', color: '#818cf8' },
      { id: 'work', label: 'Work', color: '#34d399' },
      { id: 'personal', label: 'Personal', color: '#ff0000' }, // Red
      { id: 'ideas', label: 'Ideas', color: '#fbbf24' }
    ]);
  }

  // Seed default page if empty
  const pagesCount = await db.pages.count();
  if (pagesCount === 0) {
    await db.pages.put({
      id: 1,
      title: 'Graph',
      createdAt: Date.now()
    });
  }

  const notesCount = await db.notes.count();
  if (notesCount > 0) return; // Database already seeded with notes

  // Seed default notes
  const notes: Note[] = [
    {
      pageId: 1,
      title: 'Welcome to AetherMind',
      content: 'Welcome to **AetherMind**! This is your local-first personal knowledge graph and mind mapper.\n\nHere, you can create nodes, jot down markdown notes, and connect ideas visually using wiki-style links. \n\nClick on the node [[Interactive Graph]] to learn how to navigate the network, or check [[Markdown Syntax]] to see how text renders.',
      tags: ['intro', 'guide'],
      category: 'general',
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000
    },
    {
      pageId: 1,
      title: 'Interactive Graph',
      content: 'The panel on the left is a dynamic, force-directed network graph of your notes. \n\n### Navigation Controls:\n- **Drag** nodes to pin them in place.\n- **Double-Click** a pinned node to release it back to the simulation.\n- **Scroll** to zoom in and out of the canvas.\n- **Click** a node to open it in this editing sidebar.\n- **Double-Click** empty canvas space to create a brand new floating note.\n\nRead more about organizing files in [[Organizing Notes]].',
      tags: ['graph', 'guide'],
      category: 'work',
      createdAt: Date.now() - 80000,
      updatedAt: Date.now() - 80000
    },
    {
      pageId: 1,
      title: 'Markdown Syntax',
      content: 'AetherMind supports rich formatting via standard markdown.\n\n### Formatting Examples:\n- **Bold text** and *italic text*\n- [AetherMind File Links](file:///e:/Lab/personal-knowledge-graph/PRD.md)\n- Lists:\n  1. First item\n  2. Second item\n\n### Code Blocks:\n```javascript\nconst hello = "AetherMind";\nconsole.log(`Welcome to ${hello}`);\n```\n\nYou can also link notes simply by typing their name inside double brackets. Try adding `[[New Ideas]]` somewhere in this file.',
      tags: ['markdown', 'editor'],
      category: 'work',
      createdAt: Date.now() - 60000,
      updatedAt: Date.now() - 60000
    },
    {
      pageId: 1,
      title: 'Organizing Notes',
      content: 'To help keep your mind mapper structured, you can assign categories and tags to your notes:\n\n- **Categories**: Colors nodes on the canvas. Try toggling between "work", "personal", and "ideas".\n- **Tags**: Click tags in the search selector on the left to highlight specific categories and dim out unrelated nodes.\n- **Timeline**: Drag the slider at the bottom to scrub through your node history.',
      tags: ['organization', 'tags'],
      category: 'personal',
      createdAt: Date.now() - 40000,
      updatedAt: Date.now() - 40000
    }
  ];

  const count = await db.notes.count();
  if (count > 0) return; // Re-check after potential concurrent calls
  
  await db.transaction('rw', [db.notes, db.links], async () => {
    // Third check inside transaction to be absolutely safe
    const innerCount = await db.notes.count();
    if (innerCount > 0) return;

    const addedIds: number[] = [];
    for (const note of notes) {
      const id = await db.notes.add(note);
      addedIds.push(id);
    }

    // Create links manually based on seeded text contents
    await syncLinksForNote(addedIds[0], notes[0].content); // Welcome -> Interactive Graph, Markdown Syntax
    await syncLinksForNote(addedIds[1], notes[1].content); // Interactive Graph -> Organizing Notes
    await syncLinksForNote(addedIds[2], notes[2].content); // Markdown Syntax -> (empty link or self)
    await syncLinksForNote(addedIds[3], notes[3].content); // Organizing Notes -> (empty link)
  });
}
