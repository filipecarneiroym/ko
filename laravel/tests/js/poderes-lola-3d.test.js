const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
  import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
  import('@babylonjs/core/Maths/math.vector.js'),
]);
for (const cor of ['azul', 'vermelha']) test(`poderes v5 ${cor}: clipes próprios, duração, pele acima do piso e estado preservado`, async t => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }, { Vector3 }] = await modulos;
  const bytes = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`));
  const doc = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const engine = new NullEngine(), scene = new Scene(engine);
  const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
  let minY = Infinity, erroLancamento = 0;
  try {
    const B = K.B, comandos = { esp: B.S, dp: B.S | B.R, tatsu: B.S | B.L, espEx: B.S | B.P,
      dpEx: B.S | B.R | B.P, tatsuEx: B.S | B.L | B.P, ultra: B.S | B.F, foc: B.F };
    for (const [nome, comando] of Object.entries(comandos)) for (const face of [1, -1]) {
      assert.ok(doc.animations.some(a => a.name === nome), `clipe ${nome} incorporado`);
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta'; s.fT = 0;
      s.p[0].x = (face === 1 ? 80 : 300) * K.U; s.p[1].x = (face === 1 ? 300 : 80) * K.U;
      s.p[0].face = face; s.p[1].face = -face;
      s.p[0].poder = K.PODER_MAX; s.p[0].revanche = K.ULTRA_MAX;
      const bits = face === 1 ? comando : (comando & ~(B.R | B.L)) | (comando & B.R ? B.L : 0) | (comando & B.L ? B.R : 0);
      K.passo(s, [bits, 0]);
      for (let q = 0; q < 155; q++) {
        const antes = JSON.stringify(s);
        modelo.atualizar(descreverPose(s.p[0], K, s));
        assert.equal(JSON.stringify(s), antes);
        if (nome.startsWith('tatsu') && s.p[0].golpe === nome) for (const janela of K.LUTADORES.pipoca.golpes[nome].janelas) if (s.p[0].t === janela.de) {
          const pe = modelo.osso('pe_E'), cadeia = [];
          for (let n = pe; n; n = n.parent) cadeia.unshift(n);
          for (const n of cadeia) n.computeWorldMatrix(true);
          const p = pe.getAbsolutePosition(), c = K.caixaHit(s.p[0], janela.caixa);
          const x = (c.x / K.U - K.LARGURA / 2) / 24, y = c.y / K.U / 24;
          assert.ok(p.x >= x - .1 && p.x <= x + c.w / K.U / 24 + .1
            && p.y >= y - .1 && p.y <= y + c.h / K.U / 24 + .1,
            `${nome}: contato q${janela.de}, face ${face}, pé ${p.asArray()}, caixa ${[x, y, c.w / K.U / 24, c.h / K.U / 24]}`);
        }
        for (const p of s.proj.filter(p => p.dono === 0 && p.t === 1)) {
          const alturas = ['E', 'D'].map(lado => {
            const no = modelo.osso(`mao_${lado}`), cadeia = [];
            for (let n = no; n; n = n.parent) cadeia.unshift(n);
            for (const n of cadeia) n.computeWorldMatrix(true);
            return no.getAbsolutePosition().y;
          });
          const erro = Math.abs((alturas[0] + alturas[1]) / 2 - p.y / K.U / 24);
          erroLancamento = Math.max(erroLancamento, erro);
          assert.ok(erro < .3, `${nome}: bola nasce na altura das mãos (${erro} m)`);
        }
        for (const osso of scene.skeletons[0].bones) {
          const no = osso.getTransformNode();
          assert.ok([...no.position.asArray(), ...no.rotationQuaternion.asArray()].every(Number.isFinite));
        }
        if (q % 6 === 0) for (const mesh of scene.meshes.filter(m => m.getTotalVertices() && m.skeleton)) {
          mesh.computeWorldMatrix(true); mesh.skeleton.prepare(true);
          const posicoes = mesh.getPositionData(true, false);
          for (let v = 0; v < posicoes.length; v += 3) {
            const y = Vector3.TransformCoordinates(Vector3.FromArray(posicoes, v), mesh.getWorldMatrix()).y;
            minY = Math.min(minY, y);
            assert.ok(y >= -.01, `${nome}, face ${face}, q ${q}: pele abaixo do piso (${y} m)`);
          }
        }
        K.passo(s, [nome === 'foc' && q < 60 ? B.F : 0, 0]);
      }
      assert.equal(s.p[0].y, 0); assert.equal(s.p[0].golpe, null);
    }
    t.diagnostic(`Menor altura da pele: ${(minY * 1000).toFixed(3)} mm; diferença vertical bola/mãos: ${(erroLancamento * 24).toFixed(2)} px`);
  } finally { modelo.descartar(); scene.dispose(); engine.dispose(); }
});
