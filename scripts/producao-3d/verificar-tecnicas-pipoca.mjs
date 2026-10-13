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

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const PASSO = .0625;

export async function verificarTecnicasPipoca(bytes, simulador = K) {
  const engine = new NullEngine(), scene = new Scene(engine);
  let modelo;
  try {
    const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
    modelo = await carregarModelo(buffer, 'pipoca', simulador, scene);
    const esqueleto = modelo.malhas.find(m => m.skeleton).skeleton;
    const nomes = ['pe_E', 'pe_D', 'mao_E'];
    const juntas = Object.fromEntries(nomes.map(n => [n, esqueleto.bones.find(b => b.name === n)]));
    const malhas = modelo.malhas.filter(m => m.skeleton).map(malha => {
      const indices = malha.getVerticesData('matricesIndices'), pesos = malha.getVerticesData('matricesWeights');
      return { malha, vertices: Object.fromEntries(nomes.map(nome => [nome, Array.from({ length: malha.getTotalVertices() }, (_, i) => i).filter(i => indices[i * 4] === juntas[nome].getIndex() && pesos[i * 4] > .99)])) };
    });
    const descricao = { x: 0, y: 0, visivel: true, ciclico: false };
    function ler(clip, quadro, face) {
      const altura = ['ap', 'ak'].includes(clip) ? 2 : 0;
      modelo.atualizar({ ...descricao, clip, quadro, face, y: altura });
      const raizModelo = scene.getTransformNodeByName('modelo-pipoca');
      assert.deepEqual(raizModelo.position.asArray(), [0, altura, 0], 'Trajetória jogável permanece externa ao clip');
      const caixas = Object.fromEntries(nomes.map(n => [n, [Infinity, -Infinity, Infinity, -Infinity]]));
      let piso = Infinity;
      for (const { malha, vertices } of malhas) {
        malha.computeWorldMatrix(true); malha.skeleton.prepare(true);
        const posicoes = malha.getPositionData(true, false);
        const mundo = malha.getWorldMatrix().m;
        assert.ok(Array.from(malha.skeleton.getTransformMatrices(malha)).every(Number.isFinite));
        for (let i = 0; i < posicoes.length; i += 3) piso = Math.min(piso, posicoes[i] * mundo[1] + posicoes[i + 1] * mundo[5] + posicoes[i + 2] * mundo[9] + mundo[13] - altura);
        for (const nome of nomes) for (const i of vertices[nome]) {
          const v = Vector3.TransformCoordinates(Vector3.FromArray(posicoes, i * 3), malha.getWorldMatrix()), c = caixas[nome];
          c[0] = Math.min(c[0], v.x * face); c[1] = Math.max(c[1], v.x * face);
          c[2] = Math.min(c[2], v.y - altura); c[3] = Math.max(c[3], v.y - altura);
        }
      }
      const posicoes = Object.fromEntries(nomes.map(n => { const no = juntas[n].getTransformNode(); no.computeWorldMatrix(true); return [n, no.getAbsolutePosition().subtract(new Vector3(0, altura, 0))]; }));
      return { caixas, posicoes, piso };
    }
    const golpes = {};
    for (const nome of ['cp', 'ck', 'ap', 'ak', 'esp', 'sup']) {
      const golpe = simulador.LUTADORES.pipoca.golpes[nome];
      const relato = { duracaoQuadros: golpe.dur, amostras: 0, apoioMaximo: 0, solaMaxima: 0, pisoMinimo: Infinity, contatos: [] };
      for (const face of [1, -1]) {
        const guarda = ler('parado', 0, face);
        const quadros = Array.from({ length: golpe.dur / PASSO + 1 }, (_, i) => i * PASSO);
        if (nome === 'sup') for (let i = 0; i <= 128; i++) quadros.push(42 + i / 64);
        for (const q of [...new Set(quadros)].sort((a, b) => a - b)) {
          const pose = ler(nome, q, face);
          relato.amostras++;
          relato.pisoMinimo = Math.min(relato.pisoMinimo, pose.piso);
          const aereo = ['ap', 'ak'].includes(nome);
          assert.ok(pose.piso + (aereo ? 2 : 0) >= -.001, `${nome} pele/roupa não atravessa o piso mundial, q${q}, face${face}: ${pose.piso}`);
          const apoios = ['ap', 'ak'].includes(nome) ? [] : nome === 'ck' ? ['pe_D'] : ['pe_E', 'pe_D'];
          for (const pe of apoios) {
            const erro = pose.posicoes[pe].subtract(guarda.posicoes[pe]).length();
            const sola = Math.abs(pose.caixas[pe][2] - guarda.caixas[pe][2]);
            relato.apoioMaximo = Math.max(relato.apoioMaximo, erro); relato.solaMaxima = Math.max(relato.solaMaxima, sola);
            assert.ok(erro < .001, `${nome} mantém ${pe} no apoio, q${q}, face${face}: ${erro}`);
            assert.ok(sola < .001 && pose.caixas[pe][2] >= -.001, `${nome} mantém sola no chão, q${q}, face${face}: ${sola}`);
          }
          if (nome === 'ck') assert.ok(pose.caixas.pe_E[2] >= -.001, `Rasteira não penetra o chão, q${q}: ${pose.caixas.pe_E[2]}`);
          for (const janela of golpe.janelas || []) if (q >= janela.de && q <= janela.ate) {
            const extremidade = ['ck', 'ak'].includes(nome) ? 'pe_E' : 'mao_E';
            const c = pose.caixas[extremidade], [x, y, w, h] = janela.caixa;
            assert.ok(c.every(Number.isFinite));
            assert.ok(c[1] >= (x + w) / 24 - .2 && c[1] <= (x + w) / 24 + .1, `${nome} alcança a frente da caixa, q${q}, face${face}: ${c}`);
            assert.ok(c[1] >= x / 24 && c[0] <= (x + w) / 24, `${nome} extremidade sobrepõe caixa horizontal, q${q}, face${face}: ${c}`);
            assert.ok(c[3] >= -(y + h) / 24 && c[2] <= -y / 24, `${nome} extremidade sobrepõe altura real, q${q}, face${face}: ${c}`);
            if (['ap', 'ak'].includes(nome)) assert.ok(pose.posicoes.pe_D.y > guarda.posicoes.pe_D.y + .1, `${nome} mantém perna livre recolhida, sem ancoragem falsa`);
            if (q === janela.de) relato.contatos.push({ quadro: q, face, extremidade, caixaVisual: c, caixaMotor: janela.caixa });
          }
          if (nome === 'esp' && q === golpe.proj.quadro) {
            const pulso = pose.posicoes.mao_E;
            assert.ok(Math.abs(pulso.x * face - .75) < .001 && Math.abs(pulso.y - golpe.proj.y / 24) < .001, 'Lançamento coincide com a origem visual da cenoura');
            relato.lancamento = { quadro: q, pulso: [pulso.x * face, pulso.y] };
          }
        }
      }
      golpes[nome] = relato;
    }
    return { aprovadoFinal: false, sha256Glb: createHash('sha256').update(bytes).digest('hex'), passoQuadros: PASSO, golpes, amostras: Object.values(golpes).reduce((s, g) => s + g.amostras, 0),
      limites: ['Contatos técnicos não aprovam deformações, atuação ou acabamento artístico.', 'Ocultação do super pertence a p.sumido; o arquivo não cria eventos de gameplay.'] };
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const caminho = process.argv[2] || 'public/modelos/estudos/pipoca-direcao-visual-v13.glb';
  const relatorio = { caminho, ...await verificarTecnicasPipoca(readFileSync(resolve(raiz, caminho))) };
  writeFileSync(resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo/importacao-tecnicas-v15.json'), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(JSON.stringify(relatorio, null, 2));
}
