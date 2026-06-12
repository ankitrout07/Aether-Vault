// vault-utils.js

export async function deriveMasterKey(pin, fileBuffer) {
    const encoder = new TextEncoder();
    let keyMaterial = encoder.encode(pin);
    if (fileBuffer) {
        const hmacAlgo = { name: 'HMAC', hash: 'SHA-256' };
        const baseKey = await crypto.subtle.importKey('raw', keyMaterial, hmacAlgo, false, ['sign']);
        keyMaterial = await crypto.subtle.sign('HMAC', baseKey, fileBuffer);
    }
    const argonKey = await argon2.hash({ pass: keyMaterial, salt: 'AetherVaultStaticSalt', time: 3, mem: 40960, hashLen: 32, type: argon2.ArgonType.Argon2id });
    return await crypto.subtle.importKey('raw', argonKey.hash, {name: 'AES-GCM'}, false, ['encrypt','decrypt']);
}

export async function wrapData(vaultMasterKey, payload) {
    if (!vaultMasterKey) return payload; // If vault logic fails
    const dataStr = JSON.stringify(payload);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        vaultMasterKey, new TextEncoder().encode(dataStr)
    );
    const combined = new Uint8Array(12 + encData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encData), iv.length);
    return btoa(String.fromCharCode.apply(null, combined));
}

export async function unwrapData(vaultMasterKey, base64Str) {
    if (!vaultMasterKey || typeof base64Str !== 'string') return base64Str;
    if (base64Str.startsWith('[')) return JSON.parse(base64Str);
    const raw = atob(base64Str);
    const combined = new Uint8Array(raw.length);
    for(let i=0; i<raw.length; i++) combined[i] = raw.charCodeAt(i);
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        vaultMasterKey, data
    );
    return JSON.parse(new TextDecoder().decode(decBuffer));
}

export function generatePassword(length = 20, useSpec = true, useNum = true) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const spec = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    const nums = '0123456789';
    let pool = chars;
    if (useSpec) pool += spec;
    if (useNum) pool += nums;
    let pwd = '';
    const randomVals = new Uint32Array(length);
    crypto.getRandomValues(randomVals);
    for (let i = 0; i < length; i++) {
        pwd += pool[randomVals[i] % pool.length];
    }
    return pwd;
}

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

export async function checkBiometricAvailability() {
    if (window.electronAPI && await window.electronAPI.isBiometricAvailable()) {
        return await window.electronAPI.hasBiometricKey();
    }
    return false;
}

export async function enableBiometrics(pin) {
    if (!window.electronAPI) throw new Error("Electron API not found");
    
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);
    
    await navigator.credentials.create({
        publicKey: {
            challenge: challenge,
            rp: { name: "AetherVault Local", id: window.location.hostname },
            user: { id: userId, name: "Vault User", displayName: "Vault User" },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
            timeout: 60000
        }
    });
    
    return await window.electronAPI.storeBiometricKey(pin);
}

export async function disableBiometrics() {
    if (!window.electronAPI) return;
    await window.electronAPI.storeBiometricKey('DISABLED');
}

export async function unlockWithBiometrics() {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    
    await navigator.credentials.get({
        publicKey: {
            challenge: challenge,
            rpId: window.location.hostname,
            userVerification: "required"
        }
    });
    
    const pin = await window.electronAPI.getBiometricKey();
    if (pin && pin !== 'DISABLED') {
        return pin;
    }
    throw new Error('Secure biometric key invalid or disabled.');
}
