/**
 * ============================================================================
 * ColorPicker.tsx — Note & Category Color Popover Trigger
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides an unobtrusive color trigger button that opens the ModernColorPicker
 * popover with exact right-anchored positioning. Used inside the Note Editor
 * and Category customization rows.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { ModernColorPicker } from './ui/ModernColorPicker';

interface ColorPickerProps {
  /** Current assigned color */
  color: string;
  /** Category or default fallback color */
  defaultColor: string;
  /** Callback fired when user selects or tunes a color */
  onChange: (color: string) => void;
  /** Callback to reset to category default */
  onReset: () => void;
  /** Accessible label / tooltip */
  title?: string;
  /** Text label for reset button */
  resetLabel?: string;
  /** Popover horizontal alignment anchor */
  align?: 'left' | 'right';
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  color, 
  defaultColor, 
  onChange, 
  title = "Node Color",
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayColor = color || defaultColor;

  // Dismiss popover on outside mousedown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="color-picker-container" ref={containerRef} style={{ position: 'relative' }}>
      {/* Visual Trigger Swatch Button */}
      <button 
        type="button"
        className="color-picker-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ backgroundColor: displayColor }}
        title={title}
        aria-label={title}
      >
        <Palette size={12} className="color-picker-icon" style={{ mixBlendMode: 'difference', color: 'var(--text-primary)' }} />
      </button>

      {/* Floating Modern Color Studio Popover */}
      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: align === 'left' ? 'auto' : 0,
            left: align === 'left' ? 0 : 'auto',
            zIndex: 1200,
            animation: 'fadeScaleIn 160ms var(--ease-out)'
          }}
        >
          <ModernColorPicker
            color={displayColor}
            defaultColor={defaultColor}
            onChange={(newColor) => onChange(newColor)}
            onClose={() => setIsOpen(false)}
            title={title}
          />
        </div>
      )}
    </div>
  );
};
