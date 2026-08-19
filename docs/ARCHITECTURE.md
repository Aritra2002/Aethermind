# System Architecture & Technical Design

An in-depth explanation of **AetherMind**'s local-first architecture, D3 force-directed simulation, vector retrieval engine, and rendering lifecycle.

---

## 1. High-Level Architectural Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          AetherMind Client                             │
├────────────────────────────────┬───────────────────────────────────────┤
│        UI & Interaction Layer  │        Data & Engine Layer            │
│  - React 19 + Framer Motion    │  - Dexie.js (IndexedDB Storage)       │
│  - D3.js Force Simulation      │  - Client RAG & Vector Embeddings     │
│  - Semantic CSS Variable Bus   │  - Transformers.js (Local ML Worker)  │
│  - Lucide Icons + Marked.js    │  - Pluggable Multi-Provider AI Engine │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Local-First IndexedDB Schema (Dexie.js)

All user notes, wikilinks, categories, pages, and time-travel snapshots are stored client-side in the browser via `Dexie`:

```typescript
class AetherMindDB extends Dexie {
  notes!: Table<Note, number>;
  links!: Table<Link, number>;
  categories!: Table<Category, string>;
  pages!: Table<Page, number>;
  snapshots!: Table<Snapshot, number>;
  documents!: Table<IngestedDoc, number>;
}
```

- **Zero-Cloud Dependency**: Completely operational without network access.
- **Reactive Queries**: Components use `useLiveQuery` for real-time reactivity without state synchronization overhead.

---

## 3. D3.js Force-Directed Simulation Pipeline

The knowledge graph runs a continuous D3 simulation with:
- **`forceLink`**: Pulls connected wikilinked nodes together based on dynamic link distance.
- **`forceManyBody`**: Repels nodes to prevent overlaps (configured via physics sliders).
- **`forceCenter`**: Anchors the graph to the canvas center.
- **`forceCollide`**: Prevents node boundary intersections.

### Rendering Loop
- The canvas render loop runs inside a `requestAnimationFrame` loop.
- Calls `ctx.clearRect(0, 0, width, height)` so transparent backgrounds allow active theme CSS variables to show through.
- Nodes render animated pulse blooms via `ctx.shadowBlur` and `ctx.shadowColor` with alpha decay.

---

## 4. Theme & Luminance Engine

AetherMind features dynamic theme reactivity:
1. **Preset Themes**: Set via `html[data-theme="..."]` selectors in `src/styles/base.css`.
2. **Custom Themes**: Injected inline onto `document.documentElement.style`.
3. **Dynamic Luminance**:
   $$\text{Luminance} = \frac{0.299R + 0.587G + 0.114B}{255}$$
   If $\text{Luminance} > 0.5$, sets `color-scheme: light` and applies dark contrasting text, pills, and grid lines. If $\le 0.5$, sets `color-scheme: dark`.
4. **Clean Reset**: Switching back to preset themes systematically removes all inline CSS variables.
