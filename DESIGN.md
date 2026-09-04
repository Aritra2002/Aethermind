# AetherMind — Design System Specification (DESIGN.md)

Spatial Canvas OS Protocol. Combines Linear Craft materiality, Vercel high-density precision, and Raycast spotlight command hierarchy.

---

## 1. Visual DNA & Palette

### Base Surfaces (Off-Black Ladder)
- --bg-canvas: #07080a (Deep cosmic plane with 24px subtle dot coordinate matrix)
- --surface-card: #0d0f17 (Movable spatial windows, floating cards)
- --surface-elevated: #141724 (Sub-panels, nested trays, flyouts)
- --surface-hud: rgba(13, 15, 23, 0.85) (Floating Dynamic Island dock)
- --surface-hover: rgba(255, 255, 255, 0.04)

### Hairline Borders & Glass Refraction
- --border-subtle: rgba(255, 255, 255, 0.08) (1px crisp perimeter)
- --border-focus: rgba(0, 242, 254, 0.60) (Electric cyan focus ring)
- --glass-refraction: inset 0 1px 0 rrgba(255, 255, 255, 0.08) (Edge prism highlight)
- --glass-blur: lur(20px) saturate(180%)

### Accents (Single High-Voltage Accent)
- --accent-cyan: #00f2fe (Primary interactive highlights, active state)
- --accent-violet: #8b5cf6 (Intelligence / AI copilot beacon)
- --accent-gold: #f59e0b (Spaced repetition review / bookmarks)
- --accent-danger: #f43f5e (Destructive action alerts)

---

## 2. Typography

- **Display & UI Chrome**: Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif
  - Font tracking: -0.025em for headings, -0.011em for body
  - Headings: text-wrap: balance to prevent typographic widows
- **Data & Tabular Figures**: JetBrains Mono, Fira Code, monospace
  - Enforce ont-variant-numeric: tabular-nums (tabular-nums) on all dates, timestamps, word counts, and zoom percentages
- **Editor Reading Column**: Centered line length capped at 65ch with leading-relaxed (1.65) for effortless long-form reading.

---

## 3. Spatial Layout & Windowing

### Infinite Canvas Desktop
- Viewport: min-h-[100dvh] edge-to-edge canvas plane without outer container gutters.
- Double-tap or double-click anywhere on open canvas creates a note at exact (x, y) world coordinates.

### Floating Dynamic Island HUD
- Desktop: Top-center floating pill dock (ackdrop-filter: blur(20px)).
- Mobile (<768px): Bottom-pinned dock respecting env(safe-area-inset-bottom).
- Includes:
  1. Workspace Page switcher (with inline quick-rename and add)
  2. Spotlight Search launcher (Ctrl+K / ⌘K)
  3. Quick Note creation (+)
  4. AI Intelligence trigger (✦)
  5. Spaced Repetition review pill (Review: N)
  6. Settings & Theme modal trigger

### Spatial Note Windows
- Desktop: Floating window card on canvas with title handle, minimize, split, maximize focus mode, and close.
- Mobile: Smooth 85vh swipeable bottom drawer with top grab handle and touch scrolling.

---

## 4. Motion & Micro-Interactions

- **Spring Physics**: Use exclusively spring curves (stiffness: 120, damping: 20 or cubic-bezier(0.23, 1, 0.32, 1)).
- **Tactile Active Press**: ctive:scale-[0.98] on buttons and floating cards.
- **Hardware Compositor Only**: Animate strictly via transform and opacity. Never animate width, height, top, or left.
- **Reduced Motion**: Fall back to immediate opacity cuts when @media (prefers-reduced-motion: reduce) is active.

---

## 5. OS-Aware Keyboard Badges

- macOS / iOS: Render ⌘K, ⌘N, ⌘/
- Windows / Linux: Render Ctrl+K, Ctrl+N, Ctrl+/
- Mobile Touch: Hide shortcut badges; render clean 44px+ touch targets.
