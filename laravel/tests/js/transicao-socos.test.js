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
const bytes = fs.readFileSync(path.resolve(__dirname, '../../../public/modelos/estudos/pipoca-socos-v6.glb'));

async function preparar() {
  const [{ NullEngine }, { Scene }, , { carregarModelo }] = await modulos;
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
    for (const propriedade of ['posicao', 'escala']) {
      assert.ok(atual[i][propriedade].every((v, j) => Math.abs(v - esperado[i][propriedade][j]) < 1e-6), `${mensagem}: ${atual[i].nome}.${propriedade}`);
    }
    const produto = atual[i].rotacao.reduce((s, v, j) => s + v * esperado[i].rotacao[j], 0);
    assert.ok(Math.abs(1 - Math.abs(produto)) < 1e-6, `${mensagem}: ${atual[i].nome}.rotacao`);
  }
}

async function verticesLuvaDireita(scene) {
  const [, , { Vector3 }] = await modulos;
  const luvas = scene.meshes.find(m => m.material?.name === 'pipoca_luvas_vermelhas');
  assert.ok(luvas);
  luvas.computeWorldMatrix(true);
  luvas.skeleton.prepare(true);
  const junta = luvas.skeleton.bones.find(b => b.name === 'mao_D').getIndex();
  const juntas = luvas.getVerticesData('matricesIndices');
  const posicoes = luvas.getPositionData(true, false);
  const vertices = [];
  for (let i = 0; i < posicoes.length / 3; i++) if (juntas[i * 4] === junta) {
    vertices.push(...Vector3.TransformCoordinates(Vector3.FromArray(posicoes, i * 3), luvas.getWorldMatrix()).asArray());
  }
  assert.ok(vertices.length > 0);
  return vertices;
}

test('cancelamento real do jab preserva a pose, congela no hitstop e chega ao contato exato do p2', async () => {
  const [, , , , { descreverPose }] = await modulos;
  const cena = await preparar();
  const referencia = await preparar();
  try {
    const estado = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
    estado.fase = 'luta'; estado.fT = 0;
    estado.p[0].x = 200 * K.U; estado.p[1].x = 225 * K.U;
    estado.p[0].face = 1; estado.p[1].face = -1;
    function desenhar(alvo = cena) {
      const antes = JSON.stringify(estado);
      alvo.modelo.atualizar(descreverPose(estado.p[0], K, estado));
      assert.equal(JSON.stringify(estado), antes, 'Renderizar preserva o estado completo da simulação');
    }
    for (let i = 0; i < 3; i++) { K.passo(estado, [i === 0 ? K.B.P : 0, 0]); desenhar(); }
    assert.equal(estado.p[0].golpe, 'p1');
    assert.equal(estado.p[0].t, 3);
    assert.ok(estado.hitstop > 0);
    const jabEstendido = ossos(cena.scene);
    for (let i = 0; estado.p[0].golpe === 'p1' && i < 12; i++) {
      K.passo(estado, [i === 1 ? K.B.P : 0, 0]); desenhar();
    }
    assert.equal(estado.p[0].golpe, 'p2');
    assert.equal(estado.p[0].t, 1, 'O motor expõe primeiro o quadro 1 do segundo soco');
    posesIguais(ossos(cena.scene), jabEstendido, 'A emenda não recolhe a luva instantaneamente');

    K.passo(estado, [0, 0]); desenhar();
    assert.equal(estado.p[0].t, 2);
    const intermediaria = ossos(cena.scene);
    assert.ok(intermediaria.some((osso, i) => osso.rotacao.some((v, j) => Math.abs(v - jabEstendido[i].rotacao[j]) > 1e-4)), 'A preparação avança depois do primeiro quadro');
    for (let i = 0; i < 20; i++) desenhar();
    posesIguais(ossos(cena.scene), intermediaria, 'Repetir o quadro não acumula interpolação');

    while (estado.p[0].t < 4) { K.passo(estado, [0, 0]); desenhar(); }
    desenhar(referencia);
    posesIguais(ossos(cena.scene), ossos(referencia.scene), 'O quadro 4 já é exatamente o p2 autoral');
    K.passo(estado, [0, 0]); desenhar(); desenhar(referencia);
    assert.equal(estado.p[0].t, 5);
    const contato = await verticesLuvaDireita(cena.scene);
    const contatoIsolado = await verticesLuvaDireita(referencia.scene);
    assert.ok(contato.every((v, i) => Math.abs(v - contatoIsolado[i]) < 1e-6), 'A luva deformada chega ao contato sem resíduos da transição');
    assert.ok(estado.hitstop > 0);
    const poseContato = ossos(cena.scene);
    K.passo(estado, [0, 0]); desenhar();
    assert.equal(estado.p[0].t, 5);
    posesIguais(ossos(cena.scene), poseContato, 'Hitstop congela também a transição visual');
  } finally { cena.fechar(); referencia.fechar(); }
});

test('emenda no quadro zero preserva ossos, aplica raiz e face diretamente e ignora transição tardia', async () => {
  const cena = await preparar();
  const referencia = await preparar();
  try {
    const pose = { clip: 'p1', quadro: 5, ciclico: false, x: 0, y: 0, face: 1, visivel: true };
    cena.modelo.atualizar(pose);
    const anterior = ossos(cena.scene);
    const inicio = { ...pose, clip: 'p2', quadro: 0, x: 2, y: .25, face: -1 };
    cena.modelo.atualizar(inicio);
    posesIguais(ossos(cena.scene), anterior, 'Quadro zero preserva pose local');
    const raiz = cena.scene.getTransformNodeByName('modelo-pipoca');
    assert.deepEqual(raiz.position.asArray(), [2, .25, 0]);
    assert.equal(raiz.rotation.y, Math.PI, 'Face pertence à simulação, sem interpolação');
    for (const quadro of [4, 5]) {
      cena.modelo.atualizar({ ...pose, quadro: 3 });
      const tardia = { ...inicio, quadro };
      cena.modelo.atualizar(tardia);
      referencia.modelo.atualizar(tardia);
      posesIguais(ossos(cena.scene), ossos(referencia.scene), `Chegar no quadro ${quadro} aplica o clip diretamente`);
    }
  } finally { cena.fechar(); referencia.fechar(); }
});
