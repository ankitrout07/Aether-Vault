// utils/api.js
import { wrapData, unwrapData } from './crypto.js';

export async function syncWithVault(type, payload, vaultMasterKey) {
    try {
        const wrapped = await wrapData(vaultMasterKey, payload);
        await fetch('/api/vault/save', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ type, data: wrapped })
        });
    } catch(e) {
        console.error('Failed to sync', type, e);
        throw e;
    }
}

export async function loadAllVaultData(vaultMasterKey) {
    try {
        const [p, n, t, s] = await Promise.all([
            fetch('/api/vault/load/passwords').then(r=>r.json()),
            fetch('/api/vault/load/notes').then(r=>r.json()),
            fetch('/api/vault/load/totp').then(r=>r.json()),
            fetch('/api/vault/load/settings').then(r=>r.json())
        ]);
        
        let pRaw=[], nRaw=[], tRaw=[], sRaw=null;
        try { pRaw = JSON.parse(p.data); } catch(e){}
        try { nRaw = JSON.parse(n.data); } catch(e){}
        try { tRaw = JSON.parse(t.data); } catch(e){}
        try { sRaw = JSON.parse(s.data); } catch(e){}
        
        const passwordsState = Array.isArray(pRaw) ? pRaw : await unwrapData(vaultMasterKey, pRaw);
        const notesState     = Array.isArray(nRaw) ? nRaw : await unwrapData(vaultMasterKey, nRaw);
        const totpState      = Array.isArray(tRaw) ? tRaw : await unwrapData(vaultMasterKey, tRaw);
        let settingsState    = { inactivityMs: 300000, defaultGenLen: 20 };
        
        if (sRaw) {
            const unwrappedS = await unwrapData(vaultMasterKey, sRaw);
            if (unwrappedS && !Array.isArray(unwrappedS)) {
                settingsState = { ...settingsState, ...unwrappedS };
            }
        }
        
        return { passwordsState, notesState, totpState, settingsState };
    } catch(e) { 
        console.error('Vault load error:', e); 
        throw e;
    }
}
