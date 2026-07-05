import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Requirement R2: Mobile UI Layout Bounds
 * - Overlay collision checks & z-index stacking
 * - Portrait mode max-width: 767px bounds & responsive drawers
 * - Bottom navigation bar safety (--mobile-nav-height: 60px, safe-area bottom insets)
 */

describe('R2: Mobile UI Layout Bounds (Tier 1: Feature Coverage)', () => {
  const indexCss = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8');

  it('R2-T1-1: defines --mobile-nav-height as 60px and safe area insets in CSS root variables', () => {
    expect(indexCss).toContain('--mobile-nav-height: 60px');
    expect(indexCss).toContain('--safe-bottom: env(safe-area-inset-bottom, 0px)');
  });

  it('R2-T1-2: configures search-filter-panel max-width to constrain within mobile screen bounds', () => {
    expect(indexCss).toContain('max-width: calc(100vw - 32px)');
    // Check mobile media query override for search panel width
    expect(indexCss).toMatch(/\.search-filter-panel\s*\{\s*width:\s*calc\(100%\s*-\s*16px\)/);
  });

  it('R2-T1-3: ensures timeline-slider-panel clears mobile navigation bar height on small screens', () => {
    expect(indexCss).toContain('bottom: calc(var(--mobile-nav-height) + 16px)');
  });

  it('R2-T1-4: configures right-sidebar to render as full-width fixed drawer with translateY transition on mobile (<767px)', () => {
    expect(indexCss).toContain('bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-bottom, 0px))');
    expect(indexCss).toContain('width: 100% !important');
    expect(indexCss).toContain('transform: translateY(100%)');
    expect(indexCss).toContain('transform: translateY(0)');
  });

  it('R2-T1-5: maintains strict z-index hierarchy between modals, toasts, nav bars, and canvas overlays', () => {
    const mobileNavTsx = fs.readFileSync(path.resolve(__dirname, '../components/MobileNav.tsx'), 'utf-8');
    expect(indexCss).toContain('--z-modal: 100');
    expect(indexCss).toContain('--z-toast: 9999');
    
    // Toast notification z-index
    expect(indexCss).toMatch(/\.toast-container\s*\{[^}]*z-index:\s*9999/);
    // Mobile nav z-index in MobileNav.tsx
    expect(mobileNavTsx).toContain('zIndex: 100');
    // Canvas overlay panels z-index
    expect(indexCss).toMatch(/\.search-filter-panel[\s\S]*?z-index:\s*5/);
    expect(indexCss).toMatch(/\.timeline-slider-panel[\s\S]*?z-index:\s*5/);
  });
});

describe('R2: Mobile UI Layout Bounds (Tier 2: Boundary & Corner Cases)', () => {
  const indexCss = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8');

  it('R2-T2-1: enforces max-width: 767px portrait layout media query rules', () => {
    expect(indexCss).toContain('@media (max-width: 767px)');
    expect(indexCss).toContain('@media (min-width: 480px) and (max-width: 767px)');
  });

  it('R2-T2-2: prevents horizontal overflow on ultra-small screens (<480px)', () => {
    expect(indexCss).toContain('@media (max-width: 479px)');
    expect(indexCss).toContain('overflow-x: hidden');
    expect(indexCss).toContain('overscroll-behavior: contain');
  });

  it('R2-T2-3: forces settings-modal to occupy 100% width and height on mobile screens (<767px)', () => {
    const mobileSettingsBlock = indexCss.match(/\.settings-modal\s*\{[^}]*width:\s*100% !important/);
    expect(mobileSettingsBlock).not.toBeNull();
    expect(indexCss).toContain('max-width: 100vw !important');
    expect(indexCss).toContain('max-height: 100vh !important');
  });

  it('R2-T2-4: hides desktop-only canvas sidebar trigger on mobile devices', () => {
    expect(indexCss).toMatch(/\.sidebar-tab-trigger\s*\{\s*display:\s*none !important;\s*\}/);
  });

  it('R2-T2-5: applies safe-area bottom padding to modal overlays to prevent home indicator obstruction', () => {
    expect(indexCss).toContain('padding-bottom: env(safe-area-inset-bottom, 0px)');
  });
});
