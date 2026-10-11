// Confere o GLB real: proteção visual em todo o ciclo, pés e simulação preservados.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { carregarModelo } from '../../src/3d/modelo-glb.js';

const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const K=createRequire(import.meta.url)('../../public/js/ko-sim.js');
const bytes=readFileSync(resolve(raiz,'public/modelos/estudos/pipoca-defesa-v7.glb'));
const engine=new NullEngine(),scene=new Scene(engine);
let modelo;
try {
  modelo=await carregarModelo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K,scene);
  const luvas=scene.meshes.find(m=>m.material?.name==='pipoca_luvas_vermelhas');
  assert.ok(luvas);
  assert.equal(scene.animationGroups.length,31);
  const bone=nome=>luvas.skeleton.bones.find(b=>b.name===nome);
  const juntas=luvas.getVerticesData('matricesIndices');
  const indices={E:bone('mao_E').getIndex(),D:bone('mao_D').getIndex()};
  const estado=K.novo({lutadores:['pipoca','uivo'],treino:true}),antes=JSON.stringify(estado);
  // Não repetir q60 como q0: conferir também o último sample real da emenda.
  const pose={clip:'defesa',quadro:0,ciclico:false,x:0,y:0,face:1,visivel:true};
  const ancoras=new Map(),inicio=new Map(),amostras=[];
  let erroMaximoPe=0,erroMaximoSola=0,erroEmenda=0;
  for(const face of [1,-1])for(let q=0;q<=60;q+=.5) {
    modelo.atualizar({...pose,face,quadro:q});
    for(const malha of scene.meshes.filter(m=>m.skeleton)) {
      malha.computeWorldMatrix(true);malha.skeleton.prepare(true);
      assert.ok(Array.from(malha.skeleton.getTransformMatrices(malha)).every(Number.isFinite));
    }
    const noCabeca=bone('cabeca').getTransformNode();
    noCabeca.computeWorldMatrix(true);
    const cabeca=noCabeca.getAbsolutePosition();
    const posicoes=luvas.getPositionData(true,false),caixas={};
    for(const lado of ['E','D']) {
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(let i=0;i<posicoes.length/3;i++)if(juntas[i*4]===indices[lado]) {
        const v=Vector3.TransformCoordinates(Vector3.FromArray(posicoes,i*3),luvas.getWorldMatrix());
        minX=Math.min(minX,v.x*face);maxX=Math.max(maxX,v.x*face);
        minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
      }
      assert.ok([minX,maxX,minY,maxY].every(Number.isFinite));
      assert.ok(maxY>cabeca.y+.08&&minY<cabeca.y-.04,`Luva ${lado} cobre altura do rosto, q${q}`);
      assert.ok(maxX>cabeca.x*face+.22&&minX>cabeca.x*face+.08,`Luva ${lado} fica à frente do rosto, q${q}`);
      caixas[lado]=[minX,maxX,minY,maxY];
      const noPe=bone(`pe_${lado}`).getTransformNode();
      noPe.computeWorldMatrix(true);
      const pe=noPe.getAbsolutePosition(),chave=`${face}:${lado}`;
      if(q===0){ancoras.set(chave,pe.clone());inicio.set(chave,caixas[lado]);}
      erroMaximoPe=Math.max(erroMaximoPe,pe.subtract(ancoras.get(chave)).length());
      if(q===60)erroEmenda=Math.max(erroEmenda,...caixas[lado].map((v,i)=>Math.abs(v-inicio.get(chave)[i])));
    }
    // As solas precisam continuar no chão, além de manter âncoras imóveis.
    const alturas={E:Infinity,D:Infinity};
    for(const malha of scene.meshes.filter(m=>m.skeleton&&m.getTotalVertices())) {
      const ids=malha.getVerticesData('matricesIndices'),vertices=malha.getPositionData(true,false);
      for(const lado of ['E','D']) {
        const indice=bone(`pe_${lado}`).getIndex();
        let altura=Infinity;
        for(let i=0;i<vertices.length/3;i++)if(ids[i*4]===indice) {
          altura=Math.min(altura,Vector3.TransformCoordinates(Vector3.FromArray(vertices,i*3),malha.getWorldMatrix()).y);
        }
        alturas[lado]=Math.min(alturas[lado],altura);
      }
    }
    for(const altura of Object.values(alturas)) {
      assert.ok(Number.isFinite(altura),'Sola identificável na malha');
      erroMaximoSola=Math.max(erroMaximoSola,Math.abs(altura));
    }
    if(Number.isInteger(q)&&q%15===0)amostras.push({face,quadro:q,cabeca:cabeca.asArray(),luvas:caixas});
  }
  assert.ok(erroMaximoPe<.001,'Âncoras da defesa abaixo de 1mm');
  assert.ok(erroMaximoSola<.001,'Solas da defesa abaixo de 1mm');
  assert.ok(erroEmenda<1e-6,'Defesa emenda sem salto');
  assert.equal(JSON.stringify(estado),antes);
  const relatorio={aprovadoFinal:false,clips:31,amostrasCiclo:242,faces:[1,-1],protegidaEmTodoCiclo:true,
    erroMaximoPe,erroMaximoSola,erroEmenda,simulacaoPreservada:true,gpuUsada:false,amostras,
    limites:['Cobertura geométrica inicial das luvas; não comprova ausência de interpenetração.','Arte e defesa baixa pendentes.']};
  modelo.descartar();modelo=null;
  assert.equal(scene.animationGroups.length,0);assert.equal(scene.skeletons.length,0);
  writeFileSync(resolve(raiz,'art/premium/modelos-3d/estudos-mixamo/importacao-v7.json'),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify(relatorio));
} finally {modelo?.descartar();scene.dispose();engine.dispose();}
