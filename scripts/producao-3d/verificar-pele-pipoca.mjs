import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {carregarModelo} from '../../src/3d/modelo-glb.js';
import {analisarCruzamentos,componentesDaMalha} from './verificar-roupa-pipoca.mjs';

const K=createRequire(import.meta.url)('../../public/js/ko-sim.js');

export async function verificarPele({bufferModelo,caminhoModelo='public/modelos/estudos/pipoca-direcao-visual-v13.glb',clips=['k1','k2'],regiao='pernas',passo=.25}={}) {
  if(!['pernas','tornozelos'].includes(regiao)||!Number.isFinite(passo)||passo<=0)throw new Error('Defina a região e um passo positivo.');
  const bytes=bufferModelo?Buffer.from(bufferModelo):fs.readFileSync(caminhoModelo),engine=new NullEngine(),scene=new Scene(engine);
  scene.useRightHandedSystem=true;
  let modelo;
  try {
    modelo=await carregarModelo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K,scene);
    const malha=scene.meshes.find(m=>m.skeleton&&m.material?.name==='pipoca_pelo_e_faixas_creme');
    if(!malha)throw new Error('Material de pele da Pipoca ausente.');
    const indices=malha.getIndices(),repouso=malha.getVerticesData('position');
    const pernas=componentesDaMalha(indices).filter(g=>g.size===240&&Math.max(...[...g].map(v=>repouso[v*3+1]))<1.1&&Math.min(...[...g].map(v=>repouso[v*3+1]))>.15);
    if(pernas.length!==2)throw new Error('A topologia das pernas mudou; revise o seletor antes de aprovar a pele.');
    const regioes=pernas.map(g=>({lado:[...g].reduce((s,v)=>s+repouso[v*3+2],0)<0?'E':'D',triangulos:Array.from({length:indices.length/3},(_,t)=>t).filter(t=>g.has(indices[t*3])&&(regiao==='pernas'||Array.from(indices.slice(t*3,t*3+3)).every(v=>repouso[v*3+1]<.37)))}));
    const repousoFalhas=regioes.flatMap(r=>analisarCruzamentos(repouso,indices,r.triangulos).map(c=>({lado:r.lado,...c})));
    const resultados=[];
    for(const nome of clips) {
      const grupo=scene.animationGroups.find(g=>g.name===nome);
      if(!grupo)throw new Error(`Clip ausente: ${nome}`);
      scene.animationGroups.forEach(g=>g.stop());grupo.start(false);grupo.pause();
      const fps=grupo.targetedAnimations[0].animation.framePerSecond,duracaoQuadros=(grupo.to-grupo.from)*60/fps,quadros=[];
      for(let q=0;q<duracaoQuadros-1e-7;q+=passo)quadros.push(Number(q.toFixed(8)));
      quadros.push(Number(duracaoQuadros.toFixed(8)));
      const falhas=[];
      for(const quadro of quadros) {
        grupo.goToFrame(grupo.from+quadro*fps/60);malha.computeWorldMatrix(true);malha.skeleton.prepare(true);
        const posicoes=malha.getPositionData(true,false),cruzamentos=regioes.flatMap(r=>analisarCruzamentos(posicoes,indices,r.triangulos).map(c=>({lado:r.lado,...c})));
        if(cruzamentos.length)falhas.push({quadro,cruzamentos});
      }
      resultados.push({clip:nome,duracaoQuadros,amostras:quadros.length,posesComCruzamentos:falhas.length,totalPares:falhas.reduce((s,f)=>s+f.cruzamentos.length,0),falhas});
    }
    return {versao:1,geradoEm:new Date().toISOString(),modelo:bufferModelo?'memoria':caminhoModelo,sha256Glb:createHash('sha256').update(bytes).digest('hex'),regiao,passoQuadros:passo,
      passou:repousoFalhas.length===0&&resultados.every(r=>r.totalPares===0),amostras:resultados.reduce((s,r)=>s+r.amostras,0),repousoFalhas,clips:resultados,
      metodo:'Pele do GLB real importada em Babylon; posições com skinning por CPU e interseções estritas entre triângulos da mesma perna.',
      limites:['A região selecionada é declarada; tornozelos não aprova joelhos, quadril ou roupa.','Amostragem discreta; não verifica colisões entre pernas, com o restante do corpo ou nas transições.','Contato entre faces adjacentes e triângulos coplanares não é classificado como cruzamento.']};
  }finally{modelo?.descartar();scene.dispose();engine.dispose();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const value=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
  const clips=value('--clips')?.split(','),resultado=await verificarPele({caminhoModelo:value('--modelo'),regiao:value('--regiao')??'pernas',passo:Number(value('--passo')??.25),...(clips?{clips}:{})});
  if(value('--saida'))fs.writeFileSync(value('--saida'),JSON.stringify(resultado,null,2)+'\n');
  console.log(JSON.stringify({passou:resultado.passou,regiao:resultado.regiao,amostras:resultado.amostras,sha256Glb:resultado.sha256Glb,clips:resultado.clips.map(({clip,posesComCruzamentos,totalPares})=>({clip,posesComCruzamentos,totalPares}))}));
  if(!resultado.passou)process.exitCode=1;
}
