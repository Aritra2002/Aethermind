/**
 * @file Tooltip.tsx
 * @description Accessible, high-performance portalled micro-tooltip component for AetherMind.
 * Inspired by Aceternity UI, OriginUI, and 21st.dev motion standards.
 * Features:
 * - Zero clipping: renders in document.body portal with automatic screen-edge clamping
 * - OS-aware keyboard shortcut badges (Cmd on Mac/iOS, Ctrl on Windows/Linux)
 * - Spring entrance micro-animation with 180ms hover delay threshold
 * - Pointer-events pass-through to prevent click blocking
 * - WAI-ARIA role="tooltip" compliance
 */

import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimeTransition } from '../../utils/animation/AnimePresence';
import { AnimePresets } from '../../utils/animation/animeEngine';
import { formatShortcutBadge } from '../../utils/keyboardUtils';

export interface TooltipProps {
  /** Text or React element to display inside the tooltip */
  content: React.ReactNode;
  /** Optional keyboard shortcut key (e.g. 'K', 'N', 'P', 'S') */
  shortcut?: string;
  /** Direction side of the tooltip relative to trigger */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in milliseconds before displaying tooltip (prevents visual noise) */
  delayMs?: number;
  /** Trigger element */
  children: React.ReactElement;
  /** Optional class name to attach to wrapper */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  side = 'bottom',
  delayMs = 180,
  children,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const updateCoordinates = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.bottom + 8;

    if (side === 'top') {
      y = rect.top - 8;
    } else if (side === 'left') {
      x = rect.left - 8;
      y = rect.top + rect.height / 2;
    } else if (side === 'right') {
      x = rect.right + 8;
      y = rect.top + rect.height / 2;
    }

    // Viewport edge clamping
    const padding = 12;
    x = Math.max(padding, Math.min(window.innerWidth - padding, x));
    y = Math.max(padding, Math.min(window.innerHeight - padding, y));

    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateCoordinates();
      setIsOpen(true);
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (disabled) return;
    updateCoordinates();
    setIsOpen(true);
  };

  const handleBlur = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const trigger = (
    <span
      ref={triggerRef as React.RefObject<HTMLSpanElement>}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-describedby={isOpen ? tooltipId : undefined}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      {children}
    </span>
  );

  const getTransform = () => {
    if (side === 'top') return 'translate(-50%, -100%)';
    if (side === 'left') return 'translate(-100%, -50%)';
    if (side === 'right') return 'translate(0, -50%)';
    return 'translate(-50%, 0)';
  };

  const getInitialOffset = () => {
    if (side === 'top') return { y: 4 };
    if (side === 'bottom') return { y: -4 };
    if (side === 'left') return { x: 4 };
    return { x: -4 };
  };

  return (
    <>
      {trigger}
      {typeof document !== 'undefined' && createPortal(
        <AnimeTransition
          show={isOpen}
          enter={AnimePresets.tooltipEnter(getInitialOffset())}
          exit={AnimePresets.tooltipExit}
          className={`aether-tooltip-portal ${className}`}
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            transform: getTransform(),
            pointerEvents: 'none',
            zIndex: 99999
          }}
        >
          <div id={tooltipId} role="tooltip" className="aether-tooltip-content">
            <span className="tooltip-label">{content}</span>
            {shortcut && (
              <kbd className="tooltip-kbd">{formatShortcutBadge(shortcut)}</kbd>
            )}
          </div>
        </AnimeTransition>,
        document.body
      )}
    </>
  );
};
