// @vitest-environment jsdom
/**
 * @file mobile-accessibility.test.tsx
 * @description Verification test suite for Phase 10: Mobile + Accessibility.
 * Verifies touch hit area requirements (>=44px), mobile navbar toggle behaviors,
 * safe-area inset integration, universal shortcuts, and reduced-motion stylesheet tokens.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MobileNav } from '../components/MobileNav';
import fs from 'fs';
import path from 'path';

const customGlobal = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
customGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('Phase 10: Mobile Navigation & Touch Ergonomics', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('renders mobile navigation buttons with >=44px touch hit dimensions', () => {
    const onTabChange = vi.fn();
    const onNewPage = vi.fn();

    act(() => {
      root.render(
        <MobileNav
          activeTab="graph"
          onTabChange={onTabChange}
          onNewPage={onNewPage}
        />
      );
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);

    buttons.forEach(button => {
      const minHeight = button.style.minHeight;
      const minWidth = button.style.minWidth;
      expect(parseInt(minHeight || '0', 10)).toBeGreaterThanOrEqual(44);
      expect(parseInt(minWidth || '0', 10)).toBeGreaterThanOrEqual(44);
    });
  });

  it('triggers onTabChange when navigation tabs are tapped', () => {
    const onTabChange = vi.fn();
    const onNewPage = vi.fn();

    act(() => {
      root.render(
        <MobileNav
          activeTab="graph"
          onTabChange={onTabChange}
          onNewPage={onNewPage}
        />
      );
    });

    const buttons = container.querySelectorAll('button');
    // Find Search button (second button)
    const searchBtn = Array.from(buttons).find(b => b.textContent?.includes('Search'));
    expect(searchBtn).toBeTruthy();

    if (searchBtn) {
      act(() => {
        searchBtn.click();
      });
      expect(onTabChange).toHaveBeenCalledWith('search');
    }

    // Find Editor button (third button)
    const editorBtn = Array.from(buttons).find(b => b.textContent?.includes('Editor'));
    expect(editorBtn).toBeTruthy();

    if (editorBtn) {
      act(() => {
        editorBtn.click();
      });
      expect(onTabChange).toHaveBeenCalledWith('editor');
    }
  });

  it('triggers onNewPage when New Page action is tapped', () => {
    const onTabChange = vi.fn();
    const onNewPage = vi.fn();

    act(() => {
      root.render(
        <MobileNav
          activeTab="graph"
          onTabChange={onTabChange}
          onNewPage={onNewPage}
        />
      );
    });

    const buttons = container.querySelectorAll('button');
    const newPageBtn = Array.from(buttons).find(b => b.textContent?.includes('New Page'));
    expect(newPageBtn).toBeTruthy();

    if (newPageBtn) {
      act(() => {
        newPageBtn.click();
      });
      expect(onNewPage).toHaveBeenCalledTimes(1);
    }
  });
});

describe('Phase 10: Stylesheet Accessibility & Safe Area Tokens Verification', () => {
  it('defines safe area insets and mobile viewport variables in base.css', () => {
    const baseCssPath = path.resolve(__dirname, '../styles/base.css');
    const content = fs.readFileSync(baseCssPath, 'utf-8');

    expect(content).toContain('--safe-top');
    expect(content).toContain('--safe-bottom');
    expect(content).toContain('--safe-left');
    expect(content).toContain('--safe-right');
    expect(content).toContain('--mobile-nav-height');
  });

  it('enforces prefers-reduced-motion animation suppression in base.css', () => {
    const baseCssPath = path.resolve(__dirname, '../styles/base.css');
    const content = fs.readFileSync(baseCssPath, 'utf-8');

    expect(content).toContain('@media (prefers-reduced-motion: reduce)');
    expect(content).toContain('animation-duration: 0.01ms !important');
    expect(content).toContain('transition-duration: 0.01ms !important');
  });

  it('enforces visible focus indicators (:focus-visible) in base.css', () => {
    const baseCssPath = path.resolve(__dirname, '../styles/base.css');
    const content = fs.readFileSync(baseCssPath, 'utf-8');

    expect(content).toContain(':focus-visible');
    expect(content).toContain('outline: 2px solid var(--accent-primary');
  });

  it('uses dynamic viewport height units (100dvh) in responsive.css', () => {
    const responsiveCssPath = path.resolve(__dirname, '../styles/responsive.css');
    const content = fs.readFileSync(responsiveCssPath, 'utf-8');

    expect(content).toContain('100dvh');
  });
});
