import { db } from '../db';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const normalizeHex = (colorStr: string, fallback: string): string => {
  if (!colorStr) return fallback;
  const trimmed = colorStr.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
  }
  return fallback;
};

export const exportToHtml = async (pageId: number, pageTitle: string = 'Graph') => {
  const notes = await db.notes.where('pageId').equals(pageId).toArray();
  const categories = await db.categories.toArray();
  
  const safeTitle = pageTitle.replace(/[^a-z0-9-]/gi, ' ').trim();
  
  const currentTheme = localStorage.getItem('aethermind-theme') || 'dark';
  let bg = '#06071a';
  let sidebarBg = '#0f1428';
  let text = '#ffffff';
  let accent = '#7c3aed';
  let accentSec = '#06b6d4';
  let link = '#ffffff4d';
  let font = 'sans';
  let customThemeCSS = '';
  try {
    const custom = JSON.parse(localStorage.getItem('aethermind-custom-themes') || '{}');
    if (custom && Object.keys(custom).length > 0) {
      bg = normalizeHex(custom.bgPrimary, '#06071a');
      sidebarBg = normalizeHex(custom.sidebarBg, '#0f1428');
      text = normalizeHex(custom.textPrimary, '#ffffff');
      accent = normalizeHex(custom.accentPrimary, '#7c3aed');
      accentSec = normalizeHex(custom.accentSecondary, '#06b6d4');
      link = custom.linkColor || '#ffffff4d';
      font = custom.fontFamily || 'sans';
      
      const fontMap: Record<string, string> = {
        'sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        'inter': "'Inter', system-ui, -apple-system, sans-serif",
        'outfit': "'Outfit', system-ui, -apple-system, sans-serif",
        'serif': "'Playfair Display', Georgia, serif",
        'lora': "'Lora', Georgia, serif",
        'merriweather': "'Merriweather', Georgia, serif",
        'cinzel': "'Cinzel', serif",
        'jetbrains-mono': "'JetBrains Mono', monospace",
        'fira-code': "'Fira Code', monospace"
      };
      const fontVal = fontMap[font] || fontMap['sans'];
      
      customThemeCSS = `
  html[data-theme="custom"] {
    --bg-color: ${bg};
    --surface-color: ${sidebarBg};
    --surface-hover: ${accentSec}1a;
    --text-primary: ${text};
    --accent: ${accent};
    --border-color: ${link};
    --font-family: ${fontVal};
  }
  `;
    }
  } catch (e) {
    console.error("Failed to read custom theme config", e);
  }
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AetherMind Export - ${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* Preset theme configurations */
  :root, html[data-theme="dark"] {
    --bg-color: #06071a;
    --surface-color: rgba(15, 20, 40, 0.75);
    --surface-hover: rgba(25, 35, 60, 0.6);
    --text-primary: #ffffff;
    --accent: #7c3aed;
    --border-color: rgba(255, 255, 255, 0.08);
    --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }
  html[data-theme="light"] {
    --bg-color: #f8fafc;
    --surface-color: #ffffff;
    --surface-hover: #f1f5f9;
    --text-primary: #0f172a;
    --accent: #4f46e5;
    --border-color: #cbd5e1;
    --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }
  html[data-theme="sepia"] {
    --bg-color: #f4ecd8;
    --surface-color: #fdfaf2;
    --surface-hover: #eaddca;
    --text-primary: #5c4033;
    --accent: #a0522d;
    --border-color: #d2b48c;
    --font-family: 'Playfair Display', Georgia, serif;
  }
  html[data-theme="midnight"] {
    --bg-color: #020205;
    --surface-color: #09090b;
    --surface-hover: #18181b;
    --text-primary: #f8fafc;
    --accent: #e11d48;
    --border-color: #27272a;
    --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }
  html[data-theme="ocean"] {
    --bg-color: #051622;
    --surface-color: #0b2d45;
    --surface-hover: #13405f;
    --text-primary: #e0f2fe;
    --accent: #0ea5e9;
    --border-color: #1e3a5f;
    --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }
  ${customThemeCSS}
  * { box-sizing: border-box; }
  body { 
    font-family: var(--font-family); 
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
    color: var(--text-primary);
    opacity: 0.7;
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
    color: var(--text-primary);
    opacity: 0.7;
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
    color: var(--text-primary);
    opacity: 0.7;
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
    color: var(--text-primary);
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
    color: var(--text-primary);
    opacity: 0.85;
    font-style: italic;
  }
  .note-content img { max-width: 100%; border-radius: 12px; border: 1px solid var(--border-color); }
  
  /* Custom Color Pickers */
  .custom-color-picker {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: #ffffff !important; /* Force static color to prevent style recalculation when --text-primary changes */
  }
  .custom-color-picker::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .custom-color-picker::-webkit-color-swatch {
    border: 1px solid var(--border-color);
    border-radius: 50%;
  }
  .custom-color-picker::-moz-color-swatch {
    border: 1px solid var(--border-color);
    border-radius: 50%;
  }
  
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
      <div class="theme-selector-container" style="margin-top: 15px; display: flex; align-items: center; gap: 8px;">
        <label for="themeSelect" style="font-size: 0.75rem; color: var(--text-primary); opacity: 0.7;">Theme:</label>
        <select id="themeSelect" style="background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; padding: 4px 8px; font-size: 0.8rem; cursor: pointer; font-family: inherit; flex: 1; outline: none;">
          <option value="dark">Dark Space</option>
          <option value="light">Light Clean</option>
          <option value="sepia">Sepia Warm</option>
          <option value="midnight">Midnight</option>
          <option value="ocean">Ocean Tide</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div id="customThemeBuilder" style="display: none; margin-top: 15px; padding: 12px; background: rgba(0,0,0,0.1); border-radius: 8px; border: 1px solid var(--border-color); flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
          <span style="color: var(--text-primary); opacity: 0.7;">Background</span>
          <input type="color" id="customBg" class="custom-color-picker">
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
          <span style="color: var(--text-primary); opacity: 0.7;">Sidebar Bg</span>
          <input type="color" id="customSidebarBg" class="custom-color-picker">
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
          <span style="color: var(--text-primary); opacity: 0.7;">Text Color</span>
          <input type="color" id="customText" class="custom-color-picker">
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
          <span style="color: var(--text-primary); opacity: 0.7;">Accent Color</span>
          <input type="color" id="customAccent" class="custom-color-picker">
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
          <span style="color: var(--text-primary); opacity: 0.7;">Sec. Accent</span>
          <input type="color" id="customAccentSec" class="custom-color-picker">
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
          <span style="color: var(--text-primary); opacity: 0.7;">Lines & Borders</span>
          <input type="color" id="customLink" class="custom-color-picker">
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
          <span style="color: var(--text-primary); opacity: 0.7;">Font Style</span>
          <select id="customFont" style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 0.7rem; padding: 2px 6px; outline: none; cursor: pointer; font-family: inherit;">
            <optgroup label="Modern Sans-Serif" style="background: #18181b; color: #fff;">
              <option value="sans">Plus Jakarta Sans</option>
              <option value="inter">Inter</option>
              <option value="outfit">Outfit</option>
            </optgroup>
            <optgroup label="Classic Serif" style="background: #18181b; color: #fff;">
              <option value="serif">Playfair Display</option>
              <option value="lora">Lora</option>
              <option value="merriweather">Merriweather</option>
              <option value="cinzel">Cinzel</option>
            </optgroup>
            <optgroup label="Developer Monospace" style="background: #18181b; color: #fff;">
              <option value="jetbrains-mono">JetBrains Mono</option>
              <option value="fira-code">Fira Code</option>
            </optgroup>
          </select>
        </div>
      </div>
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
    // Safe localStorage wrapper for file:/// protocol compatibility
    const safeStorage = {
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch (e) {
          return null;
        }
      },
      setItem: (key, val) => {
        try {
          localStorage.setItem(key, val);
        } catch (e) {
          // ignore
        }
      }
    };

    const isValidHex = (val) => {
      return typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim());
    };

    const getStoredColor = (key, fallback) => {
      const val = safeStorage.getItem(key);
      return isValidHex(val) ? val.trim() : fallback;
    };

    // Theme switcher persistence controller
    const themeSelect = document.getElementById('themeSelect');
    const savedTheme = safeStorage.getItem('aethermind-export-theme') || '${currentTheme}';
    const builder = document.getElementById('customThemeBuilder');
    const customBg = document.getElementById('customBg');
    const customSidebarBg = document.getElementById('customSidebarBg');
    const customText = document.getElementById('customText');
    const customAccent = document.getElementById('customAccent');
    const customAccentSec = document.getElementById('customAccentSec');
    const customLink = document.getElementById('customLink');
    const customFont = document.getElementById('customFont');

    // Load custom colors from export file's local storage or fallback to baked-in colors
    let currentCustom = {
      bg: getStoredColor('aethermind-export-custom-bg', '${bg}'),
      sidebarBg: getStoredColor('aethermind-export-custom-sidebar-bg', '${sidebarBg}'),
      text: getStoredColor('aethermind-export-custom-text', '${text}'),
      accent: getStoredColor('aethermind-export-custom-accent', '${accent}'),
      accentSec: getStoredColor('aethermind-export-custom-accent-sec', '${accentSec}'),
      link: getStoredColor('aethermind-export-custom-link', '${link}'),
      font: safeStorage.getItem('aethermind-export-custom-font') || '${font}'
    };

    customBg.value = currentCustom.bg;
    customSidebarBg.value = currentCustom.sidebarBg;
    customText.value = currentCustom.text;
    customAccent.value = currentCustom.accent;
    customAccentSec.value = currentCustom.accentSec;
    customLink.value = currentCustom.link;
    customFont.value = currentCustom.font;

    const applyCustomThemeStyles = () => {
      const root = document.documentElement;
      root.style.setProperty('--bg-color', currentCustom.bg);
      root.style.setProperty('--surface-color', currentCustom.sidebarBg);
      root.style.setProperty('--surface-hover', currentCustom.accentSec + '1a'); // 10% opacity
      root.style.setProperty('--text-primary', currentCustom.text);
      root.style.setProperty('--accent', currentCustom.accent);
      root.style.setProperty('--border-color', currentCustom.link);
      
      const fontMap = {
        'sans': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        'inter': "'Inter', system-ui, -apple-system, sans-serif",
        'outfit': "'Outfit', system-ui, -apple-system, sans-serif",
        'serif': "'Playfair Display', Georgia, serif",
        'lora': "'Lora', Georgia, serif",
        'merriweather': "'Merriweather', Georgia, serif",
        'cinzel': "'Cinzel', serif",
        'jetbrains-mono': "'JetBrains Mono', monospace",
        'fira-code': "'Fira Code', monospace"
      };
      const fontVal = fontMap[currentCustom.font] || fontMap['sans'];
      root.style.setProperty('--font-family', fontVal);

      if (document.body) {
        document.body.style.setProperty('--bg-color', currentCustom.bg);
        document.body.style.setProperty('--surface-color', currentCustom.sidebarBg);
        document.body.style.setProperty('--surface-hover', currentCustom.accentSec + '1a');
        document.body.style.setProperty('--text-primary', currentCustom.text);
        document.body.style.setProperty('--accent', currentCustom.accent);
        document.body.style.setProperty('--border-color', currentCustom.link);
        document.body.style.setProperty('--font-family', fontVal);
      }
    };

    const updateTheme = (themeName) => {
      document.documentElement.setAttribute('data-theme', themeName);
      safeStorage.setItem('aethermind-export-theme', themeName);
      
      if (themeName === 'custom') {
        applyCustomThemeStyles();
        builder.style.display = 'flex';
      } else {
        // Clear style overrides for preset themes
        const root = document.documentElement;
        root.style.removeProperty('--bg-color');
        root.style.removeProperty('--surface-color');
        root.style.removeProperty('--surface-hover');
        root.style.removeProperty('--text-primary');
        root.style.removeProperty('--accent');
        root.style.removeProperty('--border-color');
        root.style.removeProperty('--font-family');

        if (document.body) {
          document.body.style.removeProperty('--bg-color');
          document.body.style.removeProperty('--surface-color');
          document.body.style.removeProperty('--surface-hover');
          document.body.style.removeProperty('--text-primary');
          document.body.style.removeProperty('--accent');
          document.body.style.removeProperty('--border-color');
          document.body.style.removeProperty('--font-family');
        }
        builder.style.display = 'none';
      }
    };

    themeSelect.addEventListener('change', (e) => {
      updateTheme(e.target.value);
    });

    // Handle Custom Color Pickers
    const keyMap = {
      bg: 'bg',
      sidebarBg: 'sidebar-bg',
      text: 'text',
      accent: 'accent',
      accentSec: 'accent-sec',
      link: 'link',
      font: 'font'
    };
    const handleColorChange = (key, val) => {
      if (currentCustom[key] === val) return;
      currentCustom[key] = val;
      const storageKey = 'aethermind-export-custom-' + (keyMap[key] || key);
      safeStorage.setItem(storageKey, val);
      if (themeSelect.value === 'custom') {
        applyCustomThemeStyles();
      }
    };

    // UX Helpers to prevent native Hue slider from getting stuck on pure white/black
    let originalTextVal = null;
    customText.addEventListener('click', () => {
      const val = customText.value.toLowerCase();
      if (val === '#ffffff' || val === '#000000') {
        originalTextVal = val;
        const fallbackAccent = (currentCustom.accent === '#ffffff' || currentCustom.accent === '#000000') ? '#7c3aed' : currentCustom.accent;
        customText.value = fallbackAccent;
      }
    });
    customText.addEventListener('blur', () => {
      setTimeout(() => {
        if (originalTextVal !== null) {
          customText.value = originalTextVal;
          handleColorChange('text', originalTextVal);
          originalTextVal = null;
        }
      }, 50);
    });
    customText.addEventListener('change', () => {
      originalTextVal = null;
    });

    let originalBgVal = null;
    customBg.addEventListener('click', () => {
      const val = customBg.value.toLowerCase();
      if (val === '#ffffff' || val === '#000000') {
        originalBgVal = val;
        const fallbackAccent = (currentCustom.accent === '#ffffff' || currentCustom.accent === '#000000') ? '#7c3aed' : currentCustom.accent;
        customBg.value = fallbackAccent;
      }
    });
    customBg.addEventListener('blur', () => {
      setTimeout(() => {
        if (originalBgVal !== null) {
          customBg.value = originalBgVal;
          handleColorChange('bg', originalBgVal);
          originalBgVal = null;
        }
      }, 50);
    });
    customBg.addEventListener('change', () => {
      originalBgVal = null;
    });

    let originalSidebarBgVal = null;
    customSidebarBg.addEventListener('click', () => {
      const val = customSidebarBg.value.toLowerCase();
      if (val === '#ffffff' || val === '#000000') {
        originalSidebarBgVal = val;
        const fallbackAccent = (currentCustom.accent === '#ffffff' || currentCustom.accent === '#000000') ? '#7c3aed' : currentCustom.accent;
        customSidebarBg.value = fallbackAccent;
      }
    });
    customSidebarBg.addEventListener('blur', () => {
      setTimeout(() => {
        if (originalSidebarBgVal !== null) {
          customSidebarBg.value = originalSidebarBgVal;
          handleColorChange('sidebarBg', originalSidebarBgVal);
          originalSidebarBgVal = null;
        }
      }, 50);
    });
    customSidebarBg.addEventListener('change', () => {
      originalSidebarBgVal = null;
    });

    let originalLinkVal = null;
    customLink.addEventListener('click', () => {
      const val = customLink.value.toLowerCase();
      if (val === '#ffffff' || val === '#000000') {
        originalLinkVal = val;
        const fallbackAccent = (currentCustom.accent === '#ffffff' || currentCustom.accent === '#000000') ? '#7c3aed' : currentCustom.accent;
        customLink.value = fallbackAccent;
      }
    });
    customLink.addEventListener('blur', () => {
      setTimeout(() => {
        if (originalLinkVal !== null) {
          customLink.value = originalLinkVal;
          handleColorChange('link', originalLinkVal);
          originalLinkVal = null;
        }
      }, 50);
    });
    customLink.addEventListener('change', () => {
      originalLinkVal = null;
    });

    customBg.addEventListener('input', (e) => handleColorChange('bg', e.target.value));
    customBg.addEventListener('change', (e) => handleColorChange('bg', e.target.value));

    customSidebarBg.addEventListener('input', (e) => handleColorChange('sidebarBg', e.target.value));
    customSidebarBg.addEventListener('change', (e) => handleColorChange('sidebarBg', e.target.value));

    customText.addEventListener('input', (e) => handleColorChange('text', e.target.value));
    customText.addEventListener('change', (e) => handleColorChange('text', e.target.value));

    customAccent.addEventListener('input', (e) => handleColorChange('accent', e.target.value));
    customAccent.addEventListener('change', (e) => handleColorChange('accent', e.target.value));

    customAccentSec.addEventListener('input', (e) => handleColorChange('accentSec', e.target.value));
    customAccentSec.addEventListener('change', (e) => handleColorChange('accentSec', e.target.value));

    customLink.addEventListener('input', (e) => handleColorChange('link', e.target.value));
    customLink.addEventListener('change', (e) => handleColorChange('link', e.target.value));

    customFont.addEventListener('change', (e) => handleColorChange('font', e.target.value));

    // Initial theme apply
    updateTheme(savedTheme);

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
