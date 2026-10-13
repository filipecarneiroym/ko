const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const raiz = path.resolve(__dirname, '../../..'), pasta = path.join(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const ler = nome => JSON.parse(fs.readFileSync(path.join(pasta, nome)));
const nomes = ['rolando', 'agarrando', 'agarrado', 'tonto', 'vitoria', 'derrotado', 'final', 'vitimaFinal'];
let promessa;
function preparar() {
  return promessa ||= (async () => {
    const [{ criarEstudoVisual }, { aplicarPosturasPipoca }, { aplicarTecnicasPipoca }, { aplicarEstadosPipoca }, { aplicarAtuacaoPipoca }, { exportarGlb }] = await Promise.all([
      import('../../../scripts/producao-3d/gerar-estudo-visual.mjs'), import('../../../src/producao3d/pipoca-posturas.mjs'), import('../../../src/producao3d/pipoca-tecnicas.mjs'),
      import('../../../src/producao3d/pipoca-estados.mjs'), import('../../../src/producao3d/pipoca-atuacao.mjs'), import('../../../scripts/producao-3d/glb.mjs'),
    ]);
    const dados = aplicarEstadosPipoca(aplicarTecnicasPipoca(aplicarPosturasPipoca(criarEstudoVisual(...['guarda-v4.json', 'jab-v5.json', 'soco-forte-v6.json', 'defesa-v7.json', 'reacao-v8.json', 'andando-v9.json', 'chute-v11.json', 'chute-forte-v12.json'].map(ler), K), ler('posturas-v14.json')), ler('tecnicas-v15.json')), ler('estados-v16.json'));
    const fonte = ler('atuacao-v17.json'), completo = aplicarAtuacaoPipoca(dados, fonte);
    return { dados, fonte, completo, bytes: exportarGlb(completo), aplicarAtuacaoPipoca };
  })();
}

test('oito fontes de atuação preservam os outros23clips, rig, corpo e texturas sem aprovar arte', async () => {
  const { dados, fonte, completo, aplicarAtuacaoPipoca } = await preparar(), antes = JSON.stringify(fonte);
  assert.deepEqual(fonte.clips.map(c => c.nome), nomes);
  assert.deepEqual(completo.clips.filter(c => !nomes.includes(c.nome)), dados.clips.filter(c => !nomes.includes(c.nome)));
  for (const campo of ['ossos', 'primitivas', 'materiais', 'imagens', 'texturas', 'samplers']) assert.equal(completo[campo], dados[campo]);
  assert.equal(JSON.stringify(fonte), antes); assert.equal(completo.extras.atuacaoPipoca.aprovadoFinal, false);
  const invalida = structuredClone(fonte); invalida.clips[0].canais.find(c => c.osso === 0 && c.tipo === 'translation').valores[0] = 2;
  assert.throws(() => aplicarAtuacaoPipoca(dados, invalida), /raiz jogável/);
  assert.equal(fonte.regras.agarrado.lancamentoMotor, 10);
  assert.deepEqual(fonte.regras.final.contatosVfx, Array.from({ length: 18 }, (_, i) => 36 + 6 * i));
  assert.ok(fonte.pendentes.some(p => p.includes('distância')));
});

test('corpo, luvas, apoios e pontas das oito atuações são válidos no importador real entre chaves', async t => {
  const { bytes } = await preparar(), { verificarAtuacaoPipoca } = await import('../../../scripts/producao-3d/verificar-atuacao-pipoca.mjs');
  const r = await verificarAtuacaoPipoca(bytes);
  assert.deepEqual(Object.keys(r.estados), nomes);
  assert.ok(r.amostras > 12000);
  t.diagnostic(JSON.stringify({ amostras: r.amostras, estados: r.estados }));
});

test('rolagem para de moverq16 e retorna no24; agarrão lança no10 pelo KSim e congela no hitstop', async () => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'), import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
  ]);
  const { bytes } = await preparar(), engine = new NullEngine(), scene = new Scene(engine); let modelo;
  try {
    modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
    const s = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true }); s.fase = 'luta'; s.fT = 0;
    s.p[0].x = 100 * K.U; s.p[1].x = 300 * K.U;
    K.passo(s, [K.B.P | K.B.K, 0]); assert.equal(s.p[0].estado, 'rolando'); const origem = s.p[0].x - 88;
    let parada = null;
    for (let i = 0; i < 26; i++) {
      const pose = descreverPose(s.p[0], K, s), antes = JSON.stringify(s); modelo.atualizar(pose); assert.equal(JSON.stringify(s), antes);
      if (s.p[0].estado === 'rolando') assert.equal(s.p[0].x - origem, Math.min(s.p[0].t, 16) * 88);
      if (s.p[0].t === 16) parada = s.p[0].x;
      if (s.p[0].estado === 'rolando' && s.p[0].t > 16) assert.equal(s.p[0].x, parada);
      K.passo(s, [0, 0]);
    }
    assert.equal(s.p[0].estado, 'parado');
    s.p[0].x = 120 * K.U; s.p[1].x = 146 * K.U; s.p[0].face = 1;
    K.passo(s, [K.B.R | K.B.P, 0]); assert.equal(s.p[0].estado, 'agarrando'); assert.equal(s.p[1].estado, 'agarrado');
    while (s.p[0].t < 9) { K.passo(s, [0, 0]); modelo.atualizar(descreverPose(s.p[0], K, s)); }
    K.passo(s, [0, 0]); assert.equal(s.p[0].t, 10); assert.equal(s.p[1].estado, 'dano'); assert.ok(s.p[1].y > 0);
    modelo.atualizar(descreverPose(s.p[0], K, s));
    const locais = () => scene.skeletons[0].bones.flatMap(b => [...b.getTransformNode().position.asArray(), ...b.getTransformNode().rotationQuaternion.asArray()]);
    const congelada = locais(); assert.ok(s.hitstop > 0);
    for (let i = 0; i < 3; i++) { K.passo(s, [0, 0]); for (let j = 0; j < 3; j++) modelo.atualizar(descreverPose(s.p[0], K, s)); assert.deepEqual(locais(), congelada); }
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
});
