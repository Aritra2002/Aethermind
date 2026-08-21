/**
 * Helper to show status message in the extension popup.
 */
function setStatus(msg, isSuccess = true) {
  const el = document.getElementById('status');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = isSuccess ? '#34d399' : '#f87171';
  el.textContent = msg;
}

/**
 * Extracts active tab content using script execution.
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

// Handler: Full Article
document.getElementById('clipArticleBtn')?.addEventListener('click', async () => {
  setStatus('Extracting article...');
  try {
    const data = await extractTabContent('article');
    if (!data) return;
    
    const clipMarkdown = `# [${data.title}](${data.url})\n\n> Source: ${data.url}\n> Captured: ${new Date().toLocaleDateString()}\n\n${data.content.substring(0, 5000)}`;
    await navigator.clipboard.writeText(clipMarkdown);
    setStatus('✓ Full article copied to clipboard! Paste directly into AetherMind.');
  } catch (err) {
    setStatus('Error: ' + err.message, false);
  }
});

// Handler: Selection Text
document.getElementById('clipSelectionBtn')?.addEventListener('click', async () => {
  setStatus('Extracting selection...');
  try {
    const data = await extractTabContent('selection');
    if (!data || !data.content) {
      setStatus('No text selected on page. Highlight text and try again.', false);
      return;
    }
    
    const clipMarkdown = `### Highlight from [${data.title}](${data.url})\n\n> ${data.content.replace(/\n+/g, '\n> ')}\n\n*Source: ${data.url}*`;
    await navigator.clipboard.writeText(clipMarkdown);
    setStatus('✓ Selection copied to clipboard! Paste directly into AetherMind.');
  } catch (err) {
    setStatus('Error: ' + err.message, false);
  }
});

// Handler: Bookmark Link
document.getElementById('clipBookmarkBtn')?.addEventListener('click', async () => {
  setStatus('Saving bookmark...');
  try {
    const data = await extractTabContent('bookmark');
    if (!data) return;
    
    const clipMarkdown = `### 🔖 [${data.title}](${data.url})\n\n${data.metaDesc || 'No description available.'}\n\nTags: #bookmark, #web`;
    await navigator.clipboard.writeText(clipMarkdown);
    setStatus('✓ Bookmark copied to clipboard! Paste directly into AetherMind.');
  } catch (err) {
    setStatus('Error: ' + err.message, false);
  }
});
