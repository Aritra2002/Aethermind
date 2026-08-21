/**
 * @file aiActions.ts
 * @description Structured action parser, preflight validator, risk classifier, and executor for AI-driven graph operations.
 * Allows the AI assistant to interpret conversational instructions and emit JSON-structured mutation commands
 * to create, edit, or delete notes and links within an AetherMind workspace page with relational safety checks,
 * transactional execution, audit logging into IndexedDB, and full undo/recovery support.
 */

import { db, type Note } from '../db';
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
 * Risk classification levels for AI-driven actions as defined by the safety policy.
 */
export type ActionRiskLevel = 'READ' | 'LOW_RISK_WRITE' | 'HIGH_RISK_WRITE' | 'DESTRUCTIVE';

/**
 * Returns the safety risk level of a given AI action.
 *
 * @param action - Proposed {@link AiAction}
 * @returns {@link ActionRiskLevel}
 */
export function getActionRiskLevel(action: AiAction): ActionRiskLevel {
  switch (action.action) {
    case 'create_link':
      return 'LOW_RISK_WRITE';
    case 'create_note':
    case 'edit_note':
    case 'delete_link':
      return 'HIGH_RISK_WRITE';
    case 'delete_note':
      return 'DESTRUCTIVE';
    default:
      return 'HIGH_RISK_WRITE';
  }
}

/**
 * Visual diff breakdown describing changes between existing state and proposed AI action.
 */
export interface ActionDiff {
  action: AiAction['action'];
  targetTitle: string;
  riskLevel: ActionRiskLevel;
  before?: { title?: string; content?: string; tags?: string[] };
  after?: { title?: string; content?: string; tags?: string[] };
  changes: Array<{ type: 'add' | 'remove' | 'modify'; field: string; from?: string; to?: string }>;
}

/**
 * Computes a structured before/after diff for a proposed AI action against existing note data.
 *
 * @param action - Proposed {@link AiAction}
 * @param existingNote - Current note data from database if existing
 * @returns {@link ActionDiff}
 */
export function generateActionDiff(
  action: AiAction,
  existingNote?: { title: string; content?: string; tags?: string[] } | null
): ActionDiff {
  const riskLevel = getActionRiskLevel(action);
  const diff: ActionDiff = {
    action: action.action,
    targetTitle: 'title' in action ? action.title : `${action.from} -> ${action.to}`,
    riskLevel,
    changes: []
  };

  if (action.action === 'create_note') {
    diff.after = {
      title: action.title,
      content: action.content,
      tags: action.tags
    };
    diff.changes.push({
      type: 'add',
      field: 'note',
      to: `Create note "${action.title}" (${action.content.length} chars)`
    });
    if (action.linkTo && action.linkTo.length > 0) {
      diff.changes.push({
        type: 'add',
        field: 'links',
        to: `Link to: ${action.linkTo.join(', ')}`
      });
    }
  } else if (action.action === 'edit_note') {
    diff.before = {
      title: existingNote?.title || action.title,
      content: existingNote?.content || '',
      tags: existingNote?.tags || []
    };
    diff.after = {
      title: action.newTitle || existingNote?.title || action.title,
      content: action.newContent !== undefined ? action.newContent : existingNote?.content || '',
      tags: existingNote?.tags || []
    };
    if (action.newTitle && action.newTitle !== existingNote?.title) {
      diff.changes.push({
        type: 'modify',
        field: 'title',
        from: existingNote?.title || action.title,
        to: action.newTitle
      });
    }
    if (action.newContent !== undefined && action.newContent !== existingNote?.content) {
      diff.changes.push({
        type: 'modify',
        field: 'content',
        from: (existingNote?.content || '').slice(0, 100) + '...',
        to: action.newContent.slice(0, 100) + '...'
      });
    }
  } else if (action.action === 'delete_note') {
    diff.before = {
      title: existingNote?.title || action.title,
      content: existingNote?.content || '',
      tags: existingNote?.tags || []
    };
    diff.changes.push({
      type: 'remove',
      field: 'note',
      from: `Delete note "${action.title}"`
    });
  } else if (action.action === 'create_link') {
    diff.changes.push({
      type: 'add',
      field: 'link',
      to: `Create link from "${action.from}" to "${action.to}"`
    });
  } else if (action.action === 'delete_link') {
    diff.changes.push({
      type: 'remove',
      field: 'link',
      from: `Remove link between "${action.from}" and "${action.to}"`
    });
  }

  return diff;
}

/**
 * Parses raw AI response text to extract structured actions and conversational explanations.
 * Scans for JSON blocks wrapped in markdown code fences (` ```json ... ``` `) or bare JSON payloads.
 *
 * @param text - Raw completion text returned by the AI provider.
 *
 * @returns An object containing the extracted {@link AiAction} list and conversational explanation text,
 *          or `null` if no valid actions were found.
 */
export function parseAiResponse(text: string): { actions: AiAction[]; explanation: string; cleanedText?: string } | null {
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
      return { actions: allActions, explanation, cleanedText: explanation };
    }
    return null;
  }

  // 2. Fallback: Check if the entire response is a bare JSON payload
  try {
    const parsed = JSON.parse(text);
    const actions = extractActions(parsed);
    if (actions.length > 0) {
      return { actions, explanation: '', cleanedText: '' };
    }
  } catch (e) {
    console.debug(e);
  }
  return null;
}

/**
 * Executes a single validated AI action against IndexedDB with audit logging and rollback tracking.
 *
 * @param action - The {@link AiAction} command to execute.
 * @param pageId - Primary key ID of the target workspace page.
 *
 * @returns A promise resolving to an execution status object with a human-readable feedback message and auditLogId.
 */
export async function executeAiAction(
  action: AiAction,
  pageId: number
): Promise<{ success: boolean; message: string; auditLogId?: number }> {
  const targetTitle = 'title' in action ? action.title : `${action.from} -> ${action.to}`;
  let auditLogId: number | undefined;

  try {
    switch (action.action) {
      case 'create_note': {
        const existing = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        const noteId = await createNote(pageId, action.title);
        
        let content = action.content;
        const existingNote = await db.notes.get(noteId);
        if (existingNote && existingNote.content && existingNote.content.trim() !== '') {
          const existingTrimmed = existingNote.content.trim();
          const newTrimmed = action.content.trim();
          if (existingTrimmed.includes(newTrimmed) || newTrimmed.includes(existingTrimmed)) {
            content = existingNote.content;
          } else {
            content = `${existingNote.content}\n\n${content}`;
          }
        }

        let linkedNoteIds = existingNote?.linkedNoteIds || [];
        if (action.linkTo && action.linkTo.length > 0) {
          for (const title of action.linkTo) {
            const target = await db.notes.where('title').equalsIgnoreCase(title).and(n => n.pageId === pageId).first();
            if (target && target.id) {
              linkedNoteIds.push(target.id);
            }
          }
        }
        linkedNoteIds = Array.from(new Set(linkedNoteIds));

        const mergedTags = Array.from(new Set([...(existingNote?.tags || []), ...(action.tags || [])]));
        await updateNote(noteId, { content, tags: mergedTags, linkedNoteIds }, true);

        // Record audit log
        auditLogId = await db.auditLogs.add({
          timestamp: Date.now(),
          actionType: 'create_note',
          targetTitle: action.title,
          status: 'applied',
          details: JSON.stringify({
            wasCreated: !existing,
            noteId,
            previousContent: existingNote?.content || ''
          })
        });

        return { success: true, message: `Created note: "${action.title}"`, auditLogId };
      }
      
      case 'edit_note': {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (!note || !note.id) return { success: false, message: `Note "${action.title}" not found.` };
        
        const previousState = {
          title: note.title,
          content: note.content,
          tags: note.tags
        };

        const updates: Partial<Note> = {};
        if (action.newContent !== undefined) updates.content = action.newContent;
        if (action.newTitle !== undefined) updates.title = action.newTitle;
        
        await updateNote(note.id, updates, true);

        // Record audit log
        auditLogId = await db.auditLogs.add({
          timestamp: Date.now(),
          actionType: 'edit_note',
          targetTitle: action.title,
          status: 'applied',
          details: JSON.stringify({ noteId: note.id, previousState, newState: updates })
        });

        return { success: true, message: `Edited note: "${action.title}"`, auditLogId };
      }
      
      case 'delete_note': {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (!note || !note.id) return { success: false, message: `Note "${action.title}" not found.` };
        
        const deletedSnapshot = { ...note };
        const associatedLinks = await db.links
          .where('sourceId').equals(note.id)
          .or('targetId').equals(note.id)
          .toArray();

        await deleteNote(note.id);

        // Record audit log
        auditLogId = await db.auditLogs.add({
          timestamp: Date.now(),
          actionType: 'delete_note',
          targetTitle: action.title,
          status: 'applied',
          details: JSON.stringify({ noteSnapshot: deletedSnapshot, linksSnapshot: associatedLinks })
        });

        return { success: true, message: `Deleted note: "${action.title}"`, auditLogId };
      }
      
      case 'create_link': {
        const fromNote = await db.notes.where('title').equalsIgnoreCase(action.from).and(n => n.pageId === pageId).first();
        const toNote = await db.notes.where('title').equalsIgnoreCase(action.to).and(n => n.pageId === pageId).first();
        
        if (!fromNote?.id || !toNote?.id) {
          return { success: false, message: `Note not found to create link.` };
        }
        
        const existingLink = await db.links.where({ sourceId: fromNote.id, targetId: toNote.id }).first();
        let linkId: number | undefined = existingLink?.id;

        if (!existingLink) {
          linkId = await db.links.add({ sourceId: fromNote.id, targetId: toNote.id });
        }

        auditLogId = await db.auditLogs.add({
          timestamp: Date.now(),
          actionType: 'create_link',
          targetTitle: `${action.from} -> ${action.to}`,
          status: 'applied',
          details: JSON.stringify({ linkId, sourceId: fromNote.id, targetId: toNote.id, wasNew: !existingLink })
        });

        return { success: true, message: `Created link from "${action.from}" to "${action.to}"`, auditLogId };
      }
      
      case 'delete_link': {
        const fromNote = await db.notes.where('title').equalsIgnoreCase(action.from).and(n => n.pageId === pageId).first();
        const toNote = await db.notes.where('title').equalsIgnoreCase(action.to).and(n => n.pageId === pageId).first();
        
        if (!fromNote?.id || !toNote?.id) {
          return { success: false, message: `Note not found to delete link.` };
        }
        
        const existingLink = await db.links.where({ sourceId: fromNote.id, targetId: toNote.id }).first();
        if (existingLink && existingLink.id) {
          await db.links.delete(existingLink.id);
        }

        auditLogId = await db.auditLogs.add({
          timestamp: Date.now(),
          actionType: 'delete_link',
          targetTitle: `${action.from} -> ${action.to}`,
          status: 'applied',
          details: JSON.stringify({ linkSnapshot: existingLink })
        });

        return { success: true, message: `Deleted link from "${action.from}" to "${action.to}"`, auditLogId };
      }
      
      default:
        return { success: false, message: 'Action requires staging or is unsupported.' };
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await db.auditLogs.add({
      timestamp: Date.now(),
      actionType: action.action,
      targetTitle,
      status: 'failed',
      error: errorMsg
    });
    return { success: false, message: errorMsg };
  }
}

/**
 * Reverts an AI action using its stored audit log entry snapshot.
 *
 * @param auditLogId - Primary key ID of the audit log record to undo.
 * @returns Result object with status message.
 */
export async function undoAiAction(auditLogId: number): Promise<{ success: boolean; message: string }> {
  const log = await db.auditLogs.get(auditLogId);
  if (!log) {
    return { success: false, message: 'Audit log record not found.' };
  }

  if (log.status === 'restored') {
    return { success: false, message: 'This action has already been restored.' };
  }

  try {
    const details = log.details ? JSON.parse(log.details) : {};

    switch (log.actionType) {
      case 'create_note': {
        if (details.noteId) {
          if (details.wasCreated) {
            await deleteNote(details.noteId);
          } else if (details.previousContent !== undefined) {
            await updateNote(details.noteId, { content: details.previousContent });
          }
        }
        break;
      }

      case 'edit_note': {
        if (details.noteId && details.previousState) {
          await updateNote(details.noteId, details.previousState);
        }
        break;
      }

      case 'delete_note': {
        if (details.noteSnapshot) {
          const noteData = details.noteSnapshot;
          delete noteData.id;
          const restoredId = await db.notes.add(noteData);
          if (Array.isArray(details.linksSnapshot)) {
            for (const link of details.linksSnapshot) {
              const newLink = { ...link };
              delete newLink.id;
              if (link.sourceId === details.noteSnapshot.id) newLink.sourceId = restoredId;
              if (link.targetId === details.noteSnapshot.id) newLink.targetId = restoredId;
              await db.links.add(newLink);
            }
          }
        }
        break;
      }

      case 'create_link': {
        if (details.linkId && details.wasNew) {
          await db.links.delete(details.linkId);
        }
        break;
      }

      case 'delete_link': {
        if (details.linkSnapshot) {
          const link = { ...details.linkSnapshot };
          delete link.id;
          await db.links.add(link);
        }
        break;
      }
    }

    await db.auditLogs.update(auditLogId, { status: 'restored' });
    return { success: true, message: `Successfully undid action: ${log.actionType} on "${log.targetTitle}"` };
  } catch (err: unknown) {
    return { success: false, message: `Failed to undo action: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Performs preflight validation checks before executing an AI action to prevent accidental data loss.
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
    if (note && note.id) {
      const incomingLinks = await db.links.where('targetId').equals(note.id).count();
      if (incomingLinks > 5) {
        return { blocked: true, message: `This note has many connections (${incomingLinks} links). Delete manually if you're sure.` };
      }
    }
  }
  
  // Safety guard: prevent accidental blanking or truncation of note content
  if (action.action === 'edit_note') {
    const contentToCheck = action.newContent;
    if (contentToCheck !== undefined) {
      if (contentToCheck.trim().length === 0) {
        return { blocked: true, message: `Edit rejected: new content cannot be empty.` };
      }
    }
  }
  
  return { blocked: false };
}

/**
 * Retrieves the recent history of AI graph actions with diff descriptions and audit status.
 *
 * @param limit - Maximum number of recent log entries to retrieve (default: 20).
 * @returns Array of audit log records sorted newest first.
 */
export async function getAiActionHistory(limit: number = 20) {
  const logs = await db.auditLogs.toArray();
  return logs
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
