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
      setTitle('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleCreate = () => {
    const finalTitle = title.trim();
    if (finalTitle) {
      onCreate(finalTitle);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 'var(--z-modal, 1000)' }}>
      <div className="settings-modal glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} />
            <h2>Create New Page</h2>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close">
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
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 16px',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="settings-action-btn" onClick={onClose}>
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
