/**
 * ============================================================================
 * DiscoveryDigestModal.tsx — Serendipitous Cross-Time Connection Synthesis
 * ============================================================================
 * 
 * Architectural Purpose:
 * Promotes serendipitous learning and insight generation by comparing historical thoughts
 * with recent notes. Automatically samples an older note (>30 days old) and a recent
 * note (<7 days old), then prompts the configured LLM to synthesize a non-obvious,
 * creative conceptual bridge between them.
 * 
 * Key Features:
 * - Temporal Stratification: Partitions note collections into historical and recent cohorts.
 * - Autonomous Prompting: Generates comparative prompts without requiring user input.
 * - Streaming Synthesis: Progressively displays connection insights with Markdown formatting.
 * - Error Handling & Edge Cases: Gracefully informs users when note volume is insufficient.
 * - Request Lifecycle Management: Uses AbortController to cleanly cancel in-flight API requests.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { Note } from '../db';
import { callAI } from '../utils/aiClient';
import { safeRenderMarkdown } from '../utils/sanitizer';
import { Sparkles, Square } from 'lucide-react';

/**
 * Props for the DiscoveryDigestModal component.
 */
interface DiscoveryDigestModalProps {
  /** Controls whether the digest modal is open and visible */
  isOpen: boolean;
  /** Callback fired to close the modal dialog */
  onClose: () => void;
  /** Collection of notes available for cross-time conceptual matching */
  notes: Note[];
}

/**
 * DiscoveryDigestModal Component
 * 
 * Renders the Daily Discovery Digest modal dialog, generating serendipitous
 * connections between historical and recent notes.
 * 
 * @param {DiscoveryDigestModalProps} props - Component properties.
 * @returns {React.ReactElement | null} The rendered modal or null when closed.
 */
export const DiscoveryDigestModal: React.FC<DiscoveryDigestModalProps> = ({ isOpen, onClose, notes }) => {
  /** The generated connection digest text in Markdown */
  const [digest, setDigest] = useState<string | null>(null);

  /** Loading flag active during AI connection generation */
  const [isLoading, setIsLoading] = useState(false);

  /** Error message displayed if note volume is insufficient or API fails */
  const [error, setError] = useState('');

  /** Controller to abort streaming requests if modal closes or unmounts */
  const abortRef = useRef<AbortController | null>(null);

  // Abort any pending network requests when component unmounts
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Reset state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDigest(null);
      setError('');
    }
  }, [isOpen]);

  // Trigger automated serendipity generation upon opening
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setDigest(null);
      setError('');

      const now = Date.now();
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      // Temporal stratification: partition notes into historical and recent buckets
      const oldNotes = notes.filter(n => n.createdAt < oneMonthAgo);
      const recentNotes = notes.filter(n => n.createdAt > sevenDaysAgo);

      // Verify that both time horizons have candidate notes
      if (oldNotes.length === 0 || recentNotes.length === 0) {
        if (!cancelled) {
          setError('Not enough notes for a digest. Keep writing!');
          setIsLoading(false);
        }
        return;
      }

      // Randomly sample one candidate from each time bucket
      const randomOld = oldNotes[Math.floor(Math.random() * oldNotes.length)];
      const randomRecent = recentNotes[Math.floor(Math.random() * recentNotes.length)];

      const systemPrompt = `You are an AI assistant helping discover surprising connections in a personal knowledge graph.`;
      const userPrompt = `Given these two notes, find a surprising connection between them.\n\nNote 1 (Old):\nTitle: ${randomOld.title}\nContent: ${randomOld.content}\n\nNote 2 (Recent):\nTitle: ${randomRecent.title}\nContent: ${randomRecent.content}\n\nProvide a short, insightful connection.`;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        await callAI(systemPrompt, userPrompt, (text) => {
          if (!cancelled) setDigest(text);
        }, abortRef.current.signal);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error generating digest');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, notes]);

  if (!isOpen) return null;

  return (
    <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ width: 'min(94vw, 640px)', maxWidth: '96vw', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-content glass-panel border-0" style={{ maxHeight: 'min(88dvh, 760px)' }}>
          {/* Modal Header */}
          <div className="modal-header border-0">
            <div className="d-flex align-items-center gap-2" style={{ color: 'var(--accent-gold)' }}>
              <Sparkles size={18} />
              <h5 className="modal-title">Daily Discovery Digest</h5>
            </div>
            <div className="d-flex align-items-center gap-2">
              {isLoading && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger d-flex align-items-center gap-1"
                  onClick={() => {
                    abortRef.current?.abort();
                    setIsLoading(false);
                  }}
                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                >
                  <Square size={11} fill="currentColor" /> Stop
                </button>
              )}
              <button type="button" className="btn-close btn-close-overlay" onClick={onClose} aria-label="Close" />
            </div>
          </div>

          {/* Modal Body */}
          <div className="modal-body">
            {error && <div style={{ color: '#ef4444' }}>{error}</div>}
            {isLoading && !digest && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--card-nested-bg)', borderRadius: '6px' }}>
                <div className="spin-pulse" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Finding a surprising connection...
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    abortRef.current?.abort();
                    setIsLoading(false);
                  }}
                  style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                >
                  <Square size={11} fill="currentColor" /> Stop
                </button>
              </div>
            )}
            {digest && (
              <div 
                className="markdown-body" 
                dangerouslySetInnerHTML={{ __html: safeRenderMarkdown(digest) }} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};