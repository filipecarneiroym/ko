import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {carregarModelo} from '../../src/3d/modelo-glb.js';

const K=createRequire(import.meta.url)('../../public/js/ko-sim.js');
export async function verificarPosturas(bytes,simulador=K) {
  const engine=new NullEngine(),scene=new Scene(engine);
  let modelo;
  try {
    const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
    modelo=await carregarModelo(buffer,'pipoca',simulador,scene);
    const esqueleto=modelo.malhas.find(m=>m.skeleton).skeleton;
    const pe=Object.fromEntries(['E','D'].map(l=>[l,esqueleto.bones.find(b=>b.name===`pe_${l}`).getTransformNode()]));
    const cabeca=esqueleto.bones.find(b=>b.name==='cabeca').getTransformNode();
    const joelhos=['E','D'].map(l=>esqueleto.bones.find(b=>b.name===`canela_${l}`).getTransformNode());
    const vertices=modelo.malhas.filter(m=>m.skeleton).map(m=> {
      const juntas=m.getVerticesData('matricesIndices'),pesos=m.getVerticesData('matricesWeights');
      const indices=[];
      for(let v=0;v<m.getTotalVertices();v++)if([12,18].includes(juntas[v*4])&&pesos[v*4]>.99)indices.push(v);
      return {m,indices};
    });
    function ler(clip,q,face) {
      modelo.atualizar({clip,quadro:q,ciclico:false,x:0,y:0,face,visivel:true});
      let sola=Infinity,volume=Infinity;
      for(const {m,indices} of vertices) {
        m.computeWorldMatrix(true);m.skeleton.prepare(true);
        const pos=m.getPositionData(true,false);
        for(const v of indices)sola=Math.min(sola,Vector3.TransformCoordinates(Vector3.FromArray(pos,v*3),m.getWorldMatrix()).y);
        const mundo=m.getWorldMatrix().m;
        for(let i=0;i<pos.length;i+=3)volume=Math.min(volume,pos[i]*mundo[1]+pos[i+1]*mundo[5]+pos[i+2]*mundo[9]+mundo[13]);
      }
      for(const n of [...Object.values(pe),cabeca,...joelhos])n.computeWorldMatrix(true);
      return {pes:Object.fromEntries(Object.entries(pe).map(([l,n])=>[l,n.getAbsolutePosition().clone()])),
        cabeca:cabeca.getAbsolutePosition().clone(),sola,volume,joelho:Math.min(...joelhos.map(n=>n.getAbsolutePosition().y)),
        locais:esqueleto.bones.map(b=>{const n=b.getTransformNode();return [...n.position.asArray(),...n.rotationQuaternion.asArray()];})};
    }
    const resultados=[];
    for(const face of [1,-1]) {
      const guarda=ler('parado',0,face);
      for(const [clip,duracao]of[['agachado',60],['defesaBaixa',60],['pulo',44],['pousando',4]]) {
        let erroApoio=0,solaMinima=Infinity,volumeMinimo=Infinity,joelhoMinimo=Infinity,recolhimento=0;
        const inicio=ler(clip,0,face);
        for(let i=0;i<=duracao*4;i++) {
          const q=i/4,p=ler(clip,q,face);
          assert.ok(p.locais.flat().every(Number.isFinite));
          solaMinima=Math.min(solaMinima,p.sola);
          assert.ok(p.sola>=-.001,`${clip} penetra o chão em q${q}: ${p.sola}`);
          volumeMinimo=Math.min(volumeMinimo,p.volume);joelhoMinimo=Math.min(joelhoMinimo,p.joelho);
          assert.ok(p.volume>=-.001,`${clip} volume do personagem penetra o chão em q${q}: ${p.volume}`);
          assert.ok(p.joelho>=.15,`${clip} joelho dirigido ao piso em q${q}: ${p.joelho}`);
          if(clip!=='pulo')for(const l of ['E','D'])erroApoio=Math.max(erroApoio,p.pes[l].subtract(guarda.pes[l]).length());
          else recolhimento=Math.max(recolhimento,p.pes.E.y-guarda.pes.E.y);
        }
        assert.ok(erroApoio<.001,`${clip} apoio acima de 1mm: ${erroApoio}`);
        const fim=ler(clip,duracao,face);
        if(['agachado','defesaBaixa'].includes(clip)) {
          assert.ok(guarda.cabeca.y-inicio.cabeca.y>.4,'Postura baixa reduz o perfil corporal');
          assert.ok(inicio.locais.every((p,i)=>p.every((v,j)=>Math.abs(v-fim.locais[i][j])<1e-5)),'Ciclo fecha sem salto de pose');
        } else {
          assert.ok(guarda.locais.every((p,i)=>p.every((v,j)=>Math.abs(v-fim.locais[i][j])<1e-5)),`${clip} recupera a guarda completa`);
          if(clip==='pulo')assert.ok(recolhimento>.2,'Pulo recolhe a perna sem duplicar trajetória vertical');
        }
        resultados.push({clip,face,amostras:duracao*4+1,erroApoio,solaMinima,volumeMinimo,joelhoMinimo,recolhimento,
          reducaoAlturaCabeca:guarda.cabeca.y-inicio.cabeca.y});
      }
    }
    return {aprovadoFinal:false,sha256Glb:createHash('sha256').update(bytes).digest('hex'),passoQuadros:.25,
      amostras:resultados.reduce((s,r)=>s+r.amostras,0),resultados,
      limites:['Roupa, expressões e transições exigem revisão separada.','Pulo verificado no lugar; trajetória vertical e pulo duplo pertencem ao motor.']};
  } finally {modelo?.descartar();scene.dispose();engine.dispose();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  const caminho=resolve('public/modelos/estudos/pipoca-direcao-visual-v13.glb');
  const relatorio=await verificarPosturas(readFileSync(caminho));
  writeFileSync(resolve('art/premium/modelos-3d/estudos-mixamo/importacao-posturas-v14.json'),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify(relatorio));
}
