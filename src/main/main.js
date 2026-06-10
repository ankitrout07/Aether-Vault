'use strict';

const { app, BrowserWindow, shell, nativeTheme } = require('electron');
const path = require('path');
const http  = require('http');
const fs    = require('fs');

// ─── Force dark title-bar tint ───────────────────────────────────────────────
nativeTheme.themeSource = 'dark';

// ─── Data directory ─────────────────────────────────────────────────────────
// In a packaged Electron app the resource bundle is read-only.
// Writable user data must go to the OS-sanctioned location:
//   Windows  → %APPDATA%\AetherVault
//   macOS    → ~/Library/Application Support/AetherVault
//   Linux    → ~/.config/AetherVault
// In development (npm run desktop) we fall back to the project root so
// vault-data.json / vault.log appear where a developer expects them.
const DATA_DIR = app.isPackaged
    ? app.getPath('userData')
    : path.join(__dirname);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Expose to server.js before it is required
process.env.AETHER_DATA_DIR = DATA_DIR;

// Also expose resources path so server.js can locate vault.exe when packaged
process.env.AETHER_RESOURCES_DIR = app.isPackaged
    ? process.resourcesPath
    : __dirname;

// ─── Boot Express server inside THIS process ─────────────────────────────────
// We require() server.js directly — Electron's main process IS Node.js,
// so there is no need to spawn a separate child process or rely on an
// external `node` binary (which won't exist on the end-user's machine).
const serverModule = require('../server/server');

// ─── Window management ───────────────────────────────────────────────────────
let mainWindow = null;
const SERVER_URL  = 'http://127.0.0.1:3000';
const HEALTH_URL  = 'http://127.0.0.1:3000/api/health';
const LOAD_SPLASH = path.join(__dirname, '..', 'renderer', 'html', 'loading.html');

function createWindow() {
    mainWindow = new BrowserWindow({
        width:            1280,
        height:           820,
        minWidth:         900,
        minHeight:        600,
        title:            'AetherVault',
        backgroundColor:  '#090d16',
        autoHideMenuBar:  true,
        // Custom frameless feel — keep native frame for draggability
        titleBarStyle:    process.platform === 'darwin' ? 'hiddenInset' : 'default',
        webPreferences: {
            nodeIntegration:  false,
            contextIsolation: true,
            sandbox:          true,
            // Disable web security only for localhost loopback (safe)
            webSecurity:      true,
        },
    });

    // Show a lightweight local splash while the Express server warms up
    if (fs.existsSync(LOAD_SPLASH)) {
        mainWindow.loadFile(LOAD_SPLASH);
    }

    // Retry polling: attempt to reach the Express server health endpoint before loading the app
    waitForServer(HEALTH_URL, 20, 300, () => {
        if (mainWindow) mainWindow.loadURL(SERVER_URL);
    });

    // Intercept any navigation that tries to open an external URL in the app
    // window — redirect those to the system browser instead
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith('http://127.0.0.1')) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// Poll the local server until it is accepting connections
function waitForServer(url, retries, intervalMs, onReady) {
    http.get(url, () => {
        onReady();
    }).on('error', () => {
        if (retries > 0) {
            setTimeout(() => waitForServer(url, retries - 1, intervalMs, onReady), intervalMs);
        } else {
            // Last resort: load anyway and let the browser show its own error
            if (mainWindow) mainWindow.loadURL(url);
        }
    });
}

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
    createWindow();

    // macOS: re-create the window when the dock icon is clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    // On macOS apps conventionally stay alive until Cmd+Q
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    // Cleanly kill the HashiCorp Vault background daemon if it was started
    if (serverModule && serverModule.vaultDaemon) {
        serverModule.vaultDaemon.kill('SIGTERM');
    }
});
