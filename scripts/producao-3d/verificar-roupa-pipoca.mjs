import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { carregarModelo } from '../../src/3d/modelo-glb.js';

const require = createRequire(import.meta.url);
const K = require('../../public/js/ko-sim.js');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SUB = (a, b) => a.map((v, i) => v - b[i]);
const CRUZ = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const DOT = (a, b) => a.reduce((s, v, i) => s + v*b[i], 0);
const PONTO = (p, i) => [p[i*3], p[i*3+1], p[i*3+2]];
const EPS = 1e-8;

// Interseção estrita: não conta contato em vértice/aresta ou pares adjacentes.
// O caso coplanar é excluído; este verificador não é uma prova contínua de colisão.
function segmentoTriangulo(a, b, p, q, r) {
  const direcao = SUB(b, a), e1 = SUB(q, p), e2 = SUB(r, p);
  const h = CRUZ(direcao, e2), det = DOT(e1, h);
  if (Math.abs(det) < EPS) return null;
  const inverso = 1 / det, s = SUB(a, p), u = DOT(s, h)*inverso;
  if (u <= EPS || u >= 1-EPS) return null;
  const c = CRUZ(s, e1), v = DOT(direcao, c)*inverso;
  if (v <= EPS || u+v >= 1-EPS) return null;
  const t = DOT(e2, c)*inverso;
  if (t <= EPS || t >= 1-EPS) return null;
  return a.map((valor, i) => valor+t*direcao[i]);
}

export function analisarCruzamentos(posicoes, indices, selecionados = null) {
  const lista = selecionados ?? Array.from({ length: indices.length/3 }, (_, i) => i);
  const triangulos = lista.map(numero => {
    const ids = Array.from(indices.slice(numero*3, numero*3+3));
    const pontos = ids.map(i => PONTO(posicoes, i));
    return { numero, ids, pontos,
      min: [0, 1, 2].map(k => Math.min(...pontos.map(p => p[k]))),
      max: [0, 1, 2].map(k => Math.max(...pontos.map(p => p[k]))),
    };
  });
  const encontrados = [];
  for (let i = 0; i < triangulos.length; i++) for (let j = i+1; j < triangulos.length; j++) {
    const a = triangulos[i], b = triangulos[j];
    if (a.ids.some(v => b.ids.includes(v))) continue;
    if (a.min.some((v, k) => v > b.max[k]+EPS || a.max[k] < b.min[k]-EPS)) continue;
    let ponto = null;
    for (let k = 0; k < 3 && !ponto; k++) {
      ponto = segmentoTriangulo(a.pontos[k], a.pontos[(k+1)%3], ...b.pontos)
        || segmentoTriangulo(b.pontos[k], b.pontos[(k+1)%3], ...a.pontos);
    }
    if (ponto) encontrados.push({ triangulos: [a.numero, b.numero], ponto });
  }
  return encontrados;
}

function componentes(indices) {
  const vizinhos = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = indices.slice(t, t+3);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      if (!vizinhos.has(u)) vizinhos.set(u, new Set());
      if (!vizinhos.has(v)) vizinhos.set(v, new Set());
      vizinhos.get(u).add(v); vizinhos.get(v).add(u);
    }
  }
  const visitados = new Set(), grupos = [];
  for (const v of vizinhos.keys()) if (!visitados.has(v)) {
    const grupo = new Set([v]), fila = [v]; visitados.add(v);
    while (fila.length) for (const proximo of vizinhos.get(fila.pop())) if (!visitados.has(proximo)) {
      grupo.add(proximo); visitados.add(proximo); fila.push(proximo);
    }
    grupos.push(grupo);
  }
  return grupos;
}

function topologia(posicoes, indices, selecionados) {
  const arestas = new Map();
  let menorAreaDupla = Infinity, degenerados = 0;
  for (const t of selecionados) {
    const [a, b, c] = indices.slice(t*3, t*3+3);
    const area = Math.hypot(...CRUZ(SUB(PONTO(posicoes, b), PONTO(posicoes, a)), SUB(PONTO(posicoes, c), PONTO(posicoes, a))));
    menorAreaDupla = Math.min(menorAreaDupla, area);
    if (area < 1e-12) degenerados++;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const chave = `${Math.min(u, v)}:${Math.max(u, v)}`;
      if (!arestas.has(chave)) arestas.set(chave, []);
      arestas.get(chave).push(u < v ? 1 : -1);
    }
  }
  const bordas = [], naoManifold = [], windingIncoerente = [];
  for (const [aresta, lados] of arestas) {
    if (lados.length === 1) bordas.push(...aresta.split(':').map(Number));
    if (lados.length > 2) naoManifold.push(aresta);
    if (lados.length === 2 && lados[0] === lados[1]) windingIncoerente.push(aresta);
  }
  // A contagem dos contornos usa o grafo de arestas de borda.
  const vizinhos = new Map();
  for (let i = 0; i < bordas.length; i += 2) {
    const [a, b] = bordas.slice(i, i+2);
    for (const [u, v] of [[a, b], [b, a]]) {
      if (!vizinhos.has(u)) vizinhos.set(u, new Set());
      vizinhos.get(u).add(v);
    }
  }
  const vistos = new Set(); let contornos = 0;
  for (const v of vizinhos.keys()) if (!vistos.has(v)) {
    contornos++; const fila = [v]; vistos.add(v);
    while (fila.length) for (const proximo of vizinhos.get(fila.pop())) if (!vistos.has(proximo)) {
      vistos.add(proximo); fila.push(proximo);
    }
  }
  return { triangulos: selecionados.length, degenerados, menorAreaDupla, naoManifold, windingIncoerente,
    contornos, bordasFechadas: [...vizinhos.values()].every(v => v.size === 2) };
}

export async function verificarRoupa({
  caminhoModelo = path.join(RAIZ, 'public/modelos/estudos/pipoca-corpo-v10.glb'),
  bufferModelo = null, passo = .25, clips = ['parado', 'p1', 'p2', 'defesa', 'dano', 'andando'],
  quadrosPorClip = null,
} = {}) {
  if (!Number.isFinite(passo) || passo <= 0 || passo > 1) throw new Error('Use passo entre zero e um quadro.');
  const bytes = bufferModelo ? Buffer.from(bufferModelo) : fs.readFileSync(caminhoModelo);
  const engine = new NullEngine(), scene = new Scene(engine);
  let modelo;
  try {
    modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.length), 'pipoca', K, scene);
    const malha = scene.meshes.find(m => m.skeleton && m.material?.name === 'pipoca_tecido_indigo');
    if (!malha) throw new Error('Material de roupa da Pipoca não encontrado.');
    const indices = malha.getIndices(), repouso = malha.getVerticesData('position');
    const grupos = componentes(indices).sort((a, b) => {
      const media = g => [...g].reduce((s, v) => s+repouso[v*3+1], 0)/g.size;
      return media(a)-media(b);
    });
    const short = grupos[0];
    const selecionados = Array.from({ length: indices.length/3 }, (_, i) => i)
      .filter(t => short.has(indices[t*3]));
    const estrutura = topologia(repouso, indices, selecionados);
    const repousoCruzamentos = analisarCruzamentos(repouso, indices, selecionados);
    const resultados = [];
    for (const nome of clips) {
      const grupo = scene.animationGroups.find(g => g.name === nome);
      if (!grupo) throw new Error(`Clip ausente: ${nome}`);
      scene.animationGroups.forEach(g => g.stop());
      grupo.start(false); grupo.pause();
      const fps = grupo.targetedAnimations[0].animation.framePerSecond;
      const duracaoQuadros = (grupo.to-grupo.from)*60/fps;
      const amostras = [], falhas = [];
      if (quadrosPorClip?.[nome]) {
        for (const quadro of quadrosPorClip[nome]) {
          if (!Number.isFinite(quadro) || quadro < 0 || quadro > duracaoQuadros+1e-7) throw new Error(`Quadro inválido para ${nome}.`);
          amostras.push(quadro);
        }
      } else {
        for (let q = 0; q < duracaoQuadros-1e-7; q += passo) amostras.push(Number(q.toFixed(8)));
        amostras.push(Number(duracaoQuadros.toFixed(8)));
      }
      for (const quadro of amostras) {
        grupo.goToFrame(grupo.from+quadro*fps/60);
        malha.computeWorldMatrix(true); malha.skeleton.prepare(true);
        const encontrados = analisarCruzamentos(malha.getPositionData(true, false), indices, selecionados);
        if (encontrados.length) falhas.push({ quadro, cruzamentos: encontrados });
      }
      resultados.push({ clip: nome, duracaoQuadros, amostras: amostras.length, posesComCruzamentos: falhas.length,
        maiorNumeroPares: Math.max(0, ...falhas.map(f => f.cruzamentos.length)),
        totalPares: falhas.reduce((s, f) => s+f.cruzamentos.length, 0), falhas });
    }
    const passou = grupos.length === 2 && estrutura.degenerados === 0 && estrutura.naoManifold.length === 0
      && estrutura.windingIncoerente.length === 0 && estrutura.contornos === 3 && estrutura.bordasFechadas
      && repousoCruzamentos.length === 0 && resultados.every(r => r.posesComCruzamentos === 0);
    return { versao: 1, geradoEm: new Date().toISOString(), modelo: bufferModelo ? 'memoria' : path.relative(RAIZ, caminhoModelo).replaceAll('\\', '/'),
      sha256Glb: createHash('sha256').update(bytes).digest('hex'), passou, passoQuadros: passo,
      metodo: 'GLB real importado em Babylon NullEngine; animações isoladas por grupo; posições deformadas por CPU.',
      limites: ['Pares que compartilham vértice e triângulos coplanares não são classificados como cruzamento.',
        'Amostragem discreta; não verifica colisão entre roupa e pele nem todas as transições do motor.'],
      material: malha.material.name, componentesRoupa: grupos.length,
      short: { ...estrutura, cruzamentosRepouso: repousoCruzamentos },
      amostras: resultados.reduce((s, r) => s+r.amostras, 0), clips: resultados };
  } finally {
    modelo?.descartar(); scene.dispose(); engine.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), valor = nome => {
    const i = args.indexOf(nome); return i < 0 ? undefined : args[i+1];
  };
  const caminhoModelo = valor('--modelo') ? path.resolve(valor('--modelo')) : undefined;
  const passo = valor('--passo') ? Number(valor('--passo')) : .25;
  const saida = path.resolve(valor('--saida') || path.join(RAIZ, 'art/premium/modelos-3d/estudos-mixamo/roupa-auditoria-v10.json'));
  const resultado = await verificarRoupa({ caminhoModelo, passo });
  fs.writeFileSync(saida, JSON.stringify(resultado, null, 2)+'\n');
  console.log(JSON.stringify({ passou: resultado.passou, sha256Glb: resultado.sha256Glb, amostras: resultado.amostras,
    clips: resultado.clips.map(({ clip, posesComCruzamentos, maiorNumeroPares }) => ({ clip, posesComCruzamentos, maiorNumeroPares })), saida }));
  if (!resultado.passou) process.exitCode = 1;
}
