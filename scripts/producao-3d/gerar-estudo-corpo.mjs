import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarEstudoMarcha } from './gerar-estudo-marcha.mjs';
import { criarPipocaCorpoV2 } from '../../src/producao3d/pipoca-corpo-v2.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = valor => createHash('sha256').update(valor).digest('hex');

export function criarEstudoCorpo(guarda,jab,forte,defesa,reacao,marcha,simulador) {
  const base = criarEstudoMarcha(guarda,jab,forte,defesa,reacao,marcha,simulador);
  const visual = criarPipocaCorpoV2(base.ossos);
  const dados = { ...base, primitivas: visual.primitivas, materiais: visual.materiais,
    extras: { ...base.extras, ...visual.extras, status: 'estudo-corpo-fluido-marcha',
      animacoes: base.extras.animacoes, marcha: base.extras.marcha } };
  assert.equal(dados.ossos, base.ossos, 'Rest pose e ordem dos 20 ossos são preservados');
  assert.equal(dados.clips, base.clips, 'As 31 animações são preservadas integralmente');
  assert.ok(dados.extras.corpo.verticesMistos > 0, 'Corpo possui transições de peso entre ossos');
  return dados;
}

export function gerarEstudoCorpo() {
  const pasta = resolve(raiz,'art/premium/modelos-3d/estudos-mixamo');
  const ler = nome => JSON.parse(readFileSync(resolve(pasta,nome)));
  const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
  const shaSim = sha(readFileSync(resolve(raiz,'public/js/ko-sim.js')));
  for (const arquivo of ['jab-relatorio-v5.json','soco-forte-relatorio-v6.json','defesa-relatorio-v7.json','reacao-relatorio-v8.json','marcha-relatorio-v9.json']) assert.equal(ler(arquivo).sha256Simulacao,shaSim,'Fontes seguem o motor atual');
  const fontes = ['guarda-v4.json','jab-v5.json','soco-forte-v6.json','defesa-v7.json','reacao-v8.json','andando-v9.json'].map(ler);
  const base = criarEstudoMarcha(...fontes,K),dados = criarEstudoCorpo(...fontes,K);
  assert.equal(JSON.stringify(dados.clips),JSON.stringify(base.clips),'Somente a malha muda neste estudo');
  assert.deepEqual(dados.ossos,base.ossos);
  const bytes = exportarGlb(dados);
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K);
  assert.equal(doc.animations.length,31); assert.equal(doc.skins[0].joints.length,20);
  const caminho = 'public/modelos/estudos/pipoca-corpo-v10.glb';
  writeFileSync(resolve(raiz,caminho),bytes);
  const relatorio = { aprovadoFinal:false,caminho,bytes:bytes.length,sha256:sha(bytes),
    clips:31,ossos:20,restPosePreservada:true,animacoesPreservadas:true,
    sha256ClipsPreservados:sha(JSON.stringify(dados.clips)),sha256RigPreservado:sha(JSON.stringify(dados.ossos)),
    corpo:dados.extras.corpo,vertices:dados.primitivas.reduce((s,p)=>s+p.posicoes.length/3,0),
    triangulos:dados.primitivas.reduce((s,p)=>s+p.indices.length/3,0),
    limites:dados.extras.limites };
  writeFileSync(resolve(pasta,'integracao-v10.json'),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify(relatorio));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) gerarEstudoCorpo();
