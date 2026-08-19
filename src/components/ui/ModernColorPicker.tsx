/**
 * ============================================================================
 * ModernColorPicker.tsx — 120 FPS In-App Color Studio
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides a high-performance, tactile 2D Saturation-Value canvas and 1D rainbow
 * hue slider with full pointer capture. Completely eliminates the sluggish
 * OS-level `<input type="color">` modal and IPC latency.
 * 
 * Features:
 * - 2D Saturation-Value box with smooth 2D gradient backdrop.
 * - 1D Rainbow Hue slider with continuous spectrum interpolation.
 * - Real-time HSV <-> Hex mathematical conversion.
 * - Pointer capture for uninterrupted dragging outside the element bounds.
 * - 20 curated designer presets + editable hex input.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';

/**
 * HSV (Hue, Saturation, Value) Color Representation
 */
export interface HSV {
  /** Hue angle in degrees [0, 360) */
  h: number;
  /** Saturation percentage [0, 100] */
  s: number;
  /** Value / Brightness percentage [0, 100] */
  v: number;
}

/**
 * Converts a Hex color string into HSV space.
 * 
 * @param hex - 3-character or 6-character Hex string (e.g. '#ffffff')
 * @returns HSV object with h in [0, 360], s in [0, 100], v in [0, 100]
 */
export function hexToHSV(hex: string): HSV {
  let clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length < 6) clean = '7c3aed';

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100)
  };
}

/**
 * Converts HSV values back into a 6-character #RRGGBB Hex string.
 * 
 * @param h - Hue [0, 360]
 * @param s - Saturation [0, 100]
 * @param v - Value [0, 100]
 * @returns #RRGGBB formatted string
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const hNorm = (h % 360) / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const vNorm = Math.max(0, Math.min(100, v)) / 100;

  const i = Math.floor(hNorm * 6);
  const f = hNorm * 6 - i;
  const p = vNorm * (1 - sNorm);
  const q = vNorm * (1 - f * sNorm);
  const t = vNorm * (1 - (1 - f) * sNorm);

  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = vNorm; g = t; b = p; break;
    case 1: r = q; g = vNorm; b = p; break;
    case 2: r = p; g = vNorm; b = t; break;
    case 3: r = p; g = q; b = vNorm; break;
    case 4: r = t; g = p; b = vNorm; break;
    case 5: r = vNorm; g = p; b = q; break;
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Curated designer swatches for instant 1-click theme presets */
const DESIGNER_PALETTE = [
  '#06071a', '#0f172a', '#1e1b4b', '#1e293b', '#334155',
  '#f8fafc', '#f1f5f9', '#f5efe6', '#fed7aa', '#fef08a',
  '#7c3aed', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#10b981', '#22c55e', '#eab308', '#f97316', '#f43f5e'
];

interface ModernColorPickerProps {
  /** Current active hex color */
  color: string;
  /** Fallback color when reset is triggered */
  defaultColor?: string;
  /** Callback fired whenever color changes */
  onChange: (color: string) => void;
  /** Optional close handler */
  onClose?: () => void;
  /** Header title */
  title?: string;
}

export const ModernColorPicker: React.FC<ModernColorPickerProps> = ({
  color,
  defaultColor = '#7c3aed',
  onChange,
  onClose,
  title = "Custom Color Picker"
}) => {
  const initialColor = color || defaultColor;
  const [hsv, setHsv] = useState<HSV>(() => hexToHSV(initialColor));
  const [hexInput, setHexInput] = useState(initialColor);

  const satBoxRef = useRef<HTMLDivElement>(null);
  const hueBarRef = useRef<HTMLDivElement>(null);
  const isDraggingSat = useRef(false);
  const isDraggingHue = useRef(false);

  // Synchronize internal state when color prop changes externally
  useEffect(() => {
    const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
    if (color && color.toLowerCase() !== currentHex.toLowerCase()) {
      const nextHsv = hexToHSV(color);
      setHsv(nextHsv);
      setHexInput(color);
    }
  }, [color]);

  /** Updates internal state and notifies parent of new color */
  const updateColorFromHSV = useCallback((newHSV: HSV) => {
    setHsv(newHSV);
    const hex = hsvToHex(newHSV.h, newHSV.s, newHSV.v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  /** Saturation-Value box mouse/touch pointer handler */
  const handleSatMove = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!satBoxRef.current) return;
    const rect = satBoxRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    updateColorFromHSV({ ...hsv, s, v });
  }, [hsv, updateColorFromHSV]);

  /** Rainbow Hue slider mouse/touch pointer handler */
  const handleHueMove = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!hueBarRef.current) return;
    const rect = hueBarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const h = Math.round((x / rect.width) * 360) % 360;

    updateColorFromHSV({ ...hsv, h });
  }, [hsv, updateColorFromHSV]);

  // Attach global pointer listeners during active drag to allow dragging beyond element bounds
  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      if (isDraggingSat.current) handleSatMove(e);
      if (isDraggingHue.current) handleHueMove(e);
    };

    const handlePointerUp = () => {
      isDraggingSat.current = false;
      isDraggingHue.current = false;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove as unknown as EventListener);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove as unknown as EventListener);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [handleSatMove, handleHueMove]);

  /** Handles direct text input into the #HEX field */
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    const clean = val.startsWith('#') ? val : `#${val}`;
    if (/^#?[0-9A-Fa-f]{6}$/.test(val)) {
      const parsed = hexToHSV(clean);
      setHsv(parsed);
      onChange(clean);
    }
  };

  const pureHueHex = hsvToHex(hsv.h, 100, 100);
  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div 
      className="modern-color-picker glass-panel"
      style={{
        width: '260px',
        padding: '12px',
        borderRadius: '12px',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xl, 0 12px 36px rgba(0,0,0,0.35))',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        )}
      </div>

      {/* 2D Saturation-Value Canvas Box */}
      <div
        ref={satBoxRef}
        onMouseDown={(e) => { isDraggingSat.current = true; handleSatMove(e); }}
        onTouchStart={(e) => { isDraggingSat.current = true; handleSatMove(e); }}
        style={{
          position: 'relative',
          width: '100%',
          height: '140px',
          borderRadius: '8px',
          backgroundColor: pureHueHex,
          backgroundImage: `
            linear-gradient(to right, #ffffff, transparent),
            linear-gradient(to top, #000000, transparent)
          `,
          cursor: 'crosshair',
          overflow: 'hidden'
        }}
      >
        {/* Saturation/Value Thumb Handle */}
        <div
          style={{
            position: 'absolute',
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2px solid #ffffff',
            boxShadow: '0 0 4px rgba(0,0,0,0.6), inset 0 0 2px rgba(0,0,0,0.6)',
            backgroundColor: currentHex,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* 1D Rainbow Hue Slider Bar */}
      <div
        ref={hueBarRef}
        onMouseDown={(e) => { isDraggingHue.current = true; handleHueMove(e); }}
        onTouchStart={(e) => { isDraggingHue.current = true; handleHueMove(e); }}
        style={{
          position: 'relative',
          width: '100%',
          height: '12px',
          borderRadius: '6px',
          background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          cursor: 'pointer'
        }}
      >
        {/* Hue Thumb Handle */}
        <div
          style={{
            position: 'absolute',
            left: `${(hsv.h / 360) * 100}%`,
            top: '50%',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2px solid #ffffff',
            boxShadow: '0 0 4px rgba(0,0,0,0.6)',
            backgroundColor: pureHueHex,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Hex Input & Live Color Preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        {/* Live Color Preview Pill */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: currentHex,
            border: '1px solid var(--border-color)',
            flexShrink: 0,
            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.2)'
          }}
        />

        {/* Hex Text Field */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '4px 8px',
            flex: 1
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>#</span>
          <input
            type="text"
            value={hexInput.replace('#', '')}
            onChange={handleHexChange}
            maxLength={6}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              width: '100%',
              outline: 'none',
              padding: '0 4px'
            }}
          />
        </div>

        {/* Reset to default button */}
        {defaultColor && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              const defHSV = hexToHSV(defaultColor);
              updateColorFromHSV(defHSV);
            }}
            title="Reset to default color"
            style={{ padding: '6px' }}
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Curated Designer Preset Palette */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px', marginTop: '4px' }}>
        {DESIGNER_PALETTE.map((swatch) => {
          const isSelected = currentHex.toLowerCase() === swatch.toLowerCase();
          return (
            <button
              key={swatch}
              type="button"
              onClick={() => {
                const parsed = hexToHSV(swatch);
                updateColorFromHSV(parsed);
              }}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '4px',
                backgroundColor: swatch,
                border: isSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSelected ? '0 0 6px var(--glow-primary)' : 'none'
              }}
              title={swatch}
            >
              {isSelected && <Check size={10} color={swatch === '#f8fafc' || swatch === '#f5efe6' ? '#000' : '#fff'} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
