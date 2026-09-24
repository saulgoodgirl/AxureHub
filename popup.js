// AxHub Sync - Popup Script (Apple HIG Edition)

const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:8088',
  token: '',
  customDomain: '',
  autoCopy: true
};

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const tabBtns = document.querySelectorAll('.segmented-item, .tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane, .tab-content');

  // Form Inputs
  const cfgServer = document.getElementById('cfg-server');
  const cfgToken = document.getElementById('cfg-token');
  const cfgDomain = document.getElementById('cfg-domain');
  const cfgAutoCopy = document.getElementById('cfg-autocopy');

  // Action Buttons & Status
  const btnSave = document.getElementById('btn-save');
  const btnTest = document.getElementById('btn-test');
  const testText = document.getElementById('test-text');
  const serverStatus = document.getElementById('server-status');
  const btnToggleToken = document.getElementById('btn-toggle-token');

  // Toggle Token visibility
  if (btnToggleToken && cfgToken) {
    btnToggleToken.addEventListener('click', () => {
      const isPass = cfgToken.type === 'password';
      cfgToken.type = isPass ? 'text' : 'password';
      const eyeOpen = btnToggleToken.querySelector('.eye-open');
      const eyeClosed = btnToggleToken.querySelector('.eye-closed');
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isPass ? 'none' : 'block';
        eyeClosed.style.display = isPass ? 'block' : 'none';
      }
    });
  }

  // History & Injection
  const historyList = document.getElementById('history-list');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnInjectCurr = document.getElementById('btn-inject-curr');

  // Tab switching with Apple spring animation
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = `tab-${btn.dataset.tab}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');

      if (btn.dataset.tab === 'history') {
        renderHistory();
      }
    });
  });

  // Load saved config
  chrome.storage.local.get(['axh_config', 'axh_history'], (res) => {
    const config = Object.assign({}, DEFAULT_CONFIG, res.axh_config || {});
    cfgServer.value = config.serverUrl;
    cfgToken.value = config.token;
    cfgDomain.value = config.customDomain || '';
    cfgAutoCopy.checked = config.autoCopy !== false;

    checkStatus(config.serverUrl, config.token);
  });

  // Remote token verification helper
  async function validateTokenRemote(serverUrl, token) {
    const cleanUrl = (serverUrl || DEFAULT_CONFIG.serverUrl).replace(/\/+$/, '');
    if (!token) {
      return { ok: false, reason: 'missing_token', message: '未填写授权凭证' };
    }

    try {
      const resp = await fetch(`${cleanUrl}/api/tokens/verify`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resp.status === 401) {
        let msg = 'Token 未在后台注册或已被禁用';
        try {
          const errData = await resp.json();
          if (errData && errData.detail) msg = errData.detail;
        } catch (e) {}
        const isSuspended = msg.includes('禁用') || msg.includes('disabled');
        return { 
          ok: false, 
          reason: isSuspended ? 'suspended' : 'unauthorized', 
          message: msg 
        };
      }
      if (resp.ok) {
        const data = await resp.json();
        return { ok: true, name: data.name || '已授权密钥', requireAuth: data.require_auth };
      }
      return { ok: false, reason: 'error', message: `服务器返回状态码: ${resp.status}` };
    } catch (e) {
      // Fallback to /api/tokens if verify endpoint is unavailable
      try {
        const fallbackResp = await fetch(`${cleanUrl}/api/tokens`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (fallbackResp.status === 401) {
          let msg = 'Token 未在后台注册或已被禁用';
          try {
            const errData = await fallbackResp.json();
            if (errData && errData.detail) msg = errData.detail;
          } catch (e) {}
          const isSuspended = msg.includes('禁用') || msg.includes('disabled');
          return { ok: false, reason: isSuspended ? 'suspended' : 'unauthorized', message: msg };
        }
        if (fallbackResp.ok) {
          return { ok: true, name: '已授权密钥', requireAuth: true };
        }
      } catch (err2) {}
      return { ok: false, reason: 'network_error', message: '无法连接到目标服务器' };
    }
  }

  // Check server & token status with live UI feedback
  async function checkStatus(url, token) {
    const cleanUrl = (url || DEFAULT_CONFIG.serverUrl).replace(/\/+$/, '');
    const dot = serverStatus.querySelector('.status-dot');
    const text = serverStatus.querySelector('.status-text');
    const badge = document.getElementById('token-status-badge');
    const desc = document.getElementById('token-desc');

    const tok = token !== undefined ? token : cfgToken.value.trim();

    if (!tok) {
      dot.className = 'status-dot offline';
      text.innerText = '未填Token';
      serverStatus.title = '未填写授权凭证 (Token)，无法推送原型';
      if (badge) {
        badge.className = 'cell-badge badge-warning';
        badge.innerText = '未填写';
      }
      if (desc) {
        desc.innerHTML = '<span style="color: #ffd60a;">⚠️ 授权凭证不能为空，请输入后台生成的有效 Token</span>';
      }
      return;
    }

    dot.className = 'status-dot connecting';
    text.innerText = '校验中';
    if (badge) {
      badge.className = 'cell-badge badge-checking';
      badge.innerText = '校验中...';
    }

    // 1. Health check
    try {
      const hResp = await fetch(`${cleanUrl}/api/health`, { method: 'GET', mode: 'cors' });
      if (!hResp.ok) throw new Error('Health check failed');
    } catch (err) {
      dot.className = 'status-dot offline';
      text.innerText = '服务离线';
      serverStatus.title = '无法连接到服务器: ' + cleanUrl;
      if (badge) {
        badge.className = 'cell-badge badge-danger';
        badge.innerText = '服务离线';
      }
      if (desc) {
        desc.innerHTML = '<span style="color: #ff453a;">🔴 无法连接云端服务器，请检查网络或服务器地址</span>';
      }
      return;
    }

    // 2. Token validation against active token pool
    const res = await validateTokenRemote(cleanUrl, tok);
    if (res.ok) {
      dot.className = 'status-dot';
      text.innerText = '已授权';
      serverStatus.title = `节点在线 · 凭证校验通过 [${res.name}]`;
      if (badge) {
        badge.className = 'cell-badge badge-success';
        badge.innerText = '✔ 已授权';
      }
      if (desc) {
        desc.innerHTML = `<span style="color: #30d158;">✔ 凭证有效 [${res.name}]，已就绪可随时同步</span>`;
      }
      cfgToken.classList.remove('input-invalid');
    } else {
      dot.className = 'status-dot offline';
      const isSuspended = res.reason === 'suspended';
      text.innerText = isSuspended ? '密钥已禁用' : 'Token无效';
      serverStatus.title = res.message || '授权凭证未通过后台校验！必须在后台生成或启用后方可同步';
      if (badge) {
        badge.className = 'cell-badge badge-danger';
        badge.innerText = isSuspended ? '✖ 密钥已禁用' : '✖ 无效 Token';
      }
      if (desc) {
        desc.innerHTML = `<span style="color: #ff453a;">⚠️ ${res.message}</span>`;
      }
      cfgToken.classList.add('input-invalid');
    }
  }

  // Live re-check on input blur or debounce input
  let checkTimeout = null;
  cfgToken.addEventListener('input', () => {
    cfgToken.classList.remove('input-invalid');
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      checkStatus(cfgServer.value.trim(), cfgToken.value.trim());
    }, 600);
  });
  cfgServer.addEventListener('change', () => {
    checkStatus(cfgServer.value.trim(), cfgToken.value.trim());
  });

  // Save config (Enforces backend token check)
  btnSave.addEventListener('click', async () => {
    const srv = cfgServer.value.trim().replace(/\/+$/, '') || DEFAULT_CONFIG.serverUrl;
    const tok = cfgToken.value.trim();

    if (!tok) {
      cfgToken.classList.add('input-invalid');
      alert('⚠️ 授权凭证 (Token) 不能为空！');
      cfgToken.focus();
      return;
    }

    const originalText = btnSave.innerHTML;
    btnSave.disabled = true;
    btnSave.innerHTML = `<span>校验凭证中...</span>`;

    const res = await validateTokenRemote(srv, tok);
    if (!res.ok) {
      btnSave.disabled = false;
      const isSuspended = res.reason === 'suspended';
      btnSave.innerHTML = `<span>✖ ${isSuspended ? '密钥已禁用' : 'Token 无效'}</span>`;
      btnSave.style.background = '#ff453a';
      cfgToken.classList.add('input-invalid');
      alert(`❌ 拒绝保存：当前 Token ${isSuspended ? '已在后台被禁用' : '未通过后台校验'}！\n\n【状态原因】：${res.message}\n后台已开启鉴权校验，必须是后台处于「启用」状态的有效 Token 才能保存并用于同步。`);
      setTimeout(() => {
        btnSave.innerHTML = originalText;
        btnSave.style.background = '';
      }, 2000);
      checkStatus(srv, tok);
      return;
    }

    const config = {
      serverUrl: srv,
      token: tok,
      customDomain: cfgDomain.value.trim().replace(/\/+$/, ''),
      autoCopy: cfgAutoCopy.checked
    };

    chrome.storage.local.set({ axh_config: config }, () => {
      btnSave.disabled = false;
      btnSave.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>✔ 校验通过并已保存</span>
      `;
      btnSave.style.background = '#30d158';

      setTimeout(() => {
        btnSave.innerHTML = originalText;
        btnSave.style.background = '';
      }, 1500);

      checkStatus(config.serverUrl, config.token);
    });
  });

  // Test connection button (Checks server health + token authorization)
  btnTest.addEventListener('click', async () => {
    const srv = cfgServer.value.trim().replace(/\/+$/, '') || DEFAULT_CONFIG.serverUrl;
    const tok = cfgToken.value.trim();

    if (!tok) {
      cfgToken.classList.add('input-invalid');
      alert('⚠️ 授权凭证 (Token) 不能为空！\n\n请先填写 AxureHub 后台生成的有效 Token。');
      cfgToken.focus();
      return;
    }

    btnTest.disabled = true;
    testText.innerText = '校验中...';
    const start = Date.now();

    try {
      // 1. Health check
      const hResp = await fetch(`${srv}/api/health`, { method: 'GET', mode: 'cors' });
      if (!hResp.ok) throw new Error('Health check failed');

      // 2. Token verification
      const res = await validateTokenRemote(srv, tok);
      const latency = Date.now() - start;

      btnTest.disabled = false;
      testText.innerText = '连通性测试';

      if (res.ok) {
        cfgToken.classList.remove('input-invalid');
        checkStatus(srv, tok);
        alert(`🟢 全链路校验通过，就绪可用！\n\n• 目标服务器: ${srv}\n• 响应时延: ${latency}ms\n• 授权凭证: ✔ 校验通过\n• 密钥身份: ${res.name}\n• 同步许可: 允许向云端推送原型`);
      } else {
        cfgToken.classList.add('input-invalid');
        checkStatus(srv, tok);
        const isSuspended = res.reason === 'suspended';
        if (isSuspended) {
          alert(`❌ 鉴权校验失败：该密钥已被后台管理员禁用！\n\n【状态信息】：${res.message}\n\n请登录管理后台端点 (${srv})\n切换至「🔑 端点与密钥」开启该密钥右侧的启用开关，或换用其他已启用的有效密钥。`);
        } else {
          alert(`❌ 鉴权校验失败：Token 无效！\n\n【原因】：${res.message}\n该 Token 未在 AxureHub 后台密钥池中注册，请在后台创建或复制有效 Token。`);
        }
      }
    } catch (err) {
      btnTest.disabled = false;
      testText.innerText = '连通性测试';
      alert(`🔴 连接失败！\n\n目标节点: ${srv}\n异常信息: ${err.message}\n\n排查建议:\n1. 确认服务器 Docker 容器 axhub-receiver 是否正常运行\n2. 检查网络或域名解析是否通畅`);
    }
  });

  // Render history
  function renderHistory() {
    chrome.storage.local.get(['axh_history'], (res) => {
      const history = res.axh_history || [];
      if (history.length === 0) {
        historyList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
              </svg>
            </div>
            <div class="empty-title">暂无原型同步记录</div>
            <div class="empty-subtitle">在 Axure RP 预览页面点击同步后，已部署的项目将自动汇集于此。</div>
          </div>
        `;
        return;
      }

      historyList.innerHTML = history.map((item) => `
        <div class="history-item">
          <div class="history-item-top">
            <span class="history-name">${escapeHtml(item.project)}</span>
            <span class="history-time">${item.time} ${item.size ? '• ' + item.size : ''}</span>
          </div>
          <div class="history-url" title="${item.url}">${item.url}</div>
          <div class="history-btns">
            <button class="mac-btn mac-btn-primary" data-action="open" data-url="${item.url}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span>打开</span>
            </button>
            <button class="mac-btn mac-btn-secondary" data-action="copy" data-url="${item.url}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              <span>复制</span>
            </button>
          </div>
        </div>
      `).join('');

      // Bind button clicks in history items
      historyList.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          const url = btn.dataset.url;
          if (action === 'open') {
            chrome.tabs.create({ url });
          } else if (action === 'copy') {
            navigator.clipboard.writeText(url).then(() => {
              const origText = btn.innerHTML;
              btn.innerHTML = '<span>已复制</span>';
              setTimeout(() => { btn.innerHTML = origText; }, 1200);
            });
          }
        });
      });
    });
  }

  // Clear history
  btnClearHistory.addEventListener('click', () => {
    if (confirm('确定要清空所有同步历史记录吗？')) {
      chrome.storage.local.remove(['axh_history'], () => {
        renderHistory();
      });
    }
  });

  // Force inject to current tab
  btnInjectCurr.addEventListener('click', () => {
    btnInjectCurr.disabled = true;
    btnInjectCurr.innerText = '正在注入...';

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) {
        alert('⚠️ 未找到当前活动网页标签！');
        btnInjectCurr.disabled = false;
        btnInjectCurr.innerText = '注入当前标签页';
        return;
      }

      const activeTab = tabs[0];
      const url = activeTab.url || '';

      // Check restricted URLs
      if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
        alert('⚠️ 无法向浏览器内置页面注入脚本！\n\n请先打开 Axure 原型页面（如本地预览 127.0.0.1:32767 或导出 html）再点击注入。');
        btnInjectCurr.disabled = false;
        btnInjectCurr.innerText = '注入当前标签页';
        return;
      }

      if (url.startsWith('file://')) {
        const isAllowed = await chrome.extension.isAllowedFileSchemeAccess();
        if (!isAllowed) {
          alert('⚠️ 本地文件权限未开启！\n\n你当前正在访问 file:// 本地原型。请在 Edge/Chrome 扩展管理中找到本插件，开启【允许访问文件网址】开关后即可注入。');
          btnInjectCurr.disabled = false;
          btnInjectCurr.innerText = '注入当前标签页';
          return;
        }
      }

      if (!chrome.scripting) {
        alert('⚠️ 浏览器未授权 scripting 模块，请重新加载扩展！');
        btnInjectCurr.disabled = false;
        btnInjectCurr.innerText = '注入当前标签页';
        return;
      }

      try {
        // 1. Insert CSS
        await chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ['content.css']
        });

        // 2. Insert JS
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['lib/jszip.min.js', 'content.js']
        });

        btnInjectCurr.innerText = '注入成功';
        alert('✅ 已成功向当前页面注入 AxureHub 同步胶囊！\n\n请查看当前网页右下角。');
        setTimeout(() => window.close(), 600);
      } catch (err) {
        btnInjectCurr.disabled = false;
        btnInjectCurr.innerText = '注入当前标签页';
        alert(`🔴 注入失败: ${err.message}\n\n可能原因：该页面已被注入，或当前域名受到浏览器安全策略限制。`);
      }
    });
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
});
