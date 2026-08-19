/**
 * ============================================================================
 * PromptModal.tsx — Generic Text Input Prompt Dialog
 * ============================================================================
 * 
 * Architectural Purpose:
 * A reusable modal prompt replacing the browser's native `window.prompt()` with
 * a styled, accessible, themed dialog. Collects single-line string input from the user
 * with validation, auto-focus, keyboard dismissibility, and placeholder support.
 * 
 * Key Features:
 * - Direct replacement for blocking browser prompt dialogs.
 * - Auto-focuses the input field upon mounting.
 * - Global key listener for immediate `Escape` key cancellation.
 * - Form submission integration allowing standard Enter key confirmations.
 * - Disables confirmation button for empty/whitespace-only input.
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Props for the PromptModal component.
 */
interface PromptModalProps {
  /** The heading title displayed at the top of the prompt dialog */
  title: string;
  /** Explanatory message or instructional copy describing the expected input */
  message: string;
  /** Optional placeholder text for the input field */
  placeholder?: string;
  /** Initial default value pre-populating the input */
  defaultValue?: string;
  /** Callback fired when the user confirms with valid text */
  onConfirm: (value: string) => void;
  /** Callback fired when the user cancels or closes the dialog */
  onCancel: () => void;
}

/**
 * PromptModal Component
 * 
 * Renders a stylized text input modal dialog.
 * 
 * @param {PromptModalProps} props - Component properties.
 * @returns {React.ReactElement} The rendered prompt modal dialog.
 */
export function PromptModal({ 
  title, 
  message, 
  placeholder = '', 
  defaultValue = '', 
  onConfirm, 
  onCancel 
}: PromptModalProps) {
  /** Current input value initialized from defaultValue */
  const [value, setValue] = useState(defaultValue);
  
  /** Ref to the input element for programmatic focus on mount */
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input and bind global Escape key listener
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1100 }} onClick={onCancel}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-content glass-panel border-0">
          {/* Modal Header */}
          <div className="modal-header border-0">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close btn-close-overlay" onClick={onCancel} aria-label="Close" />
          </div>
          
          {/* Form wrapper for Enter submission */}
          <form onSubmit={(e) => { e.preventDefault(); onConfirm(value); }}>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '14px', fontSize: '0.875rem', lineHeight: 1.5 }}>
                {message}
              </p>
              <div className="search-bar-container" style={{ padding: '8px 12px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="search-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder}
                  style={{ fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer border-0 d-flex gap-2 justify-content-end pt-0">
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}