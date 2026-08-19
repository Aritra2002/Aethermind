/**
 * @file ConfirmActionToast.tsx
 * @description Confirmation toast notification for AI Copilot destructive and mutating actions (editing or deleting notes).
 * Displays a diff preview for edits or reason for deletion, allowing the user to approve or cancel the AI's proposal.
 * @module components/ConfirmActionToast
 */

import React, { useEffect, useState } from 'react';
import { AiAction } from '../utils/aiActions';
import { db } from '../db';
import { X, AlertTriangle } from 'lucide-react';

/**
 * Props for the {@link ConfirmActionToast} component.
 *
 * @interface ConfirmActionToastProps
 * @property {AiAction} action - The AI action being proposed (e.g., `edit_note` or `delete_note`).
 * @property {number} pageId - The ID of the currently active workspace page.
 * @property {() => void} onConfirm - Callback triggered when the user accepts and executes the proposed action.
 * @property {() => void} onCancel - Callback triggered when the user rejects or closes the toast.
 */
interface ConfirmActionToastProps {
  action: AiAction;
  pageId: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmActionToast Component
 *
 * Renders a high-visibility toast card at the bottom-right of the viewport
 * whenever an AI Copilot action requires explicit user authorization before execution.
 *
 * @component
 * @param {ConfirmActionToastProps} props - Component properties.
 * @returns {React.ReactElement} The rendered confirmation toast.
 */
export const ConfirmActionToast: React.FC<ConfirmActionToastProps> = ({ action, pageId, onConfirm, onCancel }) => {
  /** Holds the pre-existing note content fetched from IndexedDB for diff comparison. */
  const [existingContent, setExistingContent] = useState('');

  /**
   * Fetches the current content of the note targeted for modification or deletion.
   * Enables before/after diff previewing for edit actions.
   */
  useEffect(() => {
    let isMounted = true;
    async function fetchExisting() {
      if (action.action === 'edit_note' || action.action === 'delete_note') {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (note && isMounted) {
          setExistingContent(note.content);
        }
      }
    }
    fetchExisting();
    return () => { isMounted = false; };
  }, [action, pageId]);

  return (
    <div 
      className="confirm-action-toast glass-panel" 
      style={{
        position: 'fixed',
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        right: '20px',
        zIndex: 'var(--z-toast, 9999)',
        padding: '16px',
        borderRadius: '8px',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid rgba(124, 58, 237, 0.4)',
        animation: 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      {/* Toast Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} color="var(--accent-gold)" />
          {action.action === 'delete_note' ? 'Delete Note?' : 'Edit Note?'}
        </h3>
        <button 
          onClick={onCancel} 
          className="btn btn-icon" 
          aria-label="Cancel action"
          style={{ border: 'none', background: 'transparent' }}
        >
          <X size={16}/>
        </button>
      </div>
      
      {/* Edit Note Diff Preview */}
      {action.action === 'edit_note' && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>AI wants to edit '{action.title}'</strong></p>
          {/* Truncated previous content */}
          <div style={{ background: 'var(--card-nested-bg)', padding: '8px', borderRadius: '4px', marginBottom: '4px', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--accent-danger, #ef4444)' }}>- {existingContent.substring(0, 100)}{existingContent.length > 100 ? '...' : ''}</span>
          </div>
          {/* Truncated proposed new content */}
          <div style={{ background: 'var(--card-nested-bg)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--node-emerald, #34d399)' }}>+ {action.newContent?.substring(0, 100)}{action.newContent && action.newContent.length > 100 ? '...' : ''}</span>
          </div>
        </div>
      )}

      {/* Delete Note Warning Preview */}
      {action.action === 'delete_note' && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>AI wants to delete '{action.title}'</strong></p>
          {action.reason && <p style={{ margin: 0 }}>Reason: {action.reason}</p>}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button 
          onClick={onConfirm} 
          className={action.action === 'delete_note' ? 'btn btn-danger' : 'btn btn-primary'}
          style={{ flex: 1 }}
        >
          {action.action === 'delete_note' ? 'Delete' : 'Apply Edit'}
        </button>
        <button 
          onClick={onCancel} 
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

