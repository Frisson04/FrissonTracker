const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electronAPI', {
	
  openWindow: (type) => ipcRenderer.send('open-window', type),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  sendConnectData: (data) => ipcRenderer.send('connect-data', data),
  onConnectUpdate: (callback) => ipcRenderer.on('connect-data', (_, data) => callback(data)),
  notifyConfigChange: () => ipcRenderer.send('config-changed'),
  onConfigUpdate: (callback) => ipcRenderer.on('config-updated', callback),
  
  sendToSettings: (data) => ipcRenderer.send('send-to-settings', data),
  onSettingsData: (callback) => ipcRenderer.on('settings-data', callback),
  getFullConfig: () => ipcRenderer.invoke('get-full-config'),
  sendPositionsToTracker: (positions) => ipcRenderer.send('update-tracker-positions', positions),
  onApplyNewPositions: (callback) => ipcRenderer.on('apply-new-positions', callback),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
setWindowSize: (size) => ipcRenderer.invoke('set-window-size', size),
  toggleEditMode: () => ipcRenderer.invoke('toggle-edit-mode'),
    openHelpWindow: () => ipcRenderer.send('open-window', 'help'),
    openAboutWindow: () => ipcRenderer.send('open-window', 'about'),
  sendToMainConsole: (data) => ipcRenderer.send('to-main-console', data),
  sendRoomInfo: (roomInfo) => ipcRenderer.send('room-info', roomInfo),
  sendSlotData: (slotData) => ipcRenderer.send('slot-data', slotData),
  

  onSlotData: (callback) => ipcRenderer.on('slot-data-update', callback),
  cleanupBeforeConnect: () => ipcRenderer.send('cleanup-before-connect'),
  cleanupConnectionListeners: () => ipcRenderer.send('cleanup-connection-listeners'),
  onCleanupBeforeConnect: (callback) => ipcRenderer.on('cleanup-before-connect', callback),
  onCleanupConnectionListeners: (callback) => ipcRenderer.on('cleanup-connection-listeners', callback)

})