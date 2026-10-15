const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');

for (const cor of ['azul', 'vermelha']) test(`chutes Lola ${cor}: pé dentro da caixa ativa, nas duas faces`, async () => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }, { Vector3 }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
    import('@babylonjs/core/Maths/math.vector.js'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine);
  const bytes = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`));
  const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
  try {
    for (const golpe of ['k1', 'k2', 'ck', 'ak']) for (const face of [1, -1]) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }), l = s.p[0];
      Object.assign(l, { estado: 'golpe', golpe, face, y: golpe === 'ak' ? 48 * K.U : 0 });
      for (const janela of K.LUTADORES.pipoca.golpes[golpe].janelas) {
        for (let t = janela.de; t <= janela.ate; t++) {
          l.t = t;
          const antes = JSON.stringify(s);
          modelo.atualizar(descreverPose(l, K, s));
          assert.equal(JSON.stringify(s), antes, 'pose não muda a simulação');
          const no = modelo.osso(golpe === 'k1' && face > 0 ? 'pe_D' : 'pe_E'), cadeia = [];
          for (let n = no; n; n = n.parent) cadeia.unshift(n);
          for (const n of cadeia) n.computeWorldMatrix(true);
          const p = no.getAbsolutePosition(), caixa = K.caixaHit(l, janela.caixa);
          if (golpe === 'k1') {
            const lado = face > 0 ? 'D' : 'E', quadril = modelo.osso(`coxa_${lado}`).getAbsolutePosition(), joelho = modelo.osso(`canela_${lado}`).getAbsolutePosition();
            const extensao = p.subtract(quadril).length() / (joelho.subtract(quadril).length() + p.subtract(joelho).length());
            assert.ok(extensao > .985 && extensao <= 1.00001, 'perna estende no contato, sem hiperextensão, nos dois lados');
            const apoio = modelo.osso(face > 0 ? 'pe_E' : 'pe_D'), pais = [];
            for (let n = apoio; n; n = n.parent) pais.unshift(n);
            for (const n of pais) n.computeWorldMatrix(true);
            assert.ok(p.z < apoio.getAbsolutePosition().z, 'perna que chuta está voltada para a câmera em -Z');
          }
          const x = (caixa.x / K.U - K.LARGURA / 2) / 24, y = caixa.y / K.U / 24;
          assert.ok(p.x >= x - .08 && p.x <= x + caixa.w / K.U / 24 + .08
            && p.y >= y - .08 && p.y <= y + caixa.h / K.U / 24 + .08,
            `${golpe} q${t}, face ${face}: pé ${p.asArray()}, caixa ${[x, y, caixa.w / K.U / 24, caixa.h / K.U / 24]}`);
        }
      }
      if (golpe === 'k1') {
        const direcao = nome => {
          const no = modelo.osso(nome), cadeia = []; for (let n = no; n; n = n.parent) cadeia.unshift(n);
          for (const n of cadeia) n.computeWorldMatrix(true);
          const v = Vector3.TransformNormal(new Vector3(1, 0, 0), no.getWorldMatrix()); v.y = 0; return v.normalize();
        };
        l.t = 0; modelo.atualizar(descreverPose(l, K, s));
        const inicio = direcao('quadril');
        l.t = 8; modelo.atualizar(descreverPose(l, K, s));
        const giro = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(inicio, direcao('quadril')))));
        assert.ok(giro > 1.5 && giro < 1.6, `quadril acompanha o chute em ~89 graus: ${giro}`);
        let apoio;
        for (let t = 0; t <= 24; t += .5) {
          l.t = t;
          modelo.atualizar(descreverPose(l, K, s));
          const no = modelo.osso(face > 0 ? 'pe_E' : 'pe_D'), cadeia = [];
          for (let n = no; n; n = n.parent) cadeia.unshift(n);
          for (const n of cadeia) n.computeWorldMatrix(true);
          const p = no.getAbsolutePosition();
          apoio ??= p.clone();
          assert.ok(p.subtract(apoio).length() < .015, `K q${t}: outra perna permanece apoiada`);
        }
      }
    }
  } finally { modelo.descartar(); scene.dispose(); engine.dispose(); }
});
