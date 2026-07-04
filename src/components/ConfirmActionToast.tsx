import React, { useEffect, useState } from 'react';
import { AiAction } from '../utils/aiActions';
import { db } from '../db';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmActionToastProps {
  action: AiAction;
  pageId: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionToast: React.FC<ConfirmActionToastProps> = ({ action, pageId, onConfirm, onCancel }) => {
  const [existingContent, setExistingContent] = useState('');

  useEffect(() => {
    async function fetchExisting() {
      if (action.action === 'edit_note' || action.action === 'delete_note') {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (note) {
          setExistingContent(note.content);
        }
      }
    }
    fetchExisting();
  }, [action, pageId]);

  return (
    <div className="confirm-action-toast glass-panel" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 2000,
      padding: '16px',
      borderRadius: '8px',
      width: '320px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      border: '1px solid rgba(124, 58, 237, 0.4)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} color="var(--accent-gold)" />
          {action.action === 'delete_note' ? 'Delete Note?' : 'Edit Note?'}
        </h3>
        <button onClick={onCancel} className="icon-btn" style={{ border: 'none', background: 'transparent' }}><X size={16}/></button>
      </div>
      
      {action.action === 'edit_note' && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>AI wants to edit '{action.title}'</strong></p>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', marginBottom: '4px' }}>
            <span style={{ color: '#f87171' }}>- {existingContent.substring(0, 100)}{existingContent.length > 100 ? '...' : ''}</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px' }}>
            <span style={{ color: '#34d399' }}>+ {action.newContent?.substring(0, 100)}{action.newContent && action.newContent.length > 100 ? '...' : ''}</span>
          </div>
        </div>
      )}

      {action.action === 'delete_note' && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>AI wants to delete '{action.title}'</strong></p>
          {action.reason && <p style={{ margin: 0 }}>Reason: {action.reason}</p>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button 
          onClick={onConfirm} 
          className="primary-btn"
          style={{ 
            flex: 1, 
            padding: '8px', 
            borderRadius: '4px', 
            background: action.action === 'delete_note' ? '#ef4444' : '',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {action.action === 'delete_note' ? 'Delete' : 'Apply Edit'}
        </button>
        <button 
          onClick={onCancel} 
          style={{ 
            flex: 1, 
            padding: '8px', 
            borderRadius: '4px', 
            background: 'transparent',
            color: 'var(--text-primary)',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
