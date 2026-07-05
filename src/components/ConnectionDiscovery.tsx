import React, { useState, useEffect } from 'react';
import { semanticSearch } from '../utils/vectorSearch';
import { callAI } from '../utils/aiClient';
import { db } from '../db';
import { Sparkles, X, Link as LinkIcon } from 'lucide-react';
import { updateNote } from '../db/helpers';

interface ConnectionDiscoveryProps {
  noteId: number;
  content: string;
}

export const ConnectionDiscovery: React.FC<ConnectionDiscoveryProps> = ({ noteId, content }) => {
  const [suggestion, setSuggestion] = useState<{ targetId: number; targetTitle: string; reason: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Reset state when noteId changes
      // eslint-disable-next-line
    setSuggestion(null);
      // eslint-disable-next-line
    setDismissed(false);
  }, [noteId]);

  useEffect(() => {
    if (!content.trim() || dismissed || suggestion) return;

    let isMounted = true;
    
    const discover = async () => {
      try {
        const currentNote = await db.notes.get(noteId);
        if (!currentNote) return;
        
        const similar = await semanticSearch(content, 3);
        const candidates = similar.filter(n => n.id !== noteId && !(currentNote.linkedNoteIds || []).includes(n.id!));
        
        if (candidates.length === 0) {
          return;
        }

        const candidateTitles = candidates.map(c => `- ${c.title}: ${c.content.substring(0, 100)}...`).join('\n');
        
        const systemPrompt = `You are a knowledge graph assistant. The user has a note. Here are some potentially related notes:
${candidateTitles}

Does the user's note logically connect to any of these? If yes, pick the BEST match and explain why concisely (1-2 sentences).
Return ONLY JSON in this format:
{"connected": true, "targetTitle": "Note Title", "reason": "Explanation"}
If none connect, return {"connected": false}`;

        const userPrompt = `Current Note Content:\n${content.substring(0, 500)}`;
        
        const aiResponse = await callAI(systemPrompt, userPrompt);
        if (!isMounted) return;
        
        try {
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
      }
    };
    
    const timer = setTimeout(discover, 1000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [noteId, content, dismissed, suggestion]);

  if (dismissed || !suggestion) return null;

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
      <button 
        onClick={() => setDismissed(true)}
        style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
      >
        <X size={16} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--node-indigo)', fontWeight: 'bold' }}>
        <Sparkles size={16} /> AI Discovery
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
        This note might connect to <strong>{suggestion.targetTitle}</strong>.
      </p>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {suggestion.reason}
      </p>
      <button 
        className="primary-btn"
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
