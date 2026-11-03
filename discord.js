// Status no Discord (Rich Presence) pelo canal local do Discord aberto no PC, sem biblioteca.
// Protocolo: cada mensagem = [op int32][tamanho int32][JSON]. op 0 = handshake, 1 = comando/evento, 2 = fechar, 3/4 = ping/pong.
const net = require('net');
const path = require('path');

const CLIENT_ID = '1567021588866531458';   // aplicativo "ButShare" no Discord Developer Portal

let sock = null, pronto = false, atividade = null, conectando = false;

const caminho = i => process.platform === 'win32'
  ? `\\\\?\\pipe\\discord-ipc-${i}`
  : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', `discord-ipc-${i}`);

function enviar(op, dados) {
  const json = Buffer.from(JSON.stringify(dados));
  const cab = Buffer.alloc(8);
  cab.writeInt32LE(op, 0);
  cab.writeInt32LE(json.length, 4);
  sock.write(Buffer.concat([cab, json]));
}

function aplicar() {
  if (!pronto) return;
  // sem "activity" o Discord limpa o status
  enviar(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: atividade || undefined }, nonce: String(Math.random()) });
}

// O Discord usa o primeiro canal livre entre discord-ipc-0 e discord-ipc-9
function conectar(i = 0) {
  if (sock || (conectando && i === 0)) return;
  conectando = true;
  const s = net.createConnection(caminho(i));
  let buf = Buffer.alloc(0);
  s.once('connect', () => {
    sock = s; conectando = false;
    enviar(0, { v: 1, client_id: CLIENT_ID });
  });
  s.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0), tam = buf.readInt32LE(4);
      if (buf.length < 8 + tam) break;
      let msg = {};
      try { msg = JSON.parse(buf.subarray(8, 8 + tam).toString()); } catch {}
      buf = buf.subarray(8 + tam);
      if (op === 1 && msg.evt === 'READY') { pronto = true; aplicar(); }
      else if (op === 3) enviar(4, msg);   // ping -> pong
      else if (op === 2) s.destroy();      // Discord pediu para fechar (ex.: ID inválido)
    }
  });
  s.on('error', () => {
    if (sock) return;
    if (i < 9) conectar(i + 1); else conectando = false;   // Discord fechado: tenta de novo no próximo update
  });
  s.on('close', () => { if (sock === s) { sock = null; pronto = false; } });
}

// shortcut: se o Discord abrir depois de começar a compartilhar, o status aparece na próxima mudança (ex.: alguém entrar pra assistir)
function definir(nova) {
  atividade = nova;
  if (pronto) aplicar(); else if (nova) conectar();
}

module.exports = { definir };
