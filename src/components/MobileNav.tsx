import React from 'react';
import { Network, FileText, Plus, Menu } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';

interface MobileNavProps {
  pageId: number;
  activeTab: 'graph' | 'editor' | 'search' | 'menu';
  onTabChange: (tab: 'graph' | 'editor' | 'search' | 'menu') => void;
  onCreateNote: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ pageId, activeTab, onTabChange, onCreateNote }) => {
  return (
    <div className="mobile-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, 
      height: 'calc(var(--mobile-nav-height, 60px) + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))', 
      background: 'rgba(15, 20, 50, 0.85)', 
      backdropFilter: 'blur(10px)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      borderTop: '1px solid rgba(124, 58, 237, 0.15)',
      paddingBottom: 'var(--safe-bottom, env(safe-area-inset-bottom, 0px))',
      zIndex: 100
    }}>
      <button 
        style={{ background: 'none', border: 'none', color: activeTab === 'graph' ? 'var(--accent-primary, #7c3aed)' : 'var(--text-secondary, #9ca3af)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        onClick={() => onTabChange('graph')}
      >
        <Network size={20} style={{ transform: activeTab === 'graph' ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }} />
        <span style={{ fontSize: '10px' }}>Graph</span>
      </button>
      <button 
        style={{ background: 'none', border: 'none', color: activeTab === 'editor' ? 'var(--accent-primary, #7c3aed)' : 'var(--text-secondary, #9ca3af)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        onClick={() => onTabChange('editor')}
      >
        <FileText size={20} style={{ transform: activeTab === 'editor' ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }} />
        <span style={{ fontSize: '10px' }}>Editor</span>
      </button>
      <button 
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #9ca3af)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        onClick={onCreateNote}
      >
        <Plus size={20} style={{ transition: 'transform 0.2s' }} />
        <span style={{ fontSize: '10px' }}>New</span>
      </button>

      <VoiceRecorder pageId={pageId} variant="nav" />

      <button 
        style={{ background: 'none', border: 'none', color: activeTab === 'menu' ? 'var(--accent-primary, #7c3aed)' : 'var(--text-secondary, #9ca3af)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        onClick={() => onTabChange('menu')}
      >
        <Menu size={20} style={{ transform: activeTab === 'menu' ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }} />
        <span style={{ fontSize: '10px' }}>Menu</span>
      </button>
    </div>
  );
};
