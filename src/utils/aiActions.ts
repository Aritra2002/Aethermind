import { db } from '../db';
import { createNote, updateNote, deleteNote } from '../db/helpers';

export type AiAction =
  | { action: 'create_note'; title: string; content: string; tags?: string[]; linkTo?: string[] }
  | { action: 'edit_note'; title: string; newContent?: string; newTitle?: string }
  | { action: 'delete_note'; title: string; reason?: string }
  | { action: 'create_link'; from: string; to: string }
  | { action: 'delete_link'; from: string; to: string };

export function parseAiResponse(text: string): { actions: AiAction[]; explanation: string } | null {
  const validActionTypes = ['create_note', 'edit_note', 'delete_note', 'create_link', 'delete_link'];
  
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
    explanation = explanation.replace(match[0], '').trim();
  }

  if (found) {
    if (allActions.length > 0) {
      return { actions: allActions, explanation };
    }
    return null;
  }

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

export async function executeAiAction(
  action: AiAction,
  pageId: number
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.action) {
      case 'create_note': {
        const noteId = await createNote(pageId, action.title);
        
        let content = action.content;
        
        // Since createNote returns the existing note ID if it exists (but with original content)
        // we should append the new content to the existing note content.
        const existingNote = await db.notes.get(noteId);
        if (existingNote && existingNote.content && existingNote.content.trim() !== '') {
          // If the new content is exactly the same, or we're just hitting the same note again with a tiny change,
          // we might just append if it's not already in there to avoid duplicates
          if (!existingNote.content.includes(action.content)) {
            content = `${existingNote.content}\n\n${content}`;
          } else {
            content = existingNote.content; // Already contains it
          }
        }

        let linkedNoteIds = existingNote?.linkedNoteIds || [];
        if (action.linkTo && action.linkTo.length > 0) {
          for (const title of action.linkTo) {
            let target = await db.notes.where('title').equalsIgnoreCase(title).and(n => n.pageId === pageId).first();
            if (target) {
              linkedNoteIds.push(target.id!);
            }
          }
        }
        linkedNoteIds = Array.from(new Set(linkedNoteIds));

        const mergedTags = Array.from(new Set([...(existingNote?.tags || []), ...(action.tags || [])]));
        await updateNote(noteId, { content, tags: mergedTags, linkedNoteIds }, true);
        return { success: true, message: `Created note: "${action.title}"` };
      }
      
      case 'edit_note': {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (!note) return { success: false, message: `Note "${action.title}" not found.` };
        
        const updates: Record<string, unknown> = {};
        const contentToSet = action.newContent !== undefined ? action.newContent : (action as any).content;
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

export async function validateActionPreflight(action: AiAction, pageId: number) {
  if (action.action === 'delete_note') {
    const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
    if (note) {
      const incomingLinks = await db.links.where('targetId').equals(note.id!).count();
      if (incomingLinks > 5) {
        return { blocked: true, message: `This note has many connections. Delete manually if you're sure.` };
      }
    }
  }
  
  if (action.action === 'edit_note') {
    const contentToCheck = action.newContent !== undefined ? action.newContent : (action as any).content;
    if (contentToCheck !== undefined) {
      if (contentToCheck.trim().length <= 10) {
        return { blocked: true, message: `Edit rejected: new content is too short or empty.` };
      }
    }
  }
  
  return { blocked: false };
}
