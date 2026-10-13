import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRig } from '../../src/producao3d/rig.mjs';
import { criarTecnicasPipoca } from '../../src/producao3d/pipoca-tecnicas.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const ler = nome => JSON.parse(readFileSync(resolve(pasta, nome)));
const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const posturas = ler('posturas-v14.json');
const fonte = criarTecnicasPipoca(ler('guarda-v4.json'), criarRig(), K, {
  posturaBaixa: posturas.clips.find(c => c.nome === 'agachado'), posturaAerea: posturas.clips.find(c => c.nome === 'pulo'),
});
fonte.sha256Simulacao = createHash('sha256').update(readFileSync(resolve(raiz, 'public/js/ko-sim.js'))).digest('hex');
writeFileSync(resolve(pasta, 'tecnicas-v15.json'), JSON.stringify(fonte) + '\n');
console.log(JSON.stringify({ arquivo: 'art/premium/modelos-3d/estudos-mixamo/tecnicas-v15.json', clips: fonte.clips.map(c => ({ nome: c.nome, duracao: c.duracaoQuadros })), pendentes: fonte.pendentes }));
