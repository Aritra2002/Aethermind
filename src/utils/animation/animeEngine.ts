/**
 * @file animeEngine.ts
 * @description Centralized Anime.js (v4.5.0) animation engine for AetherMind.
 * Provides accessible, hardware-accelerated transition presets, spring physics definitions,
 * reduced-motion compliance utilities, and type-safe helpers for animating DOM and Canvas elements.
 * @module utils/animation/animeEngine
 */

import { animate, createTimeline, spring, eases } from 'animejs';
import type { JSAnimation, AnimationParams, TargetsParam } from 'animejs';

/**
 * Checks if the user has requested reduced motion at OS or browser level.
 *
 * @returns {boolean} True if prefers-reduced-motion is active.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Common animation preset definitions aligned with AetherMind's design system tokens:
 * - Springs: snappy feedback with no high-frequency vibration
 * - Easing: modern cubic and quadratic curves
 * - Duration: tuned for immediate responsiveness (100ms - 280ms)
 */
export const AnimePresets = {
  /** Snappy scale-in and fade for modals, dialogs, and overlays */
  modalEnter: {
    opacity: [0, 1],
    scale: [0.95, 1],
    translateY: [10, 0],
    duration: 220,
    ease: 'outCubic'
  },

  /** Modal exit transition */
  modalExit: {
    opacity: [1, 0],
    scale: [1, 0.96],
    translateY: [0, 8],
    duration: 160,
    ease: 'outQuad'
  },

  /** Backdrop overlay fade */
  backdropEnter: {
    opacity: [0, 1],
    duration: 200,
    ease: 'outQuad'
  },
  backdropExit: {
    opacity: [1, 0],
    duration: 150,
    ease: 'outQuad'
  },

  /** Portalled dropdown pop-in */
  dropdownEnter: (placement: 'top' | 'bottom' = 'bottom') => ({
    opacity: [0, 1],
    scale: [0.96, 1],
    translateY: placement === 'top' ? [4, 0] : [-4, 0],
    duration: 160,
    ease: 'outCubic'
  }),

  /** Portalled dropdown pop-out */
  dropdownExit: (placement: 'top' | 'bottom' = 'bottom') => ({
    opacity: [1, 0],
    scale: [1, 0.96],
    translateY: placement === 'top' ? [0, 4] : [0, -4],
    duration: 120,
    ease: 'outQuad'
  }),

  /** Accessible Micro-Tooltip pop-in */
  tooltipEnter: (initialOffset: { x?: number; y?: number }): AnimationParams => {
    const params: AnimationParams = {
      opacity: [0, 1],
      scale: [0.94, 1],
      duration: 140,
      ease: 'outCubic'
    };
    if (initialOffset.x !== undefined) params.translateX = [initialOffset.x, 0];
    if (initialOffset.y !== undefined) params.translateY = [initialOffset.y, 0];
    return params;
  },

  /** Accessible Micro-Tooltip fade-out */
  tooltipExit: {
    opacity: [1, 0],
    scale: [1, 0.96],
    duration: 80,
    ease: 'outQuad'
  },

  /** Floating card / desktop spatial editor window enter */
  spatialCardEnter: {
    opacity: [0, 1],
    scale: [0.96, 1],
    translateY: [16, 0],
    duration: 260,
    ease: 'outCubic'
  },

  /** Floating card / desktop spatial editor window exit */
  spatialCardExit: {
    opacity: [1, 0],
    scale: [1, 0.96],
    translateY: [0, 16],
    duration: 180,
    ease: 'outQuad'
  },

  /** Mobile bottom sheet slide-in */
  bottomSheetEnter: {
    opacity: [0, 1],
    translateY: ['100%', '0%'],
    duration: 280,
    ease: 'outCubic'
  },

  /** Mobile bottom sheet slide-out */
  bottomSheetExit: {
    opacity: [1, 0],
    translateY: ['0%', '100%'],
    duration: 200,
    ease: 'outQuad'
  },

  /** Notification toast entrance */
  toastEnter: {
    opacity: [0, 1],
    translateY: [16, 0],
    scale: [0.95, 1],
    duration: 220,
    ease: 'outCubic'
  },

  /** Notification toast exit */
  toastExit: {
    opacity: [1, 0],
    translateY: [0, 12],
    scale: [1, 0.95],
    duration: 160,
    ease: 'outQuad'
  }
};

/**
 * Safely runs an Anime.js animation on targets, automatically respecting
 * user-level reduced-motion preferences by applying instant final values if active.
 *
 * @param {TargetsParam} targets - Target elements or objects
 * @param {AnimationParams} params - Animation parameters
 * @returns {JSAnimation} Anime.js animation handle
 */
export function safeAnimate(targets: TargetsParam, params: AnimationParams): JSAnimation {
  if (isReducedMotionPreferred()) {
    // If reduced motion is requested, compress duration to near-zero
    return animate(targets, {
      ...params,
      duration: 1,
      delay: 0
    });
  }
  return animate(targets, params);
}

export { animate, createTimeline, spring, eases };
