# 🌌 AetherMind

Welcome to **AetherMind**, a Local-First Personal Knowledge Graph!

AetherMind is designed to keep your thoughts organized while ensuring your data stays private and effortlessly synced across your devices. By leveraging Conflict-free Replicated Data Types (CRDTs) and local AI models, AetherMind brings you a powerful, seamless, and privacy-preserving knowledge management experience.

---

## ✨ Features and Functionalities

- **Local-First Architecture:** Built on top of `yjs` and `y-websocket` to ensure your data stays on your device and syncs effortlessly without relying on central servers.
- **AI-Powered Capabilities:** Integrates local AI models via `@xenova/transformers` for smart features like Text-to-Speech, Voice Dictation, and intelligent organization.
- **Interactive Graph Visualization:** Explore your knowledge base through a rich, interactive node-based graph view.
- **Plugin Ecosystem:** Dynamically load external JavaScript plugins to extend and customize your workspace.
- **Markdown & Rich Text Support:** Enjoy full support for standard markdown, bidirectional linking (`[[Note Name]]`), code blocks, lists, and more.

---

## 🛠 Dependencies and Requirements

Before you get started, please ensure your system meets the following requirements:

- **Node.js:** v18 or higher is recommended.
- **Package Manager:** npm or yarn.

---

## 🚀 Installation Instructions

Getting AetherMind up and running is quick and easy! Just follow these steps:

### 1. Set Up the Web Application

First, navigate to the project root directory and install the necessary dependencies:

```bash
npm install
```

Next, start the Vite development server:

```bash
npm run dev
```

### 2. Set Up the Sync Server (Optional)

While optional, running the sync server is highly recommended if you want to seamlessly synchronize your data across multiple devices. AetherMind includes a dedicated `y-websocket` synchronization server located in the `sync-server` directory.

Navigate to the sync server directory and install its dependencies:

```bash
cd sync-server
npm install
```

Start the sync server:

```bash
npm start
```

*Note: The sync server runs on port `1234` by default.*

---

## 📖 Usage Guidelines

Once both the web application and sync server (optional) are running:

1. Open your browser and navigate to the local URL provided by Vite (typically `http://localhost:5173`).
2. Start creating notes using standard Markdown.
3. Use `[[Double Brackets]]` to create bidirectional links between your notes.
4. Switch to the Graph View to see how your thoughts are interconnected.

### Configuration

You can easily configure AetherMind using environment variables. To do this, copy the provided example configuration file:

```bash
cp .env.example .env.local
```

You can then adjust the values (such as `VITE_SYNC_SERVER_URL` or `VITE_AI_GATEWAY_URL`) in `.env.local` to match your specific setup.

### Building for Production

If you want to create a production-ready build of the web application, simply run:

```bash
npm run build
```

This command generates static files in the `dist` directory, which can be deployed to any static hosting service like Vercel, Netlify, or GitHub Pages.

---

## 🛸 Acknowledgment

This project was proudly built using **antigravity**. We are grateful for the powerful capabilities and inspiration it provided during the development of AetherMind!

---

## 📫 Contact and Support

If you have any questions, run into issues, or just want to share your feedback, we'd love to hear from you!

- **Issue Tracker:** Please report bugs or request features via our [GitHub Issues](#) page.
- **Community:** Join the discussion and connect with other users in our [Community Forum](#).

Happy note-taking with AetherMind! 🚀
