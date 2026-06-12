'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

// ─── Optional Vault KV dependency (requires vault.exe) ───────────────────────
// We import axios lazily — if vault is not present the fallback JSON store is
// used exclusively and we never touch axios at all.
let axios = null;
try { axios = require('axios'); } catch(e) {}

const app = express();
app.use(express.json({ limit: '10mb' }));
// Serve UI layers from the renderer directory
app.use(express.static(path.join(__dirname, '..', 'renderer', 'dist')));

const VAULT_ADDR  = 'http://127.0.0.1:8200';
const VAULT_TOKEN = 'root';

// ─── Data directory resolution ────────────────────────────────────────────────
// Priority:  AETHER_DATA_DIR (set by Electron main.js before require())
//          → pkg snapshot companion dir (next to the .exe)
//          → Project Root (two dirs up from src/server/)
const DATA_DIR = process.env.AETHER_DATA_DIR
    || (process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..', '..'));

// Guarantee the data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const WAL_PATH      = path.join(DATA_DIR, 'vault.log');
const DB_PATH       = path.join(DATA_DIR, 'vault-data.json');
const CHECKSUM_PATH = path.join(DATA_DIR, 'vault-data.sha256');
const BACKUP_DIR    = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ─── Integrity helpers ────────────────────────────────────────────────────────
function verifyChecksum() {
    if (!fs.existsSync(DB_PATH))       return true;   // no DB yet — OK
    if (!fs.existsSync(CHECKSUM_PATH)) return false;  // DB exists but no hash — tampered
    const hash       = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex');
    const storedHash = fs.readFileSync(CHECKSUM_PATH, 'utf8').trim();
    return hash === storedHash;
}

function updateChecksum() {
    if (!fs.existsSync(DB_PATH)) return;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex');
    fs.writeFileSync(CHECKSUM_PATH, hash);
}

// ─── JSON fallback store helpers ──────────────────────────────────────────────
function dbRead() {
    if (!fs.existsSync(DB_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch(e) { return {}; }
}

function dbWrite(type, data) {
    // 1. WAL
    fs.appendFileSync(WAL_PATH, JSON.stringify({ type, data, ts: Date.now() }) + '\n');
    // 2. Atomic write
    const db  = dbRead();
    db[type]  = data;
    const tmp = path.join(DATA_DIR, 'vault-data.tmp');
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_PATH);
    // 3. Checksum
    updateChecksum();
    // 4. Flush WAL
    fs.writeFileSync(WAL_PATH, '');
}

// ─── WAL recovery on startup ──────────────────────────────────────────────────
function recoverWAL() {
    if (!fs.existsSync(WAL_PATH)) return;
    const logData = fs.readFileSync(WAL_PATH, 'utf8').trim();
    if (!logData) return;

    console.log('[RECOVERY] Uncommitted WAL transactions found — replaying...');
    const db = dbRead();
    let recovered = false;

    logData.split('\n').forEach(line => {
        if (!line) return;
        try {
            const tx = JSON.parse(line);
            db[tx.type] = tx.data;
            recovered = true;
        } catch(e) {}
    });

    if (recovered) {
        const tmp = path.join(DATA_DIR, 'vault-data.tmp');
        fs.writeFileSync(tmp, JSON.stringify(db));
        fs.renameSync(tmp, DB_PATH);
        updateChecksum();
        console.log('[RECOVERY] WAL replay complete.');
    }
    fs.writeFileSync(WAL_PATH, '');
}
recoverWAL();

// ─── Optional HashiCorp Vault KV daemon ──────────────────────────────────────
// Only attempted on Windows (native run or pkg build). Electron on Windows
// satisfies process.platform === 'win32'.
// If vault.exe is absent the app silently uses vault-data.json instead.
let vaultDaemon = null;

if (process.platform === 'win32' || process.pkg) {
    const { spawn } = require('child_process');
    // resourcesDir is either the Electron unpackaged bundle, or the project root in dev mode
    const resourcesDir   = process.env.AETHER_RESOURCES_DIR || path.join(__dirname, '..', '..');
    const internalVault  = path.join(resourcesDir, 'bin', 'vault.exe');
    const externalVault  = path.join(DATA_DIR, 'vault-runtime.exe');

    if (!fs.existsSync(externalVault) && fs.existsSync(internalVault)) {
        try { fs.writeFileSync(externalVault, fs.readFileSync(internalVault)); } catch(e) {}
    }

    if (fs.existsSync(externalVault)) {
        console.log('[INFRASTRUCTURE] Launching HashiCorp Vault daemon...');
        vaultDaemon = spawn(
            externalVault,
            ['server', '-dev', '-dev-listen-address=127.0.0.1:8200'],
            { env: { ...process.env, VAULT_DEV_ROOT_TOKEN_ID: VAULT_TOKEN }, stdio: 'ignore' }
        );
        vaultDaemon.on('error', err => console.error('[VAULT ERROR]', err.message));
    } else {
        console.warn('[INFO] vault.exe not found — using vault-data.json fallback storage.');
    }
}

// Expose vault daemon handle so main.js can kill it on window close
module.exports = { vaultDaemon };

// ─── Vault KV helper — with JSON fallback ────────────────────────────────────
async function kvGet(type) {
    if (!axios || !vaultDaemon) throw new Error('Vault not available');
    const resp = await axios.get(
        `${VAULT_ADDR}/v1/internal/data/app-passwords/${type}`,
        { headers: { 'X-Vault-Token': VAULT_TOKEN }, timeout: 3000 }
    );
    return resp.data.data.data.store;
}

async function kvSet(type, data) {
    if (!axios || !vaultDaemon) throw new Error('Vault not available');
    await axios.post(
        `${VAULT_ADDR}/v1/internal/data/app-passwords/${type}`,
        { data: { store: JSON.stringify(data) } },
        { headers: { 'X-Vault-Token': VAULT_TOKEN }, timeout: 3000 }
    );
}

// ─── API: Save ────────────────────────────────────────────────────────────────
app.post('/api/vault/save', async (req, res) => {
    const { type, data } = req.body;
    if (!type || data === undefined) return res.status(400).json({ error: 'Missing type or data.' });

    // Always write to the JSON fallback — this is the source of truth
    try {
        dbWrite(type, data);
    } catch(e) {
        return res.status(500).json({ error: 'Disk write failed: ' + e.message });
    }

    // Best-effort sync to Vault KV (non-fatal if vault unavailable)
    kvSet(type, data).catch(() => {});

    res.json({ success: true, message: 'Vault sync complete.' });
});

// ─── API: Load ────────────────────────────────────────────────────────────────
app.get('/api/vault/load/:type', async (req, res) => {
    const { type } = req.params;

    // 1. Try Vault KV first (fastest, in-memory)
    try {
        const stored = await kvGet(type);
        return res.json({ success: true, data: JSON.stringify(stored) });
    } catch(_) {}

    // 2. Fallback: load from vault-data.json
    try {
        if (fs.existsSync(DB_PATH)) {
            if (!verifyChecksum()) {
                return res.status(500).json({
                    error: 'DATA_INTEGRITY_FAULT: Checksum mismatch. Database may be corrupted.'
                });
            }
            const db = dbRead();
            if (db[type] !== undefined) {
                // Kick off a background Vault restore attempt (non-blocking)
                kvSet(type, db[type]).catch(() => {});
                return res.json({ success: true, data: JSON.stringify(db[type]) });
            }
        }
    } catch(e) {}

    // 3. Nothing found — return empty array
    res.json({ success: true, data: '[]' });
});

// ─── API: Backup export ───────────────────────────────────────────────────────
function deriveKey(passphrase, salt) {
    return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

app.post('/api/backup/export', async (req, res) => {
    const { passphrase } = req.body;
    if (!passphrase) return res.status(400).json({ error: 'Passphrase required.' });

    try {
        // Read from JSON store (always available, even without vault)
        const db = dbRead();
        const payload = JSON.stringify({
            passwords: db.passwords || [],
            notes:     db.notes     || [],
            totp:      db.totp      || []
        });

        const salt      = crypto.randomBytes(16);
        const iv        = crypto.randomBytes(16);
        const key       = deriveKey(passphrase, salt);
        const cipher    = crypto.createCipheriv('aes-256-gcm', key, iv);
        let   encrypted = cipher.update(payload, 'utf8', 'hex');
        encrypted      += cipher.final('hex');
        const authTag   = cipher.getAuthTag().toString('hex');
        key.fill(0); // memory zeroing

        const filename = `aether-vault-backup-${Date.now()}.qvbak`;
        fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify({
            salt: salt.toString('hex'), iv: iv.toString('hex'), authTag, data: encrypted
        }));

        res.json({ success: true, message: `Backup saved: ${filename}` });
    } catch(err) {
        res.status(500).json({ error: 'Backup failed: ' + err.message });
    }
});

// ─── API: Backup import ───────────────────────────────────────────────────────
app.post('/api/backup/import', async (req, res) => {
    const { passphrase, filename } = req.body;
    if (!passphrase || !filename) return res.status(400).json({ error: 'Passphrase and filename required.' });

    try {
        const filepath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup file not found.' });

        const backup  = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const salt    = Buffer.from(backup.salt,    'hex');
        const iv      = Buffer.from(backup.iv,      'hex');
        const authTag = Buffer.from(backup.authTag, 'hex');
        const key     = deriveKey(passphrase, salt);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted  = decipher.update(backup.data, 'hex', 'utf8');
        decrypted     += decipher.final('utf8');
        key.fill(0);

        const payload = JSON.parse(decrypted);

        // Write each type to the fallback store
        ['passwords', 'notes', 'totp'].forEach(t => {
            if (payload[t] !== undefined) dbWrite(t, payload[t]);
        });

        // Best-effort Vault KV restore
        ['passwords', 'notes', 'totp'].forEach(t => {
            kvSet(t, payload[t] || []).catch(() => {});
        });

        res.json({ success: true, message: 'Vault restored from backup.' });
    } catch(err) {
        res.status(403).json({ error: 'Decryption failed — wrong passphrase or corrupt file.' });
    }
});

// ─── API: Backup list ─────────────────────────────────────────────────────────
app.get('/api/backup/list', (_req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.qvbak'))
            .sort().reverse();
        res.json({ success: true, files });
    } catch(_) {
        res.json({ success: true, files: [] });
    }
});

// ─── Health check (used by main.js waitForServer) ────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`[AetherVault] Express API live → http://127.0.0.1:${PORT}`);
});
