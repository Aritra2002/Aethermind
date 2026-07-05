import React, { useState, useEffect, useRef } from 'react';
import type { Note } from '../db';
import { callAI } from '../utils/aiClient';
import { semanticSearch } from '../utils/vectorSearch';
import { marked } from 'marked';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { parseAiResponse, executeAiAction, validateActionPreflight, AiAction } from '../utils/aiActions';
import { fetchUrlContent } from '../utils/urlFetcher';
import { ConfirmActionToast } from './ConfirmActionToast';
import { useToast } from './ToastContext';

interface AskAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
}

const AiActionCard = ({ result }: { result: { action: AiAction; success: boolean; message: string } }) => {
  if (!result.success) return <div style={{ color: '#ef4444', marginTop: '12px' }}>Action failed: {result.message}</div>;
  
  if (result.action.action === 'create_note') {
    return (
      <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid var(--accent-primary)', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
        <div>📄 Created note: <strong>"{result.action.title}"</strong></div>
        {result.action.tags && result.action.tags.length > 0 && (
          <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '4px' }}>Tags: {result.action.tags.join(', ')}</div>
        )}
        {result.action.linkTo && result.action.linkTo.length > 0 && (
          <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '4px' }}>Linked to: {result.action.linkTo.join(', ')}</div>
        )}
      </div>
    );
  }
  return (
    <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid var(--accent-primary)', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
      ✅ {result.message}
    </div>
  );
};

export const AskAiModal: React.FC<AskAiModalProps> = ({ isOpen, onClose, notes }) => {
  const [query, setQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [stagedAction, setStagedAction] = useState<AiAction | null>(null);
  const [actionResult, setActionResult] = useState<{ action: AiAction; success: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const pageId = notes[0]?.pageId || 1;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setAiResponse(null);
      setIsAiLoading(false);
      setStagedAction(null);
      setActionResult(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleAskAi = async () => {
    if (!query.trim()) return;
    
    try {
      setIsAiLoading(true);
      setAiResponse('');
      setActionResult(null);
      setStagedAction(null);
      
      let finalQuery = query;
      let contextPrefix = "";

      // Phase 9: Research Mode URL detection
      const urlMatch = query.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        const url = urlMatch[0];
        try {
          const fetched = await fetchUrlContent(url);
          if (fetched) {
            contextPrefix = `[Content from URL]\n\n---\n\n${fetched.text}\n\n---\nUser message: `;
          } else {
            setAiResponse("I can't fetch that URL directly due to browser security restrictions. Paste the text or abstract here and I'll create the note.");
            setIsAiLoading(false);
            return;
          }
        } catch (e: any) {
          showToast(e.message, 'error');
          setIsAiLoading(false);
          return;
        }
      }

      finalQuery = contextPrefix ? contextPrefix + query : query;
      
      // Perform Local RAG: Find top 5 relevant notes based on the user's query
      const relevantNotes = await semanticSearch(query, 5);
      
      const systemPrompt = `You are an AI assistant analyzing a personal knowledge graph. You will be provided with the most relevant notes retrieved via semantic search. Use ONLY the provided notes to answer the user's question. If the answer is not in the notes, say so. Keep your answer concise.

You can create, edit, and delete notes in the knowledge graph. When you need to
perform an action, include a JSON block in your response using this format:

\`\`\`json
{ "action": "create_note", "title": "...", "content": "...", "tags": [], "linkTo": ["existing note title"] }
\`\`\`

Available actions: create_note, edit_note, delete_note, create_link, delete_link.
For edit_note include "newContent" or "newTitle". For delete actions include "reason".
Always follow the JSON block with a human-readable explanation of what you did.
Only perform actions the user explicitly requested.

When given web content, summarize it into a concise note. Extract the key ideas,
methodology, and conclusions. Use the page title as the note title unless the user
specifies otherwise. Suggest 2-3 connections to existing notes if relevant.`;
      
      const notesContext = relevantNotes.length > 0 
        ? relevantNotes.map(n => `Title: ${n.title}\nContent: ${n.content}`).join('\n\n---\n\n')
        : "No highly relevant notes found for this query in the local graph.";

      const userPrompt = `Retrieved Notes:\n<cache>\n${notesContext}\n</cache>\n\nQuestion: ${finalQuery}`;
      
      let fullResponse = "";
      await callAI(systemPrompt, userPrompt, (text) => {
        fullResponse = text;
        setAiResponse(text);
      });

      // Phase 8: AI Co-Author action parsing
      const parsed = parseAiResponse(fullResponse);
      if (parsed) {
        setAiResponse(parsed.explanation || "Action proposed:");
        const action = parsed.actions[0];
        
        if (action.action === 'create_note' || action.action === 'create_link' || action.action === 'delete_link') {
          const result = await executeAiAction(action, pageId);
          setActionResult({ action, success: result.success, message: result.message });
        } else {
          const preflight = await validateActionPreflight(action, pageId);
          if (preflight.blocked) {
            showToast(preflight.message || 'Action blocked', 'error');
          } else {
            setStagedAction(action);
          }
        }
      }
      
    } catch (e: any) {
      setAiResponse(`Error: ${e.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleConfirmStaged = async () => {
    if (!stagedAction) return;
    const action = stagedAction;
    setStagedAction(null);
    const result = await executeAiAction(action, pageId);
    setActionResult({ action, success: result.success, message: result.message });
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !isAiLoading && aiResponse === null) {
      e.preventDefault();
      handleAskAi();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 'var(--z-modal, 1000)' }}>
        <div className="settings-modal glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)' }}>
              <Sparkles size={18} />
              <h2>Ask AI</h2>
            </div>
            <button className="btn btn-icon close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="modal-content" style={{ padding: '20px' }}>
            {aiResponse !== null ? (
              <div className="ai-response-container" style={{ color: 'var(--text-primary)', maxHeight: '400px', overflowY: 'auto' }}>
                {isAiLoading && !aiResponse && <div className="spin-pulse" style={{ color: 'var(--text-secondary)' }}>Analyzing your knowledge graph...</div>}
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(aiResponse) as string }} />
                
                {actionResult && <AiActionCard result={actionResult} />}
                
                {!isAiLoading && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setAiResponse(null);
                      setQuery('');
                      setActionResult(null);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    style={{ marginTop: '20px' }}
                  >
                    Ask Another Question
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Ask a question, paste a link to research it, or ask me to create/edit notes.
                </p>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="What do you want to know?"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '1rem',
                      outline: 'none'
                    }}
                  />
                  <button 
                    className="btn btn-primary btn-icon" 
                    onClick={handleAskAi}
                    disabled={!query.trim() || isAiLoading}
                    style={{ width: '48px', height: '48px' }}
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {stagedAction && (
        <ConfirmActionToast 
          action={stagedAction} 
          pageId={pageId}
          onConfirm={handleConfirmStaged} 
          onCancel={() => setStagedAction(null)} 
        />
      )}
    </>
  );
};
