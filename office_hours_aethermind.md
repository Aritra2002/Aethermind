# AetherMind — YC Office Hours Design Doc
_Generated: 2026-07-04_

---

## The Real Product

AetherMind is a **privacy-first, AI-native knowledge graph** where the AI runs locally (via Ollama or any API), can build the graph as a co-author, and imposes no cost, rate limit, or content filter on the user.

It is NOT a note-taking app. The notes are the substrate. The graph is the structure. The AI is the engine.

---

## ICP (Ideal Customer Profile)

**Primary — User A: The Privacy-First Researcher / Developer**

- Researcher, journalist, security professional, or developer working with sensitive, proprietary, or academically sensitive material
- Has 6+ months of accumulated notes that are no longer navigable manually
- Has hit censorship walls with cloud AI (ChatGPT, Claude, Gemini) on legitimate research topics
- Already knows what a local LLM is, or is willing to learn
- Won't pay per-query for AI — wants unlimited, cost-free inference
- Would describe the problem as: "I know I thought about this before, but I can't find where or how it connects"

**Secondary — User B: The Visual Thinker**
- Uses the graph to see connections between ideas, not just store them
- Responds strongly to node types, node coloring, graph layout
- Keep in mind for UI decisions but do not optimize features primarily for this user

---

## Status Quo (What Users Left Behind)

- Notepad / Google Docs: flat, unsearchable, no connections, no AI
- Obsidian (power users): graph exists but AI plugin ecosystem is fragmented, cloud-only, censored
- Two-tab workflow: Notes in one app, ChatGPT in another — context never shared between them

---

## The Differentiated Position

| Capability | AetherMind | Obsidian + Plugin | Notion AI | ChatGPT |
|---|---|---|---|---|
| Graph visualization | ✅ Native | ✅ Native | ❌ | ❌ |
| Local LLM support | ✅ First-class | ⚠️ Fragmented plugins | ❌ | ❌ |
| AI reads your graph | ✅ | ⚠️ Partial | ❌ | ❌ |
| AI builds your graph | 🔲 Not yet built | ❌ | ❌ | ❌ |
| Uncensored inference | ✅ Via local LLM | ⚠️ Model-dependent | ❌ | ❌ |
| No cost per query | ✅ Local | ✅ Local | ❌ | ❌ |

**The gap in the table above is the product roadmap.**

---

## The Key Observation (Q5 Gold)

A user tried to **create a new node using the AI** — a feature that didn't exist.

This revealed the real mental model users have: the AI is not a reader of the graph. **It is a co-author of the graph.** The distinction is fundamental.

Current state: User creates notes → AI reads and answers questions from notes
Target state: User has conversation → AI creates notes and builds connections in real-time

This is the shift from assistant to collaborator. It's the feature that no competitor can replicate without rebuilding from scratch.

---

## Future-Fit Thesis

Three trends make AetherMind more valuable over time, not less:

1. **AI regulation tightens** → Data sovereignty becomes a compliance requirement, not a preference. Local LLM goes from "privacy choice" to "enterprise necessity."
2. **Knowledge accumulates** → The larger a user's note collection, the harder the connection problem. The product's value compounds with usage — rare for any tool.
3. **AI cost commoditizes** → Cloud AI per-token pricing will drop, but the *censorship* constraint doesn't go away with price. Local LLM's uncensored nature stays a differentiator for researchers permanently.

---

## Positioning Warning

"Uncensored AI" is the sharpest edge and the biggest distribution risk simultaneously.

- **Right framing:** "Run any model locally — no content filters for sensitive research topics"
- **Wrong framing:** "Uncensored AI" with no qualifier (attracts the wrong audience, triggers app store/hosting flags)

Do not put "uncensored" in the headline. Put it in the explanation of why local LLM matters.

---

## The Assignment — This Week

**Build: "Create a node using AI"**

Let the user say in the AI chat:
> "Add a note about transformer attention mechanisms and link it to my note on neural scaling laws."

The AI should:
1. Create a new note with that content
2. Create a graph link between the new node and the referenced existing note
3. Confirm what it did in the chat

This is the single highest-leverage feature to build next. It is:
- What a real user tried to do and couldn't
- What no competitor offers
- The clearest expression of "AI as graph co-author"
- Buildable in days, not weeks

---

## Features to Protect (Do Not Remove)

1. **AI Q&A across the whole graph** — primary retention driver for User A
2. **AI summarization** — daily utility for researchers processing large volumes
3. **Node types + node coloring** — primary retention driver for User B
4. **Local LLM support** — the core differentiator; removing this removes the ICP

---

## Parking Lot (Good Ideas, Not Now)

- Share visualization as live URL
- Collaborative graphs (multi-user)
- Export graph to academic citation format
- Plugin API for external integrations
- Sync server for multi-device (already in progress per codebase)

