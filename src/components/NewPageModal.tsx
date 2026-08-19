/**
 * ============================================================================
 * NewPageModal.tsx — Workspace Page Creation Dialog
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides a lightweight dialog for creating new isolated graph pages / workspaces
 * within AetherMind. Pages allow users to partition their knowledge graph into distinct
 * context domains (e.g. Work, Research, Personal, Project-specific).
 * 
 * Key Features:
 * - Immediate auto-focusing on mount for rapid keyboard entry.
 * - Keyboard navigation (Enter to confirm and create, Escape to dismiss).
 * - Input validation preventing blank or whitespace-only page titles.
 * - Backdrop click dismissal and glassmorphic styling consistent with design tokens.
 */

import React, { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';

/**
 * Props for the NewPageModal component.
 */
interface NewPageModalProps {
  /** Controls whether the dialog is open and visible */
  isOpen: boolean;
  /** Callback fired when canceling or closing the modal */
  onClose: () => void;
  /** Callback fired when a new valid page title is submitted */
  onCreate: (title: string) => void;
}

/**
 * NewPageModal Component
 * 
 * Renders a dialog prompting the user for a new graph workspace page title.
 * 
 * @param {NewPageModalProps} props - Component properties.
 * @returns {React.ReactElement | null} The rendered modal dialog or null when closed.
 */
export const NewPageModal: React.FC<NewPageModalProps> = ({ isOpen, onClose, onCreate }) => {
  /** Local state storing the user's input for the page name */
  const [title, setTitle] = useState('');
  
  /** Ref to the text input element for programmatic auto-focus */
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when the modal is opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  /**
   * Resets internal form state and closes the modal dialog.
   */
  const handleClose = () => {
    setTitle('');
    onClose();
  };

  /**
   * Validates and submits the trimmed page title to the creation handler.
   */
  const handleCreate = () => {
    const finalTitle = title.trim();
    if (finalTitle) {
      onCreate(finalTitle);
      setTitle('');
      onClose();
    }
  };

  /**
   * Handles keyboard shortcuts for quick creation or dismissal.
   * 
   * @param {React.KeyboardEvent} e - Keyboard event.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }} onClick={handleClose}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-content glass-panel border-0">
          {/* Modal Header */}
          <div className="modal-header border-0">
            <div className="d-flex align-items-center gap-2">
              <FileText size={18} />
              <h5 className="modal-title" style={{ margin: 0 }}>Create New Page</h5>
            </div>
            <button type="button" className="btn-close btn-close-overlay" onClick={handleClose} aria-label="Close" />
          </div>

          {/* Modal Body */}
          <div className="modal-body">
            <div className="search-bar-container" style={{ padding: '8px 12px' }}>
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Page Name..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ fontSize: '0.95rem' }}
              />
            </div>
          </div>

          {/* Modal Footer with Actions */}
          <div className="modal-footer border-0 d-flex gap-2 justify-content-end">
            <button className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!title.trim()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};