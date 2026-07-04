import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Note, type Link } from './db';
import { seedDatabase, createNote } from './db/helpers';
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
import { VoiceRecorder } from './components/VoiceRecorder';
import { Brain, Plus, Settings, Calendar, Sparkles, Edit2, Trash2, Loader2, Search, Compass } from 'lucide-react';

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
import { initPluginManager } from './utils/pluginManager';
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

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    setIsSearchOpen(viewport !== 'sm');
  }, [viewport]);
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
      } catch (e) {
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
    initPluginManager();
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
      let title = 'New Node';
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

  useEffect(() => {
    window.AetherMindApi = {
      ...window.AetherMindApi,
      openSettings: () => setShowSettings(true),
      openCommandPalette: () => setShowCommandPalette(true),
      createNote: (x?: number, y?: number) => handleCreateNote(x, y),
      selectNote: (id: number | null) => {
        if (id === null) handleSelectNote(null);
        else {
          const note = notes.find(n => n.id === id);
          if (note) handleSelectNote(note);
        }
      },
      jumpToNote: (title: string) => handleJumpToNote(title)
    };
  }, [notes, activeNoteId, isSidebarOpen, currentPageId]);

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header glass-panel">
        {viewport === 'sm' && (
          <>
            <div className="app-logo">
              <Brain size={24} className="logo-icon" />
            </div>
            <div className="page-selector" style={{ display: 'flex', alignItems: 'center', margin: '0 auto', gap: '8px' }}>
              <button 
                className="header-btn" 
                onClick={() => { /* maybe open a dialog in future, for now acts as pill */ }}
                style={{ padding: '6px 12px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)' }}
              >
                {pages.find(p => p.id === currentPageId)?.title || 'AetherMind'}
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
                style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none' }}
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
              <VoiceRecorder pageId={currentPageId} onNoteCreated={(id) => handleSelectNote({ id })} />
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
                style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none' }}
              >
                {pages.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#111827' }}>{p.title}</option>
                ))}
              </select>
              <button className="header-btn icon-only-btn" onClick={() => setShowRenamePage(true)} title="Rename Page" style={{ padding: '6px' }}>
                <Edit2 size={14} />
              </button>
              <button className="header-btn icon-only-btn" onClick={handleDeletePage} title="Delete Page" disabled={pages.length <= 1} style={{ padding: '6px' }}>
                <Trash2 size={14} style={{ color: pages.length <= 1 ? 'var(--text-secondary)' : '#f43f5e' }} />
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
              <VoiceRecorder pageId={currentPageId} onNoteCreated={(id) => handleSelectNote({ id })} />
              <button className="header-btn primary-btn" onClick={() => setShowNewPage(true)}>
                <Plus size={16} /> New Page
              </button>
              <button className="header-btn icon-only-btn" onClick={() => setIsSearchOpen(true)} aria-label="Search" title="Search">
                <Search size={18} />
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
          {/* Search Toggle Button */}
          <button 
            className={`search-toggle-btn glass-panel ${isSearchOpen ? 'hidden' : ''}`}
            onClick={() => setIsSearchOpen(true)}
            aria-label="Open search and filters"
          >
            <Search size={16} />
            <span>Search</span>
          </button>

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
              nlpClustering={nlpClustering && !historicalSnapshot}
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
          onAskAi={() => setShowAskAi(true)}
          onClose={() => handleSelectNote(null)}
        />
      )}


      {showMobileMenu && viewport === 'sm' && (
        <div className="mobile-menu-drawer" style={{
          position: 'fixed', bottom: 'var(--mobile-nav-height, 60px)', left: 0, right: 0,
          background: 'rgba(20, 27, 50, 0.95)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
          padding: '16px', paddingBottom: 'calc(16px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))', zIndex: 99,
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
            <button className="header-btn primary-btn" onClick={() => { setShowNewPage(true); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
              <Plus size={18} /> New Page
            </button>
            <button className="header-btn" onClick={() => { setShowSettings(true); setShowMobileMenu(false); }} style={{ justifyContent: 'flex-start', padding: '12px', width: '100%' }}>
              <Settings size={18} /> Settings
            </button>
          </div>
        </div>
      )}

      {viewport === 'sm' && (
        <MobileNav 
          pageId={currentPageId}
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
          onCreateNote={() => handleCreateNote()}
        />
      )}

      {/* Backup and settings Modal */}
      {promptConfig && (
        <PromptModal
          title={promptConfig.title}
          message={promptConfig.message}
          onConfirm={promptConfig.onConfirm}
          onCancel={() => setPromptConfig(null)}
        />
      )}
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
        notes={notes}
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
    </div>
  );
}

