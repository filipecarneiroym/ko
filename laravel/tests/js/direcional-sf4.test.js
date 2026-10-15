const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const K = require('../../../public/js/ko-sim.js');
const fonte = fs.readFileSync(path.resolve(__dirname, '../../../public/js/ko.js'), 'utf8');
test('dois toques para trás continuam acionando recuo nos dois lados', () => {
  for (const lado of [0, 1]) {
    const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta';
    const tras = s.p[lado].face > 0 ? K.B.L : K.B.R;
    for (const bits of [tras, 0, tras]) { const e = [0, 0]; e[lado] = bits; K.passo(s, e); }
    assert.equal(s.p[lado].estado, 'recuo');
  }
});
test('uma direção para trás no controle não vira recuo automático', () => {
  const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta';
  const c = { B: K.B, pads: { atualizar: () => [{ conectado: true, mapeado: true, eixoX: -1, bits: K.B.L, pulso: K.B.L }, {}] },
    estadosPads: [], pulsosPads: [0, 0], petelecoPad: [{ desde: 0, feito: false }, {}], usandoControle: false,
    performance: { now: () => 100 }, versus: false, meuLado: 0, luta: { s },
    document: { body: { classList: { toggle() {} } }, querySelector: () => null },
  };
  vm.createContext(c); vm.runInContext(fonte.slice(fonte.indexOf('  function atualizarPads()'), fonte.indexOf('  A.iniciar(canvas);')), c);
  c.atualizarPads(); K.passo(s, [c.estadosPads[0].bits | c.pulsosPads[0], 0]);
  assert.equal(s.p[0].estado, 'andando'); assert.equal(c.pulsosPads[0] & K.B.RC, 0);
});
test('toque direto na borda para trás permite andar e defender sem recuo automático', () => {
  const c = { B: K.B, dedoDir: null, bitsDir: 0, bitsPulso: 0, saiuDoCentro: 0, petelecoFeito: false,
    performance: { now: () => 100 }, bitTras: () => K.B.L,
    direcional: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }), style: { setProperty() {} }, dataset: {} } };
  vm.createContext(c); vm.runInContext(fonte.slice(fonte.indexOf('  function atualizarDirecional('), fonte.indexOf('  // Botões:')), c);
  c.atualizarDirecional(0, 100); assert.equal(c.bitsDir, K.B.L); assert.equal(c.bitsPulso & K.B.RC, 0);
});
