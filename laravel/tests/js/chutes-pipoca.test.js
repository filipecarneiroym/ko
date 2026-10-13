const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');

const raiz = path.resolve(__dirname, '../../..');
const pasta = path.join(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const ler = nome => JSON.parse(fs.readFileSync(path.join(pasta, nome)));
const fontes = () => ['guarda-v4.json', 'jab-v5.json', 'soco-forte-v6.json', 'defesa-v7.json', 'reacao-v8.json', 'andando-v9.json', 'chute-v11.json', 'chute-forte-v12.json'].map(ler);
const bytes = () => fs.readFileSync(path.join(raiz, 'public/modelos/estudos/pipoca-direcao-visual-v13.glb'));
const modulos = Promise.all([
  import('@babylonjs/core/Engines/nullEngine.js'),
  import('@babylonjs/core/scene.js'),
  import('../../../src/3d/modelo-glb.js'),
  import('../../../src/3d/estado-visual.mjs'),
]);

async function preparar() {
  const [{ NullEngine }, { Scene }, { carregarModelo }] = await modulos;
  const engine = new NullEngine(), scene = new Scene(engine), b = bytes();
  try {
    const modelo = await carregarModelo(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), 'pipoca', K, scene);
    return { scene, modelo, fechar() { modelo.descartar(); scene.dispose(); engine.dispose(); } };
  } catch (erro) { scene.dispose(); engine.dispose(); throw erro; }
}

function ossos(scene) {
  return scene.skeletons[0].bones.map(osso => {
    const no = osso.getTransformNode();
    return { nome: osso.name, posicao: no.position.asArray(), escala: no.scaling.asArray(), rotacao: no.rotationQuaternion.asArray() };
  });
}

function mesmaPose(atual, esperado, mensagem) {
  for (let i = 0; i < atual.length; i++) {
    assert.equal(atual[i].nome, esperado[i].nome);
    for (const campo of ['posicao', 'escala']) assert.ok(atual[i][campo].every((v, j) => Math.abs(v - esperado[i][campo][j]) < 1e-6), `${mensagem}: ${atual[i].nome}.${campo}`);
    const produto = atual[i].rotacao.reduce((s, v, j) => s + v * esperado[i].rotacao[j], 0);
    assert.ok(Math.abs(1 - Math.abs(produto)) < 1e-6, `${mensagem}: ${atual[i].nome}.rotacao`);
  }
}

test('chutes preservam o corpo contínuo v10, rig e as outras 29 animações', async () => {
  const { criarEstudoCorpo } = await import('../../../scripts/producao-3d/gerar-estudo-corpo.mjs');
  const { criarEstudoChutes } = await import('../../../scripts/producao-3d/gerar-estudo-chutes.mjs');
  const entrada = fontes(), antes = JSON.stringify(entrada);
  const base = criarEstudoCorpo(...entrada.slice(0, 6), K);
  const dados = criarEstudoChutes(...entrada, K);
  assert.equal(dados.clips.length, 31);
  assert.deepEqual(dados.ossos, base.ossos);
  assert.deepEqual(dados.primitivas, base.primitivas);
  assert.deepEqual(dados.materiais, base.materiais);
  assert.deepEqual(dados.extras.corpo, base.extras.corpo);
  assert.ok(dados.extras.corpo.verticesMistos > 0);
  assert.deepEqual(dados.clips.filter(c => !['k1', 'k2'].includes(c.nome)), base.clips.filter(c => !['k1', 'k2'].includes(c.nome)));
  assert.equal(JSON.stringify(entrada), antes, 'Exportar não modifica fontes');
});

test('apoio, solas, guarda e contato dos chutes são válidos entre chaves e nas duas faces', async t => {
  const { verificarChutes } = await import('../../../scripts/producao-3d/verificar-chutes-pipoca.mjs');
  const relato = await verificarChutes(bytes(), K);
  assert.equal(relato.passoQuadros, .25);
  assert.equal(relato.amostras, 420);
  assert.ok(Object.values(relato['apoioMaximo (m)']).every(v => v < .001));
  assert.ok(relato.menorSola >= -.001);
  assert.ok(relato.maiorErroSolaApoio < .001);
  assert.ok(relato.guardaRetornaNasPontas && relato.estadoPreservado);
  t.diagnostic(JSON.stringify({ amostras: relato.amostras, apoio: relato['apoioMaximo (m)'], menorSola: relato.menorSola, maiorErroSolaApoio: relato.maiorErroSolaApoio }));
});

test('verificador rejeita a perda de ambos os apoios durante o chute', async () => {
  const { criarEstudoChutes } = await import('../../../scripts/producao-3d/gerar-estudo-chutes.mjs');
  const { exportarGlb } = await import('../../../scripts/producao-3d/glb.mjs');
  const { verificarChutes } = await import('../../../scripts/producao-3d/verificar-chutes-pipoca.mjs');
  const dados = criarEstudoChutes(...fontes(), K);
  const clip = dados.clips.find(c => c.nome === 'k1');
  // No primeiro contato, mover também o pé que deveria sustentar o chute.
  const apoio = clip.canais.find(c => c.osso === 18 && c.tipo === 'translation');
  const i = apoio.tempos.findIndex(t => Math.abs(t - 6 / 60) < 1e-8);
  assert.ok(i >= 0);
  apoio.valores[i * 3] += .04;
  await assert.rejects(verificarChutes(exportarGlb(dados), K), /pé ancorado|Sola|ancora perna/);
});

test('combo real p2→k2 preserva pose, pés e hitstop e encerra emenda antes do contato', async () => {
  const [, , , { descreverPose }] = await modulos;
  const cena = await preparar(), referencia = await preparar();
  try {
    assert.ok(Object.isFrozen(cena.modelo.malhas));
    assert.equal(cena.modelo.malhas, cena.modelo.malhas, 'A coleção somente leitura é estável');
    const estado = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
    estado.fase = 'luta'; estado.fT = 0;
    estado.p[0].x = 180 * K.U; estado.p[1].x = 208 * K.U;
    let anterior = null, emendou = false, contato = false, congelou = false;
    function desenhar() {
      const antes = JSON.stringify(estado);
      const pose = descreverPose(estado.p[0], K, estado);
      cena.modelo.atualizar(pose);
      assert.equal(JSON.stringify(estado), antes);
      const atual = ossos(cena.scene);
      if (anterior?.clip === 'p2' && pose.clip === 'k2') {
        assert.equal(anterior.q, 5); assert.equal(pose.quadro, 1);
        mesmaPose(atual, anterior.ossos, 'Cancelamento preserva pose inteira no primeiro quadro');
        emendou = true;
      }
      if (pose.clip === 'k2') {
        // A referência isolada aplica a IK sem qualquer emenda anterior.
        referencia.modelo.atualizar(pose);
        const isolada = ossos(referencia.scene);
        mesmaPose(atual.filter(o => /^(quadril|coxa_[ED]|canela_[ED]|pe_[ED])$/.test(o.nome)), isolada.filter(o => /^(quadril|coxa_[ED]|canela_[ED]|pe_[ED])$/.test(o.nome)), 'IK das pernas permanece autoral durante a emenda');
        if (pose.quadro >= 6) mesmaPose(atual, isolada, 'Emenda termina antes do quadro ativo 7');
        for (let i = 0; i < 5; i++) cena.modelo.atualizar(pose);
        mesmaPose(ossos(cena.scene), atual, 'Render repetido não acumula interpolação');
        if (pose.quadro === 7) {
          contato = true;
          if (anterior?.clip === 'k2' && anterior.q === 7 && estado.hitstop > 0) {
            mesmaPose(atual, anterior.ossos, 'Hitstop preserva o contato do chute'); congelou = true;
          }
        }
      }
      anterior = { clip: pose.clip, q: pose.quadro, ossos: atual };
    }
    for (const [botao, espera] of [[K.B.P, 9], [K.B.P, 12], [K.B.K, 50]]) {
      K.passo(estado, [botao, 0]); desenhar();
      for (let i = 0; i < espera; i++) { K.passo(estado, [0, 0]); desenhar(); }
    }
    assert.ok(emendou && contato && congelou, 'Motor percorre cancelamento, contato e hitstop reais');
  } finally { cena.fechar(); referencia.fechar(); }
});
