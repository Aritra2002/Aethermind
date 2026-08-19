/**
 * ============================================================================
 * ReviewModal.tsx — Spaced Repetition Flashcard Review & Knowledge Retention
 * ============================================================================
 * 
 * Architectural Purpose:
 * Implements a SuperMemo SM-2 inspired spaced repetition review engine integrated
 * directly with the knowledge graph. Allows users to convert note titles into prompts
 * and note contents into answers to test and reinforce memory retention.
 * 
 * Key Features & Algorithms:
 * - Graph-Aware Queue Sequencing: Prioritizes due notes by expiration timestamp and
 *   traverses graph connections (BFS across `linkedNoteIds`) so semantically related
 *   concepts are reviewed in coherent thematic clusters.
 * - Modified SM-2 Spaced Repetition Scheduling:
 *   - Grade 4 (Easy) / Grade 3 (Good): Standard interval expansions (1d -> 6d -> interval * ease)
 *     with ease factor increments (+0.1).
 *   - Grade 2 (Hard): Constrained growth (interval * 1.2) with ease factor penalty (-0.15, min 1.3).
 *   - Grade 1 (Again): Immediate reset (interval = 0d) with ease factor penalty (-0.2, min 1.3).
 * - Dexie Live Querying: Automatically monitors `db.notes` for due review items.
 * - Sanitized Rich Markdown: Rendered markdown note content via `marked` and `DOMPurify`.
 */

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Note } from '../db';
import DOMPurify from 'dompurify';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { marked } from 'marked';

/**
 * Props for the ReviewModal component.
 */
interface ReviewModalProps {
  /** Callback fired to close the review session modal dialog */
  onClose: () => void;
}

/**
 * ReviewModal Component
 * 
 * Manages the active spaced repetition review session, rendering question cards,
 * revealing markdown answers, calculating next review intervals, and updating Dexie records.
 * 
 * @param {ReviewModalProps} props - Component properties.
 * @returns {React.ReactElement} The rendered spaced repetition review dialog.
 */
export const ReviewModal: React.FC<ReviewModalProps> = ({ onClose }) => {
  /**
   * Live Dexie query fetching all notes whose `nextReview` timestamp is less than or
   * equal to current time.
   */
  const liveDueNotes = useLiveQuery(() => 
    db.notes.filter(note => note.nextReview !== undefined && note.nextReview <= Date.now()).toArray()
  );

  /** Ordered queue of notes to review during this session */
  const [reviewQueue, setReviewQueue] = useState<Note[]>([]);

  /** Flag ensuring queue sequencing algorithm runs only once per modal session */
  const [isQueueInitialized, setIsQueueInitialized] = useState(false);

  /** Index of the note currently being reviewed in the queue */
  const [currentIndex, setCurrentIndex] = useState(0);

  /** Flag toggling the display of the note's answer content */
  const [showAnswer, setShowAnswer] = useState(false);

  /**
   * Graph-aware topological queue builder.
   * Clusters connected nodes together so reviews follow natural conceptual pathways.
   */
  useEffect(() => {
    if (liveDueNotes && !isQueueInitialized) {
      const sorted = [...liveDueNotes].sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
      const queue: Note[] = [];
      const remaining = new Set(sorted.map(n => n.id!));
      const noteMap = new Map(sorted.map(n => [n.id!, n]));

      while (remaining.size > 0) {
        // Find the node with the earliest due date among unqueued notes
        let minReview = Infinity;
        let nextId = -1;
        for (const id of remaining) {
          const rev = noteMap.get(id)!.nextReview || 0;
          if (rev < minReview) {
            minReview = rev;
            nextId = id;
          }
        }

        // BFS traverse through immediate linked notes to group related cards
        const processQueue = [nextId];
        while (processQueue.length > 0) {
          const id = processQueue.shift()!;
          if (remaining.has(id)) {
            const node = noteMap.get(id)!;
            queue.push(node);
            remaining.delete(id);
            if (node.linkedNoteIds) {
              for (const linkedId of node.linkedNoteIds) {
                if (remaining.has(linkedId)) {
                  processQueue.push(linkedId);
                }
              }
            }
          }
        }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReviewQueue(queue);
      setIsQueueInitialized(true);
    }
  }, [liveDueNotes, isQueueInitialized]);

  /** True if all due cards in the review queue have been graded */
  const isDone = isQueueInitialized && currentIndex >= reviewQueue.length;

  /** The note card currently under review */
  const currentNote = reviewQueue[currentIndex];

  /**
   * Applies the SM-2 spaced repetition calculation based on the user's recall rating,
   * updates the note's `interval`, `ease`, and `nextReview` in IndexedDB, and advances
   * to the next card.
   * 
   * @param {number} grade - Recall rating: 1 (Again/Fail), 2 (Hard), 3 (Good), 4 (Easy).
   */
  const handleGrade = async (grade: number) => {
    if (!currentNote || currentNote.id === undefined) return;
    
    let interval = currentNote.interval || 0;
    let ease = currentNote.ease || 2.5;

    // SM-2 Interval and Ease Calculation Logic
    if (grade >= 3) {
      // Successful recall (Good / Easy)
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 6;
      else interval = Math.round(interval * ease);
      ease = ease + 0.1;
    } else if (grade === 2) {
      // Hard recall: minor interval growth, decrease ease factor
      if (interval === 0) interval = 1;
      else interval = Math.round(interval * 1.2);
      ease = Math.max(1.3, ease - 0.15);
    } else {
      // Failed recall (Again): lapse interval back to 0 days, decrease ease factor
      interval = 0;
      ease = Math.max(1.3, ease - 0.2);
    }

    // Schedule next review timestamp (milliseconds from now)
    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

    // Persist calculated scheduling parameters to IndexedDB
    await db.notes.update(currentNote.id, { interval, ease, nextReview });
    
    // Hide answer and proceed to the next card in queue
    setShowAnswer(false);
    setCurrentIndex(prev => prev + 1);
  };

  return (
    <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-content glass-panel border-0" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          {/* Modal Header */}
          <div className="modal-header border-0">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <BrainCircuit size={20} /> Spaced Repetition Review
            </h5>
            <button type="button" className="btn-close btn-close-overlay" onClick={onClose} aria-label="Close" />
          </div>

          {/* Modal Body: Active Card or Empty State */}
          <div className="modal-body" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
            {!isQueueInitialized ? (
              /* Loading Spinner while queue is prepared */
              <div className="d-flex align-items-center justify-content-center flex-grow-1">
                <Loader2 className="spinning" size={32} />
              </div>
            ) : isDone ? (
              /* Session Completion / All Caught Up Screen */
              <div className="text-center my-auto">
                <h3>You're all caught up!</h3>
                <p>No more flashcards to review right now.</p>
                <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '20px' }}>
                  Close
                </button>
              </div>
            ) : (
              /* Active Flashcard Review View */
              <div className="d-flex flex-column flex-grow-1">
                {/* Question / Note Title Card */}
                <div className="p-3 mb-3 rounded" style={{ backgroundColor: 'var(--surface-card, rgba(20, 27, 50, 0.9))' }}>
                  <h3 style={{ marginBottom: '10px' }}>{currentNote.title}</h3>
                </div>
                
                {showAnswer ? (
                  /* Answer Revealed: Rendered Note Markdown + Rating Action Buttons */
                  <>
                    <div 
                      className="p-3 rounded flex-grow-1 overflow-auto" 
                      style={{ backgroundColor: 'var(--surface-glass, rgba(15, 20, 40, 0.75))' }}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(currentNote.content) as string) }} 
                    />
                    
                    {/* Recall Rating Buttons */}
                    <div className="d-flex flex-wrap gap-2 mt-3 justify-content-center">
                      <button 
                        className="btn" 
                        onClick={() => handleGrade(1)} 
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--accent-danger, #ef4444)' }}
                      >
                        Again (1m)
                      </button>
                      <button 
                        className="btn" 
                        onClick={() => handleGrade(2)} 
                        style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--accent-gold, #f59e0b)' }}
                      >
                        Hard (1.2x)
                      </button>
                      <button 
                        className="btn" 
                        onClick={() => handleGrade(3)} 
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.4)', color: 'var(--node-emerald, #10b981)' }}
                      >
                        Good
                      </button>
                      <button 
                        className="btn" 
                        onClick={() => handleGrade(4)} 
                        style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.4)', color: 'var(--node-indigo, #60a5fa)' }}
                      >
                        Easy
                      </button>
                    </div>
                  </>
                ) : (
                  /* Initial State: Reveal Answer Button */
                  <button className="btn btn-primary align-self-center mt-auto" onClick={() => setShowAnswer(true)}>
                    Show Answer
                  </button>
                )}
                
                {/* Review Progress Counter */}
                <div className="text-center mt-3" style={{ color: 'var(--text-secondary)' }}>
                  {currentIndex + 1} of {reviewQueue.length} due
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};