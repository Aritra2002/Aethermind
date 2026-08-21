/**
 * @file NoteMiniCard.tsx
 * @description Compact bottom-sheet preview card for mobile screens in AetherMind.
 * Displays a quick overview of a selected note with rendered markdown, wiki-links, category badges,
 * and support for swipe-up gestures to transition into the full screen Editor.
 * @module components/NoteMiniCard
 */

import React, { useState } from 'react';
import type { Note, Category } from '../db';
import { X, FileText } from 'lucide-react';
import { safeRenderMarkdown } from '../utils/sanitizer';

/**
 * Props for the {@link NoteMiniCard} component.
 *
 * @interface NoteMiniCardProps
 * @property {Note} note - The active note entity to display in the mini card preview.
 * @property {Category} [category] - The category definition object containing color and label metadata.
 * @property {() => void} onOpenEditor - Callback triggered when the user taps "Open Full Editor" or swipes up.
 * @property {(title: string) => void} [onJumpToNote] - Callback triggered when an inline `[[WikiLink]]` is clicked.
 * @property {() => void} onClose - Callback triggered to dismiss the mini card.
 */
interface NoteMiniCardProps {
  note: Note;
  category?: Category;
  onOpenEditor: () => void;
  onJumpToNote?: (title: string) => void;
  onClose: () => void;
}

/**
 * NoteMiniCard Component
 *
 * Renders an elevated bottom-sheet card on mobile viewports when a node is tapped in the graph.
 * Features a swipeable grab handle, scrollable markdown preview, category tag display, and quick navigation.
 *
 * @component
 * @param {NoteMiniCardProps} props - Component properties.
 * @returns {React.ReactElement} The rendered mini card component.
 */
export const NoteMiniCard: React.FC<NoteMiniCardProps> = ({ note, category, onOpenEditor, onJumpToNote, onClose }) => {
  /** Y-coordinate where a touch interaction started on the card handle. */
  const [touchStart, setTouchStart] = useState<number | null>(null);

  /** Reference to the rendered markdown HTML container. */
  const previewRef = React.useRef<HTMLDivElement>(null);

  /**
   * Scans rendered HTML for `#wiki-` anchor links and attaches click listeners
   * to route internal note navigation through `onJumpToNote`.
   */
  React.useEffect(() => {
    const activeLinks: { element: HTMLAnchorElement; listener: (e: MouseEvent) => void }[] = [];
    
    if (previewRef.current && onJumpToNote) {
      const links = previewRef.current.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#wiki-')) {
          const listener = (e: MouseEvent) => {
            e.preventDefault();
            const targetTitle = decodeURIComponent(href.replace('#wiki-', ''));
            onJumpToNote(targetTitle);
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
  }, [note.content, onJumpToNote]);

  /**
   * Converts `[[Wiki Links]]` to custom HTML hash anchors, parses Markdown to HTML,
   * and sanitizes using safeRenderMarkdown.
   *
   * @returns {string} Sanitized HTML string for preview rendering.
   */
  const getRenderedContent = () => {
    if (!note.content) return '';
    return safeRenderMarkdown(note.content);
  };

  /**
   * Flag indicating whether the touch originated from the top drag handle area.
   * Prevents upward scrolling inside the markdown preview from accidentally triggering full editor opening.
   */
  const [swipeFromHandle, setSwipeFromHandle] = useState(false);

  /** Captures initial touch Y position when touching the drag handle. */
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
    setSwipeFromHandle(true);
  };

  /** Evaluates delta Y on touch release; opens full editor if upward swipe exceeds 50px threshold. */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !swipeFromHandle) return;
    const touchEnd = e.changedTouches[0].clientY;
    if (touchStart - touchEnd > 50) { // 50px swipe up threshold
      onOpenEditor();
    }
    setTouchStart(null);
    setSwipeFromHandle(false);
  };

  /** Cancels handle swipe mode when touch originates within the scrollable content container. */
  const handlePreviewTouchStart = () => {
    setSwipeFromHandle(false);
  };

  return (
    <div 
      className="note-mini-card"
      style={{ padding: '16px' }}
    >
      {/* Drag Handle & Card Header */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: 'grab', paddingBottom: '8px' }}
      >
        <div style={{ width: '32px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>
            <span style={{ color: category?.color || '#818cf8', marginRight: '8px' }}>●</span>
            {note.title}
          </h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Category and Tags Metadata Row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <span>Category: {category?.id || note.category}</span>
        {note.tags && note.tags.length > 0 && (
          <span style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
            Tags: {note.tags.slice(0,2).join(', ')}{note.tags.length > 2 ? '...' : ''}
          </span>
        )}
      </div>

      {/* Scrollable Markdown Preview Body */}
      <div 
        ref={previewRef}
        className="markdown-body"
        style={{ 
          borderTop: '1px solid var(--border-subtle)', 
          borderBottom: '1px solid var(--border-subtle)', 
          padding: '12px 0', marginBottom: '16px',
          fontSize: '14px', color: 'var(--text-primary)',
          maxHeight: '40vh', overflowY: 'auto',
          touchAction: 'pan-y' // Ensure native scrolling works for the content
        }}
        onPointerDown={(e) => e.stopPropagation()} // Let scroll happen instead of drag
        onTouchStart={handlePreviewTouchStart} // Disable swipe-up when touch starts in preview
      >
        {note.content ? (
          <div dangerouslySetInnerHTML={{ __html: getRenderedContent() }} />
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Empty note</span>
        )}
      </div>

      {/* Action Button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          className="btn btn-primary"
          onClick={onOpenEditor} 
          style={{ flex: 1 }}
        >
          <FileText size={16} /> Open Full Editor (or Swipe Up)
        </button>
      </div>
    </div>
  );
};

