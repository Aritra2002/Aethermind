/**
 * @file ConnectionDiscovery.tsx
 * @description Proactive AI-powered connection discovery widget for AetherMind.
 * Analyzes note content in real time using local vector embeddings and AI reasoning to suggest
 * meaningful bidirectional or wikilink connections between related notes.
 * @module components/ConnectionDiscovery
 */

import React, { useState, useEffect, useRef } from 'react';
import { semanticSearch } from '../utils/vectorSearch';
import { callAI } from '../utils/aiClient';
import { db } from '../db';
import { Sparkles, X, Link as LinkIcon } from 'lucide-react';
import { updateNote } from '../db/helpers';
import { useToast } from './ToastContext';

/**
 * Props for the {@link ConnectionDiscovery} component.
 *
 * @interface ConnectionDiscoveryProps
 * @property {number} noteId - The primary key ID of the currently open note in the editor.
 * @property {string} content - The current markdown content of the note being edited.
 */
interface ConnectionDiscoveryProps {
  noteId: number;
  content: string;
}

/**
 * ConnectionDiscovery Component
 *
 * Runs debounced background semantic similarity searches and LLM connection evaluations
 * as the user writes notes. If an unlinked but contextually relevant note is discovered,
 * displays a non-intrusive suggestion pill with an AI-generated rationale and a 1-click "Add Link" button.
 *
 * @component
 * @param {ConnectionDiscoveryProps} props - Component properties.
 * @returns {React.ReactElement | null} The suggestion banner, discovering loader, or `null`.
 */
export const ConnectionDiscovery: React.FC<ConnectionDiscoveryProps> = ({ noteId, content }) => {
  /** Holds the active connection suggestion provided by AI analysis. */
  const [suggestion, setSuggestion] = useState<{ targetId: number; targetTitle: string; reason: string } | null>(null);

  /** Tracks whether the user has dismissed the current suggestion. */
  const [dismissed, setDismissed] = useState(false);

  /** Tracks whether an asynchronous discovery and AI prompt call is in progress. */
  const [isDiscovering, setIsDiscovering] = useState(false);

  /** Ref to the AbortController for cancelling in-flight AI requests on unmount or input change. */
  const abortRef = useRef<AbortController | null>(null);

  /** Toast notification trigger. */
  const { showToast } = useToast();

  /**
   * Reset suggestion and dismissal state whenever the active note changes.
   */
  useEffect(() => {
    // Reset state when noteId changes
    // eslint-disable-next-line
    setSuggestion(null);
    setDismissed(false);
  }, [noteId]);

  /**
   * Debounced semantic connection discovery loop:
   * 1. Performs local vector similarity search against the knowledge base embeddings.
   * 2. Filters out existing links, self-references, and explicit `[[WikiLink]]` mentions.
   * 3. Sends top candidates to the configured AI model to evaluate contextual relevance.
   * 4. Renders a connection recommendation if verified by the AI.
   */
  useEffect(() => {
    if (!content.trim() || dismissed || suggestion) return;

    let isMounted = true;
    
    const discover = async () => {
      setIsDiscovering(true);
      try {
        const currentNote = await db.notes.get(noteId);
        if (!currentNote) return;
        
        // Find top 3 semantically closest notes in the vector space
        const similar = await semanticSearch(content, 3);

        // Exclude notes that are already linked or explicitly referenced in markdown
        const candidates = similar.filter(n =>
          n.id !== noteId &&
          !(currentNote.linkedNoteIds || []).includes(n.id!) &&
          !(n.linkedNoteIds || []).includes(noteId) &&
          !(currentNote.content || '').includes(`[[${n.title}]]`) &&
          !(n.content || '').includes(`[[${currentNote.title}]]`)
        );
        
        if (candidates.length === 0) {
          return;
        }

        // Format candidates summary for the AI prompt
        const candidateTitles = candidates.map(c => `- ${c.title}: ${c.content.substring(0, 100)}...`).join('\n');
        
        const systemPrompt = `You are a knowledge graph assistant. The user has a note. Here are some potentially related notes:
${candidateTitles}

Does the user's note logically connect to any of these? If yes, pick the BEST match and explain why concisely (1-2 sentences).
Return ONLY JSON in this format:
{"connected": true, "targetTitle": "Note Title", "reason": "Explanation"}
If none connect, return {"connected": false}`;

        const userPrompt = `Current Note Content:\n${content.substring(0, 500)}`;
        
        // Abort previous in-flight AI call and initiate new request
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const aiResponse = await callAI(systemPrompt, userPrompt, undefined, abortRef.current.signal);
        if (!isMounted) return;
        
        try {
          // Clean possible markdown code fence wrappers from JSON output
          const jsonStr = aiResponse.replace(/```json\n?|```/g, '').trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed.connected && parsed.targetTitle) {
            const targetNote = candidates.find(c => c.title === parsed.targetTitle);
            if (targetNote && targetNote.id) {
              setSuggestion({
                targetId: targetNote.id,
                targetTitle: targetNote.title,
                reason: parsed.reason
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse AI connection response', e);
        }
      } catch (e) {
        console.error('Connection discovery error', e);
        showToast('Connection discovery failed', 'error');
      } finally {
        if (isMounted) setIsDiscovering(false);
      }
    };
    
    // 1-second debounce delay to prevent firing discovery while user is actively typing
    const timer = setTimeout(discover, 1000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [noteId, content, dismissed, suggestion, showToast]);

  // If no suggestion is currently ready, show discovering indicator or nothing
  if (!suggestion) {
    if (!isDiscovering) return null;
    return (
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--node-indigo)',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        zIndex: 'var(--z-modal, 1000)',
        width: '90%',
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--node-indigo)', fontWeight: 'bold' }}>
          <Sparkles size={16} className="spinning" /> Discovering connections...
        </div>
      </div>
    );
  }

  // Render the proactive suggestion card
  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--node-indigo)',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      zIndex: 'var(--z-modal, 1000)',
      width: '90%',
      maxWidth: '400px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      {/* Dismiss button */}
      <button 
        onClick={() => setDismissed(true)}
        style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
        aria-label="Dismiss suggestion"
      >
        <X size={16} />
      </button>

      {/* Header badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--node-indigo)', fontWeight: 'bold' }}>
        <Sparkles size={16} /> AI Discovery
      </div>

      {/* Suggestion text & reasoning */}
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
        This note might connect to <strong>{suggestion.targetTitle}</strong>.
      </p>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {suggestion.reason}
      </p>

      {/* Action button to create graph link */}
      <button 
        className="btn btn-primary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}
        onClick={async () => {
          const currentNote = await db.notes.get(noteId);
          if (currentNote) {
            const currentIds = currentNote.linkedNoteIds || [];
            if (!currentIds.includes(suggestion.targetId)) {
              await updateNote(noteId, { linkedNoteIds: [...currentIds, suggestion.targetId] });
            }
          }
          setDismissed(true);
        }}
      >
        <LinkIcon size={14} /> Add Link
      </button>
    </div>
  );
};

