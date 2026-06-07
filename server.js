const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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

const PORT = 3000;
app.listen(PORT, () => console.log(`Offline Secure Vault Engine live at http://127.0.0.1:${PORT}`));
