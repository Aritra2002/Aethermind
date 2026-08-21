/**
 * @file sanitizer.ts
 * @description Centralized HTML & Markdown sanitizer and renderer for AetherMind.
 * Provides hardened DOMPurify configuration, URI protocol allowlists,
 * safe external link rewriting (rel="noopener noreferrer", target="_blank"),
 * and unified Markdown parsing.
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

export interface SanitizeOptions {
  /** Allow custom wiki-link anchors like #wiki-Title */
  allowWikiLinks?: boolean;
  /** Whether external links should open in a new tab with rel="noopener noreferrer" */
  openExternalInNewTab?: boolean;
  /** Additional allowed HTML tags */
  extraTags?: string[];
  /** Additional allowed HTML attributes */
  extraAttrs?: string[];
}

// Ensure DOMPurify has our secure link transforming hook registered
let hookInstalled = false;

function getWindow(): Window | undefined {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    return (globalThis as unknown as { window: Window }).window;
  }
  return undefined;
}

function getPurifyInstance() {
  const win = getWindow();
  if (DOMPurify && typeof (DOMPurify as unknown as { sanitize?: unknown }).sanitize === 'function') {
    return DOMPurify;
  }
  const defaultExport = (DOMPurify as unknown as { default?: unknown })?.default;
  if (defaultExport && typeof (defaultExport as { sanitize?: unknown }).sanitize === 'function') {
    return defaultExport as typeof DOMPurify;
  }
  if (typeof DOMPurify === 'function' && win) {
    try {
      return (DOMPurify as unknown as (w: Window) => typeof DOMPurify)(win);
    } catch {
      // Fallback
    }
  }
  if (typeof defaultExport === 'function' && win) {
    try {
      return (defaultExport as (w: Window) => typeof DOMPurify)(win);
    } catch {
      // Fallback
    }
  }
  return DOMPurify;
}

function ensurePurifyHooks() {
  if (hookInstalled || typeof window === 'undefined') return;
  const purify = getPurifyInstance();
  if (!purify || typeof (purify as unknown as { addHook?: unknown }).addHook !== 'function') return;
  
  (purify as unknown as { addHook: (name: string, cb: (node: Element) => void) => void }).addHook('afterSanitizeAttributes', (node: Element) => {
    // Set all external links to open in a new window safely
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.getAttribute('href') || '';
      // If it's a web URL (http/https), force rel and target attributes
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else if (href.startsWith('#wiki-')) {
        node.removeAttribute('target');
        node.setAttribute('rel', 'internal');
      }
    }
  });

  hookInstalled = true;
}

/**
 * Sanitizes an HTML string using hardened DOMPurify settings.
 *
 * @param dirtyHtml - Untrusted HTML string to sanitize.
 * @param options - Optional sanitization configurations.
 * @returns Safe, sanitized HTML string.
 */
export function safeSanitizeHtml(dirtyHtml: string, options: SanitizeOptions = {}): string {
  if (!dirtyHtml) return '';

  ensurePurifyHooks();
  const purify = getPurifyInstance();

  if (!purify || typeof (purify as unknown as { sanitize?: unknown }).sanitize !== 'function') {
    return dirtyHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  }

  const allowedTags = [
    'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span', 'div',
    'del', 's', 'strike', 'sup', 'sub', 'kbd', 'mark', 'details', 'summary',
    'input', // For markdown task lists (type="checkbox" disabled)
    ...(options.extraTags || [])
  ];

  const allowedAttrs = [
    'href', 'title', 'class', 'style', 'id', 'name', 'target', 'rel',
    'type', 'checked', 'disabled', // For task list checkboxes
    'data-line', 'data-note-id',
    ...(options.extraAttrs || [])
  ];

  // Whitelist safe URI schemes: http, https, mailto, tel, relative hashes (# and #wiki-)
  const allowedUriPattern = /^(https?:|mailto:|tel:|#wiki-|#)/i;

  const sanitized = (purify as unknown as { sanitize: (s: string, cfg: unknown) => string }).sanitize(dirtyHtml, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
    ALLOWED_URI_REGEXP: allowedUriPattern,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
    KEEP_CONTENT: true,
  });

  return sanitized;
}

/**
 * Alias for safeSanitizeHtml.
 */
export const sanitizeHtml = safeSanitizeHtml;

/**
 * Converts Markdown text containing [[Wiki Links]] into sanitized HTML.
 *
 * @param markdown - Raw Markdown string with optional [[Wiki Links]].
 * @param options - Optional rendering & sanitization options.
 * @returns Safe, sanitized HTML string ready for injection.
 */
export function safeRenderMarkdown(markdown: string, options: SanitizeOptions = {}): string {
  if (!markdown) return '';

  // Transform [[Note Title]] into markdown links [Note Title](#wiki-EncodedTitle)
  const processed = markdown.replace(/\[\[(.*?)\]\]/g, (_, rawTitle) => {
    const cleanTitle = (rawTitle || '').trim();
    if (!cleanTitle) return '';
    return `[${cleanTitle}](#wiki-${encodeURIComponent(cleanTitle)})`;
  });

  try {
    const rawHtml = marked.parse(processed, {
      gfm: true,
      breaks: true
    }) as string;

    return safeSanitizeHtml(rawHtml, options);
  } catch (err) {
    console.error('Markdown rendering failed:', err);
    return `<p class="text-danger">Failed to render markdown content safely.</p>`;
  }
}
