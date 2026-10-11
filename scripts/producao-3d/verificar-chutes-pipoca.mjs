// Exercita o importador real do laboratório sem abrir navegador ou usar GPU.
// k1: dois chutes médios (perna E e depois D); k2: chute alto de perna E.
// A perna que chuta é DETECTADA pelos dados (desvio do pé em relação à âncora),
// não rotulada à mão; a perna de apoio deve ficar ancorada a menos de 1 mm.
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
const bytes = readFileSync(resolve(raiz, 'public/modelos/estudos/pipoca-chutes-v12.glb'));
const engine = new NullEngine();
const scene = new Scene(engine);
try {
  const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
  const estado = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
  const antes = JSON.stringify(estado);
  const grupos = [...scene.animationGroups];
  assert.equal(grupos.length, 31);
  const raizModelo = scene.getTransformNodeByName('modelo-pipoca');
  const malhas = raizModelo.getChildMeshes().filter(m => m.getTotalVertices() && m.skeleton);
  assert.ok(malhas.length > 0);
  const esqueleto = malhas[0].skeleton;
  const osso = nome => esqueleto.bones.find(b => b.name === nome);
  const indices = { E: osso('pe_E').getIndex(), D: osso('pe_D').getIndex() };
  // Âncoras dos pés na guarda completa (parado v4) por face.
  const repousoPe = new Map();
  const soleEmRepouso = new Map();
  const p = { ...estado.p[0], x: K.LARGURA * K.U / 2, y: 0, sumido: false };
  for (const face of [1, -1]) {
    modelo.atualizar(descreverPose({ ...p, estado: 'parado', face, t: 0 }, K, estado));
    for (const malha of malhas) { malha.computeWorldMatrix(true); malha.skeleton.prepare(true); }
    for (const lado of ['E', 'D']) {
      const no = osso(`pe_${lado}`).getTransformNode(); no.computeWorldMatrix(true);
      repousoPe.set(`${face}:${lado}`, no.getAbsolutePosition().clone());
    }
    for (const malha of malhas) {
      const juntas = malha.getVerticesData('matricesIndices');
      const posicoes = malha.getPositionData(true, false);
      for (let i = 0; i < posicoes.length / 3; i++) {
        for (const lado of ['E', 'D']) if (juntas[i * 4] === indices[lado]) {
          const v = Vector3.TransformCoordinates(Vector3.FromArray(posicoes, i * 3), malha.getWorldMatrix());
          const chave = `${face}:${lado}`;
          if (!soleEmRepouso.has(chave) || v.y < soleEmRepouso.get(chave)) soleEmRepouso.set(chave, v.y);
        }
      }
    }
  }

  // Leitura por quadro: posição dos ossos do pé e extensão dos vértices por lado.
  function ler(quadro, face, golpeNome) {
    modelo.atualizar(descreverPose({ ...p, estado: 'golpe', golpe: golpeNome, face, t: quadro }, K, estado));
    for (const malha of malhas) {
      malha.computeWorldMatrix(true);
      malha.skeleton.prepare(true);
      assert.ok(Array.from(malha.skeleton.getTransformMatrices(malha)).every(Number.isFinite), 'Matrizes finitas após importação');
    }
    const posicao = {}, caixas = { E: [Infinity, -Infinity, Infinity, -Infinity], D: [Infinity, -Infinity, Infinity, -Infinity] };
    for (const lado of ['E', 'D']) {
      const no = osso(`pe_${lado}`).getTransformNode(); no.computeWorldMatrix(true);
      posicao[lado] = no.getAbsolutePosition().clone();
    }
    for (const malha of malhas) {
      const juntas = malha.getVerticesData('matricesIndices');
      const posicoes = malha.getPositionData(true, false);
      for (let i = 0; i < posicoes.length / 3; i++) {
        const indice = juntas[i * 4];
        const lado = indice === indices.E ? 'E' : indice === indices.D ? 'D' : null;
        if (!lado) continue;
        const v = Vector3.TransformCoordinates(Vector3.FromArray(posicoes, i * 3), malha.getWorldMatrix());
        const c = caixas[lado];
        c[0] = Math.min(c[0], v.x * face); c[1] = Math.max(c[1], v.x * face);
        c[2] = Math.min(c[2], v.y); c[3] = Math.max(c[3], v.y);
      }
    }
    return { posicao, caixas };
  }

  const relatos = {};
  for (const nome of ['k1', 'k2']) {
    const golpe = K.LUTADORES.pipoca.golpes[nome];
    const dur = golpe.dur;
    const janelas = golpe.janelas.map(j => [j.de, j.ate]);
    const relato = { dur, janelas, faces: {} };
    let alcanceMaximo = { x: -Infinity };
    for (const face of [1, -1]) {
      let erroMaximoApoio = 0;
      let piorSemApoio = null;
      const quadros = [];
      for (let q = 0; q <= dur; q += .5) quadros.push(ler(q, face, nome));
      const relatoFace = { janelas: [] };
      for (let wi = 0; wi < janelas.length; wi++) {
        const [de, ate] = janelas[wi];
        // Soma de desvio por lado na janela: quem descola da âncora é quem chuta.
        const soma = { E: 0, D: 0 };
        let pico = { mao: null, lado: null, q: de };
        for (let q = de; q <= ate; q += .5) {
          const f = quadros[Math.round(q * 2)];
          for (const lado of ['E', 'D']) {
            const dev = f.posicao[lado].subtract(repousoPe.get(`${face}:${lado}`)).length();
            if (q === de) soma[lado] = dev; else soma[lado] += dev;
          }
          if (q >= de && q <= ate) {
            const devE = f.posicao.E.subtract(repousoPe.get(`${face}:E`)).length();
            const devD = f.posicao.D.subtract(repousoPe.get(`${face}:D`)).length();
            const maior = devE > devD ? { lado: 'E', dev: devE } : { lado: 'D', dev: devD };
            if (!pico.lado || maior.dev > pico.dev) pico = { lado: maior.lado, dev: maior.dev, q, f };
          }
        }
        const chute = soma.E > soma.D ? 'E' : 'D';
        assert.ok(chute === 'E' || chute === 'D');
        const picoRel = relatoFace.janelas[wi] = { janela: [de, ate], chute, soma: [soma.E, soma.D] };
        // Limites do pé que chuta no pico da extensão, contra a caixa do motor.
        const [x, y, w, h] = golpe.janelas[wi].caixa;
        const c = pico.f.caixas[chute];
        const [minX, maxX, minY, maxY] = c;
        assert.ok([minX, maxX, minY, maxY].every(Number.isFinite), `Pé ${chute} com valores finitos`);
        assert.ok(maxX >= (x + w) / 24 - .2 && maxX <= (x + w) / 24 + .1,
          `Pé atinge a caixa pela frente no quadro ${pico.q.toFixed(1)} (${nome}, face ${face}): ${maxX.toFixed(3)}`);
        assert.ok(maxY >= -(y + h) / 24 && minY <= -y / 24,
          `Pé sobrepõe a altura real do golpe (${nome}, face ${face}, q ${pico.q.toFixed(1)}): [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);
        assert.ok(minY > .12, `Pé que chuta levanta do chão (${nome}, face ${face}): minY ${minY.toFixed(3)}`);
        const apoio = chute === 'E' ? 'D' : 'E';
        const solaApoio = soleEmRepouso.get(`${face}:${apoio}`);
        assert.ok(pico.f.caixas[apoio][2] <= solaApoio + .01, `Sola do apoio ${apoio} permanece no chão`);
        picoRel.alcance = { quadros: Math.round(pico.q * 2), pe: c, apoio: [pico.f.caixas[apoio][0], pico.f.caixas[apoio][1], pico.f.caixas[apoio][2], pico.f.caixas[apoio][3]] };
        if (c[1] > alcanceMaximo.x) alcanceMaximo = { x: c[1], golpe: nome, face, q: pico.q, lado: chute };
      }
      // Apoio: em TODO quadro, a perna que não chuta (e quando nenhuma chuta, ambas)
      // permanece ancorada; e há sempre pelo menos um pé plantado.
      for (let qi = 0; qi < quadros.length; qi++) {
        const q = qi / 2, f = quadros[qi];
        const dev = { E: f.posicao.E.subtract(repousoPe.get(`${face}:E`)).length(), D: f.posicao.D.subtract(repousoPe.get(`${face}:D`)).length() };
        const chuta = dev.E > .0035 ? 'E' : dev.D > .0035 ? 'D' : null;
        if (chuta) {
          const apoio = chuta === 'E' ? 'D' : 'E';
          erroMaximoApoio = Math.max(erroMaximoApoio, dev[apoio]);
        }
        const menor = Math.min(dev.E, dev.D);
        if (menor > .001) piorSemApoio = [q, dev.E, dev.D];
      }
      assert.ok(erroMaximoApoio < .001, `Perna de apoio ancorada <1 mm (${nome}, face ${face}): ${erroMaximoApoio}`);
      assert.ok(piorSemApoio === null, `${nome} mantém um pé plantado em todo momento: ${piorSemApoio}`);
      // Guarda completa nas duas pontas: ossos e envoltórios idênticos ao começo.
      const inicial = quadros[0], final = quadros[quadros.length - 1];
      for (const lado of ['E', 'D']) {
        const ini = inicial.posicao[lado], fim = final.posicao[lado];
        assert.ok(ini.subtract(fim).length() < .001, `${nome} retorna à âncora da guarda (${lado})`);
      }
      for (const lado of ['E', 'D']) for (let k = 0; k < 4; k++)
        assert.ok(Math.abs(inicial.caixas[lado][k] - final.caixas[lado][k]) < .002, `${nome} retorna ao envoltório da guarda (${lado})`);
      relatoFace.erroMaximoApoio = erroMaximoApoio;
      relato.faces[face] = relatoFace;
    }
    // k1 alterna a perna entre as duas janelas; k2 tem janela única (E).
    if (nome === 'k1') {
      const [w0, w1] = [relato.faces[1].janelas[0].chute, relato.faces[1].janelas[1].chute];
      assert.notEqual(w0, w1, 'k1 alterna a perna entre as janelas');
      assert.deepEqual(w0, 'E', 'k1 janela 0 com perna E');
      assert.deepEqual(w1, 'D', 'k1 janela 1 com perna D');
    }
    if (nome === 'k2') assert.deepEqual(relato.faces[1].janelas[0].chute, 'E', 'k2 janela com perna E');
    assert.equal(relato.faces[-1].janelas[0].chute, relato.faces[1].janelas[0].chute, 'Espelhamento preserva o lado');
    relato.alcanceMaximo = alcanceMaximo;
    relatos[nome] = relato;
  }
  assert.equal(JSON.stringify(estado), antes, 'Estado da simulação preservado');
  const relatorio = { aprovadoFinal: false, caminho: 'public/modelos/estudos/pipoca-chutes-v12.glb', bytes: bytes.length,
    clips: grupos.length, golpes: relatos, "apoioMaximo (m)": Object.fromEntries(Object.entries(relatos).map(([n, r]) => [n, Math.max(...Object.values(r.faces).map(f => f.erroMaximoApoio))])),
    alcanceMaximoGeral: relatos.k2.alcanceMaximo, guardaRetornaNasPontas: true, estadoPreservado: true,
    limites: ['Contato visual ainda pendente.', 'Pernas curtas do rig limitam o alcance do chute alto à borda da caixa.', 'Demais clips permanecem em revisão.'] };
  writeFileSync(resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo/importacao-v12.json'), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(JSON.stringify(relatorio, null, 2));
  engine.dispose();
} catch (erro) {
  engine.dispose();
  throw erro;
}