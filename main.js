// Processo principal do app ButShare (Electron).
const { app, BrowserWindow, desktopCapturer, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// A interface vem do site: o que for publicado no GitHub chega pra todo mundo ao abrir o app.
// Sem internet (ou site fora do ar), usa a cópia que vai dentro do .exe.
const SITE = 'https://victorgmt.github.io/tela/';

// Pede ao Windows para não desenhar a borda amarela em volta da tela capturada (vale no Windows 11)
app.commandLine.appendSwitch('disable-features', 'WebRtcWgcRequireBorder');

let cap = null;

function pararAudio() {
  if (cap) { cap.kill(); cap = null; }
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    title: 'ButShare',
    icon: path.join(__dirname, 'logo.png'),
    backgroundColor: '#110a0c',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadURL(SITE, { extraHeaders: 'Cache-Control: no-cache\n' });
  win.webContents.on('did-fail-load', (_e, codigo, _desc, url, principal) => {
    if (principal && codigo !== -3 && url.startsWith(SITE)) win.loadFile('index.html');  // -3 = navegação cancelada
  });
  // A janela só mostra o próprio site; qualquer outro link abre no navegador padrão
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(SITE)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  verificarUpdate(win);
}

// Atualização do app: procura versão nova nos Releases do GitHub e avisa a página (que mostra o pop-up)
let baixandoUpdate = false;
function verificarUpdate(win) {
  if (!app.isPackaged) return;
  const avisar = d => { if (!win.isDestroyed()) win.webContents.send('update', { ...d, atual: app.getVersion() }); };
  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', info => avisar({ estado: 'disponivel', versao: info.version }));
  autoUpdater.on('download-progress', p => avisar({ estado: 'baixando', pct: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(true, true));  // instala calado e reabre
  // Erro na verificação (ex.: sem internet) fica quieto; só avisa se a pessoa clicou em Atualizar
  autoUpdater.on('error', err => { if (baixandoUpdate) { baixandoUpdate = false; avisar({ estado: 'erro', msg: err.message }); } });
  win.webContents.once('did-finish-load', () => autoUpdater.checkForUpdates().catch(() => {}));
}
ipcMain.handle('update-baixar', () => {
  baixandoUpdate = true;
  autoUpdater.downloadUpdate().catch(() => {});
});

// Telas e janelas para o seletor, com miniatura
ipcMain.handle('fontes', async (e) => {
  const propria = BrowserWindow.fromWebContents(e.sender)?.getMediaSourceId();
  const fontes = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
  return fontes
    .filter(f => f.id !== propria)   // não mostra a própria janela do app
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
