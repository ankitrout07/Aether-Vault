# 🔐 QuantumVault — Offline Enterprise Password Manager

An ultra-secure, completely offline, zero-trust password manager and credential vault designed for single-user enterprise workstations.

**QuantumVault** runs as a standalone, self-contained Windows executable (`.exe`). It acts as a wrapper around the HashiCorp Vault KV-V2 engine, utilizing loopback-only connections (`127.0.0.1`) and an Express API gateway to provide a stunning Glassmorphism UI for managing your most sensitive credentials, securely and offline.

---

## 🚀 Quick Start (Windows Setup)

QuantumVault is pre-compiled into a portable Windows executable. **No Node.js, no Docker, and no external dependencies are required to run it.**

1. **Pull this repository** onto your Windows workstation.
2. Navigate to the `dist/` folder: `dist/password-saver.exe`
3. **Double-click `password-saver.exe`**.
    - This will silently spawn the background HashiCorp Vault daemon and the Express middleware server.
4. **Open your web browser** and go to: `http://127.0.0.1:3000`
5. **Enter the Master PIN (`2026`)** to unlock your vault.

---

## 💎 Advanced Features (v1.3 Production Suite)

QuantumVault v1.3 brings the platform to full parity with industry-standard Enterprise Password Managers, utilizing a combination of local browser cryptography and automated memory hardening.

| Feature | Description |
| :--- | :--- |
| **Glassmorphism UI** | A beautiful, modern, Tailwind-powered desktop UI that feels premium and responsive. |
| **RFC 6238 TOTP Authenticator** | Generate rotating 6-digit 2FA codes directly in the app. Uses pure JavaScript `crypto.subtle` for HMAC-SHA1 hashing. Base32 seeds are encrypted inside Vault. |
| **Password Hygiene Auditor** | Automatically scans your vault to detect and flag **weak**, **duplicated**, or **too short** passwords. Grades your vault with a visual 0-100 Security Score ring. |
| **30-Second Clipboard Auto-Wipe** | Whenever you copy a password or 2FA code, a 30-second countdown begins. At 0, the OS clipboard is forcefully purged to prevent background memory sniffing. |
| **Session Inactivity Lock** | A background daemon tracks mouse/keyboard activity. After 5 minutes of idle time, it completely wipes the in-memory state and kicks you back to the lock screen. |
| **Secure Notes Lifecycle** | Write encrypted notes, tokens, or keys. Manage them via Active, Archive, and Recycle Bin filters. |
| **Entropy Generator** | Cryptographically secure pseudo-random password generator (`crypto.getRandomValues`) with customisable length and character sets. |

---

## 🏗️ Technical Architecture

QuantumVault leverages a layered, zero-trust security model:

```
                  +------------------------------------------+
                  |         QuantumVault UI Layer            |
                  |  (Tailwind + Vanilla JS + Glassmorphism) |
                  +------------------------------------------+
                    /                  |                 \
                   /                   v                  \
                  v                    |                   v
       +--------------------+  +---------------+  +------------------+
       | Password Hygiene   |  | TOTP Engine   |  | Clipboard Purge  |
       | Audit & Generator  |  |  (RFC 6238)   |  |  (30s Auto-Wipe) |
       +--------------------+  +---------------+  +------------------+
                  \                    |                  /
                   \                   v                 /
                  +------------------------------------------+
                  |  Express.js API Gateway (Middle-tier)    |
                  |     (Handles Vault binary spawning)      |
                  +------------------------------------------+
                                       |
                                       v  (Local Loopback Only: 127.0.0.1)
                  +------------------------------------------+
                  |   HashiCorp Vault Engine (Background)    |
                  |           (KV-V2 Storage)                |
                  +------------------------------------------+
```

### Data Storage Protocol
- Passwords, Secure Notes, and TOTP seeds are stored as JSON blobs within Vault's KV-V2 engine under `app-passwords/passwords`, `app-passwords/notes`, and `app-passwords/totp`.
- All encryption is handled natively by Vault using **AES-256-GCM**.
- Vault is launched in **Dev Mode** bound strictly to `127.0.0.1`.

---

## 📦 Developer Guide

If you wish to modify the source code and rebuild the executable:

### Prerequisites (MacOS/Linux Build Host)
- Node.js (v18.x recommended)
- `pkg` bundler (`npm install -g pkg`)

### 1. Local Development Mode
To run the server natively without compiling:
```bash
npm install
npm start
```

### 2. Re-compiling the Windows Executable
If you modify `public/index.html` or `server.js`, you must recompile the `.exe` for Windows deployment. We use `pkg` with the `node18-win-x64` target.

```bash
npm run build-win
```

This command will output a new `password-saver.exe` inside the `dist/` directory. You can then `git commit` and `git push` the binary so it's ready for download on your Windows machine.

---

## 🔒 Security Posture

- **Network Isolation:** The Express API and HashiCorp Vault bind ONLY to loopback (`127.0.0.1`). They cannot be accessed from the LAN or the Internet.
- **Memory Purging:** The 5-minute inactivity lock deliberately destroys the `passwordsState` arrays in the browser's JavaScript context.
- **Client-Side Cryptography:** The TOTP engine uses standard Web Crypto API (`crypto.subtle`) ensuring no external libraries or calls are made for hashing.
- **OS Hardening:** `navigator.clipboard.writeText('')` enforces clipboard clearing, mitigating risk from clipboard-hijacking malware.

---
*Built for zero-trust, offline-first enterprise security.*
