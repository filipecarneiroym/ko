import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { carregarModelo } from '../../src/3d/modelo-glb.js';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
function mesmaPose(a, b) {
  for (let i = 0; i < a.length; i += 7) {
    for (let p = 0; p < 3; p++) if (Math.abs(a[i + p] - b[i + p]) > 1e-5) return false;
    let dot = 0; for (let r = 3; r < 7; r++) dot += a[i + r] * b[i + r];
    if (Math.abs(Math.abs(dot) - 1) > 1e-5) return false;
  }
  return true;
}

export async function verificarAtuacaoPipoca(bytes, simulador = K) {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  const doc = validarGlb(buffer, 'pipoca', simulador), fonte = doc.extras.atuacaoPipoca;
  assert.ok(fonte?.nomes?.length === 8, 'Integre as oito atuações autorais v17');
  const engine = new NullEngine(), scene = new Scene(engine); let modelo;
  try {
    modelo = await carregarModelo(buffer, 'pipoca', simulador, scene);
    const esqueleto = modelo.malhas.find(m => m.skeleton).skeleton;
    const juntas = Object.fromEntries(['pe_E', 'pe_D', 'mao_E', 'mao_D', 'cabeca'].map(n => [n, esqueleto.bones.find(b => b.name === n).getTransformNode()]));
    function ler(clip, q, face) {
      const distancia = clip === 'rolando' ? Math.min(16, q) * 88 / (simulador.U * 24) : 0;
      modelo.atualizar({ clip, quadro: q, face, x: distancia * face, y: 0, visivel: true, ciclico: false });
      let piso = Infinity;
      for (const m of modelo.malhas.filter(m => m.skeleton)) {
        m.computeWorldMatrix(true); m.skeleton.prepare(true);
        const p = m.getPositionData(true, false), w = m.getWorldMatrix().m;
        for (let i = 0; i < p.length; i += 3) piso = Math.min(piso, p[i] * w[1] + p[i + 1] * w[5] + p[i + 2] * w[9] + w[13]);
      }
      const posicoes = Object.fromEntries(Object.entries(juntas).map(([n, b]) => { b.computeWorldMatrix(true); return [n, b.getAbsolutePosition().clone()]; }));
      return { piso, distancia, posicoes, locais: esqueleto.bones.flatMap(b => { const n = b.getTransformNode(); return [...n.position.asArray(), ...n.rotationQuaternion.asArray()]; }) };
    }
    const relatos = {};
    for (const nome of fonte.nomes) {
      const duracao = doc.animations.find(a => a.name === nome).extras.duracaoQuadros;
      const passo = ['rolando', 'agarrando', 'agarrado'].includes(nome) ? .0625 : .125;
      const r = { duracaoQuadros: duracao, passoQuadros: passo, amostras: 0, pisoMinimo: Infinity, apoioMaximo: 0, erroLuvasNominal: 0 };
      for (const face of [1, -1]) {
        const guarda = ler('parado', 0, face), repouso = ler('caido', 46, face);
        for (let i = 0; i <= duracao / passo; i++) {
          const q = i * passo, p = ler(nome, q, face); r.amostras++;
          assert.ok(p.locais.every(Number.isFinite));
          r.pisoMinimo = Math.min(r.pisoMinimo, p.piso);
          assert.ok(p.piso >= -.001, `${nome} pele/roupa acima do piso, face${face}, q${q}: ${p.piso}`);
          const apoiar = ['agarrando', 'agarrado', 'tonto', 'vitoria', 'final'].includes(nome) || nome === 'rolando' && q >= 16 || nome === 'vitimaFinal' && q <= 138;
          if (apoiar) for (const lado of ['E', 'D']) {
            const alvo = guarda.posicoes[`pe_${lado}`].clone(); alvo.x += p.distancia * face;
            const erro = p.posicoes[`pe_${lado}`].subtract(alvo).length();
            r.apoioMaximo = Math.max(r.apoioMaximo, erro);
            assert.ok(erro < .001, `${nome} apoio ${lado} q${q}, face${face}: ${erro}`);
          }
          if (nome === 'agarrando' && q >= 4 && q <= 8) for (const lado of ['E', 'D']) {
            const alvo = fonte.regras.agarrando.pulsosContato[lado], atual = p.posicoes[`mao_${lado}`];
            const erro = Math.hypot(atual.x * face - alvo[0], atual.y - alvo[1], atual.z * -face - alvo[2]);
            r.erroLuvasNominal = Math.max(r.erroLuvasNominal, erro);
            assert.ok(erro < .001, `Pulso do agarrão ${lado} alcança alvo nominal`);
          }
          if (nome === 'rolando' && q >= 2 && q <= 14 || nome === 'derrotado' && q >= 34 || nome === 'vitimaFinal' && q >= 176) assert.ok(p.piso < .001, 'Corpo repousa/toca o piso sem flutuar');
        }
        const final = ler(nome, duracao, face), inicio = ler(nome, 0, face);
        if (nome === 'tonto') assert.ok(mesmaPose(final.locais, inicio.locais), 'Atordoamento fecha ciclo completo');
        if (['agarrando', 'rolando', 'final'].includes(nome)) assert.ok(mesmaPose(final.locais, guarda.locais), `${nome} termina na guarda inteira`);
        if (['derrotado', 'vitimaFinal'].includes(nome)) assert.ok(mesmaPose(final.locais, repouso.locais), `${nome} termina no repouso v16 compatível com levantar`);
      }
      relatos[nome] = r;
    }
    return { aprovadoFinal: false, sha256Glb: createHash('sha256').update(new Uint8Array(buffer)).digest('hex'), estados: relatos,
      amostras: Object.values(relatos).reduce((s, r) => s + r.amostras, 0), pendentes: fonte.pendentes,
      limites: ['Apoios e alvos nominais não validam contato de duas luvas em todas as vítimas/distâncias.', 'Sem aprovação artística automática por contagem de clips.'] };
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const caminho = process.argv[2] || 'public/modelos/estudos/pipoca-direcao-visual-v13.glb';
  const r = { caminho, ...await verificarAtuacaoPipoca(readFileSync(resolve(caminho))) };
  writeFileSync(resolve('art/premium/modelos-3d/estudos-mixamo/importacao-atuacao-v17.json'), JSON.stringify(r, null, 2) + '\n');
  console.log(JSON.stringify(r));
}
