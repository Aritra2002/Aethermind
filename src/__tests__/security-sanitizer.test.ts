// @vitest-environment jsdom
/**
 * @file security-sanitizer.test.ts
 * @description Unit tests for centralized HTML/Markdown sanitization and XSS prevention.
 */

import { describe, it, expect } from 'vitest';
import { safeSanitizeHtml, safeRenderMarkdown } from '../utils/sanitizer';

describe('Sanitizer Security & XSS Prevention', () => {
  it('strips dangerous <script> tags and inline JavaScript', () => {
    const malicious = '<p>Normal text</p><script>alert("XSS")</script><img src="x" onerror="alert(1)">';
    const clean = safeSanitizeHtml(malicious);
    
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('Normal text');
  });

  it('blocks javascript: and vbscript: URI schemes in anchors', () => {
    const malicious = '<a href="javascript:alert(1)">Click me</a> <a href="vbscript:msgbox(1)">VisualBasic</a>';
    const clean = safeSanitizeHtml(malicious);
    
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('vbscript:');
    expect(clean).toContain('Click me');
  });

  it('permits valid http, https, mailto, and wiki link protocols', () => {
    const safeHtml = '<a href="https://example.com">HTTPS</a> <a href="mailto:test@example.com">Mail</a> <a href="#wiki-Graph">Wiki</a>';
    const clean = safeSanitizeHtml(safeHtml);
    
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('href="mailto:test@example.com"');
    expect(clean).toContain('href="#wiki-Graph"');
  });

  it('enforces rel="noopener noreferrer" and target="_blank" on external web links', () => {
    const externalLink = '<a href="https://github.com/aritra2002/Aethermind">GitHub Repo</a>';
    const clean = safeSanitizeHtml(externalLink);
    
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('converts markdown [[Wiki Links]] into secure internal anchor tags', () => {
    const markdown = 'Read more in [[Machine Learning]] and [[Quantum Computing]].';
    const rendered = safeRenderMarkdown(markdown);
    
    expect(rendered).toContain('href="#wiki-Machine%20Learning"');
    expect(rendered).toContain('href="#wiki-Quantum%20Computing"');
    expect(rendered).toContain('Machine Learning');
  });

  it('strips dangerous svg, math, iframe, and form tags', () => {
    const malicious = '<svg><script>alert(1)</script></svg><iframe src="evil.com"></iframe><form action="/steal"></form>';
    const clean = safeSanitizeHtml(malicious);
    
    expect(clean).not.toContain('<svg');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<form');
    expect(clean).not.toContain('alert');
  });
});
