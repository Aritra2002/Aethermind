// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToHtml } from '../utils/exportHtml';

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
  return {
    db: {
      notes: {
        where: vi.fn().mockReturnThis(),
        equals: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          {
            id: 1,
            pageId: 1,
            title: 'Test Note 1',
            content: 'This is a test note content with [[Test Note 2]] link.',
            tags: ['test', 'knowledge'],
            category: 'work',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ])
      },
      categories: {
        toArray: vi.fn().mockResolvedValue([
          { id: 'work', label: 'Work Category', color: '#34d399' },
          { id: 'general', label: 'General Category', color: '#818cf8' }
        ])
      }
    }
  };
});

describe('Theme System & Offline Export Stress Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('verifies that selecting preset theme updates localStorage and data-theme on root', () => {
    const root = document.documentElement;
    
    // Simulate setting theme 'sepia'
    root.setAttribute('data-theme', 'sepia');
    localStorage.setItem('aethermind-theme', 'sepia');

    expect(root.getAttribute('data-theme')).toBe('sepia');
    expect(localStorage.getItem('aethermind-theme')).toBe('sepia');
    
    // Simulate setting theme 'ocean'
    root.setAttribute('data-theme', 'ocean');
    localStorage.setItem('aethermind-theme', 'ocean');

    expect(root.getAttribute('data-theme')).toBe('ocean');
    expect(localStorage.getItem('aethermind-theme')).toBe('ocean');
  });

  it('verifies offline exportHtml output structure and theme switcher script positioning (FOUT Risk)', async () => {
    // Mock URL object methods
    const mockCreateObjectURL = vi.fn(() => {
      // In JS, Blob text can be read asynchronously, but for testing we can hook into Blob.text()
      return 'blob:mock-url';
    });
    
    const mockRevokeObjectURL = vi.fn();
    
    global.URL.createObjectURL = mockCreateObjectURL as unknown as typeof global.URL.createObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL as unknown as typeof global.URL.revokeObjectURL;
    
    // Mock document.createElement & click to intercept the download
    const mockClick = vi.fn();
    vi.spyOn(document.body, 'appendChild');
    vi.spyOn(document.body, 'removeChild');
    
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', { value: mockClick });
      }
      return element;
    });

    // Set a mock theme and custom theme
    localStorage.setItem('aethermind-theme', 'custom');
    localStorage.setItem('aethermind-custom-themes', JSON.stringify({
      bgPrimary: '#1a1a2e',
      textPrimary: '#eaeaea',
      accentPrimary: '#ff007f'
    }));

    // Trigger export
    await exportToHtml(1, 'My Special Graph');

    // Retrieve the blob passed to createObjectURL
    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blob: Blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    capturedHtml = await blob.text();

    // Verify metadata and structure
    expect(capturedHtml).toContain('<!DOCTYPE html>');
    expect(capturedHtml).toContain('My Special Graph');
    expect(capturedHtml).toContain('Work Category');
    expect(capturedHtml).toContain('Test Note 1');
    expect(capturedHtml).toContain('href="#note-1"');

    // 1. Check if theme switcher is present in sidebar
    expect(capturedHtml).toContain('id="themeSelect"');
    expect(capturedHtml).toContain('value="dark"');
    expect(capturedHtml).toContain('value="light"');
    expect(capturedHtml).toContain('value="sepia"');
    expect(capturedHtml).toContain('value="midnight"');
    expect(capturedHtml).toContain('value="ocean"');
    expect(capturedHtml).toContain('value="custom"');

    // 2. Stress-test offline theme persistence logic
    // Expect the switcher script to reference 'aethermind-export-theme'
    expect(capturedHtml).toContain('aethermind-export-theme');
    
    // 3. FOUT Stress Test: Check positioning of theme-setting script
    // If the theme switcher initialization script is at the bottom of the body (e.g., after the content),
    // a FOUT (Flash of Unstyled Text/Theme) occurs because the body is rendered before the script executes.
    const bodyStartIdx = capturedHtml.indexOf('<body>');
    const scriptIdx = capturedHtml.indexOf('const themeSelect = document.getElementById(\'themeSelect\');');
    const mainContentIdx = capturedHtml.indexOf('class="main-content"');
    
    expect(bodyStartIdx).toBeGreaterThan(0);
    expect(scriptIdx).toBeGreaterThan(bodyStartIdx);
    
    // Script is located after the main content, which creates a flash of default styling (FOUT) on slow/offline loads
    expect(scriptIdx).toBeGreaterThan(mainContentIdx);
  });
});
