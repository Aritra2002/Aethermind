/**
 * @file SearchBar.tsx
 * @description Floating search and filter panel overlay for the AetherMind graph canvas.
 * Allows users to filter active graph notes by keyword, category colors, and multi-select tag chips.
 * @module components/SearchBar
 */

import React from 'react';
import { Search, X } from 'lucide-react';
import type { Note, Category } from '../db';

/**
 * Props for the {@link SearchBar} component.
 *
 * @interface SearchBarProps
 * @property {string} searchQuery - The active text search string.
 * @property {(query: string) => void} setSearchQuery - Callback to update the search query string.
 * @property {string[]} selectedTags - Array of tag names currently selected for filtering.
 * @property {(tags: string[]) => void} setSelectedTags - Callback to update the array of selected filter tags.
 * @property {Note[]} notes - List of all notes in the active page (used to extract unique tags).
 * @property {Category[]} categories - List of defined categories for displaying the visual legend.
 * @property {boolean} [isOpen=true] - Whether the search filter panel is currently open/visible.
 * @property {() => void} [onClose] - Optional callback triggered to close the search overlay.
 */
interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  notes: Note[];
  categories: Category[];
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * SearchBar Component
 *
 * Renders a glassmorphic sidebar panel over the graph canvas.
 * Enables live graph filtering through search queries, category reference dots, and clickable tag pills.
 *
 * @component
 * @param {SearchBarProps} props - Component properties.
 * @returns {React.ReactElement} The rendered search and filter panel.
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedTags,
  setSelectedTags,
  notes,
  categories,
  isOpen = true,
  onClose
}) => {
  /**
   * Extracts and deduplicates all unique tags across the current set of notes.
   */
  const allTags = React.useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(tag => {
          if (tag.trim()) tagsSet.add(tag.trim());
        });
      }
    });
    return Array.from(tagsSet);
  }, [notes]);

  /**
   * Toggles the selection state of a filter tag.
   *
   * @param {string} tag - The tag name to toggle.
   */
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  /**
   * Clears both the search query input and all selected tag filters.
   */
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
  };

  return (
    <div className={`search-filter-panel glass-panel ${isOpen ? 'open' : 'closed'}`} id="search-filter-panel-root">
      {/* Header and Close button */}
      <div className="search-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Search & Filter</span>
        {onClose && (
          <button 
            className="icon-only-btn" 
            onClick={onClose} 
            aria-label="Close search panel" 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Text Search Input Field */}
      <div className="search-bar-container">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          id="graph-search-input"
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes, tags, content..."
        />
        {searchQuery && (
          <button className="clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category Visual Legend */}
      <div className="category-legend">
        {categories.map(cat => (
          <div 
            key={cat.id} 
            className="legend-item"
            style={{ cursor: 'pointer' }}
            onClick={() => setSearchQuery(searchQuery ? `${searchQuery} cat:${cat.id}` : `cat:${cat.id}`)}
            title={`Click to filter by cat:${cat.id}`}
          >
            <span className="legend-dot" style={{ backgroundColor: cat.color }}></span>
            <span>{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Syntax Filter Helper Chips */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.72rem' }}>
        <button 
          type="button" 
          className="glass-pill" 
          style={{ padding: '2px 8px', background: 'var(--surface-pill-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '12px' }}
          onClick={() => setSearchQuery(searchQuery ? `${searchQuery} is:favorite` : 'is:favorite')}
        >
          ⭐ is:favorite
        </button>
        <button 
          type="button" 
          className="glass-pill" 
          style={{ padding: '2px 8px', background: 'var(--surface-pill-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '12px' }}
          onClick={() => setSearchQuery(searchQuery ? `${searchQuery} is:archived` : 'is:archived')}
        >
          📦 is:archived
        </button>
      </div>

      {/* Tag Cloud Filter Chips */}
      {allTags.length > 0 && (
        <div className="tag-cloud">
          <h4>Filter by Tags:</h4>
          <div className="tags-container">
            {allTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  className={`tag-filter-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear Filters Indicator */}
      {(searchQuery || selectedTags.length > 0) && (
        <button className="clear-filters-btn" onClick={clearAllFilters}>
          Clear active filters
        </button>
      )}
    </div>
  );
};

