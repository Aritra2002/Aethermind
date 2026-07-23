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

import { Brain, Plus, Settings, Calendar, Sparkles, Edit2, Trash2, Loader2, Compass, FileArchive, FileUp } from 'lucide-react';

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

export default function App() {
  const { showToast } = useToast();
  const [promptConfig, setPromptConfig] = useState<{title: string, message: string, onConfirm: (v: string)=>void} | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [secondaryNoteId, setSecondaryNoteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[number, number] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showRenamePage, setShowRenamePage] = useState(false);
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDiscoveryDigest, setShowDiscoveryDigest] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const viewport = useViewport();
  const isDesktop = viewport === 'lg';
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const handlePromptCancel = useCallback(() => setPromptConfig(null), []);
  const [docLoading, setDocLoading] = useState(false);
  const [docStatus, setDocStatus] = useState('');

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<number>(1);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('aethermind-sidebar-width');
    return saved ? parseInt(saved, 10) : 420;
  });
  const [physicsConfig, setPhysicsConfig] = useState(() => {
    const saved = localStorage.getItem('aethermind-physics');
    return saved ? JSON.parse(saved) : { linkDistance: 120, chargeStrength: -150 };
  });
  const [nlpClustering, setNlpClustering] = useState(() => localStorage.getItem('aethermind-nlp-clustering') === 'true');

  // Graph Snapshot historical mode
  const [historicalSnapshot, setHistoricalSnapshot] = useState<{ notes: Note[]; links: Link[]; timestamp: number } | null>(null);

  // Multi-theme state
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    return localStorage.getItem('aethermind-theme') || 'dark';
  });

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
    
    const root = document.documentElement;
    if (activeTheme === 'custom') {
      const defaults: Record<string, string> = {
        bgPrimary: '#06071a',
        sidebarBg: '#0f1428',
        textPrimary: '#ffffff',
        accentPrimary: '#7c3aed',
        accentSecondary: '#06b6d4',
        linkColor: '#ffffff4d',
        fontFamily: 'sans'
      };
      
      const keys = ['bgPrimary', 'sidebarBg', 'textPrimary', 'accentPrimary', 'accentSecondary', 'linkColor', 'fontFamily'];
      keys.forEach((key) => {
        const val = customThemeColors[key] || defaults[key];
        
        if (key === 'fontFamily') {
          const fontMap: Record<string, string> = {
            'sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            'inter': "'Inter', system-ui, -apple-system, sans-serif",
            'outfit': "'Outfit', system-ui, -apple-system, sans-serif",
            'serif': "'Playfair Display', Georgia, serif",
            'lora': "'Lora', Georgia, serif",
            'merriweather': "'Merriweather', Georgia, serif",
            'cinzel': "'Cinzel', serif",
            'jetbrains-mono': "'JetBrains Mono', monospace",
            'fira-code': "'Fira Code', monospace"
          };
          const fontVal = fontMap[val] || fontMap['sans'];
          root.style.setProperty('--font-sans', fontVal);
        } else {
          const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
          root.style.setProperty(cssVar, val);
        }
        
        // If background color is customized, map it to gradients and other properties
        if (key === 'bgPrimary') {
          root.style.setProperty('--bg-gradient-1', val);
          root.style.setProperty('--bg-gradient-2', val);
          root.style.setProperty('--bg-gradient-3', val);
        }
        // If sidebarBg is customized, map it to surface variables
        if (key === 'sidebarBg') {
          root.style.setProperty('--surface-glass', val + 'cc'); // 80% opacity
          root.style.setProperty('--surface-glass-heavy', val + 'da'); // 85% opacity
          root.style.setProperty('--surface-glass-light', val + '99'); // 60% opacity
          root.style.setProperty('--surface-card', val);
          root.style.setProperty('--glass-panel-bg-1', val);
          root.style.setProperty('--glass-panel-bg-2', val);
        }
        // If text color is customized, map it to secondary text too
        if (key === 'textPrimary') {
          root.style.setProperty('--text-secondary', val + 'b3'); // roughly 70% opacity
        }
        // If accent color is customized, map it to link highlight too
        if (key === 'accentPrimary') {
          root.style.setProperty('--link-highlight', val);
          root.style.setProperty('--border-glow', val + '33'); // roughly 20% opacity
        }
      });
    } else {
      // Clear custom theme attributes if presets are selected
      const allKeys = [
        'bgPrimary', 'sidebarBg', 'textPrimary', 'accentPrimary', 'accentSecondary', 'linkColor', 'fontFamily',
        'bg-gradient-1', 'bg-gradient-2', 'bg-gradient-3', 'text-secondary', 'link-highlight', 'border-glow', 'link-color',
        'surface-glass', 'surface-glass-heavy', 'surface-glass-light', 'surface-card', 'glass-panel-bg-1', 'glass-panel-bg-2'
      ];
      allKeys.forEach((key) => {
        const cssVar = key.includes('-') ? '--' + key : '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.removeProperty(cssVar);
      });
      root.style.removeProperty('--font-sans');
    }
    const prev = localStorage.getItem('aethermind-custom-themes');
    const next = JSON.stringify(customThemeColors);
    if (prev !== next) localStorage.setItem('aethermind-custom-themes', next);
  }, [activeTheme, customThemeColors]);

  useEffect(() => {
    localStorage.setItem('aethermind-sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  const handlePhysicsChange = (newConfig: { linkDistance: number; chargeStrength: number }) => {
    setPhysicsConfig(newConfig);
    localStorage.setItem('aethermind-physics', JSON.stringify(newConfig));
  };

  // Snapshot auto-save every 10 minutes
  useEffect(() => {
    if (historicalSnapshot) return;
    const interval = setInterval(async () => {
      try {
        await saveSnapshot(currentPageId);
      } catch {
        // Ignore auto-save errors
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentPageId, historicalSnapshot]);

  const handleSaveSnapshot = async () => {
    try {
      const id = await saveSnapshot(currentPageId);
      showToast(`Snapshot saved (ID: ${id})`, 'success');
    } catch (e: unknown) {
      showToast("Failed to save snapshot: " + (e instanceof Error ? e.message : String(e)), "error");
    }
  };

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
          const idx = parseInt(restoreMatch[1]) - 1;
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
        const idx = parseInt(input) - 1;
        if (idx >= 0 && idx < snapshots.length) {
          const data = await loadSnapshot(snapshots[idx].id!);
          if (data) {
            setHistoricalSnapshot({ notes: data.notes, links: data.links, timestamp: data.timestamp });
          }
        }
      }
    });
  };

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

  // Seed database on app mount
  useEffect(() => {
    seedDatabase().catch(e => console.error('Seed failed', e));
  }, []);

  // Command Palette Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
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
  
  // Fetch links relevant to current notes
  const links = useLiveQuery(async () => {
    const currentNotes = await db.notes.where({ pageId: currentPageId }).toArray();
    const currentIds = new Set(currentNotes.map(n => n.id));
    const allLinks = await db.links.toArray();
    return allLinks.filter(l => currentIds.has(l.sourceId) && currentIds.has(l.targetId));
  }, [currentPageId]) || [];

  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Find current active note object
  const activeNote = notes.find((n) => n.id === activeNoteId) || null;
  const secondaryNote = notes.find((n) => n.id === secondaryNoteId) || null;

  const handleSelectNote = async (note: Note | null) => {
    if (note) {
      if (activeNoteId && activeNoteId !== note.id && isSidebarOpen) {
        // If we already have one open, maybe we want to split? 
        // For now, selecting from graph replaces primary unless we specifically split.
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

  // Handles creating a new note (e.g. double-click canvas or sidebar button)
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

  const handleDeletePage = async () => {
    if (pages.length <= 1) return;
    setShowDeletePageConfirm(true);
  };

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

  // Jumps to note by title (handles wiki-link click events)
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

  const handleNoteDeleted = () => {
    setActiveNoteId(null);
  };

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

        // Ingest imported notes into RAG
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

  const handleUploadDocument = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.pdf,.docx,.pptx,.csv';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      const file = target.files[0];

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
          let userPrompt = `Analyze this chunk and create notes + links:\n`;
          if (existingTitles) userPrompt += `Existing notes: ${existingTitles}\n`;
          userPrompt += `\n---\n${chunks[i]}\n---`;

          try {
            let aiResponse = '';
            await callAI(systemPrompt, userPrompt, (text) => { aiResponse = text; });
            const parsed = parseAiResponse(aiResponse);
            if (parsed && parsed.actions.length > 0) {
              for (const action of parsed.actions) {
                await executeAiAction(action, currentPageId);
                if (action.action === 'create_note') {
                  const existing = createdNodes.find(n => n.title === action.title);
                  if (existing) existing.content += `\n\n${action.content}`;
                  else createdNodes.push({ title: action.title, content: action.content });
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
      {/* Header Bar — Bootstrap responsive layout */}
      <header className="app-header glass-panel d-flex align-items-center px-2 px-md-3 mx-2 mx-md-3 mt-2 mt-md-3" style={{ flexWrap: 'nowrap', height: '64px' }}>
        {/* Logo — icon always, title md+ */}
        <div className="app-logo d-flex align-items-center gap-2 flex-shrink-0">
          <Brain size={24} className="logo-icon" />
          <h1 className="d-none d-md-block" style={{ margin: 0 }}>AetherMind</h1>
        </div>

        {/* Page Selector — md+ shows full, sm shows compact centered */}
        <div className="d-none d-md-flex align-items-center gap-2 ms-3 ps-3" style={{ borderLeft: '1px solid var(--border-color)' }}>
          <Dropdown
            value={currentPageId}
            onChange={(val) => setCurrentPageId(Number(val))}
            options={pages.map(p => ({ value: p.id!, label: p.title }))}
            style={{ minWidth: '150px' }}
          />
          <button className="page-action-btn" onClick={() => setShowRenamePage(true)} aria-label="Rename Page" title="Rename Page">
            <Edit2 size={14} />
          </button>
          <button className="page-action-btn" onClick={handleDeletePage} aria-label="Delete Page" title="Delete Page" disabled={pages.length <= 1}>
            <Trash2 size={14} style={{ color: pages.length <= 1 ? 'inherit' : 'var(--accent-danger, #f43f5e)' }} />
          </button>
        </div>

        {/* Page Selector — mobile (sm only, centered) */}
        <div className="d-flex d-md-none align-items-center gap-1 mx-auto">
          <Dropdown
            value={currentPageId}
            onChange={(val) => setCurrentPageId(Number(val))}
            options={pages.map(p => ({ value: p.id!, label: p.title }))}
            style={{ maxWidth: '120px' }}
          />
          <button className="page-action-btn" onClick={() => setShowRenamePage(true)} aria-label="Rename Page" title="Rename Page">
            <Edit2 size={14} />
          </button>
          <button className="page-action-btn" onClick={handleDeletePage} aria-label="Delete Page" title="Delete Page" disabled={pages.length <= 1}>
            <Trash2 size={14} style={{ color: pages.length <= 1 ? 'inherit' : 'var(--accent-danger, #f43f5e)' }} />
          </button>
        </div>

        {/* Header Controls — responsive visibility */}
        <div className="header-controls d-flex align-items-center gap-1 gap-md-2 ms-auto flex-shrink-0" style={{ overflow: 'visible' }}>
          {/* Review + Discovery Digest — icon-only on md, label on lg+ */}
          <button className="header-btn d-none d-lg-inline-flex" onClick={() => setShowReview(true)} title="Review">
            <Brain size={16} /> Review
          </button>
          <button className="header-btn d-none d-lg-inline-flex" onClick={() => setShowDiscoveryDigest(true)} title="Discovery Digest">
            <Compass size={16} /> Discovery Digest
          </button>
          <button className="header-btn d-lg-none" onClick={() => setShowReview(true)} title="Review">
            <Brain size={16} />
          </button>
          <button className="header-btn d-lg-none" onClick={() => setShowDiscoveryDigest(true)} title="Discovery Digest">
            <Compass size={16} />
          </button>

          {/* Ask AI */}
          <button className="header-btn" onClick={() => setShowAskAi(true)} style={{ color: 'var(--node-amber)' }} title="Ask AI">
            <Sparkles size={16} />
          </button>
          {/* Daily Note */}
          <button className="header-btn" onClick={handleCreateDailyNote} title="Daily Note">
            <Calendar size={16} />
          </button>
          {/* Import ZIP — md+ */}
          <button className="header-btn d-none d-md-inline-flex" onClick={handleImportZip} title="Import ZIP">
            <FileArchive size={16} />
          </button>
          {/* Upload Document — md+ */}
          <button className="header-btn d-none d-md-inline-flex" onClick={handleUploadDocument} title="Upload Document">
            <FileUp size={16} />
          </button>
          {/* New Page */}
          <button className="header-btn primary-btn" onClick={() => setShowNewPage(true)} title="New Page">
            <Plus size={16} />
          </button>
          {/* Settings */}
          <button className="header-btn" onClick={() => setShowSettings(true)} title="Settings">
            <Settings size={16} />
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
                setIsSidebarOpen(false);
                setIsSearchOpen(false);
                setShowMobileMenu(false);
                break;
              case 'editor':
                setIsSidebarOpen(true);
                setIsSearchOpen(false);
                setShowMobileMenu(false);
                break;
              case 'search':
                setIsSearchOpen(true);
                setIsSidebarOpen(false);
                setShowMobileMenu(false);
                break;
              case 'menu':
                setShowMobileMenu(!showMobileMenu);
                break;
            }
          }}
          onNewPage={() => setShowNewPage(true)}
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
            setCustomThemeColors((prev: Record<string, string>) => ({ ...prev, [key]: val }));
          }}
          onCustomThemeReset={() => {
            setCustomThemeColors({
              bgPrimary: '#06071a',
              sidebarBg: '#0f1428',
              textPrimary: '#ffffff',
              accentPrimary: '#7c3aed',
              accentSecondary: '#06b6d4',
              linkColor: '#ffffff4d',
              fontFamily: 'sans'
            });
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
      />

      {/* Ask AI Modal */}
      <AskAiModal
        isOpen={showAskAi}
        onClose={() => setShowAskAi(false)}
        activePageId={currentPageId}
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
        <div className="doc-loading-overlay">
          <div className="doc-loading-card glass-panel">
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

