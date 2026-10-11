const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');
const V = require('../../../public/js/ko-voz.js');

test('todo lutador tem voz e frases próprias para especial, super e final', () => {
  assert.deepEqual(Object.keys(V.PERFIS).sort(), Object.keys(K.LUTADORES).sort());
  for (const tipo of ['esp', 'sup', 'final']) {
    const frases = Object.values(V.PERFIS).map((p) => p[tipo]);
    assert.equal(new Set(frases).size, frases.length);
    assert.ok(frases.every((f) => typeof f === 'string' && f.length > 0));
  }
});

test('soco gera evento de voz no início do golpe, não a cada quadro', () => {
  const s = K.novo({ lutadores: ['pipoca', 'uivo'] });
  s.fase = 'luta';
  K.passo(s, [K.B.P, 0]);
  assert.equal(s.ev.filter((e) => e.t === 'ataque' && e.id === 'pipoca').length, 1);
  K.passo(s, [K.B.P, 0]);
  assert.equal(s.ev.filter((e) => e.t === 'ataque').length, 0);
});
