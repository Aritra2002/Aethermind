import React, { useState, useRef, useEffect } from 'react';
import { Palette, X } from 'lucide-react';

const PRESET_COLORS = [
  '#818cf8', // Indigo (General)
  '#34d399', // Emerald (Work)
  '#fbbf24', // Amber (Ideas)
  '#f43f5e', // Rose
  '#2dd4bf', // Teal
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f97316', // Orange
  '#eab308'  // Yellow
];

interface ColorPickerProps {
  color: string;
  defaultColor: string;
  onChange: (color: string) => void;
  onReset: () => void;
  title?: string;
  resetLabel?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  color, 
  defaultColor, 
  onChange, 
  onReset,
  title = "Node Color",
  resetLabel = "Reset to Category Default"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(color || defaultColor);
  const popoverRef = useRef<HTMLDivElement>(null);

  const displayColor = color || defaultColor;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {

        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
      // eslint-disable-next-line
    setHexInput(displayColor);
  }, [displayColor]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    setHexInput(e.target.value);
    if (/^#?[0-9A-F]{6}$/i.test(e.target.value)) {
      const formatted = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
      onChange(formatted);
    }
  };

  return (
    <div className="color-picker-container" ref={popoverRef}>
      <button 
      className="color-picker-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ backgroundColor: displayColor }}
        title={title}
      >
        <Palette size={12} className="color-picker-icon" style={{ mixBlendMode: 'difference', color: '#fff' }} />
      </button>

      {isOpen && (
        <div className="color-picker-popover glass-panel">
          <div className="color-picker-header">
            <span>{title}</span>
            <button className="icon-btn" onClick={() => setIsOpen(false)} aria-label="Close color picker"><X size={14} /></button>
          </div>
          
          <div className="color-swatches" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', placeItems: 'center' }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className={`color-swatch ${displayColor === c ? 'active' : ''}`}
                style={{ backgroundColor: c, width: '44px', height: '44px', padding: 0, margin: 0 }}
                onClick={() => onChange(c)}
              />
            ))}
          </div>

          <div className="color-picker-custom">
            <div className="hex-input-wrapper">
              <span className="hex-hash">#</span>
              <input 
                type="text" 
                className="hex-input"
                value={hexInput.replace('#', '')}
                onChange={handleHexChange}
                maxLength={6}
              />
            </div>
            
            <div className="native-picker-wrapper">
              <input 
                type="color" 
                value={displayColor}
                onChange={(e) => onChange(e.target.value)}
                className="native-color-input"
              />
              <span className="native-picker-label">Custom</span>
            </div>
          </div>

          {color && (
            <button className="color-reset-btn" onClick={() => { onReset(); setIsOpen(false); }}>
              {resetLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
