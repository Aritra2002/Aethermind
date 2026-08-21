/**
 * @file keyboard-utils.test.ts
 * @description Unit tests verifying universal cross-platform shortcut handling across Mac, Windows, Android, and iOS.
 */

import { describe, it, expect } from 'vitest';
import {
  isApplePlatform,
  isMobileDevice,
  getPrimaryModifierKey,
  getModifierBadge,
  formatShortcut,
  formatShortcutBadge,
  isModifierKeyCombo
} from '../utils/keyboardUtils';

describe('Cross-Platform Universal Keyboard & Shortcut System', () => {
  it('detects platform modifier keys gracefully', () => {
    const mod = getPrimaryModifierKey();
    expect(['Ctrl', 'Cmd']).toContain(mod);

    const badge = getModifierBadge();
    expect(['Ctrl', '⌘']).toContain(badge);
  });

  it('formats shortcuts into human-readable strings', () => {
    const shortcutK = formatShortcut('k');
    expect(shortcutK).toMatch(/(Ctrl|Cmd)\+K/);

    const badgeK = formatShortcutBadge('k');
    expect(['Ctrl+K', '⌘K']).toContain(badgeK);
  });

  it('matches modifier key combos with both ctrlKey and metaKey', () => {
    // Windows / Linux / Android Control key event
    const ctrlEvent = { ctrlKey: true, metaKey: false, key: 'k' } as unknown as KeyboardEvent;
    expect(isModifierKeyCombo(ctrlEvent, 'k')).toBe(true);
    expect(isModifierKeyCombo(ctrlEvent, 'K')).toBe(true);
    expect(isModifierKeyCombo(ctrlEvent, 's')).toBe(false);

    // macOS / iOS Command key event
    const metaEvent = { ctrlKey: false, metaKey: true, key: 'k' } as unknown as KeyboardEvent;
    expect(isModifierKeyCombo(metaEvent, 'k')).toBe(true);
    expect(isModifierKeyCombo(metaEvent, 'K')).toBe(true);

    // Plain key without modifier
    const plainEvent = { ctrlKey: false, metaKey: false, key: 'k' } as unknown as KeyboardEvent;
    expect(isModifierKeyCombo(plainEvent, 'k')).toBe(false);
  });

  it('verifies platform and mobile checks return booleans without throwing', () => {
    expect(typeof isApplePlatform()).toBe('boolean');
    expect(typeof isMobileDevice()).toBe('boolean');
  });
});
