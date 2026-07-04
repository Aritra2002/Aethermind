export async function fetchUrlContent(url: string): Promise<{ text: string; title: string } | null> {
  let validUrl: URL;
  try {
    validUrl = new URL(url);
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return null;
    }
  } catch {
    return null;
  }

  const hostname = validUrl.hostname.toLowerCase();
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
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`That page returned an error (${response.status}). Try a different URL.`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.title || url;
    
    const scripts = doc.querySelectorAll('script, style, noscript, nav, footer');
    scripts.forEach(s => s.remove());
    
    let text = doc.body?.textContent || '';
    text = text.replace(/\s+/g, ' ').trim();
    
    if (text.length > 8000) {
      text = text.slice(0, 8000) + '...';
    }
    
    return { text, title };
  } catch (error: any) {
    if (
      error.name === 'AbortError' || 
      error.message.includes('Failed to fetch') || 
      error instanceof TypeError ||
      error.name === 'TypeError'
    ) {
      return null;
    }
    throw error;
  }
}
