/**
 * AetherMind Web Clipper — popup logic.
 *
 * Delivery strategy (smart tab handoff):
 *  1. Reuse an already-open AetherMind tab: inject a content script that
 *     postMessages the clip to the page, then waits for the app's ack
 *     (`aethermind-clip-ack`). No reload, instant.
 *  2. If no app tab is open: open the app with the clip in the URL hash
 *     (`#clip=<base64url JSON>`), which the app ingests on load.
 *  3. Fallback: copy a Markdown version to the clipboard so a clip is never
 *     silently lost when the app cannot be reached.
 */

const DEFAULT_APP_URL = 'http://localhost:5173/Aethermind/';
const CLIPPER_SOURCE = 'aethermind-clipper';
const ACK_SOURCE = 'aethermind-clip-ack';

let appUrl = DEFAULT_APP_URL;

/** Shows a status line in the popup (green on success, red on failure). */
function setStatus(msg, isSuccess = true) {
  const el = document.getElementById('status');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = isSuccess ? '#34d399' : '#f87171';
  el.textContent = msg;
}

/** Encodes a UTF-8 string as base64url (no padding). */
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds the Chrome match pattern for the configured app origin. */
function originPatternFor(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/*`;
  } catch (e) {
    return null;
  }
}

/** Loads persisted settings (app URL + RAG toggle) into the popup. */
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get({ appUrl: DEFAULT_APP_URL, asDocument: false });
    appUrl = stored.appUrl || DEFAULT_APP_URL;
    document.getElementById('appUrlInput').value = appUrl;
    document.getElementById('asDocumentToggle').checked = Boolean(stored.asDocument);
  } catch (e) {
    // storage API unavailable — use defaults
  }
}

/**
 * Delivers a clip into AetherMind: reuses an open tab, otherwise opens the app
 * with the clip in the URL hash. Returns { ok, message }.
 */
async function deliverClipToApp(payload) {
  const pattern = originPatternFor(appUrl);
  if (!pattern) return { ok: false, message: 'Invalid AetherMind app URL' };

  // One-time, user-visible grant for the configured app origin (least privilege)
  try {
    const has = await chrome.permissions.contains({ origins: [pattern] });
    if (!has) {
      const granted = await chrome.permissions.request({ origins: [pattern] });
      if (!granted) {
        return { ok: false, message: 'Permission to reach AetherMind was not granted' };
      }
    }
  } catch (e) {
    // permissions API unavailable — continue; tab query may still work
  }

  let tabFound = false;
  try {
    const tabs = await chrome.tabs.query({ url: pattern });
    if (tabs && tabs.length > 0) {
      tabFound = true;
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (clipPayload) => new Promise((resolve) => {
          const onAck = (e) => {
            const d = e.data;
            if (d && d.source === 'aethermind-clip-ack') {
              window.removeEventListener('message', onAck);
              resolve(d);
            }
          };
          window.addEventListener('message', onAck);
          window.postMessage({ source: 'aethermind-clipper', payload: clipPayload }, window.location.origin);
          // Give the app 4s to ingest and ack before falling back
          setTimeout(() => {
            window.removeEventListener('message', onAck);
            resolve({ ok: false, message: 'timed out' });
          }, 4000);
        }),
        args: [payload]
      });
      const result = results && results[0] && results[0].result;
      if (result && result.ok) {
        return { ok: true, message: result.message || 'Clipped into AetherMind' };
      }
    }
  } catch (e) {
    // injection failed — fall through
  }

  if (tabFound) {
    return { ok: false, message: 'AetherMind is open but did not respond — copied to clipboard instead' };
  }

  // No app tab open: open the app with the clip in the URL hash
  try {
    const encoded = toBase64Url(JSON.stringify(payload));
    if (encoded.length > 65536) {
      return { ok: false, message: 'Clip too large for auto-delivery — copied to clipboard instead' };
    }
    await chrome.tabs.create({ url: appUrl + '#clip=' + encoded });
    return { ok: true, message: 'Opened AetherMind with your clip' };
  } catch (e) {
    return { ok: false, message: 'Could not open AetherMind — copied to clipboard instead' };
  }
}

/**
 * Extracts active tab content using script execution.
 * Returns { title, url, metaDesc, content } or null.
 */
async function extractTabContent(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus('No active tab found', false);
    return null;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: (clipMode) => {
      const title = document.title || 'Untitled Web Clip';
      const url = window.location.href;
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      let bodyText = '';
      if (clipMode === 'selection') {
        bodyText = window.getSelection()?.toString() || '';
      } else if (clipMode === 'bookmark') {
        bodyText = metaDesc;
      } else {
        // Full article / page text
        const article = document.querySelector('article') || document.querySelector('main') || document.body;
        bodyText = article ? article.innerText : document.body.innerText;
      }

      return {
        title,
        url,
        metaDesc,
        content: bodyText.trim()
      };
    },
    args: [mode]
  });

  return results && results[0] ? results[0].result : null;
}

/** Builds the clipboard Markdown fallback for a clip mode. */
function buildClipMarkdown(mode, data) {
  if (mode === 'selection') {
    return `### Highlight from [${data.title}](${data.url})\n\n> ${data.content.replace(/\n+/g, '\n> ')}\n\n*Source: ${data.url}*`;
  }
  if (mode === 'bookmark') {
    return `### 🔖 [${data.title}](${data.url})\n\n${data.metaDesc || 'No description available.'}\n\nTags: #bookmark, #web`;
  }
  return `# [${data.title}](${data.url})\n\n> Source: ${data.url}\n> Captured: ${new Date().toLocaleDateString()}\n\n${data.content.substring(0, 5000)}`;
}

/** Handles a clip button press: try auto-delivery, fall back to clipboard. */
async function handleClip(mode) {
  const labels = { article: 'Extracting article...', selection: 'Extracting selection...', bookmark: 'Saving bookmark...' };
  setStatus(labels[mode] || 'Clipping...');

  let data;
  try {
    data = await extractTabContent(mode);
  } catch (err) {
    setStatus('Error: ' + err.message, false);
    return;
  }
  if (!data) return;

  if (mode === 'selection' && !data.content) {
    setStatus('No text selected on page. Highlight text and try again.', false);
    return;
  }

  const payload = {
    title: data.title,
    text: data.content,
    url: data.url,
    timestamp: Date.now(),
    tags: ['web-clip'],
    targetType: document.getElementById('asDocumentToggle').checked ? 'document' : 'note'
  };

  const result = await deliverClipToApp(payload);
  if (result.ok) {
    setStatus('✓ ' + result.message);
    return;
  }

  // Fallback: copy to clipboard so the clip is never lost
  try {
    await navigator.clipboard.writeText(buildClipMarkdown(mode, data));
    setStatus('✓ Copied to clipboard — paste into AetherMind' + (result.message ? ` (${result.message})` : ''));
  } catch (err) {
    setStatus('Error: ' + err.message, false);
  }
}

document.getElementById('clipArticleBtn')?.addEventListener('click', () => handleClip('article'));
document.getElementById('clipSelectionBtn')?.addEventListener('click', () => handleClip('selection'));
document.getElementById('clipBookmarkBtn')?.addEventListener('click', () => handleClip('bookmark'));

document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
  const raw = document.getElementById('appUrlInput').value.trim();
  if (!/^https?:\/\//i.test(raw)) {
    setStatus('App URL must start with http:// or https://', false);
    return;
  }
  const normalized = raw.endsWith('/') ? raw : raw + '/';
  appUrl = normalized;
  try {
    await chrome.storage.local.set({
      appUrl: normalized,
      asDocument: document.getElementById('asDocumentToggle').checked
    });
    setStatus('✓ App URL saved');
  } catch (e) {
    setStatus('Could not save settings', false);
  }
});

document.getElementById('appUrlInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('saveSettingsBtn')?.click();
});

loadSettings();