import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

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

// Osso -> filho que dá a direção do osso (para alinhar os dois esqueletos).
const DIRECAO = { quadril: 'tronco', tronco: 'peito', peito: 'cabeca' };
for (const l of 'ED') Object.assign(DIRECAO, { [`braco_${l}`]: `antebraco_${l}`, [`antebraco_${l}`]: `mao_${l}`,
  [`coxa_${l}`]: `canela_${l}`, [`canela_${l}`]: `pe_${l}` });

// Retargeting por direção: em cada quadro (60 por segundo, o relógio do
// motor) cada osso da v5 aponta para onde o osso antigo apontava, com o
// mesmo giro. Copiar as rotações locais não basta: as pernas da v5 têm outra
// inclinação em repouso, e a mesma rotação levava o chute para o lado
// (joelho e ponta do pé virados). Correção fixa por osso:
// C = rotação da direção nova para a antiga em repouso; global novo = global antigo · C.
// A pelve anda pela razão entre os comprimentos de perna.
export function retargetarClips(clips, ossosAntigos, ossosNovos) {
  const n = ossosNovos.length, idx = nome => ossosNovos.findIndex(o => o.nome === nome);
  assert.deepEqual(ossosAntigos.map(o => o.nome), ossosNovos.map(o => o.nome), 'Mesmos ossos, mesma ordem');
  const correcao = ossosNovos.map((o, i) => {
    const filho = DIRECAO[o.nome];
    if (!filho) return Quaternion.Identity();
    const j = idx(filho);
    const dir = ossos => Vector3.FromArray(ossos[j].mundo).subtract(Vector3.FromArray(ossos[i].mundo)).normalize();
    const q = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(dir(ossosNovos), dir(ossosAntigos), q);
    return q;
  });
  const perna = ossos => ossos[0].mundo[1] - ossos[ossos.findIndex(o => o.nome === 'pe_E')].mundo[1];
  const k = perna(ossosNovos) / perna(ossosAntigos);
  return clips.map(clip => {
    const quadros = clip.duracaoQuadros, tempos = Array.from({ length: quadros + 1 }, (_, q) => q / 60);
    const canal = (i, tipo) => clip.canais.find(c => c.osso === i && c.tipo === tipo);
    function amostra(c, t, tamanho) {
      if (!c) return null;
      let a = 0;
      while (a < c.tempos.length - 2 && c.tempos[a + 1] < t) a++;
      const b = Math.min(a + 1, c.tempos.length - 1), d = c.tempos[b] - c.tempos[a];
      const u = d > 0 ? Math.max(0, Math.min(1, (t - c.tempos[a]) / d)) : 0;
      return [c.valores.slice(a * tamanho, a * tamanho + tamanho), c.valores.slice(b * tamanho, b * tamanho + tamanho), u];
    }
    const rot = ossosNovos.map(() => []), pos = [];
    for (const t of tempos) {
      const globalAntigo = [], globalNovo = [];
      for (let i = 0; i < n; i++) {
        const r = amostra(canal(i, 'rotation'), t, 4);
        const local = r ? Quaternion.Slerp(Quaternion.FromArray(r[0]), Quaternion.FromArray(r[1]), r[2]).normalize() : Quaternion.Identity();
        const pai = ossosNovos[i].pai;
        globalAntigo.push(pai === null ? local : globalAntigo[pai].multiply(local).normalize());
        globalNovo.push(globalAntigo[i].multiply(correcao[i]).normalize());
        const localNovo = pai === null ? globalNovo[i] : Quaternion.Inverse(globalNovo[pai]).multiply(globalNovo[i]).normalize();
        rot[i].push(...localNovo.asArray());
      }
      const p = amostra(canal(0, 'translation'), t, 3);
      const raiz = p ? p[0].map((v, j) => v + (p[1][j] - v) * p[2]) : ossosAntigos[0].posicao;
      const raizNova = raiz.map((v, j) => ossosNovos[0].posicao[j] + (v - ossosAntigos[0].posicao[j]) * k);
      // Pés no piso: o tornozelo mais baixo fica à mesma altura (relativa ao
      // repouso, escalada) que no movimento original. Sem isso a proporção
      // diferente das pernas afundava os pés 2 a 5 cm.
      const tornozelo = (ossos, globais, base) => {
        const g = [Vector3.FromArray(base)];
        for (let i = 1; i < n; i++) g.push(g[ossos[i].pai].add(Vector3.FromArray(ossos[i].posicao).applyRotationQuaternion(globais[ossos[i].pai])));
        return Math.min(g[idx('pe_E')].y, g[idx('pe_D')].y);
      };
      const repouso = ossos => Math.min(ossos[idx('pe_E')].mundo[1], ossos[idx('pe_D')].mundo[1]);
      raizNova[1] += k * (tornozelo(ossosAntigos, globalAntigo, raiz) - repouso(ossosAntigos))
        - (tornozelo(ossosNovos, globalNovo, raizNova) - repouso(ossosNovos));
      pos.push(...raizNova);
    }
    const canais = [];
    for (let i = 0; i < n; i++) {
      canais.push({ osso: i, tipo: 'rotation', tempos, valores: rot[i] });
      canais.push({ osso: i, tipo: 'translation', tempos,
        valores: i === 0 ? pos : tempos.flatMap(() => ossosNovos[i].posicao) });
    }
    return { ...clip, canais };
  });
}
