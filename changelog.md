# Changelog

## [1.25.0] - 2026-07-05

### 📱 Mobile View UX Fixes
- **Graph Dragging Fix**: Resolved issue where long-pressing a node on mobile would trigger the context menu and interrupt drag operations by adding strict touch-action and contextmenu preventions.
- **Mobile Page Management**: Replaced placeholder page title pill in mobile header with a fully functional dropdown selector to easily switch between graph pages. Added edit and delete buttons to mobile view.
- **Review Modal Crash Fix**: Fixed a silent initialization crash in the Spaced Repetition Review modal on slower devices by adding a robust loading state when checking for due notes.


## [1.24.0] — 2026-07-04

### ✨ System Audit & Refactoring
- **Complete Codebase Audit**: Successfully audited and cleaned up the entire project directory.
- **Strict Typing Enforcement**: Eliminated 40+ remaining TypeScript compilation errors, removing loose `any` types in favor of `unknown` for safer try/catch logic.
- **Performance Fixes**: Fixed cascading `setState` render loops in complex modals (`AskAiModal`, `CommandPalette`, `ColorPicker`, `DiscoveryDigestModal`).
- **Dependency Cleanups**: Fixed extensive `react-hooks/exhaustive-deps` missing dependencies across `App.tsx` and `GraphCanvas.tsx`.
- **Removed Tech Debt**: Cleaned up legacy scripts, redundant console logs, and intermediate test files from the root.

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
- Fixed node drag-and-drop on mobile not responding due to mismatched touch padding in the interaction radius.

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

# v1.20.0
- **Local-First Architecture**: Completely removed the experimental Node.js sync server (`yjs` & `y-webrtc`) in favor of a purely offline, local-first architecture for improved privacy and reduced bundle size.
- **Smart AI CORS Handling**: Fixed a critical CORS preflight issue where custom proxy headers (`Originator`, `User-Agent`) were incorrectly sent to direct browser endpoints. The AI Client now intelligently applies spoof headers only when communicating via the proxy URL or specifically to AgentRouter.
- **Universal Model Configuration**: Unlocked the Model name input field and "Detect Models" button for all AI providers (OpenAI, DeepSeek, Anthropic, Google). Users can now directly specify or detect fine-tuned model IDs across any platform.
- **UI Animations**: Added smooth CSS transitions to the search overlay toggle button.

# v1.19.4
- **Offline Mode Fix**: The public Yjs demo server fallback (`wss://demos.yjs.dev`) was rejecting connections on GitHub Pages. The app now detects GitHub Pages and gracefully falls back to *Offline/Single-Player Mode* instead of repeatedly failing to connect to a WebSocket.

# v1.19.3
- **GitHub Pages Compatibility**: Added intelligent fallback logic to the AI Proxy and Sync features. Because GitHub Pages is static and cannot host the Node.js backend, the app now gracefully intercepts those connection attempts instead of timing out, displaying a clear alert to the user.
- **Sync Fallback**: Automatically redirects to a public demo server (`wss://demos.yjs.dev/aethermind`) when hosted on `github.io` so that basic syncing operations continue to work without a custom backend.
- **AgentRouter Authentication**: Improved error handling for 401 Unauthorized API responses. An explicit alert popup now alerts the user to supply a valid API key instead of silently failing in the console.

# v1.19.2
- **Mixed Content Security Fix**: Implemented dynamic protocol resolution for both the `y-websocket` client (`syncManager.ts`) and the AI Proxy (`aiClient.ts`). The app now gracefully upgrades `ws://` to `wss://` and `http://` to `https://` when loaded in a secure context (like GitHub Pages), preventing hard browser security crashes.

# v1.19.1
- **Sync Protocol Fix**: Rewrote the WebSocket client inside `syncManager.ts` to use the official `WebsocketProvider` from `y-websocket`. This fixes the critical `Unexpected end of array` crashes caused by raw Yjs buffers being incorrectly pushed to the backend server.
- **Node v26 Compatibility**: Hardened the sync server by rolling back `y-websocket` to `v2.0.4` (restoring the `bin/utils` export) while pushing `lib0` to the bleeding-edge latest version to fix binary parser incompatibilities on modern Node versions.

# v1.19.0
- **AgentRouter WAF Bypass**: Integrated advanced header spoofing (`Originator: codex_cli_rs`, `Roo Code` signatures) into the AI proxy to seamlessly bypass strict client firewalls on third-party AI gateways like AgentRouter and OpenRouter.
- **AI Summary UI Polish**: Refined the AI Summarize popup by removing redundant close buttons and applying the premium gradient style to the 'Insert into Note' button.
- **Sync Server Automation**: Integrated `concurrently` so that running `npm run dev` automatically spins up both the Vite frontend and the backend sync server seamlessly, while fixing zombie port process locking.
- **API URL Normalization**: Hardened URL path handling for custom AI base URLs, eliminating double `/v1/v1` path concatenation errors and gracefully handling missing model endpoints (`404` silencing).

# v1.18.0
- **Responsive Overflow**: Added bounding sizes for sidebars and panels to avoid overflow off the screen.

# v1.17.0
- **Collapsible Search & Branding**: The search and filter overlay is now collapsible to save screen space, accompanied by fluid slide animations. Replaced default Vite logo with the official AetherMind Brain logo.

# v1.16.0
- **Responsive UI Overhaul**: Implemented responsive layouts. Components automatically resize and re-flow into a mobile-friendly layout on smaller screens. The sidebar converts into a fluid overlay, and the top navigation wraps dynamically.

# v1.15.1
- **UI Animation Overhaul**: Added fluid and bouncy CSS @keyframes (using spring-like cubic-beziers and blur filters) to all transition states globally.
- **Sidebar Transition Fix**: Corrected missing width transitions for the right-sidebar toggle event.

# v1.15.0
- **Architecture Refactoring**: Completely modularized the monolithic `SettingsModal.tsx` into clean, tabbed components (`AiSettingsTab.tsx`, `SyncSettingsTab.tsx`, `DataSettingsTab.tsx`, `PluginSettingsTab.tsx`) acting as an orchestrator. Added `React.lazy` to `GraphCanvas` to optimize the main bundle load times.
- **Security & Vulnerability Fixes**: Installed DOMPurify to mitigate Stored XSS inside `EditorPanel.tsx` Markdown preview rendering.
- **UX & Accessibility Enhancements**: Conducted a `ux-audit` and `accessibility-audit`, adding `aria-label`s to all icon-only buttons (`ColorPicker`, `ConfirmModal`, `PromptModal`, `RenamePageModal`, `ReviewModal`, `EditorPanel`) to improve screen-reader compatibility and usability.
- **SEO & Metadata**: Injected high-quality SEO meta tags, title tags, and Open Graph structured data into `index.html`.
- **Motion Performance Improvements**: Refactored `index.css` global transitions. Removed layout-thrashing `transition: all` patterns and constrained them to composite-only properties (`transform`, `opacity`) for smooth 60fps graph interactions.

# v1.14.0
- **Pre-Push Codebase Audit**: Performed a comprehensive cleanup of junk files, added `.env` tracking to `.gitignore`, and scrubbed sensitive or spammy debug logs from production utility files (`ocr.ts`, `syncManager.ts`).
- **Security & Dependencies**: Executed non-breaking updates via `npm audit fix` across both the client and `sync-server` codebases to patch nested prototype pollution vulnerabilities.
- **Documentation Setup**: Created a formal `README.md` to document the local-first architecture, ML setup, and sync server deployment instructions.

# v1.13.0
- **Polished Multi-Provider AI Integration**: Base URLs are now strictly enforced and locked to official endpoints for standard providers to prevent errors.
- **Dynamic AI Settings UI**: The 'Model Name' field is now intelligently hidden unless required (Custom or Vercel AI Gateway), making the settings menu much cleaner.
- **Consistent Dropdowns**: Styled the AI Provider dropdown to match the sleek global glassmorphic 'meta-select' design used throughout the app.
- **Vercel AI Gateway Support**: Unlocked the base URL and model name for Vercel AI Gateway to correctly support user-specific gateway endpoints.

# v1.12.0
- Refactored native browser popups (alert, confirm, prompt) into advanced glassmorphic modals and toast notifications.
- Implemented Multi-Provider AI Integration (Anthropic, DeepSeek, OpenAI, Google, OpenRouter, Vercel AI Gateway) natively in the browser without requiring external proxies for compatibility.

# v1.11.0
- **Audio & Voice Capabilities**: Added cross-browser Voice-to-Text dictation using local WebAssembly models (Whisper), and Text-to-Speech (Read Aloud) functionality.
- **Plugin Ecosystem Foundation**: Exposed `window.AetherMindApi` with global hooks for UI navigation, settings, and note management. Initialized Plugin Manager.
- Fixed sidebar to consistently default to Preview Mode when opening a new node.

# v1.10.5
- Made sidebar placeholder text and empty state text unselectable (uncopyable) to improve UI feel.

# v1.10.4
- Redesigned sidebar buttons (icon buttons and tab buttons) with premium glassmorphism styling, shadows, and hover animations.

# v1.10.3
- Repositioned "Help" and "Sidebar" buttons to the top-right corner of the graph canvas.
- Fixed node color reactivity: Changes to node default colors in Settings now update immediately.
- Fixed node aura and link color logic to correctly reflect the selected node color instead of a default heatmap red.

# v1.10.0 - v1.10.2
- Core AI integration: Added "Ask AI" modal and "Auto-tagging" features (supporting OpenAI and Anthropic).
- UI/UX Refinements: Added premium dark mode styles and glassmorphism elements.

# v1.9.0
- Added Web Clipper Extension: Created Chrome extension to easily save web pages directly into AetherMind.
- Added File Uploads & OCR: Integrated image uploading with OCR text extraction.

# v1.8.0
- Added Timeline Slider & Journal Calendar: View notes chronologically and scrub through knowledge base history.
- Introduced Pages concept: Group multiple notes under specific pages (e.g., Default Graph vs other workspaces).

# v1.7.0
- Added Excalidraw Whiteboard integration: Create embedded visual whiteboards inside notes.
- Added Export to HTML functionality.

# v1.6.0
- Added Command Palette (Ctrl+K / Cmd+K) for quick navigation and commands.
- Added Global Search Bar with full-text search across all notes.

# v1.5.0
- Markdown Editor enhancements: Added Prism.js syntax highlighting.
- Added `[[Wiki Link]]` syntax to automatically create connections between nodes.

# v1.0.0 - v1.4.0
- Initial Release: Local-first personal knowledge graph using Dexie.js (IndexedDB).
- Implemented D3.js Force-Directed Graph simulation for organic note navigation.
- Basic note creation, editing, tagging, and category color customization.
