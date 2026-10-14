const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');

for (const cor of ['azul', 'vermelha']) test(`chutes Lola ${cor}: pé dentro da caixa ativa, nas duas faces`, async () => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine);
  const bytes = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`));
  const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
  try {
    for (const golpe of ['k1', 'k2', 'ck', 'ak']) for (const face of [1, -1]) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }), l = s.p[0];
      Object.assign(l, { estado: 'golpe', golpe, face, y: golpe === 'ak' ? 48 * K.U : 0 });
      for (const [i, janela] of K.LUTADORES.pipoca.golpes[golpe].janelas.entries()) {
        for (let t = janela.de; t <= janela.ate; t++) {
          l.t = t;
          const antes = JSON.stringify(s);
          modelo.atualizar(descreverPose(l, K, s));
          assert.equal(JSON.stringify(s), antes, 'pose não muda a simulação');
          const no = modelo.osso(golpe === 'k1' && i === 1 ? 'pe_D' : 'pe_E'), cadeia = [];
          for (let n = no; n; n = n.parent) cadeia.unshift(n);
          for (const n of cadeia) n.computeWorldMatrix(true);
          const p = no.getAbsolutePosition(), caixa = K.caixaHit(l, janela.caixa);
          const x = (caixa.x / K.U - K.LARGURA / 2) / 24, y = caixa.y / K.U / 24;
          assert.ok(p.x >= x - .08 && p.x <= x + caixa.w / K.U / 24 + .08
            && p.y >= y - .08 && p.y <= y + caixa.h / K.U / 24 + .08,
            `${golpe} q${t}, face ${face}: pé ${p.asArray()}, caixa ${[x, y, caixa.w / K.U / 24, caixa.h / K.U / 24]}`);
        }
      }
    }
  } finally { modelo.descartar(); scene.dispose(); engine.dispose(); }
});
