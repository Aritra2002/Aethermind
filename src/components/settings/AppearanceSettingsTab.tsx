/**
 * ============================================================================
 * AppearanceSettingsTab.tsx — Theme Studio & Visual Aesthetics Settings
 * ============================================================================
 * 
 * Architectural Purpose:
 * Provides the user interface for switching preset visual themes or constructing
 * a bespoke custom skin using the docked 2-column Inspector Theme Studio.
 * 
 * Features:
 * - One-click theme preset switcher (Dark Space, Light Clean, Sepia Warm, Midnight, Ocean).
 * - 2-Column Inspector Architecture: Element list on the left with live active ring
 *   indicators; docked 120 FPS ModernColorPicker on the right.
 * - Hardware-accelerated live CSS property updates via `themeUtils.ts`.
 * - Responsive layout adapting effortlessly to mobile and desktop screens.
 */

import React, { useState } from 'react';
import { Sparkles, Sun, Eye, Moon, Compass, Paintbrush, RotateCcw } from 'lucide-react';
import { Dropdown } from '../ui/Dropdown';
import { updateSingleThemePropertyLive, applyCustomThemeLive } from '../../utils/themeUtils';
import { ModernColorPicker } from '../ui/ModernColorPicker';

interface AppearanceSettingsTabProps {
  /** Currently active theme identifier ('dark' | 'light' | 'sepia' | 'midnight' | 'ocean' | 'custom') */
  activeTheme: string;
  /** Callback fired when a theme preset is chosen */
  onThemeSelect: (theme: string) => void;
  /** Key-value store of custom theme color overrides */
  customThemeColors: Record<string, string>;
  /** Callback fired when a single custom theme color or font is altered */
  onCustomThemeColorChange: (key: string, color: string) => void;
  /** Callback to restore custom theme colors to default values */
  onCustomThemeReset: () => void;
}

/** Registry of customizable theme elements with metadata */
const CUSTOMIZABLE_KEYS = [
  { key: 'bgPrimary', label: 'Background Color', defaultColor: '#06071a', desc: 'Main canvas & workspace backdrop' },
  { key: 'sidebarBg', label: 'Sidebar Background', defaultColor: '#0f1428', desc: 'Glass panels & tab containers' },
  { key: 'textPrimary', label: 'Text Color', defaultColor: '#ffffff', desc: 'Headings & primary typography' },
  { key: 'accentPrimary', label: 'Accent Color', defaultColor: '#7c3aed', desc: 'Primary buttons, active indicators & glows' },
  { key: 'accentSecondary', label: 'Secondary Accent', defaultColor: '#06b6d4', desc: 'Badges, tags & secondary highlights' },
  { key: 'linkColor', label: 'Synapse Line Color', defaultColor: '#ffffff4d', desc: 'Knowledge graph connection links' }
];

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({
  activeTheme,
  onThemeSelect,
  customThemeColors,
  onCustomThemeColorChange,
  onCustomThemeReset
}) => {
  // Key of the theme element currently active in the right-hand Color Studio
  const [activeCustomKey, setActiveCustomKey] = useState<string>('bgPrimary');

  const selectedProp = CUSTOMIZABLE_KEYS.find(k => k.key === activeCustomKey) || CUSTOMIZABLE_KEYS[0];
  const activeColor = customThemeColors[selectedProp.key] || selectedProp.defaultColor;

  /**
   * Handles color change from the docked ModernColorPicker.
   * Updates CSS variables instantly and notifies parent state.
   */
  const handleColorChange = (newColor: string) => {
    updateSingleThemePropertyLive(selectedProp.key, newColor);
    onCustomThemeColorChange(selectedProp.key, newColor);
  };

  return (
    <div className="settings-section">
      <h3>Appearance & Theme</h3>
      <p className="section-desc">Change the aesthetic skin of AetherMind or design your own unique interface.</p>
      
      {/* Preset Themes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginTop: '16px' }}>
        {[
          { id: 'dark', label: 'Dark Space', icon: <Moon size={16} /> },
          { id: 'light', label: 'Light Clean', icon: <Sun size={16} /> },
          { id: 'sepia', label: 'Sepia Warm', icon: <Eye size={16} /> },
          { id: 'midnight', label: 'Midnight', icon: <Sparkles size={16} /> },
          { id: 'ocean', label: 'Ocean Tide', icon: <Compass size={16} /> },
          { id: 'custom', label: 'Custom', icon: <Paintbrush size={16} /> }
        ].map((theme) => (
          <button
            key={theme.id}
            onClick={() => onThemeSelect(theme.id)}
            className={`settings-action-btn ${activeTheme === theme.id ? 'active' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 8px',
              gap: '8px',
              border: activeTheme === theme.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: activeTheme === theme.id ? 'var(--glow-primary, rgba(124, 58, 237, 0.15))' : 'var(--card-nested-bg)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            {theme.icon}
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{theme.label}</span>
          </button>
        ))}
      </div>

      {/* High-End Two-Column Custom Theme Studio */}
      {activeTheme === 'custom' && (
        <div style={{ marginTop: '20px', padding: '16px', background: 'var(--card-nested-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Custom Theme Builder</h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select an element on the left to tune its color in real-time.</p>
            </div>
            <button 
              className="btn btn-ghost" 
              onClick={onCustomThemeReset}
              style={{ fontSize: '0.75rem', padding: '4px 10px', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={12} />
              Reset to Defaults
            </button>
          </div>
          
          {/* Inspector Layout: Left Elements List | Right Docked Color Studio */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'start' }}>
            
            {/* Left: Element Selector List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {CUSTOMIZABLE_KEYS.map((item) => {
                const isSelected = activeCustomKey === item.key;
                const col = customThemeColors[item.key] || item.defaultColor;
                return (
                  <div
                    key={item.key}
                    onClick={() => setActiveCustomKey(item.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--surface-pill-bg)' : 'transparent',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      boxShadow: isSelected ? '0 0 10px var(--glow-primary, rgba(124, 58, 237, 0.15))' : 'none',
                      transition: 'all 140ms ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 500, color: 'var(--text-primary)' }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {item.desc}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', padding: '2px 6px', background: 'var(--input-bg)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        {col.toUpperCase()}
                      </span>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: col,
                          border: isSelected ? '2px solid #ffffff' : '1px solid var(--border-color)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          flexShrink: 0
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Font Style Row */}
              <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--surface-pill-bg)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Font Style</span>
                <Dropdown
                  value={customThemeColors.fontFamily || 'sans'}
                  onChange={(val: string | number) => {
                    const fontVal = val as string;
                    applyCustomThemeLive({ ...customThemeColors, fontFamily: fontVal });
                    onCustomThemeColorChange('fontFamily', fontVal);
                  }}
                  options={[
                    { value: 'sans', label: 'Plus Jakarta Sans' },
                    { value: 'inter', label: 'Inter' },
                    { value: 'outfit', label: 'Outfit' },
                    { value: 'serif', label: 'Playfair Display' },
                    { value: 'lora', label: 'Lora' },
                    { value: 'merriweather', label: 'Merriweather' },
                    { value: 'cinzel', label: 'Cinzel' },
                    { value: 'jetbrains-mono', label: 'JetBrains Mono' },
                    { value: 'fira-code', label: 'Fira Code' }
                  ]}
                  style={{ minWidth: '150px' }}
                />
              </div>
            </div>

            {/* Right: Docked Modern Color Studio */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ModernColorPicker
                color={activeColor}
                defaultColor={selectedProp.defaultColor}
                onChange={handleColorChange}
                title={`Tune ${selectedProp.label}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
