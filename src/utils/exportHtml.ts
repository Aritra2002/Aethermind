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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AetherMind Export - ${safeTitle}</title>
<style>
  :root {
    --bg-color: #0A0A0A;
    --surface-color: #1C1C1C;
    --surface-hover: #2A2A2A;
    --text-primary: #F5F5F0;
    --text-secondary: #8F8F8F;
    --accent: #B59A5F;
    --border-color: rgba(255, 255, 255, 0.05);
  }
  * { box-sizing: border-box; }
  body { 
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
    margin: 0; 
    background: var(--bg-color); 
    color: var(--text-primary); 
    display: flex;
    height: 100vh;
    overflow: hidden;
    font-weight: 300;
  }
  /* Sidebar */
  .sidebar {
    width: 320px;
    background: var(--surface-color);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    box-shadow: inset -1px 0 0 rgba(255,255,255,0.02);
  }
  .sidebar-header {
    padding: 30px 24px 20px;
  }
  .sidebar-header h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .sidebar-header p {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .search-container {
    padding: 0 24px 20px;
  }
  .search-input {
    width: 100%;
    padding: 12px 16px;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .toc {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
  }
  .toc-item {
    display: block;
    padding: 10px 12px;
    margin-bottom: 4px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.95rem;
    border-radius: 6px;
    transition: all 0.2s ease;
  }
  .toc-item:hover, .toc-item.active {
    background: var(--surface-hover);
    color: var(--text-primary);
  }
  /* Main Content */
  .main-content {
    flex: 1;
    overflow-y: auto;
    padding: 60px 40px;
    scroll-behavior: smooth;
  }
  .notes-container {
    max-width: 800px;
    margin: 0 auto;
  }
  .note { 
    background: var(--surface-color); 
    padding: 40px; 
    border-radius: 16px; 
    margin-bottom: 40px; 
    border: 1px solid var(--border-color);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px -15px rgba(0,0,0,0.5);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .note:hover {
    transform: translateY(-2px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 50px -20px rgba(0,0,0,0.6);
  }
  .note:target {
    animation: pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(181, 154, 95, 0.4), inset 0 1px 0 rgba(255,255,255,0.05); }
    70% { box-shadow: 0 0 0 10px rgba(181, 154, 95, 0), inset 0 1px 0 rgba(255,255,255,0.05); }
    100% { box-shadow: 0 0 0 0 rgba(181, 154, 95, 0), inset 0 1px 0 rgba(255,255,255,0.05); }
  }
  .note-title { 
    margin: 0 0 20px 0; 
    color: var(--text-primary);
    font-size: 2rem;
    font-weight: 500;
    letter-spacing: -0.03em;
  }
  .note-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 30px;
  }
  .tag {
    background: var(--bg-color);
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }
  .category-tag {
    color: var(--accent);
    border-color: rgba(181, 154, 95, 0.3);
    background: rgba(181, 154, 95, 0.05);
  }
  .note-content {
    line-height: 1.7;
    font-size: 1.05rem;
    color: #D1D1D1;
  }
  .note-content h1, .note-content h2, .note-content h3 { color: var(--text-primary); margin-top: 1.8em; font-weight: 500; letter-spacing: -0.02em; }
  .note-content a { color: var(--accent); text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.2s; }
  .note-content a:hover { border-color: var(--accent); }
  .note-content pre { 
    background: var(--bg-color); 
    padding: 20px; 
    border-radius: 12px; 
    overflow-x: auto; 
    border: 1px solid var(--border-color);
  }
  .note-content code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.85em;
    background: var(--bg-color);
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }
  .note-content pre code { background: none; padding: 0; border: none; }
  .note-content blockquote {
    border-left: 2px solid var(--accent);
    margin: 0;
    padding-left: 20px;
    color: var(--text-secondary);
    font-style: italic;
  }
  .note-content img { max-width: 100%; border-radius: 12px; border: 1px solid var(--border-color); }
  
  /* Mobile Responsive */
  @media (max-width: 768px) {
    body { flex-direction: column; overflow: auto; }
    .sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
    .toc { max-height: 250px; }
    .main-content { padding: 30px 20px; overflow-y: visible; }
    .note { padding: 25px; }
    .note-title { font-size: 1.5rem; }
  }
</style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-header">
      <h1>${safeTitle}</h1>
      <p>Exported on ${new Date().toLocaleString()}</p>
    </div>
    <div class="search-container">
      <input type="text" id="searchInput" class="search-input" placeholder="Search notes...">
    </div>
    <div class="toc" id="toc">`;

  // Pre-generate TOC
  for (const note of notes) {
    html += `<a href="#note-${note.id}" class="toc-item" data-title="${note.title.toLowerCase()}">${note.title}</a>`;
  }

  html += `
    </div>
  </div>
  <div class="main-content" id="mainContent">
    <div class="notes-container">
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
      <div class="note" id="note-${note.id}" style="border-left-color: ${color};" data-title="${note.title.toLowerCase()}">
        <h2 class="note-title" style="color: ${color};">${note.title}</h2>
        <div class="note-meta">
          <span class="tag category-tag" style="color: ${color}; border-color: ${color}40; background: ${color}10;">${categoryObj?.label || 'General'}</span>
          ${note.tags && note.tags.length > 0 ? note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('') : ''}
        </div>
        <div class="note-content">${DOMPurify.sanitize(marked.parse(content) as string)}</div>
      </div>
`;
  }

  html += `
    </div>
  </div>
  <script>
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const tocItems = document.querySelectorAll('.toc-item');
    const notes = document.querySelectorAll('.note');
    const mainContent = document.getElementById('mainContent');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      
      tocItems.forEach(item => {
        const title = item.getAttribute('data-title');
        if (title.includes(query)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
      
      notes.forEach(note => {
        const title = note.getAttribute('data-title');
        if (title.includes(query)) {
          note.style.display = 'block';
        } else {
          note.style.display = 'none';
        }
      });
    });

    // Active TOC highlighting
    const observerOptions = {
      root: mainContent,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          document.querySelectorAll('.toc-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === '#' + id) {
              item.classList.add('active');
            }
          });
        }
      });
    }, observerOptions);

    notes.forEach(note => observer.observe(note));
  </script>
</body>
</html>`;

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
