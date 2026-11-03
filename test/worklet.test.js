// Testa o conversor de áudio (worklet) que fica dentro do index.html.
// Ele recebe PCM 16-bit estéreo do audiocap.exe e entrega som para a transmissão.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function carregarWorklet() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const codigo = html.match(/const WORKLET = `([\s\S]*?)`;/)[1];
  let Classe;
  const ctx = {
    AudioWorkletProcessor: class { constructor() { this.port = {}; } },
    registerProcessor: (_nome, C) => { Classe = C; }
  };
  new Function('AudioWorkletProcessor', 'registerProcessor', codigo)(ctx.AudioWorkletProcessor, ctx.registerProcessor);
  return new Classe();
}

// n frames estéreo: esquerda = +0.5, direita = -0.5
const pcm = n => {
  const a = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) { a[2 * i] = 16384; a[2 * i + 1] = -16384; }
  return a.buffer;
};
const bloco = () => [[new Float32Array(128), new Float32Array(128)]];

test('sem dados, sai silêncio', () => {
  const p = carregarWorklet();
  const o = bloco();
  p.process([], o);
  assert.ok(o[0][0].every(x => x === 0));
});

test('espera juntar 40 ms antes de tocar, depois toca esquerda e direita certas', () => {
  const p = carregarWorklet();
  p.port.onmessage({ data: pcm(960) });   // 20 ms
  let o = bloco();
  p.process([], o);
  assert.ok(o[0][0].every(x => x === 0), 'com 20 ms ainda devia esperar');
  p.port.onmessage({ data: pcm(960) });   // 40 ms
  o = bloco();
  p.process([], o);
  assert.strictEqual(o[0][0][0], 0.5);
  assert.strictEqual(o[0][1][0], -0.5);
});

test('nunca acumula mais que ~200 ms de atraso', () => {
  const p = carregarWorklet();
  for (let i = 0; i < 100; i++) p.port.onmessage({ data: pcm(960) });
  assert.ok(p.n <= 19200, 'atraso acumulado: ' + p.n);
});
