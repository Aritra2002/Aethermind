import React, { useState, useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Note, Link, Category } from '../db';
import { updateNote, deleteNote } from '../db/helpers';
import { useDebounce } from '../hooks/useDebounce';
import { X, Trash2, Edit3, Tag, Folder, Bold, Italic, Heading, Code, Link as LinkIcon, Wand2, PlusCircle, FileText, SplitSquareHorizontal, PenTool, Sparkles } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { ColorPicker } from './ColorPicker';
import { callAI } from '../utils/aiClient';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './ToastContext';
import { cosineSimilarity } from '../utils/vectorSearch';
import { ConnectionDiscovery } from './ConnectionDiscovery';
import { Dropdown } from './ui/Dropdown';

interface EditorPanelProps {
  note: Note | null;
  links: Link[];
  categories: Category[];
  onClose: () => void;
  onNoteDeleted: () => void;
  onJumpToNote: (title: string) => void;
  onSplitRight?: (title: string) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  note,
  links,
  categories,
  onClose,
  onNoteDeleted,
  onJumpToNote,
  onSplitRight
}) => {
  const { showToast } = useToast();
  const abortRef = useRef<AbortController | null>(null);
  const allNotes = useLiveQuery(() => db.notes.toArray()) || [];
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [nodeColor, setNodeColor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiAvailable = !!(localStorage.getItem('aiApiKey') || localStorage.getItem('aiProvider') === 'custom');
  
  // Force preview mode when opening a different note
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditMode(false);
  }, [note?.id]);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState<{top: number, left: number} | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const connectedNodeIds = useMemo(() => new Set(
    links
      .filter(l => l.sourceId === note?.id || l.targetId === note?.id)
      .flatMap(l => [l.sourceId, l.targetId])
  ), [links, note?.id]);

  // Load note values when selected note changes
  useEffect(() => {
    if (note) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(note.title);
      setContent(note.content);
      setCategory(note.category || 'general');
      setNodeColor(note.color || '');
      setTagsInput(note.tags ? note.tags.join(', ') : '');
    }
  }, [note]);

  // Debounced auto-save functions
  const debouncedSaveContent = useDebounce(async (id: number, val: string) => {
    await updateNote(id, { content: val });
  }, 500, (err) => showToast('Auto-save failed: ' + err, 'error'));

  const debouncedSaveTags = useDebounce(async (id: number, tagsStr: string) => {
    const tagsArray = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    await updateNote(id, { tags: tagsArray });
  }, 800);

  // Immediate save on blur or specific field updates
  const handleTitleBlur = async () => {
    if (!note || !title.trim()) return;
    try {
      const cleanTitle = title.trim();
      await updateNote(note.id!, { title: cleanTitle });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error updating title', 'error');
      setTitle(note.title); // Reset on error
    }
  };

  const handleCategoryChange = async (val: string) => {
    setCategory(val);
    if (note) {
      await updateNote(note.id!, { category: val });
    }
  };

  const handleColorChange = async (color: string) => {
    setNodeColor(color);
    if (note) {
      await updateNote(note.id!, { color: color });
    }
  };

  const handleColorReset = async () => {
    setNodeColor('');
    if (note) {
      await updateNote(note.id!, { color: '' });
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (note) {
      debouncedSaveContent(note.id!, val);
    }
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTagsInput(val);
    if (note) {
      debouncedSaveTags(note.id!, val);
    }
  };

  const handleDelete = () => {
    if (!note) return;
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!note) return;
    await deleteNote(note.id!);
    setShowDeleteConfirm(false);
    onNoteDeleted();
  };

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + before + text.substring(start, end) + after + text.substring(end);
    setContent(newText);
    if (note) debouncedSaveContent(note.id!, newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const handleAiAutoTag = async () => {
    if (!note) return;
    try {
      setIsAiLoading(true);
      const pageNotes = allNotes.filter(n => n.pageId === note.pageId);
      const allTitles = pageNotes.map(n => n.title).filter(t => t !== note.title);

      const systemPrompt = `You are an AI assistant for a personal knowledge graph.
Given a note's title, its content, and a list of existing note titles in the graph, suggest:
1. Up to 3 relevant comma-separated tags.
2. Up to 3 existing note titles that should be linked.
Return exactly and ONLY in this format (do not use markdown blocks, just the text):
TAGS: tag1, tag2
LINKS: [[NoteTitle1]] [[NoteTitle2]]`;

      const userPrompt = `Existing Note Titles: ${allTitles.join(', ')}
Current Note Title: ${note.title}
Current Note Content: ${content}`;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const response = await callAI(systemPrompt, userPrompt, undefined, abortRef.current.signal);
      
      // Parse the response, expecting "TAGS: a, b" and "LINKS: [[c]]"
      const lines = response.split('\n');
      let tagsToAdd = '';
      let linksToAdd = '';
      
      for (const line of lines) {
        if (line.startsWith('TAGS:')) {
          tagsToAdd = line.replace('TAGS:', '').trim();
        } else if (line.startsWith('LINKS:')) {
          linksToAdd = line.replace('LINKS:', '').trim();
        }
      }

      if (tagsToAdd) {
        const newTagsString = tagsInput ? `${tagsInput}, ${tagsToAdd}` : tagsToAdd;
        setTagsInput(newTagsString);
        await updateNote(note.id!, { tags: newTagsString.split(',').map(t => t.trim()).filter(Boolean) });
      }

      if (linksToAdd) {
        const targetTitles = linksToAdd.split(/\[\[|\]\]|,/).map(s => s.trim()).filter(Boolean);
        const pageNotes = allNotes.filter(n => n.pageId === note.pageId);
        for (const title of targetTitles) {
          const targetNote = pageNotes.find(n => n.title.toLowerCase() === title.toLowerCase());
          if (targetNote && targetNote.id && note.id) {
            // Check for existing link in either direction
            const existingForward = await db.links.where({ sourceId: note.id, targetId: targetNote.id }).first();
            const existingReverse = await db.links.where({ sourceId: targetNote.id, targetId: note.id }).first();
            if (!existingForward && !existingReverse) {
              await db.links.add({ sourceId: note.id, targetId: targetNote.id });
            }
          }
        }
      }
      
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const handleAiSummarize = async () => {
    if (!note || !content.trim()) return;
    try {
      setIsAiLoading(true);
      const systemPrompt = `You are an AI assistant for a personal knowledge graph.
Please provide a concise summary (TL;DR) of the provided note content. The summary should be a single brief paragraph.
Return exactly and ONLY the summary text, with no markdown code blocks or conversational filler.`;

      const userPrompt = `Note Content:\n${content}`;
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const response = await callAI(systemPrompt, userPrompt, undefined, abortRef.current.signal);
      
      setAiSummary(response.trim());
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setIsAiLoading(false);
      setSlashMenuPos(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/') {
      const textarea = textareaRef.current;
      if (textarea) {
        const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length;
        const currentLineLength = lines[lines.length - 1].length;
        
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
        const charWidth = parseInt(getComputedStyle(textarea).fontSize) * 0.6 || 8;
        
        const top = (currentLine * lineHeight) - textarea.scrollTop + 10;
        const left = (currentLineLength * charWidth) + 16;
        
        setSlashMenuPos({ top, left });
      } else {
        setSlashMenuPos({ top: 40, left: 20 });
      }
    } else if (e.key === 'Escape') {
      setSlashMenuPos(null);
    }
  };

  const handleSlashCommand = (cmd: string) => {
    insertText(cmd);
    setSlashMenuPos(null);
  };

  // Setup wiki-link clicking and PrismJS syntax highlighting in preview mode
  useEffect(() => {
    const activeLinks: { element: HTMLAnchorElement; listener: (e: MouseEvent) => void }[] = [];
    
    if (!editMode && previewRef.current) {
      Prism.highlightAllUnder(previewRef.current);
      
      const links = previewRef.current.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href');
        // Handle wiki-link triggers or custom clicks
        if (href && href.startsWith('#wiki-')) {
          const listener = (e: MouseEvent) => {
            e.preventDefault();
            const targetTitle = decodeURIComponent(href.replace('#wiki-', ''));
            if ((e.metaKey || e.ctrlKey || e.altKey) && onSplitRight) {
              onSplitRight(targetTitle);
            } else {
              onJumpToNote(targetTitle);
            }
          };
          link.addEventListener('click', listener);
          activeLinks.push({ element: link, listener });
        }
      });
    }

    return () => {
      activeLinks.forEach(({ element, listener }) => {
        element.removeEventListener('click', listener);
      });
    };
  }, [editMode, content, onSplitRight, onJumpToNote]);

  // Convert [[Wiki Links]] in markdown content into custom links for rendering
  const renderedContent = useMemo(() => {
    if (!content) return '<p style="color: var(--text-secondary); font-style: italic; user-select: none;">No content yet. Write something...</p>';
    
    // Replace [[Wiki Note Name]] with a custom link schema <a href="#wiki-Wiki%20Note%20Name">Wiki Note Name</a>
    const processedContent = content.replace(/\[\[(.*?)\]\]/g, (_, p1) => {
      const cleanTitle = p1.trim();
      return `[${cleanTitle}](#wiki-${encodeURIComponent(cleanTitle)})`;
    });

    try {
      // Safely parse and sanitize markdown
      const rawHtml = marked.parse(processedContent) as string;
      return DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['href'],
        ALLOWED_URI_REGEXP: /^(https?|ftp|mailto|#wiki-)/i,
      });
    } catch {
      return '<p>Error rendering markdown.</p>';
    }
  }, [content]);
  if (!note) {
    return (
      <div className="editor-placeholder" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close Sidebar" title="Close Sidebar" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <div className="placeholder-content" style={{ textAlign: 'center', marginBottom: '32px', userSelect: 'none' }}>
          <Edit3 size={48} className="placeholder-icon" style={{ marginBottom: '16px', opacity: 0.5, margin: '0 auto' }} />
          <h2>AetherMind Workspace</h2>
          <p style={{ maxWidth: '300px', margin: '0 auto', marginBottom: '24px' }}>Select a node in the graph, search for a topic, or double-click empty space on the canvas to create a new note.</p>
          <button 
            className="btn btn-primary btn-lg" 
            style={{ 
              maxWidth: '220px',
              margin: '0 auto',
              width: '100%'
            }}
            onClick={() => {
              const pageNotes = allNotes.filter(n => n.pageId === 1);
              let newTitle = "New Node";
              let counter = 1;
              while (pageNotes.some(n => n.title.toLowerCase() === newTitle.toLowerCase())) {
                newTitle = `New Node (${counter})`;
                counter++;
              }
              onJumpToNote(newTitle);
            }}
          >
            <PlusCircle size={20} />
            Create New Node
          </button>
        </div>
      </div>
    );
  }

  const categoryObj = categories.find(c => c.id === category);
  const categoryColor = categoryObj ? categoryObj.color : '#818cf8';

  return (
    <div className="editor-panel glass-panel" id="editor-panel-root" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Panel Header */}
      <div className="editor-header">
        <div className="category-indicator" style={{ backgroundColor: categoryColor }}></div>
        <span className="note-status-badge">Note Saved</span>
        <div className="header-actions">
          <button className="icon-btn ai-btn" onClick={handleAiSummarize} disabled={isAiLoading || !content.trim()} aria-label="Summarize with AI" title="Auto-Summarize Note (AI)">
            <FileText size={18} className={isAiLoading ? 'spin-pulse' : ''} style={{ color: 'var(--node-amber)' }} />
          </button>
          <button className="icon-btn ai-btn" onClick={handleAiAutoTag} disabled={isAiLoading} aria-label="Auto-Tag with AI" title="Auto-Tag & Suggest Links (AI)">
            <Wand2 size={18} className={isAiLoading ? 'spin-pulse' : ''} style={{ color: 'var(--node-amber)' }} />
          </button>
          <button className="icon-btn delete-btn" onClick={handleDelete} aria-label="Delete note" title="Delete note">
            <Trash2 size={18} />
          </button>
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close panel" title="Close panel">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Editor Fields */}
      <div className="editor-fields">
        <input
          type="text"
          id="editor-note-title"
          className="note-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Untitled Note"
        />

        <div className="meta-row">
          <div className="meta-field">
            <Folder size={14} className="meta-icon" />
            <Dropdown
              value={category}
              onChange={(val) => handleCategoryChange(val as string)}
              options={categories.map(cat => ({ value: cat.id, label: cat.label }))}
              style={{ minWidth: '130px' }}
            />
          </div>

          <div className="meta-field">
            <ColorPicker
              color={nodeColor}
              defaultColor={categoryColor}
              onChange={handleColorChange}
              onReset={handleColorReset}
            />
          </div>

          <div className="meta-field flex-grow">
            <Tag size={14} className="meta-icon" />
            <input
              type="text"
              id="editor-note-tags"
              className="meta-input"
              value={tagsInput}
              onChange={handleTagsChange}
              placeholder="tags (comma separated)"
            />
          </div>
        </div>
      </div>

      {/* Main Body Viewport */}
      <div className="editor-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '12px', minHeight: 0 }}>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setEditMode(false)} style={{ marginRight: '8px' }}><PenTool size={14} /> Finish Editing Mode</button>
              <button className="icon-btn" onClick={() => insertText('**', '**')} aria-label="Bold" title="Bold"><Bold size={14} /></button>
              <button className="icon-btn" onClick={() => insertText('_', '_')} aria-label="Italic" title="Italic"><Italic size={14} /></button>
              <button className="icon-btn" onClick={() => insertText('### ')} aria-label="Heading" title="Heading"><Heading size={14} /></button>
              <button className="icon-btn" onClick={() => insertText('```\n', '\n```')} aria-label="Code Block" title="Code Block"><Code size={14} /></button>
              <button className="icon-btn" onClick={() => insertText('[[', ']]')} aria-label="Wiki Link" title="Wiki Link"><LinkIcon size={14} /></button>
            </div>
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                ref={textareaRef}
                id="editor-note-body"
                className="note-textarea"
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your markdown notes here. Use [[Double Brackets]] to link nodes. Type '/' for block commands..."
                style={{ flex: 1 }}
              />
              {slashMenuPos && (
                <div style={{
                  position: 'absolute',
                  top: slashMenuPos.top,
                  left: slashMenuPos.left,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  zIndex: 'var(--z-dropdown, 40)'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '4px 8px', textTransform: 'uppercase' }}>Blocks</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('### ')} style={{ justifyContent: 'flex-start', width: '100%' }}>H3 Heading</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('- [ ] ')} style={{ justifyContent: 'flex-start', width: '100%' }}>Todo List</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('> ')} style={{ justifyContent: 'flex-start', width: '100%' }}>Quote</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('```\n\n```')} style={{ justifyContent: 'flex-start', width: '100%' }}>Code Block</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px', alignItems: 'center' }}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => setEditMode(true)}
              >
                <PenTool size={14} /> Edit Mode
              </button>
            </div>
            <div
              ref={previewRef}
              id="editor-note-preview"
              className="note-preview markdown-body"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
              style={{ width: '100%' }}
            />
          </div>
        )}
        
        {note.embedding && allNotes.some(n => n.id !== note.id && n.embedding) && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={14} style={{ color: 'var(--node-indigo)' }} />
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Related Notes
              </h4>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {allNotes
                .filter(n => n.pageId === note.pageId && n.id !== note.id && n.embedding)
                .map(n => ({ note: n, score: cosineSimilarity(note.embedding!, n.embedding!) }))
                .filter(({ score }) => score > 0.4)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(({ note: n, score }) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '16px', fontSize: '0.85rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--node-indigo)' }}></div>
                    <span style={{ cursor: 'pointer' }} onClick={() => onJumpToNote(n.title)}>{n.title}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '2px' }}>{Math.round(score * 100)}%</span>
                  </div>
                ))}
              {allNotes.filter(n => n.pageId === note.pageId && n.id !== note.id && n.embedding).length > 0 &&
                allNotes.filter(n => n.pageId === note.pageId && n.id !== note.id && n.embedding).map(n => ({ note: n, score: cosineSimilarity(note.embedding!, n.embedding!) })).filter(({ score }) => score > 0.4).length === 0 && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No strong semantic matches.</span>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Connections
            </h4>
            <Dropdown
              isSearchable={true}
              value=""
              onChange={async (val) => {
                const targetId = parseInt(val as string, 10);
                if (targetId && note?.id) {
                  const currentIds = note.linkedNoteIds || [];
                  if (!currentIds.includes(targetId)) {
                    await updateNote(note.id, { linkedNoteIds: [...currentIds, targetId] });
                  }
                }
              }}
              options={[
                { value: "", label: "Add Connection..." },
                ...allNotes.filter(n => n.pageId === note.pageId && n.id !== note.id && !connectedNodeIds.has(n.id!)).map(n => ({ value: n.id!.toString(), label: n.title }))
              ]}
              style={{ width: '220px' }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {connectedNodeIds.size === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No connected notes.</span>
            ) : (
              Array.from(connectedNodeIds).map(id => {
                const targetNode = allNotes.find(n => n.id === id);
                if (!targetNode) return null;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '16px', fontSize: '0.85rem', transition: 'all 0.2s ease' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: `var(--node-${targetNode.category === 'work' ? 'emerald' : targetNode.category === 'ideas' ? 'amber' : 'indigo'})` }}></div>
                    <button type="button" style={{ cursor: 'pointer', background: 'transparent', border: 'none', color: 'inherit', padding: 0, font: 'inherit' }} onClick={() => onJumpToNote(targetNode.title)} aria-label={`Open note ${targetNode.title}`}>{targetNode.title}</button>
                    
                    {onSplitRight && (
                      <button onClick={(e) => { e.stopPropagation(); onSplitRight(targetNode.title); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '4px' }} title="Open in split view" aria-label="Open in split view">
                        <SplitSquareHorizontal size={12} />
                      </button>
                    )}

                    <button onClick={async () => {
                      const newIds = (note.linkedNoteIds || []).filter(x => x !== id);
                      const escapedTargetTitle = targetNode.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const regex = new RegExp(`\\[\\[${escapedTargetTitle}\\]\\]`, 'g');
                      const newContent = content.replace(regex, targetNode.title);
                      
                      const targetIds = targetNode.linkedNoteIds || [];
                      const isIncomingExplicit = targetIds.includes(note.id!);
                      const escapedThisTitle = note.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const incomingRegex = new RegExp(`\\[\\[${escapedThisTitle}\\]\\]`, 'g');
                      const isIncomingText = incomingRegex.test(targetNode.content);

                      if (isIncomingExplicit || isIncomingText) {
                         const newTargetIds = targetIds.filter(x => x !== note.id!);
                         const newTargetContent = targetNode.content.replace(incomingRegex, note.title);
                         await updateNote(targetNode.id!, { linkedNoteIds: newTargetIds, content: newTargetContent });
                      }

                      await updateNote(note.id!, { linkedNoteIds: newIds, content: newContent });
                      setContent(newContent);
                    }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }} aria-label={`Remove connection to ${targetNode.title}`} title="Remove connection">
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Note"
        message={`Are you sure you want to delete "${note?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      {aiSummary !== null && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: '12px',
            width: '80%',
            maxWidth: '500px',
            maxHeight: '80%',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <button className="btn btn-icon close-btn" onClick={() => setAiSummary(null)} aria-label="Close AI summary" style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <X size={18} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} style={{ color: 'var(--node-amber)' }} />
              AI Summary
            </h3>
            <div style={{ lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '24px', maxHeight: '200px', overflowY: 'auto' }}>
              {aiSummary}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <button className="btn btn-primary btn-lg" onClick={() => {
                const newContent = `> **AI Summary:** ${aiSummary}\n\n${content}`;
                setContent(newContent);
                if (note) updateNote(note.id!, { content: newContent });
                setAiSummary(null);
              }} style={{ width: '100%' }}>
                <Sparkles size={18} />
                Insert into Note
              </button>
            </div>
          </div>
        </div>
      )}
      
      {!editMode && content.trim().length > 50 && note.id && aiAvailable && (
        <ConnectionDiscovery noteId={note.id} content={content} />
      )}
    </div>
  );
};
