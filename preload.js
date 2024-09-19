const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    receivePort: (callback) => ipcRenderer.on('server-port', (_, port) => callback(port))
});