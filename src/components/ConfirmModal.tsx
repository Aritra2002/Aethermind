import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

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
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 'var(--z-popover, 1100)' }}>
      <div className="settings-modal" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isDestructive && <AlertTriangle size={20} color="#ef4444" />}
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
          </div>
          <button className="btn btn-icon" onClick={onCancel} aria-label="Close"><X size={20} /></button>
        </div>
        
        <div className="modal-content" style={{ paddingBottom: '24px' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
            {message}
          </p>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-secondary" 
              onClick={onCancel}
            >
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
