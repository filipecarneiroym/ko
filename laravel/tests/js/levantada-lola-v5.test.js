const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');

for (const cor of ['azul', 'vermelha']) test(`queda e levantada ${cor}: apoios, arco, repouso e piso`, async t => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }, { Vector3 }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
    import('@babylonjs/core/Maths/math.vector.js'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine);
  const b = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`));
  const modelo = await carregarModelo(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), 'pipoca', K, scene);
  let minimo = Infinity;
  const pos = nome => {
    const no = modelo.osso(nome), cadeia = []; for (let n = no; n; n = n.parent) cadeia.unshift(n);
    for (const n of cadeia) n.computeWorldMatrix(true);
    return no.getAbsolutePosition().clone();
  };
  try {
    for (const face of [1, -1]) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }), l = s.p[0];
      Object.assign(l, { face, x: K.LARGURA / 2 * K.U, y: 0 });
      const pose = (estado, q) => {
        Object.assign(l, { estado, golpe: null, t: q });
        const antes = JSON.stringify(s); modelo.atualizar(descreverPose(l, K, s));
        assert.equal(JSON.stringify(s), antes);
      };
      pose('caido', 46); const emenda = ['quadril', 'cabeca', 'mao_E', 'mao_D', 'pe_E', 'pe_D'].map(pos);
      const quadrilDeitado = pos('quadril').y;
      pose('levantando', 0);
      for (const [i, nome] of ['quadril', 'cabeca', 'mao_E', 'mao_D', 'pe_E', 'pe_D'].entries())
        assert.ok(Vector3.Distance(pos(nome), emenda[i]) < .015, 'emenda queda/levantada sem salto');
      for (const q of [3, 5]) {
        pose('levantando', q);
        for (const lado of ['E', 'D']) {
          assert.ok(pos(`mao_${lado}`).y > .08 && pos(`mao_${lado}`).y < .30, 'mãos apoiadas perto do piso');
          assert.ok(Math.abs(pos(`mao_${lado}`).x - pos('cabeca').x) < .2, 'luvas por baixo das orelhas, junto da cabeça');
          assert.ok(pos(`pe_${lado}`).y > pos('quadril').y + .35, 'pernas recolhem antes do impulso');
        }
      }
      pose('levantando', 10);
      assert.ok(pos('quadril').y > quadrilDeitado + .65, 'quadril percorre o arco de recuperação');
      assert.ok((pos('quadril').x - pos('cabeca').x) * face > .35, 'peito inclinado para trás durante o arco, sem endireitar cedo');
      assert.ok(pos('pe_E').y > .35 && pos('pe_D').y > .35, 'fase aérea depois do impulso dos braços');
      pose('levantando', 24); const pouso = pos('quadril');
      pose('levantando', 28); const acomodacao = pos('quadril');
      pose('levantando', 32);
      assert.ok(Vector3.Distance(pouso, acomodacao) > .01 && Vector3.Distance(acomodacao, pos('quadril')) > .01,
        'acomodação continua depois do pouso, sem congelar a guarda na metade da levantada');
      pose('levantando', 40); const guarda = pos('quadril');
      pose('parado', 0); assert.ok(Vector3.Distance(pos('quadril'), guarda) < .01, 'termina na guarda');
      pose('derrotado', 60);
      assert.ok(pos('cabeca').y < .6 && pos('quadril').y < .5, 'derrota fica deitada');
      for (const lado of ['E', 'D'])
        assert.ok(Math.abs(pos(`mao_${lado}`).x - pos('cabeca').x) < .2, 'no K.O. luvas ficam junto da cabeça');
      for (const lado of ['E', 'D']) {
        const joelho = pos(`canela_${lado}`), coxa = pos(`coxa_${lado}`).subtract(joelho).normalize(), pe = pos(`pe_${lado}`).subtract(joelho).normalize();
        assert.ok(Vector3.Dot(coxa, pe) < -.75, 'pernas relaxadas sem joelhos presos sobre o corpo');
      }
      for (const [estado, dur] of [['caido', 46], ['levantando', 40], ['derrotado', 60]]) for (let q = 0; q <= dur; q += 2) {
        pose(estado, q);
        for (const m of modelo.malhas.filter(m => m.skeleton)) {
          m.computeWorldMatrix(true); m.skeleton.prepare(true);
          const p = m.getPositionData(true, false);
          for (let i = 0; i < p.length; i += 3) {
            const y = Vector3.TransformCoordinates(Vector3.FromArray(p, i), m.getWorldMatrix()).y;
            minimo = Math.min(minimo, y); assert.ok(y >= -.006, `${estado} q${q}: pele abaixo do piso: ${y}`);
          }
        }
      }
    }
    t.diagnostic(`Menor altura da pele: ${(minimo * 1000).toFixed(3)} mm`);
  } finally { modelo.descartar(); scene.dispose(); engine.dispose(); }
});
