import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarEstudoSocos } from './gerar-estudo-socos.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function criarEstudoDefesa(guarda,jab,forte,defesa,simulador) {
  const dados=criarEstudoSocos(guarda,jab,forte,simulador);
  assert.equal(defesa.nome,'defesa','Somente defesa alta é substituída');
  assert.equal(defesa.duracaoQuadros,60,'Ciclo de defesa de 60 quadros');
  assert.equal(defesa.canais.length,40,'Defesa define os 20 ossos completos');
  const alvos=new Set();
  for(const canal of defesa.canais) {
    assert.ok(Number.isInteger(canal.osso)&&canal.osso>=0&&canal.osso<20,'Osso pertence ao rig');
    assert.ok(['rotation','translation'].includes(canal.tipo));
    const alvo=`${canal.osso}:${canal.tipo}`;
    assert.ok(!alvos.has(alvo),'Canal de defesa não se repete');alvos.add(alvo);
    assert.equal(canal.tempos[0],0);
    assert.equal(canal.tempos.at(-1),1);
    const tamanho=canal.tipo==='rotation'?4:3;
    assert.equal(canal.valores.length,canal.tempos.length*tamanho);
    for(let i=0;i<canal.tempos.length;i++) {
      assert.ok(Number.isFinite(canal.tempos[i])&&(i===0||canal.tempos[i]>canal.tempos[i-1]));
      const valores=canal.valores.slice(i*tamanho,(i+1)*tamanho);
      assert.ok(valores.every(Number.isFinite));
      if(canal.tipo==='rotation')assert.ok(Math.abs(Math.hypot(...valores)-1)<.002);
      if(canal.osso===0&&canal.tipo==='translation')assert.ok(Math.abs(valores[0])<1e-5&&Math.abs(valores[2])<1e-5,'Defesa não desloca raiz horizontalmente');
    }
    const inicio=canal.valores.slice(0,tamanho),fim=canal.valores.slice(-tamanho);
    const sinal=canal.tipo==='rotation'&&inicio.reduce((s,v,i)=>s+v*fim[i],0)<0?-1:1;
    assert.ok(inicio.every((v,i)=>Math.abs(v-sinal*fim[i])<1e-6),'Ciclo de defesa fecha sem mudança de pose');
  }
  for(let i=0;i<20;i++)for(const tipo of ['rotation','translation'])assert.ok(alvos.has(`${i}:${tipo}`));
  dados.clips=dados.clips.map(c=>c.nome==='defesa'?structuredClone(defesa):c);
  dados.extras.status='estudo-guarda-socos-defesa';
  dados.extras.animacoes='Guarda, dois socos e defesa alta revisados; outros 27 clips preservados.';
  return dados;
}
export function gerarEstudoDefesa() {
  const pasta=resolve(raiz,'art/premium/modelos-3d/estudos-mixamo');
  const ler=nome=>JSON.parse(readFileSync(resolve(pasta,nome)));
  const K=createRequire(import.meta.url)('../../public/js/ko-sim.js');
  const shaSim=createHash('sha256').update(readFileSync(resolve(raiz,'public/js/ko-sim.js'))).digest('hex');
  for(const arquivo of ['jab-relatorio-v5.json','soco-forte-relatorio-v6.json','defesa-relatorio-v7.json'])assert.equal(ler(arquivo).sha256Simulacao,shaSim,'Fontes seguem o motor atual');
  const dados=criarEstudoDefesa(ler('guarda-v4.json'),ler('jab-v5.json'),ler('soco-forte-v6.json'),ler('defesa-v7.json'),K);
  const bytes=exportarGlb(dados);
  const doc=validarGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K);
  assert.equal(doc.animations.length,31);
  const caminho='public/modelos/estudos/pipoca-defesa-v7.glb';
  writeFileSync(resolve(raiz,caminho),bytes);
  const relatorio={aprovadoFinal:false,caminho,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    clips:31,substituidos:['parado','p1','p2','defesa'],protegidaDesdeInicio:true,
    preservados:dados.clips.filter(c=>!['parado','p1','p2','defesa'].includes(c.nome)).map(c=>c.nome),
    limites:['Arte provisória e pesos rígidos.','Defesa baixa, reação ao impacto e demais 27 clips ainda em revisão.']};
  writeFileSync(resolve(pasta,'integracao-v7.json'),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify(relatorio));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)gerarEstudoDefesa();
