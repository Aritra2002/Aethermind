// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SettingsModal } from '../components/settings/SettingsModal';
import { ToastProvider } from '../components/ToastContext';

const customGlobal = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
customGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('SettingsModal Responsive isMobile check', () => {
  it('updates isMobile status when window resizes', () => {
    // Setup window width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const mockProps = {
      onClose: vi.fn(),
      onRefreshData: vi.fn(),
      physicsConfig: { linkDistance: 50, chargeStrength: -50 },
      onPhysicsChange: vi.fn(),
      categories: [],
      nlpClustering: false,
      onNlpClusteringChange: vi.fn(),
    };

    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(SettingsModal, mockProps)
        )
      );
    });

    // Check that it starts as desktop view (displays 'Settings' header in sidebar)
    expect(container.textContent).toContain('Settings');

    // Resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event('resize'));
    });

    // Check that 'Settings' header is hidden on mobile layout
    expect(container.textContent).not.toContain('Settings');

    // Clean up
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
