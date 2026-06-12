// utils/crypto.js

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
