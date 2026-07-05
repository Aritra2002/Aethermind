import React, { useState } from 'react';
import { X, Database, Brain, Puzzle, Info, Calendar as CalendarIcon } from 'lucide-react';
import packageJson from '../../../package.json';
import { DataSettingsTab } from './DataSettingsTab';
import { AiSettingsTab } from './AiSettingsTab';
import { PluginSettingsTab } from './PluginSettingsTab';
import { JournalCalendar } from '../JournalCalendar';
import type { Category } from '../../db';

interface SettingsModalProps {
  onClose: () => void;
  onRefreshData: () => void;
  physicsConfig: { linkDistance: number; chargeStrength: number };
  onPhysicsChange: (config: { linkDistance: number; chargeStrength: number }) => void;
  categories: Category[];
  nlpClustering: boolean;
  onNlpClusteringChange: (val: boolean) => void;
  onSaveSnapshot?: () => void;
  onViewSnapshots?: () => void;
}

type TabType = 'data' | 'journal' | 'ai' | 'plugins' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const isMobile = window.innerWidth < 768;

  return (
    <div className="modal-overlay" id="settings-modal-overlay">
      <div className="settings-modal full-settings-modal glass-panel" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', width: '800px', maxWidth: '95vw', height: '80vh', padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Settings Sidebar */}
        <div style={{ width: isMobile ? '100%' : '220px', borderRight: isMobile ? 'none' : '1px solid var(--border-color)', borderBottom: isMobile ? '1px solid var(--border-color)' : 'none', display: 'flex', flexDirection: isMobile ? 'row' : 'column', background: 'rgba(0,0,0,0.2)', flexShrink: 0, overflowX: isMobile ? 'auto' : 'hidden' }}>
          {!isMobile && (
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Settings</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>v{packageJson.version}</div>
            </div>
          )}
          
          <div style={{ padding: '12px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '4px', flex: 1, overflowY: isMobile ? 'hidden' : 'auto' }}>
            <button className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')} style={{ width: isMobile ? 'auto' : '100%', justifyContent: 'flex-start', whiteSpace: 'nowrap' }}>
              <Database size={16} /> Data & Graph
            </button>
            <button className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`} onClick={() => setActiveTab('journal')} style={{ width: isMobile ? 'auto' : '100%', justifyContent: 'flex-start', whiteSpace: 'nowrap' }}>
              <CalendarIcon size={16} /> Journal
            </button>
            <button className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')} style={{ width: isMobile ? 'auto' : '100%', justifyContent: 'flex-start', whiteSpace: 'nowrap' }}>
              <Brain size={16} /> AI Integration
            </button>
            <button className={`tab-btn ${activeTab === 'plugins' ? 'active' : ''}`} onClick={() => setActiveTab('plugins')} style={{ width: isMobile ? 'auto' : '100%', justifyContent: 'flex-start', whiteSpace: 'nowrap' }}>
              <Puzzle size={16} /> Plugins
            </button>
            <div style={{ flex: 1 }}></div>
            <button className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')} style={{ width: isMobile ? 'auto' : '100%', justifyContent: 'flex-start', whiteSpace: 'nowrap' }}>
              <Info size={16} /> About
            </button>
          </div>
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
          <button className="btn btn-icon close-btn" onClick={props.onClose} aria-label="Close settings" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 'var(--z-controls, 20)' }}>
            <X size={18} />
          </button>
          
          <div style={{ flex: 1, padding: isMobile ? '16px 16px 16px 16px' : '24px 24px 24px 32px', overflowY: 'auto' }}>
            {activeTab === 'data' && <DataSettingsTab {...props} />}
            {activeTab === 'journal' && <JournalCalendar />}
            {activeTab === 'ai' && (
              <>
                <AiSettingsTab />
                <div className="settings-section" style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Voice Engine</h3>
                  <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="setting-label" style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500 }}>Transcription Engine</span>
                      <small style={{ color: 'var(--text-secondary)' }}>Local Whisper (Private, Download once) vs Cloud (Native SpeechRecognition)</small>
                    </div>
                    <select 
                      value={localStorage.getItem('voiceEngine') || 'local'} 
                      onChange={(e) => {
                        localStorage.setItem('voiceEngine', e.target.value);
                        // Force a re-render to reflect the change visually
                        setActiveTab('data'); setTimeout(() => setActiveTab('ai'), 0);
                      }}
                      style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="local" style={{ background: '#111827' }}>Local Whisper</option>
                      <option value="cloud" style={{ background: '#111827' }}>Cloud SpeechRecognition</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            {activeTab === 'plugins' && <PluginSettingsTab />}
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
                <div className="credits">
                  Version {packageJson.version} (Local-First)
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};
