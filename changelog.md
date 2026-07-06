# Changelog

## [1.26.0] - 2026-07-06

### ✨ New Features
- **Document to Graph AI Generation**: Users can now upload `.txt`, `.md`, and `.pdf` files. The system utilizes `pdfjs-dist` to extract full document text, displays a premium glassmorphism loading state with micro-animations, and uses AI to automatically structure the document into connected notes and links on the current page.
- **Graph Import from ZIP**: Users can now seamlessly import previously exported graph ZIP archives into the active page without losing existing graph context.

### 💄 UI & Aesthetics
- **Premium Header Redesign**: Introduced responsive `page-action-btn` class with glassmorphism for top-nav action buttons ("New Page", "Daily Note", "Import ZIP", "Upload Document").
- **Perfect Desktop & Mobile Parity**: Mobile menus now include the new file action buttons without causing layout shifts or overlapping bounding boxes.
- **History Scrubber Polish**: Hid the "Reset Timeline" button on mobile view and resolved mobile out-of-bounds text wrapping for timestamp displays.


## [1.25.5] - 2026-07-06

### 🐛 Bug Fixes
- **Mobile Node Drag (Actual Root Fix)**: Fixed the underlying collision between custom pointer touch handlers and D3's native zoom behavior on mobile devices by suppressing D3 zoom events via `stopImmediatePropagation()`. Nodes can now be dragged smoothly on mobile without panning the canvas.
- **Mobile UI Controls**: Refactored the floating canvas controls for narrow viewports. The Sidebar toggle is now hidden on mobile, and the Search, Export, and Help buttons are consolidated into a horizontal flex-row with unified premium design.
- **UI Mutual Exclusivity**: Search, Export, and Help panels now automatically close each other to prevent overlapping UI states.
- **Search Panel Performance**: Removed the slide-in animation to eliminate perceived lag; panel now opens instantly. Disabled auto-open on desktop launch.
- **Mobile Layout Bounds Fixes**: Export menu now dynamically adjusts positioning to stay within viewport bounds on mobile screens. Canvas controls moved to top-left on vertical layouts to prevent overlapping with the opened search UI.
- **Timeline Scrubber Upgrade**: Fixed layout shifts caused by conditional rendering of the Reset button. Upgraded slider track with dynamic gradient colors based on value progress, and styled all scrubber controls with a premium glassmorphism aesthetic. Fixed logic bug where thumb position didn't visually reset on clear.
- **Page Selector**: Refactored with premium glassmorphism styling, hover glows, and a custom caret icon.

## [1.25.4] - 2026-07-05

### 🐛 Bug Fixes
- **Wiki-link Click (Root Fix)**: Fixed `DOMPurify` stripping `href="#wiki-..."` attributes in both `EditorPanel.tsx` preview and `NoteMiniCard.tsx`. Added `ALLOWED_URI_REGEXP` to explicitly permit the `#wiki-` scheme — wiki-links now render as clickable anchors and correctly navigate to the target note on both desktop and mobile.
- **Swipe-up False Trigger**: Fixed the mobile mini card swipe-up gesture firing when scrolling the note preview content. The gesture now only triggers when the swipe originates from the drag handle at the top of the card, not from the scrollable text area.

## [1.25.3] - 2026-07-05

### 🐛 Bug Fixes
- **Mobile Node Drag (Partial Fix)**: Completely rewrote touch drag handling. D3 drag is now mouse-only; touch drag uses native `setPointerCapture()` with a dedicated `pointerdown → pointermove → pointerup` path on the canvas. (Note: D3 zoom was still catching the events and panning the canvas simultaneously; fully fixed in v1.25.5.)
- **Mobile UI Bounds**: Canvas control buttons (Sidebar, Export, Help) now stack vertically (`flex-direction: column`) so they never overflow horizontally on narrow screens. Fixed z-index token references across modals and overlay elements.
- **Z-Index System**: Replaced magic `z-index` numbers with a 11-tier CSS token scale (`--z-canvas-overlay` → `--z-toast: 9999`).

### ✨ Improvements
- **Premium Canvas Button Style**: Floating canvas controls upgraded to glassmorphism with gradient border, violet glow on hover, lift + scale active animation.
- **Button Design System**: Unified `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.btn-danger`, `.btn-sm/md/lg` classes with glassmorphism, shimmer sheen, and micro-animations applied across all interactive elements.
- **Review Modal**: Now uses `glass-panel`, correct `overflow`, and safe-area padding.



## [1.25.2] - 2026-07-05

### 🐛 Bug Fixes
- **Mobile Node Unpinning**: Fixed an issue where the long-press unpin gesture would immediately re-pin the node. The unpin gesture now correctly frees nodes. (Note: dragging a node to a new position on mobile was still broken — D3 drag `event.x/y` coordinate mapping was incorrect for touch; fully fixed in v1.25.5.)
- **Wiki-link Rendering**: Added `[[Note Title]]` → `#wiki-` link conversion in the Editor preview and Mobile Mini Card so wiki-links appear as visible anchor elements. (Note: the links were still not clickable due to DOMPurify stripping `#wiki-` hrefs; fully fixed in v1.25.4.)
- **Mobile Mini Card Content**: Wiki-link text in the mobile floating Note Mini Card now renders as styled anchor elements (previously rendered as plain text).
- **Mobile Layout Bounds**: Fixed canvas control overlays (sidebar button, export button, help button) colliding with the bottom navigation and timeline scrubber in vertical mode by safely anchoring them to the top of the viewport.



## [1.25.1] - 2026-07-05

### 🐛 Bug Fixes
- **Desktop Header UI**: Removed the redundant search button icon from the top-right desktop header, since the primary floating search button provides the same functionality.



## [1.25.0] - 2026-07-05

### 📱 Mobile View UX Fixes
- **Long-Press to Unpin**: Implemented native long-press gesture (hold 500ms) to unpin pinned nodes on touch screens. This only freed pinned nodes — dragging nodes to a new position on mobile was still non-functional at this version.
- **Mobile Page Management**: Replaced placeholder page title pill in mobile header with a fully functional dropdown selector to easily switch between graph pages. Added edit and delete buttons to mobile view.
- **Review Modal Crash Fix**: Fixed a silent initialization crash in the Spaced Repetition Review modal on slower devices by adding a robust loading state when checking for due notes.


## [1.24.0] - 2026-07-04

### ✨ System Audit & Refactoring
- **Complete Codebase Audit**: Successfully audited and cleaned up the entire project directory.
- **Strict Typing Enforcement**: Eliminated 40+ remaining TypeScript compilation errors, removing loose `any` types in favor of `unknown` for safer try/catch logic.
- **Performance Fixes**: Fixed cascading `setState` render loops in complex modals (`AskAiModal`, `CommandPalette`, `ColorPicker`, `DiscoveryDigestModal`).
- **Dependency Cleanups**: Fixed extensive `react-hooks/exhaustive-deps` missing dependencies across `App.tsx` and `GraphCanvas.tsx`.
- **Removed Tech Debt**: Cleaned up legacy scripts, redundant console logs, and intermediate test files from the root.

### 📱 Mobile UI Enhancements
- **New Mobile Navigation**: Replaced the mobile search bar with a dedicated quick-add node button for better accessibility.
- **Menu Animations**: Added fluid slide animations to the mobile menu. Attempted to improve touch drag responsiveness — tap-to-select reliability improved, but free dragging of nodes on mobile remained non-functional.
- **Graph Controls**: Intelligently hid bulky GraphCanvas controls (zoom/help boxes) on mobile screens for an unobstructed view.
- **Bug Fixes**: Resolved layout collapse in settings scroll, timeline scrubber clipping, and mobile nav button bounding sizes.

## [1.23.0] — 2026-07-04

### ✨ AI Batch Action Engine
- AI Co-Author can now generate entire connected sub-graphs from a single prompt.
- The AI safely proposes multiple notes and links inside a unified JSON array payload.
- Safe actions (creating notes, creating links) execute instantly in batch.
- Unsafe actions (editing or deleting notes) are staged and presented for sequential user confirmation via an updated slide-up toast.

## [1.22.1] — 2026-07-04

### 🐛 Bug Fixes
- Fixed mobile popup swipe-up gesture triggering unintentionally when scrolling note content.
- Corrected the mobile sidebar / editor slide animation to appear from the bottom instead of sliding from the side.
- Fixed node interaction radius on mobile so tapping a node more reliably selects it. (Note: dragging nodes to move them on mobile remained broken at this version.)

## [1.22.0] — 2026-07-04

### 🧠 AI Intelligence Layer
- **AI Connection Discovery**: After writing a note, the system silently scans your graph and suggests potential links with a 1-sentence reason, helping you discover hidden connections.
- **"Why Connected?" Edge Explanations**: Hovering over any edge on the Graph Canvas now generates and caches an AI explanation of the semantic relationship between those two connected ideas.
- **Daily Discovery Digest**: Upon first opening the app each day, a new modal surprises you with a fascinating connection between a forgotten note (> 1 month old) and a recent thought.
- **100% Local Voice Input**: Added a microphone button that transcribes your speech completely offline directly in the browser (via Web Worker `Xenova/whisper-tiny.en`), turning your voice into new graph nodes without compromising privacy. Also added an instant Cloud (SpeechRecognition) fallback option in Settings.
- **Graph-Aware Spaced Repetition**: Review sessions are now clustered intelligently. When you review a note, its overdue linked neighbors are interleaved next, allowing you to study concepts in natural associative flows rather than randomly.

### 🐛 Bug Fixes
- Fixed structural CSS issues that caused the mobile bottom navigation bar to be clipped entirely off-screen.
- Corrected `.right-sidebar` positioning on mobile screens to respect navigation bar height, resolving scrolling bugs.
- Stopped forcing `44px` minimum dimensions on generic button elements which deformed compact utility icons.
- Prevented the app header from excessive wrapping on small screens.

### 🔧 Improvements
- Replaced the text-based `⌘K` search hint in the header with a dedicated, clickable Search icon button for better accessibility.
- Removed the 30-minute GitHub Pages deployment cooldown/timeout from the CI/CD pipeline.

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

## [1.20.0] - 2026-07-03

### 🏗️ Architecture
- **Local-First Rebuild**: Completely removed the experimental Node.js sync server (`yjs` & `y-webrtc`) in favour of a purely offline, local-first architecture — improved privacy and significantly reduced bundle size.

### 🐛 Bug Fixes
- **AI CORS Handling**: Fixed a critical CORS preflight issue where custom proxy headers (`Originator`, `User-Agent`) were incorrectly sent to direct browser endpoints. The AI client now only applies spoof headers when communicating via a proxy URL or AgentRouter.

### ✨ Improvements
- **Universal Model Config**: Unlocked the Model name input field and "Detect Models" button for all AI providers (OpenAI, DeepSeek, Anthropic, Google). Users can directly specify or detect fine-tuned model IDs across any platform.
- **UI Animations**: Added smooth CSS transitions to the search overlay toggle button.

## [1.19.4] - 2026-07-02

### 🐛 Bug Fixes
- **Offline Mode**: The public Yjs demo server fallback (`wss://demos.yjs.dev`) was rejecting connections on GitHub Pages. The app now detects GitHub Pages and gracefully falls back to *Offline / Single-Player Mode* instead of repeatedly failing to connect.

## [1.19.3] - 2026-07-02

### 🐛 Bug Fixes
- **GitHub Pages Compatibility**: Added intelligent fallback logic to AI Proxy and Sync features. The app now gracefully intercepts connection attempts instead of timing out when hosted on `github.io`, displaying a clear alert.
- **Sync Fallback**: Automatically redirects to a public demo server (`wss://demos.yjs.dev/aethermind`) when on `github.io` so basic syncing continues without a custom backend.
- **AgentRouter Auth**: Improved error handling for 401 Unauthorized responses — an explicit alert now surfaces instead of silently failing in the console.

## [1.19.2] - 2026-07-02

### 🐛 Bug Fixes
- **Mixed Content Security**: Implemented dynamic protocol resolution for the `y-websocket` client and AI Proxy. The app now upgrades `ws://` → `wss://` and `http://` → `https://` when loaded in a secure context (e.g. GitHub Pages), preventing hard browser security blocks.

## [1.19.1] - 2026-07-02

### 🐛 Bug Fixes
- **Sync Protocol**: Rewrote the WebSocket client in `syncManager.ts` to use the official `WebsocketProvider` from `y-websocket`, fixing critical `Unexpected end of array` crashes caused by raw Yjs buffers being pushed incorrectly.
- **Node v26 Compatibility**: Hardened the sync server by pinning `y-websocket` to v2.0.4 (restoring the `bin/utils` export) and upgrading `lib0` to fix binary parser incompatibilities on modern Node versions.

## [1.19.0] - 2026-07-01

### ✨ Improvements
- **AgentRouter WAF Bypass**: Integrated advanced header spoofing (`Originator: codex_cli_rs`) into the AI proxy to bypass strict client firewalls on third-party gateways like AgentRouter and OpenRouter.
- **AI Summary UI**: Refined the AI Summarise popup — removed redundant close buttons and applied premium gradient style to the "Insert into Note" button.
- **Sync Automation**: Integrated `concurrently` so `npm run dev` automatically starts both the Vite frontend and backend sync server. Fixed zombie port process locking.

### 🐛 Bug Fixes
- **API URL Normalisation**: Hardened URL path handling for custom AI base URLs, eliminating double `/v1/v1` concatenation errors and gracefully handling missing model endpoints (404 silencing).

## [1.18.0] - 2026-07-01

### 🐛 Bug Fixes
- **Responsive Overflow**: Added bounding sizes for sidebars and panels to prevent overflow off-screen on smaller viewports.

## [1.17.0] - 2026-06-30

### ✨ Improvements
- **Collapsible Search & Branding**: The search and filter overlay is now collapsible to save screen space, with fluid slide animations. Replaced the default Vite logo with the official AetherMind Brain logo.

## [1.16.0] - 2026-06-30

### 📱 Responsive UI
- **Layout Overhaul**: Implemented responsive layouts across all components. Components automatically resize and re-flow into a mobile-friendly layout on smaller screens. The sidebar converts into a fluid overlay; the top navigation wraps dynamically.

## [1.15.1] - 2026-06-29

### ✨ Improvements
- **Animation Overhaul**: Added fluid, bouncy CSS `@keyframes` (spring-like cubic-beziers and blur filters) to all transition states globally.

### 🐛 Bug Fixes
- **Sidebar Transition**: Corrected missing width transitions for the right-sidebar toggle.

## [1.15.0] - 2026-06-29

### 🏗️ Architecture
- **Modular Settings**: Completely refactored the monolithic `SettingsModal.tsx` into tabbed components (`AiSettingsTab`, `SyncSettingsTab`, `DataSettingsTab`, `PluginSettingsTab`). Added `React.lazy` to `GraphCanvas` to reduce initial bundle load time.

### 🔒 Security
- **XSS Mitigation**: Installed DOMPurify to sanitise Markdown preview output in `EditorPanel.tsx`, mitigating Stored XSS vulnerabilities.

### ♿ Accessibility
- **ARIA Labels**: Added `aria-label` to all icon-only buttons across `ColorPicker`, `ConfirmModal`, `PromptModal`, `RenamePageModal`, `ReviewModal`, and `EditorPanel`.

### 🔧 Improvements
- **SEO & Metadata**: Injected descriptive title tags, meta descriptions, and Open Graph data into `index.html`.
- **Performance**: Refactored global CSS transitions — removed layout-thrashing `transition: all` patterns, constraining transitions to composite-only properties (`transform`, `opacity`) for smooth 60fps graph interactions.

## [1.14.0] - 2026-06-28

### 🏗️ Architecture
- **Codebase Audit**: Removed junk files, added `.env` to `.gitignore`, and scrubbed sensitive debug logs from `ocr.ts` and `syncManager.ts`.

### 🔒 Security
- **Dependency Patches**: Ran `npm audit fix` across client and `sync-server` to patch nested prototype pollution vulnerabilities.

### 📄 Documentation
- **README**: Created `README.md` documenting the local-first architecture, ML setup, and sync server deployment.

## [1.13.0] - 2026-06-27

### ✨ Improvements
- **AI Settings UI**: The "Model Name" field is now hidden unless required (Custom or Vercel AI Gateway), making the settings panel cleaner.
- **Provider Consistency**: Base URLs are strictly enforced and locked to official endpoints for standard providers.
- **Dropdown Styling**: Styled the AI Provider dropdown to match the global glassmorphic `meta-select` design.
- **Vercel AI Gateway**: Unlocked base URL and model name fields for Vercel AI Gateway to support user-specific endpoints.

## [1.12.0] - 2026-06-26

### ✨ Improvements
- **Custom Modals**: Replaced all native browser popups (`alert`, `confirm`, `prompt`) with advanced glassmorphic modals and toast notifications.
- **Multi-Provider AI**: Implemented native browser support for Anthropic, DeepSeek, OpenAI, Google, OpenRouter, and Vercel AI Gateway without requiring external proxies.

## [1.11.0] - 2026-06-25

### ✨ New Features
- **Voice-to-Text**: Added cross-browser Voice-to-Text dictation using local WebAssembly models (Whisper) — fully offline, no API key needed.
- **Text-to-Speech**: Added "Read Aloud" functionality using the Web Speech API.
- **Plugin Ecosystem**: Exposed `window.AetherMindApi` with global hooks for UI navigation, settings, and note management. Initialised Plugin Manager.

### 🐛 Bug Fixes
- Fixed sidebar to consistently default to Preview Mode when opening a new node.

## [1.10.5] - 2026-06-24

### 🐛 Bug Fixes
- Made sidebar placeholder text and empty-state text unselectable to improve UI feel.

## [1.10.4] - 2026-06-24

### ✨ Improvements
- **Button Redesign**: Redesigned sidebar icon buttons and tab buttons with premium glassmorphism styling, shadows, and hover animations.

## [1.10.3] - 2026-06-24

### 🐛 Bug Fixes
- Repositioned "Help" and "Sidebar" buttons to the top-right corner of the graph canvas.
- Fixed node color reactivity — changes to default node colors in Settings now update the graph immediately.
- Fixed node aura and link color to correctly reflect the selected node's color instead of a default heatmap red.

## [1.10.0] — [1.10.2] - 2026-06-23

### ✨ New Features
- **AI Integration**: Added "Ask AI" modal and "Auto-tagging" features supporting OpenAI and Anthropic.

### 🎨 UI/UX
- Added premium dark mode styles and glassmorphism elements across the app.

## [1.9.0] - 2026-06-22

### ✨ New Features
- **Web Clipper Extension**: Created a Chrome extension to save web pages directly into AetherMind.
- **File Uploads & OCR**: Integrated image uploading with OCR text extraction.

## [1.8.0] - 2026-06-21

### ✨ New Features
- **Timeline Slider & Journal Calendar**: View notes chronologically and scrub through knowledge base history.
- **Pages**: Introduced the Pages concept — group multiple notes under specific workspaces (e.g. Default Graph vs. custom pages).

## [1.7.0] - 2026-06-20

### ✨ New Features
- **Excalidraw Whiteboard**: Integrated Excalidraw for embedded visual whiteboards inside notes.
- **Export to HTML**: Added note export as standalone HTML files.

## [1.6.0] - 2026-06-19

### ✨ New Features
- **Command Palette**: Added `Ctrl+K` / `Cmd+K` command palette for quick navigation and actions.
- **Global Search**: Added full-text search bar across all notes.

## [1.5.0] - 2026-06-18

### ✨ New Features
- **Markdown Enhancements**: Added Prism.js syntax highlighting for code blocks.
- **Wiki Links**: Added `[[Note Title]]` syntax to automatically create graph connections between notes.

## [1.0.0] — [1.4.0] - 2026-06-01

### 🚀 Initial Release
- **Local-First Architecture**: Built on Dexie.js (IndexedDB) — all data stored offline in the browser.
- **D3.js Force Graph**: Implemented a force-directed graph simulation for organic, interconnected note navigation.
- **Core Features**: Note creation, editing, tagging, and category colour customisation.
