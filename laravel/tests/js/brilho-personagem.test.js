const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');
const modulos = import('../../../src/3d/brilho-personagem.mjs');
test('chamas: subida e EX quentes, Focus máximo azul, sem fogo em soco comum', async () => {
  const { descreverChamasPersonagem: fogo } = await modulos;
  const s = estado(), l = s.p[0]; Object.assign(l, { estado: 'golpe', golpe: 'p1', t: 5 });
  assert.equal(fogo(l, s, K), null);
  for (const golpe of ['dp', 'dpEx', 'espEx', 'tatsuEx']) {
    l.golpe = golpe; l.t = 12; assert.ok(fogo(l, s, K).taxa > 0);
    assert.equal(fogo(l, s, K, true), null);
  }
  Object.assign(l, { golpe: 'foc', t: 0, focoCarga: 47, focoSolto: 0 }); assert.equal(fogo(l, s, K), null);
  l.focoCarga = 48; assert.equal(fogo(l, s, K).tipo, 'focus');
  Object.assign(l, { focoSolto: 1, nivelFoco: 3, t: 15 }); assert.equal(fogo(l, s, K).tipo, 'focus');
  l.t = 23; assert.equal(fogo(l, s, K), null); l.estado = 'parado'; assert.equal(fogo(l, s, K), null);
});
function estado() { const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta'; return s; }
test('Focus pisca na carga de nível 2 e no máximo, sem brilho contínuo com Super cheio', async () => {
  const { descreverBrilhoPersonagem: brilho } = await modulos;
  for (const lado of [0, 1]) {
    const s = estado(), l = s.p[lado]; l.poder = K.PODER_MAX;
    assert.equal(brilho(l, s, K).tipo, '');
    const flashes = [], solturas = [];
    for (let q = 0; q < 95; q++) {
      const entrada = [0, 0]; entrada[lado] = K.B.F;
      K.passo(s, entrada);
      const antes = JSON.stringify(s), efeito = brilho(l, s, K);
      assert.equal(JSON.stringify(s), antes, 'brilho não altera motor');
      if (efeito.tipo === 'focus') flashes.push({ carga: l.focoCarga, solto: l.focoSolto, alfa: efeito.alfa });
      solturas.push(...s.ev.filter(e => e.t === 'focusSolto'));
      if (efeito.tipo) assert.equal(brilho(l, s, K, true).tipo, '', 'reduzir movimento remove clarões');
    }
    assert.ok(flashes.some(f => f.carga === 24 && !f.solto));
    assert.ok(flashes.some(f => f.carga === 60 && f.solto && f.alfa > .9));
    assert.equal(solturas.length, 1, 'uma soltura automática gera uma única voz');
    assert.equal(brilho(l, s, K).tipo, '');
  }
});
test('EX é dourado, Super é azul, Ultra é quente; morte e ocultação apagam', async () => {
  const { descreverBrilhoPersonagem: brilho } = await modulos;
  const s = estado(), l = s.p[0]; l.estado = 'golpe'; l.t = 3;
  for (const golpe of ['espEx', 'dpEx', 'tatsuEx', 'sup', 'ultra']) {
    l.golpe = golpe;
    const e = brilho(l, s, K);
    assert.ok(e.alfa > 0 && e.alfa < 1);
    if (golpe.endsWith('Ex')) assert.equal(e.tipo, 'ex');
    s.fase = 'fim'; assert.equal(brilho(l, s, K).tipo, ''); s.fase = 'luta';
    l.sumido = 1; assert.equal(brilho(l, s, K).tipo, ''); l.sumido = 0;
  }
});
test('tinta do corpo restaura overlays e material compartilhado ao limpar/descartar', async () => {
  const [{ criarBrilhoPersonagem }, { NullEngine }, { Scene }, { MeshBuilder }, { StandardMaterial }, { Color3 }] = await Promise.all([
    modulos, import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('@babylonjs/core/Meshes/meshBuilder.js'), import('@babylonjs/core/Materials/standardMaterial.js'), import('@babylonjs/core/Maths/math.color.js'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine), registradas = new Set();
  const glow = { addIncludedOnlyMesh: m => registradas.add(m), removeIncludedOnlyMesh: m => registradas.delete(m), setEffectIntensity() {} };
  const mat = new StandardMaterial('pele', scene); mat.emissiveColor = new Color3(.01, .02, .03);
  const malhas = [0, 1].map(i => { const m = MeshBuilder.CreateBox(`corpo${i}`, {}, scene); m.material = mat; return m; });
  const antes = malhas.map(m => ({ cor: m.overlayColor.asArray(), alfa: m.overlayAlpha, ativo: m.renderOverlay }));
  const brilho = criarBrilhoPersonagem(Color3, glow);
  brilho.atualizar({ malhas }, { tipo: 'focus', cor: [1, 1, 1], alfa: .94, emissao: .65 });
  assert.ok(malhas.every(m => m.renderOverlay && m.overlayAlpha === .94));
  brilho.limpar();
  assert.deepEqual(malhas.map(m => ({ cor: m.overlayColor.asArray(), alfa: m.overlayAlpha, ativo: m.renderOverlay })), antes);
  assert.deepEqual(mat.emissiveColor.asArray(), [.01, .02, .03]);
  brilho.descartar(); assert.equal(registradas.size, 0);
  scene.dispose(); engine.dispose();
});
