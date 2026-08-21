# AETHER MIND — AGENT OPERATING CONTRACT

You are working inside the local `Aethermind` project.

The local project is the source of truth. Never replace, reset, clone over, or discard it.

---

## 0. MANDATORY SKILL PROTOCOL

**NO WORK MAY BEGIN WITHOUT THIS STEP.**

Before every task, including small changes:

1. Inspect all available agent skills/instructions relevant to this task.
2. Identify every applicable skill.
3. Read/use every applicable skill.
4. Follow their instructions throughout the task.
5. If a skill conflicts with this file, follow the higher-priority system/developer instruction.
6. If no skill applies, explicitly continue using the engineering rules in this file.

Do not skip the skill check because a task appears simple.

Before modifying code, establish:

**Task → Applicable Skills → Relevant Files → Plan → Implementation → Verification**

---

# 1. PRODUCT

AetherMind is a local-first AI knowledge management system.

Core pillars:

**Capture → Organize → Connect → Retrieve → Understand → Review → Discover**

Existing major capabilities include:

* Markdown notes/editor
* wiki links/backlinks
* pages
* knowledge graph/D3
* semantic search
* embeddings/vector search
* RAG
* multiple AI providers/local AI
* AI actions
* document ingestion
* URL research
* discovery
* spaced repetition
* snapshots/history
* import/export
* PWA/offline
* browser clipper
* themes

Do not blindly add features.

Make the existing product coherent, reliable, fast, secure and polished.

---

# 2. SOURCE OF TRUTH

Inspect actual source code.

Do not assume README/documentation is accurate.

Before changing a subsystem, understand:

**UI → state → domain logic → persistence → indexing/RAG → AI → external services**

Do not perform blind rewrites.

Prefer incremental, justified refactoring.

---

# 3. DATA SAFETY — HIGHEST PRIORITY

Never silently destroy user data.

Protect:

* notes
* pages
* links
* tags
* documents
* embeddings
* snapshots
* metadata

Database changes require migrations.

Imports require validation, preview/conflict handling and rollback where practical.

Destructive operations should be recoverable where practical.

Never reset the user's Git working tree or discard unrelated changes.

---

# 4. SECURITY

Treat all external content as untrusted:

* Markdown
* HTML
* imported files
* PDFs/DOCX/PPTX
* webpages
* URLs
* browser-clipper data
* AI output

Audit for:

* XSS
* prompt injection
* SSRF
* unsafe URL fetching
* malicious imports
* oversized/decompression attacks
* secret/API-key exposure
* unsafe AI mutations

Never trust AI output as executable authority.

Security must be enforced programmatically.

---

# 5. AI SAFETY

AI actions must follow:

**LLM output → schema validation → semantic validation → target validation → risk classification → preview/confirmation → transaction → execution → undo/history**

Use strict runtime schemas and discriminated action types.

Classify actions:

* READ
* LOW-RISK WRITE
* HIGH-RISK WRITE
* DESTRUCTIVE

High-risk/destructive actions require user confirmation.

AI-generated edits should provide diffs.

AI should receive only necessary context.

Users should understand what information is sent to remote AI providers.

---

# 6. KNOWN ARCHITECTURAL TARGETS

Important existing areas include:

* `src/App.tsx`
* `src/components/`
* `src/db/`
* `src/hooks/`
* `src/utils/aiClient.ts`
* `src/utils/aiActions.ts`
* `src/utils/rag.ts`
* `src/utils/vectorSearch.ts`
* `src/utils/snapshotManager.ts`
* `src/utils/urlFetcher.ts`
* `src/styles/`
* `web-clipper/`

Known improvement directions:

### AI client

Break the large provider implementation into clean provider adapters and normalized interfaces.

### AI actions

Replace loose action parsing with strict runtime validation, permissions, risk classification, previews and undo.

### RAG

Use:

**ingestion → normalization → chunking → metadata → embedding → indexing → retrieval → ranking → context → generation → citations**

### Vector search

Move away from expensive whole-database scans toward incremental indexing, batching, caching, filtering and scalable retrieval.

### Database

Improve migrations, transactions, indexes, relationship integrity, recovery and persistence abstractions.

### UI

The project currently mixes Tailwind, Bootstrap and custom CSS. Do not add another styling system. Move toward one coherent design system incrementally.

---

# 7. CORE UX

AetherMind should feel:

**calm, intelligent, fast, premium, focused, trustworthy.**

Prioritize:

* clarity
* progressive disclosure
* keyboard-first workflows
* contextual actions
* fast capture
* excellent search
* meaningful loading/error/empty states
* undo
* responsive behavior
* accessibility

Avoid:

* feature clutter
* unnecessary modals
* excessive gradients/glows
* decorative animation
* unexplained icons
* hidden destructive actions
* uncontrolled AI behavior

---

# 8. EDITOR

Protect typing performance and autosave.

Improve:

* Markdown
* wiki-link autocomplete
* backlinks
* slash commands
* keyboard shortcuts
* selection
* paste
* formatting
* code
* tables
* tasks
* attachments
* contextual AI

Clearly communicate:

**Saving / Saved / Unsaved / Offline / Error**

Never silently lose edits.

---

# 9. SEARCH / RAG

Build toward:

* keyword search
* full-text search
* semantic search
* fuzzy search
* metadata filters
* hybrid retrieval
* ranking/reranking
* source provenance
* citations
* stale-index detection
* background indexing

Optimize retrieval quality, not merely AI generation.

---

# 10. GRAPH

Keep D3 unless evidence justifies replacement.

Improve:

* performance
* zoom/pan
* filtering
* focus mode
* search
* neighborhood exploration
* paths
* clusters
* semantic relationships
* timeline
* graph statistics
* large-graph behavior

Clearly distinguish explicit user links from AI/semantic relationships.

---

# 11. DOCUMENTS / WEB / CLIPPER

Ingestion must support clear:

**upload → extract → parse → chunk → embed → index → complete**

Provide progress, cancellation, retry and useful errors.

URL fetching must defend against SSRF, dangerous redirects, private networks, huge responses and malicious content.

Browser clipper should remain minimal-permission and reliable.

---

# 12. IMPORT / EXPORT / HISTORY

Portability is essential.

Exports should be complete, versioned, deterministic and secret-free.

Imports require validation and safe conflict handling.

Snapshots/history should support viewing, comparison and recovery.

---

# 13. MOBILE / ACCESSIBILITY

Mobile is not a shrunken desktop.

Prioritize:

**Capture → Search → Notes → AI**

Support:

* touch
* keyboard
* visible focus
* screen readers
* contrast
* reduced motion
* safe areas
* keyboard-aware layouts

Every icon-only action needs an accessible name.

---

# 14. PERFORMANCE

Design for large vaults.

Pay special attention to:

* graph rendering
* React re-renders
* IndexedDB
* embeddings
* RAG
* document parsing
* search
* AI streaming
* large notes

Use workers, batching, virtualization, caching and lazy loading when justified by measurement.

---

# 15. TESTING

Meaningful changes require appropriate tests.

Prioritize:

* database/migrations
* note lifecycle
* wiki links
* search
* RAG
* embeddings
* AI actions/security
* import/export
* snapshots
* destructive operations
* accessibility
* critical user journeys

Before completion, run appropriate:

**typecheck → lint → tests → build**

Fix failures rather than hiding them.

---

# 16. WORK PHASES

Work in this order unless dependency/safety requires otherwise:

1. Security + data integrity
2. Database + architecture
3. Notes + editor
4. Search + RAG
5. AI platform + AI actions
6. Graph
7. Documents + research + clipper
8. Import/export + history
9. UI/design system
10. Mobile + accessibility
11. Performance
12. Testing + QA
13. Final polish

Do not attempt an uncontrolled full rewrite.

---

# 17. DISCOVERY DURING WORK

Do not artificially limit findings.

If you discover a real problem:

* fix it immediately if it is critical to the current task;
* otherwise record it for the correct future phase.

Do not derail focused work with unrelated rewrites.

Every change must be justified by evidence from the codebase.

---

# 18. DEFINITION OF DONE

A task is not complete merely because the code compiles.

Before declaring completion:

1. Skill protocol completed.
2. Relevant code inspected.
3. Implementation completed.
4. Tests/typecheck/lint/build run as appropriate.
5. Regression risks reviewed.
6. UX/accessibility/security considered.
7. User data safety verified.
8. Changes documented when meaningful.

**Quality > feature count.
Correctness > speed.
Data safety > convenience.
User control > AI autonomy.**
