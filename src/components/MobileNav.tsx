/**
 * @file MobileNav.tsx
 * @description Fixed bottom navigation bar for mobile viewports (<768px) in AetherMind.
 * Provides touch-friendly access to Graph, Search, Editor, New Page creation, and the slide-out Menu drawer.
 * @module components/MobileNav
 */

import React from 'react';
import { Network, FileText, Plus, Menu, Search } from 'lucide-react';

/**
 * Props for the {@link MobileNav} component.
 *
 * @interface MobileNavProps
 * @property {'graph' | 'editor' | 'search' | 'menu'} activeTab - Currently active mobile view tab.
 * @property {(tab: 'graph' | 'editor' | 'search' | 'menu') => void} onTabChange - Callback invoked when a navigation tab is selected.
 * @property {() => void} onNewPage - Callback invoked to open the New Page creation modal.
 */
interface MobileNavProps {
  activeTab: 'graph' | 'editor' | 'search' | 'menu';
  onTabChange: (tab: 'graph' | 'editor' | 'search' | 'menu') => void;
  onNewPage: () => void;
}

/**
 * MobileNav Component
 *
 * A glassmorphic bottom bar that stays fixed above the mobile safe-area margin.
 * Highlights the active section with scaled icons and glow pips.
 *
 * @component
 * @param {MobileNavProps} props - Component properties.
 * @returns {React.ReactElement} The rendered mobile bottom navigation bar.
 */
export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onTabChange, onNewPage }) => {
  return (
    <nav 
      className="navbar fixed-bottom d-flex d-md-none justify-content-around align-items-center px-3"
      style={{
        height: 'calc(var(--mobile-nav-height, 60px) + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
        background: 'var(--surface-glass-heavy)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid var(--border-color)',
        paddingBottom: 'var(--safe-bottom, env(safe-area-inset-bottom, 0px))',
        zIndex: 100,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.35)'
      }}
    >
      {/* Primary Navigation Tabs: Graph, Search, Editor */}
      {[
        { tab: 'graph' as const, icon: <Network size={19} />, label: 'Graph' },
        { tab: 'search' as const, icon: <Search size={19} />, label: 'Search' },
        { tab: 'editor' as const, icon: <FileText size={19} />, label: 'Editor' },
      ].map(({ tab, icon, label }) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            className="nav-link d-flex flex-column align-items-center justify-content-center border-0 bg-transparent"
            style={{ 
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)', 
              padding: '6px 0', 
              minWidth: '54px', 
              minHeight: '44px',
              outline: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'color 160ms var(--ease-out), transform 120ms var(--ease-out)'
            }}
            onClick={() => onTabChange(tab)}
          >
            <span style={{ 
              transform: isActive ? 'scale(1.1)' : 'scale(1)', 
              transition: 'transform 200ms var(--ease-spring)',
              filter: isActive ? 'drop-shadow(0 0 8px var(--glow-primary))' : 'none'
            }}>
              {icon}
            </span>
            <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500, marginTop: '2px' }}>{label}</span>
            {isActive && (
              <span 
                style={{ 
                  position: 'absolute', 
                  bottom: '2px', 
                  width: '4px', 
                  height: '4px', 
                  borderRadius: '50%', 
                  background: 'var(--accent-primary)',
                  boxShadow: '0 0 6px var(--glow-primary)'
                }} 
              />
            )}
          </button>
        );
      })}
      
      {/* Quick New Page Action Button */}
      <button
        className="nav-link d-flex flex-column align-items-center justify-content-center border-0 bg-transparent"
        style={{ 
          color: 'var(--text-secondary)', 
          padding: '6px 0', 
          minWidth: '54px', 
          minHeight: '44px',
          outline: 'none',
          cursor: 'pointer'
        }}
        onClick={onNewPage}
      >
        <Plus size={19} />
        <span style={{ fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>New Page</span>
      </button>

      {/* Overflow Menu Drawer Toggle */}
      <button
        className="nav-link d-flex flex-column align-items-center justify-content-center border-0 bg-transparent"
        style={{ 
          color: activeTab === 'menu' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
          padding: '6px 0', 
          minWidth: '54px', 
          minHeight: '44px',
          outline: 'none',
          cursor: 'pointer',
          position: 'relative'
        }}
        onClick={() => onTabChange('menu')}
      >
        <span style={{ 
          transform: activeTab === 'menu' ? 'scale(1.1)' : 'scale(1)', 
          transition: 'transform 200ms var(--ease-spring)',
          filter: activeTab === 'menu' ? 'drop-shadow(0 0 8px var(--glow-primary))' : 'none'
        }}>
          <Menu size={19} />
        </span>
        <span style={{ fontSize: '11px', fontWeight: activeTab === 'menu' ? 600 : 500, marginTop: '2px' }}>Menu</span>
        {activeTab === 'menu' && (
          <span 
            style={{ 
              position: 'absolute', 
              bottom: '2px', 
              width: '4px', 
              height: '4px', 
              borderRadius: '50%', 
              background: 'var(--accent-primary)',
              boxShadow: '0 0 6px var(--glow-primary)'
            }} 
          />
        )}
      </button>
    </nav>
  );
};