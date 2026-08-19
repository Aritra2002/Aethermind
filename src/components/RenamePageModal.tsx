/**
 * ============================================================================
 * RenamePageModal.tsx — Workspace Page Renaming Dialog
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides a specialized dialog for modifying the title of an existing graph page /
 * workspace partition in Dexie IndexedDB (`db.pages`).
 * 
 * Key Features:
 * - Direct Dexie database integration for asynchronous page title mutation.
 * - Reactive prop synchronization with parent title updates.
 * - Auto-focusing input field on modal presentation.
 * - Input validation enforcing non-empty, trimmed strings before persisting.
 * - Glassmorphic overlay styling consistent with AetherMind modals.
 */

import React, { useState, useEffect } from 'react';
import { db } from '../db';

/**
 * Props for the RenamePageModal component.
 */
interface RenamePageModalProps {
  /** Controls whether the rename modal dialog is visible */
  isOpen: boolean;
  /** Callback fired to close the modal dialog */
  onClose: () => void;
  /** Primary key ID of the page being renamed */
  pageId: number;
  /** Current title of the page being edited */
  currentTitle: string;
}

/**
 * RenamePageModal Component
 * 
 * Renders a dialog allowing users to rename an active or selected workspace page.
 * 
 * @param {RenamePageModalProps} props - Component properties.
 * @returns {React.ReactElement | null} The rendered modal dialog or null when closed.
 */
export const RenamePageModal: React.FC<RenamePageModalProps> = ({
  isOpen,
  onClose,
  pageId,
  currentTitle
}) => {
  /** Local form state for the page title input */
  const [title, setTitle] = useState(currentTitle);

  // Synchronize local input state whenever the currentTitle prop changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(currentTitle);
  }, [currentTitle]);

  /**
   * Resets local title to the original title and closes the modal.
   */
  const handleClose = () => {
    setTitle(currentTitle);
    onClose();
  };

  if (!isOpen) return null;

  /**
   * Validates non-empty input and updates the page title record in IndexedDB.
   * 
   * @param {React.FormEvent} e - Form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      await db.pages.update(pageId, { title: title.trim() });
      onClose();
    }
  };

  return (
    <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }} onClick={handleClose}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-content glass-panel border-0">
          {/* Modal Header */}
          <div className="modal-header border-0">
            <h5 className="modal-title">Rename Page</h5>
            <button type="button" className="btn-close btn-close-overlay" onClick={handleClose} aria-label="Close" />
          </div>

          {/* Form Container */}
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <label 
                htmlFor="pageTitle" 
                className="form-label" 
                style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '8px' }}
              >
                Page Title
              </label>
              <div className="search-bar-container" style={{ padding: '8px 12px' }}>
                <input
                  id="pageTitle"
                  type="text"
                  className="search-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Work, Ideas, D&D Campaign"
                  autoFocus
                  style={{ fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer border-0 d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};