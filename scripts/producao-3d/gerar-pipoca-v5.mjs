// Pipoca v5 jogável: malha da arte final (preparar-jogo-pipoca-v5.py) com os
// 31 movimentos do estudo v13 retargetados para o esqueleto da v5.
// Gera as duas roupas: azul (jogador) e vermelha (máquina / jogador 2).
//   node scripts/producao-3d/gerar-pipoca-v5.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { montarEstudoVisual } from './gerar-estudo-visual.mjs';
import { carregarPipocaV5, retargetarClips, acimaDoPiso, VARIANTES } from '../../src/producao3d/pipoca-v5.mjs';
import { criarGolpesV5, conferirPes, joelhosParaFrente, pernasDe, olharParaFrente } from '../../src/producao3d/pipoca-v5-golpes.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pastaV5 = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function gerarPipocaV5() {
  const { dados: v13, K } = montarEstudoVisual();
  const relatorio = { aprovadoFinal: false, fonteMalha: JSON.parse(readFileSync(resolve(pastaV5, 'relatorio.json'), 'utf8')), arquivos: {} };
  for (const variante of Object.keys(VARIANTES)) {
    const v5 = carregarPipocaV5(pastaV5, variante);
    const herdados = retargetarClips(v13.clips, v13.ossos, v5.ossos);
    // Golpes refeitos à mão no esqueleto da v5 substituem os herdados.
    const golpes = criarGolpesV5(v5.ossos, herdados.find(c => c.nome === 'parado'), K);
    const falhas = Object.entries(golpes.relatorio).flatMap(([nome, js]) => js.filter(j => !j.ok).map(j => `${nome}/${j.lado}`));
    assert.deepEqual(falhas, [], `Pé fora da caixa do motor: ${falhas.join(', ')}`);
    relatorio.contato = golpes.relatorio;
    const baixos = { cp: [golpes.clips.agachado, null], defesaBaixa: [golpes.clips.agachado, null], ap: [golpes.clips.pulo, 14] };
    const clips = herdados.map(c => golpes.clips[c.nome]
      ?? (baixos[c.nome] ? pernasDe(v5.ossos, c, ...baixos[c.nome]) : joelhosParaFrente(v5.ossos, c)));
    // Olhar no oponente ao agachar e defender.
    const guardaV5 = clips.find(c => c.nome === 'parado');
    for (const nome of ['agachado', 'cp', 'defesaBaixa', 'ck', 'defesa', 'pousando', 'recuo', 'quebra']) {
      const i = clips.findIndex(c => c.nome === nome);
      clips[i] = olharParaFrente(v5.ossos, clips[i], guardaV5, nome === 'cp' ? { seguirGiro: false, elevar: .18 } : {});
    }
    const primitiva = v5.primitivas[0];
    for (const c of clips) if (['rolando', 'caido', 'levantando', 'derrotado', 'vitimaFinal', 'sup', 'quebra'].includes(c.nome))
      acimaDoPiso(c, v5.ossos, { posicoes: primitiva.posicoes, juntas: primitiva.juntas, pesos: primitiva.pesos });
    const pesAoContrario = conferirPes(v5.ossos, clips);
    assert.deepEqual(pesAoContrario, [], `Pé ao contrário: ${JSON.stringify(pesAoContrario.slice(0, 20))}`);
    const dados = { nome: 'pipoca', ...v5, clips,
      extras: { status: 'pipoca-v5-jogo', variante, aprovadoFinal: false,
        animacoes: v13.extras.animacoes, retarget: 'v13 -> v5 (rotações; comprimentos da v5; pelve escalada pela perna)' } };
    const bytes = exportarGlb(dados);
    const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K);
    assert.equal(doc.animations.length, 31);
    const caminho = `public/modelos/estudos/pipoca-v5-${variante}.glb`;
    writeFileSync(resolve(raiz, caminho), bytes);
    const triangulos = doc.meshes.flatMap(m => m.primitives).reduce((n, p) => n + doc.accessors[p.indices].count / 3, 0);
    relatorio.arquivos[variante] = { caminho, bytes: bytes.length, sha256: sha(bytes), triangulos,
      materiais: doc.materials.length, ossos: 20, clips: 31,
      dentroDoTeto: triangulos <= 40000, glbDentroDoAlvo: bytes.length <= 8 * 1024 * 1024 };
  }
  writeFileSync(resolve(pastaV5, 'integracao.json'), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(JSON.stringify(relatorio.arquivos));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) gerarPipocaV5();
