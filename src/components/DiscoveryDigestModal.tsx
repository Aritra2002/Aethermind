import React, { useState, useEffect } from 'react';
import type { Note } from '../db';
import { callAI } from '../utils/aiClient';
import { marked } from 'marked';
import { Sparkles, X } from 'lucide-react';

interface DiscoveryDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
}

export const DiscoveryDigestModal: React.FC<DiscoveryDigestModalProps> = ({ isOpen, onClose, notes }) => {
  const [digest, setDigest] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const generateDigest = async () => {
    try {
      setIsLoading(true);
      setDigest(null);
      setError('');
      
      const now = Date.now();
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      
      const oldNotes = notes.filter(n => n.createdAt < oneMonthAgo);
      const recentNotes = notes.filter(n => n.createdAt > sevenDaysAgo);
      
      if (oldNotes.length === 0 || recentNotes.length === 0) {
        setError('Not enough notes for a digest. Keep writing!');
        setIsLoading(false);
        return;
      }
      
      const randomOld = oldNotes[Math.floor(Math.random() * oldNotes.length)];
      const randomRecent = recentNotes[Math.floor(Math.random() * recentNotes.length)];
      
      const systemPrompt = `You are an AI assistant helping discover surprising connections in a personal knowledge graph.`;
      const userPrompt = `Given these two notes, find a surprising connection between them.\n\nNote 1 (Old):\nTitle: ${randomOld.title}\nContent: ${randomOld.content}\n\nNote 2 (Recent):\nTitle: ${randomRecent.title}\nContent: ${randomRecent.content}\n\nProvide a short, insightful connection.`;
      
      await callAI(systemPrompt, userPrompt, (text) => {
        setDigest(text);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating digest');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !digest && !isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      generateDigest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);


  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 'var(--z-modal, 1000)' }}>
      <div className="settings-modal glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)' }}>
            <Sparkles size={18} />
            <h2>Daily Discovery Digest</h2>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-content" style={{ padding: '20px' }}>
          {error && <div style={{ color: '#ef4444' }}>{error}</div>}
          {isLoading && !digest && <div className="spin-pulse" style={{ color: 'var(--text-secondary)' }}>Finding a surprising connection...</div>}
          {digest && (
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(digest) as string }} />
          )}
        </div>
      </div>
    </div>
  );
};
