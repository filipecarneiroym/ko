const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
for (const cor of ['azul', 'vermelha']) test(`salto real ${cor}: arco, abertura e pele acima do chão`, async t => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }, { Vector3 }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'), import('@babylonjs/core/Maths/math.vector.js'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine);
  const b = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`));
  const modelo = await carregarModelo(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), 'pipoca', K, scene);
  let minimo = Infinity;
  try {
    for (const lado of [0, 1]) for (const sentido of [-1, 0, 1]) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta';
      const l = s.p[lado]; l.x = 192 * K.U; s.p[1 - lado].x = (lado ? 30 : 350) * K.U;
      const fr = l.face > 0 ? K.B.R : K.B.L, tr = l.face > 0 ? K.B.L : K.B.R;
      for (let q = 0; q < 45; q++) {
        const entradas = [0, 0]; entradas[lado] = q === 0 ? K.B.U | (sentido > 0 ? fr : sentido < 0 ? tr : 0) : 0;
        K.passo(s, entradas); const antes = JSON.stringify(s);
        modelo.atualizar(descreverPose(l, K, s)); assert.equal(JSON.stringify(s), antes);
        for (const m of modelo.malhas.filter(m => m.skeleton)) {
          m.computeWorldMatrix(true); m.skeleton.prepare(true); const p = m.getPositionData(true, false);
          for (let i = 0; i < p.length; i += 3) {
            const y = Vector3.TransformCoordinates(Vector3.FromArray(p, i), m.getWorldMatrix()).y;
            minimo = Math.min(minimo, y);
            assert.ok(y >= -.006, `lado ${lado}, sentido ${sentido}, q${q}: pele ${y}`);
          }
        }
      }
      assert.equal(l.y, 0); assert.equal(l.estado, 'parado');
    }
    t.diagnostic(`Menor altura da pele: ${(minimo * 1000).toFixed(3)} mm`);
  } finally { modelo.descartar(); scene.dispose(); engine.dispose(); }
});
