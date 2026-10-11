const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('@babylonjs/core/Engines/nullEngine.js'),
  import('@babylonjs/core/scene.js'),
  import('../../../src/3d/modelo-glb.js'),
  import('../../../src/3d/estado-visual.mjs'),
]);

function luta() {
  const estado = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
  estado.fase = 'luta'; estado.fT = 0;
  return estado;
}

function descreverSemMutacao(estado, descreverPose) {
  const antes = JSON.stringify(estado);
  const pose = descreverPose(estado.p[0], K, estado);
  assert.equal(JSON.stringify(estado), antes, 'Descrever a pose preserva o estado do motor');
  return pose;
}

async function preparar() {
  const [{ NullEngine }, { Scene }, { carregarModelo }] = await modulos;
  const bytes = fs.readFileSync(path.resolve(__dirname, '../../../public/modelos/estudos/pipoca-defesa-v7.glb'));
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
    return { scene, modelo, fechar() { modelo.descartar(); scene.dispose(); engine.dispose(); } };
  } catch (erro) { scene.dispose(); engine.dispose(); throw erro; }
}

function ossos(scene) {
  return scene.skeletons[0].bones.map(osso => {
    const no = osso.getTransformNode();
    return { nome: osso.name, posicao: no.position.asArray(), escala: no.scaling.asArray(), rotacao: no.rotationQuaternion.asArray() };
  });
}

function posesIguais(atual, esperado, mensagem) {
  assert.equal(atual.length, esperado.length);
  for (let i = 0; i < atual.length; i++) {
    assert.equal(atual[i].nome, esperado[i].nome);
    for (const chave of ['posicao', 'escala']) assert.ok(atual[i][chave].every((v, j) => Math.abs(v - esperado[i][chave][j]) < 1e-6), `${mensagem}: ${atual[i].nome}.${chave}`);
    const produto = atual[i].rotacao.reduce((s, v, j) => s + v * esperado[i].rotacao[j], 0);
    assert.ok(Math.abs(1 - Math.abs(produto)) < 1e-6, `${mensagem}: ${atual[i].nome}.rotacao`);
  }
}

function desenhar(cena, estado, descreverPose) {
  const antes = JSON.stringify(estado);
  const pose = descreverPose(estado.p[0], K, estado);
  cena.modelo.atualizar(pose);
  assert.equal(JSON.stringify(estado), antes, 'Renderizar preserva o estado completo do motor');
  return pose;
}

test('relógio da defesa acompanha a fase enquanto t permanece em 1 e congela no hitstop', async () => {
  const [, , , { descreverPose }] = await modulos;
  const estado = luta();
  for (const entrada of [K.B.D_, K.B.D_ | K.B.D]) {
    for (let i = 0; i < 12; i++) {
      K.passo(estado, [entrada, 0]);
      const pose = descreverSemMutacao(estado, descreverPose);
      assert.equal(estado.p[0].t, 1, 'O relógio do estado é reiniciado pelo botão segurado');
      assert.equal(pose.quadro, estado.fT);
      assert.equal(pose.ciclico, true);
      assert.equal(descreverPose(estado.p[0], K).quadro, 1, 'Sem estado mantém fallback compatível');
    }
  }
  const congelada = descreverSemMutacao(estado, descreverPose);
  estado.hitstop = 3;
  for (let i = 0; i < 3; i++) {
    K.passo(estado, [K.B.D_ | K.B.D, 0]);
    assert.deepEqual(descreverSemMutacao(estado, descreverPose), congelada);
  }
  K.passo(estado, [K.B.D_ | K.B.D, 0]);
  assert.equal(descreverSemMutacao(estado, descreverPose).quadro, congelada.quadro + 1);
  for (const estadoDoLutador of ['parado', 'andando', 'golpe']) {
    const lutador = { ...estado.p[0], estado: estadoDoLutador, golpe: estadoDoLutador === 'golpe' ? 'p1' : null, t: 7 };
    assert.equal(descreverPose(lutador, K, estado).quadro, 7, 'Demais estados continuam usando seu próprio relógio');
  }
});

test('entrada aplica a defesa inteira e o ciclo continua animado com o botão segurado', async () => {
  const [, , , { descreverPose }] = await modulos;
  const cena = await preparar();
  const referencia = await preparar();
  try {
    const estado = luta();
    estado.p[0].t = 52;
    desenhar(cena, estado, descreverPose);
    K.passo(estado, [K.B.D_, 0]);
    desenhar(cena, estado, descreverPose); desenhar(referencia, estado, descreverPose);
    posesIguais(ossos(cena.scene), ossos(referencia.scene), 'A entrada não interpola a guarda aberta');
    const primeira = ossos(cena.scene);
    const grupo = cena.scene.animationGroups.find(g => g.name === 'defesa');
    const duracao = Math.round((grupo.to - grupo.from) / grupo.targetedAnimations[0].animation.framePerSecond * 60);
    assert.ok(duracao > 4);
    let mudou = false;
    for (let i = 0; i < duracao; i++) {
      K.passo(estado, [K.B.D_, 0]);
      desenhar(cena, estado, descreverPose);
      assert.equal(estado.p[0].t, 1);
      const atual = ossos(cena.scene);
      mudou ||= atual.some((osso, j) => osso.rotacao.some((v, k) => Math.abs(v - primeira[j].rotacao[k]) > 1e-4));
    }
    assert.ok(mudou, 'Segurar defesa não prende a malha no quadro 1');
    posesIguais(ossos(cena.scene), primeira, 'O ciclo retorna à mesma pose sem salto');
  } finally { cena.fechar(); referencia.fechar(); }
});

test('bloqueio protege no primeiro passo e a saída visual segue soltura, hitstop e t até 4', async () => {
  const [, , , { descreverPose }] = await modulos;
  const cena = await preparar();
  const referencia = await preparar();
  try {
    const estado = luta();
    const [defensor, atacante] = estado.p;
    defensor.x = 225 * K.U; atacante.x = 200 * K.U;
    defensor.face = -1; atacante.face = 1;
    atacante.estado = 'golpe'; atacante.golpe = 'p1';
    atacante.t = K.LUTADORES.uivo.golpes.p1.janelas[0].de - 1;
    const vida = defensor.vida;
    desenhar(cena, estado, descreverPose);
    K.passo(estado, [K.B.D_, 0]);
    desenhar(cena, estado, descreverPose); desenhar(referencia, estado, descreverPose);
    assert.equal(defensor.estado, 'defesa');
    assert.equal(defensor.vida, vida);
    assert.ok(estado.ev.some(e => e.t === 'defendeu'));
    posesIguais(ossos(cena.scene), ossos(referencia.scene), 'Primeiro passo já mostra defesa completa');
    const defendendo = ossos(cena.scene);
    while (estado.hitstop > 0) {
      K.passo(estado, [0, 0]);
      desenhar(cena, estado, descreverPose);
      assert.equal(defensor.estado, 'defesa');
      posesIguais(ossos(cena.scene), defendendo, 'Soltar durante hitstop não antecipa a saída');
    }
    K.passo(estado, [0, 0]); desenhar(cena, estado, descreverPose);
    assert.equal(defensor.estado, 'parado');
    assert.equal(defensor.t, 1);
    assert.ok(defensor.stun > 0, 'O motor permite soltar defesa mesmo com stun residual');
    posesIguais(ossos(cena.scene), defendendo, 'A saída começa da última pose exibida');
    const raiz = cena.scene.getTransformNodeByName('modelo-pipoca');
    const pose = descreverPose(defensor, K, estado);
    assert.deepEqual(raiz.position.asArray(), [pose.x, pose.y, 0]);
    assert.equal(raiz.rotation.y, Math.PI);

    K.passo(estado, [0, 0]); desenhar(cena, estado, descreverPose);
    const intermediaria = ossos(cena.scene);
    assert.ok(intermediaria.some((osso, i) => osso.rotacao.some((v, j) => Math.abs(v - defendendo[i].rotacao[j]) > 1e-4)));
    estado.hitstop = 2;
    for (let i = 0; i < 2; i++) {
      K.passo(estado, [0, 0]);
      for (let j = 0; j < 10; j++) desenhar(cena, estado, descreverPose);
      posesIguais(ossos(cena.scene), intermediaria, 'Quadro repetido e hitstop não acumulam o relaxamento');
    }
    while (defensor.t < 4) { K.passo(estado, [0, 0]); desenhar(cena, estado, descreverPose); }
    referencia.modelo.atualizar({ ...descreverPose(defensor, K, estado), clip: 'p1', quadro: 0, ciclico: false });
    desenhar(referencia, estado, descreverPose);
    posesIguais(ossos(cena.scene), ossos(referencia.scene), 'No quadro 4 a saída chegou à guarda exata');
  } finally { cena.fechar(); referencia.fechar(); }
});
