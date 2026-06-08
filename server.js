const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VAULT_ADDR = 'http://127.0.0.1:8200';
const vaultToken = 'root';

// ─── Windows / pkg: Spawn bundled vault.exe as a background daemon ────────────
if (process.platform === 'win32' || process.pkg) {
    const internalVaultPath = path.join(__dirname, 'bin', 'vault.exe');
    const externalVaultPath = path.join(process.cwd(), 'vault-runtime.exe');

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
            vaultDaemon.kill();
            try { if (fs.existsSync(externalVaultPath)) fs.unlinkSync(externalVaultPath); } catch (e) {}
        });
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
        res.json({ success: true, data: '[]' });
    }
});

// ─── Backup Endpoints ──────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

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
