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
import { semanticSearch } from '../utils/vectorSearch';
import { searchDocuments, buildRagContext } from '../utils/rag';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Sparkles, ArrowRight } from 'lucide-react';
import { parseAiResponse, executeAiAction, validateActionPreflight, AiAction } from '../utils/aiActions';
import { fetchUrlContent } from '../utils/urlFetcher';
import { ConfirmActionToast } from './ConfirmActionToast';
import { useToast } from './ToastContext';

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
}

/**
 * AiActionCard Component
 * 
 * Renders a visual status card summarizing the outcome of an executed AI action
 * (e.g. note creation details with tags and links, or error status).
 * 
 * @param {object} props - Component properties.
 * @param {object} props.result - The action outcome containing the action payload, success flag, and message.
 * @returns {React.ReactElement} Visual card displaying action details.
 */
const AiActionCard = ({ result }: { result: { action: AiAction; success: boolean; message: string } }) => {
  if (!result.success) {
    return (
      <div style={{ color: 'var(--accent-danger, #ef4444)', marginTop: '12px' }}>
        Action failed: {result.message}
      </div>
    );
  }
  
  if (result.action.action === 'create_note') {
    return (
      <div style={{ background: 'var(--card-nested-bg)', border: '1px solid var(--accent-primary)', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
        <div>Created note: <strong>"{result.action.title}"</strong></div>
        {result.action.tags && result.action.tags.length > 0 && (
          <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Tags: {result.action.tags.join(', ')}
          </div>
        )}
        {result.action.linkTo && result.action.linkTo.length > 0 && (
          <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Linked to: {result.action.linkTo.join(', ')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--card-nested-bg)', border: '1px solid var(--accent-primary)', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
      {result.message}
    </div>
  );
};

/**
 * AskAiModal Component
 * 
 * Main modal dialog handling user queries, AI streaming interactions,
 * contextual knowledge retrieval, and tool action staging.
 * 
 * @param {AskAiModalProps} props - Component properties.
 * @returns {React.ReactElement | null} Rendered modal dialog or null if closed.
 */
export const AskAiModal: React.FC<AskAiModalProps> = ({ isOpen, onClose, activePageId }) => {
  /** User text input in the search field */
  const [query, setQuery] = useState('');

  /** Streaming or final response text received from the AI model */
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  /** Loading indicator flag while awaiting AI streaming responses */
  const [isAiLoading, setIsAiLoading] = useState(false);

  /** Queue of pending AI actions requiring user confirmation */
  const [stagedActions, setStagedActions] = useState<AiAction[]>([]);

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
      setIsAiLoading(false);
      setStagedActions([]);
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
      setActionResults([]);
      setStagedActions([]);
      
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
      const asksAboutOwnData = /(?:my|the|from|in|across|among)\s+(?:notes?|documents?|files?|data|knowledge|graph|nodes?|content|uploaded)/i.test(query)
        || /what\s+(?:do\s+)?(?:I|we)\s+have\s+(?:on|about|regarding)/i.test(query)
        || /(?:according|based)\s+to\s+(?:my|the)/i.test(query)
        || /(?:search|find|look)\s+(?:in|through|my)\s+(?:notes?|documents?|files?|data)/i.test(query);

      let ragContext = '';
      let notesContext = '';

      // Step 3: Run semantic RAG vector search across notes and documents if requested
      if (asksAboutOwnData) {
        const [relevantNotes, ragResults] = await Promise.all([
          semanticSearch(query, 5),
          searchDocuments(query, 5),
        ]);
        ragContext = buildRagContext(ragResults);
        notesContext = relevantNotes.length > 0
          ? relevantNotes.map(n => `Title: ${n.title}\nContent: ${n.content}`).join('\n\n---\n\n')
          : '';
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
      if (ragContext) contextParts.push(`<document_context>\n${ragContext}\n</document_context>`);
      if (notesContext) contextParts.push(`<existing_notes>\n${notesContext}\n</existing_notes>`);

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
        setActionResults(results);
        setStagedActions(staged);
      }
      
    } catch (e: unknown) {
      setAiResponse(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  /**
   * Confirms and executes the head staged action, updates the action history log,
   * and displays a toast notification.
   * 
   * @param {AiAction} action - The staged AI action to execute.
   */
  const handleConfirmStaged = async (action: AiAction) => {
    setStagedActions(prev => prev.slice(1));
    const result = await executeAiAction(action, pageId);
    setActionResults(prev => [...prev, { action, success: result.success, message: result.message }]);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  /**
   * Handles keyboard events for modal dismissal and form submission.
   * 
   * @param {React.KeyboardEvent} e - Keyboard event.
   */
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
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
          <div className="modal-content glass-panel border-0">
            {/* Modal Header */}
            <div className="modal-header border-0">
              <div className="d-flex align-items-center gap-2" style={{ color: 'var(--accent-gold)' }}>
                <Sparkles size={18} />
                <h5 className="modal-title">Ask AI</h5>
              </div>
              <button type="button" className="btn-close btn-close-overlay" onClick={onClose} aria-label="Close" />
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {aiResponse !== null ? (
                /* AI Output View: Rendered Markdown + Action History */
                <div className="ai-response-container" style={{ color: 'var(--text-primary)' }}>
                  {isAiLoading && !aiResponse && (
                    <div className="spin-pulse" style={{ color: 'var(--text-secondary)' }}>
                      Analyzing your knowledge graph...
                    </div>
                  )}
                  <div 
                    className="markdown-body" 
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(aiResponse) as string) }} 
                  />
                  
                  {/* Action Execution Outcome Badges */}
                  {actionResults.map((res, i) => (
                    <AiActionCard key={i} result={res} />
                  ))}
                  
                  {/* Reset to query prompt */}
                  {!isAiLoading && (
                    <button 
                      className="btn btn-secondary mt-3" 
                      onClick={() => {
                        setAiResponse(null);
                        setQuery('');
                        setActionResults([]);
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
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                    Ask a question, paste a link to research it, or ask AI to structure and link notes.
                  </p>
                  
                  <div className="d-flex gap-2 align-items-center">
                    <div className="search-bar-container flex-grow-1" style={{ padding: '8px 12px' }}>
                      <input
                        ref={inputRef}
                        type="text"
                        className="search-input"
                        placeholder="What do you want to explore or create?"
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
      
      {/* Staged Action Confirmation Toast */}
      {stagedActions.length > 0 && (
        <ConfirmActionToast 
          action={stagedActions[0]} 
          pageId={pageId}
          onConfirm={() => handleConfirmStaged(stagedActions[0])} 
          onCancel={() => setStagedActions(prev => prev.slice(1))} 
        />
      )}
    </>
  );
};