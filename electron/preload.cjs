const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leadJourneyDesktop', {
  isElectron: true,
  selectFolder: () => ipcRenderer.invoke('leadjourney:select-folder'),
  testFolder: (payload) => ipcRenderer.invoke('leadjourney:test-folder', payload),
  saveSnapshot: (payload) => ipcRenderer.invoke('leadjourney:save-snapshot', payload),
  readSnapshot: (payload) => ipcRenderer.invoke('leadjourney:read-snapshot', payload),
  getDefaultFolder: () => ipcRenderer.invoke('leadjourney:get-default-folder'),
  onRdCrmTick: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => { try { callback(); } catch (error) { console.warn('rdCrmTick callback falhou:', error); } };
    ipcRenderer.on('leadjourney:rd-crm-tick', listener);
    return () => ipcRenderer.removeListener('leadjourney:rd-crm-tick', listener);
  }
});
