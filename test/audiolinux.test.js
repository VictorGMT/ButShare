// Testa quais programas entram no áudio do Linux: todos menos o Discord.
const test = require('node:test');
const assert = require('node:assert');
const { ligacoesFaltando } = require('../audiolinux');

const no = (id, props) => ({ id, type: 'PipeWire:Interface:Node', info: { props } });
const porta = (id, node, dir, ch, extra = {}) =>
  ({ id, type: 'PipeWire:Interface:Port', info: { props: { 'node.id': node, 'port.direction': dir, 'audio.channel': ch, ...extra } } });
const dump = [
  no(1, { 'node.name': 'butshare-audio', 'media.class': 'Stream/Input/Audio' }),
  porta(10, 1, 'in', 'FL'), porta(11, 1, 'in', 'FR'), porta(12, 1, 'out', 'FL', { 'port.monitor': true }),
  no(2, { 'media.class': 'Stream/Output/Audio', 'application.name': 'Firefox', 'application.process.binary': 'firefox' }),
  porta(20, 2, 'out', 'FL'), porta(21, 2, 'out', 'FR'),
  no(3, { 'media.class': 'Stream/Output/Audio', 'application.name': 'WEBRTC VoiceEngine', 'application.process.binary': 'Discord' }),
  porta(30, 3, 'out', 'FL'), porta(31, 3, 'out', 'FR'),
  no(4, { 'media.class': 'Stream/Output/Audio', 'application.name': 'jogo' }),
  porta(40, 4, 'out', 'MONO'),
  no(5, { 'media.class': 'Audio/Sink', 'node.name': 'caixas' }),
  porta(50, 5, 'out', 'FL'),
  { id: 99, type: 'PipeWire:Interface:Link', info: { 'output-port-id': 21, 'input-port-id': 11 } }
];

test('liga os programas, menos o Discord, sem repetir ligação', () => {
  assert.deepStrictEqual(ligacoesFaltando(dump), [[20, 10], [40, 10], [40, 11]]);
});

test('sem o nó do ButShare, não liga nada', () => {
  assert.deepStrictEqual(ligacoesFaltando(dump.slice(4)), []);
});
