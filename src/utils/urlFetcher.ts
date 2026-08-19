/**
 * @file urlFetcher.ts
 * @description Web page content fetching and DOM text extraction utility for AetherMind.
 * Fetches HTML from public URLs, strips boilerplate elements (scripts, styles, navigations, footers),
 * normalizes text spacing, and enforces length caps for AI context ingestion, with domain validation
 * and graceful CORS/network error degradation.
 */

/**
 * Fetches the HTML content of a given web page URL, parses the title and textual body,
 * and removes boilerplate layout tags.
 *
 * Enforces security and validation rules:
 * - Only permits `http:` and `https:` protocols.
 * - Detects unsupported media/social sites (YouTube, Twitter/X, direct PDFs) and throws helpful user guidance.
 * - Enforces an 8-second request timeout using `AbortSignal.timeout(8000)`.
 * - Strips `<script>`, `<style>`, `<noscript>`, `<nav>`, and `<footer>` tags before extracting text.
 * - Truncates extracted content to a maximum of 8,000 characters.
 * - Gracefully returns `null` on browser CORS errors or network aborts.
 *
 * @param url - The external web page URL string to fetch.
 *
 * @returns A promise resolving to an object containing extracted `{ text: string; title: string }`,
 *          or `null` if the URL is invalid or blocked by browser network/CORS policies.
 *
 * @throws {Error} If the URL targets an explicitly unsupported domain (YouTube, Twitter, direct PDF)
 *                 or if the remote server returns an HTTP error status code (e.g. 404, 500).
 */
export async function fetchUrlContent(url: string): Promise<{ text: string; title: string } | null> {
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

    const html = await response.text();
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
    
    return { text, title };
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

