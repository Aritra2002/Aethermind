# Tutorial: Getting Started with AetherMind

Welcome to **AetherMind**, a local-first personal knowledge graph and thinking environment. This tutorial guides you from launching the app to mastering your first connected web of notes in under 10 minutes.

---

## 1. The Workspace

When you launch AetherMind, you'll see:
- **Header Dock**: Quick actions for search (`⌘K`), Spaced Repetition (`🧠`), AI Copilot (`✨`), Today's Daily Note (`📅`), Document Ingestion, and Settings (`⚙️`).
- **Interactive Force Graph (Left Panel)**: A dynamic 2D canvas displaying your thoughts as glowing nodes and synapses.
- **Note Editor (Right Panel)**: A rich Markdown editor with live preview, wikilink auto-complete, and AI connection discovery.

---

## 2. Creating Your First Note

There are three ways to create a note:
1. **Double-Click**: Double-click anywhere on the empty graph canvas. A new note is placed exactly at your cursor.
2. **Keyboard Shortcut**: Press `⌘N` (or `Ctrl+N`) to create a blank note.
3. **Header Button**: Click the **New Page (+)** button in the top navigation bar.

Give your note a title (e.g. `Quantum Computing`) and add some bullet points in Markdown:
```markdown
# Quantum Computing Fundamentals
- Qubits leverage superposition and entanglement.
- Key algorithms: Shor's algorithm, Grover's algorithm.
```

---

## 3. Creating Contextual Connections (Wikilinks)

Knowledge builds through connection. Link to another note simply by wrapping its title in double brackets:
```markdown
Qubits require [[Superposition]] and [[Quantum Entanglement]] to process complex quantum states.
```
- If the linked note already exists, AetherMind draws an animated synapse line between them.
- If the linked note doesn't exist yet, clicking the link creates it immediately!

---

## 4. Organizing with Node Types & Tags

1. Select a note to open the Editor Panel.
2. Choose a **Category** (General, Work, Personal, Ideas, or a custom type). The node on the graph changes color immediately.
3. Add **Tags** (e.g., `#physics`, `#research`) to filter notes via the Search bar.

---

## 5. Reviewing Flashcards with Spaced Repetition

AetherMind automatically schedules notes for review using the SM-2 spaced repetition algorithm:
1. Click **Review (🧠)** in the top header dock.
2. Read the prompt and recall the key ideas.
3. Click **Show Answer** and grade your recall:
   - **Again (1m)**: Need to relearn.
   - **Hard (1.2x)**: Remembered with effort.
   - **Good (2.5x)**: Normal retention.
   - **Easy (3.5x)**: Mastered concept.

---

## Next Steps
- Read [HOW_TO.md](./HOW_TO.md) for importing PDFs, customizing color themes, and saving graph snapshots.
- Read [REFERENCE.md](./REFERENCE.md) for full keyboard shortcuts and CSS token references.
