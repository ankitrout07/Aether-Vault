# 🔐 AetherVault — Offline Enterprise Password Manager

> **v1.3.0** — Elite-Tier Production Hardening Suite

An ultra-secure, completely offline, zero-trust password manager and credential vault designed for single-user enterprise workstations.

**AetherVault** runs as a standalone, self-contained Windows executable (`.exe`). It acts as a wrapper around the HashiCorp Vault KV-V2 engine, utilizing loopback-only connections (`127.0.0.1`) and an Express API gateway to provide a stunning Glassmorphism UI for managing your most sensitive credentials, securely and offline.

---

## 🚀 Quick Start (Windows Setup)

AetherVault is pre-compiled into a portable Windows executable. **No Node.js, no Docker, and no external dependencies are required to run it.**

1. **Pull this repository** onto your Windows workstation.
2. Navigate to the `dist/` folder: `dist/aether-vault.exe`
3. **Double-click `aether-vault.exe`**.
    - This will silently spawn the background HashiCorp Vault daemon and the Express middleware server.
4. **Open your web browser** and go to: `http://127.0.0.1:3000`
5. **Enter the Master PIN (`2026`)** to unlock your vault.

---

## 💎 Feature Suite (v1.3 Production Hardening)

AetherVault v1.3 brings the platform to full parity with industry-standard Enterprise Password Managers. Every subsystem has been hardened for cryptographic resilience, memory safety, and data integrity.

### 🔑 Core Vault Features

| Feature | Description |
| :--- | :--- |
| **Glassmorphism UI** | A premium, Tailwind-powered desktop UI with micro-animations and GPU-accelerated panels. |
| **RFC 6238 TOTP Authenticator** | Generate rotating 6-digit 2FA codes directly in the app. Uses `crypto.subtle` HMAC-SHA1. Seeds are encrypted inside Vault. |
| **Secure Notes Lifecycle** | Write encrypted notes, tokens, or keys. Manage via Active, Archive, and Recycle Bin filters. |
| **Entropy Generator** | Cryptographically secure password generator (`crypto.getRandomValues`) with configurable length and character sets. |
| **Encrypted Backup & Restore** | Export/Import vault snapshots as `.qvbak` files, AES-256-GCM encrypted with a user passphrase. |

### 🛡️ Stability & Data Integrity (v1.3)

| Feature | Description |
| :--- | :--- |
| **Write-Ahead Log (WAL)** | Before any disk write, a transaction is appended to `vault.log`. On reboot after a crash, uncommitted transactions are replayed automatically — zero data loss. |
| **Atomic File Writes** | All saves use a tmp-file + `renameSync` pattern. A partial write can never corrupt the main database. |
| **SHA-256 Checksum Verification** | Every save generates a companion `vault-data.sha256` hash file. On load, the hash is re-verified — any corruption or tampering triggers an integrity alert. |
| **Graceful Process Shutdown** | `SIGINT`, `SIGTERM`, and `QUIT` signals ensure the HashiCorp Vault daemon always terminates cleanly. |

### 🔒 Security Hardening (v1.3)

| Feature | Description |
| :--- | :--- |
| **Argon2id Key Derivation** | The master PIN is processed with Argon2id (3 iterations, 64 MB RAM) before unlocking the vault — rendering GPU brute-force attacks computationally infeasible. |
| **Runtime Memory Zeroing** | After key derivation, all sensitive `Uint8Array` buffers are overwritten with `crypto.getRandomValues`. After backup operations, `Buffer.fill(0)` wipes key material from the Node.js heap. |
| **Smart Clipboard Scrubber** | Passwords are copied with a 30-second countdown timer. Only the exact value copied by the app is purged (verified via SHA-256 hash comparison), preventing accidental erasure of unrelated clipboard content. |
| **Session Inactivity Lock** | After 5 minutes of idle, the app wipes all in-memory state and returns to the lock screen. All password input fields are zeroed on lock. |
| **Offline Pwned Password Check** | The Audit tab checks every stored password against a bundled local SHA-1 breach index using k-Anonymity (5-char prefix lookup) — **zero network calls, fully air-gapped**. |

### ⚡ Performance & UX (v1.3)

| Feature | Description |
| :--- | :--- |
| **Spotlight Quick-Search Modal** | Press `Ctrl+Alt+Space` (Windows) or `Cmd+Option+Space` (macOS) to open a floating credential search bar. Navigate with arrow keys, press Enter to copy, Esc to dismiss. |
| **zxcvbn Entropy Scoring** | Password strength is rated using the `zxcvbn` offline entropy library — which accounts for dictionary words, patterns, and keyboard walks — not just character class checks. |
| **Debounced DOM Search** | The search bar uses 150ms debouncing and `DocumentFragment` batching for zero layout-thrash rendering. |
| **Password Hygiene Audit Dashboard** | Flags **WEAK**, **DUPLICATE**, **TOO SHORT**, and **⚠ PWNED** credentials with a 0–100 Security Score ring. |
| **GPU-Accelerated Panels** | `will-change: transform, backdrop-filter` applied to all glass panels for smooth 60fps animations. |

---

## 🏗️ Technical Architecture

```
                  +------------------------------------------+
                  |         AetherVault UI Layer             |
                  |  (Tailwind + Argon2id + zxcvbn + WASM)  |
                  +------------------------------------------+
                    /           |          |              \
                   v            v          v               v
       +----------+  +--------+  +-------+  +------------------+
       | Hygiene  |  | TOTP   |  | Quick |  | Clipboard Purge  |
       | Auditor  |  | Engine |  | Search|  | + Memory Zero    |
       +----------+  +--------+  +-------+  +------------------+
                  \              |               /
                   \             v              /
                  +------------------------------------------+
                  |  Express.js API Gateway (Middle-tier)    |
                  |  WAL + Atomic Writes + SHA-256 Checksums |
                  +------------------------------------------+
                                       |
                                       v  (Local Loopback Only: 127.0.0.1)
                  +------------------------------------------+
                  |   HashiCorp Vault Engine (Background)    |
                  |           (KV-V2 Storage)                |
                  +------------------------------------------+
```

### Data Storage Protocol
- Credentials are stored as AES-256-GCM encrypted blobs in Vault's KV-V2 engine.
- A JSON backup (`vault-data.json`) serves as an atomic fallback with SHA-256 integrity verification.
- `vault.log` provides Write-Ahead Logging for crash recovery.
- Vault is launched in **Dev Mode** bound strictly to `127.0.0.1`.

---

## 📦 Developer Guide

### Prerequisites (macOS/Linux Build Host)
- Node.js v18.x
- `pkg` bundler: `npm install -g pkg`

### Local Development
```bash
npm install
npm start
```

### Compile Windows Executable
```bash
npm run build-win
# Output: dist/aether-vault.exe
```

---

## 🔒 Security Posture

- **Network Isolation:** Express API and Vault bind ONLY to `127.0.0.1`. Zero LAN or internet exposure.
- **Argon2id KDF:** Memory-hard key derivation makes offline brute-force attacks against a stolen database file computationally infeasible on consumer hardware.
- **Memory Zeroing:** Sensitive key material is overwritten in both browser (WebCrypto typed arrays) and Node.js (Buffer) after use.
- **Offline Breach Index:** SHA-1 k-Anonymity checks run entirely locally — no HIBP API calls, no data leaves the machine.
- **WAL + Checksums:** Two-layer data integrity protection ensures the vault database is always consistent and tamper-evident.

---

*Built for zero-trust, offline-first enterprise security. v1.3.0*
