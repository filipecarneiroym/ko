const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('@babylonjs/core/Engines/nullEngine.js'),
  import('@babylonjs/core/scene.js'),
  import('../../../src/3d/efeitos.js'),
]);

async function preparar(reduzido = { matches: false }) {
  const [{ NullEngine }, { Scene }, { criarEfeitos }] = await modulos;
  const engine = new NullEngine(), scene = new Scene(engine), efeitos = criarEfeitos(scene, K, reduzido);
  return { scene, efeitos, fechar() { efeitos.descartar(); scene.dispose(); engine.dispose(); } };
}

function estado(lutadores = ['pipoca', 'uivo']) {
  const s = K.novo({ lutadores, treino: true }); s.fase = 'luta'; s.fT = 0;
  return s;
}

function desenhar(cena, s) {
  const antes = JSON.stringify(s);
  cena.efeitos.eventos(s.ev, s.f, s); cena.efeitos.atualizar(s.f, s);
  assert.equal(JSON.stringify(s), antes, 'VFX preservam o estado completo do motor');
}

function retrato(cena) {
  return cena.scene.meshes.map(m => ({ nome: m.name, visivel: m.isEnabled(),
    posicao: m.position.asArray(), escala: m.scaling.asArray(), rotacao: m.rotation.asArray(),
    opacidade: m.visibility, alpha: m.material?.alpha }));
}

test('impacto real da Pipoca congela durante hitstop e render repetido não cria novos efeitos', async () => {
  const cena = await preparar();
  try {
    const s = estado(); s.p[0].x = 180 * K.U; s.p[1].x = 208 * K.U;
    for (let i = 0; i < 3; i++) { K.passo(s, [i === 0 ? K.B.P : 0, 0]); desenhar(cena, s); }
    assert.ok(s.ev.some(e => e.t === 'acerto'));
    const impacto = cena.scene.getMeshByName('impacto-0');
    assert.equal(impacto.material.emissiveColor.toHexString(), '#FFC275');
    assert.ok(cena.scene.getMeshByName('pipoca-vfx-raios-0').isEnabled());
    const congelado = retrato(cena);
    for (let i = 0; i < 5; i++) desenhar(cena, s);
    assert.deepEqual(retrato(cena), congelado, 'Repetir o mesmo lote/quadro não emite novas malhas');
    while (s.hitstop > 0) {
      K.passo(s, [0, 0]); desenhar(cena, s);
      assert.deepEqual(retrato(cena), congelado, 'f avança no hitstop, mas o efeito usa o relógio congelado fT');
    }
    K.passo(s, [0, 0]); desenhar(cena, s);
    assert.ok(impacto.material.alpha < .8, 'Efeito retoma depois do hitstop');
  } finally { cena.fechar(); }
});

test('hadouken segue s.proj depois do fim do esp, vai reto e desaparece junto ao projétil', async () => {
  const cena = await preparar();
  try {
    const s = estado(); s.p[0].x = 70 * K.U; s.p[1].x = 320 * K.U;
    const cenoura = cena.scene.getTransformNodeByName('pipoca-cenoura-0');
    const quantidade = cena.scene.meshes.length;
    let aposClip = false, voltou = false, existiu = false;
    for (let i = 0; i < 110; i++) {
      K.passo(s, [i === 0 ? K.B.S : 0, 0]); desenhar(cena, s);
      const p = s.proj.find(p => p.tipo === 'cenoura');
      assert.equal(cena.scene.meshes.length, quantidade, 'Atualizar projétil não aloca geometria');
      assert.equal(cenoura.isEnabled(), !!p);
      if (!p) continue;
      existiu = true;
      assert.equal(cenoura.position.x, (p.x / K.U - K.LARGURA / 2) / 24);
      assert.equal(cenoura.position.y, p.y / K.U / 24);
      // Ponta voltada para onde vai: a chama sempre segue para a frente.
      assert.equal(cenoura.rotation.z, p.vx >= 0 ? 0 : Math.PI);
      if (s.p[0].golpe !== 'esp') aposClip = true;
      if (p.voltando) voltou = true; // o hadouken não volta: a flag nunca liga
    }
    assert.ok(existiu && aposClip && !voltou);
    assert.equal(cenoura.isEnabled(), false, 'Sumir encerra também o visual');
  } finally { cena.fechar(); }
});

test('reduced motion remove expansão, raios e giro decorativos sem ocultar o projétil real', async () => {
  const movimento = { matches: true }, cena = await preparar(movimento);
  try {
    const s = estado();
    s.proj = [{ dono: 0, tipo: 'cenoura', x: 210 * K.U, y: 48 * K.U, vx: 100, vida: 80, t: 20 }];
    s.ev = [{ t: 'acerto', lado: 0, x: 220 * K.U, y: 40 * K.U }];
    desenhar(cena, s);
    const raiz = cena.scene.getTransformNodeByName('impacto-raiz-0');
    const escala = raiz.scaling.asArray();
    assert.equal(cena.scene.getMeshByName('pipoca-vfx-raios-0').isEnabled(), false);
    const cenoura = cena.scene.getTransformNodeByName('pipoca-cenoura-0');
    assert.ok(cenoura.isEnabled()); assert.equal(cenoura.rotation.z, 0);
    s.f++; s.fT++; s.ev = []; s.proj[0].x += 100; s.proj[0].t++;
    desenhar(cena, s);
    assert.deepEqual(raiz.scaling.asArray(), escala);
    assert.equal(cenoura.position.x, (s.proj[0].x / K.U - K.LARGURA / 2) / 24);
    assert.equal(cenoura.rotation.z, 0);
    movimento.matches = false; cena.efeitos.atualizar(s.f, s);
    assert.ok(cena.scene.getMeshByName('pipoca-vfx-raios-0').isEnabled(), 'Preferência é lida sem listeners ou timers');
  } finally { cena.fechar(); }
});

test('defesa identifica a vítima; impactos e bloqueios dos demais lutadores mantêm cores genéricas', async () => {
  const cena = await preparar();
  try {
    const s = estado(['uivo', 'pipoca']);
    s.ev = [{ t: 'acerto', lado: 0, x: 210 * K.U, y: 40 * K.U }, { t: 'defendeu', lado: 1, x: 210 * K.U, y: 40 * K.U }];
    desenhar(cena, s);
    assert.equal(cena.scene.getMeshByName('impacto-0').material.emissiveColor.toHexString(), '#FFCC55');
    assert.equal(cena.scene.getMeshByName('pipoca-vfx-raios-0').isEnabled(), false);
    assert.equal(cena.scene.getMeshByName('impacto-1').material.emissiveColor.toHexString(), '#C6B9FF');
    s.f++; s.fT++; s.ev = [{ t: 'defendeu', lado: 0, x: 180 * K.U, y: 40 * K.U }]; desenhar(cena, s);
    assert.equal(cena.scene.getMeshByName('impacto-2').material.emissiveColor.toHexString(), '#69D9FF');
  } finally { cena.fechar(); }
});

test('toca aparece na entrada de sumido; pool, reinício e descarte são limitados e idempotentes', async () => {
  const cena = await preparar();
  try {
    const s = estado(); s.p[0].x = 80 * K.U; s.p[1].x = 270 * K.U; s.p[0].poder = K.PODER_MAX;
    const quantidade = cena.scene.meshes.length;
    let entrou = false, reapareceu = false;
    for (let i = 0; i < 100; i++) {
      K.passo(s, [i === 0 ? K.B.S | K.B.K : 0, 0]); desenhar(cena, s);
      const tocas = cena.scene.meshes.filter(m => m.name.startsWith('pipoca-vfx-toca-') && m.isEnabled());
      if (s.p[0].sumido && tocas.length) entrou = true;
      if (entrou && !s.p[0].sumido && s.p[0].golpe === 'sup') reapareceu = true;
    }
    assert.ok(entrou && reapareceu);
    for (let i = 0; i < 80; i++) {
      s.f++; s.fT++; s.ev = [{ t: 'acerto', lado: 0, x: 200 * K.U, y: 40 * K.U }]; desenhar(cena, s);
    }
    assert.equal(cena.scene.meshes.length, quantidade);
    assert.equal(cena.scene.transformNodes.filter(n => n.name.startsWith('impacto-raiz-')).length, 12);
    cena.efeitos.limpar();
    assert.ok(cena.scene.meshes.every(m => !m.isEnabled()), 'Reinício limpa impactos, toca e cenouras');
    cena.efeitos.descartar(); cena.efeitos.descartar();
    assert.equal(cena.scene.meshes.length, 0); assert.equal(cena.scene.materials.length, 0); assert.equal(cena.scene.transformNodes.length, 0);
    cena.efeitos.atualizar(s.f + 1, s);
  } finally { cena.fechar(); }
  const outra = await preparar();
  outra.scene.dispose();
  assert.doesNotThrow(() => outra.efeitos.descartar(), 'Encerrar a cena também libera o pool');
  outra.fechar();
});

test('Chuva de Cenouras acompanha o Final real dos dois lados e encerra ao terminar a fase', async () => {
  for (const lado of [0, 1]) {
    const cena = await preparar();
    try {
      const s = estado(lado === 0 ? ['pipoca', 'uivo'] : ['uivo', 'pipoca']);
      s.fase = 'acaba'; s.vencedor = lado;
      s.p[0].x = 180 * K.U; s.p[1].x = 220 * K.U;
      const quantidade = cena.scene.meshes.length;
      const entradas = [0, 0]; entradas[lado] = K.B.S;
      K.passo(s, entradas); desenhar(cena, s);
      assert.equal(s.fase, 'final', 'O motor decide a entrada do Final');
      assert.equal(s.p[1 - lado].estado, 'vitimaFinal');
      const chuva = cena.scene.transformNodes.filter(n => /^pipoca-final-cenoura-\d+$/.test(n.name));
      assert.equal(chuva.length, 8);
      const vistos = new Set();
      for (let i = 0; i < 205; i++) {
        K.passo(s, [0, 0]); desenhar(cena, s);
        assert.equal(cena.scene.meshes.length, quantidade, 'As dezoito quedas reutilizam geometria');
        const visiveis = chuva.filter(n => n.isEnabled());
        assert.ok(visiveis.length <= 6, 'No máximo seis cenouras caem simultaneamente');
        for (const raiz of visiveis) {
          assert.ok(raiz.position.y >= .4 && raiz.position.y <= 140 / 24);
          assert.ok(Math.abs(raiz.position.x - (s.p[1 - lado].x / K.U - K.LARGURA / 2) / 24) <= 20 / 24 + 1e-8);
          vistos.add(raiz.name);
        }
        const congelado = retrato(cena);
        desenhar(cena, s);
        assert.deepEqual(retrato(cena), congelado, 'Render repetido não reaplica impacto ou desloca a chuva');
      }
      assert.equal(vistos.size, 8, 'Todos os slots são reutilizados ao longo do Final');
      assert.equal(s.fase, 'fim');
      assert.ok(chuva.every(n => !n.isEnabled()));
    } finally { cena.fechar(); }
  }
});

test('Final reduzido usa marcadores imóveis; outro vencedor não recebe a assinatura da Pipoca', async () => {
  const cena = await preparar({ matches: true });
  try {
    const s = estado(); s.fase = 'final'; s.vencedor = 0; s.fT = 32; s.f = 32;
    desenhar(cena, s);
    const chuva = cena.scene.transformNodes.filter(n => /^pipoca-final-cenoura-\d+$/.test(n.name));
    const visiveis = chuva.filter(n => n.isEnabled());
    assert.equal(visiveis.length, 1);
    const posicao = visiveis[0].position.asArray();
    s.f++; s.fT++; desenhar(cena, s);
    assert.deepEqual(visiveis[0].position.asArray(), posicao, 'Preferência elimina a queda decorativa');
    s.f++; s.fT++; s.vencedor = 1; desenhar(cena, s);
    assert.ok(chuva.every(n => !n.isEnabled()), 'Assinatura não aparece no Final de outro personagem');
    cena.efeitos.limpar();
    assert.ok(cena.scene.meshes.every(m => !m.isEnabled()));
  } finally { cena.fechar(); }
});
