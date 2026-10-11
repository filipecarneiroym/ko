const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));

// Exercita os arquivos distribuídos e o mesmo importador/relógio usados pelo laboratório.
const codigo = buildSync({
  stdin: {
    resolveDir: root, sourcefile: 'modelos-blockout-qa.js', loader: 'js',
    contents: `
import * as B from '@babylonjs/core/Legacy/legacy.js';
import { carregarModelo } from './src/3d/modelo-glb.js';
import { descreverPose } from './src/3d/estado-visual.mjs';
const engine = new B.Engine(document.querySelector('canvas'), true, {preserveDrawingBuffer:true});
const scene = new B.Scene(engine); scene.clearColor = new B.Color4(.030,.025,.060,1);
const camera = new B.FreeCamera('camera', new B.Vector3(0,2.5,-10),scene);
camera.setTarget(new B.Vector3(0,1.55,0)); camera.mode = B.Camera.ORTHOGRAPHIC_CAMERA;
camera.orthoLeft=-4.2;camera.orthoRight=4.2;camera.orthoTop=2.45;camera.orthoBottom=-2.45;
new B.HemisphericLight('ambiente',new B.Vector3(0,1,-.3),scene).intensity=.85;
new B.DirectionalLight('principal',new B.Vector3(-.5,-1,.8),scene).intensity=1.4;
const piso=B.MeshBuilder.CreateGround('piso',{width:15,height:8},scene);
const tinta=new B.StandardMaterial('piso',scene);tinta.diffuseColor=new B.Color3(.08,.06,.12);tinta.specularColor=B.Color3.Black();piso.material=tinta;piso.position.y=-.006;
const registros=[];
const estado=KOSim.novo({lutadores:['pipoca','uivo'],treino:true});estado.fase='luta';
function conferirValores(valores,rotulo){if(Array.from(valores).some(n=>!Number.isFinite(n)))throw Error(rotulo+' contém valor não finito');}
function assinatura(registro){
  const resultado=[];
  for(const mesh of registro.malhas){
    mesh.computeWorldMatrix(true); conferirValores(mesh.getWorldMatrix().asArray(),'Matriz da malha');
    if(mesh.skeleton){mesh.skeleton.prepare(true);const matrizes=mesh.skeleton.getTransformMatrices(mesh);conferirValores(matrizes,'Matrizes do esqueleto');resultado.push(...matrizes);}
    if(!mesh.isEnabled()||!mesh.isVisible||!mesh.getTotalVertices())throw Error('Malha desapareceu');
  }
  return resultado;
}
function pose(registro,clip,quadro){
  const p=estado.p[registro.lado];const golpe=KOSim.LUTADORES[p.id].golpes[clip];
  p.estado=golpe?'golpe':clip;p.golpe=golpe?clip:null;p.t=quadro;p.y=0;p.sumido=false;p.face=registro.lado===0?1:-1;
  p.x=Math.round((KOSim.LARGURA/2+(registro.lado===0?-1.55:1.55)*24)*KOSim.U);
  estado.fase=['final','vitimaFinal'].includes(clip)?'final':'luta';estado.fT=quadro;
  registro.modelo.atualizar(descreverPose(p,KOSim,estado));
}
window.carregarBlockouts=async arquivos=>{
  for(const [lado,arquivo]of arquivos.entries()){
    const antes=new Set(scene.animationGroups);
    const buffer=Uint8Array.from(atob(arquivo.base64),c=>c.charCodeAt(0)).buffer;
    const modelo=await carregarModelo(buffer,arquivo.id,KOSim,scene);
    const grupos=scene.animationGroups.filter(g=>!antes.has(g));
    const raiz=scene.getTransformNodeByName('modelo-'+arquivo.id);
    const malhas=raiz.getChildMeshes(false).filter(m=>m.getTotalVertices()>0);
    const registro={id:arquivo.id,lado,modelo,grupos,malhas};registros.push(registro);
    pose(registro,'parado',18);
  }
  scene.render();await scene.whenReadyAsync();scene.render();
  return registros.map(r=>({id:r.id,clips:r.grupos.length,malhas:r.malhas.length,ossos:[...new Set(r.malhas.map(m=>m.skeleton).filter(Boolean))].map(s=>s.bones.length)}));
};
window.auditarBlockouts=()=>{
  const relatorio=[];
  for(const registro of registros){
    const clips=[];
    for(const grupo of registro.grupos){
      for(const alvo of grupo.targetedAnimations){
        for(const chave of alvo.animation.getKeys()){
          const v=chave.value;const valores=typeof v==='number'?[v]:v.asArray?v.asArray():v;
          conferirValores(valores,'Chave '+grupo.name);
          if(alvo.animation.dataType===B.Animation.ANIMATIONTYPE_QUATERNION&&Math.abs(Math.hypot(...valores)-1)>1e-5)throw Error('Quaternion sem normalização em '+grupo.name);
        }
      }
      const amostras=[];let minimoY=Infinity,maximoY=-Infinity;
      for(const fracao of [0,.25,.5,.75,1]){
        const fps=grupo.targetedAnimations[0].animation.framePerSecond;
        const quadro=(grupo.to-grupo.from)/fps*60*fracao;
        pose(registro,grupo.name,quadro);scene.render();
        amostras.push(assinatura(registro));
        for(const mesh of registro.malhas){
          mesh.refreshBoundingInfo(true);const limites=mesh.getBoundingInfo().boundingBox;
          conferirValores([...limites.minimumWorld.asArray(),...limites.maximumWorld.asArray()],'Limites '+grupo.name);
          minimoY=Math.min(minimoY,limites.minimumWorld.y);maximoY=Math.max(maximoY,limites.maximumWorld.y);
          if(limites.maximumWorld.subtract(limites.minimumWorld).length()>15)throw Error('Malha expandiu além do esperado em '+grupo.name);
        }
      }
      const mudou=amostras.slice(1).some(a=>a.some((v,i)=>Math.abs(v-amostras[0][i])>1e-5));
      clips.push({nome:grupo.name,mudou,minimoY,maximoY});
    }
    relatorio.push({id:registro.id,clips});pose(registro,'parado',18);
  }
  scene.render();return relatorio;
};
window.exibirBlockouts=poses=>{
  for(const r of registros){const p=poses[r.id]||{clip:'parado',quadro:18};pose(r,p.clip,p.quadro);}
  scene.render();return registros.map(r=>({id:r.id,assinatura:assinatura(r),ativas:r.malhas.filter(m=>scene.getActiveMeshes().data.includes(m)).length}));
};
window.orientacaoBlockouts=()=>registros.map(r=>{
  pose(r,'parado',18);scene.render();
  const mesh=r.malhas.find(m=>m.skeleton),ossos=mesh.skeleton.bones;
  const cabeca=ossos.find(o=>o.name==='cabeca').getTransformNode().getAbsolutePosition();
  const mandibula=ossos.find(o=>o.name==='mandibula').getTransformNode().getAbsolutePosition();
  return {id:r.id,face:estado.p[r.lado].face,frenteX:mandibula.x-cabeca.x};
});
window.encerrarBlockouts=()=>{registros.forEach(r=>r.modelo.descartar());scene.dispose();engine.dispose();};
`,
  },
  bundle: true, write: false, format: 'iife', minify: true,
}).outputFiles[0].text;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
    const erros = []; page.on('pageerror', erro => erros.push(erro.message));
    await page.setContent('<style>body{margin:0;background:#080710}canvas{display:block;width:1200px;height:700px}p{position:fixed;left:20px;top:8px;color:#e4ddf4;font:15px sans-serif}</style><canvas width="1200" height="700"></canvas><p>ESTUDOS 3D · PIPOCA / UIVO · SEM APROVAÇÃO ARTÍSTICA FINAL</p>');
    await page.addScriptTag({ path: path.join(root, 'public/js/ko-sim.js') });
    await page.addScriptTag({ content: codigo });
    const arquivos = ['pipoca', 'uivo'].map(id => ({ id, base64: fs.readFileSync(path.join(root, 'public/modelos/blockout', `${id}-v1.glb`)).toString('base64') }));
    const importados = await page.evaluate(arquivos => carregarBlockouts(arquivos), arquivos);
    for (const modelo of importados) {
      assert.equal(modelo.clips, 31, `${modelo.id}: todos os clips precisam importar`);
      assert.ok(modelo.malhas > 0, `${modelo.id}: malhas visíveis`);
      assert.deepEqual(modelo.ossos, [20], `${modelo.id}: esqueleto completo`);
    }
    const relatorio = await page.evaluate(() => auditarBlockouts());
    for (const modelo of relatorio) {
      assert.equal(modelo.clips.length, 31);
      assert.ok(modelo.clips.filter(c => c.mudou).length >= 25, `${modelo.id}: animações variam conforme o tempo`);
      for (const nome of ['parado', 'andando', 'p1', 'k2', 'esp', 'caido']) assert.equal(modelo.clips.find(c => c.nome === nome).mudou, true, `${modelo.id}: movimento em ${nome}`);
    }
    const cenarios = {
      guarda: { pipoca: { clip: 'parado', quadro: 18 }, uivo: { clip: 'parado', quadro: 18 } },
      soco: { pipoca: { clip: 'p1', quadro: 4 }, uivo: { clip: 'p1', quadro: 5 } },
      chute: { pipoca: { clip: 'k2', quadro: 9 }, uivo: { clip: 'k2', quadro: 10 } },
      uivo: { pipoca: { clip: 'defesa', quadro: 18 }, uivo: { clip: 'esp', quadro: 15 } },
      caido: { pipoca: { clip: 'caido', quadro: 40 }, uivo: { clip: 'caido', quadro: 40 } },
    };
    const orientacoes = await page.evaluate(() => orientacaoBlockouts());
    let guarda;
    for (const [nome, poses] of Object.entries(cenarios)) {
      const resultado = await page.evaluate(poses => exibirBlockouts(poses), poses);
      for (const modelo of resultado) assert.ok(modelo.ativas > 0, `${modelo.id}: malha ativa em ${nome}`);
      if (nome === 'guarda') guarda = resultado;
      else assert.notDeepEqual(resultado, guarda, `${nome}: pose difere da guarda`);
      await page.screenshot({ path: path.join(root, '.browser-check', `modelos-${nome}.png`) });
    }
    fs.writeFileSync(path.join(root, '.browser-check/modelos-blockout-qa.json'), JSON.stringify({ importados, orientacoes, relatorio }, null, 2));
    for (const orientacao of orientacoes) assert.ok(orientacao.frenteX * orientacao.face > .02, `${orientacao.id}: modelo precisa olhar para a direção do KSim`);
    assert.deepEqual(erros, [], 'Importação e amostragem sem erros JavaScript');
    await page.evaluate(() => encerrarBlockouts());
    console.log('PASS blockouts reais: 2 GLB, 20 ossos cada, 31 clips cada, chaves e matrizes finitas, poses ligadas ao relógio KSim e 5 capturas.');
  } finally { await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
