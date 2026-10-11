import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { criarEstudoMixamo } from './gerar-estudo-mixamo.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function substituirSoco(dados,clip,nome,simulador) {
  const golpe=simulador.LUTADORES.pipoca.golpes[nome];
  assert.equal(clip.nome,nome,'Somente o soco escolhido é substituído');
  assert.equal(clip.duracaoQuadros,golpe.dur,'Duração segue o motor');
  assert.equal(clip.canais.length,40,'Rotação e posição dos 20 ossos');
  const alvos=new Set();
  for(const canal of clip.canais) {
    assert.equal(canal.tempos[0],0);
    assert.ok(Math.abs(canal.tempos.at(-1)-golpe.dur/60)<1e-7);
    alvos.add(`${canal.osso}:${canal.tipo}`);
    if(canal.osso===0&&canal.tipo==='translation')for(let i=0;i<canal.valores.length;i+=3){
      assert.ok(Math.abs(canal.valores[i])<1e-5 && Math.abs(canal.valores[i+2])<1e-5,'Soco não desloca a raiz horizontalmente');
    }
  }
  for(let i=0;i<20;i++)for(const tipo of ['rotation','translation'])assert.ok(alvos.has(`${i}:${tipo}`));
  return {...dados,clips:dados.clips.map(c=>c.nome===nome?structuredClone(clip):c)};
}
export function criarEstudoJab(guarda,jab,simulador) {
  const dados=substituirSoco(criarEstudoMixamo(guarda,simulador),jab,'p1',simulador);
  dados.extras.status='estudo-guarda-jab';
  dados.extras.animacoes='Guarda Mixamo refinada e jab por IK; demais 29 clips preservados.';
  return dados;
}
export function gerarEstudoJab() {
  const pasta=resolve(raiz,'art/premium/modelos-3d/estudos-mixamo');
  const guarda=JSON.parse(readFileSync(resolve(pasta,'guarda-v4.json')));
  const jab=JSON.parse(readFileSync(resolve(pasta,'jab-v5.json')));
  const origem=JSON.parse(readFileSync(resolve(pasta,'jab-relatorio-v5.json')));
  const simBytes=readFileSync(resolve(raiz,'public/js/ko-sim.js'));
  assert.equal(origem.sha256Simulacao,createHash('sha256').update(simBytes).digest('hex'),'Fonte de tempos atual');
  const K=createRequire(import.meta.url)('../../public/js/ko-sim.js');
  assert.deepEqual(origem.janelaContato,K.LUTADORES.pipoca.golpes.p1.janelas.map(j=>[j.de,j.ate])[0]);
  const dados=criarEstudoJab(guarda,jab,K);
  const bytes=exportarGlb(dados);
  const doc=validarGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K);
  assert.equal(doc.animations.length,31);
  writeFileSync(resolve(raiz,'public/modelos/estudos/pipoca-jab-v5.glb'),bytes);
  const relatorio={aprovadoFinal:false,caminho:'public/modelos/estudos/pipoca-jab-v5.glb',bytes:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex'),clips:31,substituidos:['parado','p1'],
    janelaContato:origem.janelaContato,duracaoJabQuadros:jab.duracaoQuadros,
    preservados:dados.clips.filter(c=>!['parado','p1'].includes(c.nome)).map(c=>c.nome),
    limites:['Estudo visual; acabamento e demais movimentos continuam pendentes.','Validar alcance visual na arena.']};
  writeFileSync(resolve(pasta,'integracao-v5.json'),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify(relatorio));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)gerarEstudoJab();
