import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarEstudoVisual } from './gerar-estudo-visual.mjs';
import { criarEstadosPipoca } from '../../src/producao3d/pipoca-estados.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const ler = nome => JSON.parse(readFileSync(resolve(pasta, nome)));
const nomes = ['guarda-v4.json', 'jab-v5.json', 'soco-forte-v6.json', 'defesa-v7.json', 'reacao-v8.json', 'andando-v9.json', 'chute-v11.json', 'chute-forte-v12.json'];
const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const dados = criarEstudoVisual(...nomes.map(ler), K), posturas = ler('posturas-v14.json');
const fonte = criarEstadosPipoca(ler('guarda-v4.json'), dados.ossos, K, {
  posturaBaixa: posturas.clips.find(c => c.nome === 'agachado'), reacao: ler('reacao-v8.json'), primitivas: dados.primitivas,
});
fonte.sha256Simulacao = createHash('sha256').update(readFileSync(resolve(raiz, 'public/js/ko-sim.js'))).digest('hex');
fonte.sha256Geometria = createHash('sha256').update(JSON.stringify(dados.primitivas.map(({ posicoes, juntas, pesos }) => ({ posicoes, juntas, pesos })))).digest('hex');
writeFileSync(resolve(pasta, 'estados-v16.json'), JSON.stringify(fonte) + '\n');
console.log(JSON.stringify({ arquivo: 'art/premium/modelos-3d/estudos-mixamo/estados-v16.json', clips: fonte.clips.map(c => ({ nome: c.nome, duracao: c.duracaoQuadros })), corrida: fonte.regras.corrida, pendentes: fonte.pendentes }));
