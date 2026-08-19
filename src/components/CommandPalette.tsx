/**
 * @file CommandPalette.tsx
 * @description Spotlight-style command palette modal for fast keyboard-driven note search and navigation in AetherMind.
 * Provides instant fuzzy-style filtering across note titles and content with full keyboard navigation support (Arrow keys, Enter, Esc).
 * @module components/CommandPalette
 */

import React, { useState, useEffect, useRef } from 'react';
import type { Note, Category } from '../db';
import { Search, FileText } from 'lucide-react';

/**
 * Props for the {@link CommandPalette} component.
 *
 * @interface CommandPaletteProps
 * @property {boolean} isOpen - Flag indicating whether the command palette modal is currently visible.
 * @property {() => void} onClose - Callback invoked when the user dismisses the command palette (e.g., via Esc, clicking backdrop, or selecting a note).
 * @property {Note[]} notes - List of all available notes within the active page to search and filter through.
 * @property {(title: string) => void} onSelectNote - Callback invoked with the selected note's title to jump to or open that note.
 * @property {Category[]} categories - List of defined note categories, used to render category badges and colors.
 */
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (title: string) => void;
  categories: Category[];
}

/**
 * CommandPalette Component
 *
 * A modal overlay triggered globally via `Cmd+K` / `Ctrl+K` or the header search bar.
 * Allows users to quickly search notes by title or content, navigate results using arrow keys,
 * and select notes using Enter or mouse clicks.
 *
 * @component
 * @param {CommandPaletteProps} props - Component properties.
 * @returns {React.ReactElement | null} The rendered modal overlay or `null` if `isOpen` is false.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  notes,
  onSelectNote,
  categories
}) => {
  /** Search query string entered by the user. */
  const [query, setQuery] = useState('');

  /** Index of the currently highlighted result item in the filtered list. */
  const [selectedIndex, setSelectedIndex] = useState(0);

  /** Reference to the search input element for managing auto-focus. */
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Ref holding the latest filtered notes list.
   * Synced to allow global keyboard event listeners to access fresh results without re-binding.
   */
  const filteredRef = useRef<Note[]>([]);

  /** Ref tracking the current selected index to prevent stale closures in keydown listeners. */
  const selectedIndexRef = useRef(selectedIndex);

  /** Ref tracking the latest onSelectNote callback. */
  const onSelectNoteRef = useRef(onSelectNote);

  /** Ref tracking the latest onClose callback. */
  const onCloseRef = useRef(onClose);

  // Synchronize refs with component state and props
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    onSelectNoteRef.current = onSelectNote;
  }, [onSelectNote]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /**
   * Reset query and selection index whenever the palette is opened,
   * and schedule focus onto the search input field.
   */
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      setQuery('');
      setSelectedIndex(0);

      // Slight timeout ensures DOM element is rendered and interactive before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  /**
   * Filter notes based on case-insensitive title and content matching.
   * Caps results at 8 to keep the spotlight overlay compact and legible.
   */
  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(query.toLowerCase()) || 
    n.content.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8); // Show top 8 results

  // Keep filteredRef updated with latest filtered notes
  useEffect(() => {
    filteredRef.current = filteredNotes;
  }, [filteredNotes]);

  // Reset selected item index whenever the search query changes
  useEffect(() => {
    // eslint-disable-next-line
    setSelectedIndex(0);
  }, [query]);

  /**
   * Global keyboard navigation handler:
   * - `Escape`: Closes the palette
   * - `ArrowDown`: Moves selection down (clamped to result count)
   * - `ArrowUp`: Moves selection up (clamped to 0)
   * - `Enter`: Selects the currently highlighted note
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const fn = filteredRef.current;
      const idx = selectedIndexRef.current;

      if (e.key === 'Escape') {
        onCloseRef.current();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev < fn.length - 1 ? prev + 1 : prev));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (fn[idx]) {
          onSelectNoteRef.current(fn[idx].title);
          onCloseRef.current();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // If palette is closed, do not render modal markup
  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose} role="presentation">
      <div 
        className="command-palette-modal glass-panel" 
        onClick={e => e.stopPropagation()} 
        role="dialog" 
        aria-label="Search pages"
      >
        {/* Search Input Bar */}
        <div className="command-search-bar">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder="Search notes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        
        {/* Filtered Results List */}
        {filteredNotes.length > 0 && (
          <div className="command-results">
            {filteredNotes.map((note, idx) => {
              const categoryObj = categories.find(c => c.id === note.category);
              const color = categoryObj ? categoryObj.color : 'var(--text-secondary)';
              return (
                <div
                  key={note.id}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`command-result-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectNote(note.title);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <FileText size={16} className="command-item-icon" />
                  <div className="command-item-details">
                    <div className="command-item-title">{note.title}</div>
                    <div className="command-item-category" style={{ color }}>
                      {categoryObj ? categoryObj.label : note.category}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Empty State when no results match query */}
        {query && filteredNotes.length === 0 && (
          <div 
            className="command-no-results" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '8px', 
              opacity: 0.7, 
              padding: '24px 16px' 
            }}
          >
            <Search size={28} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.875rem' }}>No notes found matching "{query}"</span>
          </div>
        )}

        {/* Modal Footer with Keyboard Shortcuts Help */}
        <div 
          className="command-footer" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '8px 16px', 
            borderTop: '1px solid var(--border-color)', 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)', 
            background: 'var(--card-nested-bg)' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="kbd-badge">↑</span> <span className="kbd-badge">↓</span> Navigate
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="kbd-badge">↵</span> Select
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="kbd-badge">esc</span> Dismiss
          </span>
        </div>
      </div>
    </div>
  );
};
