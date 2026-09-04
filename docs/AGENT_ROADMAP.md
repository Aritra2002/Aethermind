# AetherMind — Engineering Roadmap & Strategic Priorities

**Status:** Strategic source of truth
**Scope:** Product direction, engineering priorities, sequencing, technical debt
**Parent policy:** `/AGENTS.md`

---

# 1. Strategic Objective

AetherMind should evolve from:

> **A feature-rich AI knowledge application**

into:

> **A trustworthy, local-first personal knowledge intelligence system.**

The goal is not maximum feature count.

The goal is maximum **useful understanding of the user's accumulated knowledge**.

---

# 2. North-Star Capability

The system should eventually be capable of:

```text
User knowledge
      ↓
Capture
      ↓
Normalize
      ↓
Understand
      ↓
Connect
      ↓
Retrieve
      ↓
Reason
      ↓
Detect gaps
      ↓
Detect contradictions
      ↓
Understand evolution
      ↓
Recommend learning
```

The resulting system should answer:

> "What do I know, how do I know it, how is it connected, how has it changed, and what should I learn next?"

---

# 3. Priority Model

Work is classified as:

### P0 — Trust / correctness / security

Must be addressed before major feature expansion.

### P1 — Core product intelligence

Builds the product's differentiation.

### P2 — Product quality

Improves usability and adoption.

### P3 — Nice-to-have

Cosmetic or secondary capabilities.

---

# 4. P0 — Security

## Threat Model

* [ ] Complete application threat model
* [ ] Identify all trust boundaries
* [ ] Identify all external data flows
* [ ] Identify all AI action capabilities

## XSS

* [ ] Audit Markdown rendering
* [ ] Audit HTML rendering
* [ ] Audit AI-generated HTML
* [ ] Audit URL previews
* [ ] Add regression tests

## Prompt Injection

* [ ] Audit RAG boundaries
* [ ] Audit imported documents
* [ ] Audit URL research
* [ ] Audit browser clipping
* [ ] Add adversarial tests

## AI Actions

* [ ] Define capability model
* [ ] Define action risk levels
* [ ] Add schema validation
* [ ] Add authorization
* [ ] Add destructive-action confirmation
* [ ] Add bulk-operation limits
* [ ] Add action audit trail

## URL Security

* [ ] Audit remote URL handling
* [ ] Determine SSRF exposure
* [ ] Validate redirects
* [ ] Restrict dangerous network targets
* [ ] Limit response size
* [ ] Validate content type

## File Security

* [ ] Add file size limits
* [ ] Validate MIME types
* [ ] Audit archive extraction
* [ ] Audit parser security
* [ ] Test malicious files

---

# 5. P0 — Data Integrity

## Database

* [ ] Document schema
* [ ] Document migrations
* [ ] Add migration tests
* [ ] Test old data
* [ ] Test corrupted records
* [ ] Test recovery

## Import

Target workflow:

```text
Select import
 ↓
Parse
 ↓
Validate
 ↓
Preview
 ↓
Create recovery point
 ↓
Resolve conflicts
 ↓
Apply
 ↓
Verify
```

Tasks:

* [ ] Import preview
* [ ] Conflict handling
* [ ] Automatic pre-import backup
* [ ] Recovery testing
* [ ] Large-import testing

## Export

* [ ] Verify JSON export
* [ ] Verify Markdown export
* [ ] Verify HTML export
* [ ] Verify archive export
* [ ] Add round-trip tests

---

# 6. P0 — Testing

* [ ] Establish CI
* [ ] Typecheck in CI
* [ ] Lint in CI
* [ ] Unit tests
* [ ] Component tests
* [ ] Integration tests
* [ ] Database tests
* [ ] RAG tests
* [ ] AI action tests
* [ ] Security tests
* [ ] Import/export tests
* [ ] Migration tests
* [ ] Critical E2E tests

---

# 7. P0 — Performance Baseline

Create representative datasets.

## Tier 1

100 notes.

## Tier 2

1,000 notes.

## Tier 3

10,000 notes.

## Tier 4

50,000 notes.

## Tier 5

100,000+ chunks.

Measure:

* [ ] initial load
* [ ] database operations
* [ ] indexing
* [ ] embedding generation
* [ ] vector search
* [ ] graph rendering
* [ ] memory usage
* [ ] snapshot cost
* [ ] import time
* [ ] export time
* [ ] mobile behavior

Do not make scalability claims before establishing measurements.

---

# 8. P1 — Knowledge Intelligence

This is the highest strategic priority after trust/security.

## Entity Extraction

* [ ] people
* [ ] organizations
* [places
* [ ] technologies
* [ ] concepts
* [ ] topics

## Concept Extraction

* [ ] identify concepts
* [ ] normalize concepts
* [ ] merge duplicates
* [ ] track aliases

## Relationship Intelligence

* [ ] semantic relationships
* [ ] relationship types
* [ ] confidence
* [ ] provenance
* [ ] temporal context

## Graph Intelligence

* [ ] meaningful edges
* [ ] semantic communities
* [ ] graph neighborhoods
* [ ] relationship explanations
* [ ] cluster summaries

---

# 9. P1 — Retrieval

Improve:

* [ ] chunking
* [ ] semantic search
* [ ] lexical search
* [ ] hybrid retrieval
* [ ] ranking
* [ ] metadata filtering
* [ ] recency signals
* [ ] relationship-aware retrieval
* [ ] source provenance

Build an evaluation dataset.

Measure:

* precision
* recall
* ranking quality
* latency

---

# 10. P1 — Knowledge Evolution

AetherMind should understand that knowledge changes.

Build toward:

* [ ] concept timelines
* [ ] belief evolution
* [ ] source evolution
* [ ] historical snapshots
* [ ] temporal relationships
* [ ] changed assumptions
* [ ] emerging topics

Avoid falsely treating historical information as current truth.

---

# 11. P1 — Contradiction Detection

Build toward identifying:

* [ ] direct contradictions
* [ ] contextual differences
* [ ] temporal contradictions
* [ ] uncertain conflicts
* [ ] unsupported claims

Every detected contradiction should provide evidence.

---

# 12. P1 — Knowledge Gap Detection

Potential signals:

* [ ] unanswered questions
* [ ] weakly connected concepts
* [ ] repeated unresolved topics
* [ ] missing source coverage
* [ ] incomplete concept clusters
* [ ] poor retrieval confidence

The system must not manufacture gaps merely to appear intelligent.

---

# 13. P1 — Intelligent Discovery

Build toward:

> "What should I explore next?"

Potential signals:

* recent interests
* recurring concepts
* weak connections
* knowledge gaps
* contradictions
* neglected topics
* changing interests

Recommendations should explain why they were generated.

---

# 14. P1 — AI Agent Safety

Implement:

* [ ] capability system
* [ ] action schemas
* [ ] permission validation
* [ ] risk classification
* [ ] destructive confirmation
* [ ] bulk-operation limits
* [ ] action audit
* [ ] rollback/recovery where practical
* [ ] prompt-injection evaluation

---

# 15. P1 — Ingestion

Make importing knowledge easy.

Target sources:

* [ ] Markdown
* [ ] Obsidian
* [ ] Notion export
* [ ] browser bookmarks
* [ ] web pages
* [ ] PDF
* [ ] DOCX
* [ ] PPTX
* [ ] CSV
* [ ] browser extension

Preserve provenance.

---

# 16. P1 — Source Provenance

Every imported or externally derived piece of knowledge should preserve appropriate metadata.

Potential metadata:

* source
* URL
* title
* author
* date
* import time
* document ID
* note ID
* original location

Never fabricate provenance.

---

# 17. P2 — User Experience

## Onboarding

* [ ] explain local-first architecture
* [ ] explain AI privacy modes
* [ ] make first import easy
* [ ] demonstrate core value quickly

## Mobile

* [ ] test real mobile layouts
* [ ] optimize capture
* [ ] optimize search
* [ ] optimize navigation
* [ ] verify graph interaction

## Accessibility

* [ ] keyboard
* [ ] screen reader
* [ ] contrast
* [ ] focus
* [ ] reduced motion
* [ ] touch targets

---

# 18. P2 — Reliability UX

Improve:

* [ ] loading states
* [ ] empty states
* [ ] offline states
* [ ] AI provider failures
* [ ] import failures
* [ ] recovery workflows
* [ ] error explanations

---

# 19. P3 — Cosmetic Features

Only after core quality is strong:

* [ ] additional themes
* [ ] decorative animations
* [ ] graph cosmetics
* [ ] additional customization
* [ ] novelty productivity features

These must not displace P0/P1 work.

---

# 20. Anti-Roadmap

Do not automatically build:

* another AI provider
* another theme
* another graph effect
* another export format
* another generic productivity feature

A feature must justify:

```text
User value
+
Strategic value
+
Maintenance cost
+
Security cost
+
Performance cost
```

---

# 21. Strategic Killer Demo

The strongest demonstration should eventually look like:

```text
Import hundreds/thousands of real knowledge items
              ↓
AetherMind understands concepts
              ↓
Builds meaningful relationships
              ↓
Creates semantic clusters
              ↓
Finds contradictions
              ↓
Finds knowledge gaps
              ↓
Shows how knowledge evolved
              ↓
User asks a natural-language question
              ↓
AetherMind retrieves evidence
              ↓
Answer includes provenance
              ↓
User explores the graph/timeline
              ↓
AetherMind recommends what to investigate next
```

This is more strategically valuable than demonstrating the number of UI features.

---

# 22. Production Readiness Gate

Do not call the product production-grade until there is credible evidence for:

### Security

* [ ] threat model
* [ ] XSS review
* [ ] prompt injection review
* [ ] URL/SSRF review
* [ ] file security review
* [ ] secret handling review

### Data

* [ ] migration safety
* [ ] backup/restore
* [ ] import/export
* [ ] corruption recovery

### Quality

* [ ] automated tests
* [ ] CI
* [ ] regression tests
* [ ] E2E coverage

### Performance

* [ ] benchmark dataset
* [ ] large-data tests
* [ ] mobile tests

### AI

* [ ] action authorization
* [ ] RAG evaluation
* [ ] hallucination controls
* [ ] provider failure handling

### UX

* [ ] onboarding
* [ ] accessibility
* [ ] offline behavior
* [ ] error/recovery flows

---

# 23. Strategic Definition of Success

AetherMind succeeds when users stop thinking:

> "This is a nice place to store my notes."

and start thinking:

> **"AetherMind understands my knowledge better than I can navigate it myself."**

That is the product worth building.