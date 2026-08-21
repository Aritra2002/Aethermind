/**
 * @file keyboardUtils.ts
 * @description Cross-platform keyboard shortcut & modifier normalization utility for AetherMind.
 * Provides unified shortcut handling across macOS, Windows, Linux, Android, and iOS.
 */

/**
 * Detects whether the current client is running on Apple hardware (macOS, iOS, iPadOS).
 */
export const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '';
  const userAgent = navigator.userAgent || '';
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac|iPhone|iPod|iPad/i.test(userAgent);
};

/**
 * Detects whether the client is a touch/mobile device (Android, iOS).
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
};

/**
 * Returns the primary modifier key name suitable for the user's operating system.
 * Returns 'Cmd' on Apple devices, 'Ctrl' on Windows, Linux, and Android.
 */
export const getPrimaryModifierKey = (): string => {
  return isApplePlatform() ? 'Cmd' : 'Ctrl';
};

/**
 * Returns the primary modifier symbol for UI badges.
 * Returns '⌘' on Apple devices, 'Ctrl' on Windows, Linux, and Android.
 */
export const getModifierBadge = (): string => {
  return isApplePlatform() ? '⌘' : 'Ctrl';
};

/**
 * Formats a key into a universal, human-readable cross-platform shortcut string (e.g. "Ctrl+K" or "Cmd+K").
 *
 * @param key - The key string (e.g. 'K', 'S', 'B', 'I')
 * @returns Formatted shortcut label
 */
export const formatShortcut = (key: string): string => {
  const mod = getPrimaryModifierKey();
  return `${mod}+${key.toUpperCase()}`;
};

/**
 * Formats a key into a compact UI badge string (e.g. "Ctrl+K" on Windows/Android, "⌘K" on Mac/iOS).
 *
 * @param key - The key string (e.g. 'K', 'S')
 * @returns Compact shortcut badge text
 */
export const formatShortcutBadge = (key: string): string => {
  const mod = getModifierBadge();
  return mod === '⌘' ? `⌘${key.toUpperCase()}` : `${mod}+${key.toUpperCase()}`;
};

/**
 * Evaluates whether a keyboard event matches a shortcut combination, universally accepting
 * either Control (Windows/Linux/Android) or Command (macOS/iOS) modifier keys.
 *
 * @param event - The native or React keyboard event
 * @param key - Target key string to match (case-insensitive)
 * @returns True if the primary modifier and target key are pressed
 */
export const isModifierKeyCombo = (
  event: KeyboardEvent | React.KeyboardEvent,
  key: string
): boolean => {
  const isModifier = event.ctrlKey || event.metaKey;
  return isModifier && event.key.toLowerCase() === key.toLowerCase();
};
