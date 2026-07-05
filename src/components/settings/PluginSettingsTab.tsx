import React, { useState } from 'react';
import { Puzzle, Trash2 } from 'lucide-react';
import { getSavedPlugins, savePlugins, loadPluginScript } from '../../utils/pluginManager';
import type { Plugin } from '../../utils/pluginManager';
import { useToast } from '../ToastContext';

export const PluginSettingsTab: React.FC = () => {
  const { showToast } = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>(() => getSavedPlugins());
  const [pluginUrl, setPluginUrl] = useState('');
  const [pluginName, setPluginName] = useState('');

  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h3>Plugins</h3>
      </div>
      <p className="section-desc">Add external plugin scripts to extend AetherMind with custom node renderers and sidebar tabs.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
        {plugins.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <Puzzle size={14} style={{ color: 'var(--node-indigo)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={() => {
                    const updated = plugins.map(pl => pl.id === p.id ? { ...pl, enabled: !pl.enabled } : pl);
                    setPlugins(updated);
                    savePlugins(updated);
                    if (!p.enabled) {
                      loadPluginScript(p.url).catch(console.error);
                    }
                  }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: p.enabled ? 'var(--node-emerald)' : 'rgba(255,255,255,0.15)',
                  transition: '0.3s', borderRadius: '20px'
                }}>
                  <span style={{
                    position: 'absolute', content: '', height: '14px', width: '14px', left: p.enabled ? '20px' : '2px',
                    bottom: '3px', backgroundColor: 'white', transition: '0.3s', borderRadius: '50%'
                  }} />
                </span>
              </label>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => {
                  const updated = plugins.filter(pl => pl.id !== p.id);
                  setPlugins(updated);
                  savePlugins(updated);
                }}
                aria-label="Delete plugin"
                style={{ minWidth: '32px', minHeight: '32px', padding: '2px' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {plugins.length === 0 && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '8px 0' }}>No plugins installed yet.</div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <input
            type="text"
            value={pluginUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPluginUrl(e.target.value)}
            placeholder="Script URL (e.g. https://example.com/plugin.js)"
            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
          />
          <input
            type="text"
            value={pluginName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPluginName(e.target.value)}
            placeholder="Name"
            style={{ width: '100px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              if (!pluginUrl.trim() || !pluginName.trim()) return showToast('Enter both name and URL', 'error');
              const id = `plugin-${Date.now()}`;
              const newPlugin: Plugin = { id, name: pluginName.trim(), url: pluginUrl.trim(), enabled: true };
              const updated = [...plugins, newPlugin];
              setPlugins(updated);
              savePlugins(updated);
              try {
                await loadPluginScript(newPlugin.url);
              } catch (e: unknown) {
                showToast('Failed to load plugin: ' + (e as Error).message, 'error');
              }
              setPluginUrl('');
              setPluginName('');
            }}
            style={{ whiteSpace: 'nowrap' }}
          >
            Add Plugin
          </button>
        </div>
      </div>
    </div>
  );
};
