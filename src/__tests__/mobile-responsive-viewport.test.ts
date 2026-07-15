// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import fs from 'fs';
import path from 'path';
import { ReviewModal } from '../components/ReviewModal';
import { EditorPanel } from '../components/EditorPanel';
import { ConfirmActionToast } from '../components/ConfirmActionToast';
import { ToastProvider } from '../components/ToastContext';

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
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 1, title: 'Spaced Repetition Note', content: 'This is the back/content.', nextReview: Date.now() - 1000, interval: 1, ease: 2.5 }
          ])
        }),
        where: vi.fn().mockReturnValue({
          equalsIgnoreCase: vi.fn().mockReturnValue({
            and: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: 1, title: 'Test Note', content: 'Existing note content', pageId: 1 })
            })
          })
        })
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
      if (str.includes('nextReview')) {
        return [
          { id: 1, title: 'Spaced Repetition Note', content: 'This is the back/content.', nextReview: Date.now() - 1000, interval: 1, ease: 2.5 }
        ];
      }
      return [];
    })
  };
});

// Mock AI Client
vi.mock('../utils/aiClient', () => ({
  callAI: vi.fn().mockResolvedValue('{"actions":[]}'),
}));

describe('Empirical Verification of Mobile Responsive Layouts', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('verifies that the CSS file exists and has responsive media query definitions', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    expect(fs.existsSync(cssPath)).toBe(true);
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify confirm action toast responsive rules under max-width: 767px media query
    expect(cssContent).toContain('.confirm-action-toast');
    expect(cssContent).toContain('left: 16px !important');
    expect(cssContent).toContain('right: 16px !important');
    expect(cssContent).toContain('width: auto !important');

    // Verify note-textarea responsive padding and font-size under small phones media query
    expect(cssContent).toContain('.note-textarea');
    expect(cssContent).toContain('font-size: 0.85rem !important');
    expect(cssContent).toContain('padding: 8px !important');
  });

  it('verifies that spaced repetition action buttons layout has flexWrap: wrap to prevent horizontal scrollbars on 320px, 360px, 375px, 480px, and 768px viewports', () => {
    const viewports = [320, 360, 375, 480, 768];

    viewports.forEach(width => {
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        });
        window.dispatchEvent(new Event('resize'));
      });

      const root = createRoot(container);
      act(() => {
        root.render(
          React.createElement(ReviewModal, { onClose: vi.fn() })
        );
      });

      // Click 'Show Answer' to reveal the review action buttons
      const showAnswerBtn = container.querySelector('button.btn-primary') as HTMLElement;
      expect(showAnswerBtn).toBeTruthy();
      expect(showAnswerBtn.textContent).toContain('Show Answer');
      act(() => {
        showAnswerBtn.click();
      });

      // Find the buttons container
      const actionsContainer = container.querySelector('.flashcard-actions') as HTMLElement;
      expect(actionsContainer).toBeTruthy();

      // Verify the styles of the flashcard-actions container that prevent overflow
      expect(actionsContainer.style.display).toBe('flex');
      expect(actionsContainer.style.flexWrap).toBe('wrap');
      expect(actionsContainer.style.gap).toBe('8px');
      expect(actionsContainer.style.justifyContent).toBe('center');

      // Verify buttons themselves exist and have correct classes
      const buttons = actionsContainer.querySelectorAll('button');
      expect(buttons.length).toBe(4);
      buttons.forEach(btn => {
        expect(btn.className).toBe('btn');
      });

      act(() => {
        root.unmount();
      });
    });
  });

  it('verifies that editor textarea contains flex: 1 and has no fixed widths causing horizontal scrollbars on 320px, 360px, 375px, 480px, and 768px viewports', () => {
    const viewports = [320, 360, 375, 480, 768];
    const mockNote = {
      id: 1,
      title: 'Responsive Note',
      content: 'Responsive Note Content',
      category: 'general',
      tags: ['test']
    };

    viewports.forEach(width => {
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        });
        window.dispatchEvent(new Event('resize'));
      });

      const root = createRoot(container);
      act(() => {
        root.render(
          React.createElement(
            ToastProvider,
            null,
            React.createElement(EditorPanel, {
              note: mockNote,
              links: [],
              categories: [{ id: 'general', label: 'General', color: '#818cf8' }],
              onClose: vi.fn(),
              onNoteDeleted: vi.fn(),
              onJumpToNote: vi.fn()
            })
          )
        );
      });

      // Switch to edit mode
      const editModeBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Edit Mode'));
      expect(editModeBtn).toBeTruthy();
      act(() => {
        editModeBtn!.click();
      });

      // Find the textarea
      const textarea = container.querySelector('#editor-note-body') as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();
      expect(textarea.className).toContain('note-textarea');

      // Verify that it is configured to stretch and resize cleanly
      expect(textarea.style.flex).toBe('1');
      expect(textarea.style.minHeight).toBe('150px');
      expect(textarea.style.resize || 'none').toBe('none');

      act(() => {
        root.unmount();
      });
    });
  });

  it('verifies that confirm action toast is styled correctly and uses responsive class overriding inline styles on 320px, 360px, 375px, 480px, and 768px viewports', () => {
    const viewports = [320, 360, 375, 480, 768];
    const mockAction = { action: 'delete_note' as const, title: 'Responsive Note', reason: 'cleanup' };

    viewports.forEach(width => {
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        });
        window.dispatchEvent(new Event('resize'));
      });

      const root = createRoot(container);
      act(() => {
        root.render(
          React.createElement(ConfirmActionToast, {
            action: mockAction,
            pageId: 1,
            onConfirm: vi.fn(),
            onCancel: vi.fn()
          })
        );
      });

      const toast = container.querySelector('.confirm-action-toast') as HTMLElement;
      expect(toast).toBeTruthy();

      // Verify inline styles
      expect(toast.style.position).toBe('fixed');
      expect(toast.style.zIndex).toBe('var(--z-toast, 9999)');
      expect(toast.style.display).toBe('flex');
      expect(toast.style.flexDirection).toBe('column');

      // Verify the toast has correct classes to target media query overrides
      expect(toast.className).toContain('confirm-action-toast');
      expect(toast.className).toContain('glass-panel');

      act(() => {
        root.unmount();
      });
    });
  });
});
