/**
 * @file security.ts
 * @description Untrusted content containment, prompt injection defense,
 * file validation, and input boundaries for AetherMind.
 */

/**
 * Metadata associated with untrusted external content.
 */
export interface ContentMetadata {
  title: string;
  source: string;
  type?: 'web' | 'pdf' | 'docx' | 'txt' | 'clip' | 'note' | 'unknown';
}

/**
 * Neutralizes injection tokens and wraps untrusted input inside guarded XML delimiters.
 * Prevents prompt injection attacks from hijacking AI system instructions.
 *
 * @param content - Raw unescaped text content from external web, files, or notes.
 * @param metadata - Context metadata describing the content source.
 * @returns Bounded, sanitized context string for LLM prompts.
 */
export function guardUntrustedContent(content: string, metadata: ContentMetadata): string {
  if (!content) return '';

  // Neutralize common delimiter injection attempts
  const sanitized = content
    .replace(/<\/?(system_instructions|external_content|retrieved_knowledge|user_document|instruction|system)>/gi, '')
    .replace(/\[\/?(SYSTEM|INSTRUCTION|CONTEXT)\]/gi, '');

  const safeTitle = encodeURIComponent(metadata.title || 'Untitled');
  const safeSource = encodeURI(metadata.source || 'external');
  const safeType = metadata.type || 'unknown';

  return `<external_content source="${safeSource}" title="${safeTitle}" type="${safeType}" guarded="true">\n${sanitized}\n</external_content>`;
}

/**
 * Validates browser file size to prevent decompression attacks and memory exhaustion.
 *
 * @param file - Browser File object.
 * @param maxBytes - Maximum permitted byte size (default: 25MB).
 * @returns True if valid within size bounds.
 */
export function validateFileSize(file: File, maxBytes = 25 * 1024 * 1024): boolean {
  return file.size <= maxBytes;
}

/**
 * Validates text string length to prevent oversized payloads.
 *
 * @param text - Text string to inspect.
 * @param maxChars - Maximum characters permitted (default: 500,000 chars ~ 500KB).
 * @returns True if valid.
 */
export function validateTextLength(text: string, maxChars = 500_000): boolean {
  return text.length <= maxChars;
}
