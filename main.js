// Processo principal do app ButShare (Electron).
const { app, BrowserWindow, desktopCapturer, ipcMain, shell, session } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const discord = require('./discord');

// A interface vem do site: o que for publicado no GitHub chega pra todo mundo ao abrir o app.
// Sem internet (ou site fora do ar), usa a cópia que vai dentro do .exe.
const SITE = 'https://victorgmt.github.io/tela/';

// Pede ao Windows para não desenhar a borda amarela em volta da tela capturada (vale no Windows 11)
app.commandLine.appendSwitch('disable-features', 'WebRtcWgcRequireBorder');

let cap = null;

function pararAudio() {
  if (cap) { cap.kill(); cap = null; }
}

// ---------- Segurança ----------
// A página vem da internet, então o app só libera o que o ButShare usa.
// Microfone, câmera, localização, notificações e o resto são sempre negados.
const PERMITIDAS = new Set(['clipboard-sanitized-write']);   // botão "Copiar link"
function origemNossa(url) {
  try { const u = new URL(url); return u.protocol === 'file:' || u.origin === new URL(SITE).origin; }
  catch { return false; }
}
// Só links https saem para o navegador; outros tipos (file:, protocolos do Windows) podem rodar programas
const abrirFora = url => { if (/^https:\/\//i.test(url)) shell.openExternal(url); };

// Captura de tela. O Electron não diferencia os pedidos de captura uns dos outros, então o próprio app decide:
// só captura logo depois que a pessoa clicou (de verdade) numa tela/janela do seletor, e uma vez por clique.
// Uma página adulterada não consegue simular esse clique, então não captura a tela escondida.
let ultimasFontes = new Map();   // id -> tela/janela listada no seletor
let ultimaInteracao = 0;         // último clique ou tecla real da pessoa na janela (o app vê isso direto)
let fonteEscolhida = null;       // { fonte, quando }: a tela/janela clicada no seletor
let permissaoCaptura = 0;        // momento da escolha; libera UM pedido de captura
const VALE_MS = 5000;            // a escolha vale por 5 s, para uma captura
// Miniaturas das janelas, escolha de fonte e áudio do PC só funcionam logo depois de um clique/tecla real
const interagiuAgora = () => Date.now() - ultimaInteracao < VALE_MS;

function travarPermissoes(ses) {
  ses.setPermissionRequestHandler((_wc, perm, cb, det) => {
    if (perm === 'display-capture') {
      const ok = permissaoCaptura && Date.now() - permissaoCaptura < VALE_MS && origemNossa(det.requestingUrl);
      permissaoCaptura = 0;   // uma permissão por escolha
      return cb(!!ok);
    }
    cb(PERMITIDAS.has(perm) && origemNossa(det.requestingUrl));
  });
  ses.setPermissionCheckHandler((_wc, perm, origem) => PERMITIDAS.has(perm) && origemNossa(origem));
  ses.setDisplayMediaRequestHandler((req, cb) => {
    const f = fonteEscolhida;
    fonteEscolhida = null;   // uma captura por escolha
    if (!f || !req.userGesture || Date.now() - f.quando > VALE_MS || !origemNossa(req.securityOrigin)) return cb(null);
    cb({ video: f.fonte });
  });
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    title: 'ButShare',
    icon: path.join(__dirname, 'logo.png'),
    backgroundColor: '#110a0c',
    autoHideMenuBar: true,
    // Já são o padrão do Electron; ficam escritos para não sumirem se o padrão mudar
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.loadURL(SITE, { extraHeaders: 'Cache-Control: no-cache\n' });
  win.webContents.on('did-fail-load', (_e, codigo, _desc, url, principal) => {
    if (principal && codigo !== -3 && url.startsWith(SITE)) win.loadFile('index.html');  // -3 = navegação cancelada
  });
  // A janela só mostra o próprio site; qualquer outro link abre no navegador padrão
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(SITE)) { e.preventDefault(); abrirFora(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { abrirFora(url); return { action: 'deny' }; });
  win.webContents.on('input-event', (_e, i) => {
    if (i.type === 'mouseDown' || i.type === 'keyDown' || i.type === 'rawKeyDown') ultimaInteracao = Date.now();
  });
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
  if (!interagiuAgora()) return [];
  const propria = BrowserWindow.fromWebContents(e.sender)?.getMediaSourceId();
  const fontes = (await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } }))
    .filter(f => f.id !== propria);   // não mostra a própria janela do app
  ultimasFontes = new Map(fontes.map(f => [f.id, f]));
  // JPEG em vez de PNG: miniatura 5 a 10 vezes menor, o seletor abre mais rápido
  return fontes.map(f => ({ id: f.id, nome: f.name, tela: f.id.startsWith('screen:'), thumb: 'data:image/jpeg;base64,' + f.thumbnail.toJPEG(70).toString('base64') }));
});
// A pessoa clicou numa tela/janela do seletor: ela vale para a próxima captura
ipcMain.handle('usar-fonte', (_e, id) => {
  const fonte = ultimasFontes.get(id);
  fonteEscolhida = fonte && interagiuAgora() ? { fonte, quando: Date.now() } : null;
  permissaoCaptura = fonteEscolhida ? fonteEscolhida.quando : 0;
  return !!fonteEscolhida;
});

// Áudio do PC sem o Discord: o audiocap.exe escreve PCM 16-bit 48 kHz estéreo no stdout
ipcMain.handle('audio-iniciar', (e) => {
  if (!interagiuAgora()) throw new Error('áudio só começa junto com um compartilhamento escolhido por clique');
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

// Status no Discord. Sem o link da sala: o status é público para quem vê o perfil,
// então o link só vai por onde a pessoa escolher (ex.: o chat da call).
ipcMain.handle('discord', (_e, d) => {
  const n = d ? Math.max(0, d.assistindo | 0) : 0;
  discord.definir(d ? {
    details: 'Compartilhando a tela',
    state: n === 0 ? 'Esperando a galera' : `${n} assistindo`,
    timestamps: { start: Number(d.inicio) || Date.now() },
    assets: { large_image: 'logo', large_text: 'ButShare' }
  } : null);
});

app.whenReady().then(() => {
  travarPermissoes(session.defaultSession);
  criarJanela();
});
app.on('window-all-closed', () => { pararAudio(); app.quit(); });
