// Prévia do modelo real pelo mesmo importador do laboratório; navegador oculto.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {build}=require('esbuild');
const raiz=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(raiz,'.browser-check/node_modules/playwright'));
const origem='http://127.0.0.1:8041';
const revisao=process.argv.includes('--revisao');
const pasta=path.join(raiz,'art/premium/modelos-3d/estudos-mixamo',revisao?'revisao-corpo-v10':'previa-corpo-v10');
const quadros=[];
const inserir=(clip,quadro,atraso,x=0)=>quadros.push({clip,quadro,atraso,x});
if(revisao) {
  for(const vista of ['frente','costas'])for(const quadro of [0,3,6,9])
    quadros.push({clip:'andando',quadro,atraso:20,x:quadro*.109375,vista});
} else {
  for(let i=0;i<16;i++)inserir('parado',i*6.5,11);
  for(let q=0;q<=12;q++)inserir('p1',q,5);
  for(let q=1;q<=18;q++)inserir('p2',q,5);
  for(let q=0;q<60;q+=5)inserir('defesa',q,q===0?20:8);
  for(let q=1;q<=4;q++)inserir('parado',q,8);
  for(let q=0;q<=12;q++)inserir('dano',q,5);
  for(let q=0;q<=24;q++)inserir('andando',q,5,q*.109375);
  inserir('parado',0,30);
}
assert.equal(quadros.length,revisao?8:102);

const codigo=`
import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {Camera} from '@babylonjs/core/Cameras/camera.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {carregarModelo} from './src/3d/modelo-glb.js';
(async()=>{
  const engine=new Engine(document.querySelector('canvas'),true,{preserveDrawingBuffer:true});
  engine.setHardwareScalingLevel(1);
  const scene=new Scene(engine);scene.clearColor.set(.025,.035,.065,1);
  const camera=new FreeCamera('revisao',new Vector3(4.5,3.1,-6),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft=camera.orthoBottom=-1.85;camera.orthoRight=camera.orthoTop=1.85;
  camera.setTarget(new Vector3(.15,1.55,0));
  const ambiente=new HemisphericLight('ambiente',new Vector3(.2,1,-.4),scene);ambiente.intensity=.9;
  const chave=new DirectionalLight('principal',new Vector3(-.5,-1,.5),scene);chave.intensity=1.1;
  const piso=MeshBuilder.CreateGround('piso',{width:14,height:8},scene);
  const tinta=new StandardMaterial('chao',scene);tinta.diffuseColor=Color3.FromHexString('#202b40');tinta.specularColor=Color3.Black();piso.material=tinta;
  for(let x=-6;x<=6;x++)MeshBuilder.CreateLines('grade'+x,{points:[new Vector3(x,.001,-4),new Vector3(x,.001,4)],colors:undefined},scene).color=Color3.FromHexString('#34435b');
  const resposta=await fetch('/modelo.glb');
  if(!resposta.ok)throw new Error('Modelo indisponível');
  const modelo=await carregarModelo(await resposta.arrayBuffer(),'pipoca',KOSim,scene);
  window.__pose=(p)=>{
    modelo.atualizar({...p,ciclico:['parado','defesa','andando'].includes(p.clip),y:0,face:1,visivel:true});
    camera.position.set((p.vista==='costas'?-4.5:4.5)+p.x,3.1,-6);camera.setTarget(new Vector3(.15+p.x,1.55,0));
    scene.render();
  };
  window.__pose({clip:'parado',quadro:0,x:0});
  engine.runRenderLoop(()=>scene.render());
  window.__fechar=()=>{modelo.descartar();scene.dispose();engine.dispose();};
  window.__pronto=true;
})().catch(e=>{window.__erro=e.message;console.error(e);});
`;
(async()=>{
  const glb=fs.readFileSync(path.join(raiz,'public/modelos/estudos/pipoca-corpo-v10.glb'));
  const sha256Glb=createHash('sha256').update(glb).digest('hex');
  const bundle=await build({stdin:{contents:codigo,resolveDir:raiz,sourcefile:'previa-pipoca.js'},bundle:true,write:false,format:'iife',minify:true,logLevel:'silent'});
  const browser=await chromium.launch({executablePath:process.env.KO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:480,height:480},deviceScaleFactor:1,serviceWorkers:'block'});
    const erros=[];page.on('pageerror',e=>erros.push(e.message));
    await page.route(origem+'/**',rota=>{
      const url=new URL(rota.request().url()).pathname;
      if(url==='/modelo.glb')return rota.fulfill({contentType:'model/gltf-binary',body:glb});
      if(url==='/previa.js')return rota.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
      if(url==='/ko-sim.js')return rota.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(raiz,'public/js/ko-sim.js'))});
      if(url==='/style.css')return rota.fulfill({contentType:'text/css',body:'body{margin:0}canvas{display:block;width:480px;height:480px}'});
      return rota.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self';script-src 'self';style-src 'self';connect-src 'self';img-src 'self' data: blob:"},body:'<!doctype html><link rel="stylesheet" href="/style.css"><canvas width="480" height="480"></canvas><script src="/ko-sim.js"></script><script src="/previa.js"></script>'});
    });
    await page.goto(origem);
    await page.waitForFunction(()=>window.__pronto||window.__erro,null,{timeout:30000});
    assert.equal(await page.evaluate(()=>window.__erro),undefined,'Modelo carrega no renderizador real');
    await page.waitForTimeout(1000); // Compilação inicial dos materiais.
    fs.mkdirSync(pasta,{recursive:true});
    for(let i=0;i<quadros.length;i++) {
      const quadro=quadros[i];
      await page.evaluate(p=>window.__pose(p),quadro);
      await page.locator('canvas').screenshot({path:path.join(pasta,String(i).padStart(3,'0')+'.png')});
    }
    await page.evaluate(()=>window.__fechar());
    assert.deepEqual(erros,[]);
    fs.writeFileSync(path.join(pasta,'quadros.json'),JSON.stringify({origem:revisao?'Revisão frontal e traseira da passada pelo importador real.':'GLB real no importador do laboratório; montagem de estudos com gestos rápidos ampliados no tempo.',sha256Glb,quadros},null,2)+'\n');
    console.log('Prévia corpo v10: '+quadros.length+' PNG de 480px, '+(revisao?'frente/costas da passada':'guarda/socos/defesa/reação/marcha')+', sem erros JS.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
