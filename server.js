const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
app.use(express.json());
// Public assets are bundled read-only snapshots — __dirname is correct here
app.use(express.static(path.join(__dirname, 'public')));

const VAULT_ADDR = 'http://127.0.0.1:8200';
const vaultToken = 'root';

// When compiled with pkg, __dirname is a read-only virtual snapshot inside the .exe.
// All writable data files must live next to the .exe on the real filesystem.
const DATA_DIR = process.pkg
    ? path.dirname(process.execPath)
    : __dirname;

const WAL_PATH      = path.join(DATA_DIR, 'vault.log');
const DB_PATH       = path.join(DATA_DIR, 'vault-data.json');
const CHECKSUM_PATH = path.join(DATA_DIR, 'vault-data.sha256');

function verifyChecksum() {
    if (!fs.existsSync(DB_PATH)) return true;
    if (!fs.existsSync(CHECKSUM_PATH)) return false;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex');
    const storedHash = fs.readFileSync(CHECKSUM_PATH, 'utf8').trim();
    return hash === storedHash;
}

function updateChecksum() {
    if (!fs.existsSync(DB_PATH)) return;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(DB_PATH)).digest('hex');
    fs.writeFileSync(CHECKSUM_PATH, hash);
}

function recoverWAL() {
    // Ensure the data directory exists before trying to read/write files
    if (!fs.existsSync(DATA_DIR)) {
        try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
    }
    if (fs.existsSync(WAL_PATH)) {
        const logData = fs.readFileSync(WAL_PATH, 'utf8').trim();
        if (logData) {
            console.log('[RECOVERY] Uncommitted transactions found in vault.log. Replaying...');
            const lines = logData.split('\n');
            let db = {};
            if (fs.existsSync(DB_PATH)) {
                try { db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch(e){}
            }
            let recovered = false;
            lines.forEach(line => {
                if(!line) return;
                try {
                    const tx = JSON.parse(line);
                    db[tx.type] = tx.data;
                    recovered = true;
                } catch(e){}
            });
            if (recovered) {
                const tmpPath = path.join(DATA_DIR, 'vault-data.tmp');
                fs.writeFileSync(tmpPath, JSON.stringify(db));
                fs.renameSync(tmpPath, DB_PATH);
                updateChecksum();
                console.log('[RECOVERY] WAL transactions successfully replayed.');
            }
        }
        fs.writeFileSync(WAL_PATH, '');
    }
}
recoverWAL();

// ─── Windows / pkg: Spawn bundled vault.exe as a background daemon ────────────
if (process.platform === 'win32' || process.pkg) {
    const internalVaultPath = path.join(__dirname, 'bin', 'vault.exe');
    // Extract vault-runtime.exe next to the .exe so it's on the real writable filesystem
    const externalVaultPath = path.join(DATA_DIR, 'vault-runtime.exe');

    // Extract vault binary from pkg bundle on first run
    if (!fs.existsSync(externalVaultPath) && fs.existsSync(internalVaultPath)) {
        fs.writeFileSync(externalVaultPath, fs.readFileSync(internalVaultPath));
    }

    if (fs.existsSync(externalVaultPath)) {
        console.log('[INFRASTRUCTURE] Spawning background offline Vault process daemon...');
        const vaultEnv = { ...process.env, VAULT_DEV_ROOT_TOKEN_ID: 'root' };
        const vaultDaemon = spawn(
            externalVaultPath,
            ['server', '-dev', '-dev-listen-address=127.0.0.1:8200'],
            { env: vaultEnv }
        );

        vaultDaemon.on('error', (err) => console.error('[ERROR] Vault daemon failed:', err));

        // Graceful teardown: kill Vault and remove extracted binary on exit
        process.on('exit', () => {
            if (vaultDaemon) vaultDaemon.kill();
            try { if (fs.existsSync(externalVaultPath)) fs.unlinkSync(externalVaultPath); } catch (e) {}
        });

        ['SIGINT', 'SIGTERM', 'QUIT'].forEach(signal => {
            process.on(signal, () => {
                console.log(`[SHUTDOWN] Signal ${signal} caught. Halting Vault daemon...`);
                if (vaultDaemon) vaultDaemon.kill('SIGTERM');
                process.exit(0);
            });
        });
    } else {
        console.warn('[WARNING] vault.exe not found at bin/vault.exe — Vault KV backend unavailable.');
        console.warn('[INFO]    App will run in fallback mode using vault-data.json for storage.');
        console.warn('[INFO]    To enable full Vault support: place vault.exe in the bin/ directory and rebuild.');
    }
}

// ─── Master Save Route (Handles Both Passwords and Notes) ─────────────────────
app.post('/api/vault/save', async (req, res) => {
    const { type, data } = req.body; // type: 'passwords' | 'notes'
    try {
        await axios.post(
            `${VAULT_ADDR}/v1/internal/data/app-passwords/${type}`,
            { data: { store: JSON.stringify(data) } },
            { headers: { 'X-Vault-Token': vaultToken } }
        );

        // 1. Write Ahead Log (WAL)
        const tx = JSON.stringify({ type, data, timestamp: Date.now() }) + '\n';
        fs.appendFileSync(WAL_PATH, tx);

        // 2. Atomic File Write Backup
        const tmpPath = path.join(DATA_DIR, 'vault-data.tmp');
        let db = {};
        if (fs.existsSync(DB_PATH)) {
            db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
        db[type] = data;
        fs.writeFileSync(tmpPath, JSON.stringify(db));
        fs.renameSync(tmpPath, DB_PATH);

        // 3. Update Checksum
        updateChecksum();

        // 4. Flush WAL
        fs.writeFileSync(WAL_PATH, '');

        res.json({ success: true, message: 'Vault sync operation succeeded.' });
    } catch (error) {
        res.status(500).json({ error: 'Vault database storage sync failure.' });
    }
});

// ─── Master Read Route ─────────────────────────────────────────────────────────
app.get('/api/vault/load/:type', async (req, res) => {
    const { type } = req.params;
    try {
        const response = await axios.get(
            `${VAULT_ADDR}/v1/internal/data/app-passwords/${type}`,
            { headers: { 'X-Vault-Token': vaultToken } }
        );
        const storedRaw = response.data.data.data.store;
        res.json({ success: true, data: JSON.stringify(storedRaw) });
    } catch (error) {
        // Path not yet written — return empty collection gracefully
        // Try to load from atomic file backup
        try {
            if (fs.existsSync(DB_PATH)) {
                if (!verifyChecksum()) {
                    return res.status(500).json({ error: 'DATA_INTEGRITY_FAULT: Checksum verification failed. Database is corrupted.' });
                }
                const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                if (db[type]) {
                    // Restore to Vault
                    axios.post(
                        `${VAULT_ADDR}/v1/internal/data/app-passwords/${type}`,
                        { data: { store: JSON.stringify(db[type]) } },
                        { headers: { 'X-Vault-Token': vaultToken } }
                    ).catch(() => {});
                    return res.json({ success: true, data: JSON.stringify(db[type]) });
                }
            }
        } catch(e) {}
        res.json({ success: true, data: '[]' });
    }
});

// ─── Backup Endpoints ────────────────────────────────────────────────────────
// Backups also go next to the exe / working dir — not inside the read-only snapshot
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function deriveKey(passphrase, salt) {
    return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

app.post('/api/backup/export', async (req, res) => {
    const { passphrase } = req.body;
    try {
        const [p, n, t] = await Promise.all([
            axios.get(`${VAULT_ADDR}/v1/internal/data/app-passwords/passwords`, { headers: { 'X-Vault-Token': vaultToken } }).catch(()=>({data:{data:{data:{store:'[]'}}}})),
            axios.get(`${VAULT_ADDR}/v1/internal/data/app-passwords/notes`, { headers: { 'X-Vault-Token': vaultToken } }).catch(()=>({data:{data:{data:{store:'[]'}}}})),
            axios.get(`${VAULT_ADDR}/v1/internal/data/app-passwords/totp`, { headers: { 'X-Vault-Token': vaultToken } }).catch(()=>({data:{data:{data:{store:'[]'}}}}))
        ]);
        
        const payload = JSON.stringify({
            passwords: p.data.data.data.store,
            notes: n.data.data.data.store,
            totp: t.data.data.data.store
        });

        const salt = crypto.randomBytes(16);
        const iv = crypto.randomBytes(16);
        const key = deriveKey(passphrase, salt);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(payload, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        
        // RUNTIME MEMORY ZEROING
        key.fill(0);

        const backupData = JSON.stringify({
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            authTag,
            data: encrypted
        });

        const filename = `aether-vault-backup-${Date.now()}.qvbak`;
        fs.writeFileSync(path.join(BACKUP_DIR, filename), backupData);
        res.json({ success: true, message: `Backup saved to ${filename}` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create backup.' });
    }
});

app.post('/api/backup/import', async (req, res) => {
    const { passphrase, filename } = req.body;
    try {
        const filepath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup file not found.' });

        const backupData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const salt = Buffer.from(backupData.salt, 'hex');
        const iv = Buffer.from(backupData.iv, 'hex');
        const authTag = Buffer.from(backupData.authTag, 'hex');
        const key = deriveKey(passphrase, salt);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(backupData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        // RUNTIME MEMORY ZEROING
        key.fill(0);

        const payload = JSON.parse(decrypted);

        // Overwrite Vault
        await Promise.all([
            axios.post(`${VAULT_ADDR}/v1/internal/data/app-passwords/passwords`, { data: { store: payload.passwords } }, { headers: { 'X-Vault-Token': vaultToken } }),
            axios.post(`${VAULT_ADDR}/v1/internal/data/app-passwords/notes`, { data: { store: payload.notes } }, { headers: { 'X-Vault-Token': vaultToken } }),
            axios.post(`${VAULT_ADDR}/v1/internal/data/app-passwords/totp`, { data: { store: payload.totp } }, { headers: { 'X-Vault-Token': vaultToken } })
        ]);

        res.json({ success: true, message: 'Vault restored successfully.' });
    } catch (err) {
        res.status(403).json({ error: 'Decryption failed. Incorrect passphrase or corrupt file.' });
    }
});

app.get('/api/backup/list', (req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.qvbak')).sort().reverse();
        res.json({ success: true, files });
    } catch (err) {
        res.json({ success: true, files: [] });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Offline Secure Vault Engine live at http://127.0.0.1:${PORT}`));
