// Testa a conversa com o Discord (discord.js) contra um "Discord de mentira" que fala o mesmo protocolo.
// No Windows o Discord usa um pipe com nome fixo, então este teste só roda em Linux/macOS.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'butshare-discord-'));
process.env.XDG_RUNTIME_DIR = pasta;   // discord.js procura o canal do Discord aqui
const discord = require('../discord');
const espera = ms => new Promise(r => setTimeout(r, ms));

function discordFalso(recebido) {
  return net.createServer(s => {
    let buf = Buffer.alloc(0);
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8) {
        const op = buf.readInt32LE(0), tam = buf.readInt32LE(4);
        if (buf.length < 8 + tam) break;
        const msg = JSON.parse(buf.subarray(8, 8 + tam));
        buf = buf.subarray(8 + tam);
        recebido.push({ op, msg });
        if (op === 0) {   // handshake -> READY
          const j = Buffer.from(JSON.stringify({ cmd: 'DISPATCH', evt: 'READY', data: { v: 1 } }));
          const c = Buffer.alloc(8);
          c.writeInt32LE(1, 0);
          c.writeInt32LE(j.length, 4);
          s.write(Buffer.concat([c, j]));
        }
      }
    });
  }).listen(path.join(pasta, 'discord-ipc-0'));
}

test('Discord fechado não quebra; aberto recebe o status; null limpa', { skip: process.platform === 'win32' }, async () => {
  const recebido = [];
  discord.definir({ details: 'x' });   // Discord ainda fechado
  await espera(200);
  assert.strictEqual(recebido.length, 0);

  const servidor = discordFalso(recebido);
  await espera(100);
  const atividade = { details: 'Compartilhando a tela', state: '2 assistindo' };
  discord.definir(atividade);
  await espera(300);
  discord.definir(null);
  await espera(200);

  const handshake = recebido.find(x => x.op === 0);
  assert.strictEqual(handshake.msg.client_id, '1567021588866531458');
  const comandos = recebido.filter(x => x.msg.cmd === 'SET_ACTIVITY');
  assert.deepStrictEqual(comandos[0].msg.args.activity, atividade);
  assert.strictEqual(comandos.at(-1).msg.args.activity, undefined, 'null devia limpar o status');
  servidor.close();
  process.exit(0);   // fecha a conexão que o discord.js mantém aberta
});
