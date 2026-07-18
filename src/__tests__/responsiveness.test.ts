// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SettingsModal } from '../components/settings/SettingsModal';
import { JournalCalendar } from '../components/JournalCalendar';
import App from '../App';
import { ToastProvider } from '../components/ToastContext';

// Set react act environment flag
const customGlobal = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
customGlobal.IS_REACT_ACT_ENVIRONMENT = true;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length;
    }
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});
global.localStorage = localStorageMock;

// Mock DB
vi.mock('../db', () => {
  const countMock = vi.fn().mockResolvedValue(1);
  return {
    db: {
      notes: {
        count: countMock,
        toArray: vi.fn().mockResolvedValue([]),
      },
      links: {
        count: countMock,
        toArray: vi.fn().mockResolvedValue([]),
      },
      pages: {
        count: countMock,
        toArray: vi.fn().mockResolvedValue([{ id: 1, title: 'Graph', createdAt: Date.now() }]),
      },
      categories: {
        count: countMock,
        toArray: vi.fn().mockResolvedValue([
          { id: 'general', label: 'General', color: '#818cf8' },
          { id: 'work', label: 'Work', color: '#34d399' }
        ]),
      },
      snapshots: {
        count: countMock,
        toArray: vi.fn().mockResolvedValue([]),
      },
      transaction: vi.fn(),
    }
  };
});

// Mock dexie-react-hooks
vi.mock('dexie-react-hooks', () => {
  return {
    useLiveQuery: vi.fn((cb) => {
      const str = cb.toString();
      if (str.includes('pages')) {
        return [{ id: 1, title: 'Graph', createdAt: Date.now() }];
      }
      if (str.includes('categories')) {
        return [
          { id: 'general', label: 'General', color: '#818cf8' },
          { id: 'work', label: 'Work', color: '#34d399' }
        ];
      }
      return [];
    })
  };
});

// Mock AI utils and snapshot manager
vi.mock('../utils/aiClient', () => ({
  callAI: vi.fn().mockResolvedValue('{"actions":[]}'),
}));

vi.mock('../utils/snapshotManager', () => ({
  saveSnapshot: vi.fn(),
  loadSnapshot: vi.fn(),
  getSnapshots: vi.fn().mockResolvedValue([]),
  restoreSnapshot: vi.fn(),
}));

// Mock GraphCanvas to avoid lazy-loading D3 canvas issues in jsdom
vi.mock('../components/GraphCanvas', () => {
  return {
    GraphCanvas: () => React.createElement('div', { 'data-testid': 'mock-graph-canvas' }, 'Mock Graph Canvas')
  };
});

describe('Mobile responsiveness fixes validation', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe('SettingsModal responsiveness', () => {
    const mockProps = {
      onClose: vi.fn(),
      onRefreshData: vi.fn(),
      physicsConfig: { linkDistance: 50, chargeStrength: -50 },
      onPhysicsChange: vi.fn(),
      categories: [],
      nlpClustering: false,
      onNlpClusteringChange: vi.fn(),
      activePageId: 1,
      pageTitle: 'Test Page',
      activeTheme: 'dark',
      onThemeSelect: vi.fn(),
      customThemeColors: {},
      onCustomThemeColorChange: vi.fn(),
      onCustomThemeReset: vi.fn(),
    };

    it('applies desktop layout on viewport >= 768px', () => {
      // Set width to desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

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

      // Verify header "Settings" is displayed in desktop view
      expect(container.textContent).toContain('Settings');

      // Verify the outer settings modal container styles (flex-direction: row)
      const modalElement = container.querySelector('.settings-modal') as HTMLElement;
      expect(modalElement).toBeTruthy();
      expect(modalElement.style.flexDirection).toBe('row');

      // Verify the sidebar element is present and uses desktop styling (flexDirection column, width 220px)
      const sidebarElement = modalElement.firstElementChild as HTMLElement;
      expect(sidebarElement).toBeTruthy();
      expect(sidebarElement.style.width).toBe('220px');
      expect(sidebarElement.style.flexDirection).toBe('column');

      // Verify close button is positioned absolute
      const closeBtn = container.querySelector('.close-btn') as HTMLElement;
      expect(closeBtn).toBeTruthy();
      expect(closeBtn.style.position).toBe('absolute');

      act(() => {
        root.unmount();
      });
    });

    it('applies mobile layout on viewport < 768px', () => {
      // Set width to mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

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

      // Verify header "Settings" is hidden in mobile view
      expect(container.textContent).not.toContain('Settings');

      // Verify the outer settings modal container styles (flex-direction: column)
      const modalElement = container.querySelector('.settings-modal') as HTMLElement;
      expect(modalElement).toBeTruthy();
      expect(modalElement.style.flexDirection).toBe('column');

      // Verify the sidebar element is present and uses mobile styling (flexDirection row, width 100%)
      const sidebarElement = modalElement.firstElementChild as HTMLElement;
      expect(sidebarElement).toBeTruthy();
      expect(sidebarElement.style.width).toBe('100%');
      expect(sidebarElement.style.flexDirection).toBe('row');

      act(() => {
        root.unmount();
      });
    });

    it('handles transition dynamically during resizing and rotation', () => {
      // Start in portrait mobile view
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 390,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 844,
      });

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

      const modalElement = container.querySelector('.settings-modal') as HTMLElement;
      const sidebarElement = modalElement.firstElementChild as HTMLElement;

      expect(modalElement.style.flexDirection).toBe('column');
      expect(sidebarElement.style.flexDirection).toBe('row');

      // Simulate orientation change / rotation to mobile landscape (844x390)
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 844,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 390,
        });
        window.dispatchEvent(new Event('resize'));
      });

      // Since width 844px >= 768px, layout must dynamically transition to desktop (row) layout
      expect(modalElement.style.flexDirection).toBe('row');
      expect(sidebarElement.style.flexDirection).toBe('column');

      // Rotate back to mobile portrait (390x844)
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 390,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 844,
        });
        window.dispatchEvent(new Event('resize'));
      });

      // Layout should return to mobile (column) layout
      expect(modalElement.style.flexDirection).toBe('column');
      expect(sidebarElement.style.flexDirection).toBe('row');

      act(() => {
        root.unmount();
      });
    });
  });

  describe('JournalCalendar responsiveness', () => {
    it('implements responsive column/row grid layout and horizontal overflow scroll', () => {
      const root = createRoot(container);
      act(() => {
        root.render(React.createElement(JournalCalendar));
      });

      // Find the grid layout container inside JournalCalendar
      // The container has: display: grid, gridTemplateRows: repeat(7, 10px), gridAutoFlow: column
      const gridContainer = container.querySelector('div[style*="display: grid"]') as HTMLElement;
      expect(gridContainer).toBeTruthy();

      const styles = gridContainer.style;
      expect(styles.display).toBe('grid');
      expect(styles.gridTemplateRows).toBe('repeat(7, 10px)');
      expect(styles.gridAutoFlow).toBe('column');
      expect(styles.gap).toBe('4px');
      expect(styles.maxWidth).toBe('100%');
      expect(styles.overflowX).toBe('auto');

      // Verify child blocks are rendered inside
      const dayBlocks = gridContainer.children;
      expect(dayBlocks.length).toBeGreaterThan(300); // 365 or 366 days in a year

      const firstBlock = dayBlocks[0] as HTMLElement;
      expect(firstBlock.style.width).toBe('10px');
      expect(firstBlock.style.height).toBe('10px');
      expect(firstBlock.style.borderRadius).toBe('2px');

      act(() => {
        root.unmount();
      });
    });
  });

  describe('Document Processing Card Centering', () => {
    it('aligns centrally under loading state and maintains sizing on extra small viewports', async () => {
      // Spy on document.createElement to capture the actual input element created
      let createdInput: HTMLInputElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'input') {
          createdInput = el as HTMLInputElement;
        }
        return el;
      });

      // Start with a desktop viewport (1024px width) so the upload button is directly in the header
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const root = createRoot(container);
      act(() => {
        root.render(
          React.createElement(
            ToastProvider,
            null,
            React.createElement(App)
          )
        );
      });

      // Find and click the upload button to trigger handleUploadDocument
      const uploadBtns = container.querySelectorAll('button[title="Upload Document"]');
      expect(uploadBtns.length).toBeGreaterThan(0);
      
      act(() => {
        (uploadBtns[0] as HTMLElement).click();
      });

      // Verify input creation was intercepted
      expect(createdInput).toBeTruthy();

      // Trigger file selection, setting docLoading to true
      const mockFile = new File(['hello mind'], 'test.txt', { type: 'text/plain' });
      
      // Simulate input selection using Object.defineProperty to bypass JS validation on 'files'
      Object.defineProperty(createdInput, 'files', {
        value: [mockFile],
        writable: true
      });

      await act(async () => {
        createdInput?.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Now dynamically resize to a very narrow viewport (320px width - e.g. iPhone SE)
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 320,
        });
        window.dispatchEvent(new Event('resize'));
      });

      // Verify loader modal overlay is displayed
      const modalOverlay = container.querySelector('.modal-overlay') as HTMLElement;
      expect(modalOverlay).toBeTruthy();

      // Verify alignment classes: flexbox centering
      // overlay has class: modal-overlay !flex !items-center !justify-center !p-4
      expect(modalOverlay.className).toContain('modal-overlay');
      expect(modalOverlay.className).toContain('!flex');
      expect(modalOverlay.className).toContain('!items-center');
      expect(modalOverlay.className).toContain('!justify-center');
      expect(modalOverlay.className).toContain('!p-4');

      // Verify the premium-loader-card inside the overlay
      const loaderCard = modalOverlay.querySelector('.premium-loader-card') as HTMLElement;
      expect(loaderCard).toBeTruthy();

      // Verify CSS styles of the card: responsive width and max-width capping
      expect(loaderCard.style.width).toBe('100%');
      expect(loaderCard.style.maxWidth).toBe('400px');

      spy.mockRestore();
      act(() => {
        root.unmount();
      });
    });
  });
});
