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

test('gritos da Lola têm arquivos locais distintos de ataque, dano e salto', () => {
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  const pasta = path.resolve(__dirname, '../../../public/audio/lola');
  const producao = JSON.parse(fs.readFileSync(path.join(pasta, 'producao.json')));
  assert.equal(producao.licenca, 'CC0-1.0');
  for (const nome of Object.keys(V.AMOSTRAS_LOLA)) {
    const r = producao.gritos[nome], bytes = fs.readFileSync(path.join(pasta, r.arquivo));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), r.sha256);
    assert.ok(r.duracao > .08 && r.duracao < .5 && r.pico < .9);
  }
  assert.equal(V.amostraDoEvento({ t: 'acerto' }, 0), 'dano-1');
  assert.equal(V.amostraDoEvento({ t: 'pulo' }, 1), 'salto-2');
  assert.equal(V.amostraDoEvento({ t: 'ultra' }, 0), 'ataque-3');
  assert.equal(V.amostraDoEvento({ t: 'focusSolto', golpe: 'foc' }, 0), 'ataque-3');
});
