/**
 * ============================================================================
 * Dropdown.tsx — Accessible, Hardware-Accelerated Portalled Dropdown
 * ============================================================================
 * 
 * Architectural Purpose:
 * Renders an accessible, searchable dropdown select menu that portals to
 * `document.body` to avoid clipping traps created by modal scroll containers
 * (`overflow: auto`) or CSS containing blocks (`transform`, `filter`).
 * 
 * Key Features:
 * - Dynamic Viewport-Aware Positioning (automatically flips between top and bottom).
 * - Exact viewport boundary clamping so menus never clip off-screen.
 * - Searchable filtering with customizable keyboard navigation (Enter, Escape).
 * - Spring entrance animations powered by Framer Motion.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import '../../styles/dropdown.css';

/**
 * Dropdown Option Definition
 */
export interface DropdownOption {
  /** Unique value key */
  value: string | number;
  /** Human-readable display label */
  label: string;
}

interface DropdownProps {
  /** Array of selectable options */
  options: DropdownOption[];
  /** Current selected value */
  value: string | number | null;
  /** Callback fired when an option is selected */
  onChange: (value: string | number) => void;
  /** Whether the dropdown allows typing to filter */
  isSearchable?: boolean;
  /** Whether custom unlisted values can be typed and submitted */
  allowCustomValue?: boolean;
  /** Auto-adjust width based on input length */
  dynamicWidth?: boolean;
  /** Minimum character width for dynamic sizing */
  minChars?: number;
  /** Fallback placeholder text */
  placeholder?: string;
  /** Inline CSS style overrides */
  style?: React.CSSProperties;
  /** Additional container CSS class names */
  className?: string;
  /** Maximum character length for input */
  maxLength?: number;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  isSearchable = false,
  allowCustomValue = false,
  dynamicWidth = false,
  minChars = 8,
  placeholder = 'Select...',
  style = {},
  className = '',
  maxLength
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuPlacement, setMenuPlacement] = useState<'top' | 'bottom'>('bottom');
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Calculates the exact fixed viewport coordinates for the portalled dropdown menu.
   * Handles space detection above vs below and clamps to the window boundaries.
   */
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Estimate menu height based on number of items (capped at 260px)
    const estimatedHeight = Math.min(260, Math.max(60, options.length * 36 + 12));
    
    // If not enough room below and more room above, flip to top placement
    const placement = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
    setMenuPlacement(placement);

    const width = Math.max(rect.width, 160);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    left = Math.max(12, left);

    let top = placement === 'bottom' ? rect.bottom + 6 : rect.top - estimatedHeight - 6;
    top = Math.max(12, Math.min(top, window.innerHeight - estimatedHeight - 12));

    setMenuPos({ left, top, width });
  }, [options.length]);

  // Recalculate position on open, scroll, or window resize
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      const handleReposition = () => calculatePosition();
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);

      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
      };
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMenuPos(null);
    }
  }, [isOpen, calculatePosition]);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  // Dismiss dropdown when clicking outside the trigger or menu portal
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
      if (isSearchable) {
        setSearchTerm(selectedOption ? selectedOption.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, selectedOption, isSearchable]);

  // Synchronize input text when value changes externally
  useEffect(() => {
    if (isSearchable && selectedOption) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchTerm(selectedOption.label);
    }
  }, [value, selectedOption, isSearchable]);

  const isTypingNewSearch = isSearchable && isOpen && searchTerm !== (selectedOption?.label || '');
  let filteredOptions = isTypingNewSearch 
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  if (allowCustomValue && searchTerm && !options.find(opt => opt.label.toLowerCase() === searchTerm.toLowerCase())) {
    filteredOptions = [{ value: searchTerm, label: searchTerm }, ...filteredOptions];
  }

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
  };

  /** Keyboard navigation handler (Escape to close, Enter to select match) */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
    if (e.key === 'Enter' && isSearchable) {
      if (searchTerm.trim() === '') {
        handleSelect('');
        return;
      }
      const exactMatch = filteredOptions.find(o => o.label.toLowerCase() === searchTerm.toLowerCase());
      if (exactMatch) {
        handleSelect(exactMatch.value);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].value);
      }
    }
  };

  const computedMaxLength = allowCustomValue ? 100 : (maxLength ?? (options.length > 0 ? Math.max(...options.map(opt => String(opt.label).length)) : undefined));

  return (
    <div 
      className={`dropdown-container ${className}`} 
      style={style} 
      ref={containerRef}
    >
      {/* Trigger Button */}
      <div 
        className={`dropdown-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isSearchable ? (
          <input
            type="text"
            className="dropdown-input"
            value={isOpen ? searchTerm : (selectedOption?.label || '')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={computedMaxLength}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
              (e.target as HTMLInputElement).select();
            }}
            style={dynamicWidth ? { minWidth: `${minChars}ch`, maxWidth: '40ch' } : undefined}
          />
        ) : (
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          style={{ display: 'flex', alignItems: 'center', marginLeft: '8px', flexShrink: 0 }}
        >
          <ChevronDown size={14} color="var(--text-secondary)" />
        </motion.div>
      </div>

      {/* Portalled Dropdown Floating Menu */}
      {createPortal(
        <AnimatePresence>
          {isOpen && menuPos && (
            <motion.div
              ref={menuRef}
              className="dropdown-menu"
              initial={{ opacity: 0, scale: 0.96, y: menuPlacement === 'top' ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: menuPlacement === 'top' ? 4 : -4 }}
              transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
              style={{
                position: 'fixed',
                left: `${menuPos.left}px`,
                top: `${menuPos.top}px`,
                width: `${menuPos.width}px`,
                minWidth: '160px',
                maxHeight: '260px',
                zIndex: 100000,
                transformOrigin: menuPlacement === 'top' ? 'bottom center' : 'top center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isCurrentSelected = String(opt.value) === String(value);
                  return (
                    <div
                      key={opt.value}
                      className={`dropdown-option ${isCurrentSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelect(opt.value)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.label}
                      </span>
                      {isCurrentSelected && <Check size={14} />}
                    </div>
                  );
                })
              ) : (
                <div className="dropdown-empty">No options found</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
