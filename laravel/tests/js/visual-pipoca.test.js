const {test}=require('node:test');
const assert=require('node:assert/strict');
const modulos=Promise.all([
  import('../../../src/producao3d/pipoca-visual-v3.mjs'),
  import('../../../src/producao3d/pipoca-corpo-v2.mjs'),
  import('../../../src/producao3d/rig.mjs'),
]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function assinatura(p,tri) {
  return JSON.stringify([p.material,...tri.flatMap(v=>[
    ...p.posicoes.slice(v*3,v*3+3),...p.normais.slice(v*3,v*3+3),
    ...p.juntas.slice(v*4,v*4+4),...p.pesos.slice(v*4,v*4+4),
  ])]);
}
function componente(p,inicio) {
  const incidentes=new Map();
  for(let t=0;t<p.indices.length;t+=3)for(const v of p.indices.slice(t,t+3)) {
    if(!incidentes.has(v))incidentes.set(v,[]);incidentes.get(v).push(t/3);
  }
  const vistos=new Set([inicio]),fila=[inicio],triangulos=new Set();
  while(fila.length)for(const t of incidentes.get(fila.pop())||[]) {
    triangulos.add(t);
    for(const v of p.indices.slice(t*3,t*3+3))if(!vistos.has(v)){vistos.add(v);fila.push(v);}
  }
  return {vertices:vistos,triangulos:[...triangulos].map(t=>p.indices.slice(t*3,t*3+3))};
}

test('rosto preserva rig, materiais e todos os triângulos fora da cabeça, mandíbula e orelhas',async()=> {
  const [{criarPipocaVisualV3},{criarPipocaCorpoV2},{criarRig}]=await modulos;
  const ossos=criarRig(),antes=structuredClone(ossos),base=criarPipocaCorpoV2(ossos),visual=criarPipocaVisualV3(ossos);
  assert.deepEqual(ossos,antes,'Pivôs e hierarquia permanecem intactos');
  assert.deepEqual(visual.materiais,base.materiais);assert.equal(visual.materiais.length,6);
  assert.equal(visual.extras.aprovadoFinal,false);assert.equal(visual.extras.rosto.versao,3);
  assert.deepEqual(visual.extras.corpo,base.extras.corpo,'O estudo do corpo não é refeito pelo rosto');
  const face=new Set(ossos.map((o,i)=>/^(cabeca|mandibula|orelha_E|orelha_D)$/.test(o.nome)?i:-1)),esperados=new Map();
  for(const p of base.primitivas)for(let t=0;t<p.indices.length;t+=3) {
    const tri=p.indices.slice(t,t+3);
    if(tri.some(v=>p.pesos.slice(v*4,v*4+4).some((peso,k)=>peso>1e-8&&!face.has(p.juntas[v*4+k])))) {
      const chave=assinatura(p,tri);esperados.set(chave,(esperados.get(chave)||0)+1);
    }
  }
  assert.ok(esperados.size>5000,'Confere corpo, roupas, articulações e acessórios reais');
  for(const p of visual.primitivas)for(let t=0;t<p.indices.length;t+=3) {
    const chave=assinatura(p,p.indices.slice(t,t+3));if(esperados.has(chave))esperados.set(chave,esperados.get(chave)-1);
  }
  assert.ok([...esperados.values()].every(v=>v===0),'Coordenadas, normais, pesos e winding externos preservados');
});

test('crânio, bochechas e focinho formam uma única superfície fechada com normais externas',async()=> {
  const [{criarPipocaVisualV3},,{criarRig}]=await modulos;
  const visual=criarPipocaVisualV3(criarRig()),p=visual.primitivas.find(p=>p.material===0);
  let topo=-1;
  for(let v=0;v<p.posicoes.length/3;v++)if(Math.hypot(...sub(p.posicoes.slice(v*3,v*3+3),[-.035,2.458,0]))<1e-9)topo=v;
  assert.ok(topo>=0);const cabeca=componente(p,topo),arestas=new Map();
  assert.equal(cabeca.vertices.size,2738);assert.equal(cabeca.triangulos.length,5472);
  let volume=0;
  for(const tri of cabeca.triangulos) {
    const [a,b,c]=tri.map(v=>p.posicoes.slice(v*3,v*3+3)),n=cross(sub(b,a),sub(c,a));
    assert.ok(Math.hypot(...n)>1e-10);volume+=dot(a,cross(b,c))/6;
    for(const [u,v]of[[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]) {
      const chave=[u,v].sort((a,b)=>a-b).join(':');arestas.set(chave,(arestas.get(chave)||0)+1);
    }
    const media=tri.map(v=>p.normais.slice(v*3,v*3+3)).reduce((s,v)=>s.map((x,k)=>x+v[k]),[0,0,0]);
    assert.ok(dot(n,media)>0,'Normais acompanham o winding da superfície');
  }
  assert.ok(volume>.04&&volume<.15,'Superfície aponta para fora e mantém proporção do rig');
  assert.ok([...arestas.values()].every(v=>v===2),'Cabeça sem furos ou costuras soltas');
  const maxX=Math.max(...[...cabeca.vertices].map(v=>p.posicoes[v*3]));
  assert.ok(maxX<.32,'Focinho curto integrado, sem esferas salientes sobrepostas');
});

function frenteTriangulada(p,triangulos,y,z) {
  let x=-Infinity;
  for(const tri of triangulos) {
    const [a,b,c]=tri.map(v=>p.posicoes.slice(v*3,v*3+3));
    const det=(b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]);
    if(Math.abs(det)<1e-12)continue;
    const u=((y-a[1])*(c[2]-a[2])-(c[1]-a[1])*(z-a[2]))/det;
    const v=((b[1]-a[1])*(z-a[2])-(y-a[1])*(b[2]-a[2]))/det;
    if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)x=Math.max(x,a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]));
  }
  return x;
}

test('íris ficam junto à face em vez de formar globos protuberantes',async()=> {
  const [{criarPipocaVisualV3},,{criarRig}]=await modulos;
  const visual=criarPipocaVisualV3(criarRig()),pele=visual.primitivas.find(p=>p.material===0),iris=visual.primitivas.find(p=>p.material===5);
  const topo=pele.posicoes.findIndex((v,i)=>i%3===1&&Math.abs(v-2.458)<1e-10);
  const cabeca=componente(pele,(topo-1)/3);
  let minimo=Infinity,maximo=-Infinity;
  for(let i=0;i<iris.posicoes.length;i+=3) {
    const [x,y,z]=iris.posicoes.slice(i,i+3),skin=frenteTriangulada(pele,cabeca.triangulos,y,z);
    assert.ok(Number.isFinite(skin),'Íris permanece sobre a superfície do rosto');
    const profundidade=x-skin;minimo=Math.min(minimo,profundidade);maximo=Math.max(maximo,profundidade);
  }
  assert.ok(minimo>.001,`Íris não atravessa a face: ${minimo}`);
  assert.ok(maximo<.04,`Projeção limitada a menos de 4 cm: ${maximo}`);
});

test('orelhas são lâminas contínuas fechadas, afiladas e ligadas ao rig pela raiz',async()=> {
  const [{criarPipocaVisualV3},,{criarRig}]=await modulos;
  const ossos=criarRig(),visual=criarPipocaVisualV3(ossos),p=visual.primitivas.find(p=>p.material===0),rosa=visual.primitivas.find(p=>p.material===3);
  for(const [nome,sinal]of [['orelha_E',-1],['orelha_D',1]]) {
    const junta=ossos.findIndex(o=>o.nome===nome);
    let topo=-1;
    for(let v=0;v<p.posicoes.length/3;v++)if(Math.hypot(...sub(p.posicoes.slice(v*3,v*3+3),[-.008,3.218,sinal*.342]))<1e-9)topo=v;
    assert.ok(topo>=0);const orelha=componente(p,topo),arestas=new Map();
    assert.equal(orelha.vertices.size,1802,'Uma superfície suave substitui cápsula e esfera da base');
    assert.equal(orelha.triangulos.length,3600);
    let volume=0,raiz=0,lamina=0;
    for(const tri of orelha.triangulos) {
      const [a,b,c]=tri.map(v=>p.posicoes.slice(v*3,v*3+3)),n=cross(sub(b,a),sub(c,a));
      assert.ok(Math.hypot(...n)>1e-12);volume+=dot(a,cross(b,c))/6;
      const media=tri.flatMap(v=>[p.normais.slice(v*3,v*3+3)]).reduce((s,v)=>s.map((x,k)=>x+v[k]),[0,0,0]);
      assert.ok(dot(n,media)>0);
      for(const [u,v]of[[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]) {
        const chave=[u,v].sort((a,b)=>a-b).join(':');arestas.set(chave,(arestas.get(chave)||0)+1);
      }
    }
    assert.ok(volume>.005&&volume<.025,'Volume espesso orientado para fora');
    assert.ok([...arestas.values()].every(v=>v===2));
    for(const v of orelha.vertices) {
      const y=p.posicoes[v*3+1],w=p.pesos[v*4],head=p.pesos[v*4+1];
      assert.equal(p.juntas[v*4],junta);assert.equal(p.juntas[v*4+1],3);
      assert.ok(Math.abs(w+head-1)<1e-12);
      if(y<2.385){assert.equal(head,1);raiz++;}
      if(y>2.570){assert.equal(w,1);lamina++;}
    }
    assert.ok(raiz>30&&lamina>300,'A raiz acompanha a cabeça e a lâmina acompanha a própria orelha');
    const largura=y=> {
      const zs=[...orelha.vertices].filter(v=>Math.abs(p.posicoes[v*3+1]-y)<1e-8).map(v=>p.posicoes[v*3+2]);
      return Math.max(...zs)-Math.min(...zs);
    };
    const raizLargura=largura(2.425),laminaLargura=largura(2.845),pontaLargura=largura(3.195);
    assert.ok(laminaLargura>.24&&raizLargura<laminaLargura*.4&&pontaLargura<raizLargura*.4,
      'Raiz menor que 40% da lâmina e ponta menor que 40% da raiz');
    let amostras=0;
    for(let v=0;v<rosa.posicoes.length/3;v+=7)if(rosa.juntas[v*4]===junta) {
      const [x,y,z]=rosa.posicoes.slice(v*3,v*3+3),pele=frenteTriangulada(p,orelha.triangulos,y,z);
      assert.ok(Number.isFinite(pele),'Interior rosa contido na orelha');
      assert.ok(x-pele>.0001&&x-pele<.006,`Interior próximo e visível sem flutuação: ${x-pele}`);amostras++;
    }
    assert.ok(amostras>50);
  }
});

test('camadas âmbar, sobrancelhas e sorriso permanecem à frente de todas as superfícies creme',async()=> {
  const [{criarPipocaVisualV3},,{criarRig}]=await modulos;
  const visual=criarPipocaVisualV3(criarRig()),pele=visual.primitivas.find(p=>p.material===0);
  // Conferir toda a malha creme, inclusive a própria esclera. Uma distância
  // apenas ao crânio não identifica a oclusão entre camadas do olho.
  const triangulos=Array.from({length:pele.indices.length/3},(_,i)=>pele.indices.slice(i*3,i*3+3));
  const iris=visual.primitivas.find(p=>p.material===5),escuro=visual.primitivas.find(p=>p.material===4);
  const amostras=[];
  for(let v=0;v<iris.posicoes.length/3;v+=9) {
    const p=iris.posicoes.slice(v*3,v*3+3),reflexoY=2.274,reflexoZ=.126*Math.sign(p[2]);
    if(Math.abs(p[1]-reflexoY)<.015&&Math.abs(p[2]-reflexoZ)<.013)continue;
    amostras.push({p,nome:'íris'});
  }
  // A borda do olho chega a y=2.341 e encosta na esclera de propósito.
  // Identifique as fitas inteiras para não confundi-la com a sobrancelha.
  const visitados=new Set();let sobrancelhas=0,sorrisos=0;
  for(let v=0;v<escuro.posicoes.length/3;v++)if(!visitados.has(v)) {
    const parte=componente(escuro,v),ids=[...parte.vertices];for(const i of ids)visitados.add(i);
    if(ids.length!==50)continue;
    const ys=ids.map(i=>escuro.posicoes[i*3+1]),sobrancelha=Math.max(...ys)>2.35,sorriso=Math.max(...ys)<2.11;
    if(!sobrancelha&&!sorriso)continue;
    if(sobrancelha)sobrancelhas++;else sorrisos++;
    for(let i=0;i<ids.length;i+=3)amostras.push({p:escuro.posicoes.slice(ids[i]*3,ids[i]*3+3),nome:sobrancelha?'sobrancelha':'sorriso'});
  }
  assert.equal(sobrancelhas,2);assert.equal(sorrisos,3,'Duas metades do sorriso e filtro labial');
  assert.ok(amostras.length>80);
  for(const {p:[x,y,z],nome}of amostras) {
    const frente=frenteTriangulada(pele,triangulos,y,z);
    assert.ok(x-frente>.0005,`${nome} encoberto por superfície creme em y=${y}, z=${z}: margem ${x-frente}`);
  }
});

test('contornos dos olhos são aros abertos sem placas pretas sob as escleras',async()=> {
  const [{criarPipocaVisualV3},,{criarRig}]=await modulos;
  const visual=criarPipocaVisualV3(criarRig()),p=visual.primitivas.find(p=>p.material===4),visitados=new Set(),aros=[];
  for(let v=0;v<p.posicoes.length/3;v++)if(!visitados.has(v)) {
    const parte=componente(p,v);for(const i of parte.vertices)visitados.add(i);
    const ys=[...parte.vertices].map(i=>p.posicoes[i*3+1]);
    if(parte.vertices.size===108&&Math.min(...ys)>2.15&&Math.max(...ys)<2.35)aros.push(parte);
  }
  assert.equal(aros.length,2);
  for(const aro of aros) {
    assert.equal(aro.triangulos.length,144);
    const arestas=new Map();
    for(const tri of aro.triangulos) {
      const [a,b,c]=tri.map(v=>p.posicoes.slice(v*3,v*3+3));
      assert.ok(cross(sub(b,a),sub(c,a))[0]>0,'Aro frontal sem fitas invertidas');
      for(const [u,v]of[[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]) {
        const chave=[u,v].sort((a,b)=>a-b).join(':');arestas.set(chave,(arestas.get(chave)||0)+1);
      }
    }
    assert.equal([...arestas.values()].filter(v=>v===1).length,72,'36 arestas internas e 36 externas');
    const sinal=Math.sign([...aro.vertices].reduce((s,v)=>s+p.posicoes[v*3+2],0));
    for(const [y,z]of [[2.248,sinal*.143],[2.280,sinal*.143],[2.230,sinal*.115]]) {
      assert.equal(frenteTriangulada(p,aro.triangulos,y,z),-Infinity,'Centro da esclera fica livre de superfície preta');
    }
  }
});

test('todas as superfícies faciais têm área, pesos normalizados e normais finitas',async()=> {
  const [{criarPipocaVisualV3},,{criarRig}]=await modulos;
  const ossos=criarRig(),visual=criarPipocaVisualV3(ossos);
  for(const p of visual.primitivas) {
    assert.ok(p.posicoes.every(Number.isFinite));assert.ok(p.normais.every(Number.isFinite));
    for(let i=0;i<p.normais.length;i+=3)assert.ok(Math.abs(Math.hypot(...p.normais.slice(i,i+3))-1)<1e-8);
    for(let i=0;i<p.pesos.length;i+=4) {
      assert.ok(Math.abs(p.pesos.slice(i,i+4).reduce((s,v)=>s+v,0)-1)<1e-10);
      assert.ok(p.juntas.slice(i,i+4).every(v=>Number.isInteger(v)&&v>=0&&v<20));
    }
    for(let t=0;t<p.indices.length;t+=3) {
      const tri=p.indices.slice(t,t+3);
      const ativa=v=>p.juntas.slice(v*4,v*4+4).filter((_,k)=>p.pesos[v*4+k]>1e-8);
      if(!tri.every(v=>ativa(v).every(j=>/^(cabeca|mandibula|orelha_E|orelha_D)$/.test(ossos[j].nome))))continue;
      const [a,b,c]=tri.map(v=>p.posicoes.slice(v*3,v*3+3));
      assert.ok(Math.hypot(...cross(sub(b,a),sub(c,a)))>1e-12);
    }
  }
});
