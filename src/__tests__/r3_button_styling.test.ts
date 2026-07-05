import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Requirement R3: Premium Button Styling
 * - Glassmorphism (backdrop-filter: blur, translucent surfaces, subtle glow borders)
 * - Subtle gradients (135deg multi-stop gradients)
 * - Micro-animations (:active scale(0.96), ::after sheen translation, hover glows)
 * - Padding & border-radius standards in index.css
 */

describe('R3: Premium Button Styling (Tier 1: Feature Coverage)', () => {
  const indexCss = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8');

  it('R3-T1-1: applies glassmorphism blur and translucent backgrounds to panels and floating buttons', () => {
    expect(indexCss).toContain('backdrop-filter: blur(16px)');
    expect(indexCss).toContain('-webkit-backdrop-filter: blur(16px)');
    expect(indexCss).toContain('background: linear-gradient(135deg, rgba(15, 20, 50, 0.85) 0%, rgba(8, 12, 35, 0.9) 100%)');
  });

  it('R3-T1-2: uses subtle 135deg multi-stop gradients for primary buttons', () => {
    expect(indexCss).toContain('background: linear-gradient(135deg, var(--accent-primary), #4f46e5)');
    expect(indexCss).toContain('background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))');
  });

  it('R3-T1-3: implements sheen micro-animation overlay on primary buttons (::after pseudo-element)', () => {
    expect(indexCss).toContain('.header-btn.primary-btn::after');
    expect(indexCss).toContain('background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)');
    expect(indexCss).toContain('transform: translateX(-100%)');
    expect(indexCss).toContain('transform: translateX(100%)');
  });

  it('R3-T1-4: provides active press micro-animation scaling (transform: scale(0.96)) on interactive buttons', () => {
    expect(indexCss).toContain('.header-btn:active:not(:disabled)');
    expect(indexCss).toContain('transform: scale(0.96)');
    expect(indexCss).toContain('.icon-btn:active:not(:disabled)');
  });

  it('R3-T1-5: enforces standardized border-radius rules (6px, 8px, 12px, 20px) across button classes', () => {
    // Check .header-btn border-radius: 8px
    expect(indexCss).toMatch(/\.header-btn\s*\{[^}]*border-radius:\s*8px/);
    // Check .glass-panel border-radius: 12px
    expect(indexCss).toMatch(/\.glass-panel\s*\{[^}]*border-radius:\s*12px/);
    // Check .search-toggle-btn border-radius: 20px
    expect(indexCss).toMatch(/\.search-toggle-btn\s*\{[^}]*border-radius:\s*20px/);
    // Check .tab-btn border-radius: 8px
    expect(indexCss).toMatch(/\.tab-btn\s*\{[^}]*border-radius:\s*8px/);
  });
});

describe('R3: Premium Button Styling (Tier 2: Boundary & Corner Cases)', () => {
  const indexCss = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8');

  it('R3-T2-1: styles disabled state cleanly with reduced opacity (0.5) and not-allowed cursor', () => {
    expect(indexCss).toContain('.header-btn:disabled');
    expect(indexCss).toContain('opacity: 0.5');
    expect(indexCss).toContain('cursor: not-allowed');
  });

  it('R3-T2-2: enforces 1:1 aspect ratio on icon-only header buttons', () => {
    expect(indexCss).toContain('.icon-only-btn');
    expect(indexCss).toContain('aspect-ratio: 1');
    expect(indexCss).toContain('padding: 8px');
  });

  it('R3-T2-3: elevates box-shadow glow intensity on hover for primary action buttons', () => {
    expect(indexCss).toContain('box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4)');
    expect(indexCss).toContain('box-shadow: 0 4px 20px rgba(124, 58, 237, 0.6)');
  });

  it('R3-T2-4: styles danger variant action buttons with distinct rose accent (#f43f5e)', () => {
    expect(indexCss).toContain('.settings-action-btn.danger-btn');
    expect(indexCss).toContain('color: #f43f5e');
    expect(indexCss).toContain('background: rgba(244, 63, 94, 0.06)');
  });

  it('R3-T2-5: includes keyframe animation suite (fadeScaleIn, slideInTop, slideInRight, slideInBottom) for smooth transitions', () => {
    expect(indexCss).toContain('@keyframes fadeScaleIn');
    expect(indexCss).toContain('@keyframes slideInTop');
    expect(indexCss).toContain('@keyframes slideInRight');
    expect(indexCss).toContain('@keyframes slideInBottom');
  });
});
