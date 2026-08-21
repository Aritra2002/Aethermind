/**
 * @file EditorPanel.tsx
 * @description Primary note editing, previewing, metadata management, and AI copilot interaction panel in AetherMind.
 * Features dual Edit / Markdown Preview modes, PrismJS syntax highlighting, wiki-link navigation `[[Note Name]]`,
 * debounced IndexedDB autosaving, AI summary generation, AI auto-tagging, slash command blocks, semantic similarity matching,
 * and graph connection management.
 * @module components/EditorPanel
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { safeRenderMarkdown } from '../utils/sanitizer';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Note, Link, Category } from '../db';
import { updateNote, deleteNote, toggleFavoriteNote, archiveNote, restoreNote } from '../db/helpers';
import { useDebounce } from '../hooks/useDebounce';
import { X, Trash2, Edit3, Tag, Folder, Bold, Italic, Heading, Code, Link as LinkIcon, Wand2, PlusCircle, FileText, SplitSquareHorizontal, PenTool, Sparkles, Star, Archive, ArchiveRestore, Square, GripHorizontal } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { ColorPicker } from './ColorPicker';
import { callAI } from '../utils/aiClient';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './ToastContext';
import { cosineSimilarity } from '../utils/vectorSearch';
import { ConnectionDiscovery } from './ConnectionDiscovery';
import { Dropdown } from './ui/Dropdown';
import { formatShortcut, isModifierKeyCombo } from '../utils/keyboardUtils';

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
  const allNotesRaw = useLiveQuery(() => db.notes.toArray());
  const allNotes = useMemo(() => allNotesRaw || [], [allNotesRaw]);

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

  /** DOM ref to the resizable note content container (enclosing textarea and preview). */
  const contentContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Computes the Set of note IDs connected to the currently open note across all links.
   */
  const connectedNodeIds = useMemo(() => new Set(
    links
      .filter(l => l.sourceId === note?.id || l.targetId === note?.id)
      .flatMap(l => [l.sourceId, l.targetId])
  ), [links, note?.id]);

  // Online / Offline tracking
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /** Dynamic save state status ('saved' | 'saving' | 'error'). */
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  /** Reference holding the latest pending content for loss-prevention immediate flush. */
  const pendingContentRef = useRef<string>(note?.content || '');
  const activeNoteIdRef = useRef<number | undefined>(note?.id);

  // Synchronize local form inputs when selected note changes
  useEffect(() => {
    if (note) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(note.title);
      setContent(note.content);
      pendingContentRef.current = note.content;
      activeNoteIdRef.current = note.id;
      setCategory(note.category || 'general');
      setNodeColor(note.color || '');
      setTagsInput(note.tags ? note.tags.join(', ') : '');
      setSaveStatus('saved');
    }
  }, [note]);

  /**
   * Immediately flushes any unpersisted edits to IndexedDB before switching notes or exiting.
   */
  const flushSaveImmediately = async () => {
    const id = activeNoteIdRef.current;
    const text = pendingContentRef.current;
    if (id && text !== undefined) {
      try {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        await updateNote(id, { content: text, wordCount: words, readingTime: Math.max(1, Math.ceil(words / 200)) });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Immediate flush save error:', err);
      }
    }
  };

  // Immediate flush before window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSaveImmediately();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSaveImmediately();
    };
  }, []);

  /** Word count of current content. */
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);

  /** Estimated reading time in minutes. */
  const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 200)), [wordCount]);

  /**
   * Debounced automatic persistence for note markdown body (500ms debounce).
   */
  const debouncedSaveContent = useDebounce(async (id: number, val: string) => {
    try {
      const words = val.trim().split(/\s+/).filter(Boolean).length;
      await updateNote(id, { content: val, wordCount: words, readingTime: Math.max(1, Math.ceil(words / 200)) });
      setSaveStatus('saved');
    } catch (err: unknown) {
      setSaveStatus('error');
      showToast('Auto-save failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }, 500);

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

  /** Wiki-link autocomplete state */
  const [wikiSuggest, setWikiSuggest] = useState<{
    isOpen: boolean;
    query: string;
    selectedIndex: number;
    cursorPos: number;
    top: number;
    left: number;
  } | null>(null);

  /** Matching note candidates for wiki-link autocomplete */
  const wikiMatches = useMemo(() => {
    if (!wikiSuggest || !wikiSuggest.isOpen) return [];
    const q = wikiSuggest.query.toLowerCase();
    const pageNotes = allNotes.filter(n => n.pageId === note?.pageId && n.id !== note?.id);
    return pageNotes.filter(n => n.title.toLowerCase().includes(q)).slice(0, 8);
  }, [wikiSuggest, allNotes, note?.pageId, note?.id]);

  /** Notes that link to or mention this note (Backlinks) */
  const incomingBacklinks = useMemo(() => {
    if (!note) return [];
    const lowerTitle = note.title.toLowerCase();
    const wikiToken = `[[${lowerTitle}]]`;
    return allNotes.filter(n =>
      n.pageId === note.pageId &&
      n.id !== note.id &&
      (n.content.toLowerCase().includes(wikiToken) || (n.linkedNoteIds && n.linkedNoteIds.includes(note.id!)))
    );
  }, [allNotes, note]);

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
   * Completes the wiki-link insertion when an autocomplete candidate is selected.
   */
  const handleSelectWikiCandidate = (candidateTitle: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !wikiSuggest) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = content.substring(0, cursorPos);
    const lastOpenIdx = textBefore.lastIndexOf('[[');
    if (lastOpenIdx === -1) return;

    const prefix = content.substring(0, lastOpenIdx);
    const suffix = content.substring(cursorPos);
    const inserted = `[[${candidateTitle}]] `;
    const updatedContent = prefix + inserted + suffix;

    setContent(updatedContent);
    pendingContentRef.current = updatedContent;
    setSaveStatus('saving');
    if (note) debouncedSaveContent(note.id!, updatedContent);

    setWikiSuggest(null);
    setTimeout(() => {
      textarea.focus();
      const newCursor = prefix.length + inserted.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  /**
   * Handles markdown body edits, updates pending content ref, and triggers autocomplete detection.
   */
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    pendingContentRef.current = val;
    setSaveStatus('saving');
    if (note) {
      debouncedSaveContent(note.id!, val);
    }

    // Wiki-link autocomplete detection
    const cursorPos = e.target.selectionStart;
    const textBefore = val.substring(0, cursorPos);
    const lastOpenIdx = textBefore.lastIndexOf('[[');
    const lastCloseIdx = textBefore.lastIndexOf(']]');

    if (lastOpenIdx !== -1 && lastOpenIdx >= lastCloseIdx) {
      const query = textBefore.substring(lastOpenIdx + 2);
      if (!query.includes('\n')) {
        const textarea = textareaRef.current;
        if (textarea) {
          const lines = textBefore.split('\n');
          const currentLine = lines.length;
          const currentLineLength = lines[lines.length - 1].length;
          const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 24;
          const charWidth = parseInt(getComputedStyle(textarea).fontSize, 10) * 0.6 || 8;

          const top = Math.min((currentLine * lineHeight) - textarea.scrollTop + 10, textarea.clientHeight - 140);
          const left = Math.min((currentLineLength * charWidth) + 16, textarea.clientWidth - 220);

          setWikiSuggest({
            isOpen: true,
            query,
            selectedIndex: 0,
            cursorPos,
            top: Math.max(20, top),
            left: Math.max(10, left)
          });
        }
      } else {
        setWikiSuggest(null);
      }
    } else {
      setWikiSuggest(null);
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
    pendingContentRef.current = newText;
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
   * Transforms currently selected or entire note text using contextual AI writing instructions.
   */
  const handleInlineAiTransform = async (instruction: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = start !== end;
    const targetText = hasSelection ? textarea.value.substring(start, end).trim() : textarea.value.trim();
    
    if (!targetText) {
      showToast('Write or select content to transform with AI', 'info');
      return;
    }

    try {
      setIsAiLoading(true);
      const systemPrompt = `You are an expert AI writing assistant for a personal knowledge graph.
Instruction: ${instruction}
Requirements:
1. Return ONLY the replacement text in clean markdown format.
2. Do not wrap the response in outer code blocks (\`\`\`) unless code is specifically requested.
3. Do not include conversational greetings or explanations.`;

      const userPrompt = `Target Text:\n${targetText}`;
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const response = await callAI(systemPrompt, userPrompt, undefined, abortRef.current.signal);
      
      const trimmedResponse = response.trim();
      const updatedText = hasSelection
        ? textarea.value.substring(0, start) + trimmedResponse + textarea.value.substring(end)
        : trimmedResponse;

      setContent(updatedText);
      pendingContentRef.current = updatedText;
      if (note) debouncedSaveContent(note.id!, updatedText);
      showToast('AI Transformation Applied', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'AI operation failed', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  /** Custom user-dragged vertical height for the note textarea/preview canvas (in pixels). */
  const [customTextareaHeight, setCustomTextareaHeight] = useState<number | null>(null);
  const isDraggingResize = useRef(false);
  const startDragY = useRef(0);
  const startDragHeight = useRef(0);

  /**
   * Interactive pointer drag handler for vertical textarea & preview canvas resizing.
   */
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingResize.current = true;
    startDragY.current = e.clientY;
    const currentH = contentContainerRef.current?.getBoundingClientRect().height 
      || textareaRef.current?.getBoundingClientRect().height 
      || previewRef.current?.getBoundingClientRect().height 
      || 300;
    startDragHeight.current = currentH;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingResize.current) return;
      const delta = moveEvent.clientY - startDragY.current;
      const minH = 140;
      const maxH = Math.max(minH, window.innerHeight * 0.85);
      const nextHeight = Math.round(Math.max(minH, Math.min(maxH, startDragHeight.current + delta)));
      setCustomTextareaHeight(nextHeight);
    };

    const handlePointerUp = () => {
      isDraggingResize.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  /**
   * Keyboard handler for autocomplete navigation, formatting shortcuts, and slash commands.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Handle Wiki-Link Autocomplete Menu Navigation
    if (wikiSuggest?.isOpen && wikiMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setWikiSuggest(s => s ? ({ ...s, selectedIndex: (s.selectedIndex + 1) % wikiMatches.length }) : null);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setWikiSuggest(s => s ? ({ ...s, selectedIndex: (s.selectedIndex - 1 + wikiMatches.length) % wikiMatches.length }) : null);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectWikiCandidate(wikiMatches[wikiSuggest.selectedIndex].title);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setWikiSuggest(null);
        return;
      }
    }

    // 2. Keyboard Formatting & Productivity Shortcuts (Universal across Mac/Windows/Android/iOS)
    if (isModifierKeyCombo(e, 's')) {
      e.preventDefault();
      flushSaveImmediately();
      showToast('Note saved', 'info');
      return;
    }
    if (isModifierKeyCombo(e, 'b')) {
      e.preventDefault();
      insertText('**', '**');
      return;
    }
    if (isModifierKeyCombo(e, 'i')) {
      e.preventDefault();
      insertText('_', '_');
      return;
    }
    if (isModifierKeyCombo(e, 'k')) {
      e.preventDefault();
      insertText('[[', ']]');
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  ');
      return;
    }

    // 3. Slash Command trigger
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
      // Setup interactive task checkbox toggles in preview
      const checkboxes = previewRef.current.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((cb, index) => {
        const checkboxListener = () => {
          let count = 0;
          const updatedContent = content.replace(/- \[( |x|X)\]/g, (match) => {
            if (count === index) {
              count++;
              return match.includes('x') || match.includes('X') ? '- [ ]' : '- [x]';
            }
            count++;
            return match;
          });
          setContent(updatedContent);
          if (note) {
            debouncedSaveContent(note.id!, updatedContent);
          }
        };
        (cb as HTMLElement).style.cursor = 'pointer';
        cb.removeAttribute('disabled');
        cb.addEventListener('click', checkboxListener);
      });
    }

    return () => {
      activeLinks.forEach(({ element, listener }) => {
        element.removeEventListener('click', listener);
      });
    };
  }, [editMode, content, onSplitRight, onJumpToNote, note, debouncedSaveContent]);

  /**
   * Converts `[[Wiki Links]]` to custom HTML hash anchors, parses Markdown to HTML,
   * and sanitizes using safeRenderMarkdown.
   */
  const renderedContent = useMemo(() => {
    if (!content) return '<p style="color: var(--text-secondary); font-style: italic; user-select: none;">No content yet. Write something...</p>';
    return safeRenderMarkdown(content);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`note-status-badge ${!isOnline ? 'offline' : saveStatus}`}>
            {!isOnline ? 'Offline (Saved)' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Save Error' : 'Note Saved'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {wordCount} words · {readingTime}m read
          </span>
        </div>
        <div className="header-actions">
          {/* Favorite Toggle */}
          <button 
            className="icon-btn" 
            onClick={async () => {
              if (note?.id) {
                const isFav = await toggleFavoriteNote(note.id);
                showToast(isFav ? 'Pinned to Favorites' : 'Removed from Favorites', 'info');
              }
            }}
            aria-label="Toggle Favorite"
            title={Number(note?.isFavorite) === 1 ? 'Favorited' : 'Add to Favorites'}
            style={{ color: Number(note?.isFavorite) === 1 ? 'var(--accent-gold, #f59e0b)' : 'inherit' }}
          >
            <Star size={17} fill={Number(note?.isFavorite) === 1 ? 'var(--accent-gold, #f59e0b)' : 'none'} />
          </button>

          {/* Archive Toggle */}
          <button 
            className="icon-btn" 
            onClick={async () => {
              if (note?.id) {
                if (Number(note.isArchived) === 1) {
                  await restoreNote(note.id);
                  showToast('Note restored from Archive', 'info');
                } else {
                  await archiveNote(note.id);
                  showToast('Note moved to Archive', 'info');
                }
              }
            }}
            aria-label="Toggle Archive"
            title={Number(note?.isArchived) === 1 ? 'Restore from Archive' : 'Archive Note'}
            style={{ color: Number(note?.isArchived) === 1 ? 'var(--accent-primary)' : 'inherit' }}
          >
            {Number(note?.isArchived) === 1 ? <ArchiveRestore size={17} /> : <Archive size={17} />}
          </button>

          <button className="icon-btn ai-btn" onClick={handleAiSummarize} disabled={isAiLoading || !content.trim()} aria-label="Summarize with AI" title="Auto-Summarize Note (AI)">
            <FileText size={17} className={isAiLoading ? 'spin-pulse' : ''} style={{ color: 'var(--node-amber)' }} />
          </button>
          <button className="icon-btn ai-btn" onClick={handleAiAutoTag} disabled={isAiLoading} aria-label="Auto-Tag with AI" title="Auto-Tag & Suggest Links (AI)">
            <Wand2 size={17} className={isAiLoading ? 'spin-pulse' : ''} style={{ color: 'var(--node-amber)' }} />
          </button>
          <button className="icon-btn delete-btn" onClick={handleDelete} aria-label="Delete note" title="Delete note">
            <Trash2 size={17} />
          </button>
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close panel" title="Close panel">
            <X size={17} />
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
          <div className="segmented-control glass-pill">
            <button 
              type="button"
              className={`tab-btn ${editMode ? 'active' : ''}`}
              onClick={() => setEditMode(true)}
              aria-pressed={editMode}
            >
              <PenTool size={13} /> Edit Mode
            </button>
            <button 
              type="button"
              className={`tab-btn ${!editMode ? 'active' : ''}`}
              onClick={() => setEditMode(false)}
              aria-pressed={!editMode}
            >
              <FileText size={13} /> Preview
            </button>
          </div>

          {/* Quick Format Actions (visible in Edit mode) */}
          {editMode && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="icon-btn" onClick={() => insertText('**', '**')} aria-label="Bold" title={`Bold (${formatShortcut('B')})`}><Bold size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('_', '_')} aria-label="Italic" title={`Italic (${formatShortcut('I')})`}><Italic size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('### ')} aria-label="Heading" title="Heading (###)"><Heading size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('```\n', '\n```')} aria-label="Code Block" title="Code Block (```)"><Code size={13} /></button>
              <button className="icon-btn" onClick={() => insertText('[[', ']]')} aria-label="Wiki Link" title={`Wiki Link (${formatShortcut('K')})`}><LinkIcon size={13} /></button>
              
              {/* Quick AI Writing Assistant */}
              {isAiLoading ? (
                <button
                  type="button"
                  className="btn btn-sm btn-danger d-flex align-items-center gap-1"
                  onClick={() => {
                    abortRef.current?.abort();
                    setIsAiLoading(false);
                    showToast('AI writing stopped', 'info');
                  }}
                  style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                  title="Cancel active AI writing operation"
                >
                  <Square size={11} fill="currentColor" /> Stop AI
                </button>
              ) : (
                <Dropdown
                  value=""
                  onChange={(val) => {
                    if (val === 'fix') handleInlineAiTransform('Fix all spelling, grammar, and improve phrasing while preserving markdown structure.');
                    else if (val === 'simplify') handleInlineAiTransform('Simplify this text to make it clear, concise, and easy to read.');
                    else if (val === 'pro') handleInlineAiTransform('Rewrite in a polished, professional, and clear executive tone.');
                    else if (val === 'tasks') handleInlineAiTransform('Extract all action items, todos, and next steps into a markdown task checklist (- [ ] task).');
                    else if (val === 'flashcard') handleInlineAiTransform('Generate 2-3 high-yield spaced repetition Q&A flashcards based on this content.');
                  }}
                  options={[
                    { value: "", label: "✨ AI Assistant..." },
                    { value: "fix", label: "✨ Polish & Fix Grammar" },
                    { value: "simplify", label: "✨ Simplify Language" },
                    { value: "pro", label: "✨ Executive Tone" },
                    { value: "tasks", label: "✨ Extract Action Items" },
                    { value: "flashcard", label: "✨ Create Flashcards" }
                  ]}
                  style={{ width: '150px' }}
                />
              )}
            </div>
          )}
        </div>

        {/* Main Note Canvas (Resizable in both Edit and Preview modes) */}
        <div 
          ref={contentContainerRef}
          className="note-content-container" 
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            ...(customTextareaHeight ? { height: `${customTextareaHeight}px` } : { minHeight: '260px', flex: '1 1 auto' })
          }}
        >
          {editMode ? (
            <div className="note-textarea-wrapper" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <textarea
                ref={textareaRef}
                id="editor-note-body"
                className="note-textarea"
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your markdown notes here. Use [[Double Brackets]] to link nodes. Type '/' for block commands..."
                style={{ width: '100%', height: '100%', flex: 1, resize: 'none' }}
              />
              {/* Wiki-link autocomplete popup menu */}
              {wikiSuggest?.isOpen && wikiMatches.length > 0 && (
                <div className="glass-panel" style={{
                  position: 'absolute',
                  top: wikiSuggest.top,
                  left: wikiSuggest.left,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  zIndex: 'var(--z-dropdown, 50)',
                  minWidth: '200px',
                  maxWidth: '280px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  background: 'var(--surface-dropdown, #181926)'
                }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '2px 8px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Link to Note</div>
                  {wikiMatches.map((matchNote, idx) => (
                    <button
                      key={matchNote.id}
                      className="btn btn-sm"
                      onClick={() => handleSelectWikiCandidate(matchNote.title)}
                      style={{
                        justifyContent: 'flex-start',
                        width: '100%',
                        fontSize: '0.8rem',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: idx === wikiSuggest.selectedIndex ? 'var(--accent-primary)' : 'transparent',
                        color: idx === wikiSuggest.selectedIndex ? '#ffffff' : 'var(--text-primary)',
                        border: 'none',
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      [[{matchNote.title}]]
                    </button>
                  ))}
                </div>
              )}

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
              style={{ width: '100%', height: '100%', flex: 1, overflowY: 'auto', padding: '6px 0' }}
            />
          )}

          {/* Unified Visual & interactive vertical resize drag handle */}
          <div 
            className="textarea-resize-handle" 
            onPointerDown={handleResizePointerDown}
            onDoubleClick={() => setCustomTextareaHeight(null)}
            title="Drag up/down to resize height (double-click to reset)"
          >
            <div className="resize-splitter-line" />
            <div className="resize-grip-pill">
              <GripHorizontal size={13} />
              <span>Resize</span>
            </div>
          </div>
        </div>
        
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

        {/* Backlinks / Linked References Section */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LinkIcon size={13} /> Backlinks ({incomingBacklinks.length})
            </h4>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {incomingBacklinks.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No other notes link to this note yet.</span>
            ) : (
              incomingBacklinks.map(backlinkNote => (
                <div key={backlinkNote.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--surface-pill-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', fontSize: '0.85rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--node-indigo)' }}></div>
                  <button
                    type="button"
                    style={{ cursor: 'pointer', background: 'transparent', border: 'none', color: 'inherit', padding: 0, font: 'inherit' }}
                    onClick={() => onJumpToNote(backlinkNote.title)}
                    aria-label={`Open backlink ${backlinkNote.title}`}
                  >
                    {backlinkNote.title}
                  </button>
                  {onSplitRight && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSplitRight(backlinkNote.title); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '4px' }}
                      title="Open in split view"
                      aria-label="Open in split view"
                    >
                      <SplitSquareHorizontal size={12} />
                    </button>
                  )}
                </div>
              ))
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

