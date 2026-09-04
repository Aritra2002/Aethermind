# AetherMind — Architecture Agent Guide

## 1. Purpose

This document defines architectural principles for AetherMind.

The architecture must support:

* local-first operation
* user-owned data
* AI-assisted knowledge management
* reliable retrieval
* knowledge graphs
* offline functionality
* multiple AI providers
* safe AI actions
* long-term maintainability
* realistic knowledge-base scale

---

# 2. Conceptual Architecture

The preferred conceptual flow is:

```text
                 ┌─────────────────────┐
                 │       UI Layer      │
                 │ React / Components  │
                 └──────────┬──────────┘
                            │
                 ┌──────────▼──────────┐
                 │ Application Layer   │
                 │ hooks / services    │
                 └───────┬───────┬─────┘
                         │       │
              ┌──────────▼──┐ ┌──▼─────────────┐
              │ Local Data   │ │ AI Abstraction │
              │ IndexedDB    │ │ Provider Layer │
              └──────┬───────┘ └──────┬────────┘
                     │                 │
              ┌──────▼──────┐    ┌────▼─────────┐
              │ RAG / Graph │    │ AI Providers │
              │ Intelligence│    │ Local/Cloud  │
              └─────────────┘    └──────────────┘
```

Do not collapse these boundaries without a strong reason.

---

# 3. Layer Responsibilities

## UI

Responsible for:

* presentation
* interaction
* accessibility
* loading states
* error states

UI components should not contain substantial database or provider-specific business logic.

---

## Application Layer

Responsible for:

* workflows
* orchestration
* validation
* business rules
* state transitions

---

## Data Layer

Responsible for:

* persistence
* schema
* migrations
* queries
* transactions where available
* backup/recovery

The data layer should not depend on UI components.

---

## AI Layer

Responsible for:

* provider abstraction
* model requests
* structured output
* RAG
* embeddings
* AI action proposals
* AI-specific validation

Provider-specific implementation should remain isolated.

---

# 4. Local-First Boundary

The application should work without network access for core knowledge functionality.

Core local functionality includes:

* reading notes
* editing notes
* searching local knowledge
* graph navigation where data is local
* local persistence
* local exports
* local imports
* snapshots

Optional network-dependent functionality includes:

* cloud LLMs
* remote URL research
* remote AI embeddings
* external APIs

Never make optional network features silently mandatory.

---

# 5. Database Principles

User data is durable product state.

Schema changes must consider:

* existing users
* older application versions
* incomplete migrations
* corrupted records
* partial imports
* backup restoration

Prefer versioned migrations.

Never silently discard unknown fields unless explicitly justified.

---

# 6. RAG Architecture

Conceptually:

```text
Document
 ↓
Normalize
 ↓
Chunk
 ↓
Metadata
 ↓
Embedding
 ↓
Vector storage
 ↓
Retrieval
 ↓
Ranking
 ↓
Context construction
 ↓
LLM
```

Each stage should have explicit failure behavior.

Do not hide indexing failures.

---

# 7. Graph Architecture

The graph should represent meaningful knowledge relationships.

Nodes may represent:

* notes
* concepts
* entities
* sources
* topics

Edges may represent:

* related
* supports
* contradicts
* derived-from
* depends-on
* example-of
* broader-than
* narrower-than

Do not create edges simply because two strings are semantically similar.

Where possible, retain:

* relationship type
* confidence
* source/provenance
* creation/update time

---

# 8. AI Action Architecture

Preferred architecture:

```text
User request
     ↓
LLM
     ↓
Structured proposal
     ↓
Schema validation
     ↓
Capability validation
     ↓
Application authorization
     ↓
User confirmation if required
     ↓
Execution
     ↓
State verification
```

The model must never directly mutate arbitrary state.

---

# 9. Provider Architecture

Prefer:

```text
Application
    ↓
AI interface
    ↓
Provider adapter
    ↓
OpenAI / Anthropic / Gemini / etc.
```

Provider-specific behavior must not leak into unrelated application code.

Do not hard-code current model names without verification.

---

# 10. Dependency Rules

Before adding a dependency:

* search for existing functionality
* check compatibility
* check maintenance
* check security
* check licensing
* check bundle/runtime impact

Avoid redundant libraries.

Particularly avoid overlapping UI/design systems unless there is a documented reason.

---

# 11. Performance Architecture

Performance-critical work must be measured.

Potential pressure points:

* IndexedDB
* embeddings
* vector search
* graph rendering
* snapshots
* document parsing
* large imports
* browser memory
* local ML inference

Do not prematurely optimize.

Do benchmark when scale becomes relevant.

---

# 12. Architectural Decision Rule

When several designs are possible, evaluate:

1. correctness
2. security
3. data integrity
4. local-first compatibility
5. performance
6. maintainability
7. complexity
8. UX

Choose the simplest design that satisfies the requirements.

Do not choose architecture merely because it is fashionable.