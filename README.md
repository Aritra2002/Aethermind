<div align="center">
  <img src="https://img.shields.io/badge/AetherMind-PKM-8A2BE2?style=for-the-badge&logo=react" alt="AetherMind Logo" />
  <h1>✨ AetherMind ✨</h1>
  <p><strong>A Next-Generation, Local-First Personal Knowledge Graph</strong></p>

  <p>
    <img src="https://img.shields.io/badge/version-1.27.1-blue.svg?style=flat-square" alt="Version" />
    <img src="https://img.shields.io/badge/license-AGPLv3-red.svg?style=flat-square" alt="AGPLv3 License" />
    <img src="https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6.svg?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-Powered-646CFF.svg?style=flat-square&logo=vite" alt="Vite" />
  </p>

  <p>
    <em>Seamless synchronization, unparalleled privacy, and dynamic AI-powered insights—all living locally on your device.</em><br/>
    <strong>Fully responsive — works flawlessly on mobile, tablet, and desktop.</strong>
  </p>
</div>

---

## 👑 The Vision

**AetherMind** is not just another note-taking app. It is a robust, local-first Personal Knowledge Graph engineered to ensure your data is always yours. Combining the fluidity of a physics-based visual canvas with privacy-preserving AI integrations running directly on your machine (or through secure gateways), AetherMind helps you cultivate ideas without compromising security.

---

## ✨ Key Features & Capabilities

### 🌍 **Local-First & Offline Ready**
- **IndexedDB Core**: Your data stays strictly on your device using Dexie.js. No centralized database, no snooping.
- **PWA Ready**: Installable as a Progressive Web App (PWA) with fully offline capabilities via Service Workers.

### 🌌 **Interactive Graph Visualization**
- **D3 Force Simulation**: Explore the cosmos of your thoughts with a rich, physics-based interactive node graph.
- **Timeline Scrubber**: Travel through time using the timeline slider to visually filter and observe how your knowledge graph evolved over specific date ranges.
- **Customizable Nodes & Edges**: Color-code by category (General, Work, Personal, Ideas) and adjust physics settings (link distance, repulsion strength) for the perfect layout.

### 🧠 **Deep AI & Machine Learning Integration**
- **Semantic Clustering**: Run in-browser ML (via `Xenova/transformers.js`) to autonomously discover and link unlinked notes based on semantic similarity.
- **Document-to-Graph Generation**: Upload `.txt`, `.md`, or `.pdf` (via `pdfjs-dist`) documents. AetherMind's AI breaks down the text and automatically structures it into interconnected nodes and links on your canvas.
- **AI Co-Authoring**: Seamlessly ask the AI to expand your knowledge base. It can execute complex batch actions, generating entire interconnected sub-graphs of multiple nodes and links in a single turn.
- **"Why Connected?" AI Explanations**: Hover over any edge/link on your graph canvas to generate AI explanations of the semantic relationship between those two connected ideas.
- **Discovery Digest**: Open the app to a daily serendipitous connection bridging an old, forgotten note with a recent thought.

### 🛡️ **Flexible Intelligence Routing**
- **Local LLMs**: Seamlessly connect to LM Studio, Ollama, or llama.cpp for absolute offline privacy.
- **Cloud Providers**: Plug into OpenAI, Anthropic, or AgentRouter when you need massive frontier intelligence. 

### 📝 **Rich Editing & Organization**
- **Split-Pane Editor**: Edit in pristine Markdown with live PrismJS syntax highlighting and full GitHub-flavored markdown support.
- **Wiki-Links**: Easily link concepts by typing `[[Node Name]]`, creating instant bidirectional edges.
- **Spaced Repetition (Graph-Aware)**: Review sessions are clustered intelligently. Overdue linked neighbors are interleaved, letting you study related concepts in natural associative flows rather than pure randomness.
- **Daily Notes & Journal**: Calendar-integrated journaling for maintaining daily logs.

### 🗄️ **Data Portability & Extensibility**
- **Complete Backups**: Import/Export raw JSON data or rich ZIP archives containing graph data, raw markdown files, and canvas PNG snapshots.

---

## 🚀 Getting Started

### 1. Repository Setup

Clone the repository and install the primary frontend dependencies:

```bash
git clone https://github.com/Aritra2002/Aethermind.git
cd Aethermind
npm install
```

### 2. Ignition

Start the development server:

```bash
npm run dev
```

*   🚀 **The Web Application** will ignite on port `5173`.

---

## ⚙️ Configuration

Customize your AI endpoints by modifying the configuration template (or updating them directly in the UI Settings):

```bash
cp .env.example .env.local
```

Navigate to the **AI Integration** tab in the Settings menu to define your preferred Provider (Local, OpenAI, Anthropic) and insert your API keys.

---

## 🏗️ Building for Production

Compile a highly-optimized, static production bundle ready for deployment anywhere:

```bash
npm run build
```
The compiled assets will be generated in the `dist/` directory, primed for deployment on platforms like Vercel, Netlify, Github Pages, or AWS.

---

## 🤖 Built by Vibe Coding

> **AetherMind was proudly built by vibe coding with the assistance of [Antigravity AI](https://deepmind.google/technologies/gemini/).**

From deep bug resolution in legacy binary decoders to crafting fluid UI animations, orchestrating complex D3 physics, and architecting seamless Web Worker ML pipelines—vibe coding empowered the entire development lifecycle, allowing Antigravity to operate as the principal synthetic software engineer and bring this vision to life effortlessly.

---

## ?? License

This project is strictly protected and distributed under the **[GNU Affero General Public License v3.0 (AGPLv3)](LICENSE)**.

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3). If you modify and distribute this software, or provide a modified version for users to interact with over a network, you must comply with the terms of the AGPLv3, including making the corresponding source code available. This copyleft license helps ensure that AetherMind and its derivatives remain open source.
