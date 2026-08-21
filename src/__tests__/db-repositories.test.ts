// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, type Note, type Link, type Page } from '../db';
import { notesRepository } from '../db/repositories/notesRepository';
import { linksRepository } from '../db/repositories/linksRepository';
import { pagesRepository } from '../db/repositories/pagesRepository';

describe('Database Repositories & Relational Integrity', () => {
  let notesStore: Note[] = [];
  let linksStore: Link[] = [];
  let pagesStore: Page[] = [];
  let snapshotsStore: any[] = [];
  let nextId = 1;

  beforeEach(() => {
    notesStore = [];
    linksStore = [];
    pagesStore = [];
    snapshotsStore = [];
    nextId = 1;

    // Mock db.notes
    vi.spyOn(db.notes, 'get').mockImplementation(async (id: any) => notesStore.find(n => n.id === id));
    vi.spyOn(db.notes, 'add').mockImplementation(async (note: any) => {
      const id = note.id || nextId++;
      const item = { ...note, id };
      notesStore.push(item);
      return id;
    });
    vi.spyOn(db.notes, 'update').mockImplementation(async (id: any, changes: any) => {
      const idx = notesStore.findIndex(n => n.id === id);
      if (idx !== -1) {
        notesStore[idx] = { ...notesStore[idx], ...changes };
      }
      return 1;
    });
    vi.spyOn(db.notes, 'delete').mockImplementation(async (id: any) => {
      notesStore = notesStore.filter(n => n.id !== id);
    });
    vi.spyOn(db.notes, 'toArray').mockImplementation(async () => [...notesStore]);
    vi.spyOn(db.notes, 'toCollection').mockReturnValue({
      toArray: async () => [...notesStore]
    } as any);
    vi.spyOn(db.notes, 'where').mockImplementation((key: any) => {
      return {
        equals: (val: any) => ({
          toArray: async () => notesStore.filter((n: any) => n[key] === val),
          delete: async () => {
            notesStore = notesStore.filter((n: any) => n[key] !== val);
          },
          first: async () => notesStore.find((n: any) => n[key] === val)
        }),
        equalsIgnoreCase: (val: string) => ({
          and: (predicate: (n: any) => boolean) => ({
            first: async () => notesStore.find((n: any) => (n[key] || '').toLowerCase() === val.toLowerCase() && predicate(n))
          })
        })
      } as any;
    });

    // Mock db.links
    vi.spyOn(db.links, 'toArray').mockImplementation(async () => [...linksStore]);
    vi.spyOn(db.links, 'add').mockImplementation(async (link: any) => {
      const id = link.id || nextId++;
      linksStore.push({ ...link, id });
      return id;
    });
    vi.spyOn(db.links, 'delete').mockImplementation(async (id: any) => {
      linksStore = linksStore.filter(l => l.id !== id);
    });
    vi.spyOn(db.links, 'bulkDelete').mockImplementation(async (ids: any) => {
      const idSet = new Set(ids);
      linksStore = linksStore.filter(l => !idSet.has(l.id));
    });
    vi.spyOn(db.links, 'where').mockImplementation((key: any) => {
      return {
        equals: (val: any) => ({
          toArray: async () => {
            if (Array.isArray(val)) {
              return linksStore.filter(l => l.sourceId === val[0] && l.targetId === val[1]);
            }
            return linksStore.filter((l: any) => l[key] === val);
          },
          first: async () => {
            if (Array.isArray(val)) {
              return linksStore.find(l => l.sourceId === val[0] && l.targetId === val[1]);
            }
            return linksStore.find((l: any) => l[key] === val);
          }
        })
      } as any;
    });

    // Mock db.pages
    vi.spyOn(db.pages, 'get').mockImplementation(async (id: any) => pagesStore.find(p => p.id === id));
    vi.spyOn(db.pages, 'add').mockImplementation(async (page: any) => {
      const id = page.id || nextId++;
      pagesStore.push({ ...page, id });
      return id;
    });
    vi.spyOn(db.pages, 'update').mockImplementation(async (id: any, changes: any) => {
      const idx = pagesStore.findIndex(p => p.id === id);
      if (idx !== -1) pagesStore[idx] = { ...pagesStore[idx], ...changes };
      return 1;
    });
    vi.spyOn(db.pages, 'delete').mockImplementation(async (id: any) => {
      pagesStore = pagesStore.filter(p => p.id !== id);
    });
    vi.spyOn(db.pages, 'orderBy').mockReturnValue({
      toArray: async () => [...pagesStore]
    } as any);

    // Mock db.snapshots
    vi.spyOn(db.snapshots, 'where').mockImplementation((key: any) => ({
      equals: (val: any) => ({
        toArray: async () => snapshotsStore.filter((s: any) => s[key] === val),
        delete: async () => {
          snapshotsStore = snapshotsStore.filter((s: any) => s[key] !== val);
        }
      })
    }) as any);

    // Mock db.transaction
    vi.spyOn(db, 'transaction').mockImplementation(async (_mode: any, _tables: any, fn: any) => {
      return fn();
    });
  });

  describe('NotesRepository', () => {
    it('computes word count and reading time metrics automatically', () => {
      const empty = notesRepository.computeTextMetrics('');
      expect(empty.wordCount).toBe(0);
      expect(empty.readingTime).toBe(0);

      const text = 'The quick brown fox jumps over the lazy dog. '.repeat(50); // 450 words
      const metrics = notesRepository.computeTextMetrics(text);
      expect(metrics.wordCount).toBe(450);
      expect(metrics.readingTime).toBe(3); // 450 / 200 = 2.25 -> 3 mins
    });

    it('creates note with computed metadata, stable UUID, and retrieval by id and title', async () => {
      const pageId = await pagesRepository.create('Main Graph');
      const noteId = await notesRepository.create({
        pageId,
        title: 'Quantum Computing Fundamentals',
        content: 'Quantum computing is a rapidly-emerging technology that harnesses the laws of quantum mechanics.',
        tags: ['physics', 'tech'],
        category: 'research'
      });

      expect(typeof noteId).toBe('number');

      const retrieved = await notesRepository.getById(noteId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Quantum Computing Fundamentals');
      expect(retrieved?.uuid).toBeDefined();
      expect(retrieved?.wordCount).toBeGreaterThan(0);

      const byTitle = await notesRepository.getByTitle('quantum computing fundamentals', pageId);
      expect(byTitle?.id).toBe(noteId);
    });

    it('filters notes accurately by active, archived, and trash status', async () => {
      const pageId = await pagesRepository.create('Research');

      const id1 = await notesRepository.create({ pageId, title: 'Active Note', content: '', tags: [], category: 'general' });
      const id2 = await notesRepository.create({ pageId, title: 'Archived Note', content: '', tags: [], category: 'general', isArchived: 1 });
      const id3 = await notesRepository.create({ pageId, title: 'Trashed Note', content: '', tags: [], category: 'general', isTrash: 1 });

      const activeNotes = await notesRepository.query({ pageId, status: 'active' });
      expect(activeNotes.map(n => n.id)).toEqual([id1]);

      const archivedNotes = await notesRepository.query({ pageId, status: 'archived' });
      expect(archivedNotes.map(n => n.id)).toEqual([id2]);

      const trashedNotes = await notesRepository.query({ pageId, status: 'trash' });
      expect(trashedNotes.map(n => n.id)).toEqual([id3]);
    });
  });

  describe('LinksRepository', () => {
    it('prevents self-loops and duplicate link creation', async () => {
      const pageId = await pagesRepository.create('Graph');
      const n1 = await notesRepository.create({ pageId, title: 'A', content: '', tags: [], category: 'general' });
      const n2 = await notesRepository.create({ pageId, title: 'B', content: '', tags: [], category: 'general' });

      const selfLink = await linksRepository.create(n1, n1);
      expect(selfLink).toBeNull();

      const link1 = await linksRepository.create(n1, n2);
      expect(link1).toBeTypeOf('number');

      const duplicateLink = await linksRepository.create(n1, n2);
      expect(duplicateLink).toBe(link1);
    });

    it('detects and cleans orphan links when target notes are removed', async () => {
      const pageId = await pagesRepository.create('Graph');
      const n1 = await notesRepository.create({ pageId, title: 'A', content: '', tags: [], category: 'general' });
      const n2 = await notesRepository.create({ pageId, title: 'B', content: '', tags: [], category: 'general' });

      await linksRepository.create(n1, n2);
      expect((await linksRepository.getAll()).length).toBe(1);

      // Delete note 2 directly to create orphan edge
      await db.notes.delete(n2);

      const cleanedCount = await linksRepository.cleanOrphanLinks();
      expect(cleanedCount).toBe(1);
      expect((await linksRepository.getAll()).length).toBe(0);
    });
  });

  describe('PagesRepository & Cascade Deletion', () => {
    it('creates, renames, and cascades deletion of all child notes and links', async () => {
      const pageId = await pagesRepository.create('Temporary Workspace');
      expect(pageId).toBeTypeOf('number');

      await pagesRepository.rename(pageId, 'Renamed Workspace');
      const page = await pagesRepository.getById(pageId);
      expect(page?.title).toBe('Renamed Workspace');

      const n1 = await notesRepository.create({ pageId, title: 'Child 1', content: '', tags: [], category: 'general' });
      const n2 = await notesRepository.create({ pageId, title: 'Child 2', content: '', tags: [], category: 'general' });
      await linksRepository.create(n1, n2);

      const result = await pagesRepository.deleteWithCascade(pageId);
      expect(result.deletedNotes).toBe(2);
      expect(result.deletedLinks).toBe(1);

      expect(await pagesRepository.getById(pageId)).toBeUndefined();
      expect((await notesRepository.query({ pageId })).length).toBe(0);
      expect((await linksRepository.getAll()).length).toBe(0);
    });
  });
});
