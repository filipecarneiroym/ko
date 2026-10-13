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
const visual=process.argv.includes('--visual');
const retrato=process.argv.includes('--retrato');
const turnaround=process.argv.includes('--turnaround');
const semPele=process.argv.includes('--sem-pele');
const tecidoDebug=process.argv.includes('--tecido-debug');
const prova=process.argv.includes('--prova-short');
const provaPelagem=process.argv.includes('--prova-pelagem');
const basePelagem=process.argv.includes('--base-pelagem');
const detalhePelagem=provaPelagem&&process.argv.includes('--detalhe-pelagem');
const rotuloPelagem=process.argv.includes('--512')?'512-':'';
const pasta=provaPelagem?path.join(raiz,'.browser-check/prova-pelagem',(basePelagem?'base-':'normal-')+rotuloPelagem+(detalhePelagem?'detalhe-':'')+(retrato?'retrato':revisao?'revisao':'movimentos')):prova?path.join(raiz,'.browser-check/prova-short'):path.join(raiz,'art/premium/modelos-3d/estudos-mixamo',turnaround?tecidoDebug?'turnaround-tecido-debug-v13':semPele?'turnaround-sem-pele-v13':'turnaround-visual-v13':visual
  ?retrato?'retrato-visual-v13':revisao?'revisao-visual-v13':'previa-visual-v13'
  :revisao?'revisao-corpo-v10':'previa-corpo-v10');
const quadros=[];
const inserir=(clip,quadro,atraso,x=0)=>quadros.push({clip,quadro,atraso,x});
if(turnaround) {
  for(const vista of ['frente','perfil','costas'])quadros.push({clip:'rest',quadro:0,atraso:30,x:0,vista,face:1});
} else if(prova) {
  for(const [clip,quadro] of [['parado',20],['k2',8]])quadros.push({clip,quadro,atraso:20,x:0,vista:'frente',face:1});
} else if(retrato) {
  for(const vista of ['tres-quartos','frontal','perfil'])quadros.push({clip:'parado',quadro:0,atraso:30,x:0,vista});
} else if(revisao) {
  const poses=visual?[
    ['parado',0],['parado',20],['parado',40],['parado',80],
    ['p1',4],['p2',6],['k1',6],['k1',12],['k2',8],
    ['defesa',0],['defesa',30],['dano',0],['dano',1],
    ['agachado',0],['defesaBaixa',30],['pulo',8],['pousando',1],
    ['andando',0],['andando',3],['andando',4.5],['andando',5.5],['andando',6],['andando',9],
    ['cp',4],['ck',8],['ap',10],['ak',8],['esp',10],['sup',44],
    ['corrida',0],['corrida',2],['corrida',4],['corrida',6],
    ['recuo',0],['recuo',6],['recuo',12],['recuo',18],
    ['quebra',0],['quebra',4],['quebra',8],['quebra',16],
    ['caido',1],['caido',6],['caido',12],['caido',46],
    ['levantando',0],['levantando',4],['levantando',8],['levantando',12],['levantando',16],
    ['rolando',2],['rolando',8],['rolando',14],['rolando',20],['rolando',24],
    ['agarrando',4],['agarrando',8],['agarrando',10],['agarrando',18],['agarrando',30],
    ['agarrado',4],['agarrado',8],['agarrado',10],['agarrado',18],['agarrado',30],
    ['tonto',0],['tonto',15],['tonto',30],['tonto',45],['tonto',60],
    ['vitoria',0],['vitoria',20],['vitoria',50],['vitoria',80],['vitoria',100],
    ['derrotado',0],['derrotado',12],['derrotado',30],['derrotado',50],['derrotado',100],
    ['final',0],['final',20],['final',36],['final',60],['final',138],['final',180],['final',200],
    ['vitimaFinal',0],['vitimaFinal',36],['vitimaFinal',72],['vitimaFinal',138],['vitimaFinal',176],['vitimaFinal',200],
  ]:[0,3,6,9].map(q=>['andando',q]);
  for(const vista of visual?['frente','costas','frente-invertida']:['frente','costas'])for(const [clip,quadro] of poses)
    quadros.push({clip,quadro,atraso:20,x:(vista==='frente-invertida'?-1:1)*quadro*(clip==='andando'?.109375:clip==='corrida'?86/16/24:clip==='recuo'?-90/16/24:0),vista,face:vista==='frente-invertida'?-1:1});
} else {
  for(let i=0;i<16;i++)inserir('parado',i*6.5,11);
  for(let q=0;q<=12;q++)inserir('p1',q,5);
  for(let q=1;q<=18;q++)inserir('p2',q,5);
  if(visual) {
    for(let q=0;q<=24;q++)inserir('k1',q,5);
    for(let q=1;q<=28;q++)inserir('k2',q,5);
  }
  for(let q=0;q<60;q+=5)inserir('defesa',q,q===0?20:8);
  for(let q=1;q<=4;q++)inserir('parado',q,8);
  for(let q=0;q<=12;q++)inserir('dano',q,5);
  for(let q=0;q<=24;q++)inserir('andando',q,5,q*.109375);
  inserir('parado',0,30);
}
assert.equal(quadros.length,turnaround?3:prova?2:retrato?3:revisao?visual?279:8:visual?155:102);

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
import {criarApresentacao} from './src/3d/apresentacao.js';
(async()=>{
  const engine=new Engine(document.querySelector('canvas'),true,{preserveDrawingBuffer:true});
  engine.setHardwareScalingLevel(1);
  const scene=new Scene(engine);scene.clearColor.set(.025,.035,.065,1);
  const camera=new FreeCamera('revisao',new Vector3(4.5,3.1,-6),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft=camera.orthoBottom=-1.85;camera.orthoRight=camera.orthoTop=1.85;
  camera.setTarget(new Vector3(.15,1.55,0));
  const apresentacao=${visual?'criarApresentacao(scene)':'null'};
  if(!apresentacao) {
  const ambiente=new HemisphericLight('ambiente',new Vector3(.2,1,-.4),scene);ambiente.intensity=.9;
  const chave=new DirectionalLight('principal',new Vector3(-.5,-1,.5),scene);chave.intensity=1.1;
  const piso=MeshBuilder.CreateGround('piso',{width:14,height:8},scene);
  const tinta=new StandardMaterial('chao',scene);tinta.diffuseColor=Color3.FromHexString('#202b40');tinta.specularColor=Color3.Black();piso.material=tinta;
  for(let x=-6;x<=6;x++)MeshBuilder.CreateLines('grade'+x,{points:[new Vector3(x,.001,-4),new Vector3(x,.001,4)],colors:undefined},scene).color=Color3.FromHexString('#34435b');
  }
  const resposta=await fetch('/modelo.glb');
  if(!resposta.ok)throw new Error('Modelo indisponível');
  const modelo=await carregarModelo(await resposta.arrayBuffer(),'pipoca',KOSim,scene);
  apresentacao?.prepararModelo(modelo);
  if(${semPele})for(const material of scene.materials)if(material.name==='pipoca_pelo_e_faixas_creme') {
    material.alpha=0;
    material.transparencyMode=2;
    material.disableDepthWrite=true;
  }
  if(${tecidoDebug})for(const material of scene.materials)if(material.name==='pipoca_tecido_indigo') {
    material.albedoTexture=null;
    material.albedoColor=Color3.FromHexString('#00ff40');
    material.emissiveColor=Color3.FromHexString('#00ff40');
    material.backFaceCulling=false;
  }
  window.__pose=(p)=>{
    if(p.clip!=='rest')modelo.atualizar({...p,ciclico:['parado','defesa','andando','corrida','agachado','defesaBaixa','tonto'].includes(p.clip),y:0,face:p.face??1,visivel:true});
    camera.position.set((['costas','frente-invertida'].includes(p.vista)?-4.5:4.5)+p.x,3.1,-6);camera.setTarget(new Vector3(.15+p.x,1.55,0));
    if(${turnaround}) {
      camera.orthoLeft=-1.35;camera.orthoRight=1.35;camera.orthoBottom=-1.8;camera.orthoTop=1.8;
      camera.position.set(p.vista==='frente'?7:p.vista==='costas'?-7:0,1.62,p.vista==='perfil'?-7:0);
      camera.setTarget(new Vector3(0,1.62,0));
    } else if(${retrato}) {
      camera.orthoLeft=camera.orthoBottom=-.95;camera.orthoRight=camera.orthoTop=.95;
      camera.position.set(p.vista==='frontal'?7:p.vista==='perfil'?.1:4.5,2.9,p.vista==='frontal'?-.15:-6);
      camera.setTarget(new Vector3(.1,2.45,0));
      if(${detalhePelagem}) {
        camera.orthoLeft=camera.orthoBottom=-.42;camera.orthoRight=camera.orthoTop=.42;
        camera.position.y=2.5;camera.setTarget(new Vector3(.1,2.22,0));
      }
    }
    scene.render();
  };
  window.__pose({clip:'parado',quadro:0,x:0});
  engine.runRenderLoop(()=>scene.render());
  if(${provaPelagem})await scene.whenReadyAsync();
  window.__fechar=()=>{modelo.descartar();scene.dispose();engine.dispose();};
  window.__pronto=true;
})().catch(e=>{window.__erro=e.message;console.error(e);});
`;
(async()=>{
  const caminhoModelo=provaPelagem?(basePelagem?'.browser-check/pipoca-pelagem-base.glb':'.browser-check/pipoca-pelagem.glb'):prova?'.browser-check/pipoca-short-calibrado.glb':visual?'public/modelos/estudos/pipoca-direcao-visual-v13.glb':'public/modelos/estudos/pipoca-corpo-v10.glb';
  const glb=fs.readFileSync(path.join(raiz,caminhoModelo));
  const sha256Glb=createHash('sha256').update(glb).digest('hex');
  const bundle=await build({stdin:{contents:codigo,resolveDir:raiz,sourcefile:'previa-pipoca.js'},bundle:true,write:false,format:'iife',minify:true,logLevel:'silent'});
  const browser=await chromium.launch({executablePath:process.env.KO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const largura=turnaround?720:480,altura=turnaround?960:480;
    const page=await browser.newPage({viewport:{width:largura,height:altura},deviceScaleFactor:1,serviceWorkers:'block'});
    const erros=[];page.on('pageerror',e=>erros.push(e.message));
    await page.route(origem+'/**',rota=>{
      const url=new URL(rota.request().url()).pathname;
      if(url==='/modelo.glb')return rota.fulfill({contentType:'model/gltf-binary',body:glb});
      if(url==='/previa.js')return rota.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
      if(url==='/ko-sim.js')return rota.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(raiz,'public/js/ko-sim.js'))});
      if(url==='/style.css')return rota.fulfill({contentType:'text/css',body:`body{margin:0}canvas{display:block;width:${largura}px;height:${altura}px}`});
      return rota.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self';script-src 'self';style-src 'self';connect-src 'self';img-src 'self' data: blob:"},body:`<!doctype html><link rel="stylesheet" href="/style.css"><canvas width="${largura}" height="${altura}"></canvas><script src="/ko-sim.js"></script><script src="/previa.js"></script>`});
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
    fs.writeFileSync(path.join(pasta,'quadros.json'),JSON.stringify({origem:turnaround?'Turnaround neutro de corpo inteiro pelo importador real.':retrato?'Revisão do rosto pelo importador real.':revisao?'Revisão de poses extremas, frente, costas e orientação invertida pelo importador real.':'GLB real no importador do laboratório; montagem de estudos com gestos rápidos ampliados no tempo.',caminhoModelo,sha256Glb,quadros},null,2)+'\n');
    console.log('Prévia '+(visual?'visual v13':'corpo v10')+': '+quadros.length+' PNG de 480px, sem erros JS.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
