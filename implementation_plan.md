# AetherMind v1.21.0 — UI Optimization & Royal Overhaul Plan

Complete responsive redesign + premium visual overhaul targeting every screen size (phones, tablets, desktops) across all Android and iOS devices.

---

## Complete Bug List (Critical + Non-Critical)

### 🔴 Critical Bugs
| # | Bug | Location | Impact |
|---|---|---|---|
| C1 | `button { font-size: 0.8rem !important; padding: 6px 12px !important }` — global override smashes ALL buttons incl. canvas, modals, AI inputs | `index.css:1425` | Regression on all elements |
| C2 | `window.innerWidth > 768` is a one-time sync read for `isSearchOpen` — doesn't respond to window resize | `App.tsx:38` | Search panel stuck wrong state |
| C3 | `right-sidebar` on mobile uses `translateY(100%)` — comes from below. On Android Chrome this conflicts with the bottom address bar appearing/disappearing, causing layout thrash | `index.css:1393` | Editor panel flickers/clips |
| C4 | No touch events on graph canvas for node tap-to-select — `handleCanvasClick` only binds `MouseEvent`. On mobile, `touchstart→touchend` fires as `click` but with 300ms delay; node drag has no `touchstart` passthrough | `GraphCanvas.tsx:550` | Graph unusable on touch |
| C5 | Split-view (`secondaryNote`) has no guard for viewport < 1024px — renders two `EditorPanel`s at 180px each in a 360px sidebar | `App.tsx:457–472` | Total UI crush |
| C6 | `sidebar-tab-trigger` ("Open Editor") is rendered when `activeNote && !isSidebarOpen` — but on mobile the sidebar now takes full screen, so this button persists behind the sidebar overlay | `App.tsx:433` | Ghost button underneath |
| C7 | `max-height: calc(100vh - 32px)` on `.search-filter-panel` clips tag cloud on small phones (< 700px height) | `index.css:261` | Tags hidden/inaccessible |
| C8 | `insertText()` uses `document.getElementById('editor-note-body')` instead of the `textareaRef` — breaks if two EditorPanels render (split view) | `EditorPanel.tsx:163` | Wrong textarea targeted |
| C9 | Excalidraw whiteboard `JSON.parse(content)` with no guard when `content` is non-JSON string causes silent crash | `EditorPanel.tsx:478` | Whiteboard won't load |

### 🟡 Non-Critical Bugs
| # | Bug | Location | Impact |
|---|---|---|---|
| N1 | `sidebarWidth` default 420px — no `clamp()` cap; on 1366px screens it can consume 42% of viewport, crushing graph | `App.tsx:40` | Poor proportions |
| N2 | Sidebar resizer (`onMouseDown`) has no `touch-action: none` — causes scroll-and-resize conflict on touch-capable PCs | `App.tsx` | Resizer broken on touch laptops |
| N3 | `slashMenuPos` always set to `{top: 40, left: 20}` regardless of actual cursor position in textarea | `EditorPanel.tsx:257` | Slash menu always misplaced |
| N4 | `useEffect` for wiki-link clicks doesn't clean up added event listeners — creates duplicates on every preview re-render | `EditorPanel.tsx:269–290` | Memory leak / duplicate handlers |
| N5 | `canvas-controls` repositioned to `bottom: 80px` on mobile in CSS but no `safe-area-inset-bottom` — clips behind home indicator on iPhones | `index.css:1404` | Controls hidden by notch |
| N6 | Help box on canvas (`canvas-help-box`) is 280px wide — overflows on phones (360px viewport) | `index.css:512` | Help text cut off |
| N7 | `.modal-overlay` has no `padding-bottom: env(safe-area-inset-bottom)` — modal action buttons clipped behind home bar on iPhone | `index.css:855` | Modals broken on iOS |
| N8 | Page selector `<select>` styled with inline `style` — uses `color: var(--text-color)` (undefined token, should be `--text-primary`) — text invisible on some browsers | `App.tsx:330` | Invisible page name |
| N9 | `header-controls` on mobile wraps to new row but `margin-left: auto` still pushes it all the way right, making some buttons unreachable | `App.tsx:344` | Header button overflow |
| N10 | `search-filter-panel` hardcoded `width: 320px` on desktop — too narrow; truncates tag names | `index.css:259` | Tag cloud cramped |
| N11 | `AiSummary` panel renders below the main editor body with no defined max-height — can push content off screen | `EditorPanel.tsx:230–249` | Layout overflow |
| N12 | `Excalidraw` component imported at top-level (not lazy) — adds ~600KB to initial bundle | `EditorPanel.tsx:18` | Performance hit |
| N13 | `canvas-help-box` uses `position: absolute` with `top: 60px` — on mobile with repositioned controls it overlaps graph nodes | `index.css:509` | Help box mispositioned |
| N14 | No `aria-live` region for toasts — screen reader users don't hear notifications | `ToastContext.tsx` | Accessibility gap |
| N15 | `RevealModal` (spaced repetition review) has no `overflow-y: auto` — long card sets overflow and get clipped | `ReviewModal.tsx` | Content cut off |
| N16 | `timeline-slider-panel` `right: 16px` causes overflow on very narrow screens (< 360px) | `index.css:425` | Slider clips off screen |

---

## Design System Tokens (New)

```css
/* Breakpoints */
--bp-sm: 480px;   /* small phones */
--bp-md: 768px;   /* large phones / phablets */
--bp-lg: 1024px;  /* tablets / small laptops */
--bp-xl: 1280px;  /* desktop */

/* Safe area insets (PWA + notch) */
--safe-top:    env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
--safe-left:   env(safe-area-inset-left, 0px);
--safe-right:  env(safe-area-inset-right, 0px);

/* Mobile nav */
--mobile-nav-height: 60px;

/* Royal overhaul palette */
--accent-primary:   #7c3aed;   /* violet-600 */
--accent-secondary: #06b6d4;   /* cyan-500 */
--accent-gold:      #f59e0b;   /* amber-500 */
--glow-primary:     rgba(124, 58, 237, 0.35);
--glow-secondary:   rgba(6, 182, 212, 0.25);
--surface-glass:    rgba(15, 20, 40, 0.75);
--surface-card:     rgba(20, 27, 50, 0.9);
--border-glow:      rgba(124, 58, 237, 0.2);
```

---

## Proposed Changes

### Phase 0 — Critical Bug Fixes (Do First)

#### [MODIFY] [index.css](file:///e:/Lab/web/personal-knowledge-graph/src/index.css)
- **Fix C1**: Remove the `button { font-size !important; padding !important }` override entirely. Replace with scoped `.mobile-btn` class used only where needed.
- **Fix C3**: Change `.right-sidebar` mobile animation to `translateX(100%)` (slides in from right, not bottom).
- **Fix N5, N7**: Add `padding-bottom: env(safe-area-inset-bottom, 0px)` to `.modal-overlay` and `.canvas-controls`.
- **Fix N6**: Cap `.canvas-help-box` width at `min(280px, calc(100vw - 32px))`.
- **Fix N10**: Widen `.search-filter-panel` to 360px.
- **Fix N16**: Cap `timeline-slider-panel` with `max-width: calc(100vw - 32px)`.

#### [MODIFY] [App.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/App.tsx)
- **Fix C2**: Replace `window.innerWidth > 768` with a proper reactive `useMediaQuery` hook.
- **Fix C5**: Add `isDesktop` guard — only render `secondaryNote` EditorPanel when viewport ≥ 1024px. On smaller screens, split-view is **silently disabled** (the `onSplitRight` prop is passed as `undefined`). This is the best UX approach — simpler than stacking and less confusing than a cramped side-by-side.
- **Fix C6**: Remove the `sidebar-tab-trigger` button entirely — replaced by Phase 3 mobile nav.
- **Fix N2**: Add `touch-action: none` to the sidebar resizer div.
- **Fix N8**: Change `color: var(--text-color)` → `color: var(--text-primary)` in page selector inline style.

#### [MODIFY] [EditorPanel.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/EditorPanel.tsx)
- **Fix C8**: Replace `document.getElementById('editor-note-body')` with `textareaRef.current`.
- **Fix C9**: Wrap `JSON.parse(content)` in try/catch for Excalidraw `initialData`.
- **Fix N3**: Compute slash menu position from actual textarea `getBoundingClientRect()` + `scrollTop` + caret offset.
- **Fix N4**: Return cleanup function from wiki-link `useEffect` that removes all added click listeners.
- **Fix N11**: Add `max-height: 200px; overflow-y: auto` to the AI summary panel.
- **Fix N12**: Lazy-load `Excalidraw` via `React.lazy()` — reduce initial bundle.

---

### Phase 1 — Responsive CSS Foundation

#### [MODIFY] [index.css](file:///e:/Lab/web/personal-knowledge-graph/src/index.css)

Replace the single `@media (max-width: 768px)` block with four proper tiers:

```css
/* ── Small phones (< 480px) ── */
@media (max-width: 479px) { ... }

/* ── Large phones / phablets (480–767px) ── */  
@media (min-width: 480px) and (max-width: 767px) { ... }

/* ── Tablets (768–1023px) ── */
@media (min-width: 768px) and (max-width: 1023px) { ... }

/* ── Desktop (≥ 1024px) — baseline, most existing styles ── */
@media (min-width: 1024px) { ... }
```

Also add:
- `overscroll-behavior: contain` on all scrollable panels
- `min-height: 44px; min-width: 44px` for all interactive elements on mobile (WCAG 2.5.5)
- `body { padding-bottom: calc(var(--mobile-nav-height) + var(--safe-bottom)) }` on mobile
- `touch-action: pan-y` on the editor textarea to allow vertical scroll without triggering D3 canvas interference

#### [MODIFY] [index.html](file:///e:/Lab/web/personal-knowledge-graph/index.html)
Ensure: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`

---

### Phase 2 — Responsive Header

#### [MODIFY] [App.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/App.tsx)

Three header layouts using a `useViewport()` hook (returns `'sm' | 'md' | 'lg'`):

**Small (`< 768px`) — Ultra-compact mobile header:**
```
[Logo]  [Page Name (tap-to-switch)]  [☰ Menu]
```
- Logo: icon only (no "AetherMind" text)
- Page name: tappable pill that opens a bottom sheet page switcher (no `<select>`)
- Menu icon: opens a slide-up drawer with all actions (Review, Ask AI, Daily Note, New Page, Settings)
- Height: 52px total

**Tablet (`768–1023px`) — Icon-only buttons:**
```
[Logo + "AetherMind"]  [Page ▾]  [🧠] [✨] [📅] [+] [⚙]
```
- All action buttons: icon only, no text labels
- Tooltip on hover

**Desktop (`≥ 1024px`) — Current layout + ⌘K hint:**
```
[Logo + "AetherMind"]  [Page ▾ ✏️ 🗑️]  [🧠 Review] [✨ Ask AI] [📅 Daily] [+ New Page] [⚙] [⌘K]
```

---

### Phase 3 — Mobile Bottom Navigation Bar

#### [NEW] [MobileNav.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/MobileNav.tsx)

Fixed bottom bar, only visible at `< 768px`. Four tabs:

| Tab | Icon | Action |
|---|---|---|
| **Graph** | `Network` | Show graph canvas, collapse floating mini-card |
| **Editor** | `FileText` | Open current note fully (if any) |
| **Search** | `Search` | Toggle search filter panel |
| **Menu** | `Menu` | Slide-up drawer with all header actions |

Active state uses `--accent-primary` glow underline.

This completely replaces the `sidebar-tab-trigger` button and the overflowing mobile header controls.

---

### Phase 4 — Floating Mini-Card (Mobile Note Select)

On mobile (`< 768px`), tapping a graph node does **NOT** navigate to the editor. Instead, a **floating mini-card** slides up from the bottom (like an iOS bottom sheet, 40% screen height):

```
┌─────────────────────────────────────┐
│  ● Note Title                    × │
│  Category: work  │  Tags: react    │
│  ─────────────────────────────────  │
│  First 3 lines of content preview  │
│  ─────────────────────────────────  │
│  [Open Full Editor]  [Ask AI about]│
└─────────────────────────────────────┘
```

Tapping "Open Full Editor" switches to the full editor view (via mobile bottom nav "Editor" tab becoming active).
Tapping `×` or the backdrop dismisses the card.
Swiping down dismisses it.

#### [NEW] [NoteMiniCard.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/NoteMiniCard.tsx)

---

### Phase 5 — Royal UI Overhaul 👑

This is the biggest visual change. Every UI element gets redesigned.

#### [MODIFY] [index.css](file:///e:/Lab/web/personal-knowledge-graph/src/index.css)

**Color Palette Shift:**
- Current: emerald (`#34d399`) + indigo (`#818cf8`) on near-black background
- New: **Deep violet** (`#7c3aed`) primary + **electric cyan** (`#06b6d4`) secondary + **gold** (`#f59e0b`) for AI/premium actions — on a richer, deeper cosmic background

**Background:**
```css
--bg-primary: #06071a;  /* deeper, richer midnight */
background: radial-gradient(ellipse at 20% 50%, #0d0a2e 0%, #06071a 60%),
            radial-gradient(ellipse at 80% 20%, #070d1f 0%, transparent 50%);
```

**Glass panels — upgraded:**
```css
.glass-panel {
  background: linear-gradient(135deg, 
    rgba(15, 20, 50, 0.85) 0%, 
    rgba(8, 12, 35, 0.9) 100%);
  border: 1px solid rgba(124, 58, 237, 0.15);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 0 0 1px rgba(124, 58, 237, 0.08);
}
```

**Header — gradient logo glow:**
```css
.app-logo h1 {
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.logo-icon { color: #7c3aed; filter: drop-shadow(0 0 12px #7c3aed); }
```

**Primary button — gradient with shimmer:**
```css
.header-btn.primary-btn {
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
  position: relative; overflow: hidden;
}
.header-btn.primary-btn::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s ease;
}
.header-btn.primary-btn:hover::after { transform: translateX(100%); }
```

**Icon buttons — glassy depth:**
```css
.icon-btn {
  background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
}
.icon-btn:hover { border-color: rgba(124,58,237,0.4); box-shadow: 0 0 12px rgba(124,58,237,0.2); }
```

**Graph node styling in D3:**
- Node fill: radial gradient from category color to darker variant
- Active node: outer glow ring with `shadowBlur: 20`
- Node label: Inter font, white with 0.8 opacity, subtle text shadow
- Links: gradient stroke from source to target color (not flat white)

**Editor panel:**
- Title input: gradient underline instead of no border
- Tab buttons: pill shape, active tab has violet glow
- Toolbar: dark frosted glass strip with icon buttons having colored hover states
- Markdown preview: improved typography, code blocks with syntax highlight color scheme matching app theme

**Modals:**
- Wider (600px max on desktop), centered with `translateY(-50%)` offset for natural feel
- Header with gradient accent bar at top
- Close button top-right as `×` with hover ring

**Mobile mini-card:**
- Bottom sheet style with handle bar indicator
- Gradient header bar with note's category color
- Smooth spring animation with `cubic-bezier(0.34, 1.56, 0.64, 1)`

**Mobile bottom nav:**
- Frosted glass background with violet glow on active tab
- Active tab icon scales up slightly (1.1×) with transition
- Subtle top border gradient

---

### Phase 6 — Graph Canvas Touch & Cross-Device

#### [MODIFY] [GraphCanvas.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/GraphCanvas.tsx)

- **Fix C4**: Add `touchend` → node select mapping. On `touchend` without significant movement (< 10px delta from `touchstart`), treat as a click and select the tapped node.
- Add `pointer-events` composite listener using `PointerEvent` API (works for both mouse and touch uniformly).
- Increase node tap radius on touch devices by 8px for easier tap accuracy on small screens.
- Show floating mini-card (Phase 4) on node tap on `< 768px`.
- Disable double-click-to-create on mobile (accidental creation is common). Instead show a FAB "+" button in the mini-card area.

---

### Phase 7 — Version Bump & Changelog

#### [MODIFY] [package.json](file:///e:/Lab/web/personal-knowledge-graph/package.json)
- Bump version: `1.20.0` → `1.21.0`

#### [MODIFY] [changelog.md](file:///e:/Lab/web/personal-knowledge-graph/changelog.md)

```markdown
## [1.21.0] — 2026-07-03

### ✨ Royal UI Overhaul
- Complete visual redesign with deep violet + electric cyan + gold palette
- Premium glassmorphism panels with gradient borders and glow effects
- Gradient logo text, shimmer primary button animation
- Richer midnight cosmic background
- Improved graph node rendering with radial fills and active glow rings

### 📱 Full Responsive Design (All Devices)
- Four-tier breakpoint system: < 480px / 480–767px / 768–1023px / ≥ 1024px
- Proper safe-area inset support for iOS and Android notch/home-bar
- Mobile floating mini-card on node tap (bottom sheet with preview)
- Mobile bottom navigation bar (Graph / Editor / Search / Menu)
- Compact mobile header (icon-only) with slide-up action drawer
- Tablet header with icon-only buttons and tooltips
- Split-view editor disabled below 1024px (best UX approach)
- Touch-optimized graph canvas: tap-to-select nodes, larger tap radius

### 🐛 Bug Fixes
- Fixed global `button` override regression breaking all button sizes
- Fixed `isSearchOpen` initial state not reacting to window resize
- Fixed mobile sidebar slide direction (now slides from right, not bottom)
- Fixed split-view rendering on small screens (now disabled < 1024px)
- Fixed ghost "Open Editor" button appearing behind mobile sidebar
- Fixed `insertText()` using wrong DOM lookup instead of ref
- Fixed Excalidraw crash on non-JSON note content
- Fixed wiki-link click listener memory leak (duplicate handlers)
- Fixed canvas controls clipping behind iOS/Android home indicator
- Fixed `var(--text-color)` undefined token in page selector
- Fixed canvas help box overflow on narrow screens
- Fixed modal button clipping behind iPhone home bar
- Fixed AI summary panel overflowing editor area
- Lazy-loaded Excalidraw to reduce initial bundle size

### 🔧 Improvements
- Sidebar width now clamped to `clamp(340px, 30vw, 520px)` on desktop
- Search filter panel widened to 360px with better tag cloud display
- Slash menu now positions correctly at cursor location
- Timeline slider capped to viewport width on all screen sizes
```

#### [MODIFY] [README.md](file:///e:/Lab/web/personal-knowledge-graph/README.md)
- Update version badge: `1.20.0` → `1.21.0`
- Add "Fully responsive — works on any phone, tablet, or desktop"

---

### Phase 8 — AI Co-Author: Create / Edit / Delete Nodes from Chat

> **Architecture decisions locked:** D3:B (edit/delete with confirmation), D5:A (structured JSON responses), D7:A (AI chat entry point)

#### [NEW] [src/utils/aiActions.ts](file:///e:/Lab/web/personal-knowledge-graph/src/utils/aiActions.ts)

Central action dispatcher. Parses the AI's JSON action block and executes or stages it.

**Supported action types:**
```ts
type AiAction =
  | { action: 'create_note';  title: string; content: string; tags?: string[]; linkTo?: string[] }
  | { action: 'edit_note';    title: string; newContent?: string; newTitle?: string }
  | { action: 'delete_note';  title: string; reason?: string }
  | { action: 'create_link';  from: string; to: string }
  | { action: 'delete_link';  from: string; to: string }
```

**Dispatch flow:**
```
parseAiResponse(text)
  → extract JSON block between ```json ... ``` fences
  → JSON.parse → validate schema
  → if action is CREATE → executeAction(action) immediately
  → if action is EDIT or DELETE → stageAction(action) → show ConfirmActionToast
  → if parse fails → return null (treat as plain chat response)
```

**Create flow (no confirmation needed):**
```
create_note → db.notes.add({ title, content, tags }) → db.links.add for each linkTo
create_link → resolve both note IDs → db.links.add
→ toast: "✅ Created: [title]" + graph auto-refreshes via useLiveQuery
```

**Edit flow (requires confirmation):**
```
edit_note → stageAction stores pending edit in React state
→ ConfirmActionToast shows:
   "AI wants to edit '[title]'"
   Before: [first 100 chars of current content]
   After:  [first 100 chars of new content]
   [Apply Edit]  [Cancel]
→ Apply: db.notes.update(id, { content: newContent })
→ Cancel: dismiss, AI gets no feedback (stateless)
```

**Delete flow (requires confirmation):**
```
delete_note → stageAction stores pending delete
→ ConfirmActionToast shows:
   "AI wants to delete '[title]'"
   Reason: [reason from AI if provided]
   [Delete]  [Cancel]  ← Delete button styled in red
→ Delete: db.notes.delete(id)
→ Cancel: dismiss
```

**Safety rules (enforced in dispatcher, NOT relying on AI prompt alone):**
- `delete_note` is hard-blocked if the note has >5 incoming links (too many dependents) — show: "This note has many connections. Delete manually if you're sure."
- `edit_note` replaces content only if `newContent` is non-empty and longer than 10 chars
- Batch deletes (multiple notes in one action) are not allowed — only one at a time

#### [MODIFY] [src/components/AskAiModal.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/AskAiModal.tsx)

**System prompt additions:**
```
You can create, edit, and delete notes in the knowledge graph. When you need to
perform an action, include a JSON block in your response using this format:

\`\`\`json
{ "action": "create_note", "title": "...", "content": "...", "tags": [], "linkTo": ["existing note title"] }
\`\`\`

Available actions: create_note, edit_note, delete_note, create_link, delete_link.
For edit_note include "newContent" or "newTitle". For delete actions include "reason".
Always follow the JSON block with a human-readable explanation of what you did.
Only perform actions the user explicitly requested.
```

- After AI response arrives, call `parseAiResponse(text)` from `aiActions.ts`
- If action returned → dispatch it (create immediately, edit/delete stage for confirmation)
- Render a special `AiActionCard` in the chat for confirmed creations:
  ```
  ✅ Created note: "Transformer Attention"
     Linked to: "Neural Scaling Laws"
     [View in Graph]
  ```

#### [NEW] [src/components/ConfirmActionToast.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/ConfirmActionToast.tsx)

Persistent (non-auto-dismiss) toast for destructive AI actions. Lives above the regular toast stack.
- Shows before/after diff for edits
- Red "Delete" button for deletions
- Dismissing without confirming = cancel (no action taken)
- Only one staged action at a time (queue: if two arrive, second waits)

---

### Phase 9 — Research Mode: Fetch URL → Node

> **Architecture decisions locked:** D4:A (text-paste fallback on CORS fail), D7:A (AI chat entry point)

#### [NEW] [src/utils/urlFetcher.ts](file:///e:/Lab/web/personal-knowledge-graph/src/utils/urlFetcher.ts)

```ts
export async function fetchUrlContent(url: string): Promise<{ text: string; title: string } | null>
```

**Flow:**
```
1. Validate URL (URL constructor — reject non-http/https)
2. fetch(url, { signal: AbortSignal.timeout(8000) })
3. On CORS / network error → return null (caller shows paste fallback)
4. On 4xx/5xx → throw with status message
5. response.text() → DOMParser.parseFromString(html, 'text/html')
6. Extract: document.title + document.body.innerText
7. Strip script/style content (already gone via innerText)
8. Truncate to first 8000 chars
9. Return { text, title }
```

**Security:** Never pass raw HTML to AI or render it. Only `innerText` (plain text) is used.

**Unsupported URL patterns (detected before fetch attempt):**
- `youtube.com`, `youtu.be` → "YouTube isn't supported. Paste the transcript here."
- `twitter.com`, `x.com` → "X/Twitter links aren't supported. Paste the text here."
- `.pdf` extension → "PDFs can't be fetched directly. Paste the abstract here."

#### [MODIFY] [src/components/AskAiModal.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/AskAiModal.tsx)

**URL detection in user message:**
- Before sending to AI, scan message for `https?://[^\s]+` pattern
- If URL found → call `fetchUrlContent(url)`
  - **Success:** prepend fetched text to AI context: `"[Content from URL]\n\n---\n\n{text}\n\n---\nUser message: {original message}"`
  - **CORS fail (null returned):** inject assistant message: "I can't fetch that URL directly due to browser security restrictions. Paste the text or abstract here and I'll create the note."
  - **Unsupported type:** show the specific message (YouTube/PDF etc.)
  - **4xx/5xx:** toast: "That page returned an error ([status]). Try a different URL."

**Research Mode system prompt addition:**
```
When given web content, summarize it into a concise note. Extract the key ideas,
methodology, and conclusions. Use the page title as the note title unless the user
specifies otherwise. Suggest 2-3 connections to existing notes if relevant.
```

**UX in chat after Research Mode creates a node:**
```
📄 Created note: "Attention Is All You Need"
   Source: arxiv.org/abs/1706.03762
   Tags: transformers, attention, deep-learning
   Suggested links: "Neural Scaling Laws", "BERT"
   [Add suggested links]  [Edit note]  [View in Graph]
```

---

### Phase 10 — Graph Export (SVG / PNG)

> **Architecture decision locked:** D6:A (canvas controls area)

#### [MODIFY] [src/components/GraphCanvas.tsx](file:///e:/Lab/web/personal-knowledge-graph/src/components/GraphCanvas.tsx)

Add Export button to canvas controls (top-right, after zoom buttons):

```tsx
<button className="canvas-control-btn" onClick={handleExport} title="Export graph">
  <Download size={16} />
</button>
```

**Export handler:**
```ts
async function handleExport(format: 'svg' | 'png' = 'svg') {
  const svgEl = svgRef.current;
  if (!svgEl) return;

  // 1. Clone SVG to avoid mutating live DOM
  const clone = svgEl.cloneNode(true) as SVGElement;

  // 2. Set explicit dimensions
  clone.setAttribute('width', String(svgEl.clientWidth));
  clone.setAttribute('height', String(svgEl.clientHeight));

  // 3. Add white/dark background rect for readability
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#06071a');  // --bg-primary
  clone.insertBefore(bg, clone.firstChild);

  // 4. Serialize
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });

  if (format === 'svg') {
    triggerDownload(blob, 'aethermind-graph.svg');
  } else {
    // PNG: draw SVG onto canvas
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.clientWidth * 2;   // 2x for retina
      canvas.height = svgEl.clientHeight * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(pngBlob => {
        if (pngBlob) triggerDownload(pngBlob, 'aethermind-graph.png');
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = url;
  }
}
```

**Export format picker:** On button click, show a 2-option dropdown: `SVG (vector)` / `PNG (image)`. Default to SVG.

**Edge cases:**
- Empty graph (0 nodes) → button disabled with tooltip "Add notes to export"
- Graph too large (>500 nodes) → warn: "Large graphs may take a moment to export"
- On mobile → Export button moves to the Menu drawer (not canvas controls, too small)

---

## Architecture Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| D3: AI destructive actions | Allow edit/delete with confirmation toast | Gives full power; confirmation gate prevents accidents |
| D4: Research Mode CORS | Text-paste fallback | Safe, no external dependency, clear UX |
| D5: AI response format | Structured JSON in fenced block | Reliable parsing; falls back to chat if absent |
| D6: Export button location | Canvas controls (top-right) | Graph action belongs near graph; Menu drawer on mobile |
| D7: Research Mode entry | AI chat (URL auto-detected) | Consistent UX; no new UI needed |

---

## New Files Summary

| File | Phase | Purpose |
|---|---|---|
| `src/utils/aiActions.ts` | 8 | AI action parsing + dispatch (create/edit/delete notes & links) |
| `src/utils/urlFetcher.ts` | 9 | URL fetch, sanitize HTML→text, CORS fallback |
| `src/components/MobileNav.tsx` | 3 | Bottom navigation bar (<768px) |
| `src/components/NoteMiniCard.tsx` | 4 | Floating mini-card on mobile node tap |
| `src/components/ConfirmActionToast.tsx` | 8 | Persistent confirmation for AI edit/delete actions |

---

## Verification Plan

### Build
```
npm run build   # zero TypeScript errors, zero warnings
```

### Feature Test Matrix

#### AI Co-Author (Phase 8)
| Test | Input | Expected |
|---|---|---|
| Create note | "Add a note about transformer attention" | Note created, toast confirms, graph updates |
| Create + link | "Add a note on BERT and link it to Transformers" | Note + link created |
| Edit note | "Edit my note on X to include Y" | Confirmation toast shown, edit applied on confirm |
| Delete note | "Delete my note on X" | Confirmation toast shown, delete on confirm |
| Delete blocked | Delete note with >5 links | Error: "Too many connections — delete manually" |
| No JSON returned | Casual question to AI | Normal chat response, no action |
| Malformed JSON | AI returns broken JSON | Treat as plain chat, no action |
| Batch delete attempt | "Delete all my notes" | Blocked — only one delete at a time |

#### Research Mode (Phase 9)
| Test | Input | Expected |
|---|---|---|
| CORS success | Wikipedia URL | Note created from page content |
| CORS fail | Most news sites | Paste fallback message shown |
| YouTube URL | youtu.be link | Unsupported message shown |
| PDF URL | arxiv PDF link | Unsupported message shown |
| 404 URL | Dead link | Error toast with status code |
| Long page | Docs site | Truncated at 8000 chars, note created |

#### Graph Export (Phase 10)
| Test | Scenario | Expected |
|---|---|---|
| SVG export | 10-node graph | SVG file downloads, opens in browser |
| PNG export | 10-node graph | PNG file downloads, 2x resolution |
| Empty graph | 0 nodes | Export button disabled |
| Large graph | 200+ nodes | Export completes (may take 2-3s) |
| Mobile | <768px | Export in Menu drawer, not canvas |

### Cross-Device Matrix
| Device | Width | Test |
|---|---|---|
| iPhone SE (3rd gen) | 375px | Bottom nav, mini-card, safe areas, AI chat |
| Samsung Galaxy S24 | 360px | Bottom nav, graph touch, Research Mode paste fallback |
| Pixel 8 | 412px | Landscape + portrait |
| iPad Mini | 768px | Tablet header, sidebar beside graph |
| iPad Pro 12.9" | 1024px | Desktop mode kicks in |
| MacBook 13" | 1280px | Sidebar clamping, split-view, graph export |
| 4K Monitor | 2560px | No layout stretching |

### Physical Device
- Deploy to GitHub Pages → test on real Android + iOS browser
- Verify bottom safe area insets (home indicator gap)
- Verify pinch-to-zoom is disabled (app-level zoom only via D3)
- Verify virtual keyboard doesn't crush editor layout

> [!NOTE]
> The floating mini-card (Phase 4) and royal overhaul (Phase 5) are the most impactful phases visually. Phase 0 bug fixes must be done first as they're blockers. Phase 8 (AI Co-Author) is the highest-leverage capability feature — prioritize it after Phase 0.

---

## Implementation Order (Revised for Full Scope)

```
1.  Phase 0  — Critical bug fixes (C1–C9, N1–N16)      ← blockers
2.  Phase 8  — AI Co-Author (aiActions.ts + AskAiModal) ← capability flagship
3.  Phase 9  — Research Mode (urlFetcher.ts)            ← builds on Phase 8
4.  Phase 10 — Graph Export                             ← independent, fast
5.  Phase 1  — CSS 4-tier breakpoints
6.  Phase 2  — Responsive header
7.  Phase 3  — MobileNav.tsx
8.  Phase 4  — NoteMiniCard.tsx
9.  Phase 5  — Royal UI overhaul (index.css rewrite)
10. Phase 6  — Graph canvas touch
11. Phase 7  — Version bump + changelog
```

---

## Deferred to v1.22.0 (TODOS)

- **AI Connection Discovery**: After saving a note, AI suggests unlinked semantically similar notes
- **"Why Connected?" Edge Explanation**: Hover over any graph edge → AI one-sentence explanation
- **Daily Discovery Digest**: On app open, surfaces one unexpected connection
- **Voice Input → Node**: Speak a thought, AI creates the node
- **Spaced Repetition Enhancement**: Graph-aware review ordering

