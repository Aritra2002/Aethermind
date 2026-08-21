/**
 * @file CommandPalette.tsx
 * @description Spotlight-style command palette modal for fast keyboard-driven note search and navigation in AetherMind.
 * Provides instant fuzzy-style filtering across note titles and content with full keyboard navigation support (Arrow keys, Enter, Esc).
 * @module components/CommandPalette
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Note, Category } from '../db';
import { Search, FileText, Sparkles, Plus, BookOpen, Calendar, Settings } from 'lucide-react';
import { tokenizeText, scoreBM25Note, isTokenMatch } from '../utils/search/bm25';

/**
 * Palette Item model representing either a searchable note or an executable command.
 */
interface PaletteItem {
  id: string;
  title: string;
  category: string;
  color?: string;
  icon: React.ReactNode;
  perform: () => void;
}

/**
 * Props for the {@link CommandPalette} component.
 */
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (title: string) => void;
  categories: Category[];
  onOpenAskAi?: () => void;
  onOpenSettings?: () => void;
  onOpenNewNote?: () => void;
  onOpenReview?: () => void;
  onOpenJournal?: () => void;
}

/**
 * CommandPalette Component
 *
 * Universal Spotlight & Action Hub triggered globally via `Cmd+K` / `Ctrl+K`.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  notes,
  onSelectNote,
  categories,
  onOpenAskAi,
  onOpenSettings,
  onOpenNewNote,
  onOpenReview,
  onOpenJournal
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available system commands
  const systemCommands: PaletteItem[] = useMemo(() => [
    ...(onOpenAskAi ? [{
      id: 'cmd-ai',
      title: 'Ask AI Copilot',
      category: 'Command',
      color: 'var(--accent-gold, #f59e0b)',
      icon: <Sparkles size={16} />,
      perform: () => { onOpenAskAi(); onClose(); }
    }] : []),
    ...(onOpenNewNote ? [{
      id: 'cmd-new',
      title: 'Create New Note',
      category: 'Action',
      color: 'var(--accent-primary, #8b5cf6)',
      icon: <Plus size={16} />,
      perform: () => { onOpenNewNote(); onClose(); }
    }] : []),
    ...(onOpenReview ? [{
      id: 'cmd-review',
      title: 'Review Flashcards (Spaced Repetition)',
      category: 'Learning',
      color: 'var(--node-emerald, #10b981)',
      icon: <BookOpen size={16} />,
      perform: () => { onOpenReview(); onClose(); }
    }] : []),
    ...(onOpenJournal ? [{
      id: 'cmd-journal',
      title: 'Open Daily Journal',
      category: 'Journal',
      color: 'var(--node-cyan, #06b6d4)',
      icon: <Calendar size={16} />,
      perform: () => { onOpenJournal(); onClose(); }
    }] : []),
    ...(onOpenSettings ? [{
      id: 'cmd-settings',
      title: 'Settings & Data Management',
      category: 'System',
      color: 'var(--text-secondary)',
      icon: <Settings size={16} />,
      perform: () => { onOpenSettings(); onClose(); }
    }] : [])
  ], [onOpenAskAi, onOpenNewNote, onOpenReview, onOpenJournal, onOpenSettings, onClose]);

  // Filtered items (notes + commands) with fuzzy typo matching & BM25 ranking
  const filteredItems: PaletteItem[] = useMemo(() => {
    const q = query.trim();
    
    // Convert notes into palette items
    const noteItems: (PaletteItem & { score: number })[] = notes.map(note => {
      const cat = categories.find(c => c.id === note.category);
      return {
        id: `note-${note.id}`,
        title: note.title,
        category: cat ? cat.label : note.category,
        color: cat ? cat.color : 'var(--text-secondary)',
        icon: <FileText size={16} />,
        score: 0,
        perform: () => {
          onSelectNote(note.title);
          onClose();
        }
      };
    });

    if (!q) {
      // Empty query shows top system commands and 5 recent notes
      return [...systemCommands, ...noteItems.slice(0, 5)];
    }

    const queryTokens = tokenizeText(q, true);

    // 1. Match commands using fuzzy token matching
    const matchedCommands = systemCommands
      .map(cmd => {
        const cmdTokens = tokenizeText(cmd.title);
        let cmdScore = 0;
        for (const qt of queryTokens) {
          for (const ct of cmdTokens) {
            const match = isTokenMatch(ct, qt);
            if (match.matched) cmdScore += match.scoreModifier;
          }
        }
        if (cmd.title.toLowerCase().includes(q.toLowerCase())) cmdScore += 2.0;
        return { item: cmd, score: cmdScore };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);

    // 2. Match notes using BM25 multi-field scoring
    const matchedNotes = notes
      .map(note => {
        const cat = categories.find(c => c.id === note.category);
        const bm25 = scoreBM25Note(queryTokens, {
          title: note.title,
          tags: note.tags,
          content: note.content || ''
        });
        return {
          id: `note-${note.id}`,
          title: note.title,
          category: cat ? cat.label : note.category,
          color: cat ? cat.color : 'var(--text-secondary)',
          icon: <FileText size={16} />,
          score: bm25.score,
          perform: () => {
            onSelectNote(note.title);
            onClose();
          }
        };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return [...matchedCommands, ...matchedNotes].slice(0, 10);
  }, [query, notes, categories, systemCommands, onSelectNote, onClose]);

  const itemsRef = useRef(filteredItems);
  const selectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    itemsRef.current = filteredItems;
    selectedIndexRef.current = selectedIndex;
  });

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query]);

  // Global keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const items = itemsRef.current;
      const idx = selectedIndexRef.current;

      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (items[idx]) {
          items[idx].perform();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose} role="presentation">
      <div 
        className="command-palette-modal glass-panel" 
        onClick={e => e.stopPropagation()} 
        role="dialog" 
        aria-label="Universal Search & Commands"
      >
        {/* Search Input Bar */}
        <div className="command-search-bar">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder="Search notes or execute commands..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        
        {/* Filtered Results List */}
        {filteredItems.length > 0 && (
          <div className="command-results">
            {filteredItems.map((item, idx) => {
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`command-result-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={item.perform}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <span style={{ color: item.color || 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </span>
                  <div className="command-item-details">
                    <div className="command-item-title">{item.title}</div>
                    <div className="command-item-category" style={{ color: item.color || 'var(--text-muted)' }}>
                      {item.category}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Empty State when no results match query */}
        {query && filteredItems.length === 0 && (
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
            <span style={{ fontSize: '0.875rem' }}>No results found matching "{query}"</span>
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
              <span className="kbd-badge">↵</span> Select / Run
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
