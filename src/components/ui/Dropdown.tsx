import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import '../../styles/dropdown.css';

export interface DropdownOption {
  value: string | number;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | number | null;
  onChange: (value: string | number) => void;
  isSearchable?: boolean;
  allowCustomValue?: boolean;
  dynamicWidth?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  isSearchable = false,
  allowCustomValue = false,
  dynamicWidth = false,
  placeholder = 'Select...',
  style = {},
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuPlacement, setMenuPlacement] = useState<'top' | 'bottom'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 260 && rect.top > spaceBelow) {
        setMenuPlacement('top');
      } else {
        setMenuPlacement('bottom');
      }
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (isSearchable) {
          setSearchTerm(selectedOption ? selectedOption.label : '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption, isSearchable]);

  // Keep search term in sync when value changes externally
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
    if (e.key === 'Enter' && isSearchable) {
      // If there's an exact match, pick it, else pick the first filtered option
      const exactMatch = filteredOptions.find(o => o.label.toLowerCase() === searchTerm.toLowerCase());
      if (exactMatch) {
        handleSelect(exactMatch.value);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].value);
      }
    }
  };

  return (
    <div 
      className={`dropdown-container ${className}`} 
      style={style} 
      ref={containerRef}
    >
      <div 
        className={`dropdown-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
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
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
              (e.target as HTMLInputElement).select();
            }}
            style={dynamicWidth ? {
              width: `calc(${Math.max(1, (isOpen ? searchTerm : (selectedOption?.label || '')).toString().length)}ch + 60px)`
            } : undefined}
          />
        ) : (
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', marginLeft: '8px', flexShrink: 0 }}
        >
          <ChevronDown size={16} color="var(--text-secondary)" />
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`dropdown-menu ${menuPlacement === 'top' ? 'placement-top' : ''}`}
            initial={{ opacity: 0, y: menuPlacement === 'top' ? 10 : -10, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: menuPlacement === 'top' ? 10 : -10, scaleY: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ transformOrigin: menuPlacement === 'top' ? 'bottom center' : 'top center' }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`dropdown-option ${opt.value === value ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {opt.label}
                  </span>
                  {opt.value === value && <Check size={14} />}
                </div>
              ))
            ) : (
              <div className="dropdown-empty">No options found</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
