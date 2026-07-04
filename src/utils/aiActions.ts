import { db } from '../db';
import { createNote, updateNote, deleteNote } from '../db/helpers';

export type AiAction =
  | { action: 'create_note'; title: string; content: string; tags?: string[]; linkTo?: string[] }
  | { action: 'edit_note'; title: string; newContent?: string; newTitle?: string }
  | { action: 'delete_note'; title: string; reason?: string }
  | { action: 'create_link'; from: string; to: string }
  | { action: 'delete_link'; from: string; to: string };

export function parseAiResponse(text: string): { action: AiAction; explanation: string } | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;

  try {
    const action = JSON.parse(jsonMatch[1]) as AiAction;
    const explanation = text.replace(jsonMatch[0], '').trim();
    
    if (['create_note', 'edit_note', 'delete_note', 'create_link', 'delete_link'].includes(action.action)) {
      return { action, explanation };
    }
    return null;
  } catch {
    return null;
  }
}

export async function executeAiAction(
  action: AiAction,
  pageId: number
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.action) {
      case 'create_note': {
        let noteId = await createNote(pageId, action.title);
        
        let content = action.content;
        if (action.linkTo && action.linkTo.length > 0) {
          // append wiki links to content if they are not already there
          const wikiLinks = action.linkTo.map(t => `[[${t}]]`).join(' ');
          content += `\n\n${wikiLinks}`;
        }
        
        await updateNote(noteId, { content, tags: action.tags || [] });
        return { success: true, message: `Created note: "${action.title}"` };
      }
      
      case 'edit_note': {
        const note = await db.notes.where('title').equalsIgnoreCase(action.title).and(n => n.pageId === pageId).first();
        if (!note) return { success: false, message: `Note "${action.title}" not found.` };
        
        const updates: any = {};
        if (action.newContent !== undefined) updates.content = action.newContent;
        if (action.newTitle !== undefined) updates.title = action.newTitle;
        
        await updateNote(note.id!, updates);
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
  } catch (e: any) {
    return { success: false, message: e.message };
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
    if (action.newContent !== undefined) {
      if (action.newContent.trim().length <= 10) {
        return { blocked: true, message: `Edit rejected: new content is too short or empty.` };
      }
    }
  }
  
  return { blocked: false };
}
