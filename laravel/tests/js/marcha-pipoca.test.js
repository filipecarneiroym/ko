const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('@babylonjs/core/Engines/nullEngine.js'),
  import('@babylonjs/core/scene.js'),
  import('@babylonjs/core/Maths/math.vector.js'),
  import('../../../src/3d/modelo-glb.js'),
  import('../../../src/3d/estado-visual.mjs'),
]);
const DISTANCIA = 1.3125;
const VELOCIDADE = K.LUTADORES.pipoca.andar / (K.U * 24);

async function preparar() {
  const [{ NullEngine }, { Scene }, , { carregarModelo }] = await modulos;
  const bytes = fs.readFileSync(path.resolve(__dirname, '../../../public/modelos/estudos/pipoca-marcha-v9.glb'));
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
    return { scene, modelo, fechar() { modelo.descartar(); scene.dispose(); engine.dispose(); } };
  } catch (erro) { scene.dispose(); engine.dispose(); throw erro; }
}

function ossos(scene) {
  return scene.skeletons[0].bones.flatMap(osso => {
    const no = osso.getTransformNode();
    return [...no.position.asArray(), ...no.scaling.asArray(), ...no.rotationQuaternion.asArray()];
  });
}

function mesmoEsqueleto(atual, esperado, mensagem) {
  assert.equal(atual.length, esperado.length);
  assert.ok(atual.every((v, i) => Math.abs(v - esperado[i]) < 1e-6), mensagem);
}

function verticesPes(scene) {
  return scene.meshes.filter(m => m.getTotalVertices() && m.skeleton).map(mesh => {
    const juntas = mesh.getVerticesData('matricesIndices');
    const pesos = mesh.getVerticesData('matricesWeights');
    const indices = {};
    for (const lado of ['E', 'D']) {
      const junta = mesh.skeleton.bones.find(b => b.name === `pe_${lado}`).getIndex();
      indices[lado] = [];
      for (let i = 0; i < mesh.getTotalVertices(); i++) if (juntas[i * 4] === junta && pesos[i * 4] > .99) indices[lado].push(i);
    }
    return { mesh, indices };
  }).filter(({ indices }) => indices.E.length || indices.D.length);
}

async function solas(malhas) {
  const [, , { Vector3 }] = await modulos;
  const alturas = { E: Infinity, D: Infinity };
  for (const { mesh, indices } of malhas) {
    mesh.computeWorldMatrix(true); mesh.skeleton.prepare(true);
    const posicoes = mesh.getPositionData(true, false);
    for (const lado of ['E', 'D']) for (const i of indices[lado]) {
      const posicao = Vector3.TransformCoordinates(Vector3.FromArray(posicoes, i * 3), mesh.getWorldMatrix());
      alturas[lado] = Math.min(alturas[lado], posicao.y);
    }
  }
  assert.ok(Object.values(alturas).every(Number.isFinite));
  return alturas;
}

test('marcha substitui somente andando na versão v8 e publica sua distância real de ciclo', async () => {
  const { criarEstudoMarcha } = await import('../../../scripts/producao-3d/gerar-estudo-marcha.mjs');
  const { criarEstudoReacao } = await import('../../../scripts/producao-3d/gerar-estudo-reacao.mjs');
  const pasta = path.resolve(__dirname, '../../../art/premium/modelos-3d/estudos-mixamo');
  const ler = nome => JSON.parse(fs.readFileSync(path.join(pasta, nome)));
  const fontes = ['guarda-v4.json', 'jab-v5.json', 'soco-forte-v6.json', 'defesa-v7.json', 'reacao-v8.json'].map(ler);
  const marcha = ler('andando-v9.json');
  const antes = JSON.stringify([...fontes, marcha]);
  const base = criarEstudoReacao(...fontes, K);
  const dados = criarEstudoMarcha(...fontes, marcha, K);
  assert.equal(dados.clips.length, 31);
  assert.deepEqual(dados.clips.filter(c => c.nome !== 'andando'), base.clips.filter(c => c.nome !== 'andando'));
  assert.equal(dados.extras.marcha.clip, 'andando');
  assert.equal(dados.extras.marcha.distanciaCiclo, DISTANCIA);
  assert.equal(dados.extras.marcha.distanciaCiclo / VELOCIDADE, 12);
  assert.equal(JSON.stringify([...fontes, marcha]), antes, 'Gerar a marcha preserva fontes anteriores');
  const corrompida = structuredClone(marcha);
  corrompida.canais.find(c => c.osso === 0 && c.tipo === 'translation').valores[0] = .1;
  assert.throws(() => criarEstudoMarcha(...fontes, corrompida, K), /raiz horizontalmente/);
});

test('pés importados permanecem no mundo durante apoio em avanço e recuo, nas duas orientações', async t => {
  let maiorErroApoio = 0, menorSola = Infinity, maiorErroSolaApoio = 0;
  for (const face of [1, -1]) for (const velocidade of [VELOCIDADE, -K.LUTADORES.pipoca.tras / (K.U * 24)]) {
    const cena = await preparar();
    try {
      const malhas = verticesPes(cena.scene);
      const ancoras = new Map();
      for (let i = 0; i <= 96; i++) {
        const q = i * .25;
        const pose = { clip: 'andando', quadro: 1000 + q, ciclico: true,
          x: face * velocidade * q, y: 0, face, visivel: true };
        const antes = JSON.stringify(pose);
        cena.modelo.atualizar(pose);
        assert.equal(JSON.stringify(pose), antes);
        const alturas = await solas(malhas);
        for (const lado of ['E', 'D']) {
          menorSola = Math.min(menorSola, alturas[lado]);
          assert.ok(alturas[lado] >= -.001, `Sola sem penetrar o chão: face ${face}, pé ${lado}, q ${q}`);
          const deslocamentoFase = lado === 'E' ? 0 : 6;
          const faseContinua = velocidade / VELOCIDADE * q + deslocamentoFase;
          const fase = ((faseContinua % 12) + 12) % 12;
          if (fase <= 6 + 1e-8) {
            const no = cena.scene.skeletons[0].bones.find(b => b.name === `pe_${lado}`).getTransformNode();
            no.computeWorldMatrix(true);
            const pe = no.getAbsolutePosition().clone();
            const chave = `${lado}:${Math.floor(faseContinua / 12)}`;
            if (!ancoras.has(chave)) ancoras.set(chave, pe);
            const erro = pe.subtract(ancoras.get(chave)).length();
            maiorErroApoio = Math.max(maiorErroApoio, erro);
            maiorErroSolaApoio = Math.max(maiorErroSolaApoio, Math.abs(alturas[lado]));
            assert.ok(erro < .001, `Pé apoiado imóvel no mundo: face ${face}, pé ${lado}, q ${q}, erro ${erro}`);
            assert.ok(Math.abs(alturas[lado]) < .001, `Sola apoiada no chão: face ${face}, pé ${lado}, q ${q}, altura ${alturas[lado]}`);
          }
        }
      }
    } finally { cena.fechar(); }
  }
  t.diagnostic(JSON.stringify({ amostras: 388, faces: [1, -1], sentidos: ['avanco', 'recuo'], maiorErroApoio, menorSola, maiorErroSolaApoio }));
});

test('motor real dirige a fase pela distância, mantém continuidade ao recuar e congela em hitstop e parede', async () => {
  const [, , , , { descreverPose }] = await modulos;
  const cena = await preparar();
  const referencia = await preparar();
  try {
    const estado = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
    estado.fase = 'luta'; estado.fT = 0;
    const grupo = referencia.scene.animationGroups.find(g => g.name === 'andando');
    let origem = null;
    function desenhar() {
      const antes = JSON.stringify(estado);
      const pose = descreverPose(estado.p[0], K, estado);
      cena.modelo.atualizar(pose);
      assert.equal(JSON.stringify(estado), antes, 'Renderizar preserva a simulação');
      origem ??= pose.x;
      const fase = (((pose.x - origem) / DISTANCIA * (grupo.to - grupo.from)) % (grupo.to - grupo.from) + (grupo.to - grupo.from)) % (grupo.to - grupo.from);
      referencia.modelo.atualizar(pose);
      grupo.goToFrame(grupo.from + fase);
      mesmoEsqueleto(ossos(cena.scene), ossos(referencia.scene), 'Pose segue distância real, inclusive no recuo');
    }
    for (let i = 0; i < 8; i++) { K.passo(estado, [K.B.R, 0]); desenhar(); }
    const tempo = estado.p[0].t;
    K.passo(estado, [K.B.L, 0]); desenhar();
    assert.equal(estado.p[0].t, tempo + 1, 'Inverter sentido não reinicia o estado andando');
    assert.equal(estado.p[0].face, 1, 'Recuar mantém orientação para o adversário');
    for (let i = 0; i < 7; i++) { K.passo(estado, [K.B.L, 0]); desenhar(); }
    const congelada = ossos(cena.scene);
    estado.hitstop = 3;
    for (let i = 0; i < 3; i++) {
      K.passo(estado, [K.B.L, 0]);
      for (let j = 0; j < 4; j++) desenhar();
      mesmoEsqueleto(ossos(cena.scene), congelada, 'Hitstop e render repetido mantêm a passada');
    }
    estado.p[0].x = 18 * K.U;
    K.passo(estado, [K.B.L, 0]);
    cena.modelo.atualizar(descreverPose(estado.p[0], K, estado));
    const naParede = ossos(cena.scene);
    for (let i = 0; i < 6; i++) {
      K.passo(estado, [K.B.L, 0]);
      cena.modelo.atualizar(descreverPose(estado.p[0], K, estado));
      assert.equal(estado.p[0].x, 18 * K.U);
      mesmoEsqueleto(ossos(cena.scene), naParede, 'Sem avanço real a fase não progride na parede');
    }
  } finally { cena.fechar(); referencia.fechar(); }
});
