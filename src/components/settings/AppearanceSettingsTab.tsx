import React from 'react';
import { ColorPicker } from '../ColorPicker';
import { Sparkles, Sun, Eye, Moon, Compass, Paintbrush } from 'lucide-react';

interface AppearanceSettingsTabProps {
  activeTheme: string;
  onThemeSelect: (theme: string) => void;
  customThemeColors: Record<string, string>;
  onCustomThemeColorChange: (key: string, color: string) => void;
  onCustomThemeReset: () => void;
}

const CUSTOMIZABLE_KEYS = [
  { key: 'bgPrimary', label: 'Background Color', defaultColor: '#06071a' },
  { key: 'sidebarBg', label: 'Sidebar Background', defaultColor: '#0f1428' },
  { key: 'textPrimary', label: 'Text Color', defaultColor: '#ffffff' },
  { key: 'accentPrimary', label: 'Accent Color', defaultColor: '#7c3aed' },
  { key: 'accentSecondary', label: 'Secondary Accent Color', defaultColor: '#06b6d4' },
  { key: 'linkColor', label: 'Connection Line Color', defaultColor: '#ffffff4d' }
];

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({
  activeTheme,
  onThemeSelect,
  customThemeColors,
  onCustomThemeColorChange,
  onCustomThemeReset
}) => {
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
              padding: '16px 8px',
              gap: '8px',
              border: activeTheme === theme.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: activeTheme === theme.id ? 'rgba(124, 58, 237, 0.08)' : 'rgba(0, 0, 0, 0.1)',
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

      {/* Custom Color Palette Builder */}
      {activeTheme === 'custom' && (
        <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>Custom Theme Builder</h4>
            <button 
              className="btn btn-ghost" 
              onClick={onCustomThemeReset}
              style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 'auto' }}
            >
              Reset to Defaults
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CUSTOMIZABLE_KEYS.map(({ key, label, defaultColor }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</span>
                <ColorPicker
                  color={customThemeColors[key] || ''}
                  defaultColor={defaultColor}
                  onChange={(color) => onCustomThemeColorChange(key, color)}
                  onReset={() => onCustomThemeColorChange(key, '')}
                  title={`Select ${label}`}
                  resetLabel="Reset to Default"
                  align="right"
                />
              </div>
            ))}

            {/* Font Style Selection */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Font Style</span>
              <select
                value={customThemeColors.fontFamily || 'sans'}
                onChange={(e) => onCustomThemeColorChange('fontFamily', e.target.value)}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <optgroup label="Modern Sans-Serif" style={{ background: '#18181b', color: '#fff' }}>
                  <option value="sans">Plus Jakarta Sans</option>
                  <option value="inter">Inter</option>
                  <option value="outfit">Outfit</option>
                </optgroup>
                <optgroup label="Classic Serif" style={{ background: '#18181b', color: '#fff' }}>
                  <option value="serif">Playfair Display</option>
                  <option value="lora">Lora</option>
                  <option value="merriweather">Merriweather</option>
                  <option value="cinzel">Cinzel</option>
                </optgroup>
                <optgroup label="Developer Monospace" style={{ background: '#18181b', color: '#fff' }}>
                  <option value="jetbrains-mono">JetBrains Mono</option>
                  <option value="fira-code">Fira Code</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
