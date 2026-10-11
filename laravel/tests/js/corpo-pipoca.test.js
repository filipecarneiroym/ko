const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('../../../src/producao3d/pele-fluida.mjs'),
  import('../../../src/producao3d/pipoca-corpo-v2.mjs'),
  import('../../../src/producao3d/rig.mjs'),
  import('../../../src/producao3d/pipoca.mjs'),
  import('../../../scripts/producao-3d/gerar-estudo-corpo.mjs'),
  import('../../../scripts/producao-3d/gerar-estudo-marcha.mjs'),
  import('../../../scripts/producao-3d/glb.mjs'),
  import('../../../src/3d/contrato-glb.mjs'),
]);

function fontes() {
  const pasta = path.resolve(__dirname,'../../../art/premium/modelos-3d/estudos-mixamo');
  return ['guarda-v4.json','jab-v5.json','soco-forte-v6.json','defesa-v7.json','reacao-v8.json','andando-v9.json']
    .map(nome => JSON.parse(fs.readFileSync(path.join(pasta,nome))));
}

const subtrair = (a,b) => a.map((v,i)=>v-b[i]);
const cruzar = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

test('loft compartilha anéis, fecha sem costura duplicada e mantém winding externo', async () => {
  const [{ criarLoft }] = await modulos;
  const aneis = [0,1,2].map((y,i)=>({centro:[0,y,0],raios:[1,1],ossos:i===1?[0,1]:[i===0?0:1],pesos:i===1?[2,2]:[1]}));
  const p = criarLoft({aneis,material:0,segmentos:12,tampas:true});
  assert.equal(p.posicoes.length/3,3*12+2,'Não duplica vértice na emenda circular');
  const arestas = new Map();
  for(let t=0;t<p.indices.length;t+=3) {
    const [ia,ib,ic]=p.indices.slice(t,t+3);
    const [a,b,c]=[ia,ib,ic].map(i=>p.posicoes.slice(i*3,i*3+3));
    const n=cruzar(subtrair(b,a),subtrair(c,a));
    assert.ok(Math.hypot(...n)>1e-10,'Triângulo possui área positiva');
    if(ia<36&&ib<36&&ic<36)assert.ok(n[0]*(a[0]+b[0]+c[0])+n[2]*(a[2]+b[2]+c[2])>0,'Lado da superfície aponta para fora');
    for(const [u,v]of[[ia,ib],[ib,ic],[ic,ia]]) {
      const chave=[u,v].sort((x,y)=>x-y).join(':');arestas.set(chave,(arestas.get(chave)||0)+1);
    }
  }
  assert.ok([...arestas.values()].every(v=>v===2),'Loft fechado é uma superfície sem borda ou aresta duplicada');
  for(let i=0;i<p.normais.length;i+=3)assert.ok(Math.abs(Math.hypot(...p.normais.slice(i,i+3))-1)<1e-10);
  assert.deepEqual(p.pesos.slice(12*4,12*4+4),[.5,.5,0,0],'Normaliza pesos por vértice');
  const invalida=structuredClone(aneis);invalida[1].pesos=[1,-1];
  assert.throws(()=>criarLoft({aneis:invalida,material:0}),/Pesos/);
});

function assinaturaTriangulo(p,indices) {
  return JSON.stringify([p.material,...indices.flatMap(i=>[
    ...p.posicoes.slice(i*3,i*3+3),...p.normais.slice(i*3,i*3+3),
    ...p.juntas.slice(i*4,i*4+4),...p.pesos.slice(i*4,i*4+4),
  ])]);
}

test('corpo troca regiões rígidas e preserva todos os triângulos de rosto, luvas, pés, orelhas e cauda', async () => {
  const [, { criarPipocaCorpoV2 }, { criarRig }, { criarPipoca }] = await modulos;
  const ossos=criarRig(),original=JSON.stringify(ossos),base=criarPipoca(ossos),corpo=criarPipocaCorpoV2(ossos);
  assert.equal(JSON.stringify(ossos),original,'Não altera os pivôs de repouso');
  const manter=new Set(ossos.map((o,i)=>/^(cabeca|mandibula|orelha_[ED]|mao_[ED]|pe_[ED]|cauda)$/.test(o.nome)?i:-1));
  const esperados=new Map();
  for(const p of base.primitivas)for(let t=0;t<p.indices.length;t+=3) {
    const tri=p.indices.slice(t,t+3);
    if(tri.every(i=>manter.has(p.juntas[i*4]))) {
      const chave=assinaturaTriangulo(p,tri);esperados.set(chave,(esperados.get(chave)||0)+1);
    }
  }
  assert.ok(esperados.size>1000,'Confere geometria real, incluindo detalhes da referência');
  for(const p of corpo.primitivas)for(let t=0;t<p.indices.length;t+=3) {
    const chave=assinaturaTriangulo(p,p.indices.slice(t,t+3));
    if(esperados.has(chave))esperados.set(chave,esperados.get(chave)-1);
  }
  assert.ok([...esperados.values()].every(v=>v===0),'Preserva coordenadas, normais, pesos e winding de todas as peças selecionadas');
  assert.deepEqual(corpo.materiais,base.materiais,'Paleta e materiais existentes mantidos');
  assert.ok(corpo.extras.corpo.superficies.filter(s=>/^(top|short|faixa|barra)/.test(s.nome)).every(s=>!s.tampas),'Roupa usa cascas abertas');
});

test('peso misto cobre cotovelos, joelhos e cintura com duas influências normalizadas', async () => {
  const [, { criarPipocaCorpoV2 }, { criarRig }] = await modulos;
  const ossos=criarRig(),corpo=criarPipocaCorpoV2(ossos),pares=new Set();
  let mistos=0;
  for(const p of corpo.primitivas)for(let i=0;i<p.pesos.length;i+=4) {
    const pesos=p.pesos.slice(i,i+4),juntas=p.juntas.slice(i,i+4);
    assert.ok(pesos.every(v=>v>=0&&v<=1));assert.ok(Math.abs(pesos.reduce((s,v)=>s+v,0)-1)<1e-12);
    assert.ok(juntas.every(v=>Number.isInteger(v)&&v>=0&&v<ossos.length));
    const ativas=juntas.filter((_,j)=>pesos[j]>1e-8);
    assert.ok(ativas.length<=2);
    if(ativas.length===2){mistos++;pares.add(ativas.map(i=>ossos[i].nome).sort().join(':'));}
  }
  assert.equal(mistos,corpo.extras.corpo.verticesMistos);assert.ok(mistos>500);
  for(const par of [['quadril','tronco'],['tronco','peito'],['braco_E','antebraco_E'],['braco_D','antebraco_D'],['coxa_E','canela_E'],['coxa_D','canela_D']])assert.ok(pares.has(par.sort().join(':')),`Transição ${par.join('/')}`);
});

test('short une cintura e pernas em uma superfície, sem bordas superiores expostas nos tubos', async () => {
  const [, { criarPipocaCorpoV2 }, { criarRig }] = await modulos;
  const corpo=criarPipocaCorpoV2(criarRig()),roupa=corpo.primitivas.find(p=>p.material===1);
  const vizinhos=new Map(),arestas=new Map();
  for(let t=0;t<roupa.indices.length;t+=3) {
    const [a,b,c]=roupa.indices.slice(t,t+3);
    for(const [u,v]of[[a,b],[b,c],[c,a]]) {
      if(!vizinhos.has(u))vizinhos.set(u,new Set());if(!vizinhos.has(v))vizinhos.set(v,new Set());
      vizinhos.get(u).add(v);vizinhos.get(v).add(u);
      const chave=[u,v].sort((x,y)=>x-y).join(':');arestas.set(chave,(arestas.get(chave)||0)+1);
    }
  }
  assert.ok([...arestas.values()].every(v=>v===1||v===2),'Superfície de roupa não possui aresta não manifold');
  const vistos=new Set();let componentes=0;
  for(const v of vizinhos.keys())if(!vistos.has(v)) {
    componentes++;const fila=[v];vistos.add(v);
    while(fila.length)for(const proximo of vizinhos.get(fila.pop()))if(!vistos.has(proximo)){vistos.add(proximo);fila.push(proximo);}
  }
  assert.equal(componentes,2,'Roupa possui apenas duas superfícies: top e short inteiro');
  const fronteira=new Map();
  for(const [chave,quantidade]of arestas)if(quantidade===1) {
    const [a,b]=chave.split(':').map(Number);
    if(!fronteira.has(a))fronteira.set(a,new Set());if(!fronteira.has(b))fronteira.set(b,new Set());
    fronteira.get(a).add(b);fronteira.get(b).add(a);
  }
  assert.ok([...fronteira.values()].every(v=>v.size===2),'Cada borda é um contorno completo');
  const visitadas=new Set();let contornos=0;
  for(const v of fronteira.keys())if(!visitadas.has(v)) {
    contornos++;const fila=[v];visitadas.add(v);
    while(fila.length)for(const proximo of fronteira.get(fila.pop()))if(!visitadas.has(proximo)){visitadas.add(proximo);fila.push(proximo);}
  }
  assert.equal(contornos,5,'Top tem duas bordas; short apenas cintura e duas barras');
});

function documento(bytes) { return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8')); }
function bytesAccessor(bytes,doc,indice) {
  const a=doc.accessors[indice],v=doc.bufferViews[a.bufferView],componentes={SCALAR:1,VEC3:3,VEC4:4,MAT4:16};
  const tamanho={5123:2,5125:4,5126:4}[a.componentType]*componentes[a.type]*a.count;
  const inicio=20+bytes.readUInt32LE(12)+8+(v.byteOffset||0)+(a.byteOffset||0);
  return bytes.subarray(inicio,inicio+tamanho);
}

test('GLB preserva byte a byte os 31 clips e inverse bind do rig anterior', async () => {
  const [,,,,{ criarEstudoCorpo },{ criarEstudoMarcha },{ exportarGlb },{ validarGlb }]=await modulos;
  const origem=fontes(),base=criarEstudoMarcha(...origem,K),corpo=criarEstudoCorpo(...origem,K);
  assert.deepEqual(corpo.clips,base.clips);assert.deepEqual(corpo.ossos,base.ossos);
  const a=exportarGlb(base),b=exportarGlb(corpo),da=documento(a),db=validarGlb(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'pipoca',K);
  assert.equal(db.animations.length,31);assert.equal(db.skins[0].joints.length,20);assert.equal(db.extras.aprovadoFinal,false);
  assert.deepEqual(db.nodes,da.nodes,'Hierarquia e translações de repouso byteequivalentes');
  assert.deepEqual(bytesAccessor(b,db,db.skins[0].inverseBindMatrices),bytesAccessor(a,da,da.skins[0].inverseBindMatrices),'Matrizes inverse bind intactas');
  for(let i=0;i<31;i++) {
    const antiga=da.animations[i],nova=db.animations[i];
    assert.equal(nova.name,antiga.name);assert.deepEqual(nova.channels,antiga.channels);assert.deepEqual(nova.extras,antiga.extras);
    for(let s=0;s<antiga.samplers.length;s++)for(const campo of ['input','output'])assert.deepEqual(bytesAccessor(b,db,nova.samplers[s][campo]),bytesAccessor(a,da,antiga.samplers[s][campo]),`${nova.name} mantém ${campo}`);
  }
  assert.deepEqual(db.extras.marcha,da.extras.marcha,'Metadados da passada permanecem iguais');
});

function segmentoAtravessaTriangulo(a,b,tri) {
  const e1=subtrair(tri[1],tri[0]),e2=subtrair(tri[2],tri[0]),dir=subtrair(b,a);
  const p=cruzar(dir,e2),det=e1.reduce((s,v,i)=>s+v*p[i],0),eps=1e-8;
  if(Math.abs(det)<1e-10)return false;
  const inv=1/det,t=subtrair(a,tri[0]),u=t.reduce((s,v,i)=>s+v*p[i],0)*inv;
  if(u<=eps||u>=1-eps)return false;
  const q=cruzar(t,e1),v=dir.reduce((s,v,i)=>s+v*q[i],0)*inv;
  if(v<=eps||u+v>=1-eps)return false;
  const distancia=e2.reduce((s,v,i)=>s+v*q[i],0)*inv;
  return distancia>eps&&distancia<1-eps;
}

test('short não apresenta faces atravessadas nos ciclos e movimentos revisados', async () => {
  const [,,,,{criarEstudoCorpo},,{exportarGlb}]=await modulos;
  const [{NullEngine},{Scene},{carregarModelo}]=await Promise.all([
    import('@babylonjs/core/Engines/nullEngine.js'),
    import('@babylonjs/core/scene.js'),
    import('../../../src/3d/modelo-glb.js'),
  ]);
  const dados=criarEstudoCorpo(...fontes(),K),bytes=exportarGlb(dados),engine=new NullEngine(),scene=new Scene(engine);
  let modelo;
  try {
    modelo=await carregarModelo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K,scene);
    const roupa=scene.meshes.find(m=>m.material?.name==='pipoca_tecido_indigo');
    const indices=roupa.getIndices(),triangulos=Array.from({length:indices.length/3},(_,i)=>Array.from(indices.slice(i*3,i*3+3)));
    const primeiro=triangulos.length-dados.extras.corpo.superficies.find(s=>s.nome==='short-continuo').triangulos;
    for(const [clip,duracao,passo]of[['andando',12,.125],['parado',104,.5],['p1',12,.5],['p2',18,.5],['defesa',60,1],['dano',12,.5]]) {
    const grupo=scene.animationGroups.find(g=>g.name===clip);
    grupo.start(false);grupo.pause();
    const fps=grupo.targetedAnimations[0].animation.framePerSecond;
    for(let q=0;q<=duracao;q+=passo) {
      grupo.goToFrame(q*fps/60);roupa.computeWorldMatrix(true);roupa.skeleton.prepare(true);
      const p=roupa.getPositionData(true,false);
      const vertices=triangulos.map(tri=>tri.map(i=>Array.from(p.slice(i*3,i*3+3))));
      const limites=vertices.map(v=>[...Array.from({length:3},(_,k)=>Math.min(...v.map(p=>p[k]))),...Array.from({length:3},(_,k)=>Math.max(...v.map(p=>p[k])))]);
      for(let i=primeiro;i<triangulos.length;i++)for(let j=i+1;j<triangulos.length;j++) {
        const li=limites[i],lj=limites[j];
        if(li[3]<lj[0]||lj[3]<li[0]||li[4]<lj[1]||lj[4]<li[1]||li[5]<lj[2]||lj[5]<li[2])continue;
        if(triangulos[i].some(v=>triangulos[j].includes(v)))continue;
        const a=vertices[i],b=vertices[j];
        let cruza=false;
        for(let s=0;s<3;s++)cruza ||= segmentoAtravessaTriangulo(a[s],a[(s+1)%3],b)||segmentoAtravessaTriangulo(b[s],b[(s+1)%3],a);
        assert.equal(cruza,false,`Triângulo ${i} cruza triângulo ${j} no clip ${clip}, quadro ${q}`);
      }
    }
    grupo.stop();
    }
  } finally {modelo?.descartar();scene.dispose();engine.dispose();}
});
