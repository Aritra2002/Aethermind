/**
 * @file theme-category-colors.test.ts
 * @description Unit tests verifying dynamic node category color harmonization on theme switches.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getThemeCategoryColors, syncThemeCategoryColors, THEME_CATEGORY_PALETTES } from '../utils/themeUtils';
import { db } from '../db';

describe('Theme-Aware Node Category Color Synchronization', () => {
  beforeEach(async () => {
    // Clear and mock categories in db
    vi.restoreAllMocks();
  });

  it('returns distinct, matched color palettes for each preset theme', () => {
    const darkPalette = getThemeCategoryColors('dark');
    const lightPalette = getThemeCategoryColors('light');
    const sepiaPalette = getThemeCategoryColors('sepia');
    const midnightPalette = getThemeCategoryColors('midnight');
    const oceanPalette = getThemeCategoryColors('ocean');

    expect(darkPalette.general).toBe('#818cf8');
    expect(lightPalette.general).toBe('#4f46e5');
    expect(sepiaPalette.general).toBe('#4338ca');
    expect(midnightPalette.general).toBe('#a855f7');
    expect(oceanPalette.general).toBe('#38bdf8');

    expect(darkPalette.work).toBe('#06b6d4');
    expect(lightPalette.work).toBe('#059669');
    expect(sepiaPalette.work).toBe('#15803d');
    expect(midnightPalette.work).toBe('#00f0ff');
    expect(oceanPalette.work).toBe('#10b981');

    expect(darkPalette.personal).toBe('#f43f5e');
    expect(lightPalette.personal).toBe('#db2777');
    expect(sepiaPalette.personal).toBe('#be123c');
    expect(midnightPalette.personal).toBe('#ff007f');
    expect(oceanPalette.personal).toBe('#f43f5e');

    expect(darkPalette.ideas).toBe('#fbbf24');
    expect(lightPalette.ideas).toBe('#d97706');
    expect(sepiaPalette.ideas).toBe('#b45309');
    expect(midnightPalette.ideas).toBe('#ffd700');
    expect(oceanPalette.ideas).toBe('#fbbf24');
  });

  it('dynamically harmonizes custom theme category colors from custom accents', () => {
    const customPalette = getThemeCategoryColors('custom', {
      accentPrimary: '#ff0055',
      accentSecondary: '#00ffcc'
    });

    expect(customPalette.general).toBe('#ff0055');
    expect(customPalette.work).toBe('#00ffcc');
  });

  it('synchronizes category colors into the database', async () => {
    const mockCategories: Record<string, { id: string; label: string; color: string }> = {
      general: { id: 'general', label: 'General', color: '#818cf8' },
      work: { id: 'work', label: 'Work', color: '#34d399' }
    };

    vi.spyOn(db.categories, 'get').mockImplementation(async (id: any) => mockCategories[id]);
    vi.spyOn(db.categories, 'update').mockImplementation(async (id: any, changes: any) => {
      if (mockCategories[id]) {
        Object.assign(mockCategories[id], changes);
      }
      return 1;
    });
    vi.spyOn(db.categories, 'put').mockImplementation(async (item: any) => {
      mockCategories[item.id] = item;
      return item.id;
    });

    // Switch to Sepia
    await syncThemeCategoryColors('sepia');
    expect(mockCategories.general.color).toBe(THEME_CATEGORY_PALETTES.sepia.general);
    expect(mockCategories.work.color).toBe(THEME_CATEGORY_PALETTES.sepia.work);

    // Switch to Ocean
    await syncThemeCategoryColors('ocean');
    expect(mockCategories.general.color).toBe(THEME_CATEGORY_PALETTES.ocean.general);
    expect(mockCategories.work.color).toBe(THEME_CATEGORY_PALETTES.ocean.work);
  });
});
