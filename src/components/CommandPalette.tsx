import React, { useState, useEffect, useRef } from 'react';
import type { Note, Category } from '../db';
import { Search, FileText } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (title: string) => void;
  categories: Category[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  notes,
  onSelectNote,
  categories
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      setQuery('');

      setSelectedIndex(0);

      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(query.toLowerCase()) || 
    n.content.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8); // Show top 8 results

  useEffect(() => {
      // eslint-disable-next-line
    setSelectedIndex(0);
  }, [query]);

  const totalItems = filteredNotes.length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {

        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (filteredNotes[selectedIndex]) {
          onSelectNote(filteredNotes[selectedIndex].title);
          onClose();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredNotes, selectedIndex, onClose, onSelectNote, totalItems]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-modal glass-panel" onClick={e => e.stopPropagation()}>
        <div className="command-search-bar">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder="Search existing pages..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        
        {filteredNotes.length > 0 && (
          <div className="command-results">
            {filteredNotes.map((note, idx) => {
              const categoryObj = categories.find(c => c.id === note.category);
              const color = categoryObj ? categoryObj.color : 'var(--text-secondary)';
              return (
                <div
                  key={note.id}
                  className={`command-result-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectNote(note.title);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
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
        
        {query && filteredNotes.length === 0 && (
          <div className="command-no-results" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: 0.7 }}>
            <Search size={32} />
            <span>No pages found matching "{query}"</span>
          </div>
        )}
      </div>
    </div>
  );
};
