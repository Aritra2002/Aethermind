/**
 * @file contradictionDetector.ts
 * @description Knowledge Intelligence: Evidence-backed contradiction and cognitive dissonance detector across notes.
 * Analyzes semantic and logical conflicts with source note citations and confidence scoring.
 */

import type { Note } from '../../db';
import { cosineSimilarity } from '../vectorSearch';

export type ContradictionType = 'direct_conflict' | 'temporal_evolution' | 'contextual_difference';

export interface ContradictionEvidence {
  noteId: number;
  noteTitle: string;
  snippet: string;
  timestamp: number;
}

export interface DetectedContradiction {
  id: string;
  topic: string;
  type: ContradictionType;
  confidence: number;
  explanation: string;
  claimA: ContradictionEvidence;
  claimB: ContradictionEvidence;
}

/** Negation and conflict indicator keywords */
const POLARITY_PAIRS: Array<[RegExp, RegExp]> = [
  [/\b(is|are|was|were|must be)\s+(safe|secure|effective|recommended|optimal|supported|enabled|true|valid|fast|performant)\b/i,
   /\b(is|are|was|were|must not be)\s+(unsafe|insecure|ineffective|deprecated|discouraged|disabled|false|invalid|slow|unsupported)\b/i],
  [/\b(always|guaranteed|required)\b/i, /\b(never|impossible|forbidden|prohibited)\b/i],
  [/\b(increases|boosts|accelerates|improves)\b/i, /\b(decreases|reduces|degrades|slows down)\b/i],
  [/\b(supports|compatible with|supported)\b/i, /\b(incompatible with|conflicts with|unsupported|deprecated)\b/i],
  [/\b(fast|high performance|performant)\b/i, /\b(slow|sluggish|unsupported)\b/i]
];

/**
 * Scans a collection of notes for potential semantic and polarity contradictions on common topics.
 *
 * @param notes - Active notes to analyze.
 * @param similarityThreshold - Minimum semantic embedding similarity required to compare notes (default: 0.65).
 * @returns Array of {@link DetectedContradiction} items.
 */
export function detectContradictions(
  notes: Note[],
  similarityThreshold: number = 0.65
): DetectedContradiction[] {
  const validNotes = notes.filter(n => n.id && n.content && Number(n.isTrash) !== 1);
  const contradictions: DetectedContradiction[] = [];

  for (let i = 0; i < validNotes.length; i++) {
    for (let j = i + 1; j < validNotes.length; j++) {
      const noteA = validNotes[i];
      const noteB = validNotes[j];

      // Check if notes discuss similar concepts (via embeddings if present or shared words/title)
      let isRelated = false;
      if (noteA.embedding && noteB.embedding) {
        const sim = cosineSimilarity(noteA.embedding, noteB.embedding);
        if (sim >= similarityThreshold) {
          isRelated = true;
        }
      } else {
        const wordsA = new Set((noteA.title + ' ' + noteA.content).toLowerCase().match(/\b\w{4,}\b/g) || []);
        const wordsB = (noteB.title + ' ' + noteB.content).toLowerCase().match(/\b\w{4,}\b/g) || [];
        const overlap = wordsB.filter(w => wordsA.has(w)).length;
        if (overlap >= 2) {
          isRelated = true;
        }
      }

      if (!isRelated) continue;

      // Inspect sentence-level polarity collisions
      const sentencesA = noteA.content.split(/(?<=[.?!])\s+/);
      const sentencesB = noteB.content.split(/(?<=[.?!])\s+/);

      for (const sA of sentencesA) {
        for (const sB of sentencesB) {
          for (const [posRegex, negRegex] of POLARITY_PAIRS) {
            const aPos = posRegex.test(sA);
            const aNeg = negRegex.test(sA);
            const bPos = posRegex.test(sB);
            const bNeg = negRegex.test(sB);

            if ((aPos && bNeg) || (aNeg && bPos)) {
              // Determine if this is temporal evolution vs direct conflict
              const timeDiffMonths = Math.abs((noteA.updatedAt || noteA.createdAt) - (noteB.updatedAt || noteB.createdAt)) / (1000 * 60 * 60 * 24 * 30);
              const type: ContradictionType = timeDiffMonths > 6 ? 'temporal_evolution' : 'direct_conflict';

              const contradictionId = `contra_${noteA.id}_${noteB.id}_${contradictions.length}`;
              contradictions.push({
                id: contradictionId,
                topic: `${noteA.title} vs ${noteB.title}`,
                type,
                confidence: type === 'temporal_evolution' ? 0.75 : 0.85,
                explanation: type === 'temporal_evolution'
                  ? `Viewpoint appears to have evolved between "${noteA.title}" and "${noteB.title}" over time.`
                  : `Conflicting statements detected regarding "${noteA.title}" and "${noteB.title}".`,
                claimA: {
                  noteId: noteA.id!,
                  noteTitle: noteA.title,
                  snippet: sA.trim().substring(0, 180),
                  timestamp: noteA.updatedAt || noteA.createdAt
                },
                claimB: {
                  noteId: noteB.id!,
                  noteTitle: noteB.title,
                  snippet: sB.trim().substring(0, 180),
                  timestamp: noteB.updatedAt || noteB.createdAt
                }
              });
              break;
            }
          }
        }
      }
    }
  }

  return contradictions;
}
