// Processo principal do app KP-TELA (Electron).
const { app, BrowserWindow, desktopCapturer, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let cap = null;

function pararAudio() {
  if (cap) { cap.kill(); cap = null; }
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    title: 'KP-TELA',
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
  // Links (ex.: o link da sala) abrem no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// Telas e janelas para o seletor, com miniatura
ipcMain.handle('fontes', async () => {
  const fontes = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
  return fontes
    .filter(f => f.name !== 'KP-TELA')
    .map(f => ({ id: f.id, nome: f.name, tela: f.id.startsWith('screen:'), thumb: f.thumbnail.toDataURL() }));
});

// Áudio do PC sem o Discord: o audiocap.exe escreve PCM 16-bit 48 kHz estéreo no stdout
ipcMain.handle('audio-iniciar', (e) => {
  pararAudio();
  const exe = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, 'audiocap'), 'audiocap.exe');
  const proc = spawn(exe, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  cap = proc;
  let resto = Buffer.alloc(0);
  proc.stdout.on('data', d => {
    const b = Buffer.concat([resto, d]);
    const n = b.length - (b.length % 4);   // só frames inteiros (4 bytes = L+R de 16 bits)
    resto = b.subarray(n);
    if (n && !e.sender.isDestroyed()) e.sender.send('audio', b.subarray(0, n));
  });
  proc.stderr.on('data', d => console.log(String(d).trim()));
  const erro = msg => { if (cap === proc && !e.sender.isDestroyed()) e.sender.send('audio-erro', msg); };
  proc.on('error', err => erro(err.message));
  proc.on('exit', code => { if (code) erro('captura de áudio parou (código ' + code + ')'); });
});
ipcMain.handle('audio-parar', pararAudio);

app.whenReady().then(criarJanela);
app.on('window-all-closed', () => { pararAudio(); app.quit(); });
