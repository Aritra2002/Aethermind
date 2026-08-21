/**
 * @file urlFetcher.ts
 * @description Web page content fetching and DOM text extraction utility for AetherMind.
 * Fetches HTML from public URLs, strips boilerplate elements (scripts, styles, navigations, footers),
 * normalizes text spacing, and enforces length caps for AI context ingestion, with comprehensive SSRF
 * validation, cloud metadata blocking, and response size guards.
 */

import { guardUntrustedContent } from './security';

/**
 * Checks if a given hostname or IP string corresponds to a private, loopback, or cloud-metadata network.
 * Handles standard dotted-decimal, pure integer (decimal), hexadecimal, octal IPv4 formats,
 * as well as IPv6 notations and internal TLDs.
 *
 * @param hostname - Hostname or IP to inspect.
 * @returns boolean - True if the host is private/internal or metadata endpoint.
 */
export function isPrivateHost(hostname: string): boolean {
  if (!hostname) return true;
  let host = hostname.toLowerCase().trim();

  // Strip IPv6 brackets if present
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }

  // Common local and metadata hostnames
  const blockedHostnames = [
    'localhost',
    '0.0.0.0',
    '::1',
    '127.0.0.1',
    'metadata.google.internal',
    'metadata.internal',
    'instance-data'
  ];

  if (blockedHostnames.includes(host)) return true;

  // Block local/internal TLDs
  if (
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host.endsWith('.corp') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }

  // Handle single integer / hex / octal IP representations (e.g. 2130706433 = 127.0.0.1)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
    try {
      const num = host.startsWith('0x') ? parseInt(host, 16) : parseInt(host, 10);
      if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
        const a = (num >>> 24) & 255;
        const b = (num >>> 16) & 255;
        return isPrivateIpv4Octets(a, b);
      }
    } catch {
      return true;
    }
  }

  // Check IPv4 standard and hybrid notations
  const ipv4Parts = host.split('.');
  if (ipv4Parts.length === 4) {
    const octets: number[] = [];
    for (const part of ipv4Parts) {
      let val: number;
      if (part.startsWith('0x') || part.startsWith('0X')) {
        val = parseInt(part, 16);
      } else if (part.length > 1 && part.startsWith('0')) {
        val = parseInt(part, 8);
      } else {
        val = parseInt(part, 10);
      }
      if (isNaN(val) || val < 0 || val > 255) return true; // Malformed -> block
      octets.push(val);
    }
    const [a, b] = octets;
    return isPrivateIpv4Octets(a, b);
  }

  // Check IPv6 loopback / unique local / link-local
  if (
    host === '::' ||
    host === '::1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc00:') ||
    host.startsWith('fd00:') ||
    host.startsWith('::ffff:127.') ||
    host.startsWith('::ffff:10.') ||
    host.startsWith('::ffff:192.168.') ||
    host.startsWith('::ffff:172.') ||
    host.startsWith('::ffff:169.254.')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if 4 numerical octets fall into RFC 1918, loopback, link-local, or cloud metadata ranges.
 */
function isPrivateIpv4Octets(a: number, b: number): boolean {
  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-Local & Cloud Instance Metadata e.g. AWS/GCP 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Wraps untrusted external content into guarded prompt injection defense tags.
 *
 * @param title - Cleaned title of the external document.
 * @param content - Extracted text content.
 * @param sourceUrl - Original source URL or filename.
 * @returns Guarded prompt context string.
 */
export function wrapGuardedContent(title: string, content: string, sourceUrl: string): string {
  return guardUntrustedContent(content, { title, source: sourceUrl, type: 'web' });
}

/**
 * Fetches the HTML content of a given web page URL, parses the title and textual body,
 * and removes boilerplate layout tags with strict SSRF defense.
 *
 * Enforces security and validation rules:
 * - Only permits `http:` and `https:` protocols.
 * - Blocks requests to private, loopback, link-local, and cloud metadata IPs (SSRF prevention).
 * - Detects unsupported media/social sites (YouTube, Twitter/X, direct PDFs) and throws helpful user guidance.
 * - Enforces an 8-second request timeout using `AbortSignal.timeout(8000)`.
 * - Caps maximum response size to 5MB to prevent memory exhaustion / decompression attacks.
 * - Strips `<script>`, `<style>`, `<noscript>`, `<nav>`, and `<footer>` tags before extracting text.
 * - Truncates extracted content to a maximum of 8,000 characters.
 * - Gracefully returns `null` on browser CORS errors or network aborts.
 *
 * @param url - The external web page URL string to fetch.
 *
 * @returns A promise resolving to an object containing extracted `{ text: string; title: string; guardedContext: string }`,
 *          or `null` if the URL is invalid or blocked by browser network/CORS policies.
 *
 * @throws {Error} If the URL targets an explicitly unsupported domain or private host,
 *                 or if the remote server returns an HTTP error status code (e.g. 404, 500).
 */
export async function fetchUrlContent(url: string): Promise<{ text: string; title: string; guardedContext: string } | null> {
  let validUrl: URL;
  try {
    validUrl = new URL(url);
    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return null;
    }
  } catch {
    // Malformed URL string
    return null;
  }

  const hostname = validUrl.hostname.toLowerCase();
  
  // SSRF guard: block private IPs, localhost, cloud metadata
  if (isPrivateHost(hostname)) {
    throw new Error('Fetching from local/private network addresses is blocked for security.');
  }

  // Guard against domains requiring dedicated client APIs or authenticated payloads
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    throw new Error("YouTube isn't supported. Paste the transcript here.");
  }
  if (hostname === 'x.com' || hostname === 'twitter.com') {
    throw new Error("X/Twitter links aren't supported. Paste the text here.");
  }
  if (validUrl.pathname.toLowerCase().endsWith('.pdf')) {
    throw new Error("PDFs can't be fetched directly. Paste the abstract here.");
  }

  try {
    // Dispatch fetch with an 8-second timeout threshold
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`That page returned an error (${response.status}). Try a different URL.`);
    }

    // Guard against oversized payload responses (> 5MB)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      throw new Error('Web page exceeds maximum allowable size limit (5MB).');
    }

    const html = await response.text();
    if (html.length > 5 * 1024 * 1024) {
      throw new Error('Web page content exceeds maximum allowable size limit (5MB).');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.title || url;
    
    // Remove non-content and layout boilerplate elements
    const scripts = doc.querySelectorAll('script, style, noscript, nav, footer');
    scripts.forEach(s => s.remove());
    
    // Extract body text and collapse multi-space whitespace
    let text = doc.body?.textContent || '';
    text = text.replace(/\s+/g, ' ').trim();
    
    // Cap text length at 8000 characters to conserve LLM context window
    if (text.length > 8000) {
      text = text.slice(0, 8000) + '...';
    }
    
    const guardedContext = wrapGuardedContent(title, text, url);
    return { text, title, guardedContext };
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Gracefully swallow expected browser CORS blocks and abort timeouts
      if (
        error.name === 'AbortError' || 
        error.message.includes('Failed to fetch') || 
        error.name === 'TypeError'
      ) {
        return null;
      }
    }
    throw error;
  }
}

/**
 * Researches a public web URL, extracts article content, and ingests it directly into the local RAG store.
 *
 * @param url - Web address to research.
 * @param pageId - Active workspace page ID.
 * @param options - Ingestion and progress options.
 * @returns Promise resolving to IngestionResult.
 */
export async function researchAndIngestUrl(
  url: string,
  pageId: number,
  options: import('./documentPipeline').IngestionOptions = {}
): Promise<import('./documentPipeline').IngestionResult> {
  const { ingestRawTextDocument } = await import('./documentPipeline');
  const parsed = await fetchUrlContent(url);
  if (!parsed || !parsed.text) {
    throw new Error(`Unable to extract content from ${url}. Check connection or CORS restrictions.`);
  }

  const title = parsed.title || url;
  const content = `# ${title}\n\n**Source**: [${url}](${url})\n\n---\n\n${parsed.text}`;

  return ingestRawTextDocument(title, content, pageId, {
    ...options,
    sourceUrl: url
  });
}
