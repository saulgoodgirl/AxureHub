/**
 * AxHub Sync - Content Script (v1.1.0 High-Performance Multi-Page Engine)
 * Injected into Axure RP prototype preview pages (start.html)
 * Author: Antigravity / Onyx
 */

(function () {
  'use strict';

  if (window.top !== window || document.getElementById('axhub-sync-root')) {
    return;
  }

  const DEFAULT_CONFIG = {
    serverUrl: 'http://localhost:8088',
    token: '',
    customDomain: '',
    autoCopy: true,
    collapsed: false
  };

  let currentConfig = Object.assign({}, DEFAULT_CONFIG);
  let projectName = 'Axure_Prototype';
  let isSyncing = false;
  let serverAuthState = { status: 'checking', message: '', name: '' };

  function playSuccessChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.12);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }

  function detectProjectName() {
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const text = scripts[i].innerText || '';
        const match = text.match(/PREVIEW_INFO\s*=\s*{\s*fileName\s*:\s*['"]([^'"]+)['"]/);
        if (match && match[1]) {
          return match[1].replace(/\.rp$/i, '');
        }
      }

      if (window.$axure && window.$axure.document && window.$axure.document.configuration) {
        const pName = window.$axure.document.configuration.projectName;
        if (pName && pName !== 'Untitled') return pName;
      }

      let title = document.title || '';
      title = title.replace(/[-_]\s*Axure(\s*RP)?/i, '').replace(/Preview/i, '').trim();
      if (title && title !== 'Untitled' && title !== 'start') return title;

      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        return pathParts[pathParts.length - 2];
      }
    } catch (e) {
      console.warn('[AxHub Sync] Project name detect error:', e);
    }
    return 'Axure_Prototype';
  }

  function initUI() {
    projectName = detectProjectName();

    const root = document.createElement('div');
    root.id = 'axhub-sync-root';
    if (currentConfig.collapsed) {
      root.classList.add('collapsed');
    }

    root.innerHTML = `
      <div class="axh-mini-trigger" id="axh-btn-expand" title="展开 AxureHub 智能同步胶囊">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
          <polyline points="12 12 12 16"/>
          <polyline points="10 14 12 12 14 14"/>
        </svg>
      </div>

      <div class="axh-capsule" id="axh-capsule">
        <div class="axh-brand" title="AxureHub 私有同步引擎 (Online)">
          <div class="axh-brand-logo">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
          </div>
          <span class="axh-brand-dot" id="axh-status-dot"></span>
          <span>AxureHub</span>
        </div>

        <div class="axh-divider"></div>

        <div class="axh-project-name" id="axh-project-display" title="点击重命名同步项目名称">
          ${projectName}
        </div>

        <button class="axh-btn axh-btn-primary" id="axh-btn-sync">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>同步到云端</span>
        </button>

        <button class="axh-btn axh-btn-icon" id="axh-btn-settings" title="配置服务器与密钥">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <button class="axh-btn axh-btn-icon" id="axh-btn-collapse" title="收起胶囊">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      <div class="axh-progress-panel" id="axh-progress-panel">
        <div class="axh-progress-header">
          <div class="axh-progress-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" stroke-width="2.5">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
            <span>正在同步原型...</span>
          </div>
          <span class="axh-progress-percent" id="axh-progress-val">0%</span>
        </div>
        <div class="axh-bar-bg">
          <div class="axh-bar-fill" id="axh-progress-bar"></div>
        </div>
        <div class="axh-status-text" id="axh-progress-status">准备就绪...</div>
      </div>

      <div class="axh-success-card" id="axh-success-card">
        <div class="axh-success-header">
          <div class="axh-success-title">
            <div class="axh-success-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <span>同步成功！云端已就绪</span>
          </div>
          <button class="axh-btn axh-btn-icon" id="axh-btn-close-success" title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="axh-url-box" id="axh-success-url" title="点击复制分享链接">https://...</div>
        <div class="axh-success-actions">
          <button class="axh-btn axh-btn-primary" id="axh-btn-open-url">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>打开预览</span>
          </button>
          <button class="axh-btn axh-btn-subtle" id="axh-btn-copy-again">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>复制链接</span>
          </button>
        </div>
      </div>

      <div class="axh-modal-overlay" id="axh-modal-overlay">
        <div class="axh-modal">
          <div class="axh-modal-title">
            <span>AxureHub 节点配置</span>
            <button class="axh-btn axh-btn-icon" id="axh-btn-close-modal">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="axh-inset-group">
            <div class="axh-inset-item">
              <label class="axh-form-label">云端服务器地址 (Endpoint)</label>
              <input type="text" class="axh-input" id="axh-cfg-server" placeholder="http://localhost:8088 或 https://your-domain.com">
            </div>
            <div class="axh-inset-item">
              <label class="axh-form-label">访问凭证 (Token)</label>
              <div class="axh-input-wrapper">
                <input type="password" class="axh-input" id="axh-cfg-token" placeholder="your-admin-token">
                <button type="button" class="axh-btn-eye" id="axh-btn-toggle-token" title="显示/隐藏凭证">
                  <svg class="axh-eye-open" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg class="axh-eye-closed" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="axh-inset-item">
              <label class="axh-form-label">当前项目名称</label>
              <input type="text" class="axh-input" id="axh-cfg-project" placeholder="项目名称">
            </div>
            <div class="axh-inset-item">
              <label class="axh-form-label">自定义公网域名 (可选)</label>
              <input type="text" class="axh-input" id="axh-cfg-domain" placeholder="例如 https://your-domain.com">
            </div>
          </div>

          <div class="axh-modal-footer">
            <button class="axh-btn axh-btn-subtle" id="axh-btn-test-conn">
              <span>测试连通性</span>
            </button>
            <button class="axh-btn axh-btn-primary" id="axh-btn-save-cfg">
              <span>保存配置</span>
            </button>
          </div>
        </div>
      </div>

      <div class="axh-toast" id="axh-toast">
        <span id="axh-toast-msg">消息提示</span>
      </div>
    `;

    ensureStylesInjected();
    document.body.appendChild(root);
    bindEvents();
    loadConfiguration();
  }

  function ensureStylesInjected() {
    if (document.getElementById('axh-sync-injected-styles')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'axh-sync-injected-styles';
    style.textContent = `
      #axhub-sync-root {
        position: fixed !important;
        bottom: clamp(12px, 2.5vw, 24px) !important;
        right: clamp(12px, 2.5vw, 24px) !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        color: #f5f5f7 !important;
        letter-spacing: -0.2px !important;
        user-select: none !important;
        -webkit-font-smoothing: antialiased !important;
      }
      #axhub-sync-root, #axhub-sync-root * {
        box-sizing: border-box !important;
      }
      #axhub-sync-root :where(*) {
        margin: 0;
        padding: 0;
        border: 0;
      }
      #axhub-sync-root .axh-capsule {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        height: 44px !important;
        padding: 0 10px 0 18px !important;
        background: rgba(24, 24, 28, 0.86) !important;
        backdrop-filter: blur(36px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(36px) saturate(200%) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        border-radius: 9999px !important;
        box-shadow: 0 20px 48px -6px rgba(0, 0, 0, 0.65), 0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 1px 0 rgba(255, 255, 255, 0.28) !important;
        transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
        transform-origin: right bottom !important;
      }
      #axhub-sync-root .axh-capsule:hover {
        background: rgba(32, 32, 38, 0.92) !important;
        border-color: rgba(255, 255, 255, 0.28) !important;
        transform: translateY(-2px) !important;
      }
      #axhub-sync-root .axh-brand {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        font-weight: 600 !important;
        font-size: 13px !important;
        color: #ffffff !important;
        letter-spacing: -0.2px !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-brand-logo {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 24px !important;
        height: 24px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #0a84ff 0%, #0071e3 100%) !important;
        box-shadow: 0 2px 8px rgba(10, 132, 255, 0.5), inset 0 1px 0.5px rgba(255, 255, 255, 0.45) !important;
        color: #ffffff !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-brand-dot {
        width: 6px !important;
        height: 6px !important;
        border-radius: 50% !important;
        background: #30d158 !important;
        box-shadow: 0 0 8px rgba(48, 209, 88, 0.9) !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-brand-dot.connecting {
        background: #ffd60a !important;
        box-shadow: 0 0 8px rgba(255, 214, 10, 0.9) !important;
      }
      #axhub-sync-root .axh-brand-dot.offline {
        background: #ff453a !important;
        box-shadow: 0 0 8px rgba(255, 69, 58, 0.9) !important;
      }
      #axhub-sync-root .axh-divider {
        width: 1px !important;
        height: 16px !important;
        background: rgba(255, 255, 255, 0.16) !important;
        margin: 0 2px !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-project-name {
        max-width: 130px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-weight: 500 !important;
        font-size: 12.5px !important;
        color: rgba(255, 255, 255, 0.88) !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border: 0.5px solid rgba(255, 255, 255, 0.1) !important;
        padding: 4px 10px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        font-family: inherit !important;
        border: none !important;
        cursor: pointer !important;
        outline: none !important;
        transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-btn:active {
        transform: scale(0.96) !important;
      }
      #axhub-sync-root .axh-capsule .axh-btn-primary {
        height: 32px !important;
        padding: 0 18px !important;
        font-size: 12.5px !important;
        font-weight: 600 !important;
        border-radius: 9999px !important;
        background: linear-gradient(180deg, #0a84ff 0%, #0071e3 100%) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.25) !important;
        box-shadow: 0 2px 8px rgba(10, 132, 255, 0.45), inset 0 1px 0.5px rgba(255, 255, 255, 0.45) !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-capsule .axh-btn-primary:disabled,
      #axhub-sync-root .axh-capsule .axh-btn-primary.disabled {
        opacity: 0.72 !important;
        cursor: not-allowed !important;
        background: rgba(255, 255, 255, 0.12) !important;
        border-color: rgba(255, 255, 255, 0.14) !important;
        color: rgba(255, 255, 255, 0.5) !important;
        box-shadow: none !important;
        transform: none !important;
      }
      #axhub-sync-root .axh-capsule .axh-btn-primary.btn-suspended {
        background: rgba(255, 69, 58, 0.22) !important;
        border-color: rgba(255, 69, 58, 0.45) !important;
        color: #ff453a !important;
      }
      #axhub-sync-root .axh-capsule .axh-btn-primary.btn-suspended:hover {
        background: rgba(255, 69, 58, 0.28) !important;
        border-color: rgba(255, 69, 58, 0.6) !important;
      }
      #axhub-sync-root .axh-capsule .axh-btn-primary.btn-offline {
        background: rgba(255, 69, 58, 0.15) !important;
        border-color: rgba(255, 69, 58, 0.3) !important;
        color: rgba(255, 255, 255, 0.6) !important;
      }
      @keyframes axh-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      #axhub-sync-root .axh-spin {
        animation: axh-spin 1s linear infinite !important;
      }
      #axhub-sync-root .axh-btn-icon {
        width: 30px !important;
        height: 30px !important;
        padding: 0 !important;
        background: transparent !important;
        color: rgba(255, 255, 255, 0.65) !important;
        border-radius: 50% !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root .axh-btn-icon:hover {
        color: #ffffff !important;
        background: rgba(255, 255, 255, 0.12) !important;
      }
      #axhub-sync-root .axh-modal-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.68) !important;
        backdrop-filter: blur(12px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(12px) saturate(180%) !important;
        z-index: 2147483646 !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 16px !important;
      }
      #axhub-sync-root .axh-modal {
        width: 400px !important;
        max-width: calc(100vw - 32px) !important;
        max-height: calc(100vh - 48px) !important;
        overflow-y: auto !important;
        background: rgba(26, 26, 30, 0.96) !important;
        backdrop-filter: blur(48px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(48px) saturate(200%) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        border-radius: 20px !important;
        padding: 24px 22px 24px !important;
        box-shadow: 0 36px 80px -12px rgba(0, 0, 0, 0.85), 0 12px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
        box-sizing: border-box !important;
      }
      #axhub-sync-root .axh-modal-title {
        font-size: 16px !important;
        font-weight: 700 !important;
        color: #ffffff !important;
        margin-bottom: 20px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        letter-spacing: -0.3px !important;
        padding-bottom: 14px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      #axhub-sync-root .axh-modal-title .axh-btn-icon {
        width: 28px !important;
        height: 28px !important;
        border-radius: 50% !important;
        background: rgba(255, 255, 255, 0.06) !important;
        color: rgba(255, 255, 255, 0.65) !important;
      }
      #axhub-sync-root .axh-inset-group {
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 14px !important;
        overflow: hidden !important;
        margin-bottom: 22px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18), inset 0 0.5px 0 rgba(255, 255, 255, 0.08) !important;
      }
      #axhub-sync-root .axh-inset-item {
        display: flex !important;
        flex-direction: column !important;
        padding: 12px 16px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
        gap: 5px !important;
      }
      #axhub-sync-root .axh-inset-item:last-child {
        border-bottom: none !important;
      }
      #axhub-sync-root .axh-form-label {
        font-size: 11.5px !important;
        font-weight: 500 !important;
        color: #8e8e93 !important;
        letter-spacing: 0.1px !important;
        line-height: 1.2 !important;
      }
      #axhub-sync-root .axh-input {
        width: 100% !important;
        min-width: 0 !important;
        background: transparent !important;
        border: none !important;
        color: #ffffff !important;
        font-size: 13.5px !important;
        font-weight: 500 !important;
        line-height: 1.4 !important;
        padding: 2px 0 !important;
        outline: none !important;
        font-family: inherit !important;
      }
      #axhub-sync-root .axh-input::placeholder {
        color: rgba(255, 255, 255, 0.26) !important;
      }
      #axhub-sync-root .axh-input[type="password"] {
        font-size: 12px !important;
        letter-spacing: 2px !important;
        color: rgba(255, 255, 255, 0.8) !important;
      }
      #axhub-sync-root .axh-input-wrapper {
        display: flex !important;
        align-items: center !important;
        position: relative !important;
        width: 100% !important;
      }
      #axhub-sync-root .axh-input-wrapper .axh-input {
        flex: 1 !important;
        min-width: 0 !important;
        padding-right: 28px !important;
      }
      #axhub-sync-root .axh-btn-eye {
        position: absolute !important;
        right: 0 !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        background: transparent !important;
        border: none !important;
        color: rgba(255, 255, 255, 0.45) !important;
        cursor: pointer !important;
        padding: 4px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 4px !important;
        transition: all 0.2s ease !important;
      }
      #axhub-sync-root .axh-btn-eye:hover {
        color: #ffffff !important;
        background: rgba(255, 255, 255, 0.1) !important;
      }
      #axhub-sync-root .axh-modal-footer {
        display: flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        gap: 12px !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      #axhub-sync-root .axh-modal-footer .axh-btn {
        height: 38px !important;
        border-radius: 10px !important;
        font-size: 13px !important;
        letter-spacing: 0.2px !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #axhub-sync-root .axh-modal-footer .axh-btn-subtle {
        padding: 0 20px !important;
        font-weight: 500 !important;
        background: rgba(255, 255, 255, 0.1) !important;
        color: #f5f5f7 !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
      }
      #axhub-sync-root .axh-modal-footer .axh-btn-primary {
        padding: 0 24px !important;
        font-weight: 600 !important;
        background: linear-gradient(180deg, #0a84ff 0%, #0071e3 100%) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
        box-shadow: 0 2px 8px rgba(10, 132, 255, 0.45) !important;
      }

      /* Progress Panel */
      #axhub-sync-root .axh-progress-panel {
        display: none;
        position: absolute !important;
        bottom: 56px !important;
        right: 0 !important;
        width: 320px !important;
        max-width: calc(100vw - 32px) !important;
        background: rgba(24, 24, 28, 0.92) !important;
        backdrop-filter: blur(40px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        border-radius: 18px !important;
        padding: 16px 18px !important;
        box-shadow: 0 24px 56px -8px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.25) !important;
        box-sizing: border-box !important;
      }
      #axhub-sync-root .axh-progress-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 12px !important;
      }
      #axhub-sync-root .axh-progress-title {
        font-weight: 600 !important;
        color: #ffffff !important;
        font-size: 13px !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }
      #axhub-sync-root .axh-progress-percent {
        font-weight: 700 !important;
        font-size: 13px !important;
        color: #0a84ff !important;
      }
      #axhub-sync-root .axh-bar-bg {
        width: 100% !important;
        height: 5px !important;
        background: rgba(255, 255, 255, 0.12) !important;
        border-radius: 9999px !important;
        overflow: hidden !important;
        margin-bottom: 9px !important;
      }
      #axhub-sync-root .axh-bar-fill {
        height: 100% !important;
        width: 0% !important;
        background: linear-gradient(90deg, #0a84ff, #5e5ce6, #30d158) !important;
        border-radius: 9999px !important;
        transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      #axhub-sync-root .axh-status-text {
        font-size: 11.5px !important;
        color: #8e8e93 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      /* Success Card */
      #axhub-sync-root .axh-success-card {
        display: none;
        position: absolute !important;
        bottom: 56px !important;
        right: 0 !important;
        width: 360px !important;
        max-width: calc(100vw - 32px) !important;
        background: rgba(24, 24, 28, 0.94) !important;
        backdrop-filter: blur(40px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        border-radius: 18px !important;
        padding: 16px 18px 16px !important;
        box-shadow: 0 24px 56px -8px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.28) !important;
        box-sizing: border-box !important;
      }
      #axhub-sync-root .axh-success-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        margin-bottom: 12px !important;
      }
      #axhub-sync-root .axh-success-title {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        font-size: 13.5px !important;
        letter-spacing: -0.2px !important;
      }
      #axhub-sync-root .axh-success-icon {
        width: 22px !important;
        height: 22px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #30d158 0%, #248a3d 100%) !important;
        box-shadow: 0 2px 8px rgba(48, 209, 88, 0.45), inset 0 1px 0.5px rgba(255, 255, 255, 0.45) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #ffffff !important;
        flex-shrink: 0 !important;
      }
      #axhub-sync-root #axh-btn-close-success {
        width: 24px !important;
        height: 24px !important;
        border-radius: 50% !important;
        background: rgba(255, 255, 255, 0.08) !important;
        color: rgba(255, 255, 255, 0.65) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s ease !important;
        padding: 0 !important;
        border: none !important;
        cursor: pointer !important;
      }
      #axhub-sync-root #axh-btn-close-success:hover {
        background: rgba(255, 255, 255, 0.16) !important;
        color: #ffffff !important;
      }
      #axhub-sync-root .axh-url-box {
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 10px !important;
        padding: 9px 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Mono", Menlo, monospace !important;
        font-size: 11.5px !important;
        color: #64d2ff !important;
        word-break: break-all !important;
        margin-bottom: 12px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        box-sizing: border-box !important;
        line-height: 1.4 !important;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
      }
      #axhub-sync-root .axh-url-box:hover {
        background: rgba(10, 132, 255, 0.1) !important;
        border-color: rgba(10, 132, 255, 0.35) !important;
        color: #ffffff !important;
      }
      #axhub-sync-root .axh-success-actions {
        display: flex !important;
        gap: 10px !important;
        align-items: center !important;
      }
      #axhub-sync-root .axh-success-actions .axh-btn {
        flex: 1 !important;
        height: 34px !important;
        border-radius: 10px !important;
        font-size: 12.5px !important;
        letter-spacing: 0.1px !important;
        box-sizing: border-box !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #axhub-sync-root .axh-success-actions .axh-btn-primary {
        padding: 0 16px !important;
        font-weight: 600 !important;
        background: linear-gradient(180deg, #0a84ff 0%, #0071e3 100%) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.25) !important;
        box-shadow: 0 2px 8px rgba(10, 132, 255, 0.45), inset 0 1px 0.5px rgba(255, 255, 255, 0.4) !important;
      }
      #axhub-sync-root .axh-success-actions .axh-btn-primary:hover {
        background: linear-gradient(180deg, #1a8cff 0%, #0077ed 100%) !important;
        box-shadow: 0 4px 14px rgba(10, 132, 255, 0.6) !important;
      }
      #axhub-sync-root .axh-success-actions .axh-btn-subtle {
        padding: 0 16px !important;
        font-weight: 500 !important;
        background: rgba(255, 255, 255, 0.1) !important;
        color: #f5f5f7 !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
      }
      #axhub-sync-root .axh-success-actions .axh-btn-subtle:hover {
        background: rgba(255, 255, 255, 0.16) !important;
        border-color: rgba(255, 255, 255, 0.24) !important;
      }

      /* Mini Trigger & Collapsed */
      #axhub-sync-root .axh-mini-trigger {
        display: none;
        width: 42px !important;
        height: 42px !important;
        border-radius: 50% !important;
        background: rgba(24, 24, 28, 0.88) !important;
        backdrop-filter: blur(24px) saturate(190%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(190%) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), inset 0 0.5px 0.5px 0 rgba(255, 255, 255, 0.3) !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        color: #0a84ff !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      #axhub-sync-root .axh-mini-trigger:hover {
        transform: scale(1.08) !important;
        background: rgba(36, 36, 42, 0.94) !important;
        color: #ffffff !important;
      }
      #axhub-sync-root.collapsed .axh-capsule {
        display: none !important;
      }
      #axhub-sync-root.collapsed .axh-mini-trigger {
        display: flex !important;
      }

      /* Toast */
      #axhub-sync-root .axh-toast {
        position: fixed !important;
        top: 24px !important;
        left: 50% !important;
        transform: translateX(-50%) translateY(-20px) !important;
        background: rgba(20, 20, 24, 0.94) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        padding: 10px 20px !important;
        border-radius: 9999px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
        z-index: 2147483647 !important;
      }
      #axhub-sync-root .axh-toast.show {
        opacity: 1 !important;
        transform: translateX(-50%) translateY(0) !important;
        pointer-events: auto !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function showToast(msg, duration = 3000) {
    const toast = document.getElementById('axh-toast');
    const msgEl = document.getElementById('axh-toast-msg');
    if (!toast || !msgEl) return;
    msgEl.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  async function validateTokenRemote(serverUrl, token) {
    const cleanUrl = (serverUrl || DEFAULT_CONFIG.serverUrl).replace(/\/+$/, '');
    if (!token) {
      return { ok: false, reason: 'missing_token', message: '未填写授权凭证 (Token)' };
    }

    const parseResponse = (status, text) => {
      if (status === 401) {
        let msg = 'Token 未在后台注册或已被禁用';
        try {
          const d = JSON.parse(text);
          if (d && d.detail) msg = d.detail;
        } catch (e) {}
        const isSuspended = msg.includes('禁用') || msg.includes('disabled');
        return {
          ok: false,
          reason: isSuspended ? 'suspended' : 'unauthorized',
          message: msg
        };
      }
      if (status >= 200 && status < 300) {
        let data = {};
        try { data = JSON.parse(text); } catch (e) {}
        return { ok: true, name: data.name || '已授权密钥', requireAuth: data.require_auth };
      }
      return { ok: false, reason: 'error', message: `服务器返回状态码: ${status}` };
    };

    // 1. First attempt: Direct fetch
    try {
      const resp = await fetch(`${cleanUrl}/api/tokens/verify`, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const text = await resp.text();
      return parseResponse(resp.status, text);
    } catch (directErr) {
      // 2. Second attempt: Background proxy fetch fallback
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const bgRes = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              type: 'proxy_fetch',
              url: `${cleanUrl}/api/tokens/verify`,
              options: {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
              }
            }, (res) => {
              if (chrome.runtime.lastError || !res) {
                resolve(null);
              } else {
                resolve(res);
              }
            });
          });

          if (bgRes) {
            return parseResponse(bgRes.status, bgRes.data);
          }
        } catch (bgErr) {
          console.warn('[AxHub Sync] Proxy fetch fallback error:', bgErr);
        }
      }

      return { ok: false, reason: 'offline', message: '无法连接到云端服务器: ' + cleanUrl };
    }
  }

  function updateCapsuleState(state, info = {}) {
    serverAuthState = Object.assign({ status: state }, info);

    const dot = document.getElementById('axh-status-dot');
    const btnSync = document.getElementById('axh-btn-sync');
    if (!dot || !btnSync) return;

    dot.className = 'axh-brand-dot';
    btnSync.className = 'axh-btn axh-btn-primary';

    const defaultSyncIcon = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>`;

    const lockIcon = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>`;

    const warningIcon = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>`;

    if (state === 'checking') {
      dot.classList.add('connecting');
      dot.title = '正在校验云端凭证状态...';
      if (!isSyncing) {
        btnSync.innerHTML = `${defaultSyncIcon}<span>检查状态...</span>`;
      }
    } else if (state === 'authorized') {
      dot.title = `私有云服务连接正常 · 凭证校验通过 [${info.name || '已授权'}]`;
      if (!isSyncing) {
        btnSync.innerHTML = `${defaultSyncIcon}<span>同步到云端</span>`;
        btnSync.title = '点击一键抓取并同步至私有云';
      }
    } else if (state === 'suspended') {
      dot.classList.add('offline');
      dot.title = `🚫 密钥已被后台禁用：${info.message || '请在后台启用后方可同步'}`;
      if (!isSyncing) {
        btnSync.classList.add('disabled', 'btn-suspended');
        btnSync.innerHTML = `${lockIcon}<span>密钥已禁用</span>`;
        btnSync.title = `🚫 密钥已在后台被禁用：${info.message || ''} (点击打开设置)`;
      }
    } else if (state === 'unauthorized') {
      dot.classList.add('offline');
      dot.title = '❌ 授权凭证无效：未在后台注册或已被删除';
      if (!isSyncing) {
        btnSync.classList.add('disabled', 'btn-offline');
        btnSync.innerHTML = `${warningIcon}<span>Token无效</span>`;
        btnSync.title = '❌ 授权凭证无效，点击设置有效 Token';
      }
    } else if (state === 'missing_token') {
      dot.classList.add('connecting');
      dot.title = '⚠️ 未配置授权凭证 (Token)';
      if (!isSyncing) {
        btnSync.classList.add('disabled');
        btnSync.innerHTML = `${warningIcon}<span>未配Token</span>`;
        btnSync.title = '⚠️ 未配置授权凭证，点击设置 Token';
      }
    } else {
      dot.classList.add('offline');
      dot.title = `无法连接到私有云服务器 (${currentConfig.serverUrl})`;
      if (!isSyncing) {
        btnSync.classList.add('disabled', 'btn-offline');
        btnSync.innerHTML = `${warningIcon}<span>服务离线</span>`;
        btnSync.title = '🔴 无法连接云端服务器，请检查网络或地址';
      }
    }
  }

  function loadConfiguration() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['axh_config'], (res) => {
        if (res && res.axh_config) {
          currentConfig = Object.assign({}, DEFAULT_CONFIG, res.axh_config);
        }
        checkServerHealth();
      });
    } else {
      checkServerHealth();
    }
  }

  async function checkServerHealth() {
    updateCapsuleState('checking');

    const baseUrl = currentConfig.serverUrl.replace(/\/+$/, '');
    if (!currentConfig.token) {
      updateCapsuleState('missing_token', { message: '未配置授权凭证 (Token)' });
      return;
    }

    const res = await validateTokenRemote(baseUrl, currentConfig.token);
    if (res.ok) {
      updateCapsuleState('authorized', res);
    } else {
      updateCapsuleState(res.reason, res);
    }
  }

  function bindEvents() {
    const root = document.getElementById('axhub-sync-root');
    const btnSync = document.getElementById('axh-btn-sync');
    const btnCollapse = document.getElementById('axh-btn-collapse');
    const btnExpand = document.getElementById('axh-btn-expand');
    const btnSettings = document.getElementById('axh-btn-settings');
    const projectDisplay = document.getElementById('axh-project-display');

    const modalOverlay = document.getElementById('axh-modal-overlay');
    const btnCloseModal = document.getElementById('axh-btn-close-modal');
    const btnSaveCfg = document.getElementById('axh-btn-save-cfg');
    const btnTestConn = document.getElementById('axh-btn-test-conn');
    const btnToggleToken = document.getElementById('axh-btn-toggle-token');

    const cfgServer = document.getElementById('axh-cfg-server');
    const cfgToken = document.getElementById('axh-cfg-token');
    const cfgProject = document.getElementById('axh-cfg-project');
    const cfgDomain = document.getElementById('axh-cfg-domain');

    if (btnToggleToken && cfgToken) {
      btnToggleToken.onclick = () => {
        const isPass = cfgToken.type === 'password';
        cfgToken.type = isPass ? 'text' : 'password';
        const eyeOpen = btnToggleToken.querySelector('.axh-eye-open');
        const eyeClosed = btnToggleToken.querySelector('.axh-eye-closed');
        if (eyeOpen && eyeClosed) {
          eyeOpen.style.display = isPass ? 'none' : 'block';
          eyeClosed.style.display = isPass ? 'block' : 'none';
        }
      };
    }

    const btnCloseSuccess = document.getElementById('axh-btn-close-success');
    const btnCopyAgain = document.getElementById('axh-btn-copy-again');
    const btnOpenUrl = document.getElementById('axh-btn-open-url');
    const successUrlEl = document.getElementById('axh-success-url');

    btnCollapse.onclick = () => {
      root.classList.add('collapsed');
      currentConfig.collapsed = true;
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ axh_config: currentConfig });
      }
    };

    btnExpand.onclick = () => {
      root.classList.remove('collapsed');
      currentConfig.collapsed = false;
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ axh_config: currentConfig });
      }
    };

    const openSettings = () => {
      cfgServer.value = currentConfig.serverUrl;
      cfgToken.value = currentConfig.token;
      cfgProject.value = projectName;
      cfgDomain.value = currentConfig.customDomain || '';
      modalOverlay.style.display = 'flex';
    };

    btnSettings.onclick = openSettings;
    projectDisplay.onclick = openSettings;

    btnCloseModal.onclick = () => { modalOverlay.style.display = 'none'; };
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) modalOverlay.style.display = 'none'; };

    btnSaveCfg.onclick = async () => {
      const srv = cfgServer.value.trim().replace(/\/+$/, '') || DEFAULT_CONFIG.serverUrl;
      const tok = cfgToken.value.trim();

      if (!tok) {
        showToast('⚠️ 授权凭证 (Token) 不能为空！');
        return;
      }

      btnSaveCfg.disabled = true;
      btnSaveCfg.innerText = '正在校验...';

      try {
        const verifyRes = await fetch(`${srv}/api/tokens/verify`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tok}` }
        });
        if (verifyRes.status === 401) {
          btnSaveCfg.disabled = false;
          btnSaveCfg.innerText = '保存配置';
          showToast('❌ 保存失败：Token 未通过后台校验！必须是后台有效密钥');
          return;
        }
      } catch (e) {
        console.warn('Verify error:', e);
      }

      btnSaveCfg.disabled = false;
      btnSaveCfg.innerText = '保存配置';

      currentConfig.serverUrl = srv;
      currentConfig.token = tok;
      currentConfig.customDomain = cfgDomain.value.trim().replace(/\/+$/, '');

      const newProj = cfgProject.value.trim();
      if (newProj && newProj !== projectName) {
        projectName = newProj;
        projectDisplay.innerText = projectName;
      }

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ axh_config: currentConfig });
      }

      modalOverlay.style.display = 'none';
      showToast('✅ 配置已保存并通过后台鉴权！');
      checkServerHealth();
    };

    btnTestConn.onclick = () => {
      const srv = (cfgServer.value.trim() || currentConfig.serverUrl).replace(/\/+$/, '');
      const tok = cfgToken.value.trim();

      if (!tok) {
        showToast('⚠️ 请先填写授权凭证 (Token)');
        return;
      }

      btnTestConn.disabled = true;
      btnTestConn.innerText = '正在校验...';
      const start = Date.now();

      fetch(`${srv}/api/tokens/verify`, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Authorization': `Bearer ${tok}` }
      })
        .then(res => {
          btnTestConn.disabled = false;
          btnTestConn.innerText = '测试连通性';
          if (res.status === 401) {
            showToast('❌ 校验失败：Token 无效或已被停用！');
            return;
          }
          if (res.ok) {
            return res.json().then(data => {
              const ms = Date.now() - start;
              showToast(`🟢 校验通过！[${data.name || '已授权'}] 延时 ${ms}ms`);
            });
          }
          showToast(`⚠️ 响应异常状态码: ${res.status}`);
        })
        .catch(() => {
          btnTestConn.disabled = false;
          btnTestConn.innerText = '测试连通性';
          showToast('🔴 无法连接服务器，请检查网络或地址');
        });
    };

    btnCloseSuccess.onclick = () => {
      document.getElementById('axh-success-card').style.display = 'none';
    };

    btnCopyAgain.onclick = () => {
      const url = successUrlEl.innerText;
      navigator.clipboard.writeText(url).then(() => showToast('📋 网址已重新复制到剪贴板！'));
    };

    successUrlEl.onclick = () => {
      const url = successUrlEl.innerText;
      navigator.clipboard.writeText(url).then(() => showToast('📋 网址已复制！'));
    };

    btnOpenUrl.onclick = () => {
      window.open(successUrlEl.innerText, '_blank');
    };

    btnSync.onclick = (e) => {
      if (isSyncing) return;

      // 物理硬拦截：若处于非授权状态（禁用、未配置、离线等），坚决阻断任何 AST 解析与抓取
      if (serverAuthState.status !== 'authorized') {
        e.preventDefault();
        e.stopPropagation();

        let alertMsg = '❌ 无法同步：未通过云端鉴权！';
        if (serverAuthState.status === 'suspended') {
          alertMsg = `🚫 密钥已在后台被禁用！\n\n${serverAuthState.message || '请在后台启用该密钥或更换可用密钥'}`;
        } else if (serverAuthState.status === 'unauthorized') {
          alertMsg = '❌ 授权凭证 (Token) 无效，未在后台注册！';
        } else if (serverAuthState.status === 'missing_token') {
          alertMsg = '⚠️ 请先配置授权凭证 (Token)！';
        } else if (serverAuthState.status === 'offline') {
          alertMsg = '🔴 私有云服务处于离线状态，无法连接！';
        } else if (serverAuthState.status === 'checking') {
          alertMsg = '⏳ 正在校验云端状态，请稍候...';
        }

        showToast(alertMsg.replace(/\n+/g, ' '), 4500);
        openSettings();
        return;
      }

      startFullSync();
    };

    // 实时联动：当扩展 Popup 中配置变动或后台 Token 状态修改后，页面自动更新胶囊状态
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.axh_config) {
          currentConfig = Object.assign({}, DEFAULT_CONFIG, changes.axh_config.newValue || {});
          checkServerHealth();
        }
      });
    }

    // 焦点恢复自动感知：用户切到后台管理页面改了 Token 状态再切回原型页时，自动重新探针校验
    window.addEventListener('focus', () => {
      if (!isSyncing) {
        checkServerHealth();
      }
    });
  }

  function updateProgress(percent, statusText) {
    const progressPanel = document.getElementById('axh-progress-panel');
    const progressBar = document.getElementById('axh-progress-bar');
    const progressVal = document.getElementById('axh-progress-val');
    const progressStatus = document.getElementById('axh-progress-status');

    if (!progressPanel) return;
    progressPanel.style.display = 'block';

    const p = Math.min(100, Math.max(0, Math.round(percent)));
    progressBar.style.width = p + '%';
    progressVal.innerText = p + '%';
    if (statusText) progressStatus.innerText = statusText;
  }

  function hideProgress() {
    const progressPanel = document.getElementById('axh-progress-panel');
    if (progressPanel) progressPanel.style.display = 'none';
  }

  // ========================================================
  // Robust Axure Document Parser (Supports Minified & Full AST)
  // ========================================================

  function parsePagesFromDocText(docText) {
    let docData = null;
    try {
      // Axure document.js defines $axure.document or calls $axure.loadDocument(...)
      const fn = new Function('$axure', docText + '; return (typeof $axure.document === "function" ? $axure.document() : $axure.document) || null;');
      const $axureMock = {
        loadDocument: function(doc) {
          docData = doc;
          return doc;
        }
      };
      const ret = fn($axureMock);
      if (ret) docData = ret;
    } catch (e) {
      console.warn('[AxHub Sync] Sandbox eval of document.js:', e);
    }

    // Fallback: If page has window.$axure.document
    if (!docData && window.$axure && window.$axure.document) {
      docData = typeof window.$axure.document === 'function' ? window.$axure.document() : window.$axure.document;
    }

    const pages = [];
    function traverse(nodes) {
      if (!nodes || !Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.url && typeof node.url === 'string' && node.url.endsWith('.html')) {
          pages.push({
            pageName: node.pageName || node.url.replace(/\.html$/i, ''),
            url: node.url
          });
        }
        if (node.children && Array.isArray(node.children)) {
          traverse(node.children);
        }
      }
    }

    if (docData && docData.sitemap && docData.sitemap.rootNodes) {
      traverse(docData.sitemap.rootNodes);
    }

    // Secondary fallback: regex scan for .html filenames in the text
    if (pages.length === 0) {
      const regexMatches = docText.matchAll(/["']([^"']+\.html)["']/gi);
      for (const m of regexMatches) {
        const u = m[1];
        if (!pages.some(p => p.url === u) && !u.includes('/') && u !== 'start.html' && u !== 'start_c_1.html') {
          pages.push({ pageName: u.replace(/\.html$/i, ''), url: u });
        }
      }
    }

    return pages;
  }

  // ========================================================
  // Concurrency Pool Runner
  // ========================================================
  async function runConcurrencyPool(items, limit, workerFn) {
    let index = 0;
    const results = [];
    const executing = [];

    for (const item of items) {
      const p = Promise.resolve().then(() => workerFn(item, index++));
      results.push(p);

      if (limit <= items.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.all(results);
  }

  // ========================================================
  // Main Full Sync Routine
  // ========================================================

  async function startFullSync() {
    const btnSync = document.getElementById('axh-btn-sync');
    const successCard = document.getElementById('axh-success-card');
    if (successCard) successCard.style.display = 'none';

    // 1. 双重守门：UI 层非 authorized 直接拒止
    if (serverAuthState.status !== 'authorized') {
      showToast('🚫 鉴权拦截：密钥未通过后台校验，无法同步！', 4000);
      const modalOverlay = document.getElementById('axh-modal-overlay');
      if (modalOverlay) {
        document.getElementById('axh-cfg-server').value = currentConfig.serverUrl;
        document.getElementById('axh-cfg-token').value = currentConfig.token;
        document.getElementById('axh-cfg-project').value = projectName;
        document.getElementById('axh-cfg-domain').value = currentConfig.customDomain || '';
        modalOverlay.style.display = 'flex';
      }
      return;
    }

    isSyncing = true;
    btnSync.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="axh-spin">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>预检中...</span>
    `;

    try {
      updateProgress(1, '正在进行云端实时鉴权预检...');

      // 2. 强断言实时鉴权：在解析页面树前，发起权威鉴权调用（带 background proxy 兜底，防止本地跨域逃逸）
      const srv = currentConfig.serverUrl.replace(/\/+$/, '');
      const tok = currentConfig.token;

      const checkRes = await validateTokenRemote(srv, tok);
      if (!checkRes.ok) {
        hideProgress();
        isSyncing = false;
        updateCapsuleState(checkRes.reason, checkRes);

        const failToast = checkRes.reason === 'suspended'
          ? `🚫 鉴权阻断：密钥已在后台被禁用 (${checkRes.message || '请在后台启用后同步'})`
          : `❌ 鉴权失败：${checkRes.message || 'Token 未通过后台校验'}`;
        showToast(failToast, 5000);

        const modalOverlay = document.getElementById('axh-modal-overlay');
        if (modalOverlay) {
          document.getElementById('axh-cfg-server').value = currentConfig.serverUrl;
          document.getElementById('axh-cfg-token').value = currentConfig.token;
          document.getElementById('axh-cfg-project').value = projectName;
          document.getElementById('axh-cfg-domain').value = currentConfig.customDomain || '';
          modalOverlay.style.display = 'flex';
        }
        return; // 物理彻底拦截！绝不抓取任何页面，绝不打包任何文件！
      }

      // 鉴权彻底通过，进入实际抓取与打包流程
      btnSync.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="axh-spin">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
        </svg>
        <span>抓取中...</span>
      `;

      updateProgress(3, '正在分析 Axure 页面树与结构...');

      const currentUrl = window.location.href;
      const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);

      // 1. Fetch data/document.js
      const docJsUrl = baseUrl + 'data/document.js';
      let docText = '';
      try {
        const resp = await fetch(docJsUrl, { cache: 'no-store' });
        if (resp.ok) docText = await resp.text();
      } catch (e) {
        console.warn('[AxHub Sync] Fetch data/document.js error:', e);
      }

      // 2. Parse all pages from document.js AST
      const pageList = parsePagesFromDocText(docText);
      console.log(`[AxHub Sync] Found ${pageList.length} pages in prototype:`, pageList.slice(0, 10));

      updateProgress(8, `已解析出 ${pageList.length} 个原型页面，正在提取全局资源...`);

      // 3. Collect Shell & Global Axure Standard Runtime
      const AXURE_STANDARD_RUNTIME = [
        'resources/css/axure_rp_page.css',
        'resources/css/reset.css',
        'resources/css/default.css',
        'resources/css/previewfonts.css',
        'resources/images/favicon_play.ico',
        'resources/images/divider.svg',
        'resources/scripts/jquery-3.2.1.min.js',
        'resources/scripts/jquery-1.7.1.min.js',
        'resources/scripts/axutils.js',
        'resources/scripts/messagecenter.js',
        'resources/scripts/player/axplayer.js',
        'resources/scripts/player/init.js',
        'resources/scripts/axure/axQuery.js',
        'resources/scripts/axure/globals.js',
        'resources/scripts/axure/annotation.js',
        'resources/scripts/axure/axQuery.std.js',
        'resources/scripts/axure/doc.js',
        'resources/scripts/axure/events.js',
        'resources/scripts/axure/recording.js',
        'resources/scripts/axure/action.js',
        'resources/scripts/axure/expr.js',
        'resources/scripts/axure/geometry.js',
        'resources/scripts/axure/flyout.js',
        'resources/scripts/axure/model.js',
        'resources/scripts/axure/repeater.js',
        'resources/scripts/axure/sto.js',
        'resources/scripts/axure/utils.temp.js',
        'resources/scripts/axure/variables.js',
        'resources/scripts/axure/drag.js',
        'resources/scripts/axure/move.js',
        'resources/scripts/axure/visibility.js',
        'resources/scripts/axure/style.js',
        'resources/scripts/axure/adaptive.js',
        'resources/scripts/axure/tree.js',
        'resources/scripts/axure/init.temp.js',
        'resources/scripts/axure/legacy.js',
        'resources/scripts/axure/viewer.js',
        'resources/scripts/axure/math.js',
        'resources/scripts/axure/ios.js',
        'resources/scripts/axure/jquery.nicescroll.min.js',
        'plugins/sitemap/sitemap.js',
        'plugins/sitemap/styles/sitemap.css',
        'plugins/sitemap/styles/images/right_arrow.svg',
        'plugins/sitemap/styles/images/left_arrow.svg',
        'plugins/sitemap/styles/images/folder_closed_blue.svg',
        'plugins/sitemap/styles/images/folder_open_blue.svg',
        'plugins/sitemap/styles/images/page_lt_grey.svg',
        'plugins/sitemap/styles/images/open_item.svg',
        'plugins/sitemap/styles/images/forward_keys.svg',
        'plugins/sitemap/styles/images/back_keys.svg',
        'plugins/sitemap/styles/images/sitemap_panel_on.svg',
        'plugins/sitemap/styles/images/sitemap_panel_off.svg',
        'plugins/page_notes/page_notes.js',
        'plugins/page_notes/styles/page_notes.css',
        'plugins/page_notes/styles/images/notes_panel_on.svg',
        'plugins/page_notes/styles/images/notes_panel_off.svg',
        'plugins/debug/debug.js',
        'plugins/debug/styles/debug.css',
        'plugins/debug/styles/images/console_panel_on.svg',
        'plugins/debug/styles/images/console_panel_off.svg'
      ];

      const coreFiles = new Set(AXURE_STANDARD_RUNTIME);
      coreFiles.add('start.html');
      coreFiles.add('data/document.js');
      coreFiles.add('data/styles.css');

      // Scripts in start.html head/body
      document.querySelectorAll('script[src]').forEach(el => {
        const src = el.getAttribute('src');
        if (src && !src.startsWith('http:') && !src.startsWith('https:') && !src.startsWith('//')) {
          coreFiles.add(src.replace(/^\.\//, ''));
        }
      });

      // Stylesheets in start.html
      document.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
        const href = el.getAttribute('href');
        if (href && !href.startsWith('http:') && !href.startsWith('https:') && !href.startsWith('//')) {
          coreFiles.add(href.replace(/^\.\//, ''));
        }
      });

      // 4. Build Full File List (Including all pages and their files/ dirs)
      const allTargetFiles = new Set(coreFiles);

      for (const p of pageList) {
        allTargetFiles.add(p.url);
        const baseName = p.url.replace(/\.html$/i, '');
        allTargetFiles.add(`files/${baseName}/data.js`);
        allTargetFiles.add(`files/${baseName}/styles.css`);
      }

      const fileListArray = Array.from(allTargetFiles);
      const totalCount = fileListArray.length;
      console.log(`[AxHub Sync] Total items to package: ${totalCount}`);

      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip 模块未加载，请确保 lib/jszip.min.js 存在');
      }
      const zip = new JSZip();

      // Track extra dynamically found images and dependencies
      const discoveredImages = new Set();

      // 5. Batch Concurrent Fetch & Bundle (Concurrency = 25 for local high speed)
      let completed = 0;
      updateProgress(15, `正在高速抓取 ${totalCount} 项原型数据...`);

      await runConcurrencyPool(fileListArray, 25, async (relPath) => {
        try {
          // Properly encode URI for Chinese filenames, parentheses, and spaces
          const fetchUrl = baseUrl + encodeURI(relPath);
          const resp = await fetch(fetchUrl, { cache: 'no-store' });

          if (resp.ok) {
            const isBinary = /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/i.test(relPath);
            if (isBinary) {
              const blob = await resp.blob();
              zip.file(relPath, blob);
            } else {
              const text = await resp.text();
              zip.file(relPath, text);

              // If it's a data.js or page html, scan for image and resource URLs
              if (relPath.endsWith('.js') || relPath.endsWith('.html')) {
                const imgMatches = text.matchAll(/images\/[^\'\"\s\)\,\;]+\.(?:png|jpg|jpeg|gif|svg|webp|ico)/gi);
                for (const im of imgMatches) {
                  const imgPath = im[0].replace(/^\.\.\//, '').replace(/^\.\//, '');
                  if (!allTargetFiles.has(imgPath)) {
                    discoveredImages.add(imgPath);
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore missing optional files
        } finally {
          completed++;
          if (completed % 10 === 0 || completed === totalCount) {
            const pct = 15 + Math.round((completed / totalCount) * 60); // 15% -> 75%
            updateProgress(pct, `抓取中 (${completed}/${totalCount}): ${relPath}`);
          }
        }
      });

      // 6. Download Discovered Images
      if (discoveredImages.size > 0) {
        const imgArray = Array.from(discoveredImages);
        console.log(`[AxHub Sync] Downloading ${imgArray.size || imgArray.length} discovered images...`);
        let imgDone = 0;
        await runConcurrencyPool(imgArray, 20, async (imgPath) => {
          try {
            const fetchUrl = baseUrl + encodeURI(imgPath);
            const resp = await fetch(fetchUrl, { cache: 'no-store' });
            if (resp.ok) {
              const blob = await resp.blob();
              zip.file(imgPath, blob);
            }
          } catch (e) {}
          finally {
            imgDone++;
          }
        });
      }

      // 7. Generate ZIP Compression
      updateProgress(78, '正在压缩原型数据包...');
      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } },
        (meta) => {
          const pct = 78 + Math.round(meta.percent * 0.10); // 78% -> 88%
          updateProgress(pct, `压缩数据中: ${Math.round(meta.percent)}%`);
        }
      );

      const sizeKb = (zipBlob.size / 1024).toFixed(1);
      const sizeMb = (zipBlob.size / (1024 * 1024)).toFixed(2);
      const displaySize = zipBlob.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

      // 8. Upload to Cloud Receiver
      updateProgress(88, `正在同步至云端 (${displaySize})...`);

      const uploadUrl = currentConfig.serverUrl.replace(/\/+$/, '') + '/api/upload';
      const formData = new FormData();
      formData.append('file', zipBlob, `${projectName}.zip`);
      formData.append('project', projectName);

      const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        if (currentConfig.token) {
          xhr.setRequestHeader('Authorization', `Bearer ${currentConfig.token}`);
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = 88 + Math.round((e.loaded / e.total) * 11);
            const loadedMb = (e.loaded / (1024 * 1024)).toFixed(2);
            const totalMb = (e.total / (1024 * 1024)).toFixed(2);
            updateProgress(pct, `上传中: ${loadedMb} MB / ${totalMb} MB`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (err) {
              resolve({ code: 0, message: 'Upload OK' });
            }
          } else {
            reject(new Error(`服务器响应 HTTP ${xhr.status}: ${xhr.responseText || 'Server Error'}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error(`无法连通服务器: ${uploadUrl}`));
        };

        xhr.send(formData);
      });

      // 9. Success Routine
      updateProgress(100, `同步成功！共传输 ${completed} 个文件`);
      setTimeout(hideProgress, 800);

      const hostPrefix = currentConfig.customDomain || currentConfig.serverUrl.replace(/\/+$/, '');
      const finalUrl = `${hostPrefix}/p/${encodeURIComponent(projectName)}/start.html#g=1`;

      if (currentConfig.autoCopy) {
        navigator.clipboard.writeText(finalUrl).then(() => {
          showToast('🚀 同步完成！全量页面与切图已推送，链接已复制！');
        }).catch(() => {
          showToast('🚀 同步完成！');
        });
      } else {
        showToast('🚀 同步完成！');
      }

      playSuccessChime();

      const successUrlEl = document.getElementById('axh-success-url');
      successUrlEl.innerText = finalUrl;
      successCard.style.display = 'block';

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['axh_history'], (res) => {
          const history = res.axh_history || [];
          const entry = {
            project: projectName,
            url: finalUrl,
            time: new Date().toLocaleString(),
            size: displaySize
          };
          const updated = [entry, ...history.filter(h => h.project !== projectName)].slice(0, 20);
          chrome.storage.local.set({ axh_history: updated });
        });
      }

    } catch (err) {
      console.error('[AxureHub Sync] Sync failed:', err);
      hideProgress();
      showToast(`❌ 同步失败: ${err.message || err}`, 5000);
      alert(`[AxureHub Sync 同步失败]\n\n${err.message || err}\n\n请检查：\n1. 云端服务器是否已启动 (${currentConfig.serverUrl})\n2. 访问密钥 Token 是否匹配`);
    } finally {
      isSyncing = false;
      updateCapsuleState(serverAuthState.status, serverAuthState);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
