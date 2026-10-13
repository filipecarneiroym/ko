import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Pipoca v5 (arte final) como malha de jogo: produzida por
// scripts/producao-3d/preparar-jogo-pipoca-v5.py. Mesmos 20 ossos de rig.mjs,
// com as juntas medidas na anatomia da v5; cor, normal e rugosidade assadas.
export const VARIANTES = { azul: 'cor_azul.png', vermelha: 'cor_vermelha.png' };

export function carregarPipocaV5(pasta, variante = 'azul') {
  assert.ok(VARIANTES[variante], `Variante desconhecida: ${variante}`);
  const malha = JSON.parse(readFileSync(resolve(pasta, 'malha.json'), 'utf8'));
  assert.equal(malha.ossos.length, 20, 'Pipoca v5 usa os vinte ossos do rig');
  const ossos = malha.ossos.map(o => ({
    nome: o.nome, pai: o.pai,
    posicao: o.pai === null ? o.mundo.slice() : o.mundo.map((v, i) => v - malha.ossos[o.pai].mundo[i]),
    mundo: o.mundo.slice(),
  }));
  const vertices = malha.posicoes.length / 3;
  assert.equal(malha.uvs.length, vertices * 2);
  assert.equal(malha.juntas.length, vertices * 4);
  for (let v = 0; v < vertices; v++) {
    const soma = malha.pesos[v*4] + malha.pesos[v*4+1] + malha.pesos[v*4+2] + malha.pesos[v*4+3];
    assert.ok(Math.abs(soma - 1) < 1e-3, `Pesos do vértice ${v} somam 1`);
  }
  const png = nome => ({ name: nome.replace('.png', ''), mimeType: 'image/png', dados: readFileSync(resolve(pasta, nome)) });
  const imagens = [png(VARIANTES[variante]), png('normal.png'), png('rugosidade.png')];
  return {
    ossos,
    primitivas: [{ posicoes: malha.posicoes, normais: malha.normais, indices: malha.indices,
      juntas: malha.juntas, pesos: malha.pesos, uvs: malha.uvs, material: 0 }],
    materiais: [{ name: `pipoca_v5_${variante}`,
      pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 },
        metallicFactor: 0, roughnessFactor: 1 },
      normalTexture: { index: 1 } }],
    imagens,
    texturas: imagens.map((_, i) => ({ source: i, sampler: 0 })),
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
  };
}

// Retargeting: os dois esqueletos têm todos os ossos alinhados aos eixos em
// repouso, então as rotações valem como estão. Posições fixas dos ossos são
// os comprimentos do rig antigo e passam a ser os da v5; o movimento da pelve
// é escalado pela razão entre os comprimentos de perna (quadril -> tornozelo).
export function retargetarClips(clips, ossosAntigos, ossosNovos) {
  const perna = ossos => ossos[0].mundo[1] - ossos[ossos.findIndex(o => o.nome === 'pe_E')].mundo[1];
  const k = perna(ossosNovos) / perna(ossosAntigos);
  return clips.map(clip => ({ ...clip, canais: clip.canais.map(canal => {
    if (canal.tipo !== 'translation') return canal;
    const antigo = ossosAntigos[canal.osso].posicao, novo = ossosNovos[canal.osso].posicao;
    const valores = canal.valores.map((v, i) => novo[i % 3] + (v - antigo[i % 3]) * (canal.osso === 0 ? k : 1));
    return { ...canal, valores };
  }) }));
}
