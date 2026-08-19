# Technical Reference

Comprehensive reference manual for **AetherMind** CSS tokens, keyboard shortcuts, database schemas, and mathematical algorithms.

---

## 1. Keyboard Shortcuts

| Shortcut (Mac) | Shortcut (Win/Linux) | Action |
| :--- | :--- | :--- |
| `⌘ + K` | `Ctrl + K` | Open Spotlight Command Palette |
| `⌘ + N` | `Ctrl + N` | Create a new note |
| `⌘ + /` | `Ctrl + /` | Toggle Editor Panel open / closed |
| `Escape` | `Escape` | Dismiss active modal / close search / deselect note |
| `Enter` (in search) | `Enter` | Select highlighted result |
| `Double Click` (Canvas) | `Double Click` | Create note at mouse coordinates |

---

## 2. Design Tokens & CSS Variables

### Surfaces & Glass Panels
| Variable | Description |
| :--- | :--- |
| `--bg-primary` | Main workspace backdrop & canvas canvas background |
| `--bg-secondary` | Secondary glass surface panel background |
| `--surface-glass` | Translucent glass backdrop (`rgba(13, 18, 38, 0.82)`) |
| `--surface-glass-heavy` | Opaque navigation dock & modal header background |
| `--surface-pill-bg` | Low-contrast button background, search pills, filter chips |
| `--surface-badge-bg` | Category tags and metadata chips |
| `--card-nested-bg` | Nested settings cards, command items, and list containers |
| `--dot-grid-color` | Canvas background dot matrix color |

### Motion & Easing
| Variable | Value | Purpose |
| :--- | :--- | :--- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Deceleration for modals, dialogs, and popovers |
| `--ease-spring` | `cubic-bezier(0.32, 0.72, 0, 1)` | Button press recovery & kinetic micro-motion |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Mobile drawer swipe-up physics |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Morphing state transitions |

### Z-Index Layering Scale
| Variable | Value | Description |
| :--- | :--- | :--- |
| `--z-canvas-overlay` | `10` | Floating canvas buttons & HUD |
| `--z-controls` | `20` | Zoom buttons and filter triggers |
| `--z-panel` | `30` | Resizable editor sidebar |
| `--z-dropdown` | `40` | Contextual menus |
| `--z-mobile-nav` | `100` | Fixed bottom mobile dock |
| `--z-modal-backdrop` | `900` | Backdrop overlay dimmers |
| `--z-command-palette`| `950` | Spotlight command launcher |
| `--z-modal` | `1000` | Standard modal dialogs |
| `--z-popover` | `1100` | Floating color pickers & tooltips |
| `--z-toast` | `9999` | Ephemeral notifications |

---

## 3. Spaced Repetition (SM-2 Algorithm)

When a note is graded $q \in \{1, 2, 3, 4\}$:

1. **Ease Factor Update**:
   $$EF' = \max\left(1.3, EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))\right)$$
2. **Interval Calculation**:
   $$I(n) = \begin{cases} 
   1 \text{ day} & n = 1 \\
   6 \text{ days} & n = 2 \\
   I(n-1) \times EF & n > 2 \text{ (if } q \ge 3) \\
   0 \text{ days (reset)} & q < 2
   \end{cases}$$
3. **Next Review Timestamp**:
   $$\text{nextReview} = \text{Date.now}() + I(n) \times 86400000 \text{ ms}$$
