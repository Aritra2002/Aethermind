/**
 * ============================================================================
 * ConfirmModal.tsx — Reusable Confirmation & Destructive Action Dialog
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides a standardized confirmation dialog across AetherMind for confirming
 * irreversible or critical actions (e.g. deleting notes, dropping categories,
 * resetting databases, overwriting backups with imports).
 * 
 * Key Features:
 * - Visual warning indicator: renders an `AlertTriangle` with destructive theme styling.
 * - Dynamic button theming: adapts button CSS classes (`btn-danger` vs `btn-primary`)
 *   based on the `isDestructive` property flag.
 * - Backdrop click and button dismissal support.
 * - Custom customizable label overrides for confirm and cancel actions.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAnime } from '../utils/animation/useAnime';
import { AnimePresets } from '../utils/animation/animeEngine';

/**
 * Props for the ConfirmModal component.
 */
interface ConfirmModalProps {
  /** Controls whether the confirmation modal is open and visible */
  isOpen: boolean;
  /** Dialog heading title */
  title: string;
  /** Descriptive warning or explanation message explaining the consequences */
  message: string;
  /** Optional text label for the confirmation button (defaults to 'Confirm') */
  confirmText?: string;
  /** Optional text label for the cancellation button (defaults to 'Cancel') */
  cancelText?: string;
  /** Whether the confirmed action is destructive (affects warning icon and button color) */
  isDestructive?: boolean;
  /** Callback fired when the user confirms the action */
  onConfirm: () => void;
  /** Callback fired when the user cancels or dismisses the dialog */
  onCancel: () => void;
}

/**
 * ConfirmModal Component
 * 
 * Renders a standardized confirmation modal dialog.
 * 
 * @param {ConfirmModalProps} props - Component properties.
 * @returns {React.ReactElement | null} The rendered modal or null if not open.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel
}) => {
  const backdropRef = useAnime<HTMLDivElement>(isOpen ? AnimePresets.backdropEnter : null, [isOpen]);
  const modalRef = useAnime<HTMLDivElement>(isOpen ? AnimePresets.modalEnter : null, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={backdropRef} className="modal d-block" tabIndex={-1} style={{ zIndex: 1100 }} onClick={onCancel}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
        <div ref={modalRef} className="modal-content glass-panel border-0" style={{ animation: 'none' }}>
          {/* Modal Header with Optional Destructive Alert Icon */}
          <div className="modal-header border-0">
            <div className="d-flex align-items-center gap-2">
              {isDestructive && <AlertTriangle size={20} color="var(--accent-danger, #ef4444)" />}
              <h5 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
                {title}
              </h5>
            </div>
            <button type="button" className="btn-close btn-close-overlay" onClick={onCancel} aria-label="Close" />
          </div>

          {/* Modal Body with Warning Copy */}
          <div className="modal-body">
            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {message}
            </p>
          </div>

          {/* Modal Actions */}
          <div className="modal-footer border-0 d-flex gap-2 justify-content-end">
            <button className="btn btn-secondary" onClick={onCancel}>
              {cancelText}
            </button>
            <button 
              className={isDestructive ? 'btn btn-danger' : 'btn btn-primary'} 
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};