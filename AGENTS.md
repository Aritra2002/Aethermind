# AetherMind — Agent Operating Contract

## Mission

AetherMind is a **local-first, AI-native personal knowledge operating system**.

Its purpose is not to become another generic notes app, chatbot, or feature collection.

The long-term product goal is:

> AetherMind should understand a person's accumulated knowledge, the relationships between concepts, how their thinking evolves, what they do not know, and where their knowledge conflicts.

Every engineering decision should strengthen:

* knowledge understanding
* knowledge retrieval
* knowledge relationships
* knowledge evolution
* privacy and user ownership
* AI reliability
* security
* performance
* maintainability

---

# 1. NON-NEGOTIABLE RULES

## Never hallucinate repository facts

Never assume that:

* a file exists
* a function exists
* a package is installed
* an API behaves a certain way
* a feature is implemented
* a test passes
* a security property exists
* a command works

Inspect and verify.

If something cannot be verified, say:

> UNVERIFIED: ...

Never turn an assumption into a fact.

---

## Never hallucinate external facts

For current APIs, libraries, frameworks, browser behavior, security practices, model capabilities, provider APIs, or anything time-sensitive:

1. Research it.
2. Prefer authoritative sources.
3. Check the installed version where applicable.
4. Verify against the actual implementation.
5. Record important conclusions.

Never rely on model memory when verification is practical.

---

## Research before implementation

When uncertain:

```text
STOP
 ↓
INSPECT
 ↓
RESEARCH
 ↓
VERIFY
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
TEST
```

Do not guess.

---

## Ask when necessary

Stop and ask the user when:

* requirements conflict
* requirements are materially ambiguous
* a destructive operation is required
* data could be lost
* credentials are needed
* an external service must be selected
* security boundaries are unclear
* multiple implementations have materially different consequences

Do not invent requirements simply to avoid asking.

---

# 2. FIRST ACTION ON EVERY TASK

Before modifying code:

1. Read `AGENTS.md`.
2. Inspect git status.
3. Inspect repository structure.
4. Read relevant documentation.
5. Search for existing implementations.
6. Inspect package/runtime versions.
7. Identify relevant tests.
8. Identify available skills/tools.
9. Determine security implications.
10. Research uncertain areas.
11. Create a concise implementation plan.
12. Then modify code.

Do not blindly start editing.

---

# 3. SOURCE-OF-TRUTH ORDER

When sources conflict, prefer:

1. Current user requirement
2. Applicable system/developer/agent instructions
3. Current working implementation
4. Tests
5. Agent architecture/security/product documents
6. Official dependency/API documentation
7. README
8. Historical comments/code
9. Third-party articles
10. Agent memory

Current verified evidence beats memory.

---

# 4. REQUIRED DOCUMENTATION

Consult the appropriate document before relevant work:

* `docs/AGENT_ARCHITECTURE.md`
* `docs/AGENT_PRODUCT.md`
* `docs/AGENT_SECURITY.md`
* `docs/AGENT_AI.md`
* `docs/AGENT_QUALITY.md`
* `docs/AGENT_RESEARCH.md`
* `docs/AGENT_ROADMAP.md`

Do not load every document unnecessarily.

Read the documents relevant to the task.

---

# 5. PRODUCT PRIORITIES

Priority order:

### P0

* security
* data integrity
* privacy
* correctness
* AI action safety
* database reliability
* migrations
* import/export integrity
* critical performance
* testing infrastructure

### P1

* knowledge extraction
* semantic retrieval
* relationship detection
* graph intelligence
* temporal reasoning
* contradiction detection
* knowledge-gap detection
* source provenance
* intelligent discovery
* AI-assisted knowledge maintenance

### P2

* onboarding
* mobile UX
* accessibility
* browser ingestion
* performance refinement

### P3

* cosmetic customization
* excessive animation
* novelty features
* low-value convenience features

Do not sacrifice P0/P1 quality to add P3 features.

---

# 6. LOCAL-FIRST

AetherMind must preserve user ownership.

Distinguish between:

* local data
* local inference
* cloud inference
* remote content retrieval
* third-party processing

Cloud AI is optional.

Core knowledge must remain useful when AI providers or network access are unavailable.

Any feature that sends user information outside the local environment must have an explicit data-flow.

---

# 7. AI SAFETY

LLMs are untrusted components.

They can:

* hallucinate
* misunderstand
* produce invalid structured data
* follow prompt injection
* select unsafe actions
* invent citations
* misinterpret retrieved information

The application must enforce:

* schemas
* validation
* permissions
* capabilities
* rate/size limits
* action restrictions
* data integrity

The model proposes.

The application decides.

---

# 8. UNTRUSTED CONTENT

Treat all of these as untrusted:

* notes
* Markdown
* PDFs
* DOCX
* PPTX
* CSV
* websites
* browser-clipped content
* imported files
* RAG context
* AI-generated content

Never allow retrieved content to become authoritative instructions.

Maintain strict separation between:

```text
Application instructions
User instructions
Retrieved data
Model output
Application state
```

---

# 9. DATA SAFETY

Never casually introduce:

* destructive migrations
* silent deletion
* lossy imports
* lossy exports
* irreversible AI edits
* unversioned schema changes

Prefer:

```text
Inspect
→ Preview
→ Validate
→ Backup
→ Apply
→ Verify
```

for destructive or high-risk operations.

---

# 10. PERFORMANCE

Do not make scalability claims without measurements.

Consider realistic datasets:

* 100 notes
* 1,000 notes
* 10,000 notes
* 50,000 notes
* 100,000+ chunks

Measure where relevant:

* startup
* database operations
* indexing
* embeddings
* retrieval
* graph rendering
* memory
* snapshots
* import/export
* mobile performance

---

# 11. TESTING

Meaningful behavior requires meaningful validation.

Use the smallest relevant validation first:

```text
Unit test
→ Integration test
→ Typecheck
→ Lint
→ Build
→ E2E
```

Do not claim a test passed unless it was actually executed.

If a check cannot be performed, state:

> NOT RUN: <reason>

Never fabricate test output.

---

# 12. CODE QUALITY

Prefer:

* small modules
* explicit types
* clear boundaries
* deterministic behavior
* reusable abstractions
* explicit error handling
* existing project conventions

Avoid:

* duplicate utilities
* giant components
* unnecessary abstractions
* speculative architecture
* unrelated rewrites
* silent failures

Search before creating a new abstraction.

---

# 13. SECURITY

Always consider:

* XSS
* Markdown/HTML injection
* URL attacks
* SSRF
* malicious files
* ZIP/path traversal
* API-key exposure
* prompt injection
* browser-extension permissions
* dependency vulnerabilities
* denial-of-service
* unsafe AI actions

When uncertain about security, research authoritative sources before implementing.

---

# 14. EXTERNAL RESEARCH

Use appropriate skills/tools whenever available.

Prefer:

1. official documentation
2. official source repositories
3. standards/specifications
4. security advisories
5. primary research
6. reputable technical sources
7. community discussions

Never use a random tutorial to override current official documentation.

See `docs/AGENT_RESEARCH.md`.

---

# 15. DEFINITION OF DONE

A task is complete only when applicable:

* requirements are understood
* relevant code was inspected
* implementation is complete
* existing behavior is preserved
* tests pass
* types pass
* lint passes
* build passes
* security implications were reviewed
* documentation is updated
* final diff was inspected
* limitations are documented

If something cannot be completed, report it.

---

# 16. FINAL REPORT

Use:

```text
Summary
- ...

Changed
- ...

Research
- ...

Validation
- ...

Security
- ...

Known limitations
- ...

Next recommended step
- ...
```

Use explicit labels:

* VERIFIED
* UNVERIFIED
* ASSUMPTION
* BLOCKED
* RISK
* RECOMMENDATION

---

# 17. MOST IMPORTANT RULE

Do not optimize for:

> Making the user believe the task is finished.

Optimize for:

> Making the repository objectively better, with evidence.

If uncertain: investigate.

If evidence contradicts your plan: change the plan.

If unsafe: say so.

If ambiguous: ask.

If unverified: do not claim it.