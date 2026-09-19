/**
 * @file useAnime.ts
 * @description React hook for executing Anime.js animations on DOM elements
 * with automatic cancellation and cleanup on component unmount or dependencies change.
 * @module utils/animation/useAnime
 */

import { useRef, useEffect } from 'react';
import { safeAnimate } from './animeEngine';
import type { AnimationParams, JSAnimation } from 'animejs';

/**
 * Executes an Anime.js animation on the referenced DOM element.
 *
 * @template T - The HTML element type
 * @param {AnimationParams | null} params - Animation parameters or null to skip
 * @param {React.DependencyList} [deps=[]] - Effect dependencies triggering re-animation
 * @returns {React.RefObject<T | null>} Ref to attach to the target element
 */
export function useAnime<T extends HTMLElement = HTMLDivElement>(
  params: AnimationParams | null,
  deps: React.DependencyList = []
): React.RefObject<T | null> {
  const elementRef = useRef<T | null>(null);
  const animRef = useRef<JSAnimation | null>(null);

  useEffect(() => {
    if (!elementRef.current || !params) return;

    // Clean up any ongoing previous animation on this target
    if (animRef.current) {
      animRef.current.pause();
      animRef.current = null;
    }

    animRef.current = safeAnimate(elementRef.current, params);

    return () => {
      if (animRef.current) {
        animRef.current.pause();
        animRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return elementRef;
}
