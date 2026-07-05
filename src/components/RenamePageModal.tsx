import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { db } from '../db';

interface RenamePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: number;
  currentTitle: string;
}

export const RenamePageModal: React.FC<RenamePageModalProps> = ({
  isOpen,
  onClose,
  pageId,
  currentTitle
}) => {
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    if (isOpen) setTitle(currentTitle);
  }, [isOpen, currentTitle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      await db.pages.update(pageId, { title: title.trim() });
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>Rename Page</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="pageTitle">Page Title</label>
            <input
              id="pageTitle"
              type="text"
              className="text-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Work, Ideas, D&D Campaign"
              autoFocus
            />
          </div>
          <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
