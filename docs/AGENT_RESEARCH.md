# AetherMind — Research, Verification & Evidence Protocol

**Status:** Normative
**Scope:** Internet research, technical investigation, documentation verification, API research, security research, dependency research
**Parent policy:** `/AGENTS.md`

---

# 1. Purpose

This document exists to prevent a coding agent from making decisions based on:

* hallucinated facts
* stale knowledge
* incorrect assumptions
* outdated documentation
* random tutorials
* misunderstood APIs
* unsupported security claims

The central rule is:

> **Uncertainty must trigger investigation, not invention.**

---

# 2. Research Is Part of Engineering

Research is not optional overhead when correctness depends on external facts.

A good engineering agent should be able to:

```text
Question
 ↓
Investigate
 ↓
Collect evidence
 ↓
Compare evidence
 ↓
Decide
 ↓
Implement
 ↓
Validate
```

---

# 3. When Research Is Mandatory

Research before implementation when dealing with:

* current APIs
* current library behavior
* framework versions
* browser APIs
* security
* AI provider APIs
* model capabilities
* authentication
* compatibility
* standards
* licensing
* performance claims
* unfamiliar technologies
* breaking changes
* deprecated APIs

---

# 4. When Repository Research Is Enough

Do not unnecessarily browse the internet for facts that can be determined directly from the repository.

First inspect:

* source code
* package.json
* lockfile
* configuration
* tests
* existing documentation
* existing implementations

Example:

If the question is:

> "How does AetherMind currently store notes?"

Inspect the repository first.

Do not search the internet to answer a question about the project's own code.

---

# 5. Research Source Hierarchy

Prefer sources in this order:

## Tier 1 — Primary

* official documentation
* official API references
* official source repository
* standards/specifications
* official security advisories

## Tier 2 — High-quality secondary

* respected technical publications
* primary research papers
* established engineering documentation

## Tier 3 — Community

* GitHub discussions
* Stack Overflow
* Reddit
* forums

## Tier 4 — Low confidence

* random blogs
* SEO pages
* scraped documentation
* AI-generated articles

Never allow a Tier 4 source to override a verified Tier 1 source.

---

# 6. Current API Research

When changing an API integration:

```text
Check installed version
 ↓
Open current official documentation
 ↓
Verify API signature
 ↓
Verify authentication
 ↓
Verify request format
 ↓
Verify response format
 ↓
Check deprecations
 ↓
Implement
 ↓
Test
```

---

# 7. Dependency Research

Before adding or significantly upgrading a dependency, investigate:

* current version
* compatibility
* maintenance
* repository activity
* security advisories
* license
* bundle size
* runtime cost
* browser support
* known limitations

Do not add dependencies merely because they provide a convenient function.

---

# 8. Security Research

For security-sensitive questions, prefer:

1. official security documentation
2. OWASP
3. browser/vendor security documentation
4. CVE/security advisories
5. standards
6. primary research

Never make a security claim from memory when verification is possible.

---

# 9. AI Provider Research

Before changing an AI integration, verify:

* current endpoint
* authentication method
* supported models
* structured output
* tool calling
* context limits
* rate limits
* error responses
* streaming behavior
* embeddings
* current deprecations

Provider APIs change rapidly.

---

# 10. Browser Research

For browser APIs, verify current behavior from:

* browser vendor documentation
* MDN
* standards/specifications
* compatibility data

Do not assume that behavior from one browser applies universally.

---

# 11. Research Recency

Research freshness should match the question.

### Very recent / fast-changing

Use current sources for:

* APIs
* model names
* pricing
* security vulnerabilities
* browser changes
* dependency releases

### Stable

Older authoritative sources may remain valid for:

* fundamental algorithms
* established standards
* mathematical concepts

Use judgment.

---

# 12. Search Strategy

Do not search randomly.

First formulate:

```text
What exactly do I need to know?
```

Then search targeted questions.

Bad:

```text
AI stuff
```

Better:

```text
official OpenAI structured outputs current API
```

Better still:

```text
site:platform.openai.com structured outputs API current
```

---

# 13. Cross-Verification

For important decisions, verify using more than one source when practical.

For example:

```text
Official documentation
+
Installed package/source
+
Small experiment
```

If sources disagree:

1. determine versions
2. identify dates
3. inspect source
4. test behavior
5. document uncertainty

---

# 14. Experimental Verification

When documentation is ambiguous, create a minimal experiment.

Example:

```text
Question:
Does API X preserve field Y?

Experiment:
Create minimal input containing Y.
Call API.
Inspect response.

Result:
...
```

A controlled experiment is better than guessing.

---

# 15. Evidence Classification

Every significant conclusion should be classified:

### VERIFIED

Direct evidence confirms it.

### STRONGLY INFERRED

Evidence strongly supports it but does not directly prove it.

### ASSUMPTION

Chosen because evidence is unavailable.

### UNVERIFIED

Could not establish truth.

Use these labels internally and in reports where useful.

---

# 16. Research Notes

For significant architectural decisions, record:

```text
Question:
...

Repository evidence:
...

External evidence:
...

Sources:
...

Alternatives:
...

Decision:
...

Reason:
...

Remaining uncertainty:
...
```

---

# 17. Do Not Over-Research

Research has a cost.

Do not spend 30 minutes researching a question that can be answered by inspecting one existing function.

Use this order:

```text
Repository
 ↓
Official documentation
 ↓
Experiment
 ↓
Broader research
```

unless the task clearly requires broader investigation.

---

# 18. Research and Implementation Must Stay Connected

Do not research something and then ignore the result.

If research changes the preferred architecture:

> Change the implementation plan.

Do not continue with a known-wrong approach merely because coding has begun.

---

# 19. Research for Security

If research reveals that an approach is unsafe:

```text
STOP
 ↓
Document risk
 ↓
Find safer alternative
 ↓
Ask user if tradeoff is significant
 ↓
Implement safely
```

Never knowingly introduce a security weakness simply because it is easier.

---

# 20. Research for Performance

Do not accept claims such as:

> "IndexedDB is fast enough."

Instead determine:

* dataset size
* operation
* environment
* latency
* memory
* browser constraints

Use benchmarks when the decision matters.

---

# 21. Research for AI Quality

Do not assume a model/provider is better because marketing says so.

For important AI decisions:

* inspect current capabilities
* define evaluation criteria
* benchmark representative tasks
* compare quality
* consider latency
* consider privacy
* consider cost
* consider reliability

---

# 22. Internet Research Does Not Mean Blind Trust

The internet contains:

* outdated tutorials
* incorrect answers
* SEO spam
* hallucinated documentation
* copied code
* insecure recommendations

A web result is evidence, not truth.

Evaluate source quality.

---

# 23. Tool and Skill Usage

Before complex work, inspect available tools/skills.

Use specialized capabilities when available for:

* web research
* browser testing
* visual inspection
* code search
* dependency analysis
* security analysis
* performance profiling
* documentation

Do not manually approximate specialized tasks when an appropriate capability exists.

---

# 24. Never Claim Research You Did Not Perform

Never say:

> "I checked the official documentation."

unless you actually checked it.

Never fabricate:

* URLs
* source names
* documentation contents
* benchmark results
* API behavior

---

# 25. Final Research Report

When research materially affects implementation, report:

```text
Research question:
...

Sources consulted:
...

Key findings:
...

Decision:
...

Why:
...

Remaining uncertainty:
...
```

---

# 26. Research Completion Rule

Research is complete when:

* the relevant question is sufficiently answered
* authoritative evidence has been considered
* implementation consequences are understood
* remaining uncertainty is explicitly identified

The goal is not maximum browsing.

The goal is:

> **Enough reliable evidence to make a correct engineering decision.**