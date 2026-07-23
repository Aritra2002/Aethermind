import React, { useState } from 'react';
import type { Note, Category } from '../db';
import { X, FileText } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface NoteMiniCardProps {
  note: Note;
  category?: Category;
  onOpenEditor: () => void;
  onJumpToNote?: (title: string) => void;
  onClose: () => void;
}

export const NoteMiniCard: React.FC<NoteMiniCardProps> = ({ note, category, onOpenEditor, onJumpToNote, onClose }) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);

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

  const getRenderedContent = () => {
    if (!note.content) return '';
    const processedContent = note.content.replace(/\[\[(.*?)\]\]/g, (_, p1) => {
      const cleanTitle = p1.trim();
      return `[${cleanTitle}](#wiki-${encodeURIComponent(cleanTitle)})`;
    });
    try {
      const rawHtml = marked.parse(processedContent) as string;
      return DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['href'],
        ALLOWED_URI_REGEXP: /^(https?|ftp|mailto|#wiki-)/i,
      });
    } catch {
      return '<p>Error rendering markdown.</p>';
    }
  };

  // Only trigger swipe-up when the touch originates from the drag handle area, not the scrollable preview
  const [swipeFromHandle, setSwipeFromHandle] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
    setSwipeFromHandle(true); // this handler is only on the handle div
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !swipeFromHandle) return;
    const touchEnd = e.changedTouches[0].clientY;
    if (touchStart - touchEnd > 50) { // Swipe up threshold
      onOpenEditor();
    }
    setTouchStart(null);
    setSwipeFromHandle(false);
  };

  const handlePreviewTouchStart = () => {
    setSwipeFromHandle(false); // touch started in scrollable area — disable swipe-up
  };

  return (
    <div 
      className="note-mini-card"
      style={{ padding: '16px' }}
    >
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: 'grab', paddingBottom: '8px' }}
      >
        <div style={{ width: '32px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary, #ffffff)' }}>
            <span style={{ color: category?.color || '#818cf8', marginRight: '8px' }}>●</span>
            {note.title}
          </h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>
        <span>Category: {category?.id || note.category}</span>
        {note.tags && note.tags.length > 0 && (
          <span style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>Tags: {note.tags.slice(0,2).join(', ')}{note.tags.length > 2 ? '...' : ''}</span>
        )}
      </div>
      <div 
        ref={previewRef}
        className="markdown-body"
        style={{ 
          borderTop: '1px solid rgba(255,255,255,0.05)', 
          borderBottom: '1px solid rgba(255,255,255,0.05)', 
          padding: '12px 0', marginBottom: '16px',
          fontSize: '14px', color: 'var(--text-primary, #ffffff)',
          maxHeight: '40vh', overflowY: 'auto',
          touchAction: 'pan-y' // Ensure native scrolling works for the content
        }}
        onPointerDown={(e) => e.stopPropagation()} // Let scroll happen instead of drag
        onTouchStart={handlePreviewTouchStart} // Disable swipe-up when touch starts in preview
      >
        {note.content ? (
          <div dangerouslySetInnerHTML={{ __html: getRenderedContent() }} />
        ) : (
          <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Empty note</span>
        )}
      </div>
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
