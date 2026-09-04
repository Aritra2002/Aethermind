# AetherMind — Quality, Testing & Verification Guide

**Status:** Normative
**Scope:** Testing, validation, reliability, performance, regression prevention, release quality
**Parent policy:** `/AGENTS.md`

---

# 1. Purpose

This document defines what "good enough" means for AetherMind engineering work.

The objective is not maximum test count.

The objective is:

> **High confidence that changes behave correctly, safely, predictably, and maintainably.**

AetherMind handles valuable user knowledge, so correctness and recoverability are more important than development speed.

---

# 2. Core Rule

Never confuse:

```text
Code was written
```

with:

```text
Feature was verified
```

A feature is not complete until appropriate evidence exists.

---

# 3. Evidence-Based Engineering

Every final engineering report must distinguish:

### VERIFIED

Directly observed or tested.

### UNVERIFIED

Could not be checked.

### ASSUMPTION

A deliberate assumption used because requirements/evidence were incomplete.

### BLOCKED

Cannot proceed without missing information/access/tooling.

### RISK

Known possibility that could affect correctness/security.

Never hide uncertainty.

---

# 4. Validation Pyramid

Use the narrowest appropriate validation first.

```text
                E2E
              /     \
        Integration
          /       \
       Unit / Component
          |
      Type / Static
          |
     Lint / Formatting
          |
        Build
```

Not every change requires every layer.

High-risk changes require broader validation.

---

# 5. Unit Tests

Use unit tests for:

* deterministic utilities
* parsers
* validators
* transformations
* ranking algorithms
* graph algorithms
* data normalization
* security-sensitive pure functions

Tests should be deterministic.

Avoid unnecessary network calls.

---

# 6. Component Tests

Test important UI behavior such as:

* rendering
* user interaction
* validation
* loading
* empty state
* error state
* accessibility
* keyboard interaction

Do not test implementation details unnecessarily.

Prefer testing observable behavior.

---

# 7. Integration Tests

Integration tests should verify boundaries such as:

* UI → application logic
* application → database
* RAG → vector storage
* AI → action validation
* import → database
* export → restore
* migration → existing data

These tests are particularly valuable for AetherMind because many failures occur at boundaries.

---

# 8. End-to-End Tests

E2E tests should cover critical user journeys.

Examples:

```text
Create note
→ persist
→ search
→ retrieve
→ edit
→ reload
→ verify
```

and:

```text
Import data
→ preview
→ confirm
→ index
→ search
→ export
→ restore
```

and:

```text
Ask AI
→ retrieve evidence
→ generate answer
→ display provenance
```

---

# 9. Database Testing

Test:

* creation
* update
* deletion
* relationships
* indexing
* migration
* backup
* restore
* import
* export
* malformed records
* unexpected old data

Do not test only against an empty database.

---

# 10. Migration Testing

Every schema migration should consider:

```text
Old database
     ↓
Migration
     ↓
New database
     ↓
Existing data still correct
```

Test representative real-world data.

Where practical, test failure recovery.

Never assume production databases are clean.

---

# 11. Import/Export Testing

Test:

* empty export
* small export
* large export
* special characters
* Unicode
* malformed input
* duplicate records
* old formats
* partial failures
* round-trip integrity

Ideal property:

```text
Export
→ Import
→ Export
```

should preserve the meaningful user knowledge.

---

# 12. RAG Testing

Test:

* no documents
* one document
* duplicate documents
* unrelated documents
* highly similar documents
* contradictory documents
* very long documents
* short notes
* large collections
* missing embeddings
* failed embeddings

Measure retrieval rather than only generated text.

---

# 13. AI Testing

AI tests should cover:

### Normal

Valid user requests.

### Ambiguous

Requests requiring clarification.

### Unsupported

Requests with insufficient evidence.

### Adversarial

Prompt injection and malicious content.

### Malformed

Invalid model output.

### Failure

Provider unavailable.

### Dangerous

Destructive action proposals.

---

# 14. AI Action Testing

For every action class, test:

```text
Valid proposal
Invalid schema
Unauthorized proposal
Malformed parameters
Missing record
Already deleted record
Bulk operation
Destructive operation
```

The application must reject unsafe operations independently of model behavior.

---

# 15. Security Regression Testing

Maintain tests for previously discovered security issues.

Potential areas:

* XSS
* Markdown injection
* HTML injection
* prompt injection
* SSRF
* unsafe URL handling
* malicious files
* ZIP traversal
* unauthorized AI actions
* secret leakage

---

# 16. Graph Testing

Test:

* zero nodes
* one node
* disconnected nodes
* cycles
* dense graphs
* duplicate relationships
* large graphs
* malformed relationships

Graph visualization must degrade gracefully.

---

# 17. Mobile Testing

Do not define mobile support as merely:

> "The CSS fits."

Test:

* small viewport
* touch interactions
* keyboard visibility
* scrolling
* dialogs
* graph interaction
* editor interaction
* navigation
* loading
* offline behavior

---

# 18. Accessibility Testing

Important workflows should test:

* keyboard navigation
* focus
* labels
* semantic controls
* screen-reader-relevant information
* color contrast
* reduced motion
* touch target size

---

# 19. Performance Testing

Performance claims require measurement.

Benchmark relevant workloads.

Suggested dataset tiers:

```text
Tier 1: 100 notes
Tier 2: 1,000 notes
Tier 3: 10,000 notes
Tier 4: 50,000 notes
Tier 5: 100,000+ chunks
```

Measure where relevant:

* startup
* first render
* database reads
* database writes
* indexing
* embedding
* vector search
* graph rendering
* memory
* snapshots
* import/export

Record:

* environment
* dataset
* operation
* result

---

# 20. Performance Regression

Do not optimize based solely on intuition.

If a performance-sensitive change is made:

1. establish baseline
2. implement
3. benchmark
4. compare
5. retain evidence

---

# 21. Error Handling Testing

Test failures deliberately.

Examples:

* network unavailable
* AI provider timeout
* invalid API key
* database failure
* malformed file
* corrupt import
* missing record
* empty result
* invalid model response

The application must fail predictably.

---

# 22. Offline Testing

Core local functionality should be tested without network access where practical.

Verify:

* opening the application
* reading knowledge
* editing
* searching
* local persistence
* exports

AI-dependent features should communicate that they require a provider/network when applicable.

---

# 23. Dependency Validation

When changing dependencies:

* install cleanly
* typecheck
* lint
* test
* build
* inspect bundle impact when relevant

Do not assume a successful installation means compatibility.

---

# 24. CI Expectations

The project should eventually have automated checks for:

* installation
* typecheck
* lint
* unit tests
* integration tests
* build
* security/dependency checks where appropriate

CI should fail on meaningful regressions.

---

# 25. Regression Principle

Every significant bug should ideally produce:

```text
Bug
 ↓
Reproduction
 ↓
Regression test
 ↓
Fix
 ↓
Verification
```

Do not repeatedly fix symptoms.

---

# 26. Test Quality

Avoid tests that:

* merely execute code
* assert implementation details
* mock away the feature being tested
* have no meaningful assertion
* are flaky
* depend on uncontrolled external services

A smaller number of meaningful tests is better than a large number of meaningless tests.

---

# 27. Mocking

Mock external systems when appropriate.

Do not mock the exact behavior you need to validate.

For AI provider tests, use deterministic fixtures where possible.

Use real provider calls only when an explicit integration/evaluation test requires them.

Never put real secrets in tests.

---

# 28. Test Data

Test fixtures should be:

* synthetic
* minimal
* representative
* safe to commit

Never commit private user knowledge.

---

# 29. Build Verification

For changes affecting production behavior, run the project's appropriate build command.

Never report:

> Build successful

unless it was actually executed successfully.

---

# 30. Final Diff Review

Before completing work:

1. inspect changed files
2. inspect unintended modifications
3. inspect generated files
4. inspect debug logging
5. inspect secrets
6. inspect comments/documentation
7. inspect tests
8. inspect dependency changes

---

# 31. Definition of Done

A task is DONE when all applicable conditions are satisfied:

* requirement understood
* implementation complete
* existing behavior considered
* relevant tests pass
* typecheck passes
* lint passes
* build passes
* security considered
* performance considered where relevant
* documentation updated where necessary
* final diff reviewed
* limitations reported

---

# 32. Final Report Format

Use:

```text
## Summary

## Changed

## Tests

## Validation

## Security

## Performance

## Research

## Known Limitations

## Recommended Next Step
```

Every result must be truthful.

---

# 33. Absolute Rule

Never fabricate:

* test results
* benchmark numbers
* security status
* coverage
* browser behavior
* API behavior
* successful builds

If it was not verified:

> **It is not verified.**