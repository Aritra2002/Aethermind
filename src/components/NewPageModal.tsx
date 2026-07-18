import React, { useState, useEffect, useRef } from 'react';
import { X, FileText } from 'lucide-react';

interface NewPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}

export const NewPageModal: React.FC<NewPageModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleClose = () => {
    setTitle('');
    onClose();
  };

  const handleCreate = () => {
    const finalTitle = title.trim();
    if (finalTitle) {
      onCreate(finalTitle);
      setTitle('');
      onClose();
    }
  };

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
    <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 'var(--z-modal, 1000)' }}>
      <div className="settings-modal glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} />
            <h2>Create New Page</h2>
          </div>
          <button className="icon-btn close-btn" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-content" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Page Name..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                padding: '12px 16px',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="settings-action-btn" onClick={handleClose}>
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!title.trim()}
                style={{ padding: '8px 16px', borderRadius: '6px' }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
