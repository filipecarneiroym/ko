import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {criarEstudoChutes} from './gerar-estudo-chutes.mjs';
import {criarPipocaVisualV3} from '../../src/producao3d/pipoca-visual-v3.mjs';
import {refinarFigurino} from '../../src/producao3d/pipoca-figurino.mjs';
import {aplicarPelagemPipoca} from '../../src/producao3d/pipoca-pelagem.mjs';
import {aplicarPosturasPipoca} from '../../src/producao3d/pipoca-posturas.mjs';
import {aplicarTecnicasPipoca} from '../../src/producao3d/pipoca-tecnicas.mjs';
import {aplicarEstadosPipoca} from '../../src/producao3d/pipoca-estados.mjs';
import {aplicarAtuacaoPipoca} from '../../src/producao3d/pipoca-atuacao.mjs';
import {exportarGlb} from './glb.mjs';
import {validarGlb} from '../../src/3d/contrato-glb.mjs';

const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function criarEstudoVisual(guarda,jab,forte,defesa,reacao,marcha,k1,k2,K) {
  const base=criarEstudoChutes(guarda,jab,forte,defesa,reacao,marcha,k1,k2,K);
  const figurino=refinarFigurino(criarPipocaVisualV3(base.ossos),base.ossos);
  const visual=aplicarPelagemPipoca({...figurino,ossos:base.ossos},{periodoMetros:.18});
  const dados={...base,primitivas:visual.primitivas,materiais:visual.materiais,
    imagens:visual.imagens,texturas:visual.texturas,samplers:visual.samplers,
    extras:{...base.extras,...visual.extras,status:'estudo-direcao-visual-pipoca',
      animacoes:base.extras.animacoes,marcha:base.extras.marcha,chutes:base.extras.chutes,
      referenciasVisuais:['art/premium/elenco/pipoca-v1.png','art/premium/modelos-3d/referencias/pipoca-referencia-v1.png'],
      aprovadoFinal:false}};
  assert.equal(dados.clips,base.clips,'O refinamento visual preserva os 31 movimentos');
  assert.equal(dados.ossos,base.ossos,'O refinamento preserva os 20 ossos');
  return dados;
}
export function gerarEstudoVisual() {
  const pasta=resolve(raiz,'art/premium/modelos-3d/estudos-mixamo');
  const nomesFontes=['guarda-v4.json','jab-v5.json','soco-forte-v6.json','defesa-v7.json',
    'reacao-v8.json','andando-v9.json','chute-v11.json','chute-forte-v12.json'];
  const fontes=nomesFontes.map(nome=>JSON.parse(readFileSync(resolve(pasta,nome))));
  const K=createRequire(import.meta.url)('../../public/js/ko-sim.js');
  const posturas=JSON.parse(readFileSync(resolve(pasta,'posturas-v14.json')));
  const tecnicas=JSON.parse(readFileSync(resolve(pasta,'tecnicas-v15.json')));
  const estados=JSON.parse(readFileSync(resolve(pasta,'estados-v16.json')));
  const atuacao=JSON.parse(readFileSync(resolve(pasta,'atuacao-v17.json')));
  const baseVisual=criarEstudoVisual(...fontes,K);
  const sha256Geometria=sha(JSON.stringify(baseVisual.primitivas.map(({posicoes,juntas,pesos})=>({posicoes,juntas,pesos}))));
  // Os envelopes de piso são calculados sobre a malha. Uma mudança no figurino
  // ou no corpo exige regenerar as fontes antes de exportar seus movimentos.
  for(const [arquivo,fonte] of [['estados-v16.json',estados],['atuacao-v17.json',atuacao]]) {
    assert.equal(fonte.sha256Geometria,sha256Geometria,
      `Regenere ${arquivo}: sua geometria difere do corpo/figurino atual.`);
  }
  const dados=aplicarAtuacaoPipoca(aplicarEstadosPipoca(aplicarTecnicasPipoca(aplicarPosturasPipoca(baseVisual,posturas),tecnicas),estados),atuacao),bytes=exportarGlb(dados);
  const doc=validarGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K);
  assert.equal(doc.animations.length,31);
  assert.ok(doc.extras.corpo.verticesMistos>0);
  const caminho='public/modelos/estudos/pipoca-direcao-visual-v13.glb';
  writeFileSync(resolve(raiz,caminho),bytes);
  const primitivas=doc.meshes.flatMap(m=>m.primitives);
  const geometria={vertices:primitivas.reduce((n,p)=>n+doc.accessors[p.attributes.POSITION].count,0),
    triangulos:primitivas.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),
    primitivas:primitivas.length,materiais:doc.materials.length};
  const texturas=dados.imagens.map(imagem=>{
    const png=Buffer.from(imagem.dados),largura=png.readUInt32BE(16),altura=png.readUInt32BE(20);
    return {nome:imagem.name,largura,altura,bytesPng:png.length,
      memoriaRgba8ComMipmapsEstimada:Math.ceil(largura*altura*4*4/3)};
  });
  const fontesDiretas=[...nomesFontes,'posturas-v14.json','tecnicas-v15.json','estados-v16.json','atuacao-v17.json'].map(nome=>({
    caminho:'art/premium/modelos-3d/estudos-mixamo/'+nome,sha256:sha(readFileSync(resolve(pasta,nome)))}));
  for(const caminho of ['src/producao3d/pipoca-visual-v3.mjs','src/producao3d/pipoca-corpo-v2.mjs',
    'src/producao3d/pipoca.mjs','src/producao3d/pipoca-figurino.mjs','src/producao3d/pipoca-pelagem.mjs',
    'src/producao3d/pipoca-posturas.mjs','src/producao3d/pipoca-tecnicas.mjs',
    'src/producao3d/pipoca-estados.mjs','src/producao3d/pipoca-atuacao.mjs','scripts/producao-3d/gerar-estudo-visual.mjs',
    'scripts/producao-3d/glb.mjs'])fontesDiretas.push({caminho,sha256:sha(readFileSync(resolve(raiz,caminho)))});
  const relatorio={aprovadoFinal:false,caminho,bytes:bytes.length,sha256:sha(bytes),fontesDiretas,geometria,texturas,
    metasTecnicas:{triangulosAlvo:25000,triangulosTeto:40000,glbBytesAlvo:8*1024*1024,materiaisAlvo:4,
      triangulosDentroDoTeto:geometria.triangulos<=40000,glbDentroDoAlvo:bytes.length<=8*1024*1024,
      materiaisDentroDoAlvo:geometria.materiais<=4,desempenhoEmAparelhosFisicosMedido:false},
    sha256Simulacao:sha(readFileSync(resolve(raiz,'public/js/ko-sim.js'))),
    ossos:20,clips:31,corpo:dados.extras.corpo,rosto:dados.extras.rosto,figurino:dados.extras.figurino,pelagem:dados.extras.pelagemProcedural,posturas:dados.extras.posturas,tecnicas:dados.extras.tecnicasPipoca,estados:dados.extras.estadosPipoca,atuacao:dados.extras.atuacaoPipoca,
    referenciasVisuais:dados.extras.referenciasVisuais,
    limites:['Direção visual em construção; sem equivalência de acabamento com a ilustração.',
      'Pelagem, tecido e expressões ainda precisam de produção artística.',
      'Os movimentos sem relatório específico de revisão permanecem como estudos.']};
  writeFileSync(resolve(pasta,'integracao-v13.json'),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify({caminho,bytes:bytes.length,sha256:relatorio.sha256,ossos:20,clips:31}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)gerarEstudoVisual();
