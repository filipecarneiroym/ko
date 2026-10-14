// Captura o Shoryuken da Pipoca (dp) pelo KOSim real; nenhum evento ou contato é inventado pelo render.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {build}=require('esbuild');
const raiz=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(raiz,'.browser-check/node_modules/playwright'));
const origem='http://127.0.0.1:8042';
const pasta=path.join(raiz,'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/shoryu');
const caminho='public/modelos/estudos/pipoca-v5-vermelha.glb';const caminhoAdversaria='public/modelos/estudos/pipoca-v5-azul.glb';
const codigo=`
import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {Camera} from '@babylonjs/core/Cameras/camera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {criarApresentacao} from './src/3d/apresentacao.js';
import {criarEfeitos} from './src/3d/efeitos.js';
import {carregarModelo} from './src/3d/modelo-glb.js';
import {descreverPose} from './src/3d/estado-visual.mjs';
(async()=>{
  const engine=new Engine(document.querySelector('canvas'),true,{preserveDrawingBuffer:true});
  engine.setHardwareScalingLevel(1);
  const scene=new Scene(engine),camera=new FreeCamera('luta',new Vector3(0,3.6,-13),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  const apresentacao=criarApresentacao(scene);
  const modelos=[];
  for(const [id,url]of[['pipoca','/pipoca.glb'],['pipoca','/pipoca2.glb']]) {
    const modelo=await carregarModelo(await(await fetch(url)).arrayBuffer(),id,KOSim,scene);
    apresentacao.prepararModelo(modelo);modelos.push(modelo);
  }
  const efeitos=criarEfeitos(scene,KOSim,{matches:false});
  let estado;
  function apresentar(){
    estado.p.forEach((p,i)=>modelos[i].atualizar(descreverPose(p,KOSim,estado)));
    efeitos.atualizar(estado.f,estado);
  }
  function renderizar(){
    apresentar();
    const xs=estado.p.map(p=>(p.x/KOSim.U-KOSim.LARGURA/2)/24),centro=(xs[0]+xs[1])/2;
    const altura=Math.max(...estado.p.map(p=>p.y/KOSim.U/24));
    const aspecto=800/500,metade=Math.max(2.3,1.4+altura,(Math.abs(xs[1]-xs[0])+4)/(2*aspecto));
    camera.position.set(centro,3.6,-13);camera.setTarget(new Vector3(centro,1.5+Math.max(0,altura-.9)/2,0));
    camera.orthoLeft=-metade*aspecto;camera.orthoRight=metade*aspecto;camera.orthoBottom=-metade;camera.orthoTop=metade;
    scene.render();
    return {quadro:estado.f,fase:estado.fase,tempoFase:estado.fT,hitstop:estado.hitstop,
      lutadores:estado.p.map(p=>({id:p.id,estado:p.estado,golpe:p.golpe,quadro:p.t,x:p.x,y:p.y,sumido:p.sumido})),
      projeteis:estado.proj.map(p=>({tipo:p.tipo,dono:p.dono,x:p.x,y:p.y,quadro:p.t})),eventos:estado.ev};
  }
  window.__iniciar=(nome)=>{
    efeitos.limpar();estado=KOSim.novo({lutadores:['pipoca','pipoca'],treino:true});
    estado.fase='luta';estado.fT=0;
    estado.p[0].x=146*KOSim.U;estado.p[1].x=(nome==='cenoura'?280:nome==='super'?210:180)*KOSim.U;
    if(nome==='super')estado.p[0].poder=1000;
    if(nome==='final') {estado.fase='acaba';estado.vencedor=0;estado.p[1].estado='tonto';}
    return renderizar();
  };
  window.__avancar=(nome,de,ate)=>{
    for(let f=de;f<ate;f++){
      let entrada=0;
      if(['cenoura','super','final'].includes(nome)&&f===0)entrada=KOSim.B.S;
      if(nome==='baixo')entrada=KOSim.B.D|(f===1?KOSim.B.P:f>=10&&f<18?KOSim.B.K:0);
      if(nome==='shoryu')entrada=[KOSim.B.R,KOSim.B.D,KOSim.B.D|KOSim.B.R,KOSim.B.R,KOSim.B.R|KOSim.B.P][f]||0;
      KOSim.passo(estado,[entrada,0]);efeitos.eventos(estado.ev,estado.f,estado);apresentar();
    }
    return renderizar();
  };
  window.__fechar=()=>{efeitos.descartar();modelos.forEach(m=>m.descartar());scene.dispose();engine.dispose();};
  window.__iniciar('cenoura');
  engine.runRenderLoop(()=>scene.render());
  await scene.whenReadyAsync();window.__pronto=true;
})().catch(e=>{window.__erro=e.stack||e.message;});
`;
(async()=>{
  const glb=fs.readFileSync(path.join(raiz,caminho));
  const bundle=await build({stdin:{contents:codigo,resolveDir:raiz,sourcefile:'previa-combate.js'},bundle:true,write:false,format:'iife',minify:true,logLevel:'silent'});
  const browser=await chromium.launch({executablePath:process.env.KO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:800,height:500},deviceScaleFactor:1,serviceWorkers:'block'});
    const erros=[],pedidos=[];page.on('pageerror',e=>erros.push(e.message));
    await page.route('**/*',rota=>{
      const url=new URL(rota.request().url());pedidos.push(url.origin);
      assert.equal(url.origin,origem,'Prévia autocontida sem pedidos externos');
      if(url.pathname==='/pipoca.glb')return rota.fulfill({contentType:'model/gltf-binary',body:glb});
      if(url.pathname==='/pipoca2.glb')return rota.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(path.join(raiz,caminhoAdversaria))});
      if(url.pathname==='/previa.js')return rota.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
      if(url.pathname==='/ko-sim.js')return rota.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(raiz,'public/js/ko-sim.js'))});
      if(url.pathname==='/style.css')return rota.fulfill({contentType:'text/css',body:'body{margin:0}canvas{display:block;width:800px;height:500px}'});
      return rota.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self';script-src 'self';style-src 'self';connect-src 'self';img-src 'self' data: blob:"},body:'<!doctype html><link rel="stylesheet" href="/style.css"><canvas width="800" height="500"></canvas><script src="/ko-sim.js"></script><script src="/previa.js"></script>'});
    });
    await page.goto(origem);await page.waitForFunction(()=>window.__pronto||window.__erro,null,{timeout:30000});
    assert.equal(await page.evaluate(()=>window.__erro),undefined);
    await page.waitForTimeout(1000);
    fs.mkdirSync(pasta,{recursive:true});const quadros=[];
    for(const [nome,tempos]of[
      ['shoryu',[0,3,6,9,12,16,20,26,32,40]],
    ]) {
      await page.evaluate(n=>window.__iniciar(n),nome);let anterior=0;
      for(const q of tempos) {
        const estado=await page.evaluate(([n,de,ate])=>window.__avancar(n,de,ate),[nome,anterior,q]);anterior=q;
        const arquivo=String(quadros.length).padStart(3,'0')+'.png';
        await page.locator('canvas').screenshot({path:path.join(pasta,arquivo)});
        quadros.push({cenario:nome,arquivo,...estado});
      }
    }
    await page.evaluate(()=>window.__fechar());assert.deepEqual(erros,[]);
    const sha=b=>createHash('sha256').update(b).digest('hex');
    fs.writeFileSync(path.join(pasta,'quadros.json'),JSON.stringify({aprovadoFinal:false,
      descricao:'Cenoura, Super, ataques baixos, ataque aéreo e Final calculados pelo KOSim real. Pipoca vermelha (jogador) contra Pipoca azul.',
      caminhoModelo:caminho,sha256Glb:sha(glb),sha256Simulacao:sha(fs.readFileSync(path.join(raiz,'public/js/ko-sim.js'))),
      quadros,pedidosExternos:pedidos.filter(o=>o!==origem)},null,2)+'\n');
    console.log('Combate real da Pipoca: '+quadros.length+' capturas de 800×500, sem erros JS ou pedidos externos.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
