<div align="center">
  <img src="https://img.shields.io/badge/AetherMind-PKM-8A2BE2?style=for-the-badge&logo=react" alt="AetherMind" />
  <h1>AetherMind</h1>
  <p><strong>A Next-Generation, Local-First Personal Knowledge Graph</strong></p>

  <p>
    <img src="https://img.shields.io/badge/version-1.30.0-blue.svg?style=flat-square" alt="Version" />
    <img src="https://img.shields.io/badge/license-AGPLv3-red.svg?style=flat-square" alt="AGPLv3 License" />
    <img src="https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-646CFF.svg?style=flat-square&logo=vite" alt="Vite" />
    <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8.svg?style=flat-square" alt="PWA" />
    <img src="https://img.shields.io/badge/D3.js-Force%20Graph-F9A03C.svg?style=flat-square&logo=d3.js" alt="D3" />
  </p>

  <p>
    <em>Seamless synchronization, unparalleled privacy, and dynamic AI-powered insights — all living locally on your device.</em><br/>
    <strong>Fully responsive — works flawlessly on mobile, tablet, and desktop.</strong>
  </p>
</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [AI Integration](#ai-integration)
- [Data Management](#data-management)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Theming](#theming)
- [Browser Extension](#browser-extension)
- [Building for Production](#building-for-production)
- [Running Tests](#running-tests)
- [License](#license)

---

## About

**AetherMind** is a local-first Personal Knowledge Graph (PKM) that lives entirely in your browser. It transforms your notes into an interactive, physics-based visual graph where ideas are connected, discovered, and explored. With privacy-preserving AI integrations running directly on your machine (or through secure gateways), AetherMind helps you cultivate ideas without compromising security.

> **Key Philosophy:** Your data stays yours. Everything is stored locally in IndexedDB — no cloud dependency, no data mining, no surveillance.

---

## Features

### Interactive Graph Visualization

- **D3 Force-Directed Graph** — Explore your notes as an interactive, physics-based node network
- **Drag & Drop** — Drag nodes to pin/unpin them in place on the canvas
- **Scroll to Zoom** — Pan and zoom across the graph canvas
- **Semantic NLP Clustering** — Toggle invisible semantic similarity links between notes using vector embeddings
- **Category Color-Coding** — Nodes are color-coded by category (General, Work, Personal, Ideas)
- **Visit-Based Heatmap** — Frequently visited nodes glow brighter with larger halos
- **Animated Connections** — Active node connections animate with dashed flowing lines

### Knowledge Graph Features

| Feature | Description |
|---|---|
| **Pages** | Group notes into separate pages/workspaces (e.g., different projects) |
| **Wiki-Links** | Link notes using `[[Note Title]]` syntax — creates bidirectional graph edges |
| **Timeline Scrubber** | Slide through time to view how your graph evolved |
| **Graph Snapshots** | Save and restore named snapshots of your entire graph state |
| **Activity Journal** | Calendar-based view showing when notes were created |
| **Spaced Repetition** | Built-in flashcard-style review with SM-2 algorithm, graph-aware clustering |
| **Full Backup Export/Import** | Export all data as JSON or import previously saved backups |
| **ZIP Export** | Download complete graph as ZIP (graph data + markdown files + canvas PNG) |
| **HTML Export** | Export notes as a standalone HTML document with offline theme switcher |

### Rich Markdown Editor

- **Split-View Editor** — Switch between Edit mode (with formatting toolbar) and Preview mode
- **GitHub-Flavored Markdown** — Full GFM support via `marked`
- **PrismJS Syntax Highlighting** — Code blocks with syntax highlighting
- **Wiki-Link Autocomplete** — Type `[[` to link to other notes
- **Slash Commands** — Type `/` for quick-insert blocks (headings, todo lists, quotes, code blocks)
- **Formatting Toolbar** — Bold, italic, heading, code block, wiki-link buttons
- **Auto-Save** — Debounced auto-save on content and tag changes
- **AI-Powered Auto-Tagging** — Suggest tags and related links using AI
- **AI Summarization** — Generate TL;DR summaries of note content
- **Related Notes** — Semantic similarity panel showing related notes by embedding cosine similarity

### Unified RAG System

- **Automatic Indexing** — Every note, uploaded document, AI-generated note, and ZIP import is auto-indexed for semantic search
- **Document Upload** — Upload `.txt`, `.md`, `.pdf`, `.docx`, `.pptx`, `.csv` files for RAG indexing
- **AI Decomposition** — Uploaded documents are AI-parsed into structured knowledge graph nodes
- **Semantic Search** — Search across all notes and documents by meaning (not just keywords)
- **TF-IDF Fallback** — Works even without browser WASM support via pure-JS fallback embeddings

### AI Features

| Feature | Details |
|---|---|
| **Ask AI** | Chat with AI that can read your graph, answer questions, and execute actions |
| **AI Co-Authoring** | AI can create notes, edit notes, delete notes, and create/delete links |
| **Connection Discovery** | After writing a note, AI silently suggests links to related notes |
| **"Why Connected?"** | Hover over any edge in the graph to get an AI explanation of the relationship |
| **Daily Discovery Digest** | Daily serendipitous connection between an old and a recent note |
| **URL Research** | Paste a URL and AI fetches & summarizes the content |
| **Document-to-Graph** | Upload documents and AI converts them into interconnected knowledge nodes |
| **Semantic Clustering** | Local ML finds unlinked but semantically similar notes and auto-links them |

### Supported AI Providers

- **Anthropic** (Claude models)
- **OpenAI** (GPT models)
- **DeepSeek**
- **Google** (Gemini models)
- **OpenRouter** (multi-provider access)
- **Vercel AI Gateway**
- **Custom Provider** (any OpenAI-compatible endpoint, including local LLMs via LM Studio / Ollama / llama.cpp)

### Multi-Theme System

- **6 Preset Themes**: Dark Space, Light Clean, Sepia Warm, Midnight, Ocean Tide, Custom
- **Custom Theme Builder**: Full color customization with real-time preview
- **Font Selection**: 9 font options (sans-serif, serif, monospace)
- **Theme-Persistent HTML Export**: Exported HTML includes offline theme switcher

### Data Portability

- **Full JSON Backup** — Export/Import complete database
- **ZIP Archive** — Export graph data + markdown files + canvas PNG snapshot
- **HTML Export** — Standalone searchable HTML document with all notes
- **IndexedDB** — All data lives in your browser; no external database needed

### PWA & Offline

- **Progressive Web App** — Installable on desktop and mobile
- **Offline-Ready** — Full functionality without internet connection
- **Service Worker Caching** — Assets cached for reliable offline loading

### Responsive Design

- **Desktop** (<1024px): Full split-view with graph canvas + sidebar editor
- **Tablet** (768-1023px): Compact header with icon-only buttons
- **Mobile** (<768px): Bottom navigation bar, full-screen modals, swipe-up mini card
- **Touch Optimized**: Tap-to-select nodes, long-press to unpin, pointer-capture drag

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | React 19, TypeScript 6 |
| **Build Tool** | Vite 8 |
| **Database** | Dexie.js (IndexedDB wrapper) |
| **Graph Visualization** | D3.js 7 (Force Simulation, Canvas Rendering) |
| **Styling** | Tailwind CSS 3, Bootstrap 5, CSS Custom Properties |
| **Animation** | Framer Motion 12 |
| **Markdown** | marked, DOMPurify, PrismJS |
| **AI / ML** | @xenova/transformers (in-browser ML), Custom TF-IDF fallback |
| **AI Clients** | OpenAI-compatible API (supports Anthropic, Google, DeepSeek, OpenRouter, custom) |
| **File Processing** | pdfjs-dist (PDF), JSZip (archive), DOMPurify (sanitization) |
| **Testing** | Vitest, jsdom |
| **PWA** | vite-plugin-pwa |
| **Utilities** | date-fns, lucide-react (icons) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### Installation

```bash
# Clone the repository
git clone https://github.com/Aritra2002/Aethermind.git
cd Aethermind

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/Aethermind/`.

### Quick Start with Demo Data

On first load, AetherMind automatically seeds the database with:
- A default **"Graph"** page
- 4 default categories (General, Work, Personal, Ideas)
- 4 interconnected demo notes with wiki-links and tags

This gives you an immediate interactive graph to explore.

---

## Configuration

### AI Provider Setup

Navigate to **Settings** (gear icon) → **AI Integration** tab.

1. Select your **Provider** (Anthropic, OpenAI, DeepSeek, Google, OpenRouter, Vercel, or Custom)
2. Enter your **API Key**
3. (Optional) Select or enter a **Model name**
4. (For Custom providers) Enter the **Base URL** and optional **Backend Proxy URL**

Settings are saved automatically to `localStorage`.

### Local LLMs

To use a local LLM (LM Studio, Ollama, llama.cpp):

1. Set Provider to **"Custom Provider"**
2. Enter your local endpoint as Base URL (e.g., `http://localhost:1234/v1`)
3. Set `OLLAMA_ORIGINS=*` if using Ollama to avoid CORS issues
4. Click **"Detect Models"** to auto-discover available models

---

## Usage Guide

### Graph Canvas

```
┌─────────────────────────────────────────────┐
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │   ●──●────●                           │  │
│  │    ╲ ╱    ╱                           │  │
│  │     ●────●      ●────●                │  │
│  │    ╱           ╱                      │  │
│  │   ●───────────●                       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│  ┌──────────────────────┐ ┌────┐ ┌────┐     │
│  │ Timeline Scrubber    │ │Sear│ │Help│     │
│  └──────────────────────┘ └────┘ └────┘     │
└─────────────────────────────────────────────┘
```

**Controls:**

| Action | Desktop | Mobile |
|---|---|---|
| Select node | Click | Tap |
| Create note | Double-click empty space | — |
| Drag node | Click & drag | Touch & drag |
| Pin node | Drag it | Drag it |
| Unpin node | Double-click node | Long-press (500ms) |
| Pan canvas | Drag empty space | Drag empty space |
| Zoom | Scroll | Pinch |
| Open sidebar | Click node | Tap node |
| Export graph | Click Export ZIP button | Menu → Export ZIP |

### Writing Notes

The editor has two modes:

1. **View Mode** (default) — Renders formatted markdown with clickable wiki-links
2. **Edit Mode** — Raw markdown editor with formatting toolbar and slash commands

**Wiki-Links:** Type `[[Note Title]]` to create a bidirectional link to another note. If the target note doesn't exist, it's automatically created as an empty node.

**Formatting Toolbar** (Edit Mode only):
- **B** — Bold (`**text**`)
- **I** — Italic (`_text_`)
- **H** — Heading (`### `)
- **<>** — Code block
- **Link** — Wiki-link (`[[Title]]`)

**Slash Commands:** Type `/` in the editor to quick-insert:
- `### ` — Heading
- `- [ ] ` — Todo list
- `> ` — Blockquote
- ` ``` ` — Code block

### Managing Notes

- **Title** — Click to edit, blur to save
- **Category** — Dropdown to change node category (color)
- **Node Color** — Color picker for per-node color override
- **Tags** — Comma-separated tags for filtering
- **Connections** — Dropdown to add connections, click badges to navigate, X to remove
- **AI Summary** — Generate AI-powered TL;DR
- **AI Auto-Tag** — AI suggests tags and links
- **Delete** — Trash icon with confirmation

### Managing Pages

- **New Page** — Header button or Mobile Nav "New Page"
- **Switch Pages** — Page selector dropdown in header
- **Rename Page** — Edit icon next to page selector
- **Delete Page** — Trash icon (deletes all notes on that page)

### AI Ask Modal

Press the **Sparkles** icon in the header or use the mobile menu.

- Ask general questions (AI answers from its knowledge)
- Ask about your data: *"what do I have on X"*, *"search my notes for Y"*
- Ask the AI to **create/edit/delete notes** — the AI will propose actions using structured JSON
- Paste a **URL** — AI fetches and analyzes the content
- **Safe actions** (create_note, create_link) execute immediately
- **Unsafe actions** (edit_note, delete_note) are staged for user confirmation via toast

### Spaced Repetition Review

Click the **Brain** icon in the header to open the Review modal. Uses the SM-2 algorithm with graph-aware clustering — reviewing a note interleaves its linked neighbors for associative learning.

**Grading:**
- **Again** (1m) — Reset interval
- **Hard** (1.2x) — Small interval increase
- **Good** — Standard interval
- **Easy** — Bonus interval increase

### Discovery Digest

Click the **Compass** icon to open the daily digest — AI finds surprising connections between an old note (>30 days) and a recent note (<7 days).

### Timeline Scrubber

Slide the timeline at the bottom of the graph canvas to filter notes by creation date. Use the datetime-local input for precise date specification. Click **Reset Timeline** to clear the filter.

### Graph Snapshots

In **Settings → Data & Graph → Graph Versioning & Time Travel**:

- **Save Snapshot** — Save current graph state
- **Browse Snapshots** — View/list all snapshots
- **Enter number** to view a historical snapshot (read-only view)
- **Type "restore &lt;number&gt;"** to restore a snapshot
- Automatic snapshots are taken every 10 minutes

### Search & Filter

Click the **Search** button on the canvas to open the search panel:
- **Text Search** — Searches titles, content, and tags
- **Tag Filter** — Click tag chips to filter by tag
- **Category Legend** — Shows node color mapping
- **Clear Filters** — Reset all filters

### Command Palette

Press `Ctrl+K` / `Cmd+K` to open the command palette. Type to search notes by title or content. Navigate with arrow keys and press Enter to open.

---

## AI Integration

### Architecture

```
┌─────────────────────────────────────────────┐
│              AetherMind App                 │
│  ┌───────────┐  ┌────────────────────────┐  │
│  │  Ask AI   │  │ Connection Discovery   │  │
│  │  Modal    │  │ Digest / Why Connected │  │
│  └─────┬─────┘  └──────────┬─────────────┘  │
│        └──────────┬────────┘                │
│                   ▼                         │
│  ┌──────────────────────────────────────┐   │
│  │          callAI() Client             │   │
│  │  (OpenAI-compatible streaming API)   │   │
│  └──────────┬───────────────────────────┘   │
│             │                               │
│             ▼                               │
│  ┌──────────────────────┐                   │
│  │   RAG Engine (rag.ts)│                   │
│  │  Vector Search +     │                   │
│  │  Document Chunking   │                   │
│  └──────────┬───────────┘                   │
│             │                               │
│             ▼                               │
│  ┌──────────────────────┐                   │
│  │  Vector Search       │                   │
│  │  (Transformers.js /  │                   │
│  │   TF-IDF fallback)   │                   │
│  └──────────────────────┘                   │
│                                             │
│  All data stored in IndexedDB (Dexie.js)    │
└─────────────────────────────────────────────┘
```

### RAG System

All data is automatically indexed:
- Manually created/edited notes
- AI-generated notes
- Uploaded documents (`.txt`, `.md`, `.pdf`, `.docx`, `.pptx`, `.csv`)
- ZIP-imported notes

The RAG pipeline:
1. **Chunking** — Text is split into overlapping chunks (~1000 chars with 200 overlap)
2. **Embedding** — Each chunk is embedded using `@xenova/transformers` (with TF-IDF fallback)
3. **Storage** — Chunks and embeddings stored in the `documents` IndexedDB table
4. **Search** — Semantic search via cosine similarity on embeddings

### Action Engine

The AI can perform these actions through structured JSON in responses:

```json
[
  { "action": "create_note", "title": "Quantum Computing", "content": "Detailed markdown...", "tags": ["physics", "tech"], "linkTo": ["Related Topic"] },
  { "action": "create_link", "from": "Quantum Computing", "to": "Related Topic" },
  { "action": "edit_note", "title": "Old Title", "newContent": "Updated content...", "newTitle": "New Title" },
  { "action": "delete_note", "title": "Outdated Note", "reason": "No longer relevant" },
  { "action": "delete_link", "from": "Note A", "to": "Note B" }
]
```

---

## Data Management

### Backup & Restore

In **Settings → Data & Graph → Data Management**:

| Action | Description |
|---|---|
| **Export Full Backup (JSON)** | Downloads complete database as JSON |
| **Import Full Backup (JSON)** | Uploads and restores a previous backup (overwrites current data) |
| **Export to HTML** | Generates a standalone HTML document with all notes and theme switcher |
| **Reset Database** | Clears all notes and re-seeds with demo data |

### ZIP Export (from Canvas)

Click the **Download** button on the graph canvas:
- Downloads `aethermind-<page-name>.zip`
- Contains: `graph_data.json`, `notes/*.md`, `graph.png`

### ZIP Import

Click **Import ZIP** in the header — imports notes and links from a previously exported ZIP archive. Duplicate titles get merged (tags combined, content appended).

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` / `Cmd+K` | Open Command Palette |
| `Escape` | Close modals, deselect node |
| `ArrowLeft` / `ArrowRight` | Resize sidebar (when focused on resizer) |

---

## Theming

### Preset Themes

Access via **Settings → Appearance**:

- **Dark Space** — Deep violet/cosmic (default)
- **Light Clean** — Bright, minimal
- **Sepia Warm** — Paper-like, warm tones
- **Midnight** — Ultra-dark, red accents
- **Ocean Tide** — Deep blue, teal accents
- **Custom** — Full manual color control

### Custom Theme Builder

When "Custom" theme is selected, you can configure:
- Background Color, Sidebar Background
- Text Color, Accent Color, Secondary Accent
- Connection Line Color
- Font Style (9 options including serif, monospace)

All themes persist across sessions in `localStorage`.

---

## Browser Extension

A **Web Clipper** Chrome extension is available in the `web-clipper/` directory ([install from source](https://developer.chrome.com/docs/extensions/mv3/linux/)).

**Files:**
- `manifest.json` — Extension manifest
- `popup.html` / `popup.js` — Popup UI
- `content.js` — Content script for page scraping

---

## Building for Production

```bash
npm run build
```

Output is generated in the `dist/` directory, ready for deployment on:
- **GitHub Pages** (pre-configured with `/Aethermind/` base path)
- **Netlify**, **Vercel**, **AWS S3**, or any static file server

### Preview Production Build

```bash
npm run preview
```

---

## Running Tests

```bash
# Run all tests
npm test
# or
npm run test
```

Tests are located in `src/__tests__/` and cover:
- Theme system
- Mobile responsive viewport
- Custom theme exports

**Direct test invocation:**
```bash
npx vitest run
```

---

## Project Structure

```
Aethermind/
├── public/                    # Static assets
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── __tests__/            # Unit tests
│   ├── components/           # React components
│   │   ├── settings/         # Settings tabs
│   │   └── ui/               # Reusable UI (Dropdown)
│   ├── db/                   # Dexie database schema & helpers
│   ├── hooks/                # Custom React hooks (useDebounce)
│   ├── styles/               # CSS modules
│   ├── utils/                # Utility modules
│   │   ├── aiClient.ts       # AI API client (multi-provider)
│   │   ├── aiActions.ts      # AI action parser & executor
│   │   ├── rag.ts            # RAG engine
│   │   ├── vectorSearch.ts   # Embedding generation & search
│   │   ├── snapshotManager.ts # Graph snapshots
│   │   ├── exportHtml.ts     # HTML export
│   │   ├── pdf.ts            # PDF text extraction
│   │   └── urlFetcher.ts     # URL content fetcher
│   ├── App.tsx               # Main application component
│   └── main.tsx              # Entry point
├── web-clipper/              # Chrome extension
├── tests/                    # Test runner utilities
├── index.html                # HTML entry
├── vite.config.ts            # Vite configuration
├── vitest.config.ts          # Test configuration
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
└── package.json
```

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

If you modify and distribute this software, or provide a modified version for users to interact with over a network, you must comply with the terms of the AGPLv3, including making the corresponding source code available.

See the [LICENSE](LICENSE) file for details.

---

## Built by Vibe Coding

> **AetherMind was proudly built by vibe coding with the assistance of [Antigravity AI](https://deepmind.google/technologies/gemini/).**

From deep bug resolution in legacy binary decoders to crafting fluid UI animations, orchestrating complex D3 physics, and architecting seamless Web Worker ML pipelines—vibe coding empowered the entire development lifecycle, allowing Antigravity to operate as the principal synthetic software engineer and bring this vision to life effortlessly.

---

<div align="center">
  <p>
    <strong>AetherMind</strong> — Built with React, D3.js, and love for knowledge.<br/>
    <sub>Version 1.29.2 | Local-First | Privacy by Design</sub>
  </p>
</div>
