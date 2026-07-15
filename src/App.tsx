import React, { useState, useEffect, lazy, Suspense } from 'react';
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

import { Brain, Plus, Settings, Calendar, Sparkles, Edit2, Trash2, Loader2, Compass, FileArchive, FileUp } from 'lucide-react';
import { callAI } from './utils/aiClient';

function useViewport() {
  const [viewport, setViewport] = useState<'sm' | 'md' | 'lg'>('lg');
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) setViewport('sm');
      else if (width < 1024) setViewport('md');
      else setViewport('lg');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return viewport;
}

import { saveSnapshot, loadSnapshot, getSnapshots, restoreSnapshot } from './utils/snapshotManager';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const viewport = useViewport();
  const isDesktop = viewport === 'lg';
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [docStatus, setDocStatus] = useState('');

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<number>(1);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [physicsConfig, setPhysicsConfig] = useState(() => {
    const saved = localStorage.getItem('aethermind-physics');
    return saved ? JSON.parse(saved) : { linkDistance: 120, chargeStrength: -150 };
  });
  const [nlpClustering, setNlpClustering] = useState(() => localStorage.getItem('aethermind-nlp-clustering') === 'true');

  // Graph Snapshot historical mode
  const [historicalSnapshot, setHistoricalSnapshot] = useState<{ notes: Note[]; links: Link[]; timestamp: number } | null>(null);

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
    } catch (e: any) {
      showToast("Failed to save snapshot: " + e.message, "error");
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
            } catch (e: any) {
              showToast("Restore failed: " + e.message, "error");
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
        await db.notes.where({ pageId: currentPageId }).delete();
        await db.links.clear();
        for (const note of historicalSnapshot.notes) {
          await db.notes.add({ ...note, pageId: currentPageId });
        }
        for (const link of historicalSnapshot.links) {
          await db.links.add(link);
        }
      });
      setHistoricalSnapshot(null);
      setActiveNoteId(null);
      showToast("Restored to historical point!", "success");
    } catch (e: any) {
      showToast("Restore failed: " + e.message, "error");
    }
  };

  // Seed database on app mount
  useEffect(() => {
    seedDatabase();
    
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

  const handleSelectNote = async (note: any | null) => {
    if (note) {
      if (activeNoteId && activeNoteId !== note.id && isSidebarOpen) {
        // If we already have one open, maybe we want to split? 
        // For now, selecting from graph replaces primary unless we specifically split.
        setActiveNoteId(note.id);
      } else {
        setActiveNoteId(note.id);
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
    } catch (e: any) {
      showToast(`Could not create note: ${e.message}`, 'error');
    }
  };

  const handleDeletePage = async () => {
    if (pages.length <= 1) return;
    setShowDeletePageConfirm(true);
  };

  const confirmDeletePage = async () => {
    try {
      await db.transaction('rw', [db.pages, db.notes, db.links], async () => {
        await db.notes.where({ pageId: currentPageId }).delete();
        await db.pages.delete(currentPageId);
      });
      const remaining = pages.filter(p => p.id !== currentPageId);
      if (remaining.length > 0) {
        setCurrentPageId(remaining[0].id!);
      }
      setActiveNoteId(null);
      setHistoricalSnapshot(null);
    } catch (e: any) {
      showToast("Failed to delete page: " + e.message, "error");
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
      } catch (err: any) {
        showToast(`Error opening note: ${err.message}`, 'error');
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
      } catch (err: any) {
        showToast(`Failed to import ZIP: ${err.message}`, 'error');
      }
    };
    input.click();
  };

  const handleUploadDocument = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.pdf';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      const file = target.files[0];
      
      setDocLoading(true);
      setDocStatus('Reading document layout...');
      
      try {
        let textContent = '';
        if (file.name.endsWith('.pdf')) {
          setDocStatus('Extracting text content...');
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

        const maxChars = 15000;
        const chunks = [];
        let currentPos = 0;
        while (currentPos < textContent.length) {
          let nextPos = currentPos + maxChars;
          if (nextPos >= textContent.length) {
            chunks.push(textContent.slice(currentPos));
            break;
          }
          const searchStart = Math.max(currentPos, nextPos - 3000);
          const searchArea = textContent.slice(searchStart, nextPos);

          let breakIndex = searchArea.lastIndexOf('\n\n');
          if (breakIndex === -1) {
            breakIndex = searchArea.lastIndexOf('\n');
          }
          if (breakIndex === -1) {
            breakIndex = searchArea.lastIndexOf('. ');
          }

          if (breakIndex !== -1) {
            nextPos = searchStart + breakIndex + (searchArea.substring(breakIndex).startsWith('\n\n') ? 2 : 1);
          }

          chunks.push(textContent.slice(currentPos, nextPos));
          currentPos = nextPos;
        }

        const { parseAiResponse, executeAiAction } = await import('./utils/aiActions');
        
        // Track nodes created during this process
        const createdNodes: { title: string; content: string }[] = [];

        for (let i = 0; i < chunks.length; i++) {
          setDocStatus(`Running AI conceptual analysis on chunk ${i + 1} of ${chunks.length}...`);

          const existingNodeTitles = createdNodes.map(n => n.title).join(', ');
          const systemPrompt = `You are a conceptual knowledge map architect. You analyze the provided document text and extract key concepts, ideas, terms, or sections.
You must output a JSON list of actions to structure this document into a knowledge graph.
You can create new notes and links between them.
Output ONLY a JSON block containing the actions you want to perform. Do not include any extra text.

CRITICAL RULES:
- NEVER write "Related Notes", "## Related", "## Connections", or similar sections inside note content.
- NEVER append connection/link text at the end of note content.
- To connect notes, ALWAYS use a separate { "action": "create_link", "from": "...", "to": "..." } action.
- Use [[Node Title]] inside content ONLY for inline contextual references, not as a list of related notes.
- Every "linkTo" or "create_link" action must have a corresponding note that exists or will be created.

Write highly detailed, comprehensive content.
When writing notes, aggressively use rich Markdown formatting to structure the content beautifully. You MUST use the following supported syntax:
- **bold**, *italic*, ~~strikethrough~~ for emphasis
- #, ##, ### for clear hierarchical headings
- Bulleted lists (-) and numbered lists (1.) for readability
- Task lists (- [ ]) for action items
- \`inline code\` and \`\`\`language code blocks \`\`\`
- > Blockquotes for important callouts or quotes
- [Link Text](https://...) for external hyperlinks
- [[Node Title]] only for inline contextual references within prose (not as a footer list)

Format:
\`\`\`json
[
  { "action": "create_note", "title": "Concept A", "content": "Detailed explanation of concept A...", "tags": ["tag1"] },
  { "action": "create_note", "title": "Concept B", "content": "Detailed explanation of concept B...", "tags": ["tag2"] },
  { "action": "create_link", "from": "Concept A", "to": "Concept B" }
]
\`\`\`
`;
          let userPrompt = `Please analyze the following document chunk and decompose it into a structured set of notes and links.
`;
          if (existingNodeTitles) {
            userPrompt += `\nFor context, the following notes already exist: ${existingNodeTitles}. You can create links to them or create new notes if necessary.\n`;
          }
          userPrompt += `
--- DOCUMENT START ---
${chunks[i]}
--- DOCUMENT END ---
`;

          try {
            const aiResponse = await callAI(systemPrompt, userPrompt);
            const parsed = parseAiResponse(aiResponse);
            if (parsed && parsed.actions.length > 0) {
              setDocStatus(`Executing actions for chunk ${i + 1}...`);
              for (const action of parsed.actions) {
                await executeAiAction(action, currentPageId);
                if (action.action === 'create_note') {
                  const existing = createdNodes.find(n => n.title === action.title);
                  if (existing) {
                    existing.content += `\n\n${action.content}`;
                  } else {
                    createdNodes.push({ title: action.title, content: action.content });
                  }
                }
              }
            }
          } catch (chunkError: any) {
            console.error(`AI failed on chunk ${i + 1}:`, chunkError);
            showToast(`Skipped chunk ${i + 1} due to AI error: ${chunkError.message}`, 'error');
            // Continue processing the next chunks instead of aborting the whole document
          }
        }

        if (createdNodes.length > 1) {
          setDocStatus('Finalizing connections across all chunks...');
          const systemPromptLinker = `You are a conceptual knowledge map architect. Review the provided list of newly created concepts and their summaries.
Identify missing relationships between them and output a JSON list of link actions to connect related concepts.
Output ONLY a JSON block containing the actions. Do not include any extra text.

Format:
\`\`\`json
[
  { "action": "create_link", "from": "Concept A", "to": "Concept B" }
]
\`\`\`
`;
          const summaries = createdNodes.map(n => `- **${n.title}**: ${n.content.substring(0, 200)}...`).join('\n');
          const userPromptLinker = `Please review the following concepts and generate 'create_link' actions to connect related ones:

${summaries}
`;
          const linkResponse = await callAI(systemPromptLinker, userPromptLinker);
          const linkParsed = parseAiResponse(linkResponse);
          if (linkParsed && linkParsed.actions.length > 0) {
            await db.transaction('rw', [db.notes, db.links], async () => {
              for (const action of linkParsed.actions) {
                if (action.action === 'create_link') {
                  await executeAiAction(action, currentPageId);
                }
              }
            });
          }
        }
        
        showToast('Document uploaded and structured successfully!', 'success');
      } catch (err: any) {
        showToast(`Failed to upload document: ${err.message}`, 'error');
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



  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header glass-panel">
        {viewport === 'sm' && (
          <>
            <div className="app-logo">
              <Brain size={24} className="logo-icon" />
            </div>
            <div className="page-selector" style={{ display: 'flex', alignItems: 'center', margin: '0 auto', gap: '4px' }}>
              <select 
                value={currentPageId} 
                onChange={e => setCurrentPageId(Number(e.target.value))}
                className="page-select-dropdown"
                style={{ maxWidth: '120px' }}
              >
                {pages.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#111827' }}>{p.title}</option>
                ))}
              </select>
              <button className="page-action-btn" onClick={() => setShowRenamePage(true)} title="Rename Page">
                <Edit2 size={14} />
              </button>
              <button className="page-action-btn" onClick={handleDeletePage} title="Delete Page" disabled={pages.length <= 1}>
                <Trash2 size={14} style={{ color: pages.length <= 1 ? 'inherit' : '#f43f5e' }} />
              </button>
            </div>
          </>
        )}
        {viewport === 'md' && (
          <>
            <div className="app-logo">
              <Brain size={24} className="logo-icon" />
              <h1>AetherMind</h1>
            </div>
            <div className="page-selector" style={{ display: 'flex', alignItems: 'center', marginLeft: '16px', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
              <select 
                value={currentPageId} 
                onChange={e => setCurrentPageId(Number(e.target.value))}
                className="page-select-dropdown"
              >
                {pages.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#111827' }}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="header-controls" style={{ marginLeft: 'auto' }}>
              <button className="header-btn icon-only-btn" onClick={() => setShowReview(true)} title="Review">
                <Brain size={16} />
              </button>
              <button className="header-btn icon-only-btn" onClick={() => setShowDiscoveryDigest(true)} title="Discovery Digest">
                <Compass size={16} />
              </button>
              <button className="header-btn icon-only-btn" onClick={() => setShowAskAi(true)} style={{ color: 'var(--node-amber)' }} title="Ask AI">
                <Sparkles size={16} />
              </button>
              <button className="header-btn icon-only-btn" onClick={handleCreateDailyNote} title="Daily Note">
                <Calendar size={16} />
              </button>
              <button className="header-btn icon-only-btn" onClick={handleImportZip} title="Import ZIP">
                <FileArchive size={16} />
              </button>
              <button className="header-btn icon-only-btn" onClick={handleUploadDocument} title="Upload Document">
                <FileUp size={16} />
              </button>

              <button className="header-btn icon-only-btn primary-btn" onClick={() => setShowNewPage(true)} title="New Page">
                <Plus size={16} />
              </button>
              <button className="header-btn icon-only-btn" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings">
                <Settings size={18} />
              </button>
            </div>
          </>
        )}
        {viewport === 'lg' && (
          <>
            <div className="app-logo">
              <Brain size={24} className="logo-icon" />
              <h1>AetherMind</h1>
            </div>
            <div className="page-selector" style={{ display: 'flex', alignItems: 'center', marginLeft: '16px', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
              <select 
                value={currentPageId} 
                onChange={e => setCurrentPageId(Number(e.target.value))}
                className="page-select-dropdown"
              >
                {pages.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#111827' }}>{p.title}</option>
                ))}
              </select>
              <button className="page-action-btn" onClick={() => setShowRenamePage(true)} title="Rename Page">
                <Edit2 size={14} />
              </button>
              <button className="page-action-btn" onClick={handleDeletePage} title="Delete Page" disabled={pages.length <= 1}>
                <Trash2 size={14} style={{ color: pages.length <= 1 ? 'inherit' : '#f43f5e' }} />
              </button>
            </div>
            <div className="header-controls" style={{ marginLeft: 'auto' }}>
              <button className="header-btn" onClick={() => setShowReview(true)}>
                <Brain size={16} /> Review
              </button>
              <button className="header-btn" onClick={() => setShowDiscoveryDigest(true)}>
                <Compass size={16} /> Discovery Digest
              </button>
              <button className="header-btn" onClick={() => setShowAskAi(true)} style={{ color: 'var(--node-amber)' }}>
                <Sparkles size={16} /> Ask AI
              </button>
              <button className="header-btn" onClick={handleCreateDailyNote}>
                <Calendar size={16} /> Daily Note
              </button>
              <button className="header-btn" onClick={handleImportZip} title="Import ZIP">
                <FileArchive size={16} /> <span className="hidden xl:inline">Import ZIP</span>
              </button>
              <button className="header-btn" onClick={handleUploadDocument} title="Upload Document">
                <FileUp size={16} /> <span className="hidden xl:inline">Upload Document</span>
              </button>

              <button className="header-btn primary-btn" onClick={() => setShowNewPage(true)}>
                <Plus size={16} /> New Page
              </button>
              <button className="header-btn icon-only-btn" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings">
                <Settings size={18} />
              </button>
            </div>
          </>
        )}
      </header>

      {/* Main Workspace Dashboard */}
      <main className="app-workspace">
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

          {/* Floating Timeline Slider scrubber */}
          <TimelineSlider
            notes={historicalSnapshot ? historicalSnapshot.notes : notes}
            dateRange={historicalSnapshot ? null : dateRange}
            setDateRange={setDateRange}
            historicalSnapshot={historicalSnapshot}
            onRestoreFromHistory={historicalSnapshot ? handleRestoreFromHistory : undefined}
            onExitHistory={historicalSnapshot ? () => setHistoricalSnapshot(null) : undefined}
          />
        </div>

        {/* Right Side: Markdown Editor Sidebar panel */}
        <div 
          className={`right-sidebar ${isSidebarOpen ? 'open' : ''}`}
          style={{ 
            '--sidebar-width': `${sidebarWidth}px`,
            display: 'flex',
            flexDirection: 'row'
          } as React.CSSProperties}
        >
          {isSidebarOpen && (
            <div className="sidebar-resizer" onMouseDown={startResizing} style={{ left: 0, touchAction: 'none' }} />
          )}

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
        </div>
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
          onAskAi={() => setShowAskAi(true)}
          onClose={() => handleSelectNote(null)}
        />
      )}


      {showMobileMenu && viewport === 'sm' && (
        <div className="mobile-menu-drawer" style={{
          position: 'fixed', bottom: 'calc(var(--mobile-nav-height, 60px) + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))', left: 0, right: 0,
          background: 'rgba(20, 27, 50, 0.95)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
          padding: '16px', paddingBottom: 'calc(16px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))', zIndex: 'var(--z-drawer, 60)',
          borderTop: '1px solid rgba(124, 58, 237, 0.2)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="header-btn" onClick={() => { setShowReview(true); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
              <Brain size={18} /> Review
            </button>
            <button className="header-btn" onClick={() => { setShowDiscoveryDigest(true); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
              <Compass size={18} /> Discovery Digest
            </button>
            <button className="header-btn" onClick={() => { setShowAskAi(true); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', color: 'var(--node-amber, #f59e0b)', width: '100%' }}>
              <Sparkles size={18} /> Ask AI
            </button>
            <button className="header-btn" onClick={() => { handleCreateDailyNote(); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
              <Calendar size={18} /> Daily Note
            </button>
            <button className="header-btn" onClick={() => { handleImportZip(); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
              <FileArchive size={18} /> Import ZIP
            </button>
            <button className="header-btn" onClick={() => { handleUploadDocument(); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
              <FileUp size={18} /> Upload Document
            </button>

            <button className="header-btn" onClick={() => { setShowSettings(true); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
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
          onSaveSnapshot={handleSaveSnapshot}
          onViewSnapshots={handleBrowseSnapshots}
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
          onCancel={() => setPromptConfig(null)}
        />
      )}
      {docLoading && (
        <div className="modal-overlay !flex !items-center !justify-center !p-4" style={{ zIndex: 99999, flexDirection: 'column', gap: '20px' }}>
          <div className="premium-loader-card glass-panel" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            textAlign: 'center',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            background: 'linear-gradient(135deg, rgba(15, 20, 50, 0.9) 0%, rgba(8, 12, 35, 0.95) 100%)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(124, 58, 237, 0.15)'
          }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="synGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <circle cx="40" cy="15" r="5" fill="#7c3aed">
                  <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="15" cy="55" r="5" fill="#06b6d4">
                  <animate attributeName="r" values="5;7;5" dur="2s" begin="0.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="65" cy="55" r="5" fill="#f59e0b">
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', margin: 0 }}>Processing Document</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, minHeight: '24px' }}>{docStatus}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

