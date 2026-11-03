// Áudio do PC sem o Discord no Linux (PipeWire). Faz o mesmo que o audiocap.exe no Windows:
// o pw-record escreve PCM 16-bit 48 kHz estéreo no stdout, e este módulo liga nele a saída
// de cada programa tocando som, menos o Discord. Precisa de PipeWire (padrão nas distros atuais).
const { spawn, execFile } = require('child_process');

const NOME = 'butshare-audio';
const DISCORD = /discord|vesktop|webcord|armcord|legcord/i;

// Do JSON do pw-dump, os pares [porta de saída, porta de entrada] que faltam ligar
function ligacoesFaltando(dump) {
  const props = o => o.info?.props || {};
  const nos = dump.filter(o => o.type === 'PipeWire:Interface:Node');
  const meu = nos.find(o => props(o)['node.name'] === NOME);
  if (!meu) return [];
  const apps = new Set(nos.filter(o => {
    const p = props(o);
    return p['media.class'] === 'Stream/Output/Audio' &&
      !DISCORD.test(p['application.process.binary'] || '') && !DISCORD.test(p['application.name'] || '');
  }).map(o => o.id));
  const portas = dump.filter(o => o.type === 'PipeWire:Interface:Port');
  const entrada = {};
  for (const o of portas) {
    const p = props(o);
    if (p['node.id'] === meu.id && p['port.direction'] === 'in') entrada[p['audio.channel']] = o.id;
  }
  const ja = new Set(dump.filter(o => o.type === 'PipeWire:Interface:Link')
    .map(o => o.info['output-port-id'] + '>' + o.info['input-port-id']));
  const pares = [];
  for (const o of portas) {
    const p = props(o);
    if (!apps.has(p['node.id']) || p['port.direction'] !== 'out' || p['port.monitor']) continue;
    const ch = p['audio.channel'] || '';
    // FL/RL/SL vão pra esquerda, FR/RR/SR pra direita, o resto (MONO, centro, LFE) pras duas
    const lados = /^[RS]?L$|^FL$/.test(ch) ? ['FL'] : /^[RS]?R$|^FR$/.test(ch) ? ['FR'] : ['FL', 'FR'];
    for (const l of lados) if (entrada[l] && !ja.has(o.id + '>' + entrada[l])) pares.push([o.id, entrada[l]]);
  }
  return pares;
}

// Devolve o processo do pw-record (stdout = PCM). Matar o processo desfaz as ligações.
function iniciar() {
  const proc = spawn('pw-record', ['--target', '0', '--raw', '--format', 's16', '--rate', '48000', '--channels', '2',
    '--latency', '20ms', '-P', `{ node.name = "${NOME}" }`, '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
  // ponytail: confere o grafo a cada 1 s; programa que começa a tocar entra com até 1 s de atraso.
  // Se incomodar, trocar por `pw-dump --monitor`.
  const ligar = () => execFile('pw-dump', { maxBuffer: 64 << 20 }, (err, out) => {
    if (err || proc.exitCode !== null) return;
    let dump; try { dump = JSON.parse(out); } catch { return; }
    for (const [o, i] of ligacoesFaltando(dump)) execFile('pw-link', [String(o), String(i)], () => {});
  });
  const t = setInterval(ligar, 1000);
  proc.once('spawn', ligar);
  proc.once('exit', () => clearInterval(t));
  proc.once('error', () => clearInterval(t));
  return proc;
}

module.exports = { iniciar, ligacoesFaltando };
