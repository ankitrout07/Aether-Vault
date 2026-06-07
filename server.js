const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://localhost:8200';
let vaultToken = process.env.VAULT_TOKEN || '';

// Middleware to authenticate via AppRole if token isn't set
const verifyVaultToken = async (req, res, next) => {
    if (vaultToken) return next();
    try {
        const response = await axios.post(`${VAULT_ADDR}/v1/auth/approle/login`, {
            role_id: process.env.VAULT_ROLE_ID,
            secret_id: process.env.VAULT_SECRET_ID
        });
        vaultToken = response.data.auth.client_token;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Failed to authenticate with Vault backend infrastructure.' });
    }
};

// Route to Save a Password
app.post('/api/secrets', verifyVaultToken, async (req, res) => {
    const { path: secretPath, key, value } = req.body;
    try {
        await axios.post(
            `${VAULT_ADDR}/v1/internal/data/app-passwords/${secretPath}`,
            { data: { [key]: value } },
            { headers: { 'X-Vault-Token': vaultToken } }
        );
        res.json({ success: true, message: 'Password encrypted and saved safely.' });
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: error.response?.data || 'Storage failed' });
    }
});

// Route to Retrieve a Password
app.get('/api/secrets/:path/:key', verifyVaultToken, async (req, res) => {
    const { path: secretPath, key } = req.params;
    try {
        const response = await axios.get(
            `${VAULT_ADDR}/v1/internal/data/app-passwords/${encodeURIComponent(secretPath)}`,
            { headers: { 'X-Vault-Token': vaultToken } }
        );
        const secretValue = response.data.data.data[key];
        if (!secretValue) return res.status(404).json({ error: 'Key identifier not found.' });
        res.json({ success: true, value: secretValue });
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'Failed to pull data path.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Password Saver Application running on http://localhost:${PORT}`));
