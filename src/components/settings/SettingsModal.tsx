/**
 * ============================================================================
 * SettingsModal.tsx — Application Settings & Preferences Dialog
 * ============================================================================
 * 
 * Architectural Purpose:
 * Top-level modal container orchestrating all user configuration panels, including:
 * - Data & Graph: Database backups, JSON/HTML exports, ML clustering, taxonomy & physics.
 * - Journal: Calendar-based timeline view of daily notes.
 * - AI Integration: LLM provider credentials, endpoints, and model discovery.
 * - Appearance: Preset visual themes and real-time custom color tuning.
 * - About: System version, architectural synopsis, and AGPL-3.0 licensing.
 * 
 * Key Features:
 * - Responsive layout: switches between a docked vertical sidebar on desktop and
 *   a scrollable horizontal tab bar on mobile viewport widths (<768px).
 * - Glassmorphism UI panel styling with backdrop click dismissal and keyboard esc handling.
 * - Centralized distribution of database callbacks, physics state, and theme hooks.
 */

import React, { useState } from 'react';
import { Database, Brain, Info, Calendar as CalendarIcon, Palette, Keyboard, HardDrive } from 'lucide-react';
import packageJson from '../../../package.json';
import { DataSettingsTab } from './DataSettingsTab';
import { AiSettingsTab } from './AiSettingsTab';
import { JournalCalendar } from '../JournalCalendar';
import { AppearanceSettingsTab } from './AppearanceSettingsTab';
import type { Category } from '../../db';

/**
 * Props passed into the SettingsModal component.
 */
interface SettingsModalProps {
  /** Callback to close the settings modal dialog */
  onClose: () => void;
  /** Callback to re-query IndexedDB and refresh graph state */
  onRefreshData: () => void;
  /** Active D3 force simulation physics parameters */
  physicsConfig: { linkDistance: number; chargeStrength: number };
  /** Callback to update D3 force simulation parameters */
  onPhysicsChange: (config: { linkDistance: number; chargeStrength: number }) => void;
  /** Registered node categories for taxonomy editing */
  categories: Category[];
  /** Flag controlling rendering of NLP semantic links */
  nlpClustering: boolean;
  /** Callback to toggle NLP semantic link visualization */
  onNlpClusteringChange: (val: boolean) => void;
  /** Optional callback to create an immediate graph snapshot */
  onSaveSnapshot?: () => void;
  /** Optional callback to open the snapshot history modal */
  onViewSnapshots?: () => void;
  /** ID of the currently active page/workspace */
  activePageId: number;
  /** Display title of the currently active page/workspace */
  pageTitle?: string;
  /** Identifier of the currently active color theme */
  activeTheme: string;
  /** Callback to activate a theme preset */
  onThemeSelect: (theme: string) => void;
  /** Key-value dictionary of custom theme color overrides */
  customThemeColors: Record<string, string>;
  /** Callback to modify a specific custom theme property */
  onCustomThemeColorChange: (key: string, color: string) => void;
  /** Callback to reset custom theme colors to baseline defaults */
  onCustomThemeReset: () => void;
  /** Optional callback to open a specific note selected from the Journal calendar */
  onSelectNote?: (title: string) => void;
}

/** Supported settings tab view identifiers */
type TabType = 'data' | 'journal' | 'ai' | 'appearance' | 'about';

/**
 * SettingsModal Component
 * 
 * Renders the top-level tabbed settings dialog window.
 * 
 * @param {SettingsModalProps} props - Component properties.
 * @returns {React.ReactElement} The settings modal view.
 */
export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  /** Currently active settings tab */
  const [activeTab, setActiveTab] = useState<TabType>('data');
  
  /** Dynamic screen width detection for mobile-friendly tab navigation */
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  /** Storage quota usage info */
  const [storageInfo, setStorageInfo] = useState<{ usage: string; quota: string } | null>(null);

  // Synchronize responsive layout state and estimate IndexedDB storage
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const usageMb = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
        const quotaGb = ((estimate.quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
        setStorageInfo({ usage: `${usageMb} MB`, quota: `${quotaGb} GB` });
      }).catch(() => {});
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      className="modal d-block" 
      tabIndex={-1} 
      style={{ 
        zIndex: 1060, 
        background: 'var(--modal-backdrop-bg, rgba(0, 0, 0, 0.78))', 
        backdropFilter: 'blur(12px)', 
        WebkitBackdropFilter: 'blur(12px)' 
      }} 
      onClick={props.onClose}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered" style={{ width: 'min(95vw, 1000px)', maxWidth: '96vw', height: 'min(88dvh, 780px)', maxHeight: '90dvh', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div 
          className="modal-content glass-panel settings-modal border-0 h-100 position-relative" 
          style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            overflow: 'hidden' 
          }}
        >
          {/* Tab Navigation Sidebar */}
          <div 
            className={isMobile ? 'd-flex overflow-auto flex-shrink-0 gap-1 p-2' : 'd-flex flex-column flex-shrink-0 p-3 gap-1'} 
            style={{ 
              width: isMobile ? '100%' : 'clamp(180px, 22vw, 240px)', 
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              borderRight: isMobile ? 'none' : '1px solid var(--border-color)', 
              borderBottom: isMobile ? '1px solid var(--border-color)' : 'none', 
              background: 'var(--sidebar-tab-bg)' 
            }}
          >
            {!isMobile && (
              <div className="mb-3 px-2 pt-1">
                <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Settings</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>v{packageJson.version} · Local-First</div>
              </div>
            )}
            {[
              { id: 'data' as TabType, label: 'Data & Graph', icon: <Database size={15} /> },
              { id: 'journal' as TabType, label: 'Journal', icon: <CalendarIcon size={15} /> },
              { id: 'ai' as TabType, label: 'AI Integration', icon: <Brain size={15} /> },
              { id: 'appearance' as TabType, label: 'Appearance', icon: <Palette size={15} /> },
              { id: 'about' as TabType, label: 'About', icon: <Info size={15} /> },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className="tab-btn"
                  onClick={() => setActiveTab(tab.id)}
                  style={{ 
                    whiteSpace: 'nowrap', 
                    width: isMobile ? 'auto' : '100%',
                    background: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    justifyContent: 'flex-start',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Close Button */}
          <button 
            type="button" 
            className="btn-close btn-close-overlay close-btn" 
            onClick={props.onClose} 
            aria-label="Close" 
            style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}
          />

          {/* Active Tab View Panel */}
          <div className="flex-grow-1 overflow-auto p-3" style={{ scrollbarGutter: 'stable' }}>
              {/* Tab 1: Data, Backups, ML Clustering, Taxonomies & Physics */}
              {activeTab === 'data' && (
                <DataSettingsTab 
                  onClose={props.onClose} 
                  onRefreshData={props.onRefreshData} 
                  physicsConfig={props.physicsConfig}
                  onPhysicsChange={props.onPhysicsChange}
                  categories={props.categories}
                  nlpClustering={props.nlpClustering}
                  onNlpClusteringChange={props.onNlpClusteringChange}
                  activePageId={props.activePageId}
                  pageTitle={props.pageTitle}
                  onSaveSnapshot={props.onSaveSnapshot}
                  onViewSnapshots={props.onViewSnapshots}
                />
              )}

              {/* Tab 2: Journal & Calendar History */}
              {activeTab === 'journal' && <JournalCalendar onSelectNote={props.onSelectNote} />}

              {/* Tab 3: AI Provider & Model Detection Settings */}
              {activeTab === 'ai' && <AiSettingsTab />}

              {/* Tab 4: Theme Presets & Custom Theme Studio */}
              {activeTab === 'appearance' && (
                <AppearanceSettingsTab
                  activeTheme={props.activeTheme}
                  onThemeSelect={props.onThemeSelect}
                  customThemeColors={props.customThemeColors}
                  onCustomThemeColorChange={props.onCustomThemeColorChange}
                  onCustomThemeReset={props.onCustomThemeReset}
                />
              )}

              {/* Tab 5: About, Licensing & Technical Overview */}
              {activeTab === 'about' && (
                <div className="settings-section about-section" style={{ marginTop: '20px' }}>
                  <div className="about-header">
                    <Info size={16} className="about-icon" />
                    <h3>About AetherMind</h3>
                  </div>
                  <p>
                    <strong>AetherMind v{packageJson.version} - Local-First Personal Knowledge Graph</strong><br/>
                    A dynamic spatial cognitive environment for thought synthesis. By combining D3 force-directed physics, 
                    local vector similarity embeddings, and client-side Markdown rendering, flat notes transform into an organic neural graph.
                  </p>

                  {/* Storage Quota Usage Meter */}
                  {storageInfo && (
                    <div className="d-flex align-items-center justify-content-between p-3 my-3" style={{ background: 'var(--card-nested-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div className="d-flex align-items-center gap-2">
                        <HardDrive size={16} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Local IndexedDB Storage</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {storageInfo.usage} used of {storageInfo.quota}
                      </span>
                    </div>
                  )}

                  {/* OriginUI / DaisyUI Keyboard Shortcut Cheatsheet */}
                  <div className="my-3">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Keyboard size={15} style={{ color: 'var(--accent-primary)' }} />
                      <h4 style={{ fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>Keyboard Shortcuts</h4>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                      {[
                        { label: 'Spotlight Search', shortcut: navigator.platform.includes('Mac') ? '⌘ K' : 'Ctrl+K' },
                        { label: 'New Note', shortcut: navigator.platform.includes('Mac') ? '⌘ N' : 'Ctrl+N' },
                        { label: 'Open Settings', shortcut: navigator.platform.includes('Mac') ? '⌥ S' : 'Alt+S' },
                        { label: 'Preview Markdown', shortcut: navigator.platform.includes('Mac') ? '⌘ E' : 'Ctrl+E' },
                        { label: 'Close Active Panel', shortcut: 'Esc' },
                        { label: 'Recenter Graph', shortcut: 'R' }
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="d-flex align-items-center justify-content-between px-3 py-2"
                          style={{
                            background: 'var(--card-nested-bg)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                          <kbd
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              background: 'var(--surface-badge-bg)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            {item.shortcut}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--card-nested-bg)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent-danger, #ef4444)' }}>
                    <strong>License: AGPL-3.0</strong><br />
                    This application is distributed under the GNU Affero General Public License v3.0. 
                    Any modifications or network use of this software must remain fully open-source.
                  </div>
                  <div className="credits">
                    Version {packageJson.version} (Local-First Architecture)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};