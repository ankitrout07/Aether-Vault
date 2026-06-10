# 🔐 AetherVault — Offline Enterprise Password Manager

> **v1.3.0** — Native Windows Desktop Application · Electron + Express · Zero Network Dependency

An ultra-secure, completely offline, zero-trust password manager and credential vault designed for single-user enterprise workstations.

**AetherVault** is a **native Windows desktop application** powered by Electron. It bundles a lightweight Chromium window, a Node.js runtime, and an Express API gateway into a single double-click executable — no browser required, no Node.js required, no internet required.

---

## 🚀 Quick Start (Windows)

### Option A — Run the Pre-Built Portable Executable

> **No installation, no dependencies.** Everything is self-contained.

1. Download **`AetherVault-1.3.0-portable.exe`** from `dist-electron/`
2. **Double-click** it on your Windows machine
3. A native desktop window opens automatically with the AetherVault UI
4. Enter the Master PIN **`2026`** to unlock your vault

> Data is stored at `C:\Users\<you>\AppData\Roaming\AetherVault\` and persists across sessions.

---

### Option B — Build From Source (macOS / Linux build host)

#### Prerequisites
- Node.js v18+
- npm

#### Steps

```bash
# 1. Clone the repository
git clone https://github.com/ankitrout07/AETHER-VAULT.git
cd AETHER-VAULT

# 2. Install all dependencies
npm install

# 3. Build the Windows portable exe
npm run build-win
# Output: dist-electron/AetherVault-1.3.0-portable.exe

# 4. Transfer to your Windows PC and double-click
```

#### Optional — Build NSIS Installer (with Start Menu shortcut)

```bash
npm run build-win-installer
# Output: dist-electron/AetherVault-1.3.0-setup.exe
```

---

## 🖥️ Desktop Architecture

AetherVault uses **Electron** to wrap a local Express.js server and serve the UI inside a native OS window. No browser tab, no address bar, no terminal window visible to the user.

```
┌─────────────────────────────────────────────────────┐
│               Native OS Window (Electron)            │
│          Chromium · Hardware Accelerated             │
│                                                      │
│   ┌─────────────────────────────────────────────┐   │
│   │          AetherVault UI Layer               │   │
│   │  Tailwind · Argon2id · zxcvbn · WebCrypto   │   │
│   └──────┬──────────┬──────────┬───────────┬────┘   │
│          │          │          │           │         │
│       Hygiene     TOTP      Quick       Clipboard   │
│       Auditor    Engine    Search         Purge      │
│          │          │          │           │         │
│   ┌──────┴──────────┴──────────┴───────────┴────┐   │
│   │       Express.js API Gateway (port 3000)    │   │
│   │   WAL · Atomic Writes · SHA-256 Checksums   │   │
│   └─────────────────────────────────────────────┘   │
│                    127.0.0.1 only                    │
└─────────────────────────────────────────────────────┘
```

### How It Works

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Desktop Shell** | Electron 42 | Native OS window, lifecycle management |
| **UI Frontend** | HTML · Tailwind · Vanilla JS | Glassmorphism credential interface |
| **API Gateway** | Express.js | REST endpoints — save, load, backup |
| **Key Derivation** | Argon2id (WASM) | PIN hardening against brute-force |
| **Crypto** | WebCrypto API | AES-256-GCM encryption in-browser |
| **Data Fallback** | `vault-data.json` | Atomic JSON store with SHA-256 checksums |
| **WAL** | `vault.log` | Write-Ahead Log for crash recovery |

---

## 💎 Feature Suite (v1.3)

### 🔑 Core Vault Features

| Feature | Description |
| :--- | :--- |
| **Glassmorphism UI** | Premium dark theme with GPU-accelerated glass panels, micro-animations, and `backdrop-filter` blur |
| **RFC 6238 TOTP Authenticator** | Rotating 6-digit 2FA codes via pure-JS HMAC-SHA1 (`crypto.subtle`). Seeds stored in vault. |
| **Multi-Category Credentials** | General Login, Server Node, Bank Card, and Software License templates |
| **Secure Notes Lifecycle** | Active, Archive, and Recycle Bin filter states. Full note lifecycle management. |
| **Entropy Password Generator** | Cryptographically secure via `crypto.getRandomValues`. Configurable length and character sets. |
| **Encrypted Backup & Restore** | AES-256-GCM encrypted `.qvbak` snapshots, passphrase-protected. |

### 🛡️ Stability & Data Integrity

| Feature | Description |
| :--- | :--- |
| **Write-Ahead Log (WAL)** | Every write is journaled to `vault.log` first. Crashes are recovered automatically on next launch. |
| **Atomic File Writes** | Saves use `tmp → renameSync` — a partial write can never corrupt the main database. |
| **SHA-256 Checksum** | Each save generates a `.sha256` companion file. Tampering or corruption triggers an integrity alert. |
| **Graceful Shutdown** | `SIGINT`, `SIGTERM`, and Electron `window-all-closed` ensure clean process teardown. |

### 🔒 Security Hardening

| Feature | Description |
| :--- | :--- |
| **Argon2id KDF** | PIN processed with Argon2id (3 iterations, 64 MB RAM). GPU brute-force is computationally infeasible. |
| **Runtime Memory Zeroing** | `Uint8Array` key buffers overwritten after use in-browser. `Buffer.fill(0)` wipes Node.js heap after backup ops. |
| **Smart Clipboard Scrubber** | 30-second countdown auto-wipe. Only exact app-copied values purged (SHA-256 hash comparison). |
| **Session Inactivity Lock** | 5-minute idle timeout wipes all in-memory state and relocks the vault. |
| **Offline Breach Index** | Audit tab checks passwords against a bundled SHA-1 breach index (k-Anonymity, 5-char prefix). **Zero network calls.** |

### ⚡ Performance & UX

| Feature | Description |
| :--- | :--- |
| **Spotlight Quick-Search** | `Ctrl+Alt+Space` opens a floating credential search overlay. Arrow keys to navigate, Enter to copy, Esc to close. |
| **zxcvbn Entropy Scoring** | Strength rated by `zxcvbn` — accounts for dictionary words, patterns, keyboard walks. Not just character classes. |
| **Debounced Search** | 150ms debounce + `DocumentFragment` batching — zero layout thrash on large credential sets. |
| **Hygiene Audit Dashboard** | Flags **WEAK**, **DUPLICATE**, **TOO SHORT**, and **⚠ PWNED** credentials with a 0–100 Security Score ring. |

---

## 📦 Developer Reference

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm start` | Run Express server only (headless, for API testing) |
| `npm run desktop` | Launch full Electron desktop app in dev mode |
| `npm run build-win` | Build `AetherVault-1.3.0-portable.exe` (Windows x64) |
| `npm run build-win-installer` | Build NSIS installer with Start Menu shortcut |

### Project Structure

```
AETHER-VAULT/
├── main.js              ← Electron main process (boots Express, creates window)
├── server.js            ← Express API gateway (WAL, backup, vault sync)
├── public/
│   ├── index.html       ← Full AetherVault UI (Tailwind, Argon2id, zxcvbn)
│   ├── loading.html     ← Animated splash screen shown on startup
│   ├── tailwind.min.js  ← Bundled offline (no CDN)
│   ├── lucide.min.js    ← Bundled offline (no CDN)
│   ├── argon2-bundled.min.js
│   └── zxcvbn.js
├── bin/
│   └── vault.exe        ← (Optional) HashiCorp Vault binary for KV-V2 backend
├── dist-electron/
│   └── AetherVault-1.3.0-portable.exe  ← Windows build output
└── package.json
```

### Data Storage (Windows Packaged App)

All user data is written to the OS-sanctioned writable location — **never inside the read-only app bundle**:

| OS | Data Location |
| :--- | :--- |
| **Windows** | `%APPDATA%\AetherVault\` |
| **macOS** | `~/Library/Application Support/AetherVault/` |
| **Linux** | `~/.config/AetherVault/` |

Files written: `vault-data.json`, `vault.log`, `vault-data.sha256`, `backups/`

---

## 🔒 Security Posture

- **Network Isolation:** Express API binds **only** to `127.0.0.1:3000`. Zero LAN or internet exposure.
- **No Electron nodeIntegration:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — renderer process has no access to Node.js APIs.
- **Argon2id KDF:** Memory-hard derivation renders offline brute-force attacks infeasible on consumer hardware.
- **Memory Zeroing:** Key material overwritten in both the browser (WebCrypto typed arrays) and Node.js (Buffer) after each use.
- **Offline Breach Index:** k-Anonymity SHA-1 checks run entirely locally — no HIBP API calls, no data leaves the machine.
- **WAL + Checksums:** Two-layer data integrity protection ensures the vault database is always consistent and tamper-evident.
- **Fully Offline:** All JS dependencies (Tailwind, Lucide, Argon2, zxcvbn) are bundled locally. Zero CDN calls.

---

*Built for zero-trust, offline-first enterprise security. v1.3.0 · Electron 42 · Express 4*
