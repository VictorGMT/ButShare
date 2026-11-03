// Ponte segura entre a página e o app. A página só existe no modo app quando window.kp existe.
const { contextBridge, ipcRenderer } = require('electron');

let aoReceber = null;
ipcRenderer.on('audio', (_, chunk) => aoReceber && aoReceber(chunk));

contextBridge.exposeInMainWorld('kp', {
  fontes: () => ipcRenderer.invoke('fontes'),
  audioIniciar: (cb, aoErro) => {
    aoReceber = cb;
    ipcRenderer.removeAllListeners('audio-erro');
    ipcRenderer.on('audio-erro', (_, msg) => aoErro(msg));
    return ipcRenderer.invoke('audio-iniciar');
  },
  audioParar: () => { aoReceber = null; return ipcRenderer.invoke('audio-parar'); }
});
