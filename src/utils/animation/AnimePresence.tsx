/**
 * @file AnimePresence.tsx
 * @description Lightweight React 19 transition wrapper replacing Framer Motion's AnimatePresence.
 * Coordinates smooth enter and exit animations using Anime.js v4.5.0, cleanly delaying
 * DOM unmounting until exit animations complete without clipping or ghost nodes.
 * @module utils/animation/AnimePresence
 */

import React, { useState, useEffect, useRef } from 'react';
import { safeAnimate } from './animeEngine';
import type { AnimationParams } from 'animejs';

export interface AnimeTransitionProps {
  /** Whether the component should be rendered/visible */
  show: boolean;
  /** Animation parameters applied on mount/enter */
  enter: AnimationParams;
  /** Animation parameters applied before unmounting/exit */
  exit: AnimationParams;
  /** Optional className for the animated container */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Children to render */
  children: React.ReactNode;
  /** Optional callback fired when exit animation completes */
  onExited?: () => void;
}

/**
 * AnimeTransition Component
 *
 * Renders children when `show` is true, animating them into view.
 * When `show` transitions to false, plays the `exit` animation and only
 * unmounts from the DOM once the exit animation finishes.
 */
export const AnimeTransition: React.FC<AnimeTransitionProps> = ({
  show,
  enter,
  exit,
  className,
  style,
  children,
  onExited
}) => {
  const [shouldRender, setShouldRender] = useState(show);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isExitingRef = useRef(false);

  // If show transitions to true during render, ensure shouldRender is immediately true
  if (show && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    if (show) {
      isExitingRef.current = false;
    } else if (shouldRender && !isExitingRef.current) {
      isExitingRef.current = true;
      if (containerRef.current) {
        const anim = safeAnimate(containerRef.current, exit);
        anim.then(() => {
          if (isExitingRef.current) {
            setShouldRender(false);
            isExitingRef.current = false;
            onExited?.();
          }
        });
      } else {
        setShouldRender(false);
        isExitingRef.current = false;
        onExited?.();
      }
    }
  }, [show, exit, onExited, shouldRender]);

  useEffect(() => {
    if (shouldRender && show && containerRef.current) {
      safeAnimate(containerRef.current, enter);
    }
  }, [shouldRender, show, enter]);

  if (!shouldRender) return null;

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  );
};
