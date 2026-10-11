import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRig } from '../../src/producao3d/rig.mjs';
import { criarPipoca } from '../../src/producao3d/pipoca.mjs';
import { criarUivo } from '../../src/producao3d/uivo.mjs';
import { criarAnimacoes } from '../../src/producao3d/animacoes.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const simulador = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const pasta = resolve(raiz,'public/modelos/blockout');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const registro = { versao:1, status:'Estudos de geometria e movimento; sem aprovação artística final.', aprovadoFinal:false, modelos:[] };
mkdirSync(pasta,{ recursive:true });
for (const [id,criar,escala] of [['pipoca',criarPipoca,1],['uivo',criarUivo,1.1]]) {
  const ossos = criarRig(escala), malha = criar(ossos), clips = criarAnimacoes(id,ossos,simulador);
  const referencia = `art/premium/modelos-3d/referencias/${id}-referencia-v1.png`;
  const bytes = exportarGlb({nome:id,...malha,ossos,clips,extras:{...malha.extras,status:'blockout',aprovadoFinal:false,animacoes:'estudos iniciais; revisão de contatos e deformação pendente'}});
  validarGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),id,simulador);
  const caminho = `public/modelos/blockout/${id}-v1.glb`;
  writeFileSync(resolve(raiz,caminho),bytes);
  const item = {id,caminho,sha256:sha256(bytes),bytes:bytes.length,triangulos:malha.primitivas.reduce((n,p) => n+p.indices.length/3,0),vertices:malha.primitivas.reduce((n,p) => n+p.posicoes.length/3,0),materiais:malha.materiais.length,ossos:ossos.length,clips:clips.map(c=>({nome:c.nome,duracaoQuadros:c.duracaoQuadros})),referencia,sha256Referencia:sha256(readFileSync(resolve(raiz,referencia))),aprovadoFinal:false};
  registro.modelos.push(item);
  console.log(`${id}: ${item.triangulos} triângulos, ${item.clips.length} clips, ${(item.bytes/1048576).toFixed(2)} MiB — estudo, não arte final.`);
}
writeFileSync(resolve(raiz,'art/premium/modelos-3d/blockout.json'),`${JSON.stringify(registro,null,2)}\n`);
