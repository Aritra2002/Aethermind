# Test Infrastructure & Architecture (`TEST_INFRA.md`)

## Overview

This repository contains a comprehensive, requirement-driven end-to-end (E2E) and component test suite for **Personal Knowledge Graph** (`AetherMind`). The test infrastructure follows the **Dual-Track & 4-Tier Testing Methodology** to ensure robust quality assurance across touch interactions, responsive layouts, and UI design systems.

---

## Architecture & Framework

- **Test Framework**: [Vitest](https://vitest.dev/) v4.x
- **Environment**: Node / JSDOM environment with TypeScript support
- **Directory Structure**:
  - `src/__tests__/r1_mobile_drag.test.ts` — R1: Mobile Node Drag Interaction (Tier 1 & Tier 2)
  - `src/__tests__/r2_mobile_layout.test.ts` — R2: Mobile UI Layout Bounds (Tier 1 & Tier 2)
  - `src/__tests__/r3_button_styling.test.ts` — R3: Premium Button Styling (Tier 1 & Tier 2)
  - `src/__tests__/tier3_cross_feature.test.ts` — Tier 3: Cross-Feature Pairwise Interaction Tests
  - `src/__tests__/tier4_real_world.test.ts` — Tier 4: Real-World Workloads & E2E User Scenarios
  - `src/__tests__/expect.ts` — Assertion utility wrapper
  - `tests/run-all.js` — Test runner entry script
  - `vitest.config.ts` — Vitest configuration file

---

## 4-Tier Test Categorization

### Tier 1: Feature Coverage Tests (>=5 tests per requirement area)
- **R1: Mobile Node Drag Interaction**
  - `R1-T1-1`: Screen-to-simulation touch coordinate math & canvas transform.
  - `R1-T1-2`: Mobile touch hit-target radius boost (`+8px` for touch / coarse pointers).
  - `R1-T1-3`: D3 drag lifecycle initialization & original coordinate tracking (`__originalFx`, `__originalFy`).
  - `R1-T1-4`: Coordinate positioning updates during active drag move.
  - `R1-T1-5`: Coordinates persistence (`updateNote` callback) on drag end.
- **R2: Mobile UI Layout Bounds**
  - `R2-T1-1`: `--mobile-nav-height: 60px` and safe area bottom inset configuration.
  - `R2-T1-2`: Search and filter overlay panel width and bounds.
  - `R2-T1-3`: Timeline scrubber panel bottom positioning (`bottom: calc(var(--mobile-nav-height) + 16px)`).
  - `R2-T1-4`: Mobile right-sidebar slide-up drawer transition (<767px).
  - `R2-T1-5`: Z-Index stacking hierarchy (Modal = 100, Toast = 9999, Mobile Nav = 100, Overlay = 5).
- **R3: Premium Button Styling**
  - `R3-T1-1`: Glassmorphism blur and translucent background styling (`backdrop-filter: blur(16px)`).
  - `R3-T1-2`: Multi-stop 135deg gradient backgrounds.
  - `R3-T1-3`: Primary button sheen micro-animation (`::after` pseudo-element translation).
  - `R3-T1-4`: Active button press scaling (`transform: scale(0.96)`).
  - `R3-T1-5`: Standardized border-radius (6px, 8px, 12px, 20px) across buttons.

### Tier 2: Boundary & Corner Cases (>=5 tests per requirement area)
- **R1: Mobile Node Drag Interaction**
  - `R1-T2-1`: Reversion of temporary pin if user taps without dragging (`__wasDragged === false`).
  - `R1-T2-2`: Node unpinning via mobile long-press gesture (>500ms touch hold).
  - `R1-T2-3`: Suppression of double-click note creation on mobile viewports (<767px).
  - `R1-T2-4`: Dragging under extreme zoom scale factors (0.1x to 4.0x zoom).
  - `R1-T2-5`: Disabling map zoom/pan filter when touch gesture hits an active node.
- **R2: Mobile UI Layout Bounds**
  - `R2-T2-1`: Enforcing max-width 767px portrait layout media queries.
  - `R2-T2-2`: Horizontal overflow prevention on small screens (<480px).
  - `R2-T2-3`: Settings modal 100% full-screen takeover on mobile screens (<767px).
  - `R2-T2-4`: Hiding desktop-only sidebar trigger on mobile devices.
  - `R2-T2-5`: Applying safe-area bottom padding to modal overlays.
- **R3: Premium Button Styling**
  - `R3-T2-1`: Disabled button state styling (`opacity: 0.5`, `cursor: not-allowed`).
  - `R3-T2-2`: Enforcing 1:1 aspect ratio on icon-only header buttons.
  - `R3-T2-3`: Elevating box-shadow glow intensity on button hover.
  - `R3-T2-4`: Danger action button styling with rose accent (`#f43f5e`).
  - `R3-T2-5`: Keyframe animation suite validation (`fadeScaleIn`, `slideInTop`, etc.).

### Tier 3: Cross-Feature Combination Tests
- `T3-1` (R1 + R2): Mobile node drag near search overlay panel bounds (375x667 portrait screen).
- `T3-2` (R1 + R3): Graph canvas drag interaction alongside glassmorphic floating buttons.
- `T3-3` (R2 + R3): Mobile Navigation Bar styling combining bottom safe area with active scale micro-animations.
- `T3-4` (R1 + R2 + R3): Mobile touch node drag while mobile sidebar drawer is open (<767px).
- `T3-5` (R2 + R3): Settings modal full-screen mobile layout with glassmorphic section cards & danger action buttons.

### Tier 4: Real-World Workloads & Scenarios
- `T4-1`: Scenario 1 - Mobile E2E user session flow on portrait screen (375x667).
- `T4-2`: Scenario 2 - High-density 100-node graph touch drag stress test.
- `T4-3`: Scenario 3 - Responsive orientation & viewport switch workflow (mobile to desktop).
- `T4-4`: Scenario 4 - Touch gesture disambiguation (Tap vs Drag vs Long-press).
- `T4-5`: Scenario 5 - Premium glassmorphism design system validation across project stylesheet.

---

## Test Invocation Commands

To execute the test suite, run:

```bash
# Standard test command (executes full test suite via Vitest)
npm test

# Direct Vitest invocation
npx vitest run

# Run with verbose output
npx vitest run --reporter=verbose
```
