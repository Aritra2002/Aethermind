import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Note } from '../db';
import { X, BrainCircuit, Loader2 } from 'lucide-react';
import { marked } from 'marked';

interface ReviewModalProps {
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ onClose }) => {
  const liveDueNotes = useLiveQuery(() => 
    db.notes.filter(note => note.nextReview !== undefined && note.nextReview <= Date.now()).toArray()
  );

  const [reviewQueue, setReviewQueue] = useState<Note[]>([]);
  const [isQueueInitialized, setIsQueueInitialized] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (liveDueNotes && !isQueueInitialized) {
      const sorted = [...liveDueNotes].sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
      const queue: Note[] = [];
      const remaining = new Set(sorted.map(n => n.id!));
      const noteMap = new Map(sorted.map(n => [n.id!, n]));

      while (remaining.size > 0) {
        let minReview = Infinity;
        let nextId = -1;
        for (const id of remaining) {
          const rev = noteMap.get(id)!.nextReview || 0;
          if (rev < minReview) {
            minReview = rev;
            nextId = id;
          }
        }

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
      setReviewQueue(queue);
      setIsQueueInitialized(true);
    }
  }, [liveDueNotes, isQueueInitialized]);

  // If we run out of notes to review, we're done
  const isDone = isQueueInitialized && currentIndex >= reviewQueue.length;
  const currentNote = reviewQueue[currentIndex];

  const handleGrade = async (grade: number) => {
    if (!currentNote || currentNote.id === undefined) return;
    
    // Basic Spaced Repetition Algo (SuperMemo-2 inspired)
    let interval = currentNote.interval || 0;
    let ease = currentNote.ease || 2.5;

    if (grade >= 3) {
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 6;
      else interval = Math.round(interval * ease);
      ease = ease + 0.1;
    } else if (grade === 2) { // hard
      if (interval === 0) interval = 1;
      else interval = Math.round(interval * 1.2);
      ease = Math.max(1.3, ease - 0.15);
    } else { // again
      interval = 0;
      ease = Math.max(1.3, ease - 0.2);
    }

    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

    await db.notes.update(currentNote.id, { interval, ease, nextReview });
    
    setShowAnswer(false);
    setCurrentIndex(prev => prev + 1);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 'var(--z-modal, 1000)' }}>
      <div className="settings-modal review-modal glass-panel" style={{ maxWidth: '600px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="modal-header">
          <h2><BrainCircuit size={20} /> Spaced Repetition Review</h2>
          <button className="btn btn-icon close-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="modal-content" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, paddingBottom: '24px' }}>
          {!isQueueInitialized ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 className="spinning" size={32} />
            </div>
          ) : isDone ? (
            <div style={{ textAlign: 'center', margin: 'auto' }}>
              <h3>🎉 You're all caught up!</h3>
              <p>No more flashcards to review right now.</p>
              <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '20px' }}>Close</button>
            </div>
          ) : (
            <div className="flashcard-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="flashcard-front" style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>{currentNote.title}</h3>
              </div>
              
              {showAnswer ? (
                <>
                  <div className="flashcard-back" style={{ padding: '20px', backgroundColor: 'var(--bg-card-hover)', borderRadius: '8px', flex: 1, overflowY: 'auto' }}
                       dangerouslySetInnerHTML={{ __html: marked.parse(currentNote.content) as string }} />
                  
                  <div className="flashcard-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px', justifyContent: 'center' }}>
                    <button className="btn" onClick={() => handleGrade(1)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}>Again (1m)</button>
                    <button className="btn" onClick={() => handleGrade(2)} style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' }}>Hard (1.2x)</button>
                    <button className="btn" onClick={() => handleGrade(3)} style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}>Good</button>
                    <button className="btn" onClick={() => handleGrade(4)} style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}>Easy</button>
                  </div>
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowAnswer(true)} style={{ margin: 'auto' }}>Show Answer</button>
              )}
              
              <div style={{ textAlign: 'center', marginTop: '15px', color: 'var(--text-secondary)' }}>
                {currentIndex + 1} of {reviewQueue.length} due
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
