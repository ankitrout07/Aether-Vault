const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    storeBiometricKey: (pin) => ipcRenderer.invoke('bio:store', pin),
    getBiometricKey: () => ipcRenderer.invoke('bio:get'),
    hasBiometricKey: () => ipcRenderer.invoke('bio:hasKey'),
    isBiometricAvailable: () => ipcRenderer.invoke('bio:available')
});
