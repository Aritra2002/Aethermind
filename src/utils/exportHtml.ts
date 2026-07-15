import { db } from '../db';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const exportToHtml = async (pageId: number, pageTitle: string = 'Graph') => {
  const notes = await db.notes.where('pageId').equals(pageId).toArray();
  const categories = await db.categories.toArray();
  
  const safeTitle = pageTitle.replace(/[^a-z0-9-]/gi, ' ').trim();
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AetherMind Export - ${safeTitle}</title>
<style>
  body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f8fafc; }
  h1, h2, h3 { color: #818cf8; }
  .note { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #818cf8; }
  a { color: #34d399; text-decoration: none; }
  a:hover { text-decoration: underline; }
  pre { background: #000; padding: 10px; border-radius: 4px; overflow-x: auto; }
</style>
</head>
<body>
<h1>AetherMind Export: ${safeTitle}</h1>
<p>Exported on ${new Date().toLocaleString()}</p>
<hr/>
`;

  for (const note of notes) {
    const categoryObj = categories.find(c => c.id === note.category);
    const color = categoryObj ? categoryObj.color : '#818cf8';
    
    // Replace [[Links]] with simple anchor tags to the IDs
    let content = note.content || '';
    content = content.replace(/\[\[(.*?)\]\]/g, (_, title) => {
      const targetNote = notes.find(n => n.title.toLowerCase() === title.toLowerCase().trim());
      if (targetNote) {
        return `<a href="#note-${targetNote.id}">${title}</a>`;
      }
      return title;
    });

    html += `
<div class="note" id="note-${note.id}" style="border-left-color: ${color};">
  <h2 style="margin-top: 0;">${note.title}</h2>
  ${note.tags && note.tags.length > 0 ? `<p style="font-size: 0.8em; color: #94a3b8;">Tags: ${note.tags.join(', ')}</p>` : ''}
  <div>${DOMPurify.sanitize(marked.parse(content) as string)}</div>
</div>
`;
  }

  html += `</body></html>`;

  // Download
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNameTitle = pageTitle.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  a.download = `AetherMind_Export_${fileNameTitle}_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
