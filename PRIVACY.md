# AxureHub Sync - Privacy Policy (隐私政策)

**Last Updated: September 24, 2026**

AxureHub Sync ("the Extension", "we", "our") is an open-source browser extension designed to help designers and product managers synchronize Axure RP prototype files to their self-hosted AxureHub servers. We respect your privacy and are committed to protecting it.

---

### 1. Data Collection & Usage (数据收集与使用)

- **Zero Personal Data Collection**: The Extension does **NOT** collect, track, store, or sell any personally identifiable information (PII), browser history, cookies, keystrokes, or user behavior analytics.
- **Local Storage Only**: All user configuration parameters (including your self-hosted server URL, API token, custom domain preference, and UI state) are stored strictly inside your local browser via `chrome.storage.local`. This data never leaves your device except when communicating with your specified server endpoint.
- **Prototype Asset Transmission**: When you click "Sync to Cloud" (一键同步至云端), the Extension bundles the static assets of the currently active Axure RP prototype and transmits them **exclusively** to the self-hosted server endpoint you configured. We operate no intermediate relay servers.

---

### 2. Permissions Justification (权限使用合规说明)

The Extension requests only the minimum permissions necessary to deliver its core functionality:

| Permission | Purpose & Justification |
| :--- | :--- |
| `storage` | Storing your local configuration (self-hosted server address, authentication token, and auto-copy preferences). |
| `activeTab` & `scripting` | Detecting Axure RP local preview pages (`127.0.0.1:32767`, `start.html`) to inject the floating sync capsule and bundle prototype assets. |
| `clipboardWrite` | Automatically copying the generated prototype preview URL to your clipboard after a successful sync, or when clicking "Copy Link". |
| `<all_urls>` (Host Permission) | Enabling HTTP/HTTPS network requests to whatever self-hosted server domain or IP address you explicitly configure. |

---

### 3. Third-Party Services & Analytics (第三方服务与分析)

- The Extension contains **NO** third-party advertising SDKs, tracking pixels, telemetry scripts, or analytics services (such as Google Analytics or Mixpanel).
- All communication is direct point-to-point between your browser and your designated AxureHub server instance.

---

### 4. Open Source & Auditability (开源透明与审计)

AxureHub Sync is 100% open source under the MIT License. Anyone can inspect and audit the complete source code at:
[https://github.com/saulgoodgirl/AxureHub](https://github.com/saulgoodgirl/AxureHub)

---

### 5. Contact & Support (联系与支持)

If you have questions, feedback, or security inquiries regarding this Privacy Policy, please open an issue on our official GitHub repository:
[https://github.com/saulgoodgirl/AxureHub/issues](https://github.com/saulgoodgirl/AxureHub/issues)
