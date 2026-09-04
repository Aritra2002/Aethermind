/**
 * @file knowledgeGapDetector.ts
 * @description Knowledge Intelligence: Identifies knowledge gaps, orphan concepts, unanswered questions,
 * and strategic learning opportunities across the personal knowledge base.
 */

import type { Note, Link } from '../../db';
import { extractConceptsFromText } from './conceptExtractor';

export type GapType = 'unresolved_question' | 'missing_concept_page' | 'isolated_island' | 'sparse_cluster';

export interface KnowledgeGap {
  id: string;
  type: GapType;
  title: string;
  description: string;
  suggestedAction: string;
  sourceNoteId?: number;
  sourceNoteTitle?: string;
  confidence: number;
}

/**
 * Analyzes the knowledge base notes and links to discover structural and semantic knowledge gaps.
 *
 * @param notes - All active workspace notes.
 * @param links - All active graph links.
 * @returns Array of prioritized {@link KnowledgeGap} recommendations.
 */
export function detectKnowledgeGaps(notes: Note[], links: Link[]): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const validNotes = notes.filter(n => n.id && Number(n.isTrash) !== 1);
  const noteTitles = new Set(validNotes.map(n => n.title.toLowerCase()));

  // 1. Detect missing concept notes: concepts mentioned in [[Brackets]] or frequently that do not have a note
  const referencedConcepts = new Map<string, { originalTitle: string; count: number; sourceId: number; sourceTitle: string }>();

  for (const note of validNotes) {
    const { suggestedWikiLinks } = extractConceptsFromText(note.content, Array.from(noteTitles));
    for (const concept of suggestedWikiLinks) {
      const lower = concept.toLowerCase();
      if (!noteTitles.has(lower)) {
        const existing = referencedConcepts.get(lower);
        if (existing) {
          existing.count++;
        } else {
          referencedConcepts.set(lower, {
            originalTitle: concept,
            count: 1,
            sourceId: note.id!,
            sourceTitle: note.title
          });
        }
      }
    }
  }

  for (const [conceptLower, data] of referencedConcepts.entries()) {
    if (data.count >= 1) {
      const displayTitle = data.originalTitle || conceptLower.charAt(0).toUpperCase() + conceptLower.slice(1);
      gaps.push({
        id: `gap_missing_${conceptLower}`,
        type: 'missing_concept_page',
        title: `Missing Concept Note: "${displayTitle}"`,
        description: `Mentioned in "${data.sourceTitle}" (and ${data.count} place(s)) but has no dedicated note yet.`,
        suggestedAction: `Create a note for "${displayTitle}" to anchor this concept in your knowledge graph.`,
        sourceNoteId: data.sourceId,
        sourceNoteTitle: data.sourceTitle,
        confidence: data.count >= 2 ? 0.9 : 0.75
      });
    }
  }

  // 2. Detect Unresolved Questions / TODOs inside notes
  for (const note of validNotes) {
    const lines = note.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('?') ||
        trimmed.startsWith('- [ ]') ||
        /\b(TODO|FIXME|QUESTION|UNCLEAR|INVESTIGATE|EXPLORE):\s*(.+)/i.test(trimmed)
      ) {
        const snippet = trimmed.replace(/^[-*]\s*(\[[ x]\]\s*)?/i, '').substring(0, 140);
        if (snippet.length > 5) {
          gaps.push({
            id: `gap_question_${note.id}_${gaps.length}`,
            type: 'unresolved_question',
            title: `Unresolved Inquiry in "${note.title}"`,
            description: snippet,
            suggestedAction: `Research and expand on this question inside "${note.title}".`,
            sourceNoteId: note.id,
            sourceNoteTitle: note.title,
            confidence: 0.85
          });
        }
      }
    }
  }

  // 3. Detect Isolated Island Nodes (0 incoming or outgoing links)
  const connectedIds = new Set(links.flatMap(l => [
    typeof l.sourceId === 'number' ? l.sourceId : (l.sourceId as { id?: number })?.id,
    typeof l.targetId === 'number' ? l.targetId : (l.targetId as { id?: number })?.id
  ]).filter((id): id is number => typeof id === 'number'));

  for (const note of validNotes) {
    if (note.id && !connectedIds.has(note.id)) {
      gaps.push({
        id: `gap_isolated_${note.id}`,
        type: 'isolated_island',
        title: `Isolated Node: "${note.title}"`,
        description: `This note has 0 graph links connecting it to other thoughts in this workspace.`,
        suggestedAction: `Connect "${note.title}" to related concepts or run Connection Discovery.`,
        sourceNoteId: note.id,
        sourceNoteTitle: note.title,
        confidence: 0.8
      });
    }
  }

  return gaps.sort((a, b) => b.confidence - a.confidence);
}
