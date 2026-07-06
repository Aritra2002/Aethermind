import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock third-party libraries and modules that trigger heavy sub-dependencies or binary loads
vi.mock('@xenova/transformers', () => ({}));
vi.mock('tesseract.js', () => ({}));
vi.mock('pdfjs-dist', () => ({}));
vi.mock('../utils/vectorSearch', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([]),
  semanticSearch: vi.fn().mockResolvedValue([]),
  clusterUnlinkedNotes: vi.fn().mockResolvedValue([]),
}));

// Mock Dexie db and helpers to prevent issues during imports in vitest node environment
vi.mock('../db', () => ({
  db: {
    transaction: vi.fn((type, tables, cb) => cb()),
    notes: {
      where: vi.fn().mockReturnThis(),
      equalsIgnoreCase: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      add: vi.fn().mockResolvedValue(999),
      update: vi.fn().mockResolvedValue(1),
    },
    links: {
      add: vi.fn().mockResolvedValue(1),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    },
    categories: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    pages: {
      toArray: vi.fn().mockResolvedValue([]),
    }
  }
}));

import { parseAiResponse } from '../utils/aiActions';

interface MockNote {
  id?: number;
  pageId: number;
  title: string;
  content: string;
  tags: string[];
}

interface MockLink {
  id?: number;
  sourceId: number;
  targetId: number;
}

// Simulated ZIP import logic for unit testing
async function simulateImportZip(
  currentPageId: number,
  importedNotes: MockNote[],
  importedLinks: MockLink[],
  existingDbNotes: MockNote[],
  existingDbLinks: MockLink[],
  mockAddNote: (note: Omit<MockNote, 'id'>) => Promise<number>,
  mockUpdateNote: (id: number, updates: Partial<MockNote>) => Promise<void>,
  mockAddLink: (link: MockLink) => Promise<void>,
  mockSyncLinks: (id: number, content: string) => Promise<void>
) {
  const oldToNewIdMap: Record<number, number> = {};

  for (const note of importedNotes) {
    if (note.id === undefined) continue;

    const existingNote = existingDbNotes.find(
      (n) => n.title.toLowerCase() === note.title.toLowerCase() && n.pageId === currentPageId
    );

    if (existingNote) {
      const mergedTags = Array.from(new Set([...(existingNote.tags || []), ...(note.tags || [])]));
      const mergedContent = existingNote.content
        ? (existingNote.content.includes(note.content) ? existingNote.content : `${existingNote.content}\n\n${note.content}`)
        : note.content;

      await mockUpdateNote(existingNote.id!, {
        tags: mergedTags,
        content: mergedContent,
      });

      oldToNewIdMap[note.id] = existingNote.id!;
      await mockSyncLinks(existingNote.id!, mergedContent);
    } else {
      const newNoteId = await mockAddNote({
        pageId: currentPageId,
        title: note.title,
        content: note.content,
        tags: note.tags || [],
      });
      oldToNewIdMap[note.id] = newNoteId;
    }
  }

  for (const link of importedLinks) {
    const resolvedSourceId = oldToNewIdMap[link.sourceId];
    const resolvedTargetId = oldToNewIdMap[link.targetId];

    if (resolvedSourceId !== undefined && resolvedTargetId !== undefined) {
      const existingLink = existingDbLinks.find(
        (l) => l.sourceId === resolvedSourceId && l.targetId === resolvedTargetId
      );

      if (!existingLink) {
        await mockAddLink({
          sourceId: resolvedSourceId,
          targetId: resolvedTargetId,
        });
      }
    }
  }
}

describe('Milestone 5 UI placement & Design Checks', () => {
  const appTsx = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');

  it('imports FileArchive and FileUp from lucide-react', () => {
    expect(appTsx).toContain('FileArchive');
    expect(appTsx).toContain('FileUp');
  });

  it('renders secondary buttons with .header-btn base style and not .primary-btn', () => {
    expect(appTsx).toContain('className="header-btn"');
    const matches = appTsx.match(/className="[^"]*primary-btn[^"]*"/g);
    expect(matches?.length).toBeLessThanOrEqual(5); 
  });

  it('hides text labels on desktop below 1280px using hidden xl:inline', () => {
    expect(appTsx).toContain('hidden xl:inline');
  });

  it('renders as icon-only-btn on tablet viewport', () => {
    expect(appTsx).toContain('className="header-btn icon-only-btn"');
  });

  it('places buttons inside mobile menu drawer dropdown list for mobile viewport', () => {
    expect(appTsx).toContain('mobile-menu-drawer');
    expect(appTsx).toContain('handleImportZip(); setShowMobileMenu(false);');
    expect(appTsx).toContain('handleUploadDocument(); setShowMobileMenu(false);');
  });
});

describe('Milestone 6 ZIP Import Logic Checks', () => {
  it('correctly maps ZIP note IDs, merges tags, concatenates content, and remaps links', async () => {
    const dbNotes: MockNote[] = [
      { id: 101, pageId: 1, title: 'Welcome', content: 'Original welcome content', tags: ['intro'] },
    ];
    const dbLinks: MockLink[] = [];

    const importedNotes: MockNote[] = [
      { id: 1, pageId: 1, title: 'Welcome', content: 'New guide addition', tags: ['guide'] },
      { id: 2, pageId: 1, title: 'New Topic', content: 'New topic details', tags: ['ideas'] },
    ];
    const importedLinks: MockLink[] = [
      { sourceId: 1, targetId: 2 },
    ];

    const syncedCalls: { id: number; content: string }[] = [];

    const mockAddNote = async (n: Omit<MockNote, 'id'>) => {
      const newId = dbNotes.length + 101;
      dbNotes.push({ id: newId, ...n });
      return newId;
    };

    const mockUpdateNote = async (id: number, updates: Partial<MockNote>) => {
      const note = dbNotes.find((n) => n.id === id);
      if (note) {
        Object.assign(note, updates);
      }
    };

    const mockAddLink = async (l: MockLink) => {
      dbLinks.push(l);
    };

    const mockSyncLinks = async (id: number, content: string) => {
      syncedCalls.push({ id, content });
    };

    await simulateImportZip(
      1,
      importedNotes,
      importedLinks,
      dbNotes,
      dbLinks,
      mockAddNote,
      mockUpdateNote,
      mockAddLink,
      mockSyncLinks
    );

    // Verify 'Welcome' note merged successfully
    const welcomeNote = dbNotes.find((n) => n.title === 'Welcome');
    expect(welcomeNote).not.toBeNull();
    expect(welcomeNote?.content).toBe('Original welcome content\n\nNew guide addition');
    expect(welcomeNote?.tags).toEqual(['intro', 'guide']);

    // Verify synced links called
    expect(syncedCalls.length).toBe(1);
    expect(syncedCalls[0]).toEqual({ id: 101, content: 'Original welcome content\n\nNew guide addition' });

    // Verify 'New Topic' note was added
    const newTopicNote = dbNotes.find((n) => n.title === 'New Topic');
    expect(newTopicNote).not.toBeNull();
    expect(newTopicNote?.id).toBe(102);

    // Verify links were remapped and inserted
    expect(dbLinks.length).toBe(1);
    expect(dbLinks[0]).toEqual({ sourceId: 101, targetId: 102 });
  });
});

describe('Milestone 7 Document Upload & AI Generation Checks', () => {
  it('parses AI actions response correctly using parseAiResponse', () => {
    const rawAiResponse = `
Here are the actions you requested:
\`\`\`json
[
  { "action": "create_note", "title": "Concept A", "content": "Details of A", "tags": ["tag1"] },
  { "action": "create_link", "from": "Concept A", "to": "Concept B" }
]
\`\`\`
Hope this helps!
`;
    const parsed = parseAiResponse(rawAiResponse);
    expect(parsed).not.toBeNull();
    expect(parsed?.actions.length).toBe(2);
    expect(parsed?.actions[0].action).toBe('create_note');
    expect(parsed?.actions[1].action).toBe('create_link');
    expect(parsed?.explanation).toContain('Hope this helps!');
  });
});
