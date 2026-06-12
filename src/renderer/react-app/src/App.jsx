import React, { useState, useEffect } from 'react';
import LockScreen from './components/LockScreen';
import { loadAllVaultData } from './utils/api';

function App() {
  const [vaultMasterKey, setVaultMasterKey] = useState(null);
  const [vaultData, setVaultData] = useState(null);
  const [isLocked, setIsLocked] = useState(true);

  const handleUnlock = async (masterKey) => {
    try {
      const data = await loadAllVaultData(masterKey);
      setVaultData(data);
      setVaultMasterKey(masterKey);
      setIsLocked(false);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleLock = () => {
    setVaultMasterKey(null);
    setVaultData(null);
    setIsLocked(true);
  };

  return (
    <div className="min-h-screen text-slate-200 flex items-center justify-center p-4">
      {isLocked ? (
        <LockScreen onUnlock={handleUnlock} />
      ) : (
        <div className="w-full max-w-6xl glass-panel rounded-2xl flex flex-col md:flex-row shadow-2xl min-h-[680px] overflow-hidden fade-in">
          {/* Dashboard Placeholder */}
          <div className="flex-1 p-8 flex items-center justify-center flex-col gap-4">
            <h1 className="text-3xl font-bold">Vault Unlocked</h1>
            <p className="text-slate-400">Phase 4 Migration in Progress...</p>
            <button 
              onClick={handleLock}
              className="px-6 py-2 bg-rose-600 rounded-xl font-bold"
            >
              LOCK VAULT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
