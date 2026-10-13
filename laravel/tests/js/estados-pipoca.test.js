const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const raiz = path.resolve(__dirname, '../../..'), pasta = path.join(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const ler = nome => JSON.parse(fs.readFileSync(path.join(pasta, nome)));
const nomes = ['corrida', 'recuo', 'quebra', 'caido', 'levantando'];
let promessa;
function prepararDados() {
  return promessa ||= (async () => {
    const [{ criarEstudoVisual }, { aplicarPosturasPipoca }, { aplicarTecnicasPipoca }, { aplicarEstadosPipoca }, { exportarGlb }] = await Promise.all([
      import('../../../scripts/producao-3d/gerar-estudo-visual.mjs'), import('../../../src/producao3d/pipoca-posturas.mjs'),
      import('../../../src/producao3d/pipoca-tecnicas.mjs'), import('../../../src/producao3d/pipoca-estados.mjs'), import('../../../scripts/producao-3d/glb.mjs'),
    ]);
    const fontes = ['guarda-v4.json', 'jab-v5.json', 'soco-forte-v6.json', 'defesa-v7.json', 'reacao-v8.json', 'andando-v9.json', 'chute-v11.json', 'chute-forte-v12.json'].map(ler);
    const base = aplicarTecnicasPipoca(aplicarPosturasPipoca(criarEstudoVisual(...fontes, K), ler('posturas-v14.json')), ler('tecnicas-v15.json'));
    const fonte = ler('estados-v16.json'), dados = aplicarEstadosPipoca(base, fonte);
    return { base, fonte, dados, bytes: exportarGlb(dados), aplicarEstadosPipoca };
  })();
}

test('cinco estados autorais preservam os demais26clips, corpo, texturas e regras do motor', async () => {
  const { base, dados, fonte, aplicarEstadosPipoca } = await prepararDados(), antes = JSON.stringify(fonte);
  assert.deepEqual(fonte.clips.map(c => c.nome), nomes);
  assert.deepEqual(dados.clips.filter(c => !nomes.includes(c.nome)), base.clips.filter(c => !nomes.includes(c.nome)));
  for (const campo of ['ossos', 'primitivas', 'materiais', 'imagens', 'texturas', 'samplers']) assert.equal(dados[campo], base[campo]);
  assert.equal(JSON.stringify(fonte), antes);
  assert.equal(fonte.regras.corrida.distanciaCiclo, K.LUTADORES.pipoca.correr / K.U / 24 * 8);
  const invalida = structuredClone(fonte);
  invalida.clips[0].canais.find(c => c.osso === 0 && c.tipo === 'translation').valores[0] = 2;
  assert.throws(() => aplicarEstadosPipoca(base, invalida), /raiz jogável/);
  invalida.clips[0].nome = 'p1';
  assert.throws(() => aplicarEstadosPipoca(base, invalida), /Estado permitido/);
  assert.equal(dados.extras.estadosPipoca.aprovadoFinal, false);
});

test('apoios da corrida, recuo e quebra compensam a raiz; queda e subida não atravessam o piso', async t => {
  const { bytes } = await prepararDados(), { verificarEstadosPipoca } = await import('../../../scripts/producao-3d/verificar-estados-pipoca.mjs');
  const r = await verificarEstadosPipoca(bytes);
  assert.deepEqual(Object.keys(r.estados), nomes);
  assert.equal(r.passoQuadros, .0625);
  assert.equal(r.amostras, 9866);
  t.diagnostic(JSON.stringify(r.estados));
});

test('corrida real usa distância, congela em parede/hitstop e não muda a simulação', async () => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
  ]);
  const { bytes, fonte } = await prepararDados(), engine = new NullEngine(), scene = new Scene(engine); let modelo;
  try {
    modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
    const s = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true }); s.fase = 'luta'; s.fT = 0;
    s.p[0].x = 60 * K.U; s.p[1].x = 290 * K.U;
    const grupo = scene.animationGroups.find(g => g.name === 'corrida'); let origem = null;
    const esqueleto = () => scene.skeletons[0].bones.flatMap(b => [...b.getTransformNode().position.asArray(), ...b.getTransformNode().rotationQuaternion.asArray()]);
    function desenhar() {
      const antes = JSON.stringify(s), pose = descreverPose(s.p[0], K, s); modelo.atualizar(pose);
      assert.equal(JSON.stringify(s), antes);
      if (pose.clip !== 'corrida') return;
      origem ??= pose.x;
      const atual = esqueleto(), duracao = grupo.to - grupo.from, fase = (((pose.x - origem) / fonte.regras.corrida.distanciaCiclo * duracao) % duracao + duracao) % duracao;
      grupo.goToFrame(fase);
      assert.ok(esqueleto().every((v, i) => Math.abs(v - atual[i]) < 1e-6), 'Fase vem do deslocamento acumulado');
    }
    // Dois toques de frente acionam corrida pelo comando real.
    for (const entrada of [K.B.R, 0, K.B.R]) { K.passo(s, [entrada, 0]); desenhar(); }
    assert.equal(s.p[0].estado, 'corrida');
    for (let i = 0; i < 8; i++) { K.passo(s, [K.B.R, 0]); desenhar(); }
    const congelada = esqueleto(); s.hitstop = 3;
    for (let i = 0; i < 3; i++) { K.passo(s, [K.B.R, 0]); for (let j = 0; j < 3; j++) desenhar(); assert.deepEqual(esqueleto(), congelada); }
    s.p[1].x = (K.LARGURA - 18) * K.U; s.p[1].estado = 'caido'; s.p[1].t = 0;
    s.p[0].x = (K.LARGURA - 18) * K.U; s.p[0].face = 1;
    K.passo(s, [K.B.R, 0]); modelo.atualizar(descreverPose(s.p[0], K, s));
    const parede = esqueleto();
    for (let i = 0; i < 5; i++) { K.passo(s, [K.B.R, 0]); modelo.atualizar(descreverPose(s.p[0], K, s)); assert.deepEqual(esqueleto(), parede); }
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
});

test('perfil de recuo e desaceleração de quebra reproduzem o deslocamento real do motor', async () => {
  const { fonte } = await prepararDados(), { deslocamentoEstadoPipoca } = await import('../../../src/producao3d/pipoca-estados.mjs');
  for (const nome of ['recuo', 'quebra']) {
    const s = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true }); s.fase = 'luta'; s.fT = 0;
    s.p[0].x = 200 * K.U; s.p[1].x = 310 * K.U;
    Object.assign(s.p[0], { estado: nome, t: 0, vx: nome === 'recuo' ? -90 : -40 });
    const origem = s.p[0].x;
    for (let q = 1; q < (nome === 'recuo' ? 18 : 16); q++) {
      K.passo(s, [0, 0]);
      assert.ok(Math.abs((s.p[0].x - origem) / K.U / 24 - deslocamentoEstadoPipoca(nome, q, fonte.regras)) < 1e-9, `${nome} q${q}`);
    }
  }
});
