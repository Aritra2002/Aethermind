/**
 * @file fontFaces.ts
 * @description Self-hosted font faces for AetherMind (latin subset, OFL-licensed Google Fonts).
 * All faces are imported with Vite's `?inline` query so the standalone HTML export
 * (exportHtml.ts) embeds them as base64 data URIs and works fully offline.
 * Keep this list in sync with src/styles/fonts.css.
 */

import cinzel400 from '../assets/fonts/cinzel-400.woff2?inline';
import cinzel600 from '../assets/fonts/cinzel-600.woff2?inline';
import cinzel700 from '../assets/fonts/cinzel-700.woff2?inline';
import firaCode300 from '../assets/fonts/fira-code-300.woff2?inline';
import firaCode400 from '../assets/fonts/fira-code-400.woff2?inline';
import firaCode500 from '../assets/fonts/fira-code-500.woff2?inline';
import firaCode600 from '../assets/fonts/fira-code-600.woff2?inline';
import inter300 from '../assets/fonts/inter-300.woff2?inline';
import inter400 from '../assets/fonts/inter-400.woff2?inline';
import inter500 from '../assets/fonts/inter-500.woff2?inline';
import inter600 from '../assets/fonts/inter-600.woff2?inline';
import inter700 from '../assets/fonts/inter-700.woff2?inline';
import jetbrainsMono300Italic from '../assets/fonts/jetbrains-mono-300-italic.woff2?inline';
import jetbrainsMono400Italic from '../assets/fonts/jetbrains-mono-400-italic.woff2?inline';
import jetbrainsMono300 from '../assets/fonts/jetbrains-mono-300.woff2?inline';
import jetbrainsMono400 from '../assets/fonts/jetbrains-mono-400.woff2?inline';
import jetbrainsMono500 from '../assets/fonts/jetbrains-mono-500.woff2?inline';
import jetbrainsMono600 from '../assets/fonts/jetbrains-mono-600.woff2?inline';
import lora400Italic from '../assets/fonts/lora-400-italic.woff2?inline';
import lora400 from '../assets/fonts/lora-400.woff2?inline';
import lora500 from '../assets/fonts/lora-500.woff2?inline';
import lora600 from '../assets/fonts/lora-600.woff2?inline';
import lora700 from '../assets/fonts/lora-700.woff2?inline';
import merriweather300Italic from '../assets/fonts/merriweather-300-italic.woff2?inline';
import merriweather400Italic from '../assets/fonts/merriweather-400-italic.woff2?inline';
import merriweather300 from '../assets/fonts/merriweather-300.woff2?inline';
import merriweather400 from '../assets/fonts/merriweather-400.woff2?inline';
import merriweather700 from '../assets/fonts/merriweather-700.woff2?inline';
import outfit300 from '../assets/fonts/outfit-300.woff2?inline';
import outfit400 from '../assets/fonts/outfit-400.woff2?inline';
import outfit500 from '../assets/fonts/outfit-500.woff2?inline';
import outfit600 from '../assets/fonts/outfit-600.woff2?inline';
import outfit700 from '../assets/fonts/outfit-700.woff2?inline';
import playfairDisplay400Italic from '../assets/fonts/playfair-display-400-italic.woff2?inline';
import playfairDisplay400 from '../assets/fonts/playfair-display-400.woff2?inline';
import playfairDisplay600 from '../assets/fonts/playfair-display-600.woff2?inline';
import playfairDisplay700 from '../assets/fonts/playfair-display-700.woff2?inline';
import plusJakartaSans300 from '../assets/fonts/plus-jakarta-sans-300.woff2?inline';
import plusJakartaSans400 from '../assets/fonts/plus-jakarta-sans-400.woff2?inline';
import plusJakartaSans500 from '../assets/fonts/plus-jakarta-sans-500.woff2?inline';
import plusJakartaSans600 from '../assets/fonts/plus-jakarta-sans-600.woff2?inline';
import plusJakartaSans700 from '../assets/fonts/plus-jakarta-sans-700.woff2?inline';
import plusJakartaSans800 from '../assets/fonts/plus-jakarta-sans-800.woff2?inline';

/** Single source of truth for embedded font faces (family, style, weight, data URI). */
export const EMBEDDED_FONT_FACES: ReadonlyArray<{ family: string; style: 'normal' | 'italic'; weight: number; src: string }> = [
  { family: 'Cinzel', style: 'normal', weight: 400, src: cinzel400 },
  { family: 'Cinzel', style: 'normal', weight: 600, src: cinzel600 },
  { family: 'Cinzel', style: 'normal', weight: 700, src: cinzel700 },
  { family: 'Fira Code', style: 'normal', weight: 300, src: firaCode300 },
  { family: 'Fira Code', style: 'normal', weight: 400, src: firaCode400 },
  { family: 'Fira Code', style: 'normal', weight: 500, src: firaCode500 },
  { family: 'Fira Code', style: 'normal', weight: 600, src: firaCode600 },
  { family: 'Inter', style: 'normal', weight: 300, src: inter300 },
  { family: 'Inter', style: 'normal', weight: 400, src: inter400 },
  { family: 'Inter', style: 'normal', weight: 500, src: inter500 },
  { family: 'Inter', style: 'normal', weight: 600, src: inter600 },
  { family: 'Inter', style: 'normal', weight: 700, src: inter700 },
  { family: 'JetBrains Mono', style: 'italic', weight: 300, src: jetbrainsMono300Italic },
  { family: 'JetBrains Mono', style: 'italic', weight: 400, src: jetbrainsMono400Italic },
  { family: 'JetBrains Mono', style: 'normal', weight: 300, src: jetbrainsMono300 },
  { family: 'JetBrains Mono', style: 'normal', weight: 400, src: jetbrainsMono400 },
  { family: 'JetBrains Mono', style: 'normal', weight: 500, src: jetbrainsMono500 },
  { family: 'JetBrains Mono', style: 'normal', weight: 600, src: jetbrainsMono600 },
  { family: 'Lora', style: 'italic', weight: 400, src: lora400Italic },
  { family: 'Lora', style: 'normal', weight: 400, src: lora400 },
  { family: 'Lora', style: 'normal', weight: 500, src: lora500 },
  { family: 'Lora', style: 'normal', weight: 600, src: lora600 },
  { family: 'Lora', style: 'normal', weight: 700, src: lora700 },
  { family: 'Merriweather', style: 'italic', weight: 300, src: merriweather300Italic },
  { family: 'Merriweather', style: 'italic', weight: 400, src: merriweather400Italic },
  { family: 'Merriweather', style: 'normal', weight: 300, src: merriweather300 },
  { family: 'Merriweather', style: 'normal', weight: 400, src: merriweather400 },
  { family: 'Merriweather', style: 'normal', weight: 700, src: merriweather700 },
  { family: 'Outfit', style: 'normal', weight: 300, src: outfit300 },
  { family: 'Outfit', style: 'normal', weight: 400, src: outfit400 },
  { family: 'Outfit', style: 'normal', weight: 500, src: outfit500 },
  { family: 'Outfit', style: 'normal', weight: 600, src: outfit600 },
  { family: 'Outfit', style: 'normal', weight: 700, src: outfit700 },
  { family: 'Playfair Display', style: 'italic', weight: 400, src: playfairDisplay400Italic },
  { family: 'Playfair Display', style: 'normal', weight: 400, src: playfairDisplay400 },
  { family: 'Playfair Display', style: 'normal', weight: 600, src: playfairDisplay600 },
  { family: 'Playfair Display', style: 'normal', weight: 700, src: playfairDisplay700 },
  { family: 'Plus Jakarta Sans', style: 'normal', weight: 300, src: plusJakartaSans300 },
  { family: 'Plus Jakarta Sans', style: 'normal', weight: 400, src: plusJakartaSans400 },
  { family: 'Plus Jakarta Sans', style: 'normal', weight: 500, src: plusJakartaSans500 },
  { family: 'Plus Jakarta Sans', style: 'normal', weight: 600, src: plusJakartaSans600 },
  { family: 'Plus Jakarta Sans', style: 'normal', weight: 700, src: plusJakartaSans700 },
  { family: 'Plus Jakarta Sans', style: 'normal', weight: 800, src: plusJakartaSans800 },
];

/**
 * Builds `@font-face` CSS rules embedding every self-hosted face as a data URI.
 * Used by exportHtml.ts to produce a fully offline, self-contained HTML archive.
 * @returns CSS string of @font-face declarations
 */
export const buildEmbeddedFontFaceCss = (): string =>
  EMBEDDED_FONT_FACES.map(
    f => `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url("${f.src}") format('woff2');
}`
  ).join('\n\n');