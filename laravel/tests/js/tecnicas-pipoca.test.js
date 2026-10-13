const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');

const raiz = path.resolve(__dirname, '../../..'), pasta = path.join(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const ler = nome => JSON.parse(fs.readFileSync(path.join(pasta, nome)));
const tecnicas = () => ler('tecnicas-v15.json');
const bytes = () => fs.readFileSync(path.join(raiz, 'public/modelos/estudos/pipoca-direcao-visual-v13.glb'));
const nomes = ['cp', 'ck', 'ap', 'ak', 'esp', 'sup'];

async function base() {
  const { criarEstudoVisual } = await import('../../../scripts/producao-3d/gerar-estudo-visual.mjs');
  const { aplicarPosturasPipoca } = await import('../../../src/producao3d/pipoca-posturas.mjs');
  return aplicarPosturasPipoca(criarEstudoVisual(...['guarda-v4.json', 'jab-v5.json', 'soco-forte-v6.json', 'defesa-v7.json', 'reacao-v8.json', 'andando-v9.json', 'chute-v11.json', 'chute-forte-v12.json'].map(ler), K), ler('posturas-v14.json'));
}

function compararPose(clip, referencia, fim = false, qReferencia = 0) {
  for (const c of clip.canais) {
    const r = referencia.canais.find(r => r.osso === c.osso && r.tipo === c.tipo), n = c.tipo === 'rotation' ? 4 : 3;
    const i = r.tempos.findIndex(t => Math.abs(t - qReferencia / 60) < 1e-7);
    assert.ok(i >= 0);
    const atual = fim ? c.valores.slice(-n) : c.valores.slice(0, n), alvo = r.valores.slice(i * n, (i + 1) * n);
    if (n === 4) {
      const dot = atual.reduce((s, v, j) => s + v * alvo[j], 0);
      assert.ok(Math.abs(1 - Math.abs(dot)) < 1e-5, `${clip.nome}: ponta segue ${referencia.nome}.${c.osso}.rotation`);
    } else assert.ok(atual.every((v, j) => Math.abs(v - alvo[j]) < 1e-5), `${clip.nome}: ponta segue ${referencia.nome}.${c.osso}.translation`);
  }
}

test('seis técnicas preservam as outras25animações, rig, corpo e texturas e rejeitam fontes inválidas', async () => {
  const { aplicarTecnicasPipoca } = await import('../../../src/producao3d/pipoca-tecnicas.mjs');
  const dados = await base(), fonte = tecnicas(), antes = JSON.stringify(fonte);
  const novo = aplicarTecnicasPipoca(dados, fonte);
  assert.equal(novo.clips.length, 31);
  assert.deepEqual(fonte.clips.map(c => c.nome), nomes);
  assert.deepEqual(novo.clips.filter(c => !nomes.includes(c.nome)), dados.clips.filter(c => !nomes.includes(c.nome)));
  for (const campo of ['ossos', 'primitivas', 'materiais', 'imagens', 'texturas', 'samplers']) assert.equal(novo[campo], dados[campo], `${campo} preservado`);
  assert.equal(JSON.stringify(fonte), antes);
  const invalida = structuredClone(fonte);
  invalida.clips[0].canais.find(c => c.osso === 0 && c.tipo === 'translation').valores[0] = 2;
  assert.throws(() => aplicarTecnicasPipoca(dados, invalida), /raiz jogável/);
  invalida.clips[0].canais.pop();
  assert.throws(() => aplicarTecnicasPipoca(dados, invalida), /Vinte ossos/);
});

test('pontas das técnicas ligam a baixa, o puloq8 e a guarda corretos', () => {
  const fonte = tecnicas(), guarda = ler('guarda-v4.json'), posturas = ler('posturas-v14.json');
  const baixa = posturas.clips.find(c => c.nome === 'agachado'), pulo = posturas.clips.find(c => c.nome === 'pulo');
  for (const c of fonte.clips) {
    const ref = ['cp', 'ck'].includes(c.nome) ? baixa : ['ap', 'ak'].includes(c.nome) ? pulo : guarda;
    compararPose(c, ref, false, ['ap', 'ak'].includes(c.nome) ? 8 : 0);
    compararPose(c, ['cp', 'ck'].includes(c.nome) ? baixa : guarda, true);
  }
});

test('luvas/pés alcançam todas as janelas, apoios em solo e técnicas aéreas são válidos entre chaves', async t => {
  const { verificarTecnicasPipoca } = await import('../../../scripts/producao-3d/verificar-tecnicas-pipoca.mjs');
  const { validarGlb } = await import('../../../src/3d/contrato-glb.mjs');
  const b = bytes(), doc = validarGlb(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), 'pipoca', K);
  assert.deepEqual(doc.extras.tecnicasPipoca.nomes, nomes, 'Testa o GLB integrado, sem substituir clips apenas no teste');
  const r = await verificarTecnicasPipoca(b, K);
  assert.deepEqual(Object.keys(r.golpes), nomes);
  assert.equal(r.passoQuadros, .0625);
  assert.equal(r.amostras, 5644);
  assert.ok(Object.values(r.golpes).every(g => g.apoioMaximo < .001 && g.solaMaxima < .001));
  t.diagnostic(JSON.stringify({ amostras: r.amostras, apoios: Object.fromEntries(Object.entries(r.golpes).map(([n, g]) => [n, g.apoioMaximo])) }));
});

test('super real oculta apenas conforme p.sumido, reaparece e renderizar preserva o motor', async () => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine); let modelo;
  try {
    const b = bytes(); modelo = await carregarModelo(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), 'pipoca', K, scene);
    const s = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true }); s.fase = 'luta'; s.fT = 0;
    s.p[0].poder = K.PODER_MAX; s.p[0].x = 80 * K.U; s.p[1].x = 270 * K.U;
    let oculto = false, retorno = false;
    for (let i = 0; i < 110; i++) {
      K.passo(s, [i === 0 ? K.B.S : 0, 0]);
      const antes = JSON.stringify(s), pose = descreverPose(s.p[0], K, s);
      for (let j = 0; j < 3; j++) modelo.atualizar(pose);
      assert.equal(JSON.stringify(s), antes);
      const r = scene.getTransformNodeByName('modelo-pipoca');
      assert.equal(r.isEnabled(), !s.p[0].sumido);
      assert.equal(r.position.x, (s.p[0].x / K.U - K.LARGURA / 2) / 24);
      if (s.p[0].golpe === 'sup' && s.p[0].t >= 8 && s.p[0].t <= 42) { assert.ok(!r.isEnabled()); oculto = true; }
      if (oculto && s.p[0].golpe === 'sup' && s.p[0].t === 43) { assert.ok(r.isEnabled()); retorno = true; }
    }
    assert.ok(oculto && retorno);
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
});

test('ap/ak permanecem acima do piso com a altura real de todos os instantes do salto e trocam para o pouso', async t => {
  const [{ NullEngine }, { Scene }, { carregarModelo }, { descreverPose }] = await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'), import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'), import('../../../src/3d/estado-visual.mjs'),
  ]);
  const engine = new NullEngine(), scene = new Scene(engine); let modelo;
  try {
    const b = bytes(); modelo = await carregarModelo(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), 'pipoca', K, scene);
    let amostras = 0, pisoMinimo = Infinity, pousos = 0;
    for (const face of [1, -1]) for (const [nome, botao] of [['ap', K.B.P], ['ak', K.B.K]]) for (let inicio = 1; inicio <= 32; inicio++) {
      const s = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true }); s.fase = 'luta'; s.fT = 0;
      s.p[0].x = (face > 0 ? 60 : 260) * K.U; s.p[1].x = (face > 0 ? 300 : 20) * K.U; s.p[0].face = face;
      for (let q = 0; q <= 40; q++) {
        K.passo(s, [q === 0 ? K.B.U : q === inicio ? botao : 0, 0]);
        const antes = JSON.stringify(s), pose = descreverPose(s.p[0], K, s); modelo.atualizar(pose);
        assert.equal(JSON.stringify(s), antes);
        if (![nome, 'pousando'].includes(pose.clip)) continue;
        amostras++; if (pose.clip === 'pousando') pousos++;
        let piso = Infinity;
        for (const m of modelo.malhas.filter(m => m.skeleton)) {
          m.computeWorldMatrix(true); m.skeleton.prepare(true);
          const p = m.getPositionData(true, false), w = m.getWorldMatrix().m;
          for (let i = 0; i < p.length; i += 3) piso = Math.min(piso, p[i] * w[1] + p[i + 1] * w[5] + p[i + 2] * w[9] + w[13]);
        }
        pisoMinimo = Math.min(pisoMinimo, piso);
        assert.ok(piso >= -.001, `${nome}, face${face}, início${inicio}, quadro${q}, ${pose.clip}q${pose.quadro}, raizY${pose.y}: piso${piso}`);
      }
    }
    assert.ok(amostras > 1000 && pousos > 0);
    t.diagnostic(JSON.stringify({ amostras, pisoMinimo, pousos, iniciosAereosPorTecnicaEFace: 32 }));
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
});
