/**
 * @file EditorPanel.tsx
 * @description Primary note editing, previewing, metadata management, and AI copilot interaction panel in AetherMind.
 * Features dual Edit / Markdown Preview modes, PrismJS syntax highlighting, wiki-link navigation `[[Note Name]]`,
 * debounced IndexedDB autosaving, AI summary generation, AI auto-tagging, slash command blocks, semantic similarity matching,
 * and graph connection management.
 * @module components/EditorPanel
 */

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

/**
 * Props for the {@link EditorPanel} component.
 *
 * @interface EditorPanelProps
 * @property {Note | null} note - The active note object being viewed or edited, or null for empty workspace placeholder.
 * @property {Link[]} links - Array of graph links relevant to the current page/context.
 * @property {Category[]} categories - List of available categories for assigning colors and groupings.
 * @property {() => void} onClose - Callback invoked to dismiss the editor panel or deselect note.
 * @property {() => void} onNoteDeleted - Callback invoked after a note is permanently deleted.
 * @property {(title: string) => void} onJumpToNote - Callback invoked to navigate to or create a note by title (e.g. from wiki-links).
 * @property {(title: string) => void} [onSplitRight] - Optional callback to open a note side-by-side in desktop split-view mode.
 */
interface EditorPanelProps {
  note: Note | null;
  links: Link[];
  categories: Category[];
  onClose: () => void;
  onNoteDeleted: () => void;
  onJumpToNote: (title: string) => void;
  onSplitRight?: (title: string) => void;
}

/**
 * EditorPanel Component
 *
 * The central workspace interface for writing notes with rich markdown support,
 * connecting knowledge nodes, executing AI summarization/tagging workflows, and exploring related ideas.
 *
 * @component
 * @param {EditorPanelProps} props - Component properties.
 * @returns {React.ReactElement} The rendered editor sidebar or empty state placeholder.
 */
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
  /** Reference to in-flight AI call AbortController. */
  const abortRef = useRef<AbortController | null>(null);

  /** All notes in the database queried live for category/link resolution. */
  const allNotes = useLiveQuery(() => db.notes.toArray()) || [];

  /** Local state for note title. */
  const [title, setTitle] = useState('');

  /** Local state for markdown body content. */
  const [content, setContent] = useState('');

  /** Local state for selected category ID. */
  const [category, setCategory] = useState('general');

  /** Local state for custom node color override. */
  const [nodeColor, setNodeColor] = useState('');

  /** Local state for comma-separated tags input string. */
  const [tagsInput, setTagsInput] = useState('');

  /** Mode toggle: `true` for textarea markdown editor, `false` for rendered preview. */
  const [editMode, setEditMode] = useState<boolean>(false);

  /** Indicates whether an AI operation (summarize, auto-tag) is currently fetching. */
  const [isAiLoading, setIsAiLoading] = useState(false);

  /** Checks if AI copilot credentials or custom endpoints are available. */
  const aiAvailable = !!(localStorage.getItem('aiApiKey') || localStorage.getItem('aiProvider') === 'custom');
  
  // Force preview mode when navigating to a different note
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditMode(false);
  }, [note?.id]);

  // Abort any ongoing AI generation on component unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  /** Visibility state for the delete confirmation modal. */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /** Coordinates for the floating slash command quick-block popup menu. */
  const [slashMenuPos, setSlashMenuPos] = useState<{top: number, left: number} | null>(null);

  /** DOM ref to the rendered markdown HTML preview container. */
  const previewRef = useRef<HTMLDivElement>(null);

  /** DOM ref to the markdown textarea editor element. */
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Computes the Set of note IDs connected to the currently open note across all links.
   */
  const connectedNodeIds = useMemo(() => new Set(
    links
      .filter(l => l.sourceId === note?.id || l.targetId === note?.id)
      .flatMap(l => [l.sourceId, l.targetId])
  ), [links, note?.id]);

  // Synchronize local form inputs when selected note changes
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

  /**
   * Debounced automatic persistence for note markdown body (500ms debounce).
   */
  const debouncedSaveContent = useDebounce(async (id: number, val: string) => {
    await updateNote(id, { content: val });
  }, 500, (err) => showToast('Auto-save failed: ' + err, 'error'));

  /**
   * Debounced automatic persistence for note tags (800ms debounce).
   */
  const debouncedSaveTags = useDebounce(async (id: number, tagsStr: string) => {
    const tagsArray = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    await updateNote(id, { tags: tagsArray });
  }, 800);

  /**
   * Persists note title changes immediately when the title input loses focus.
   */
  const handleTitleBlur = async () => {
    if (!note || !title.trim()) return;
    try {
      const cleanTitle = title.trim();
      await updateNote(note.id!, { title: cleanTitle });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error updating title', 'error');
      setTitle(note.title); // Revert on error
    }
  };

  /**
   * Updates and saves the note category.
   *
   * @param {string} val - New category ID.
   */
  const handleCategoryChange = async (val: string) => {
    setCategory(val);
    if (note) {
      await updateNote(note.id!, { category: val });
    }
  };

  /**
   * Updates and saves a custom node color override.
   *
   * @param {string} color - Hex color code.
   */
  const handleColorChange = async (color: string) => {
    setNodeColor(color);
    if (note) {
      await updateNote(note.id!, { color: color });
    }
  };

  /**
   * Resets custom node color back to default category color.
   */
  const handleColorReset = async () => {
    setNodeColor('');
    if (note) {
      await updateNote(note.id!, { color: '' });
    }
  };

  /**
   * Handles markdown body edits and triggers debounced save.
   *
   * @param {React.ChangeEvent<HTMLTextAreaElement>} e - Change event.
   */
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (note) {
      debouncedSaveContent(note.id!, val);
    }
  };

  /**
   * Handles tags input changes and triggers debounced save.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Change event.
   */
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTagsInput(val);
    if (note) {
      debouncedSaveTags(note.id!, val);
    }
  };

  /**
   * Opens the confirmation dialog for deleting the current note.
   */
  const handleDelete = () => {
    if (!note) return;
    setShowDeleteConfirm(true);
  };

  /**
   * Permanently deletes the note from IndexedDB and notifies parent handlers.
   */
  const executeDelete = async () => {
    if (!note) return;
    await deleteNote(note.id!);
    setShowDeleteConfirm(false);
    onNoteDeleted();
  };

  /**
   * Inserts formatting text or block wrappers around the current textarea cursor selection.
   *
   * @param {string} before - Prefix string (e.g., `**`, `### `).
   * @param {string} [after=''] - Optional suffix string (e.g., `**`).
   */
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

  /**
   * AI Copilot: Analyzes note title and content to automatically generate relevant tags and suggest graph links.
   */
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
      
      // Parse structured tags and links from plain text AI output
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
            // Avoid duplicate links in either direction
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

  /** AI-generated summary modal state. */
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  /**
   * AI Copilot: Generates a concise single-paragraph TL;DR summary of the note content.
   */
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

  /**
   * Keyboard handler for triggering slash command menu on `/` or dismissing on `Escape`.
   *
   * @param {React.KeyboardEvent<HTMLTextAreaElement>} e - Keyboard event.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/') {
      const textarea = textareaRef.current;
      if (textarea) {
        const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length;
        const currentLineLength = lines[lines.length - 1].length;
        
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 24;
        const charWidth = parseInt(getComputedStyle(textarea).fontSize, 10) * 0.6 || 8;
        
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

  /**
   * Applies selected slash command template into note body.
   *
   * @param {string} cmd - Template string to insert.
   */
  const handleSlashCommand = (cmd: string) => {
    insertText(cmd);
    setSlashMenuPos(null);
  };

  /**
   * Setup PrismJS syntax highlighting and wiki-link `#wiki-` click handlers in preview mode.
   */
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
            // Ctrl/Cmd/Alt + Click opens note in split view on desktop
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

  /**
   * Converts `[[Wiki Links]]` to custom HTML hash anchors, parses Markdown to HTML,
   * and sanitizes using DOMPurify.
   */
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

  // Empty state when no note is selected
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

      {/* Editor Title and Metadata Fields */}
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
      <div className="editor-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '8px', minHeight: 0 }}>
        {/* Mode Switcher & Toolbar */}
        <div style={{ display: 'flex', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {/* Segmented Mode Pill */}
          <div className="glass-pill" style={{ display: 'flex', padding: '3px', gap: '2px', background: 'var(--surface-pill-bg)' }}>
            <button 
              className="tab-btn"
              onClick={() => setEditMode(true)}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-pill)',
                background: editMode ? 'var(--accent-primary)' : 'transparent',
                color: editMode ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: editMode ? 600 : 500
              }}
            >
              <PenTool size={13} /> Edit
            </button>
            <button 
              className="tab-btn"
              onClick={() => setEditMode(false)}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-pill)',
                background: !editMode ? 'var(--accent-primary)' : 'transparent',
                color: !editMode ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: !editMode ? 600 : 500
              }}
            >
              <FileText size={13} /> Preview
            </button>
          </div>

          {/* Quick Format Actions (visible in Edit mode) */}
          {editMode && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button className="icon-btn" onClick={() => insertText('**', '**')} aria-label="Bold" title="Bold (**)"><Bold size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('_', '_')} aria-label="Italic" title="Italic (_)"><Italic size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('### ')} aria-label="Heading" title="Heading (###)"><Heading size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('```\n', '\n```')} aria-label="Code Block" title="Code Block (```)"><Code size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('[[', ']]')} aria-label="Wiki Link" title="Wiki Link ([[]])"><LinkIcon size={13} /></button>
            </div>
          )}
        </div>

        {editMode ? (
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
            {/* Slash command block popup */}
            {slashMenuPos && (
              <div className="glass-panel" style={{
                position: 'absolute',
                top: slashMenuPos.top,
                left: slashMenuPos.left,
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                zIndex: 'var(--z-dropdown, 40)',
                minWidth: '160px',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 8px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Blocks</div>
                <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('### ')} style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.8rem' }}>H3 Heading</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('- [ ] ')} style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.8rem' }}>Todo List</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('> ')} style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.8rem' }}>Quote</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleSlashCommand('```\n\n```')} style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.8rem' }}>Code Block</button>
              </div>
            )}
          </div>
        ) : (
          <div
            ref={previewRef}
            id="editor-note-preview"
            className="note-preview markdown-body"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
            style={{ width: '100%', flex: 1, overflowY: 'auto' }}
          />
        )}
        
        {/* Semantic Related Notes Section */}
        {note.embedding && allNotes.some(n => n.id !== note.id && n.embedding) && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={14} style={{ color: 'var(--node-indigo)' }} />
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Related Notes
              </h4>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {allNotes
                .filter(n => n.pageId === note.pageId && n.id !== note.id && n.embedding)
                .map(n => ({ note: n, score: cosineSimilarity(note.embedding!, n.embedding!) }))
                .filter(({ score }) => score > 0.4)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(({ note: n, score }) => (
                  <div 
                    key={n.id} 
                    className="tag-filter-chip"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '4px 10px', 
                      borderRadius: 'var(--radius-pill)', 
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => onJumpToNote(n.title)}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }}></div>
                    <span>{n.title}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{Math.round(score * 100)}%</span>
                  </div>
                ))}
              {allNotes.filter(n => n.pageId === note.pageId && n.id !== note.id && n.embedding).length > 0 &&
                allNotes.filter(n => n.pageId === note.pageId && n.id !== note.id && n.embedding).map(n => ({ note: n, score: cosineSimilarity(note.embedding!, n.embedding!) })).filter(({ score }) => score > 0.4).length === 0 && (
                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>No strong semantic matches.</span>
              )}
            </div>
          </div>
        )}

        {/* Graph Connections Management Section */}
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
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--surface-pill-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', fontSize: '0.85rem', transition: 'all 0.2s ease' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: `var(--node-${targetNode.category === 'work' ? 'emerald' : targetNode.category === 'ideas' ? 'amber' : 'indigo'})` }}></div>
                    <button type="button" style={{ cursor: 'pointer', background: 'transparent', border: 'none', color: 'inherit', padding: 0, font: 'inherit' }} onClick={() => onJumpToNote(targetNode.title)} aria-label={`Open note ${targetNode.title}`}>{targetNode.title}</button>
                    
                    {onSplitRight && (
                      <button onClick={(e) => { e.stopPropagation(); onSplitRight(targetNode.title); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '4px' }} title="Open in split view" aria-label="Open in split view">
                        <SplitSquareHorizontal size={12} />
                      </button>
                    )}

                    {/* Unlink / remove connection button */}
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Note"
        message={`Are you sure you want to delete "${note?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* AI Summary Modal Overlay */}
      {aiSummary !== null && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            background: 'var(--surface-card)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            width: '85%',
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
      
      {/* Proactive Connection Discovery Popup (Preview mode with > 50 chars) */}
      {!editMode && content.trim().length > 50 && note.id && aiAvailable && (
        <ConnectionDiscovery noteId={note.id} content={content} />
      )}
    </div>
  );
};

