// Exercita o mesmo importador do laboratório, incluindo poses entre as chaves.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { carregarModelo } from '../../src/3d/modelo-glb.js';
import { descreverPose } from '../../src/3d/estado-visual.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const PASSO = .25;
const LADOS = { k1: ['E', 'D'], k2: ['E'] };

function poseLocal(ossos) {
  return ossos.map(osso => {
    const no = osso.getTransformNode();
    return { nome: osso.name, posicao: no.position.asArray(), rotacao: no.rotationQuaternion.asArray(), escala: no.scaling.asArray() };
  });
}

function conferirGuarda(atual, guarda, mensagem) {
  assert.equal(atual.length, guarda.length);
  for (let i = 0; i < atual.length; i++) {
    assert.equal(atual[i].nome, guarda[i].nome);
    for (const campo of ['posicao', 'escala']) assert.ok(atual[i][campo].every((v, j) => Math.abs(v - guarda[i][campo][j]) < .001), `${mensagem}: ${atual[i].nome}.${campo}`);
    const produto = atual[i].rotacao.reduce((s, v, j) => s + v * guarda[i].rotacao[j], 0);
    assert.ok(Math.abs(1 - Math.abs(produto)) < 1e-6, `${mensagem}: ${atual[i].nome}.rotacao`);
  }
}

export async function verificarChutes(bytes, simulador = K) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  let modelo;
  try {
    const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
    modelo = await carregarModelo(buffer, 'pipoca', simulador, scene);
    const estado = simulador.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
    const antes = JSON.stringify(estado);
    assert.equal(scene.animationGroups.length, 31);
    const malhas = modelo.malhas.filter(m => m.skeleton);
    assert.ok(malhas.length > 0);
    const esqueleto = malhas[0].skeleton;
    const pes = Object.fromEntries(['E', 'D'].map(lado => [lado, esqueleto.bones.find(b => b.name === `pe_${lado}`)]));
    assert.ok(pes.E && pes.D);
    const vertices = malhas.map(malha => {
      const juntas = malha.getVerticesData('matricesIndices');
      const pesos = malha.getVerticesData('matricesWeights');
      const porLado = { E: [], D: [] };
      for (let i = 0; i < malha.getTotalVertices(); i++) for (const lado of ['E', 'D']) {
        if (juntas[i * 4] === pes[lado].getIndex() && pesos[i * 4] > .99) porLado[lado].push(i);
      }
      return { malha, porLado };
    });
    const p = { ...estado.p[0], x: simulador.LARGURA * simulador.U / 2, y: 0, sumido: false };

    function ler(clip, quadro, face) {
      modelo.atualizar(descreverPose({ ...p, estado: clip === 'parado' ? 'parado' : 'golpe', golpe: clip, face, t: quadro }, simulador, estado));
      const posicao = {}, caixas = { E: [Infinity, -Infinity, Infinity, -Infinity], D: [Infinity, -Infinity, Infinity, -Infinity] };
      for (const { malha, porLado } of vertices) {
        malha.computeWorldMatrix(true); malha.skeleton.prepare(true);
        assert.ok(Array.from(malha.skeleton.getTransformMatrices(malha)).every(Number.isFinite), 'Matrizes finitas após importação');
        const posicoes = malha.getPositionData(true, false);
        for (const lado of ['E', 'D']) for (const i of porLado[lado]) {
          const v = Vector3.TransformCoordinates(Vector3.FromArray(posicoes, i * 3), malha.getWorldMatrix());
          const c = caixas[lado];
          c[0] = Math.min(c[0], v.x * face); c[1] = Math.max(c[1], v.x * face);
          c[2] = Math.min(c[2], v.y); c[3] = Math.max(c[3], v.y);
        }
      }
      for (const lado of ['E', 'D']) {
        const no = pes[lado].getTransformNode(); no.computeWorldMatrix(true);
        posicao[lado] = no.getAbsolutePosition().clone();
        assert.ok(caixas[lado].every(Number.isFinite), `Pé ${lado} com malha e valores finitos`);
      }
      return { posicao, caixas, ossos: poseLocal(esqueleto.bones) };
    }

    const relatos = {};
    let amostras = 0, menorSola = Infinity, maiorErroSolaApoio = 0;
    for (const nome of ['k1', 'k2']) {
      const golpe = simulador.LUTADORES.pipoca.golpes[nome];
      assert.ok(golpe.janelas.length > 0 && golpe.janelas.length <= LADOS[nome].length);
      const relato = { dur: golpe.dur, janelas: golpe.janelas.map(j => [j.de, j.ate]), faces: {}, alcanceMaximo: { x: -Infinity } };
      for (const face of [1, -1]) {
        const guarda = ler('parado', 0, face);
        const quadros = [];
        let erroMaximoApoio = 0;
        for (let qi = 0; qi <= golpe.dur / PASSO; qi++) {
          const q = qi * PASSO, f = ler(nome, q, face);
          quadros.push(f); amostras++;
          const desvios = Object.fromEntries(['E', 'D'].map(lado => [lado, f.posicao[lado].subtract(guarda.posicao[lado]).length()]));
          const apoio = desvios.E <= desvios.D ? 'E' : 'D';
          erroMaximoApoio = Math.max(erroMaximoApoio, desvios[apoio]);
          assert.ok(desvios[apoio] < .001, `Há um pé ancorado <1 mm em ${nome}, face ${face}, q${q}: ${JSON.stringify(desvios)}`);
          for (const lado of ['E', 'D']) {
            menorSola = Math.min(menorSola, f.caixas[lado][2]);
            assert.ok(f.caixas[lado][2] >= -.001, `Sola sem penetrar o chão em ${nome}, face ${face}, pé ${lado}, q${q}: ${f.caixas[lado][2]}`);
          }
          const erroSola = Math.abs(f.caixas[apoio][2] - guarda.caixas[apoio][2]);
          maiorErroSolaApoio = Math.max(maiorErroSolaApoio, erroSola);
          assert.ok(erroSola < .001, `Sola do apoio no chão <1 mm em ${nome}, face ${face}, q${q}: ${erroSola}`);
        }
        conferirGuarda(quadros[0].ossos, guarda.ossos, `${nome} começa na guarda completa`);
        conferirGuarda(quadros.at(-1).ossos, guarda.ossos, `${nome} termina na guarda completa`);
        const relatoFace = { erroMaximoApoio, janelas: [] };
        for (let wi = 0; wi < golpe.janelas.length; wi++) {
          const janela = golpe.janelas[wi], chute = LADOS[nome][wi], apoio = chute === 'E' ? 'D' : 'E';
          const [x, y, w, h] = janela.caixa;
          const contatos = [];
          for (let q = janela.de; q <= janela.ate; q += PASSO) {
            const f = quadros[Math.round(q / PASSO)], c = f.caixas[chute];
            assert.ok(f.posicao[chute].subtract(guarda.posicao[chute]).length() > .1, `${nome} usa perna ${chute} na janela ${wi}`);
            assert.ok(f.posicao[apoio].subtract(guarda.posicao[apoio]).length() < .001, `${nome} ancora perna ${apoio} na janela ${wi}, q${q}`);
            assert.ok(c[1] >= (x + w) / 24 - .2 && c[1] <= (x + w) / 24 + .1, `Pé alcança a frente da caixa em ${nome}, face ${face}, q${q}: ${c[1]}`);
            assert.ok(c[1] >= x / 24 && c[0] <= (x + w) / 24, `Contato horizontal em ${nome}, face ${face}, q${q}`);
            assert.ok(c[3] >= -(y + h) / 24 && c[2] <= -y / 24, `Contato na altura da caixa em ${nome}, face ${face}, q${q}: ${c.slice(2)}`);
            assert.ok(c[2] > .12, `Pé atacante levanta do chão em ${nome}, face ${face}, q${q}`);
            contatos.push({ quadro: q, pe: c });
            if (c[1] > relato.alcanceMaximo.x) relato.alcanceMaximo = { x: c[1], golpe: nome, face, q, lado: chute };
          }
          relatoFace.janelas.push({ janela: [janela.de, janela.ate], chute, contatos });
        }
        relato.faces[face] = relatoFace;
      }
      relatos[nome] = relato;
    }
    assert.equal(JSON.stringify(estado), antes, 'Renderizar preserva a simulação');
    const alcanceMaximoGeral = Object.values(relatos).map(r => r.alcanceMaximo).sort((a, b) => b.x - a.x)[0];
    return { aprovadoFinal: false, sha256Glb: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength, clips: scene.animationGroups.length, passoQuadros: PASSO, amostras,
      golpes: relatos, 'apoioMaximo (m)': Object.fromEntries(Object.entries(relatos).map(([n, r]) => [n, Math.max(...Object.values(r.faces).map(f => f.erroMaximoApoio))])),
      menorSola, maiorErroSolaApoio, alcanceMaximoGeral, guardaRetornaNasPontas: true, estadoPreservado: true,
      limites: ['Leitura artística ainda exige inspeção visual.', 'Pernas curtas do rig limitam o alcance do chute alto à borda da caixa.', 'Demais clips permanecem em revisão.'] };
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const argumentoModelo = process.argv.indexOf('--modelo');
  const argumentoRelatorio = process.argv.indexOf('--relatorio');
  const caminho = argumentoModelo >= 0 ? process.argv[argumentoModelo + 1] : 'public/modelos/estudos/pipoca-chutes-v12.glb';
  const destino = argumentoRelatorio >= 0 ? process.argv[argumentoRelatorio + 1] : 'art/premium/modelos-3d/estudos-mixamo/importacao-v12.json';
  assert.ok(caminho && destino, 'Informe os caminhos após --modelo e --relatorio');
  const relatorio = { caminho, ...await verificarChutes(readFileSync(resolve(raiz, caminho))) };
  writeFileSync(resolve(raiz, destino), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(JSON.stringify({ caminho, relatorio: destino, clips: relatorio.clips,
    amostras: relatorio.amostras, passoQuadros: relatorio.passoQuadros,
    apoioMaximo: relatorio['apoioMaximo (m)'], menorSola: relatorio.menorSola,
    maiorErroSolaApoio: relatorio.maiorErroSolaApoio,
    guardaRetornaNasPontas: relatorio.guardaRetornaNasPontas, estadoPreservado: relatorio.estadoPreservado }, null, 2));
}
