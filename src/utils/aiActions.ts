/**
 * @file aiActions.ts
 * @description Structured action parser, preflight validator, and executor for AI-driven graph operations.
 * Allows the AI assistant to interpret conversational instructions and emit JSON-structured mutation commands
 * to create, edit, or delete notes and links within an AetherMind workspace page with relational safety checks.
 */

import { db } from '../db';
import { createNote, updateNote, deleteNote } from '../db/helpers';

/**
 * Discriminated union defining all executable structured AI graph actions.
 */
export type AiAction =
  | {
      /** Create a new note on the canvas. */
      action: 'create_note';
      /** Title of the new note. */
      title: string;
      /** Markdown body content for the note. */
      content: string;
      /** Optional array of tag labels. */
      tags?: string[];
      /** Optional array of note titles to automatically connect to. */
      linkTo?: string[];
    }
  | {
      /** Edit the content or title of an existing note. */
      action: 'edit_note';
      /** Current title of the note to edit. */
      title: string;
      /** Optional new markdown body content. */
      newContent?: string;
      /** Optional new title to rename the note. */
      newTitle?: string;
    }
  | {
      /** Delete an existing note. */
      action: 'delete_note';
      /** Title of the note to delete. */
      title: string;
      /** Optional reason for deletion. */
      reason?: string;
    }
  | {
      /** Create an associative link between two notes. */
      action: 'create_link';
      /** Title of the source note. */
      from: string;
      /** Title of the target note. */
      to: string;
    }
  | {
      /** Delete an existing associative link between two notes. */
      action: 'delete_link';
      /** Title of the source note. */
      from: string;
      /** Title of the target note. */
      to: string;
    };

/**
 * Parses raw AI response text to extract structured actions and conversational explanations.
 * Scans for JSON blocks wrapped in markdown code fences (` ```json ... ``` `) or bare JSON payloads.
 *
 * @param text - Raw completion text returned by the AI provider.
 *
 * @returns An object containing the extracted {@link AiAction} list and conversational explanation text,
 *          or `null` if no valid actions were found.
 */
export function parseAiResponse(text: string): { actions: AiAction[]; explanation: string } | null {
  const validActionTypes = ['create_note', 'edit_note', 'delete_note', 'create_link', 'delete_link'];
  
  // Helper to filter and normalize raw parsed JSON objects into validated AiAction array
  const extractActions = (parsed: unknown): AiAction[] => {
    let actions: AiAction[] = [];
    if (Array.isArray(parsed)) {
      actions = parsed.filter(a => a && typeof a === 'object' && 'action' in a && typeof a.action === 'string' && validActionTypes.includes(a.action));
    } else if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      if ('action' in rec && typeof rec.action === 'string' && validActionTypes.includes(rec.action)) {
        actions = [parsed as unknown as AiAction];
      } else if ('actions' in rec && Array.isArray(rec.actions)) {
        actions = rec.actions.filter(a => a && typeof a === 'object' && 'action' in a && typeof a.action === 'string' && validActionTypes.includes(a.action));
      }
    }
    return actions;
  };

  // 1. Scan for fenced markdown JSON blocks: ```json ... ```
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  const allActions: AiAction[] = [];
  let explanation = text;
  let found = false;

  while ((match = jsonRegex.exec(text)) !== null) {
    found = true;
    try {
      const parsed = JSON.parse(match[1]);
      allActions.push(...extractActions(parsed));
    } catch (e) {
      console.debug("Failed to parse JSON block", e);
    }
    // Remove the matched JSON code block from the user-facing explanation text
    explanation = explanation.replace(match[0], '').trim();
  }

  if (found) {
    if (allActions.length > 0) {
      return { actions: allActions, explanation };
    }
    return null;
  }

  // 2. Fallback: Check if the entire response is a bare JSON payload
  try {
    const parsed = JSON.parse(text);
    const actions = extractActions(parsed);
    if (actions.length > 0) {
      return { actions, explanation: '' };
    }
  } catch (e) {
    console.debug(e);
  }
  return null;
}

/**
 * Executes a single validated AI action against the IndexedDB database for a given workspace page.
 * Handles note deduplication/appending, tag merging, connection link resolution, and deletions.
 *
 * @param action - The {@link AiAction} command to execute.
 * @param pageId - Primary key ID of the target workspace page.
 *
 * @returns A promise resolving to an execution status object with a human-readable feedback message.
 */
export async function executeAiAction(
  action: AiAction,
  pageId: number
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.action) {
      case 'create_note': {
        // Create note or retrieve existing note ID if a note with the same title exists
        const noteId = await createNote(pageId, action.title);
        
        let content = action.content;
        
        // Since createNote returns the existing note ID if it exists (with original content),
        // we append new content to existing note content without creating duplicate notes.
        const existingNote = await db.notes.get(noteId);
        if (existingNote && existingNote.content && existingNote.content.trim() !== '') {
          // Only suppress duplicate if the new content is already a substring
          // OR if the existing content ends with the exact new content (common AI re-append pattern)
          const existingTrimmed = existingNote.content.trim();
          const newTrimmed = action.content.trim();
          if (existingTrimmed.includes(newTrimmed) || newTrimmed.includes(existingTrimmed)) {
            content = existingNote.content;
          } else {
            content = `${existingNote.content}\n\n${content}`;
          }
        }

        // Resolve title references in `linkTo` to target note IDs
        let linkedNoteIds = existingNote?.linkedNoteIds || [];
        if (action.linkTo && action.linkTo.length > 0) {
          for (const title of action.linkTo) {
            const target = await db.notes.where('title').equalsIgnoreCase(title).and(n => n.pageId === pageId).first();
            if (target) {
              linkedNoteIds.push(target.id!);
            }
          }
        }
        linkedNoteIds = Array.from(new Set(linkedNoteIds));

        // Merge existing tags with newly specified tags
        const mergedTags = Array.from(new Set([...(existingNote?.tags || []), ...(action.tags || [])]));
        await updateNote(noteId, { content, tags: mergedTags, linkedNoteIds }, true);
        return { success: true, message: `Created note: "${action.title}"` };
      }
      
      case 'edit_note': {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (!note) return { success: false, message: `Note "${action.title}" not found.` };
        
        const updates: Record<string, unknown> = {};
        const contentToSet = action.newContent;
        if (contentToSet !== undefined) updates.content = contentToSet;
        if (action.newTitle !== undefined) updates.title = action.newTitle;
        
        await updateNote(note.id!, updates, true);
        return { success: true, message: `Edited note: "${action.title}"` };
      }
      
      case 'delete_note': {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (!note) return { success: false, message: `Note "${action.title}" not found.` };
        
        await deleteNote(note.id!);
        return { success: true, message: `Deleted note: "${action.title}"` };
      }
      
      case 'create_link': {
        const fromNote = await db.notes.where('title').equalsIgnoreCase(action.from).and(n => n.pageId === pageId).first();
        const toNote = await db.notes.where('title').equalsIgnoreCase(action.to).and(n => n.pageId === pageId).first();
        
        if (!fromNote || !toNote) {
          return { success: false, message: `Note not found to create link.` };
        }
        
        // Prevent duplicate link entries between the same pair
        const existingLink = await db.links.where({ sourceId: fromNote.id!, targetId: toNote.id! }).first();
        if (!existingLink) {
          await db.links.add({ sourceId: fromNote.id!, targetId: toNote.id! });
        }
        return { success: true, message: `Created link from "${action.from}" to "${action.to}"` };
      }
      
      case 'delete_link': {
        const fromNote = await db.notes.where('title').equalsIgnoreCase(action.from).and(n => n.pageId === pageId).first();
        const toNote = await db.notes.where('title').equalsIgnoreCase(action.to).and(n => n.pageId === pageId).first();
        
        if (!fromNote || !toNote) {
          return { success: false, message: `Note not found to delete link.` };
        }
        
        const existingLink = await db.links.where({ sourceId: fromNote.id!, targetId: toNote.id! }).first();
        if (existingLink && existingLink.id) {
          await db.links.delete(existingLink.id);
        }
        return { success: true, message: `Deleted link from "${action.from}" to "${action.to}"` };
      }
      
      default:
        return { success: false, message: 'Action requires staging or is unsupported.' };
    }
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Performs preflight validation checks before executing an AI action to prevent accidental data loss.
 * - Blocks note deletion if the note is heavily interconnected (> 5 incoming links).
 * - Blocks note editing if the proposed replacement text is excessively short or empty.
 *
 * @param action - The {@link AiAction} to evaluate.
 * @param pageId - Primary key ID of the target workspace page.
 *
 * @returns An object indicating whether the action is blocked (`blocked: boolean`) with an optional reason message.
 */
export async function validateActionPreflight(action: AiAction, pageId: number) {
  // Safety guard: prevent accidental AI deletion of highly connected hub notes
  if (action.action === 'delete_note') {
    const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
    if (note) {
      const incomingLinks = await db.links.where('targetId').equals(note.id!).count();
      if (incomingLinks > 5) {
        return { blocked: true, message: `This note has many connections. Delete manually if you're sure.` };
      }
    }
  }
  
  // Safety guard: prevent accidental blanking or truncation of note content
  if (action.action === 'edit_note') {
    const contentToCheck = action.newContent;
    if (contentToCheck !== undefined) {
      if (contentToCheck.trim().length <= 10) {
        return { blocked: true, message: `Edit rejected: new content is too short or empty.` };
      }
    }
  }
  
  return { blocked: false };
}

