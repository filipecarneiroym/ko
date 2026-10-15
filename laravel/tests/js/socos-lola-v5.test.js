const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');

for (const cor of ['azul', 'vermelha']) test(`socos Lola ${cor}: extensão, contato, proteção e recolhimento`, async () => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }, { Vector3 }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
    import('@babylonjs/core/Maths/math.vector.js'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine);
  const bytes = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`));
  const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
  const pos = nome => {
    const no = modelo.osso(nome), pais = [];
    for (let n = no; n; n = n.parent) pais.unshift(n);
    for (const n of pais) n.computeWorldMatrix(true);
    return no.getAbsolutePosition().clone();
  };
  try {
    for (const face of [1, -1]) for (const golpe of ['p1', 'p2', 'ap', 'cp', 'foc']) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }), l = s.p[0];
      Object.assign(l, { estado: 'golpe', golpe, face, focoSolto: 1 });
      const lado = golpe === 'p2' ? (face > 0 ? 'E' : 'D') : ['p1', 'ap'].includes(golpe) && face > 0 ? 'D' : 'E', protecao = lado === 'E' ? 'D' : 'E';
      for (const janela of K.LUTADORES.pipoca.golpes[golpe].janelas) for (let t = janela.de; t <= janela.ate; t++) {
        l.t = t;
        const antes = JSON.stringify(s);
        modelo.atualizar(descreverPose(l, K, s));
        assert.equal(JSON.stringify(s), antes);
        const ombro = pos(`braco_${lado}`), cotovelo = pos(`antebraco_${lado}`), mao = pos(`mao_${lado}`);
        const extensao = mao.subtract(ombro).length() / (cotovelo.subtract(ombro).length() + mao.subtract(cotovelo).length());
        assert.ok(extensao > .97, `${golpe} q${t}: braço estendido, ${extensao}`);
        const caixa = K.caixaHit(l, janela.caixa), x = (caixa.x / K.U - K.LARGURA / 2) / 24, y = caixa.y / K.U / 24;
        assert.ok(mao.x >= x - .08 && mao.x <= x + caixa.w / K.U / 24 + .08
          && mao.y >= y - .08 && mao.y <= y + caixa.h / K.U / 24 + .08, `${golpe}: luva acompanha contato do motor`);
        assert.ok(pos(`mao_${protecao}`).subtract(pos(`braco_${protecao}`)).length() < .6, 'outra luva recolhida');
      }
      l.t = K.LUTADORES.pipoca.golpes[golpe].dur;
      modelo.atualizar(descreverPose(l, K, s));
      const ombro = pos(`braco_${lado}`), cotovelo = pos(`antebraco_${lado}`), mao = pos(`mao_${lado}`);
      assert.ok(mao.subtract(ombro).length() / (cotovelo.subtract(ombro).length() + mao.subtract(cotovelo).length()) < .8, 'recolhe depois do soco');
    }
    for (const face of [1, -1]) for (const golpe of ['dp', 'dpEx']) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }), l = s.p[0];
      Object.assign(l, { estado: 'golpe', golpe, face, t: 12 });
      modelo.atualizar(descreverPose(l, K, s));
      const lado = face > 0 ? 'D' : 'E';
      assert.ok(pos(`mao_${lado}`).y > pos('cabeca').y + .08, `${golpe}: punho sobe acima da cabeça nos dois lados`);
    }
    for (const face of [1, -1]) for (const nome of ['parado', 'andando', 'recuo', 'corrida', 'agachado',
      'defesa', 'defesaBaixa', 'p1', 'p2', 'k1', 'k2', 'ck', 'cp', 'esp', 'espEx', 'ultra', 'foc']) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }), l = s.p[0];
      const golpe = K.LUTADORES.pipoca.golpes[nome];
      Object.assign(l, { estado: golpe ? 'golpe' : nome, golpe: golpe ? nome : null, face, focoSolto: 1 });
      for (let t = 0; t <= (golpe?.dur || 24); t++) {
        l.t = t;
        modelo.atualizar(descreverPose(l, K, s));
        pos('cabeca');
        const olhar = Vector3.TransformNormal(new Vector3(1, 0, 0), modelo.osso('cabeca').getWorldMatrix()).normalize();
        assert.ok(olhar.x * face > .97 && olhar.y >= -.015 && olhar.y < .18 && Math.abs(olhar.z) < .015,
          `${nome} q${t} face${face}: olha para oponente, não para cintura/piso (${olhar.asArray()})`);
      }
    }
  } finally { modelo.descartar(); scene.dispose(); engine.dispose(); }
});
