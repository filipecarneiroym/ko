const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inflateSync}=require('node:zlib');
const K=require('../../../public/js/ko-sim.js');
const modulos=Promise.all([
  import('../../../src/producao3d/pipoca-figurino.mjs'),
  import('../../../src/producao3d/pipoca-visual-v3.mjs'),
  import('../../../src/producao3d/rig.mjs'),
  import('../../../scripts/producao-3d/gerar-estudo-visual.mjs'),
  import('../../../scripts/producao-3d/glb.mjs'),
  import('../../../scripts/producao-3d/verificar-roupa-pipoca.mjs'),
  import('../../../src/producao3d/pipoca-posturas.mjs'),
  import('../../../src/producao3d/pipoca-tecnicas.mjs'),
]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function componentes(p) {
  const adj=new Map();for(let t=0;t<p.indices.length;t+=3)for(const [a,b]of[[p.indices[t],p.indices[t+1]],[p.indices[t+1],p.indices[t+2]],[p.indices[t+2],p.indices[t]]]) {
    if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);
  }
  const vistos=new Set(),grupos=[];
  for(const v of adj.keys())if(!vistos.has(v)) {
    const g=new Set([v]),fila=[v];vistos.add(v);while(fila.length)for(const n of adj.get(fila.pop()))if(!vistos.has(n)){vistos.add(n);g.add(n);fila.push(n);}grupos.push(g);
  }
  return grupos;
}
function fontes() {
  const pasta=path.resolve(__dirname,'../../../art/premium/modelos-3d/estudos-mixamo');
  return ['guarda-v4.json','jab-v5.json','soco-forte-v6.json','defesa-v7.json','reacao-v8.json','andando-v9.json','chute-v11.json','chute-forte-v12.json'].map(nome=>JSON.parse(fs.readFileSync(path.join(pasta,nome))));
}
const clipsFigurino=['parado','p1','p2','defesa','dano','andando','k1','k2','agachado','defesaBaixa','pulo','pousando','cp','ck','ap','ak','esp','sup'];

test('faixas brancas e filetes vermelhos do pé existem nos dois lados e seguem o osso correto',async()=> {
  const [,,{criarRig}]=await modulos,{criarPipoca}=await import('../../../src/producao3d/pipoca.mjs');
  const ossos=criarRig(),dados=criarPipoca(ossos),pelo=dados.primitivas.find(p=>p.material===0),vermelho=dados.primitivas.find(p=>p.material===2);
  for(const [lado,sinal]of [['E',-1],['D',1]]) {
    const pe=ossos.findIndex(o=>o.nome===`pe_${lado}`);
    const contar=(p)=> {
      let n=0;
      for(let i=0;i<p.posicoes.length/3;i++) {
        const x=p.posicoes[i*3],y=p.posicoes[i*3+1],z=p.posicoes[i*3+2];
        if(p.juntas[i*4]===pe&&p.pesos[i*4]>.99&&x>0&&x<.26&&y>=0&&y<.16&&Math.abs(z-sinal*.24)<.12)n++;
      }
      return n;
    };
    assert.ok(contar(pelo)>=900,`${lado}: faixas brancas modeladas acompanham o pé`);
    assert.ok(contar(vermelho)>=300,`${lado}: filetes vermelhos modelados acompanham o pé`);
  }
});

test('toros respeitam o eixo declarado para as faixas do pé e articulações',async()=> {
  const {criarMalha}=await import('../../../src/producao3d/malha.mjs');
  for(const eixo of ['x','y','z']) {
    const malha=criarMalha();malha.torus([0,0,0],1,.1,0,0,{eixo,segmentos:12,aneis:8});
    const p=malha.primitivas()[0],extensoes=[0,1,2].map(k=>Math.max(...Array.from({length:p.posicoes.length/3},(_,i)=>p.posicoes[i*3+k]))-Math.min(...Array.from({length:p.posicoes.length/3},(_,i)=>p.posicoes[i*3+k])));
    const normal='xyz'.indexOf(eixo);
    assert.ok(extensoes[normal]<.3,`${eixo}: toro deve ser fino ao longo do eixo declarado`);
    for(let k=0;k<3;k++)if(k!==normal)assert.ok(extensoes[k]>2,`${eixo}: toro deve envolver os outros dois eixos`);
  }
  assert.throws(()=>criarMalha().torus([0,0,0],1,.1,0,0,{eixo:'w'}),/Eixo de toro inválido/);
});

async function dadosAnimados() {
  const [,,,{criarEstudoVisual},,,{aplicarPosturasPipoca},{aplicarTecnicasPipoca}]=await modulos;
  const pasta=path.resolve(__dirname,'../../../art/premium/modelos-3d/estudos-mixamo');
  return aplicarTecnicasPipoca(aplicarPosturasPipoca(criarEstudoVisual(...fontes(),K),JSON.parse(fs.readFileSync(path.join(pasta,'posturas-v14.json')))),JSON.parse(fs.readFileSync(path.join(pasta,'tecnicas-v15.json'))));
}
function assinatura(p,tri) {
  return JSON.stringify([p.material,...tri.flatMap(v=>[...p.posicoes.slice(v*3,v*3+3),...p.normais.slice(v*3,v*3+3),...p.juntas.slice(v*4,v*4+4),...p.pesos.slice(v*4,v*4+4)])]);
}

test('figurino preserva anatomia, rosto, rig, materiais e dados de animação recebidos',async()=> {
  const [{refinarFigurino},{criarPipocaVisualV3},{criarRig}]=await modulos;
  const ossos=criarRig(),base=criarPipocaVisualV3(ossos),antes=JSON.stringify(base),rigAntes=JSON.stringify(ossos),clips=[{nome:'contrato-preservado'}];base.clips=clips;
  const resultado=refinarFigurino(base,ossos);
  assert.equal(resultado.clips,clips);assert.equal(JSON.stringify(ossos),rigAntes);assert.equal(resultado.materiais.length,6);
  for(let i=0;i<6;i++)if(i!==1)assert.deepEqual(resultado.materiais[i],base.materiais[i]);
  assert.deepEqual(resultado.materiais[1].pbrMetallicRoughness.baseColorFactor,[1,1,1,1]);
  assert.deepEqual(resultado.materiais[1].pbrMetallicRoughness.baseColorTexture,{index:0});
  delete base.clips;assert.equal(JSON.stringify(base),antes,'Não modifica a malha recebida');
  const preservar=new Set(ossos.map((o,i)=>/^(cabeca|mandibula|orelha_[ED]|mao_[ED]|pe_[ED]|cauda)$/.test(o.nome)?i:-1)),esperados=new Map();
  for(const p of base.primitivas)for(let t=0;t<p.indices.length;t+=3) {
    const tri=p.indices.slice(t,t+3);
    if(tri.every(v=>p.pesos.slice(v*4,v*4+4).every((peso,k)=>peso<1e-8||preservar.has(p.juntas[v*4+k])))){const chave=assinatura(p,tri);esperados.set(chave,(esperados.get(chave)||0)+1);}
  }
  for(const p of resultado.primitivas)for(let t=0;t<p.indices.length;t+=3){const chave=assinatura(p,p.indices.slice(t,t+3));if(esperados.has(chave))esperados.set(chave,esperados.get(chave)-1);}
  assert.ok([...esperados.values()].every(v=>v===0),'Rosto, orelhas, luvas, pés e cauda permanecem geometricamente iguais');
  assert.equal(refinarFigurino(resultado,ossos),resultado,'Wrapper não duplica acabamentos');
});

test('alças compartilham arestas do top e mantêm apenas dois componentes de tecido',async()=> {
  const [{refinarFigurino},{criarPipocaVisualV3},{criarRig}]=await modulos;
  const ossos=criarRig(),base=criarPipocaVisualV3(ossos),dados=refinarFigurino(base,ossos),p=dados.primitivas.find(p=>p.material===1),origem=base.primitivas.find(p=>p.material===1);
  assert.equal(componentes(p).length,2);assert.deepEqual(p.posicoes.slice(0,origem.posicoes.length),origem.posicoes,'Não altera proporções anteriores');
  assert.deepEqual(p.juntas.slice(0,origem.juntas.length),origem.juntas);assert.deepEqual(p.pesos.slice(0,origem.pesos.length),origem.pesos);
  const arestas=new Map();
  for(let t=0;t<p.indices.length;t+=3) {
    const [a,b,c]=p.indices.slice(t,t+3);
    for(const [u,v]of[[a,b],[b,c],[c,a]]){const chave=[u,v].sort((a,b)=>a-b).join(':');if(!arestas.has(chave))arestas.set(chave,[]);arestas.get(chave).push(u<v?1:-1);}
  }
  assert.ok([...arestas.values()].every(v=>v.length<=2),'Superfície manifold');
  assert.ok([...arestas.values()].filter(v=>v.length===2).every(v=>v[0]!==v[1]),'Costuras seguem orientação coerente');
  const primeiro=dados.extras.figurino.alcas.primeiroVertice;
  let costuras=0;for(const [chave,v]of arestas)if(v.length===2&&chave.split(':').map(Number).every(n=>n<primeiro)) {
    const [a,b]=chave.split(':').map(Number);if(p.posicoes[a*3+1]>1.80&&p.posicoes[b*3+1]>1.80)costuras++;
  }
  assert.equal(costuras,4,'Duas pontas de cada alça soldadas ao anel superior');
  const short=componentes(origem).find(g=>Math.min(...[...g].map(v=>origem.posicoes[v*3+1]))<1);
  for(const v of short)assert.deepEqual(p.normais.slice(v*3,v*3+3),origem.normais.slice(v*3,v*3+3),'Normais do short intactas');
});

test('alças e fivela têm pesos e normais válidos, sem triângulos degenerados',async()=> {
  const [{refinarFigurino},{criarPipocaVisualV3},{criarRig}]=await modulos;
  const ossos=criarRig(),dados=refinarFigurino(criarPipocaVisualV3(ossos),ossos);
  const partes=[{material:1,...dados.extras.figurino.alcas},...dados.extras.figurino.partes];
  assert.equal(partes.length,2,'Faixa e listras são estampa sem geometria extra');
  for(const parte of partes) {
    const p=dados.primitivas.find(p=>p.material===parte.material);
    for(let v=parte.primeiroVertice;v<parte.primeiroVertice+parte.vertices;v++) {
      assert.ok(Math.abs(Math.hypot(...p.normais.slice(v*3,v*3+3))-1)<1e-8);
      const w=p.pesos.slice(v*4,v*4+4),j=p.juntas.slice(v*4,v*4+4);
      assert.ok(w.every(p=>p>=0&&p<=1));assert.ok(Math.abs(w.reduce((s,p)=>s+p,0)-1)<1e-9);assert.ok(j.every(j=>Number.isInteger(j)&&j>=0&&j<20));
    }
    for(let t=parte.primeiroTriangulo;t<parte.primeiroTriangulo+parte.triangulos;t++) {
      const [a,b,c]=p.indices.slice(t*3,t*3+3).map(v=>p.posicoes.slice(v*3,v*3+3));
      assert.ok(Math.hypot(...cross(sub(b,a),sub(c,a)))>1e-12);
    }
  }
});

function pngPixels(bytes) {
  const idats=[];let offset=8;
  while(offset<bytes.length){const n=bytes.readUInt32BE(offset),tipo=bytes.toString('ascii',offset+4,offset+8);if(tipo==='IDAT')idats.push(bytes.subarray(offset+8,offset+8+n));offset+=12+n;}
  const largura=bytes.readUInt32BE(16),altura=bytes.readUInt32BE(20),raw=inflateSync(Buffer.concat(idats));
  assert.equal(raw.length,altura*(1+largura*4));
  for(let y=0;y<altura;y++)assert.equal(raw[y*(1+largura*4)],0);
  return {largura,altura,pixel:(u,v)=>Array.from(raw.subarray(Math.floor(v*altura)*(1+largura*4)+1+Math.floor(u*largura)*4,Math.floor(v*altura)*(1+largura*4)+1+Math.floor(u*largura)*4+4))};
}

test('faixa e duas listras por lateral usam PNG embutido e UVs contínuos, sem alterar o short',async()=> {
  const [{refinarFigurino},{criarPipocaVisualV3},{criarRig}]=await modulos;
  const ossos=criarRig(),base=criarPipocaVisualV3(ossos),dados=refinarFigurino(base,ossos),p=dados.primitivas.find(p=>p.material===1),origem=base.primitivas.find(p=>p.material===1);
  assert.equal(dados.imagens.length,1);assert.equal(dados.texturas.length,1);assert.equal(dados.samplers.length,1);
  assert.equal(dados.imagens[0].uri,undefined);assert.equal(dados.imagens[0].mimeType,'image/png');
  const png=pngPixels(dados.imagens[0].dados);assert.equal(png.largura,512);assert.equal(png.altura,512);
  const creme=png.pixel(.8,.05),indigo=png.pixel(.9,.9);
  assert.ok(creme[0]>200&&creme[1]>200&&creme[2]>180,'Faixa branca creme da referência');
  assert.ok(indigo[2]>indigo[0]*2,'Tecido conserva índigo');
  const listra=png.pixel(.365,.5);assert.ok(listra[0]>230&&listra[1]>220&&listra[2]>210);
  assert.deepEqual(png.pixel(.405,.5),listra,'As duas listras têm a mesma tinta creme');
  assert.deepEqual(png.pixel(.385,.5),indigo,'Espaço índigo separa as duas listras');
  const brilhoFaixa=Array.from({length:64},(_,i)=>png.pixel(.7+i/512,.08)[0]);
  assert.ok(Math.max(...brilhoFaixa)-Math.min(...brilhoFaixa)>=5&&Math.max(...brilhoFaixa)-Math.min(...brilhoFaixa)<=12,'Nervuras discretas diferenciam a faixa da pele');
  assert.ok(png.pixel(.8,.02)[0]>png.pixel(.8,.14)[0]+10,'Transição tonal dá leitura à faixa elástica');
  assert.equal(p.uvs.length,p.posicoes.length/3*2);assert.ok(p.uvs.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert.deepEqual(p.indices.slice(0,origem.indices.length),origem.indices,'A triangulação do short não é subdividida pela estampa');
});

test('alças não se atravessam nas 18 animações revisadas do GLB real',async()=> {
  const [{refinarFigurino},,,{criarEstudoVisual},{exportarGlb},{analisarCruzamentos}]=await modulos;
  const [{NullEngine},{Scene},{carregarModelo}]=await Promise.all([import('@babylonjs/core/Engines/nullEngine.js'),import('@babylonjs/core/scene.js'),import('../../../src/3d/modelo-glb.js')]);
  const dados=await dadosAnimados(),bytes=exportarGlb(dados),engine=new NullEngine(),scene=new Scene(engine);let modelo;
  try {
    modelo=await carregarModelo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K,scene);
    const roupa=scene.meshes.find(m=>m.material?.name==='pipoca_tecido_indigo'),p=dados.primitivas.find(p=>p.material===1),indices=roupa.getIndices();
    const top=componentes(p).find(g=>Math.min(...[...g].map(v=>p.posicoes[v*3+1]))>1.4),selecionados=Array.from({length:indices.length/3},(_,i)=>i).filter(t=>top.has(indices[t*3]));
    for(const clip of clipsFigurino) {
      scene.animationGroups.forEach(g=>g.stop());const grupo=scene.animationGroups.find(g=>g.name===clip);grupo.start(false);grupo.pause();const fps=grupo.targetedAnimations[0].animation.framePerSecond,dur=grupo.to*60/fps;
      for(let q=0;q<=dur+1e-6;q+=.5) {
        grupo.goToFrame(q*fps/60);roupa.computeWorldMatrix(true);roupa.skeleton.prepare(true);
        assert.deepEqual(analisarCruzamentos(roupa.getPositionData(true,false),indices,selecionados),[],`Top/alça no clip ${clip}, quadro ${q}`);
      }
    }
  } finally {modelo?.descartar();scene.dispose();engine.dispose();}
});

test('a fivela não atravessa o short deformado; faixa e listras pertencem à superfície',async()=> {
  const [{refinarFigurino},,,{criarEstudoVisual},{exportarGlb},{analisarCruzamentos}]=await modulos;
  const [{NullEngine},{Scene},{carregarModelo}]=await Promise.all([import('@babylonjs/core/Engines/nullEngine.js'),import('@babylonjs/core/scene.js'),import('../../../src/3d/modelo-glb.js')]);
  const dados=await dadosAnimados(),bytes=exportarGlb(dados),engine=new NullEngine(),scene=new Scene(engine);let modelo;
  try {
    modelo=await carregarModelo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K,scene);
    const tecido=scene.meshes.find(m=>m.material?.name==='pipoca_tecido_indigo'),creme=scene.meshes.find(m=>m.material?.name==='pipoca_pelo_e_faixas_creme'),escuro=scene.meshes.find(m=>m.material?.name==='pipoca_pupilas_e_sobrancelhas');
    const p=dados.primitivas.find(p=>p.material===1),short=componentes(p).find(g=>Math.min(...[...g].map(v=>p.posicoes[v*3+1]))<1);
    const indicesShort=[];for(let t=0;t<p.indices.length;t+=3)if(short.has(p.indices[t]))indicesShort.push(...p.indices.slice(t,t+3));
    const quantidadeShort=indicesShort.length/3,offsetCreme=tecido.getTotalVertices(),offsetEscuro=offsetCreme+creme.getTotalVertices();
    const indices=[...indicesShort];
    for(const parte of dados.extras.figurino.partes) {
      const malha=parte.material===0?creme:escuro,offset=parte.material===0?offsetCreme:offsetEscuro;
      for(const i of malha.getIndices().slice(parte.primeiroTriangulo*3,(parte.primeiroTriangulo+parte.triangulos)*3))indices.push(i+offset);
    }
    let amostras=0;
    for(const clip of clipsFigurino) {
      scene.animationGroups.forEach(g=>g.stop());const grupo=scene.animationGroups.find(g=>g.name===clip);grupo.start(false);grupo.pause();const fps=grupo.targetedAnimations[0].animation.framePerSecond,dur=grupo.to*60/fps;
      for(let q=0;q<=dur+1e-6;q+=.5) {
        grupo.goToFrame(q*fps/60);tecido.computeWorldMatrix(true);tecido.skeleton.prepare(true);
        const posicoes=[...tecido.getPositionData(true,false),...creme.getPositionData(true,false),...escuro.getPositionData(true,false)];
        const cruzamentos=analisarCruzamentos(posicoes,indices).filter(r=>r.triangulos[0]<quantidadeShort&&r.triangulos[1]>=quantidadeShort);
        assert.deepEqual(cruzamentos,[],`Acabamento atravessou short em ${clip}, quadro ${q}`);amostras++;
      }
    }
    assert.ok(amostras>500);
  } finally {modelo?.descartar();scene.dispose();engine.dispose();}
});
