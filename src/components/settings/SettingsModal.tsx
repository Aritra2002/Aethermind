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
import { Database, Brain, Info, Calendar as CalendarIcon, Palette } from 'lucide-react';
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

  // Synchronize responsive layout state with window viewport resize events
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }} onClick={props.onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '1000px', height: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-content glass-panel border-0 h-100 d-flex flex-column" style={{ overflow: 'hidden' }}>
          {/* Modal Header */}
          <div className="modal-header d-flex justify-content-between align-items-center flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
            {!isMobile ? (
              <div>
                <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Settings</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>v{packageJson.version} · Local-First Knowledge Graph</div>
              </div>
            ) : (
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Settings</div>
            )}
            <button type="button" className="btn-close btn-close-overlay ms-auto" onClick={props.onClose} aria-label="Close" />
          </div>

          {/* Modal Body: Navigation Sidebar + Tab View Content */}
          <div className="modal-body d-flex flex-grow-1 overflow-hidden p-0" style={{ flexDirection: isMobile ? 'column' : 'row' }}>
            {/* Tab Navigation Sidebar */}
            <div 
              className={isMobile ? 'd-flex overflow-auto flex-shrink-0 gap-1 p-2' : 'd-flex flex-column flex-shrink-0 p-3 gap-1'} 
              style={{ 
                width: isMobile ? '100%' : '200px', 
                borderRight: isMobile ? 'none' : '1px solid var(--border-color)', 
                borderBottom: isMobile ? '1px solid var(--border-color)' : 'none', 
                background: 'var(--sidebar-tab-bg)' 
              }}
            >
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
                <div className="settings-section about-section" style={{ marginTop: '40px' }}>
                  <div className="about-header">
                    <Info size={16} className="about-icon" />
                    <h3>About AetherMind</h3>
                  </div>
                  <p>
                    <strong>AetherMind v{packageJson.version} - Local-first personal knowledge graph</strong><br/>
                    is a dynamic visual space for your notes. By combining a 
                    D3 force-directed simulation and Markdown parsing, it transforms flat text notes into 
                    an organic, navigable web.
                  </p>
                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--card-nested-bg)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent-danger, #ef4444)' }}>
                    <strong>License: AGPL-3.0</strong><br />
                    This application is distributed under the GNU Affero General Public License v3.0. 
                    Any modifications or network use of this software must remain fully open-source.
                  </div>
                  <div className="credits">
                    Version {packageJson.version} (Local-First)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};