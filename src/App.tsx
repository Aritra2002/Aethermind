/**
 * @file App.tsx
 * @description Main application shell and orchestrator for AetherMind — Personal AI Knowledge Graph Workspace.
 * Coordinates Dexie.js live queries, knowledge graph visualization, note editing workspace (with split-screen support),
 * full-text and tag search filters, document ingestion/RAG processing, historical snapshot time-travel, multi-page graphs,
 * mobile drawer navigation, and AI discovery modals.
 * @module App
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Note, type Link } from './db';
import { seedDatabase, createNote, syncLinksForNote } from './db/helpers';
const GraphCanvas = lazy(() => import('./components/GraphCanvas').then(m => ({ default: m.GraphCanvas })));
import { EditorPanel } from './components/EditorPanel';
import { SearchBar } from './components/SearchBar';
import { TimelineSlider } from './components/TimelineSlider';
import { SettingsModal } from './components/settings/SettingsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { CommandPalette } from './components/CommandPalette';
import { AskAiModal } from './components/AskAiModal';
import { NewPageModal } from './components/NewPageModal';
import { RenamePageModal } from './components/RenamePageModal';
import { ReviewModal } from './components/ReviewModal';
import { useToast } from './components/ToastContext';
import { PromptModal } from './components/PromptModal';
import { MobileNav } from './components/MobileNav';
import { NoteMiniCard } from './components/NoteMiniCard';
import { DiscoveryDigestModal } from './components/DiscoveryDigestModal';
import { Dropdown } from './components/ui/Dropdown';
import { ingestDocument } from './utils/rag';
import { saveSnapshot, loadSnapshot, getSnapshots, restoreSnapshot } from './utils/snapshotManager';
import { applyCustomThemeLive, clearCustomThemeStyles, DEFAULT_CUSTOM_COLORS, syncThemeCategoryColors } from './utils/themeUtils';
import { formatShortcutBadge, formatShortcut, isModifierKeyCombo } from './utils/keyboardUtils';

import { Brain, Plus, Settings, Calendar, Sparkles, Edit2, Trash2, Loader2, Compass, FileArchive, FileUp, Search } from 'lucide-react';

/**
 * Custom hook to monitor window width and compute responsive breakpoint tier.
 *
 * @returns {'sm' | 'md' | 'lg'} Breakpoint tier: `'sm'` (<768px), `'md'` (768–1023px), or `'lg'` (>=1024px).
 */
function useViewport() {
  const [viewport, setViewport] = useState<'sm' | 'md' | 'lg'>('lg');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const width = window.innerWidth;
        if (width < 768) setViewport('sm');
        else if (width < 1024) setViewport('md');
        else setViewport('lg');
      }, 150);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return viewport;
}

/**
 * App Component
 *
 * Root React component for AetherMind.
 * Manages global workspace state, modal flows, database synchronization, theme engine, and split layout.
 *
 * @component
 * @returns {React.ReactElement} The rendered single-page application.
 */
export default function App() {
  const { showToast } = useToast();
  
  /** Configuration for customized input prompt modal. */
  const [promptConfig, setPromptConfig] = useState<{title: string, message: string, onConfirm: (v: string)=>void} | null>(null);
  
  /** Primary active note ID open in the main editor pane. */
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  
  /** Secondary note ID open in the side-by-side split editor pane. */
  const [secondaryNoteId, setSecondaryNoteId] = useState<number | null>(null);
  
  /** Full-text search query string. */
  const [searchQuery, setSearchQuery] = useState('');
  
  /** Selected tags for graph filtering. */
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  /** Date timestamp range [min, max] for chronological graph filtering. */
  const [dateRange, setDateRange] = useState<[number, number] | null>(null);
  
  /** Modal visibility states */
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showRenamePage, setShowRenamePage] = useState(false);
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDiscoveryDigest, setShowDiscoveryDigest] = useState(false);
  
  /** Sidebar visibility toggle state. */
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const viewport = useViewport();
  const isDesktop = viewport === 'lg';
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const handlePromptCancel = useCallback(() => setPromptConfig(null), []);
  
  /** Document ingestion and RAG chunking loading state. */
  const [docLoading, setDocLoading] = useState(false);
  const [docStatus, setDocStatus] = useState('');

  /** Search & tag filter overlay state on canvas. */
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  /** Active workspace page ID (defaults to 1). */
  const [currentPageId, setCurrentPageId] = useState<number>(1);
  
  /** Persistent custom sidebar width in pixels. */
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('aethermind-sidebar-width');
    return saved ? parseInt(saved, 10) : 420;
  });
  
  /** Configurable D3 physics simulation parameters. */
  const [physicsConfig, setPhysicsConfig] = useState(() => {
    const saved = localStorage.getItem('aethermind-physics');
    return saved ? JSON.parse(saved) : { linkDistance: 120, chargeStrength: -150 };
  });
  
  /** NLP semantic clustering toggle state. */
  const [nlpClustering, setNlpClustering] = useState(() => localStorage.getItem('aethermind-nlp-clustering') === 'true');

  /** Historical snapshot data active during time-travel scrubbing. */
  const [historicalSnapshot, setHistoricalSnapshot] = useState<{ notes: Note[]; links: Link[]; timestamp: number } | null>(null);

  /** Active visual theme name ('dark', 'nord', 'dracula', 'cyberpunk', 'custom', etc.). */
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    return localStorage.getItem('aethermind-theme') || 'dark';
  });

  /** Custom user theme color configurations. */
  const [customThemeColors, setCustomThemeColors] = useState(() => {
    const saved = localStorage.getItem('aethermind-custom-themes');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      bgPrimary: '#06071a',
      sidebarBg: '#0f1428',
      textPrimary: '#ffffff',
      accentPrimary: '#7c3aed',
      accentSecondary: '#06b6d4',
      linkColor: '#ffffff4d',
      fontFamily: 'sans',
      ...parsed
    };
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    localStorage.setItem('aethermind-theme', activeTheme);
    
    if (activeTheme === 'custom') {
      applyCustomThemeLive(customThemeColors);
    } else {
      clearCustomThemeStyles();
    }
    // Synchronize default node category colors to match the active theme
    syncThemeCategoryColors(activeTheme, customThemeColors).catch(e => {
      if (import.meta.env.DEV) console.warn('Failed to sync theme category colors:', e);
    });

    const timer = setTimeout(() => {
      const prev = localStorage.getItem('aethermind-custom-themes');
      const next = JSON.stringify(customThemeColors);
      if (prev !== next) localStorage.setItem('aethermind-custom-themes', next);
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTheme, customThemeColors]);

  useEffect(() => {
    localStorage.setItem('aethermind-sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  /**
   * Updates D3 physics parameters and persists to localStorage.
   *
   * @param {{ linkDistance: number; chargeStrength: number }} newConfig - Physics configuration.
   */
  const handlePhysicsChange = (newConfig: { linkDistance: number; chargeStrength: number }) => {
    setPhysicsConfig(newConfig);
    localStorage.setItem('aethermind-physics', JSON.stringify(newConfig));
  };

  // Periodic automatic snapshot generation every 10 minutes
  useEffect(() => {
    if (historicalSnapshot) return;
    const interval = setInterval(async () => {
      try {
        await saveSnapshot(currentPageId);
      } catch {
        // Ignore automatic snapshot persistence errors silently
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentPageId, historicalSnapshot]);

  /**
   * Manually creates and saves an immutable graph snapshot for the active page.
   */
  const handleSaveSnapshot = async () => {
    try {
      const id = await saveSnapshot(currentPageId);
      showToast(`Snapshot saved (ID: ${id})`, 'success');
    } catch (e: unknown) {
      showToast("Failed to save snapshot: " + (e instanceof Error ? e.message : String(e)), "error");
    }
  };

  /**
   * Opens the interactive modal dialog to browse and restore historical snapshots.
   */
  const handleBrowseSnapshots = async () => {
    const snapshots = await getSnapshots(currentPageId);
    if (snapshots.length === 0) {
      showToast("No snapshots available.", "info");
      return;
    }
    const choices = snapshots.map((s, i) => 
      `${i + 1}. ${new Date(s.timestamp).toLocaleString()} (${s.id})`
    ).join('\n');
    
    setPromptConfig({
      title: "Available Snapshots",
      message: `${choices}\n\nEnter snapshot number to view, or "restore <number>" to restore:`,
      onConfirm: async (input: string) => {
        if (!input) return;
        const restoreMatch = input.match(/^restore\s+(\d+)$/i);
        if (restoreMatch) {
          const idx = parseInt(restoreMatch[1], 10) - 1;
          if (idx >= 0 && idx < snapshots.length) {
            try {
              await restoreSnapshot(snapshots[idx].id!, currentPageId);
              setHistoricalSnapshot(null);
              setActiveNoteId(null);
              showToast("Snapshot restored!", "success");
            } catch (e: unknown) {
              showToast("Restore failed: " + (e instanceof Error ? e.message : String(e)), "error");
            }
          }
          return;
        }
        const idx = parseInt(input, 10) - 1;
        if (idx >= 0 && idx < snapshots.length) {
          const data = await loadSnapshot(snapshots[idx].id!);
          if (data) {
            setHistoricalSnapshot({ notes: data.notes, links: data.links, timestamp: data.timestamp });
          }
        }
      }
    });
  };

  /**
   * Restores active page state to the loaded historical snapshot point.
   */
  const handleRestoreFromHistory = async () => {
    if (!historicalSnapshot) return;
    try {
      await db.transaction('rw', [db.notes, db.links], async () => {
        const currentNoteIds = (await db.notes.where({ pageId: currentPageId }).toArray()).map(n => n.id!);
        const allLinks = await db.links.toArray();
        const linksToDelete = allLinks.filter(l => currentNoteIds.includes(l.sourceId) || currentNoteIds.includes(l.targetId));
        await db.notes.where({ pageId: currentPageId }).delete();
        await db.links.bulkDelete(linksToDelete.map(l => l.id!));

        const idMap = new Map<number, number>();
        for (const note of historicalSnapshot.notes) {
          const oldId = note.id!;
          const noteData = { ...note, pageId: currentPageId };
          delete (noteData as Record<string, unknown>).id;
          const newId = await db.notes.add(noteData);
          idMap.set(oldId, newId as number);
        }
        for (const link of historicalSnapshot.links) {
          await db.links.add({
            sourceId: idMap.get(link.sourceId) ?? link.sourceId,
            targetId: idMap.get(link.targetId) ?? link.targetId,
          });
        }
      });
      setHistoricalSnapshot(null);
      setActiveNoteId(null);
      showToast("Restored to historical point!", "success");
    } catch (e: unknown) {
      showToast("Restore failed: " + (e instanceof Error ? e.message : String(e)), "error");
    }
  };

  // Seed default notes, categories, and initial pages on first mount
  useEffect(() => {
    seedDatabase().catch(e => console.error('Seed failed', e));
  }, []);

  // Global Command Palette Shortcut Listener (Universal Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isModifierKeyCombo(e, 'k')) {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Bind Dexie LiveQueries for real-time reactive graph
  const pages = useLiveQuery(() => db.pages.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.where({ pageId: currentPageId }).toArray(), [currentPageId]) || [];
  
  // Fetch links relevant to current page notes
  const links = useLiveQuery(async () => {
    const currentNotes = await db.notes.where({ pageId: currentPageId }).toArray();
    const currentIds = new Set(currentNotes.map(n => n.id));
    const allLinks = await db.links.toArray();
    return allLinks.filter(l => currentIds.has(l.sourceId) && currentIds.has(l.targetId));
  }, [currentPageId]) || [];

  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Find active note records
  const activeNote = notes.find((n) => n.id === activeNoteId) || null;
  const secondaryNote = notes.find((n) => n.id === secondaryNoteId) || null;

  /**
   * Selects or deselects a note from the graph canvas or list view and updates visit statistics.
   *
   * @param {Note | null} note - Selected note entity or null.
   */
  const handleSelectNote = async (note: Note | null) => {
    if (note) {
      if (activeNoteId && activeNoteId !== note.id && isSidebarOpen) {
        setActiveNoteId(note.id!);
      } else {
        setActiveNoteId(note.id!);
        if (viewport !== 'sm') {
          setIsSidebarOpen(true);
        }
      }
      if (note.id !== undefined) {
        const currentVisits = note.visits || 0;
        await db.notes.update(note.id, { visits: currentVisits + 1 });
      }
    } else {
      setActiveNoteId(null);
      setSecondaryNoteId(null);
    }
  };

  /**
   * Creates a new note and positions it at the specified canvas coordinates if supplied.
   *
   * @param {number} [x] - Simulation X coordinate.
   * @param {number} [y] - Simulation Y coordinate.
   */
  const handleCreateNote = async (x?: number, y?: number) => {
    try {
      const title = 'New Node';
      let finalTitle = title;
      let index = 1;
      while (notes.some((n) => n.title.toLowerCase() === finalTitle.toLowerCase())) {
        finalTitle = `${title} (${index})`;
        index++;
      }

      const newId = await createNote(currentPageId, finalTitle);
      
      // If coordinates are provided (canvas double click), pin the node there
      if (x !== undefined && y !== undefined) {
        await db.notes.update(newId, { fx: x, fy: y });
      }

      setActiveNoteId(newId);
      setIsSidebarOpen(true);
    } catch (e: unknown) {
      showToast(`Could not create note: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  /**
   * Initiates graph board deletion confirmation dialog.
   */
  const handleDeletePage = async () => {
    if (pages.length <= 1) return;
    setShowDeletePageConfirm(true);
  };

  /**
   * Permanently deletes the active page, its notes, and connected graph links.
   */
  const confirmDeletePage = async () => {
    try {
      const pageNoteIds = (await db.notes.where({ pageId: currentPageId }).toArray()).map(n => n.id!);

      await db.transaction('rw', [db.pages, db.notes, db.links], async () => {
        await db.notes.where({ pageId: currentPageId }).delete();
        await db.pages.delete(currentPageId);
      });

      await db.snapshots.where({ pageId: currentPageId }).delete();
      for (const noteId of pageNoteIds) {
        await db.documents.where('documentId').equals(`note_${noteId}`).delete();
      }

      const remaining = pages.filter(p => p.id !== currentPageId);
      if (remaining.length > 0) {
        setCurrentPageId(remaining[0].id!);
      }
      setActiveNoteId(null);
      setHistoricalSnapshot(null);
    } catch (e: unknown) {
      showToast("Failed to delete page: " + (e instanceof Error ? e.message : String(e)), "error");
    } finally {
      setShowDeletePageConfirm(false);
    }
  };

  /**
   * Jumps to note by title or creates it on demand (handles wiki-link click events).
   *
   * @param {string} title - Target note title.
   */
  const handleJumpToNote = async (title: string) => {
    const target = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (target) {
      setActiveNoteId(target.id!);
      setIsSidebarOpen(true);
    } else {
      // Create new note if referenced note doesn't exist
      try {
        const newId = await createNote(currentPageId, title);
        setActiveNoteId(newId);
        setIsSidebarOpen(true);
      } catch (err: unknown) {
        showToast(`Error opening note: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
  };

  /**
   * Deselects the active note after deletion.
   */
  const handleNoteDeleted = () => {
    setActiveNoteId(null);
  };

  /**
   * Creates or navigates to today's daily journal note with date formatting (e.g. `YYYY-MM-DD`).
   */
  const handleCreateDailyNote = async () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const existing = notes.find(n => n.title === dateStr);
    if (existing) {
      setActiveNoteId(existing.id!);
      setIsSidebarOpen(true);
    } else {
      const newId = await createNote(currentPageId, dateStr);
      await db.notes.update(newId, { category: 'personal', tags: ['journal', 'daily'] });
      setActiveNoteId(newId);
      setIsSidebarOpen(true);
    }
  };


  /**
   * Imports knowledge graph data from a ZIP package containing JSON schemas and Markdown notes.
   */
  const handleImportZip = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      const file = target.files[0];
      try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        const graphDataFile = loadedZip.file('graph_data.json');
        if (!graphDataFile) {
          throw new Error('graph_data.json not found in the ZIP archive');
        }
        const graphDataStr = await graphDataFile.async('text');
        const graphData = JSON.parse(graphDataStr);

        const importedNotes: Note[] = graphData.notes || [];
        const importedLinks: Link[] = graphData.links || [];

        await db.transaction('rw', [db.notes, db.links], async () => {
          const oldToNewIdMap: Record<number, number> = {};
          
          for (const note of importedNotes) {
            if (note.id === undefined) continue;
            
            const existingNote = await db.notes
              .where('title')
              .equalsIgnoreCase(note.title)
              .and(n => n.pageId === currentPageId)
              .first();
            
            if (existingNote) {
              const mergedTags = Array.from(new Set([...(existingNote.tags || []), ...(note.tags || [])]));
              const mergedContent = existingNote.content 
                ? (existingNote.content.includes(note.content) ? existingNote.content : `${existingNote.content}\n\n${note.content}`)
                : note.content;
              
              await db.notes.update(existingNote.id!, {
                tags: mergedTags,
                content: mergedContent,
                updatedAt: Date.now()
              });
              
              oldToNewIdMap[note.id] = existingNote.id!;
              await syncLinksForNote(existingNote.id!, mergedContent);
            } else {
              const newNoteId = await db.notes.add({
                pageId: currentPageId,
                title: note.title,
                content: note.content,
                category: note.category || 'general',
                tags: note.tags || [],
                createdAt: note.createdAt || Date.now(),
                updatedAt: Date.now(),
                visits: note.visits || 0
              });
              oldToNewIdMap[note.id] = newNoteId as number;
            }
          }

          for (const link of importedLinks) {
            const resolvedSourceId = oldToNewIdMap[link.sourceId];
            const resolvedTargetId = oldToNewIdMap[link.targetId];
            
            if (resolvedSourceId !== undefined && resolvedTargetId !== undefined) {
              const existingLink = await db.links
                .where('sourceId')
                .equals(resolvedSourceId)
                .and(l => l.targetId === resolvedTargetId)
                .first();
              
              if (!existingLink) {
                await db.links.add({
                  sourceId: resolvedSourceId,
                  targetId: resolvedTargetId
                });
              }
            }
          }
        });

        showToast('ZIP imported successfully!', 'success');

        // Ingest imported notes into RAG vector index
        const notesForRag = await db.notes.where({ pageId: currentPageId }).toArray();
        for (const note of notesForRag) {
          if (note.content) {
            ingestDocument(`[Note] ${note.title}`, note.content, { source: 'zip-import', noteId: note.id }).catch(err => { if (import.meta.env.DEV) console.warn('Document ingestion failed:', err); });
          }
        }
      } catch (err: unknown) {
        showToast(`Failed to import ZIP: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    };
    input.click();
  };

  /**
   * Uploads and parses external documents (PDF, TXT, MD, DOCX, CSV) and runs AI decomposition into linked graph notes.
   */
  const handleUploadDocument = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.pdf,.docx,.pptx,.csv';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      const file = target.files[0];

      // File size validation (max 25MB)
      const { validateFileSize, guardUntrustedContent } = await import('./utils/security');
      if (!validateFileSize(file, 25 * 1024 * 1024)) {
        showToast('File size exceeds the 25MB safety limit.', 'error');
        return;
      }

      setDocLoading(true);
      setDocStatus('Reading document...');

      try {
        let textContent = '';
        if (file.name.endsWith('.pdf')) {
          setDocStatus('Extracting PDF text...');
          const { extractTextFromPDF } = await import('./utils/pdf');
          textContent = await extractTextFromPDF(file);
        } else {
          textContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string || '');
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
          });
        }

        if (!textContent.trim()) {
          throw new Error('Document content is empty');
        }

        // Step 1: Ingest into RAG for unified search
        setDocStatus('Indexing for search...');
        await ingestDocument(file.name, textContent, { source: 'upload' }, (msg) => {
          setDocStatus(msg);
        });

        // Step 2: AI decomposition into linked notes
        const { parseAiResponse, executeAiAction } = await import('./utils/aiActions');
        const { callAI, getAIConfig } = await import('./utils/aiClient');

        // Check if AI is configured
        const aiConfig = getAIConfig();
        if (!aiConfig.apiKey && aiConfig.provider !== 'custom') {
          showToast('AI not configured — document indexed for search only. Add an API key in Settings to enable note creation.', 'info');
          return;
        }

        const maxChars = 15000;
        const chunks: string[] = [];
        let currentPos = 0;
        while (currentPos < textContent.length) {
          let nextPos = currentPos + maxChars;
          if (nextPos >= textContent.length) {
            chunks.push(textContent.slice(currentPos));
            break;
          }
          const searchArea = textContent.slice(Math.max(currentPos, nextPos - 3000), nextPos);
          let breakIdx = searchArea.lastIndexOf('\n\n');
          if (breakIdx === -1) breakIdx = searchArea.lastIndexOf('\n');
          if (breakIdx === -1) breakIdx = searchArea.lastIndexOf('. ');
          if (breakIdx !== -1) nextPos = Math.max(currentPos, nextPos - 3000) + breakIdx + 1;
          chunks.push(textContent.slice(currentPos, nextPos));
          currentPos = nextPos;
        }

        const createdNodes: { title: string; content: string }[] = [];
        let aiErrors = 0;

        for (let i = 0; i < chunks.length; i++) {
          setDocStatus(`Analyzing chunk ${i + 1}/${chunks.length}...`);
          const existingTitles = createdNodes.map(n => n.title).join(', ');
          const systemPrompt = `You are a knowledge graph architect. Analyze the document and extract key concepts as notes with links.
Output ONLY a JSON block. Rules:
- Use rich Markdown in note content (bold, headings, lists, code blocks)
- Connect notes via create_link actions, NOT via footer lists
- Use [[Title]] only for inline references

Format:
\`\`\`json
[
  { "action": "create_note", "title": "Concept A", "content": "Detailed explanation...", "tags": ["tag1"] },
  { "action": "create_link", "from": "Concept A", "to": "Concept B" }
]
\`\`\``;
          const guardedChunk = guardUntrustedContent(chunks[i], {
            title: file.name,
            source: file.name,
            type: file.name.endsWith('.pdf') ? 'pdf' : 'txt'
          });

          let userPrompt = `Analyze this chunk and create notes + links:\n`;
          if (existingTitles) userPrompt += `Existing notes: ${existingTitles}\n`;
          userPrompt += `\n${guardedChunk}`;

          try {
            let aiResponse = '';
            await callAI(systemPrompt, userPrompt, (text) => { aiResponse = text; });
            const parsed = parseAiResponse(aiResponse);
            if (parsed && parsed.actions.length > 0) {
              for (const action of parsed.actions) {
                // Safety guard: only permit constructive creation actions during file ingestion
                if (action.action === 'create_note' || action.action === 'create_link') {
                  await executeAiAction(action, currentPageId);
                  if (action.action === 'create_note') {
                    const existing = createdNodes.find(n => n.title === action.title);
                    if (existing) existing.content += `\n\n${action.content}`;
                    else createdNodes.push({ title: action.title, content: action.content });
                  }
                }
              }
            } else {
              aiErrors++;
              if (import.meta.env.DEV) console.warn(`Chunk ${i + 1}: AI response contained no actionable JSON`, aiResponse.substring(0, 200));
            }
          } catch (chunkErr) {
            if (import.meta.env.DEV) console.error(`AI failed on chunk ${i + 1}:`, chunkErr);
            aiErrors++;
          }
        }

        // Final linking pass
        if (createdNodes.length > 1) {
          setDocStatus('Linking concepts...');
          const summaries = createdNodes.map(n => `- **${n.title}**: ${n.content.substring(0, 200)}`).join('\n');
          try {
            const linkResponse = await callAI(
              'Output a JSON array of create_link actions to connect related concepts. Format: [{"action":"create_link","from":"A","to":"B"}]',
              `Connect these:\n${summaries}`
            );
            const linkParsed = parseAiResponse(linkResponse);
            if (linkParsed?.actions.length) {
              for (const action of linkParsed.actions) await executeAiAction(action, currentPageId);
            }
          } catch (e) {
            if (import.meta.env.DEV) console.warn('Linking pass failed', e);
          }
        }

        if (createdNodes.length > 0) {
          showToast(`"${file.name}" processed — ${createdNodes.length} notes created!`, 'success');
        } else if (aiErrors > 0) {
          showToast(`Document indexed but AI couldn't create notes. Check your AI settings.`, 'error');
        } else {
          showToast(`"${file.name}" indexed for search.`, 'success');
        }
      } catch (err: unknown) {
        showToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        setDocLoading(false);
        setDocStatus('');
      }
    };
    input.click();
  };

  /**
   * Handles pointer drag on the sidebar resize splitter handle.
   *
   * @param {React.MouseEvent} e - Mouse down event on the resize handle.
   */
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(1200, startWidth - (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  /**
   * Handles keyboard navigation (ArrowLeft / ArrowRight) on the sidebar resize handle for accessibility.
   *
   * @param {React.KeyboardEvent} e - Keyboard event on the resize handle.
   */
  const handleResizerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth(Math.max(300, sidebarWidth - 20));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth(Math.min(1200, sidebarWidth + 20));
    }
  };


  return (
    <div className="app-container">
      {/* Header Bar — Floating Glass Island Navigation */}
      <header className="app-header glass-panel d-flex align-items-center justify-content-between px-3 mx-2 mx-md-3 mt-2 mt-md-3">
        {/* Left Brand & Page Section */}
        <div className="d-flex align-items-center gap-2">
          <div className="app-logo d-flex align-items-center gap-2 flex-shrink-0" onClick={() => handleSelectNote(null)}>
            <Brain size={22} className="logo-icon" />
            <h1 className="d-none d-md-block" style={{ margin: 0 }}>AetherMind</h1>
          </div>

          {/* Page Selector — md+ full dropdown */}
          <div className="d-none d-md-flex align-items-center gap-1 ms-2 ps-2" style={{ borderLeft: '1px solid var(--border-color)' }}>
            <Dropdown
              value={currentPageId}
              onChange={(val) => setCurrentPageId(Number(val))}
              options={pages.map(p => ({ value: p.id!, label: p.title }))}
              style={{ minWidth: '140px' }}
            />
            <button className="page-action-btn" onClick={() => setShowRenamePage(true)} aria-label="Rename Page" title="Rename Page">
              <Edit2 size={13} />
            </button>
            <button className="page-action-btn" onClick={handleDeletePage} aria-label="Delete Page" title="Delete Page" disabled={pages.length <= 1}>
              <Trash2 size={13} style={{ color: pages.length <= 1 ? 'inherit' : 'var(--accent-danger, #f43f5e)' }} />
            </button>
          </div>

          {/* Mobile Page Selector (sm only) */}
          <div className="d-flex d-md-none align-items-center gap-1">
            <Dropdown
              value={currentPageId}
              onChange={(val) => setCurrentPageId(Number(val))}
              options={pages.map(p => ({ value: p.id!, label: p.title }))}
              style={{ maxWidth: '110px' }}
            />
            <button className="page-action-btn" onClick={() => setShowRenamePage(true)} aria-label="Rename Page">
              <Edit2 size={12} />
            </button>
          </div>
        </div>

        {/* Center Spotlight Search Pill (md+ only) */}
        <div 
          className="header-search-pill d-none d-md-flex" 
          onClick={() => setShowCommandPalette(true)}
          title={`Search notes and commands (${formatShortcut('K')})`}
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <span>Search notes...</span>
          <span className="kbd-badge">{formatShortcutBadge('K')}</span>
        </div>

        {/* Right Header Action Dock */}
        <div className="header-controls d-flex align-items-center gap-1 gap-md-2 flex-shrink-0" style={{ overflow: 'visible' }}>
          {/* Review & Discovery */}
          <button className="header-btn d-none d-lg-inline-flex" onClick={() => setShowReview(true)} title="Spaced Repetition Review">
            <Brain size={15} /> Review
          </button>
          <button className="header-btn d-none d-lg-inline-flex" onClick={() => setShowDiscoveryDigest(true)} title="Discovery Digest">
            <Compass size={15} /> Discovery
          </button>
          <button className="header-btn d-lg-none" onClick={() => setShowReview(true)} title="Review">
            <Brain size={15} />
          </button>

          {/* Ask AI with golden sparkle beacon */}
          <button className="header-btn" onClick={() => setShowAskAi(true)} style={{ color: 'var(--node-amber)' }} title="Ask AI Copilot">
            <Sparkles size={15} />
          </button>

          {/* Daily Note */}
          <button className="header-btn" onClick={handleCreateDailyNote} title="Today's Daily Note">
            <Calendar size={15} />
          </button>

          {/* Import / Document — md+ */}
          <button className="header-btn d-none d-md-inline-flex" onClick={handleImportZip} title="Import Markdown ZIP">
            <FileArchive size={15} />
          </button>
          <button className="header-btn d-none d-md-inline-flex" onClick={handleUploadDocument} title="Upload Document" aria-label="Upload Document">
            <FileUp size={15} />
          </button>

          {/* New Page (+) */}
          <button className="header-btn primary-btn" onClick={() => setShowNewPage(true)} title="Create New Page">
            <Plus size={15} />
          </button>

          {/* Settings */}
          <button className="header-btn" onClick={() => setShowSettings(true)} title="Settings & Appearance">
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Main Workspace Dashboard */}
      <main className="app-workspace overflow-hidden">
        {/* Left Side: Graph Canvas & Overlay Filters */}
        <div className="left-viewport">

          {/* Floating Search Filter overlay */}
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            notes={notes}
            categories={categories}
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
          />

          {/* D3 Graph Canvas */}
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><Loader2 className="spinning" size={32} /></div>}>
            <GraphCanvas
              notes={historicalSnapshot ? historicalSnapshot.notes : notes}
              links={historicalSnapshot ? historicalSnapshot.links : links}
              categories={categories}
              activeNote={activeNote}
              onSelectNote={handleSelectNote}
              onCreateNote={(x, y) => handleCreateNote(x, y)}
              searchQuery={searchQuery}
              selectedTags={selectedTags}
              dateRange={historicalSnapshot ? null : dateRange}
              physicsConfig={physicsConfig}
              isSidebarOpen={isSidebarOpen}
              onOpenSidebar={() => setIsSidebarOpen(true)}
              onOpenSearch={() => setIsSearchOpen(!isSearchOpen)}
              onCloseSearch={() => setIsSearchOpen(false)}
              nlpClustering={nlpClustering && !historicalSnapshot}
              pageTitle={pages.find(p => p.id === currentPageId)?.title}
            />
          </Suspense>

          {/* Floating Timeline Slider scrubber — hidden on mobile when a note is open */}
          {(viewport !== 'sm' || !activeNote) && (
            <TimelineSlider
              notes={historicalSnapshot ? historicalSnapshot.notes : notes}
              dateRange={historicalSnapshot ? null : dateRange}
              setDateRange={setDateRange}
              historicalSnapshot={historicalSnapshot}
              onRestoreFromHistory={historicalSnapshot ? handleRestoreFromHistory : undefined}
              onExitHistory={historicalSnapshot ? () => setHistoricalSnapshot(null) : undefined}
            />
          )}
        </div>

        {/* Right Side: Markdown Editor Sidebar panel */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={viewport === 'sm' ? { y: '100%', opacity: 0 } : { width: 0, opacity: 0 }}
              animate={viewport === 'sm' ? { y: 0, opacity: 1 } : { width: sidebarWidth, opacity: 1 }}
              exit={viewport === 'sm' ? { y: '100%', opacity: 0 } : { width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`right-sidebar open`}
              style={{ 
                display: 'flex',
                flexDirection: 'row',
                overflow: 'hidden'
              } as React.CSSProperties}
            >
              <div className="sidebar-resizer" onMouseDown={startResizing} onKeyDown={handleResizerKeyDown} role="separator" aria-orientation="vertical" aria-valuenow={sidebarWidth} aria-valuemin={300} aria-valuemax={1200} tabIndex={0} aria-label="Resize sidebar" style={{ left: 0, touchAction: 'none' }} />

          <div style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%' }}>
            <EditorPanel
              note={activeNote}
              links={links}
              categories={categories}
              onClose={() => {
                handleSelectNote(null);
                setIsSidebarOpen(false);
              }}
              onNoteDeleted={handleNoteDeleted}
              onJumpToNote={handleJumpToNote}
              onSplitRight={isDesktop ? (title) => {
                const target = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
                if (target) setSecondaryNoteId(target.id!);
              } : undefined}
            />
          </div>

          {isDesktop && secondaryNote && (
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', borderLeft: '1px solid var(--border-color)' }}>
              <EditorPanel
                note={secondaryNote}
                links={links}
                categories={categories}
                onClose={() => setSecondaryNoteId(null)}
                onNoteDeleted={() => setSecondaryNoteId(null)}
                onJumpToNote={handleJumpToNote}
                onSplitRight={isDesktop ? (title) => {
                  const target = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
                  if (target) setSecondaryNoteId(target.id!);
                } : undefined}
              />
            </div>
          )}
        </motion.div>
        )}
        </AnimatePresence>
      </main>

      {viewport === 'sm' && activeNote && !isSidebarOpen && (
        <NoteMiniCard 
          note={activeNote}
          category={categories.find(c => c.id === activeNote.category)}
          onOpenEditor={() => setIsSidebarOpen(true)}
          onJumpToNote={(title) => {
            const target = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
            if (target) handleSelectNote(target);
          }}
          onClose={() => handleSelectNote(null)}
        />
      )}


      {showMobileMenu && viewport === 'sm' && (
        <div className="mobile-menu-drawer">
          <div className="mobile-menu-items">
            <button className="header-btn mobile-menu-btn" onClick={() => { setShowReview(true); setShowMobileMenu(false); }}>
              <Brain size={18} /> Review
            </button>
            <button className="header-btn mobile-menu-btn" onClick={() => { setShowDiscoveryDigest(true); setShowMobileMenu(false); }}>
              <Compass size={18} /> Discovery Digest
            </button>
            <button className="header-btn mobile-menu-btn" onClick={() => { setShowAskAi(true); setShowMobileMenu(false); }}>
              <Sparkles size={18} /> Ask AI
            </button>
            <button className="header-btn mobile-menu-btn" onClick={() => { handleCreateDailyNote(); setShowMobileMenu(false); }}>
              <Calendar size={18} /> Daily Note
            </button>
            <button className="header-btn mobile-menu-btn" onClick={() => { handleImportZip(); setShowMobileMenu(false); }}>
              <FileArchive size={18} /> Import ZIP
            </button>
            <button className="header-btn mobile-menu-btn" onClick={() => { handleUploadDocument(); setShowMobileMenu(false); }}>
              <FileUp size={18} /> Upload Document
            </button>
            <button className="header-btn mobile-menu-btn" onClick={() => { setShowSettings(true); setShowMobileMenu(false); }}>
              <Settings size={18} /> Settings
            </button>
          </div>
        </div>
      )}

      {viewport === 'sm' && (
        <MobileNav 
          activeTab={isSidebarOpen ? 'editor' : (isSearchOpen ? 'search' : (showMobileMenu ? 'menu' : 'graph'))}
          onTabChange={(tab) => {
            switch (tab) {
              case 'graph':
                // Reset all overlay windows back to graph canvas
                setIsSidebarOpen(false);
                setIsSearchOpen(false);
                setShowMobileMenu(false);
                break;
              case 'editor':
                // If editor is already open, close it; otherwise open it
                if (isSidebarOpen) {
                  setIsSidebarOpen(false);
                } else {
                  setIsSidebarOpen(true);
                  setIsSearchOpen(false);
                  setShowMobileMenu(false);
                }
                break;
              case 'search':
                // If search is already open, close it; otherwise open it
                if (isSearchOpen) {
                  setIsSearchOpen(false);
                } else {
                  setIsSearchOpen(true);
                  setIsSidebarOpen(false);
                  setShowMobileMenu(false);
                }
                break;
              case 'menu':
                // Toggle mobile menu drawer
                setShowMobileMenu(prev => !prev);
                break;
            }
          }}
          onNewPage={() => setShowNewPage(prev => !prev)}
        />
      )}

      {/* Backup and settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSelectNote={(title) => {
            setShowSettings(false);
            handleJumpToNote(title);
          }}
          onRefreshData={() => {
            setActiveNoteId(null);
            setHistoricalSnapshot(null);
          }}
          physicsConfig={physicsConfig}
          onPhysicsChange={handlePhysicsChange}
          categories={categories}
          nlpClustering={nlpClustering}
          onNlpClusteringChange={(val) => {
            setNlpClustering(val);
            localStorage.setItem('aethermind-nlp-clustering', String(val));
          }}
          activePageId={currentPageId}
          pageTitle={pages.find(p => p.id === currentPageId)?.title}
          onSaveSnapshot={handleSaveSnapshot}
          onViewSnapshots={handleBrowseSnapshots}
          activeTheme={activeTheme}
          onThemeSelect={setActiveTheme}
          customThemeColors={customThemeColors}
          onCustomThemeColorChange={(key, val) => {
            const next = { ...customThemeColors, [key]: val };
            applyCustomThemeLive(next);
            setCustomThemeColors(next);
          }}
          onCustomThemeReset={() => {
            applyCustomThemeLive(DEFAULT_CUSTOM_COLORS);
            setCustomThemeColors(DEFAULT_CUSTOM_COLORS);
          }}
        />
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        notes={notes}
        categories={categories}
        onSelectNote={handleJumpToNote}
        onOpenAskAi={() => setShowAskAi(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenNewNote={() => handleCreateNote(0, 0)}
        onOpenReview={() => setShowReview(true)}
        onOpenJournal={handleCreateDailyNote}
      />

      {/* Ask AI Modal */}
      <AskAiModal
        isOpen={showAskAi}
        onClose={() => setShowAskAi(false)}
        activePageId={currentPageId}
        onJumpToNote={handleJumpToNote}
      />

      {/* NewPageModal */}
      <NewPageModal
        isOpen={showNewPage}
        onClose={() => setShowNewPage(false)}
        onCreate={async (userTitle: string) => {
          let finalTitle = userTitle;
          let index = 1;
          const allPages = await db.pages.toArray();
          while (allPages.some((p) => p.title.toLowerCase() === finalTitle.toLowerCase())) {
            finalTitle = `${userTitle} (${index})`;
            index++;
          }
          const id = await db.pages.add({ title: finalTitle, createdAt: Date.now() });
          setCurrentPageId(id as number);
          setShowNewPage(false);
          setActiveNoteId(null);
        }}
      />
      {showRenamePage && (
        <RenamePageModal
          isOpen={showRenamePage}
          onClose={() => setShowRenamePage(false)}
          pageId={currentPageId}
          currentTitle={pages.find(p => p.id === currentPageId)?.title || ''}
        />
      )}
      {showReview && <ReviewModal onClose={() => setShowReview(false)} />}
      {currentPageId && (
        <ConfirmModal
          isOpen={showDeletePageConfirm}
          title="Delete Page"
          message={`Delete page "${pages.find(p => p.id === currentPageId)?.title || 'Untitled'}" and all its notes? This cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          isDestructive
          onConfirm={confirmDeletePage}
          onCancel={() => setShowDeletePageConfirm(false)}
        />
      )}
      {showDiscoveryDigest && (
        <DiscoveryDigestModal 
          isOpen={showDiscoveryDigest} 
          onClose={() => setShowDiscoveryDigest(false)} 
          notes={notes} 
        />
      )}
      {promptConfig && (
        <PromptModal
          title={promptConfig.title}
          message={promptConfig.message}
          onConfirm={(val) => {
            promptConfig.onConfirm(val);
            setPromptConfig(null);
          }}
          onCancel={handlePromptCancel}
        />
      )}
      {docLoading && (
        <div className="modal-overlay doc-loading-overlay !flex !items-center !justify-center !p-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="doc-loading-card premium-loader-card glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
            <div className="doc-loading-animation">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <defs>
                  <linearGradient id="synGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-primary)" />
                    <stop offset="100%" stopColor="var(--accent-secondary)" />
                  </linearGradient>
                </defs>
                <circle cx="40" cy="15" r="5" fill="var(--accent-primary)">
                  <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="15" cy="55" r="5" fill="var(--accent-secondary)">
                  <animate attributeName="r" values="5;7;5" dur="2s" begin="0.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="65" cy="55" r="5" fill="var(--accent-gold)">
                  <animate attributeName="r" values="5;7;5" dur="2s" begin="1s" repeatCount="indefinite" />
                </circle>
                <line x1="40" y1="15" x2="15" y2="55" stroke="url(#synGrad)" strokeWidth="2" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="20;0" dur="2s" repeatCount="indefinite" />
                </line>
                <line x1="40" y1="15" x2="65" y2="55" stroke="url(#synGrad)" strokeWidth="2" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="20;0" dur="2s" repeatCount="indefinite" />
                </line>
                <line x1="15" y1="55" x2="65" y2="55" stroke="url(#synGrad)" strokeWidth="2" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="0;20" dur="2s" repeatCount="indefinite" />
                </line>
              </svg>
            </div>
            <div className="doc-loading-text">
              <h3>Processing Document</h3>
              <p className="doc-loading-status">{docStatus}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

