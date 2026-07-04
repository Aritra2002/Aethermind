<div align="center">
  <img src="https://img.shields.io/badge/AetherMind-PKM-8A2BE2?style=for-the-badge&logo=react" alt="AetherMind Logo" />
  <h1>✨ AetherMind ✨</h1>
  <p><strong>A Next-Generation, Local-First Personal Knowledge Graph</strong></p>

  <p>
    <img src="https://img.shields.io/badge/version-1.21.0-blue.svg?style=flat-square" alt="Version" />
    <img src="https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6.svg?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-Powered-646CFF.svg?style=flat-square&logo=vite" alt="Vite" />
  </p>

  <p>
    <em>Seamless synchronization, unparalleled privacy, and dynamic AI-powered insights—all living locally on your device.</em><br/>
    <strong>Fully responsive — works on any phone, tablet, or desktop.</strong>
  </p>
</div>

---

## 👑 The Vision

**AetherMind** is not just another note-taking app. It is a robust, local-first Personal Knowledge Graph engineered with CRDTs to ensure your data is always yours. With deep, privacy-preserving AI integrations running directly on your machine or through secure proxies, AetherMind helps you cultivate ideas without compromising security.

---

## ✨ Premium Features

*   🌍 **Local-First Architecture**: Your data stays on your device and operates effortlessly without a centralized database.
*   🧠 **Deep AI Integration**: Harness local AI models via `@xenova/transformers` for capabilities like Voice Dictation, Text-to-Speech, and smart semantic organization.
*   🛡️ **Advanced AI Proxy Gateway**: Built-in backend proxy effortlessly bypasses strict WAF firewalls (e.g., AgentRouter, OpenRouter) by spoofing authorized client headers, giving you ultimate flexibility between local and cloud LLMs.
*   🌌 **Interactive Graph Visualization**: Explore the cosmos of your thoughts with a rich, physics-based interactive node graph.
*   📱 **Adaptive Responsive UI**: A meticulously crafted interface boasting fluid animations, glowing glassmorphism, and seamless mobile-to-desktop responsiveness.
*   🔌 **Dynamic Plugin Ecosystem**: Dynamically load external JavaScript plugins to effortlessly extend your workspace functionality.

---

## 🚀 Getting Started

### 1. Master Repository Setup

Clone the repository and install the primary frontend dependencies:

```bash
git clone https://github.com/your-repo/personal-knowledge-graph.git
cd personal-knowledge-graph
npm install
```

### 2. Ignition

Start the development server:

```bash
npm run dev
```

*   🚀 **The Web Application** will ignite on port `5173`.

---

## ⚙️ Configuration & Architecture

Customize your environment by copying the configuration template:

```bash
cp .env.example .env.local
```

### Connecting to AI Providers
AetherMind's proxy gateway gives you absolute control over your intelligence layer:
1.  **Local LLMs:** Connect directly to LM Studio, Ollama, or llama.cpp for total offline privacy.
2.  **Cloud Providers:** Connect to OpenAI, Anthropic, or AgentRouter. Navigate to the **AI Provider** tab in the Settings menu to configure endpoints and API keys.

---

## 🏗️ Building for Production

Compile a highly-optimized, static production bundle ready for deployment anywhere:

```bash
npm run build
```
The compiled assets will be generated in the `dist/` directory, primed for deployment on platforms like Vercel, Netlify, or AWS.

---

## 🤖 Built by Vibe Coding

> **AetherMind was proudly built by vibe coding with the assistance of [Antigravity AI](https://deepmind.google/technologies/gemini/).**

From deep bug resolution in legacy binary decoders to crafting fluid UI animations and architecting proxy bypass networks, vibe coding empowered the entire development lifecycle, allowing Antigravity to operate as the principal synthetic software engineer and bring this vision to life effortlessly.
