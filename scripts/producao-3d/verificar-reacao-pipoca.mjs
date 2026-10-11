// Importador real, animação por relógio do motor e skinning CPU; não usa GPU.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { carregarModelo } from '../../src/3d/modelo-glb.js';
import { descreverPose } from '../../src/3d/estado-visual.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const bytes = readFileSync(resolve(raiz, 'public/modelos/estudos/pipoca-reacao-v8.glb'));
const engine = new NullEngine(), scene = new Scene(engine);
let modelo;
try {
  modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
  assert.equal(scene.animationGroups.length, 31);
  const malhas = scene.meshes.filter(m => m.skeleton && m.getTotalVertices());
  const esqueleto = malhas[0].skeleton;
  const ossos = esqueleto.bones;
  const no = nome => ossos.find(b => b.name === nome).getTransformNode();
  const posicao = nome => { no(nome).computeWorldMatrix(true); return no(nome).getAbsolutePosition().clone(); };
  const assinar = () => ossos.map(osso => {
    const t = osso.getTransformNode();
    return { nome: osso.name, posicao: t.position.asArray(), escala: t.scaling.asArray(), rotacao: t.rotationQuaternion.asArray() };
  });
  function erroPose(a, b) {
    return Math.max(...a.flatMap((osso, i) => [
      ...osso.posicao.map((v, j) => Math.abs(v - b[i].posicao[j])),
      ...osso.escala.map((v, j) => Math.abs(v - b[i].escala[j])),
      ...osso.rotacao.map((v, j) => Math.abs(v -
        (osso.rotacao.reduce((s, r, k) => s + r * b[i].rotacao[k], 0) < 0 ? -1 : 1) * b[i].rotacao[j])),
    ]));
  }
  let renderizacoes = 0;
  function desenhar(estado, lutador = estado.p[0]) {
    const antes = JSON.stringify(estado);
    modelo.atualizar(descreverPose(lutador, K, estado));
    for (const malha of malhas) {
      malha.computeWorldMatrix(true); malha.skeleton.prepare(true);
      assert.ok(Array.from(malha.skeleton.getTransformMatrices(malha)).every(Number.isFinite), 'Skinning contém matrizes finitas');
    }
    assert.equal(JSON.stringify(estado), antes, 'Importador preserva o estado completo da simulação');
    renderizacoes++;
  }
  const estado = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
  const lutador = { ...estado.p[0], x: K.LARGURA * K.U / 2, y: 0, estado: 'parado', sumido: 0, golpe: null };
  let erroMaximoPe = 0, erroMaximoSola = 0, erroRecuperacao = 0;
  const amostras = [];
  let guardaCompleta;
  for (const face of [1, -1]) {
    Object.assign(lutador, { face, estado: 'parado', t: 0 });
    desenhar(estado, lutador);
    const guarda = assinar(); guardaCompleta = guarda;
    const cabeca = posicao('cabeca'), peito = posicao('peito');
    const ancoras = { E: posicao('pe_E'), D: posicao('pe_D') };
    let picoRecuo = 0;
    for (let q = 0; q <= 12; q += .5) {
      Object.assign(lutador, { estado: 'dano', t: q });
      desenhar(estado, lutador);
      const recuoCabeca = (cabeca.x - posicao('cabeca').x) * face;
      const recuoPeito = (peito.x - posicao('peito').x) * face;
      picoRecuo = Math.max(picoRecuo, recuoCabeca);
      if (q === 0) assert.ok(recuoCabeca > .08 && recuoPeito > .04, `Impacto imediato na face ${face}`);
      for (const lado of ['E', 'D']) erroMaximoPe = Math.max(erroMaximoPe, posicao(`pe_${lado}`).subtract(ancoras[lado]).length());
      if (q >= 7) erroRecuperacao = Math.max(erroRecuperacao, erroPose(assinar(), guarda));
      const alturas = { E: Infinity, D: Infinity };
      for (const malha of malhas) {
        const ids = malha.getVerticesData('matricesIndices'), vertices = malha.getPositionData(true, false);
        for (const lado of ['E', 'D']) {
          const indice = ossos.find(b => b.name === `pe_${lado}`).getIndex();
          for (let i = 0; i < vertices.length / 3; i++) if (ids[i * 4] === indice) {
            const v = Vector3.TransformCoordinates(Vector3.FromArray(vertices, i * 3), malha.getWorldMatrix());
            alturas[lado] = Math.min(alturas[lado], v.y);
          }
        }
      }
      for (const altura of Object.values(alturas)) {
        assert.ok(Number.isFinite(altura), 'Solas identificáveis na malha importada');
        erroMaximoSola = Math.max(erroMaximoSola, Math.abs(altura));
      }
      if (Number.isInteger(q)) amostras.push({ face, quadro: q, recuoCabeca, recuoPeito });
    }
    assert.ok(picoRecuo > .12, `Cabeça recua nas duas orientações: face ${face}`);
  }
  assert.ok(erroMaximoPe < .001, 'Pés ancorados em meios quadros');
  assert.ok(erroMaximoSola < .001, 'Solas permanecem no chão');
  assert.ok(erroRecuperacao < 1e-5, 'Todos os 20 ossos recuperam a guarda no quadro 7');

  // Acerto real em combo força o menor hitstun de 8 quadros e um hitstop real.
  const luta = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
  luta.fase = 'luta'; luta.fT = 0;
  const [vitima, atacante] = luta.p;
  Object.assign(vitima, { x: 225 * K.U, face: -1, estado: 'dano', combo: 20, stun: 80 });
  Object.assign(atacante, { x: 200 * K.U, face: 1, estado: 'golpe', golpe: 'p1', t: K.LUTADORES.uivo.golpes.p1.janelas[0].de - 1 });
  K.passo(luta, [0, 0]);
  assert.ok(luta.ev.some(e => e.t === 'acerto'));
  assert.equal(vitima.stun, 8);
  assert.equal(vitima.t, 0);
  desenhar(luta);
  const congelada = assinar(), relogio = vitima.t;
  const quadrosHitstop = luta.hitstop;
  assert.ok(quadrosHitstop > 0);
  for (let i = 0; i < quadrosHitstop; i++) {
    K.passo(luta, [0, 0]);
    for (let j = 0; j < 10; j++) desenhar(luta);
    assert.equal(vitima.t, relogio, 'Hitstop congela o relógio de dano');
    assert.ok(erroPose(assinar(), congelada) < 1e-7, 'Desenhar repetidamente não acumula movimento');
  }
  for (let q = 1; q <= 7; q++) {
    K.passo(luta, [0, 0]); desenhar(luta);
    assert.equal(vitima.estado, 'dano'); assert.equal(vitima.t, q);
  }
  assert.ok(erroPose(assinar(), guardaCompleta) < 1e-5, 'Guarda recuperada antes do menor hitstun terminar');
  K.passo(luta, [0, 0]); desenhar(luta);
  assert.equal(vitima.estado, 'parado');

  const relatorio = { aprovadoFinal: false, clips: 31, faces: [1, -1], amostrasReacao: 50,
    erroMaximoPe, erroMaximoSola, erroRecuperacao, recuperacaoQuadro: 7, stunMinimoMotor: 8,
    impactoDesdeInicio: true, guardaRecuperadaAntesDoFimDoStun: true, quadrosHitstop,
    repeticoesPorQuadroCongelado: 10, renderizacoes, simulacaoPreservada: true, gpuUsada: false, amostras,
    limites: ['Reação genérica; não varia direção e intensidade por golpe.', 'Arte provisória; rosto, quedas e demais movimentos continuam em revisão.'] };
  modelo.descartar(); modelo = null;
  assert.equal(scene.animationGroups.length, 0); assert.equal(scene.skeletons.length, 0);
  writeFileSync(resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo/importacao-v8.json'), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(JSON.stringify(relatorio));
} finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
