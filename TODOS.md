# AetherMind — TODOS

_Last updated: 2026-07-04_

---

## v1.22.0 — AI Intelligence Layer

- [ ] **AI Connection Discovery** — After saving/editing a note, AI silently scans for existing notes that might be related and surfaces them: "This note might connect to X and Y — add links?" Runs as background effect after note save. Calls AI with a short context window comparing new note against existing summaries.

- [ ] **"Why Connected?" Edge Explanation** — Hover over any graph edge → tooltip appears with one AI-generated sentence explaining the relationship between those two nodes. On-demand generation, cached per edge pair.

- [ ] **Daily Discovery Digest** — On app open (once per day), surface one surprising connection: "Your note on X from 3 months ago connects to what you added yesterday — see?" Drives re-engagement with older notes and builds graph density passively.

- [ ] **Voice Input → Node** — Press mic button, speak a thought, AI creates the node. MediaRecorder API + Whisper (local) or SpeechRecognition API.

- [ ] **Spaced Repetition Enhancement** — Graph-aware review ordering: review notes that connect to recently-reviewed notes first, building mental clusters.

---

## Future Ideas (Parking Lot)

- [ ] Share graph as live URL (read-only public view)
- [ ] Collaborative graphs (multi-user with y-websocket backend — partially implemented in sync-server branch)
- [ ] Export graph to academic citation format (BibTeX, Zotero RDF)
- [ ] Edge thickness = reference frequency (heavier edges for strongly connected nodes)
- [ ] "Surprise me" button — AI highlights most unexpected connection in graph
- [ ] Node strength heatmap — color intensity based on edit frequency
