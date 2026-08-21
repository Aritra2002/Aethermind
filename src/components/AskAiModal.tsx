/**
 * ============================================================================
 * AskAiModal.tsx — Intelligent Assistant, RAG Querying & Action Execution
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides an interactive AI dialog interface capable of:
 * - Conversational question answering using general model intelligence.
 * - Semantic Retrieval-Augmented Generation (RAG) over local user notes and documents
 *   when queried about personal knowledge data.
 * - Web content fetching and automated synthesis via URL extraction.
 * - Structured action dispatching (note creation, editing, deletion, link synthesis)
 *   with preflight validation and human-in-the-loop staging confirmations.
 * 
 * Key Features:
 * - Live streaming response parsing with Markdown rendering and DOMPurify sanitization.
 * - URL detection and automated content scraping via `fetchUrlContent`.
 * - Intent-based RAG triggering using regex pattern heuristics and vector similarity.
 * - Multi-stage action pipeline: direct execution for non-destructive link mutations
 *   and visual staging cards with `ConfirmActionToast` for node mutations.
 * - Keyboard shortcuts (Enter to submit, Escape to dismiss) and focus trapping.
 */

import React, { useState, useEffect, useRef } from 'react';

import { callAI } from '../utils/aiClient';
import { searchHybridRag, buildRagContextWithCitations, type RagCitation } from '../utils/rag';
import { safeRenderMarkdown } from '../utils/sanitizer';
import { Sparkles, ArrowRight, Layers, FileText as FileIcon, Globe, BookOpen, Check, X as XIcon, AlertTriangle, ShieldAlert, Square } from 'lucide-react';
import { parseAiResponse, executeAiAction, validateActionPreflight, generateActionDiff, type AiAction, type ActionDiff } from '../utils/aiActions';
import { fetchUrlContent } from '../utils/urlFetcher';
import { useToast } from './ToastContext';
import { db } from '../db';

/**
 * Props for the AskAiModal component.
 */
interface AskAiModalProps {
  /** Flag controlling the visibility of the modal dialog */
  isOpen: boolean;
  /** Callback fired when closing or dismissing the modal */
  onClose: () => void;
  /** Primary key ID of the active page/workspace context for created/edited notes */
  activePageId: number;
  /** Optional navigation callback to jump directly to a note by title */
  onJumpToNote?: (title: string) => void;
}

/**
 * Visual diff preview card displaying proposed changes before execution.
 */
const ActionDiffCard: React.FC<{
  action: AiAction;
  diff: ActionDiff;
  onApply: () => void;
  onReject: () => void;
}> = ({ action, diff, onApply, onReject }) => {
  return (
    <div style={{
      background: 'var(--card-nested-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      marginTop: '12px',
      fontSize: '0.85rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            background: diff.riskLevel === 'DESTRUCTIVE' 
              ? 'rgba(239, 68, 68, 0.25)' 
              : diff.riskLevel === 'HIGH_RISK_WRITE'
              ? 'rgba(245, 158, 11, 0.25)'
              : 'rgba(139, 92, 246, 0.2)',
            color: diff.riskLevel === 'DESTRUCTIVE'
              ? 'var(--accent-danger, #ef4444)'
              : diff.riskLevel === 'HIGH_RISK_WRITE'
              ? 'var(--accent-gold, #f59e0b)'
              : 'var(--accent-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            {diff.riskLevel === 'DESTRUCTIVE' && <ShieldAlert size={11} />}
            {diff.riskLevel === 'HIGH_RISK_WRITE' && <AlertTriangle size={11} />}
            {action.action.replace('_', ' ')}
          </span>
          <span>{diff.targetTitle}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            className="btn btn-sm btn-primary"
            onClick={onApply}
            style={{ padding: '3px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Check size={13} /> Apply
          </button>
          <button 
            className="btn btn-sm btn-secondary"
            onClick={onReject}
            style={{ padding: '3px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <XIcon size={13} /> Skip
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)' }}>
        {diff.changes.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
            <span style={{ color: c.type === 'remove' ? 'var(--accent-danger, #ef4444)' : 'var(--node-emerald, #10b981)' }}>
              {c.type === 'remove' ? '−' : '+'}
            </span>
            <span>{c.to || c.from}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * AskAiModal Component
 * 
 * Main modal dialog handling user queries, AI streaming interactions,
 * contextual knowledge retrieval, and tool action staging.
 */
export const AskAiModal: React.FC<AskAiModalProps> = ({ isOpen, onClose, activePageId, onJumpToNote }) => {
  /** User text input in the search field */
  const [query, setQuery] = useState('');

  /** Active knowledge search scope */
  const [scope, setScope] = useState<'auto' | 'vault' | 'documents' | 'general'>('auto');

  /** Streaming or final response text received from the AI model */
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  /** Retrieved citations used in this response */
  const [citations, setCitations] = useState<RagCitation[]>([]);

  /** Loading indicator flag while awaiting AI streaming responses */
  const [isAiLoading, setIsAiLoading] = useState(false);

  /** Queue of pending AI actions with calculated diffs */
  const [stagedActionDiffs, setStagedActionDiffs] = useState<Array<{ action: AiAction; diff: ActionDiff }>>([]);

  /** Execution log of completed or rejected actions */
  const [actionResults, setActionResults] = useState<{ action: AiAction; success: boolean; message: string }[]>([]);

  /** DOM reference to the search input field for auto-focusing */
  const inputRef = useRef<HTMLInputElement>(null);

  /** Controller reference to abort in-flight streaming fetch requests */
  const abortRef = useRef<AbortController | null>(null);

  const { showToast } = useToast();
  const pageId = activePageId;

  // Abort any pending network requests when the component unmounts
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Reset dialog state and auto-focus the text input whenever the modal is opened
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setAiResponse(null);
      setCitations([]);
      setIsAiLoading(false);
      setStagedActionDiffs([]);
      setActionResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  /**
   * Processes the user query, conditionally retrieves personal note/document context,
   * performs URL fetching if a link is detected, streams the AI completion,
   * and parses structured JSON action blocks.
   */
  const handleAskAi = async () => {
    if (!query.trim()) return;
    
    try {
      setIsAiLoading(true);
      setAiResponse('');
      setCitations([]);
      setActionResults([]);
      setStagedActionDiffs([]);
      
      let finalQuery = query;
      let contextPrefix = "";

      // Step 1: Detect URLs in query and fetch remote content if present
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
        } catch (e: unknown) {
          showToast(e instanceof Error ? e.message : 'Error fetching URL', 'error');
          setIsAiLoading(false);
          return;
        }
      }

      finalQuery = contextPrefix ? contextPrefix + query : query;
      
      // Step 2: Determine if user is querying personal graph data vs general knowledge
      const asksAboutOwnData = scope === 'vault' || scope === 'documents' || (
        scope === 'auto' && (
          /(?:my|the|from|in|across|among)\s+(?:notes?|documents?|files?|data|knowledge|graph|nodes?|content|uploaded)/i.test(query)
          || /what\s+(?:do\s+)?(?:I|we)\s+have\s+(?:on|about|regarding)/i.test(query)
          || /(?:according|based)\s+to\s+(?:my|the)/i.test(query)
          || /(?:search|find|look)\s+(?:in|through|my)\s+(?:notes?|documents?|files?|data)/i.test(query)
        )
      );

      let ragContext = '';
      let retrievedCitations: RagCitation[] = [];

      // Step 3: Run semantic RAG vector search across notes and documents if requested
      if (asksAboutOwnData) {
        const typeFilter = scope === 'documents' ? 'documents' : scope === 'vault' ? 'notes' : 'all';
        retrievedCitations = await searchHybridRag(query, 5, typeFilter);
        setCitations(retrievedCitations);
        ragContext = buildRagContextWithCitations(retrievedCitations);
      }

      // Step 4: Assemble system prompt with formatting rules and action schemas
      const systemPrompt = `You are an AI assistant integrated into a personal knowledge graph app.

BEHAVIOR RULES:
1. **Default mode — answer freely from your knowledge.** You are a powerful AI. Answer any question using your full knowledge base. Do NOT restrict yourself to the user's notes or documents unless they explicitly ask.
2. **When user explicitly asks about their data** ("my notes", "from my documents", "what do I have on X", "search my files"): Use the retrieved context provided below to answer. If no relevant context is found, say so.
3. **When user asks to CREATE notes**: Use your full knowledge to generate rich, detailed content freely.
4. **When given web content**: Summarize it into a detailed, well-formatted note.

CRITICAL: The retrieved context (notes/documents) is ONLY provided when the user explicitly asks about their own data. When no context is provided, answer from your general knowledge — do not say "I don't have that information" just because no context was given.

CRITICAL RULES FOR NOTE CONTENT:
- NEVER write "Related Notes", "## Related", "## Connections", "## See Also", or similar footer sections inside note content.
- NEVER append a list of connections/links at the end of a note body.
- To connect notes to each other, use the "linkTo" field in create_note, or use a separate create_link action.
- Use [[Node Title]] ONLY for inline contextual references within prose, not as a footer list.
- Every connection declared must correspond to a note that exists or is being created in the same response.

When writing or editing notes, aggressively use rich Markdown formatting:
- **bold**, *italic*, ~~strikethrough~~ for emphasis
- #, ##, ### for hierarchical headings
- Bulleted lists (-) and numbered lists (1.)
- Task lists (- [ ]) for action items
- \`inline code\` and \`\`\`language code blocks\`\`\` for code
- > Blockquotes for callouts
- [Link Text](https://...) for external links
- [[Node Title]] only for inline contextual references within prose

When you need to perform an action, include a JSON block:

\`\`\`json
[
  { "action": "create_note", "title": "...", "content": "...", "tags": [], "linkTo": ["existing note title if relevant"] }
]
\`\`\`

Available actions: create_note, edit_note, delete_note, create_link, delete_link.
For edit_note include "newContent" or "newTitle". For delete actions include "reason".
Always follow the JSON block with a human-readable explanation.
Only perform actions the user explicitly requested.`;
      
      const contextParts: string[] = [];
      if (ragContext) contextParts.push(`<retrieved_knowledge>\n${ragContext}\n</retrieved_knowledge>`);

      const userPrompt = contextParts.length > 0
        ? `${contextParts.join('\n\n')}\n\nUser request: ${finalQuery}`
        : `User request: ${finalQuery}`;
      
      let fullResponse = "";
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Step 5: Stream AI response
      await callAI(systemPrompt, userPrompt, (text) => {
        fullResponse = text;
        setAiResponse(text);
      }, abortRef.current.signal);

      // Step 6: Parse structured JSON action blocks and route to staging or direct execution
      const parsed = parseAiResponse(fullResponse);
      if (parsed && parsed.actions.length > 0) {
        setAiResponse(parsed.explanation || "Action proposed:");
        
        const results: { action: AiAction; success: boolean; message: string }[] = [];
        const staged: AiAction[] = [];

        for (const action of parsed.actions) {
          // Link modifications execute directly without disruptive staging prompts
          if (action.action === 'create_link' || action.action === 'delete_link') {
            const result = await executeAiAction(action, pageId);
            results.push({ action, success: result.success, message: result.message });
          } else {
            // Note modifications undergo preflight validation and stage for user confirmation
            const preflight = await validateActionPreflight(action, pageId);
            if (preflight.blocked) {
              showToast(preflight.message || 'Action blocked', 'error');
            } else {
              staged.push(action);
            }
          }
        }

        const diffs: Array<{ action: AiAction; diff: ActionDiff }> = [];
        for (const action of staged) {
          let existingNote = null;
          if ('title' in action) {
            existingNote = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
          }
          const diff = generateActionDiff(action, existingNote);
          diffs.push({ action, diff });
        }

        setActionResults(results);
        setStagedActionDiffs(diffs);
      }
      
    } catch (e: unknown) {
      setAiResponse(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  /**
   * Applies a staged action diff.
   */
  const handleApplyStagedDiff = async (index: number) => {
    const item = stagedActionDiffs[index];
    if (!item) return;

    setStagedActionDiffs(prev => prev.filter((_, i) => i !== index));
    const result = await executeAiAction(item.action, pageId);
    setActionResults(prev => [...prev, { action: item.action, success: result.success, message: result.message }]);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  /**
   * Rejects/skips a staged action diff.
   */
  const handleRejectStagedDiff = (index: number) => {
    setStagedActionDiffs(prev => prev.filter((_, i) => i !== index));
    showToast('Action skipped', 'info');
  };

  /**
   * Immediately aborts in-flight AI generation and resets loading state.
   */
  const handleStopAi = () => {
    abortRef.current?.abort();
    setIsAiLoading(false);
    showToast('AI response stopped', 'info');
  };

  /**
   * Handles keyboard events for modal dismissal and form submission.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isAiLoading) {
        handleStopAi();
      } else {
        onClose();
      }
    } else if (e.key === 'Enter' && !isAiLoading && aiResponse === null) {
      e.preventDefault();
      handleAskAi();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ width: 'min(94vw, 680px)', maxWidth: '96vw', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-content glass-panel border-0" style={{ maxHeight: 'min(88dvh, 760px)' }}>
          {/* Modal Header */}
          <div className="modal-header border-0 pb-1">
            <div className="d-flex align-items-center gap-2" style={{ color: 'var(--accent-gold)' }}>
              <Sparkles size={18} />
              <h5 className="modal-title">Ask AI Copilot</h5>
            </div>
            <div className="d-flex align-items-center gap-2">
              {isAiLoading && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleStopAi}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                >
                  <Square size={11} fill="currentColor" /> Stop
                </button>
              )}
              <button type="button" className="btn-close btn-close-overlay" onClick={onClose} aria-label="Close" />
            </div>
          </div>

          {/* Modal Body */}
          <div className="modal-body pt-1">
            {aiResponse !== null ? (
              /* AI Output View: Rendered Markdown + Action History + Citations */
              <div className="ai-response-container" style={{ color: 'var(--text-primary)' }}>
                {isAiLoading && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--card-nested-bg)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div className="spin-pulse" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {aiResponse ? 'Streaming AI response...' : 'Analyzing knowledge graph & formulating response...'}
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-danger"
                      onClick={handleStopAi}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '0.78rem' }}
                    >
                      <Square size={12} fill="currentColor" /> Stop
                    </button>
                  </div>
                )}
                <div 
                  className="markdown-body" 
                  dangerouslySetInnerHTML={{ __html: safeRenderMarkdown(aiResponse) }} 
                />

                {/* Staged Action Diff Cards (Before vs After) */}
                {stagedActionDiffs.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Proposed Graph Mutations ({stagedActionDiffs.length})
                    </div>
                    {stagedActionDiffs.map((item, idx) => (
                      <ActionDiffCard
                        key={idx}
                        action={item.action}
                        diff={item.diff}
                        onApply={() => handleApplyStagedDiff(idx)}
                        onReject={() => handleRejectStagedDiff(idx)}
                      />
                    ))}
                  </div>
                )}
                
                {/* Action Execution Outcome Badges */}
                {actionResults.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    {actionResults.map((res, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderRadius: '6px', background: res.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: res.success ? 'var(--node-emerald)' : 'var(--accent-danger)', fontSize: '0.85rem', marginTop: '6px' }}>
                        {res.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Structured RAG Citations */}
                {citations.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={13} /> Cited Evidence Sources ({citations.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {citations.map((c) => (
                        <div 
                          key={c.index}
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '8px',
                            padding: '6px 10px',
                            background: 'var(--card-nested-bg)',
                            borderRadius: '6px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>[{c.index}]</span>
                          <span 
                            style={{ 
                              fontWeight: 600, 
                              color: c.isNote ? 'var(--accent-secondary)' : 'var(--text-primary)',
                              cursor: c.isNote && onJumpToNote ? 'pointer' : 'default',
                              textDecoration: c.isNote && onJumpToNote ? 'underline' : 'none'
                            }}
                            onClick={() => {
                              if (c.isNote && onJumpToNote) {
                                onJumpToNote(c.sourceName.replace(/^\[Note\]\s*/, ''));
                                onClose();
                              }
                            }}
                          >
                            {c.sourceName}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                            {(c.score * 100).toFixed(0)}% match
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Reset to query prompt */}
                {!isAiLoading && (
                  <button 
                    className="btn btn-secondary mt-3" 
                    onClick={() => {
                      setAiResponse(null);
                      setQuery('');
                      setCitations([]);
                      setActionResults([]);
                      setStagedActionDiffs([]);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  >
                    Ask Another Question
                  </button>
                )}
              </div>
            ) : (
              /* Initial Query Input View */
              <div className="d-flex flex-column gap-3">
                {/* Knowledge Scope Target Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'auto' as const, label: '✨ Auto Scope', icon: <Sparkles size={12} /> },
                    { id: 'vault' as const, label: '🧠 Notes & Vault', icon: <Layers size={12} /> },
                    { id: 'documents' as const, label: '📄 Documents (RAG)', icon: <FileIcon size={12} /> },
                    { id: 'general' as const, label: '🌐 General / Web', icon: <Globe size={12} /> }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      className="tab-btn"
                      onClick={() => setScope(tab.id)}
                      style={{
                        padding: '3px 10px',
                        fontSize: '0.75rem',
                        borderRadius: 'var(--radius-pill)',
                        background: scope === tab.id ? 'var(--accent-primary)' : 'var(--surface-pill-bg)',
                        color: scope === tab.id ? '#ffffff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.4, margin: 0 }}>
                  Ask questions, research topics, synthesize web articles, or command AI to create and interconnect knowledge nodes.
                </p>
                
                <div className="d-flex gap-2 align-items-center">
                  <div className="search-bar-container flex-grow-1" style={{ padding: '8px 12px' }}>
                    <input
                      ref={inputRef}
                      type="text"
                      className="search-input"
                      placeholder="What do you want to explore, research, or create?"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      style={{ fontSize: '0.95rem' }}
                    />
                  </div>
                  <button 
                    className="btn btn-primary d-flex align-items-center justify-content-center flex-shrink-0"
                    onClick={handleAskAi}
                    disabled={!query.trim() || isAiLoading}
                    style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)' }}
                    title="Send query"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};