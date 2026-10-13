import {unirPrimitivas} from './pele-fluida.mjs';
import {deflateSync} from 'node:zlib';

const ponto=(p,i)=>p.posicoes.slice(i*3,i*3+3);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalizar=v=>{const t=Math.hypot(...v);if(t<1e-12)throw new Error('Normal nula no figurino.');return v.map(x=>x/t);};
const vazia=material=>({posicoes:[],normais:[],indices:[],juntas:[],pesos:[],material});
const clonar=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,Array.isArray(v)?[...v]:v]));

function componentes(p) {
  const vizinhos=new Map();
  for(let t=0;t<p.indices.length;t+=3)for(const [a,b]of[[p.indices[t],p.indices[t+1]],[p.indices[t+1],p.indices[t+2]],[p.indices[t+2],p.indices[t]]]) {
    if(!vizinhos.has(a))vizinhos.set(a,new Set());if(!vizinhos.has(b))vizinhos.set(b,new Set());
    vizinhos.get(a).add(b);vizinhos.get(b).add(a);
  }
  const vistos=new Set(),partes=[];
  for(const v of vizinhos.keys())if(!vistos.has(v)) {
    const parte=new Set([v]),fila=[v];vistos.add(v);
    while(fila.length)for(const n of vizinhos.get(fila.pop()))if(!vistos.has(n)){vistos.add(n);parte.add(n);fila.push(n);}
    partes.push(parte);
  }
  return partes;
}

function normais(p,selecionados=null) {
  const vertices=selecionados??new Set(p.indices),soma=new Map([...vertices].map(v=>[v,[0,0,0]]));
  for(let t=0;t<p.indices.length;t+=3) {
    const [a,b,c]=p.indices.slice(t,t+3),n=cross(sub(ponto(p,b),ponto(p,a)),sub(ponto(p,c),ponto(p,a)));
    if(Math.hypot(...n)<1e-12)throw new Error('Triângulo degenerado no figurino.');
    for(const v of [a,b,c])if(soma.has(v))for(let k=0;k<3;k++)soma.get(v)[k]+=n[k];
  }
  for(const [v,n]of soma)p.normais.splice(v*3,3,...normalizar(n));
}

function inserir(p,amostra,deslocamento=0) {
  const v=p.posicoes.length/3;
  p.posicoes.push(...amostra.posicao.map((x,k)=>x+deslocamento*amostra.normal[k]));
  p.normais.push(...amostra.normal);p.juntas.push(...amostra.juntas);p.pesos.push(...amostra.pesos);
  return v;
}

// Interseção com a malha em repouso, incluindo os pesos baricêntricos reais.
function projetor(primitiva,triangulos,eixo,sinal=1) {
  const outros=[0,1,2].filter(k=>k!==eixo);
  return (u,v)=> {
    let melhor=null;
    for(const tri of triangulos) {
      const [a,b,c]=tri.map(i=>ponto(primitiva,i)),[k,l]=outros;
      const det=(b[k]-a[k])*(c[l]-a[l])-(c[k]-a[k])*(b[l]-a[l]);
      if(Math.abs(det)<1e-12)continue;
      const beta=((u-a[k])*(c[l]-a[l])-(c[k]-a[k])*(v-a[l]))/det;
      const gama=((b[k]-a[k])*(v-a[l])-(u-a[k])*(b[l]-a[l]))/det;
      if(beta< -1e-7||gama< -1e-7||beta+gama>1+1e-7)continue;
      const w=[1-beta-gama,beta,gama],posicao=[0,1,2].map(k=>tri.reduce((s,i,j)=>s+w[j]*primitiva.posicoes[i*3+k],0));
      if(melhor&&sinal*posicao[eixo]<=sinal*melhor.posicao[eixo])continue;
      const normal=normalizar([0,1,2].map(k=>tri.reduce((s,i,j)=>s+w[j]*primitiva.normais[i*3+k],0))),influencias=new Map();
      for(let j=0;j<3;j++)for(let o=0;o<4;o++) {
        const peso=w[j]*primitiva.pesos[tri[j]*4+o],osso=primitiva.juntas[tri[j]*4+o];
        if(peso>1e-10)influencias.set(osso,(influencias.get(osso)||0)+peso);
      }
      const lista=[...influencias].sort((a,b)=>b[1]-a[1]);
      if(lista.length>4)throw new Error('A projeção do figurino excede quatro influências.');
      const soma=lista.reduce((s,p)=>s+p[1],0),juntas=lista.map(p=>p[0]),pesos=lista.map(p=>p[1]/soma);
      while(juntas.length<4){juntas.push(0);pesos.push(0);}
      melhor={posicao,normal,juntas,pesos,triangulo:tri,baricentricas:w};
    }
    if(!melhor)throw new Error(`Figurino sem superfície de apoio no eixo ${eixo}: ${u}, ${v}`);
    return melhor;
  };
}

function triangulosDaParte(p,parte) {
  const lista=[];for(let t=0;t<p.indices.length;t+=3)if(parte.has(p.indices[t]))lista.push(p.indices.slice(t,t+3));return lista;
}

function adicionarAlcas(roupa,pele,top) {
  const primeiroVertice=roupa.posicoes.length/3,primeiroTriangulo=roupa.indices.length/3;
  const superior=[...top].filter(v=>roupa.posicoes[v*3+1]>1.80);
  if(superior.length!==24)throw new Error('O top precisa do anel superior validado de 24 vértices.');
  // A ordenação geométrica evita depender dos offsets do short, que evolui à parte.
  const centro=superior.reduce((s,v)=>s.map((x,k)=>x+roupa.posicoes[v*3+k]/24),[0,0,0]);
  superior.sort((a,b)=> {
    const ang=v=>{const a=(Math.atan2(-(roupa.posicoes[v*3+2]-centro[2])/.291,(roupa.posicoes[v*3]-centro[0])/.188)+2*Math.PI)%(2*Math.PI);return a>2*Math.PI-1e-6?0:a;};
    return ang(a)-ang(b);
  });
  const peleTri=[];
  for(let t=0;t<pele.indices.length;t+=3) {
    const tri=pele.indices.slice(t,t+3),ys=tri.map(v=>pele.posicoes[v*3+1]);
    if(Math.max(...ys)<=1.961&&Math.min(...ys)>=1.69)peleTri.push(tri);
  }
  const ombro=projetor(pele,peleTri,1,1),adicionados=[];
  for(const [a,b,c,d]of[[2,3,10,9],[21,22,15,14]]) {
    const frente=[superior[a],superior[b]],costas=[superior[c],superior[d]],inicio=roupa.posicoes.length/3;
    let anterior=frente;
    for(let linha=1;linha<=12;linha++) {
      let atual;
      if(linha===12)atual=costas;
      else {
        const t=linha/12;atual=[];
        for(let lado=0;lado<2;lado++) {
          const f=ponto(roupa,frente[lado]),c=ponto(roupa,costas[lado]);
          const x=f[0]+(c[0]-f[0])*t,z=(f[2]+(c[2]-f[2])*t)*(1-.045*Math.sin(Math.PI*t));
          const apoio=ombro(x,z),amostra={...apoio,posicao:[x,apoio.posicao[1]+.010,z]};
          atual.push(inserir(roupa,amostra));
        }
      }
      roupa.indices.push(anterior[0],anterior[1],atual[0],anterior[1],atual[1],atual[0]);
      anterior=atual;
    }
    for(let v=inicio;v<roupa.posicoes.length/3;v++){top.add(v);adicionados.push(v);}
  }
  normais(roupa,top);
  return {primeiroVertice,primeiroTriangulo,vertices:adicionados.length,triangulos:48,ligacao:'Duas arestas por alça compartilham vértices do anel superior do top.',
    ajuste:'Alças projetadas sobre a malha real dos ombros; afastamento vertical de 10 mm e pesos interpolados da pele.'};
}

function extrair(p,triangulos,deslocamento,material=0) {
  const nova=vazia(material),mapa=new Map();
  for(const tri of triangulos)for(const v of tri) {
    if(!mapa.has(v))mapa.set(v,inserir(nova,{posicao:ponto(p,v),normal:p.normais.slice(v*3,v*3+3),juntas:p.juntas.slice(v*4,v*4+4),pesos:p.pesos.slice(v*4,v*4+4)},deslocamento));
    nova.indices.push(mapa.get(v));
  }
  return nova;
}

function removerFaixaAntiga(pele,ossos) {
  const removidos=new Set();
  for(const parte of componentes(pele)) {
    const ys=[...parte].map(v=>pele.posicoes[v*3+1]);
    if(Math.min(...ys)>1.10&&Math.max(...ys)<1.17&&[...parte].every(v=>pele.juntas.slice(v*4,v*4+4).every((j,k)=>pele.pesos[v*4+k]<1e-8||/^(quadril|tronco)$/.test(ossos[j].nome))))for(const v of parte)removidos.add(v);
  }
  return extrair(pele,triangulosDaParte(pele,new Set(pele.indices.filter(v=>!removidos.has(v)))),0,0);
}

function fivela(projetar) {
  const p=vazia(4),centroY=1.138,largura=.053,altura=.034,borda=.0035;
  for(const [y0,y1,z0,z1]of[
    [centroY-altura/2,centroY-altura/2+borda,-largura/2,largura/2],
    [centroY+altura/2-borda,centroY+altura/2,-largura/2,largura/2],
    [centroY-altura/2+borda,centroY+altura/2-borda,-largura/2,-largura/2+borda],
    [centroY-altura/2+borda,centroY+altura/2-borda,largura/2-borda,largura/2],
  ]) {
    const vertices=[[y0,z0],[y1,z0],[y1,z1],[y0,z1]].map(([y,z])=>inserir(p,projetar(y,z),.005));
    p.indices.push(vertices[0],vertices[1],vertices[2],vertices[0],vertices[2],vertices[3]);
  }
  return p;
}

function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(tipo,dados) {
  const nome=Buffer.from(tipo,'ascii'),inicio=Buffer.alloc(4),fim=Buffer.alloc(4);
  inicio.writeUInt32BE(dados.length);fim.writeUInt32BE(crc32(Buffer.concat([nome,dados])));
  return Buffer.concat([inicio,nome,dados,fim]);
}
function texturaFigurino(materiais,tamanho=512) {
  const srgb=v=>Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));
  const indigo=materiais[1].pbrMetallicRoughness.baseColorFactor.slice(0,3).map(srgb);
  const creme=materiais[0].pbrMetallicRoughness.baseColorFactor.slice(0,3).map(srgb);
  const dados=Buffer.alloc(tamanho*(1+tamanho*4)),limiteFaixa=(1.18-1.115)/.43;
  for(let y=0;y<tamanho;y++)for(let x=0;x<tamanho;x++) {
    const u=(x+.5)/tamanho,v=(y+.5)/tamanho;
    const linha=Math.max(...[.365,.405].map(centro=>Math.max(0,Math.min(1,(.014-Math.abs(u-centro))*tamanho+.5))));
    const faixa=Math.max(0,Math.min(1,(limiteFaixa-v)*tamanho+.5));
    // A faixa elástica tem leitura própria sobre o pelo creme: tom quase
    // branco, nervuras pequenas e duas linhas de costura, tudo na estampa.
    const nervura=.97+.03*(.5+.5*Math.cos(u*Math.PI*2*96));
    const sombreado=1-.09*Math.min(1,(v/limiteFaixa)**2);
    const costura=1-.045*Math.exp(-(((v-.045)/.0026)**2))-.055*Math.exp(-(((v-.126)/.0026)**2));
    const offset=y*(1+tamanho*4)+1+x*4;
    for(let k=0;k<3;k++) {
      const listra=indigo[k]+(creme[k]-indigo[k])*linha;
      const elastico=Math.min(255,creme[k]+[5,9,15][k])*nervura*sombreado*costura;
      dados[offset+k]=Math.round(listra+(elastico-listra)*faixa);
    }
    dados[offset+3]=255;
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(tamanho,0);ihdr.writeUInt32BE(tamanho,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(dados)),chunk('IEND',Buffer.alloc(0))]);
}

export function refinarFigurino(dados,ossos) {
  if(dados.extras?.figurino?.versao===2)return dados;
  if(dados.extras?.figurino)throw new Error('Recrie a malha visual antes de substituir um figurino anterior.');
  const roupaOrigem=dados.primitivas.find(p=>p.material===1),peleOrigem=dados.primitivas.find(p=>p.material===0);
  if(!roupaOrigem||!peleOrigem)throw new Error('Pele e tecido necessários ao figurino da Pipoca.');
  const roupa=clonar(roupaOrigem),grupos=componentes(roupa).sort((a,b)=> {
    const media=g=>[...g].reduce((s,v)=>s+roupa.posicoes[v*3+1],0)/g.size;return media(a)-media(b);
  });
  if(grupos.length!==2)throw new Error('O figurino exige um componente de top e outro de short.');
  const [short,top]=grupos,triShort=triangulosDaParte(roupa,short),alcas=adicionarAlcas(roupa,peleOrigem,top);
  const acabamentos=[fivela(projetor(roupa,triShort,0,1))],nomes=['fivela'];
  const pele=removerFaixaAntiga(peleOrigem,ossos),offsets=new Map([[0,[pele.posicoes.length/3,pele.indices.length/3]],[4,[dados.primitivas.find(p=>p.material===4).posicoes.length/3,dados.primitivas.find(p=>p.material===4).indices.length/3]]]);
  const partes=acabamentos.map((p,i)=> {
    const offset=offsets.get(p.material),parte={nome:nomes[i],material:p.material,primeiroVertice:offset[0],primeiroTriangulo:offset[1],vertices:p.posicoes.length/3,triangulos:p.indices.length/3};
    offset[0]+=parte.vertices;offset[1]+=parte.triangulos;return parte;
  });
  const primitivas=unirPrimitivas([
    ...dados.primitivas.filter(p=>p!==peleOrigem&&p!==roupaOrigem),pele,roupa,...acabamentos,
  ]);
  const tecido=primitivas.find(p=>p.material===1);tecido.uvs=[];
  for(let v=0;v<tecido.posicoes.length/3;v++) {
    if(top.has(v)){tecido.uvs.push(.9,.9);continue;}
    const [x,y,z]=ponto(tecido,v);
    // Ângulo espelhado contínuo: ambas as laterais compartilham a estampa e
    // frente/costas não precisam de costura nem de vértices duplicados.
    tecido.uvs.push(Math.atan2(Math.abs(z)/.33,(x+.01)/.22)/Math.PI,(1.18-y)/.43);
  }
  const materiais=structuredClone(dados.materiais),imagem=(dados.imagens||[]).length,textura=(dados.texturas||[]).length,sampler=(dados.samplers||[]).length;
  materiais[1].pbrMetallicRoughness.baseColorFactor=[1,1,1,1];materiais[1].pbrMetallicRoughness.baseColorTexture={index:textura};
  const imagens=[...(dados.imagens||[]),{name:'pipoca_indigo_faixas_v2',mimeType:'image/png',dados:texturaFigurino(dados.materiais)}];
  const texturas=[...(dados.texturas||[]),{source:imagem,sampler}],samplers=[...(dados.samplers||[]),{magFilter:9729,minFilter:9729,wrapS:33071,wrapT:33071}];
  return {...dados,primitivas,materiais,imagens,texturas,samplers,extras:{...dados.extras,aprovadoFinal:false,
    figurino:{versao:2,referencia:'art/premium/modelos-3d/referencias/pipoca-referencia-v1.png',
      alcas,partes,faixa:{alturaMetros:.045,tecnica:'Estampa no próprio tecido; nenhuma camada geométrica sobre a cintura.'},
      listras:{quantidade:4,larguraAngular:.028,tecnica:'Duas faixas por lateral em textura PNG autocontida sobre a triangulação original.'},
      textura:{largura:512,altura:512,mimeType:'image/png',uv:'Ângulo espelhado dos quadris e altura em repouso; sem costura ou duplicação de vértices.',faixaElastica:'Nervuras e duas linhas de costura discretas na estampa.'},
      fivela:{material:4,larguraMetros:.053,alturaMetros:.034},
      tecidoComponentes:2,rigPreservado:true,rostoPreservado:true,
      limites:['Alças e acabamentos ainda sem costura ou trama texturizada.','Revisão artística final e poses restantes continuam pendentes.']}}};
}
