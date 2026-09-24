// AxHub Sync - Background Service Worker (Manifest V3)

const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:8088',
  token: '',
  customDomain: '',
  autoCopy: true,
  collapsed: false
};

// On install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AxureHub Sync] Extension installed successfully.');
  chrome.storage.local.get(['axh_config'], (res) => {
    if (!res || !res.axh_config) {
      chrome.storage.local.set({ axh_config: DEFAULT_CONFIG });
    }
  });

  // Create context menu for quick injection on any page
  chrome.contextMenus.create({
    id: 'axh-inject-menu',
    title: '🚀 在当前页面呼出 AxureHub 同步胶囊',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'axh-inject-menu' && tab && tab.id) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['lib/jszip.min.js', 'content.js']
      });
    } catch (err) {
      console.warn('[AxureHub Sync] Context menu inject error:', err);
    }
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get_config') {
    chrome.storage.local.get(['axh_config'], (res) => {
      sendResponse({ config: Object.assign({}, DEFAULT_CONFIG, res.axh_config || {}) });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'proxy_fetch') {
    // Allows content script to bypass CORS if ever needed
    fetch(message.url, message.options || {})
      .then(async (r) => {
        const text = await r.text();
        sendResponse({ ok: r.ok, status: r.status, data: text });
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
});
