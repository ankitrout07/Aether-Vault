// utils/biometrics.js

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
