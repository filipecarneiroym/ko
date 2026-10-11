// Exercita o importador real do laboratório sem abrir navegador ou usar GPU.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { carregarModelo } from '../../src/3d/modelo-glb.js';
import { descreverPose } from '../../src/3d/estado-visual.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const socos = process.argv.includes('--socos');
const jab = process.argv.includes('--jab') || socos;
const bytes = readFileSync(resolve(raiz, socos ? 'public/modelos/estudos/pipoca-socos-v6.glb' : jab ? 'public/modelos/estudos/pipoca-jab-v5.glb' : 'public/modelos/estudos/pipoca-guarda-v4.glb'));
const engine = new NullEngine();
const scene = new Scene(engine);
let modelo;
try {
  modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
  const estado = K.novo({ lutadores: ['pipoca','uivo'], treino: true });
  const antes = JSON.stringify(estado);
  const grupos = [...scene.animationGroups];
  assert.equal(grupos.length, 31);
  const raizModelo = scene.getTransformNodeByName('modelo-pipoca');
  const malhas = raizModelo.getChildMeshes().filter(m => m.getTotalVertices());
  assert.ok(malhas.length > 0);
  const clip = grupos.find(g => g.name === 'parado');
  const fps = clip.targetedAnimations[0].animation.framePerSecond;
  assert.ok(Math.abs(clip.to/fps - 104/60) < 1e-6);
  const p = { ...estado.p[0], x: K.LARGURA*K.U/2, y: 0, estado:'parado', sumido:false, face:1 };
  const repousoPe = new Map();
  let erroMaximoPe = 0;
  const amostras = [];
  for (const face of [1,-1]) {
    for (let q=0; q<104; q+=.5) {
      p.face=face; p.t=q;
      modelo.atualizar(descreverPose(p,K,estado));
      const assinaturas=[];
      for (const mesh of malhas) {
        mesh.computeWorldMatrix(true);
        mesh.skeleton?.prepare(true);
        const matrizes=mesh.skeleton?.getTransformMatrices(mesh) || [];
        assert.ok(Array.from(matrizes).every(Number.isFinite), 'Matrizes finitas após importação');
        assinaturas.push(...matrizes);
      }
      const esqueleto=malhas.find(m=>m.skeleton).skeleton;
      const noCabeca=esqueleto.bones.find(b=>b.name==='cabeca').getTransformNode();
      const noMandibula=esqueleto.bones.find(b=>b.name==='mandibula').getTransformNode();
      noCabeca.computeWorldMatrix(true); noMandibula.computeWorldMatrix(true);
      assert.ok((noMandibula.getAbsolutePosition().x-noCabeca.getAbsolutePosition().x)*face>.02,
        `Guarda orientada à frente do lutador, face ${face}, quadro ${q}`);
      for(const lado of ['E','D']) {
        const no=esqueleto.bones.find(b=>b.name===`pe_${lado}`).getTransformNode();
        no.computeWorldMatrix(true);
        const pos=no.getAbsolutePosition().clone();
        const chave=`${face}:${lado}`;
        if(!repousoPe.has(chave))repousoPe.set(chave,pos);
        erroMaximoPe=Math.max(erroMaximoPe,pos.subtract(repousoPe.get(chave)).length());
      }
      if(face===1 && [0,52].includes(q))amostras.push(assinaturas);
    }
  }
  assert.ok(erroMaximoPe<.001, `Âncoras importadas: ${erroMaximoPe}`);
  assert.ok(amostras[0].some((v,i)=>Math.abs(v-amostras[1][i])>1e-4), 'A guarda se movimenta');
  const golpes=[];
  for(const [nome,golpe] of Object.entries(K.LUTADORES.pipoca.golpes)) {
    p.estado='golpe';p.golpe=nome;p.t=Math.min(golpe.dur-1,5);
    modelo.atualizar(descreverPose(p,K,estado));
    assert.ok(scene.animationGroups.find(g=>g.name===nome));
    golpes.push(nome);
  }
  const contatos=[];
  if(jab) {
    const luvas=malhas.find(m=>m.material?.name==='pipoca_luvas_vermelhas');
    assert.ok(luvas,'Malha das luvas identificável');
    const juntas=luvas.getVerticesData('matricesIndices');
    for(const nome of socos?['p1','p2']:['p1']) {
    const golpe=K.LUTADORES.pipoca.golpes[nome];
    const [de,ate]=[golpe.janelas[0].de,golpe.janelas[0].ate];
    const indiceMao=luvas.skeleton.bones.find(b=>b.name===(nome==='p2'?'mao_D':'mao_E')).getIndex();
    let erroAncoraSoco=0;
    for(const face of [1,-1])for(let q=0;q<=golpe.dur;q+=.5) {
      // Iniciar pela guarda evita acionar a interpolação exclusiva do combo.
      if(q===0){p.face=face;p.estado='parado';p.t=0;modelo.atualizar(descreverPose(p,K,estado));}
      p.face=face;p.estado='golpe';p.golpe=nome;p.t=q;
      modelo.atualizar(descreverPose(p,K,estado));
      luvas.computeWorldMatrix(true);luvas.skeleton.prepare(true);
      for(const lado of ['E','D']) {
        const no=luvas.skeleton.bones.find(b=>b.name===`pe_${lado}`).getTransformNode();
        no.computeWorldMatrix(true);
        erroAncoraSoco=Math.max(erroAncoraSoco,no.getAbsolutePosition().subtract(repousoPe.get(`${face}:${lado}`)).length());
      }
      const posicoes=luvas.getPositionData(true,false);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(let i=0;i<posicoes.length/3;i++)if(juntas[i*4]===indiceMao) {
        const v=Vector3.TransformCoordinates(Vector3.FromArray(posicoes,i*3),luvas.getWorldMatrix());
        minX=Math.min(minX,v.x*face);maxX=Math.max(maxX,v.x*face);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
      }
      assert.ok([minX,maxX,minY,maxY].every(Number.isFinite),'Luva deformada com valores finitos');
      if(q>=de&&q<=ate) {
        const [x,y,w,h]=golpe.janelas[0].caixa;
        assert.ok(maxX>=(x+w)/24-.2 && maxX<=(x+w)/24+.1,'Extensão da luva próxima do alcance real');
        assert.ok(maxY>=-(y+h)/24 && minY<=-y/24,'Luva sobrepõe altura real do golpe');
      }
      if(Number.isInteger(q))contatos.push({golpe:nome,face,quadro:q,luva:[minX,maxX,minY,maxY]});
    }
    assert.ok(erroAncoraSoco<.001,`Pés estáveis no ${nome}, incluindo meios quadros: ${erroAncoraSoco}`);
    for(const face of [1,-1]) {
      const inicio=contatos.find(c=>c.golpe===nome&&c.face===face&&c.quadro===0).luva;
      const fim=contatos.find(c=>c.golpe===nome&&c.face===face&&c.quadro===golpe.dur).luva;
      assert.ok(inicio.every((v,i)=>Math.abs(v-fim[i])<.001),'O soco retorna à pose de guarda');
    }
    }
  }
  assert.equal(JSON.stringify(estado),antes,'Renderizar não altera a simulação');
  const relatorio={status:'Importação técnica validada; arte e transições ainda em revisão.',
    clips:grupos.length,malhas:malhas.length,faces:[1,-1],amostrasGuarda:416,
    erroMaximoAncoraImportada:erroMaximoPe,golpesPreservados:golpes,
    estadoSimulacaoPreservado:true,orientacaoFrontalVerificada:true,gpuUsada:false,contatos};
  modelo.descartar();modelo=null;
  assert.equal(scene.animationGroups.length,0,'Animações liberadas ao descartar');
  assert.equal(scene.skeletons.length,0,'Esqueleto liberado ao descartar');
  writeFileSync(resolve(raiz,`art/premium/modelos-3d/estudos-mixamo/importacao-v${socos?6:jab?5:4}.json`),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify(relatorio));
} finally { modelo?.descartar(); scene.dispose();engine.dispose(); }
