import React, { useState } from 'react';
import { ShieldAlert, Unlock, Fingerprint, Loader } from 'lucide-react';
import { deriveMasterKey, unlockWithBiometrics } from '../utils/vault-utils';

export default function LockScreen({ onUnlock }) {
    const [pinCode, setPinCode] = useState('');
    const [keyfile, setKeyfile] = useState(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    // Assume biometrics is available for rendering the button
    const hasBiometrics = window.electronAPI ? true : false; // For simplicity in this structure

    const verifyPIN = async (pinOverride) => {
        const pin = pinOverride || pinCode;
        if (!pin) return;
        
        setLoading(true);
        setError(false);
        
        try {
            let fileBuffer = null;
            if (keyfile) {
                fileBuffer = await keyfile.arrayBuffer();
            }
            
            const vaultMasterKey = await deriveMasterKey(pin, fileBuffer);
            await onUnlock(vaultMasterKey);
            
            setPinCode('');
            setKeyfile(null);
        } catch (e) {
            console.error(e);
            setError(true);
            setTimeout(() => setError(false), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            verifyPIN();
        }
    };

    const handleBiometricUnlock = async () => {
        try {
            const bioPin = await unlockWithBiometrics();
            if (bioPin) {
                setPinCode(bioPin);
                verifyPIN(bioPin);
            }
        } catch(e) {
            console.warn(e);
        }
    };

    return (
        <div id="lockScreen" className="w-full max-w-sm glass-panel rounded-2xl p-10 text-center shadow-2xl fade-in" onKeyDown={handleKeyDown}>
            <div className="inline-flex p-4 rounded-full bg-indigo-500/15 text-indigo-400 mb-5 heartbeat shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                <ShieldAlert className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1 tracking-widest uppercase">AetherVault</h2>
            <div className="space-y-4 mb-6 text-left">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Local Master Keyfile (Optional)</label>
                    <input 
                        type="file" 
                        className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 transition-all cursor-pointer"
                        onChange={(e) => setKeyfile(e.target.files[0])}
                    />
                </div>
                
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Passphrase / PIN</label>
                    <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-center text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors tracking-[0.3em]"
                    />
                </div>
            </div>

            <div className="flex gap-3 mb-6">
                <button 
                    onClick={() => verifyPIN()} 
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wide shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex justify-center items-center gap-2"
                >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    {loading ? 'DECRYPTING...' : 'DECRYPT VAULT'}
                </button>
                {hasBiometrics && (
                    <button 
                        onClick={handleBiometricUnlock} 
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold shadow-lg shadow-slate-900/50 transition-all active:scale-95 flex justify-center items-center" 
                        title="Unlock with Windows Hello / Touch ID"
                    >
                        <Fingerprint className="w-6 h-6" />
                    </button>
                )}
            </div>

            {error && <p className="text-rose-400 text-xs font-bold mt-4 animate-bounce">Access Denied. Invalid key combination.</p>}
            <p className="text-slate-600 text-xs mt-4 font-mono">SYSTEM ISOLATED · 127.0.0.1</p>
        </div>
    );
}
