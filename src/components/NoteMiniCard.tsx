import React from 'react';
import type { Note, Category } from '../db';
import { X, FileText, Sparkles } from 'lucide-react';

interface NoteMiniCardProps {
  note: Note;
  category?: Category;
  onOpenEditor: () => void;
  onAskAi: () => void;
  onClose: () => void;
}

export const NoteMiniCard: React.FC<NoteMiniCardProps> = ({ note, category, onOpenEditor, onAskAi, onClose }) => {
  return (
    <div className="note-mini-card" style={{
      position: 'absolute', bottom: 'calc(var(--mobile-nav-height, 60px) + 16px)', left: '16px', right: '16px',
      background: 'rgba(20, 27, 50, 0.95)', borderRadius: '16px',
      padding: '16px', zIndex: 50,
      border: '1px solid rgba(124, 58, 237, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(10px)',
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }}>
      <div style={{ width: '32px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 12px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary, #ffffff)' }}>
          <span style={{ color: category?.color || '#818cf8', marginRight: '8px' }}>●</span>
          {note.title}
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #9ca3af)', padding: '4px' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>
        <span>Category: {category?.id || note.category}</span>
        {note.tags && note.tags.length > 0 && (
          <span style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>Tags: {note.tags.slice(0,2).join(', ')}{note.tags.length > 2 ? '...' : ''}</span>
        )}
      </div>
      <div style={{ 
        borderTop: '1px solid rgba(255,255,255,0.05)', 
        borderBottom: '1px solid rgba(255,255,255,0.05)', 
        padding: '12px 0', marginBottom: '16px',
        fontSize: '14px', color: 'var(--text-primary, #ffffff)',
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {note.content || <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Empty note</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={onOpenEditor} 
          style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '500' }}
        >
          <FileText size={16} /> Open Full Editor
        </button>
        <button 
          onClick={onAskAi} 
          style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--node-amber, #f59e0b)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Sparkles size={16} />
        </button>
      </div>
    </div>
  );
};
