import {deflateSync} from 'node:zlib';

const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const d=Math.hypot(...v);return d>1e-12?v.map(x=>x/d):[0,1,0];};
const ponto=(p,v)=>p.posicoes.slice(v*3,v*3+3);

function componentes(p) {
  const vizinhos=new Map();
  for(let t=0;t<p.indices.length;t+=3)for(const [a,b]of [[p.indices[t],p.indices[t+1]],[p.indices[t+1],p.indices[t+2]],[p.indices[t+2],p.indices[t]]]) {
    if(!vizinhos.has(a))vizinhos.set(a,new Set());if(!vizinhos.has(b))vizinhos.set(b,new Set());
    vizinhos.get(a).add(b);vizinhos.get(b).add(a);
  }
  const vistos=new Set(),partes=[];
  for(const v of vizinhos.keys())if(!vistos.has(v)) {
    const vertices=[],fila=[v];vistos.add(v);
    while(fila.length) {
      const i=fila.pop();vertices.push(i);
      for(const j of vizinhos.get(i))if(!vistos.has(j)){vistos.add(j);fila.push(j);}
    }
    partes.push(vertices);
  }
  return partes;
}

function eixoPrincipal(p,vertices,centro) {
  const cov=Array.from({length:3},()=>[0,0,0]);
  for(const v of vertices) {
    const q=sub(ponto(p,v),centro);
    for(let k=0;k<3;k++)for(let l=0;l<3;l++)cov[k][l]+=q[k]*q[l];
  }
  let eixo=unit([.37,1,.29]);
  for(let i=0;i<24;i++)eixo=unit(cov.map(linha=>dot(linha,eixo)));
  const dominante=eixo.map(Math.abs).indexOf(Math.max(...eixo.map(Math.abs)));
  if(eixo[dominante]<0)eixo=eixo.map(x=>-x);return eixo;
}

function cartaComponente(p,vertices,ossos,periodo) {
  const pontos=vertices.map(v=>ponto(p,v)),min=[0,1,2].map(k=>Math.min(...pontos.map(q=>q[k]))),max=[0,1,2].map(k=>Math.max(...pontos.map(q=>q[k])));
  const centro=min.map((v,k)=>(v+max[k])/2),ext=min.map((v,k)=>max[k]-v),nomes=new Set();
  for(const v of vertices)for(let k=0;k<4;k++)if(p.pesos[v*4+k]>.01)nomes.add(ossos[p.juntas[v*4+k]].nome);
  const soCabeca=[...nomes].every(n=>n==='cabeca');
  // Escleras, reflexos e faixas estreitas mantêm normal neutra. A pelagem
  // não pode contaminar a leitura limpa do olho ou das bandagens.
  const esclera=soCabeca&&vertices.length<500&&min[1]>2.15&&max[1]<2.35&&max[0]>.10;
  const faixaFina=ext[1]<.026&&Math.max(ext[0],ext[2])>.10&&max[1]<.30;
  if(esclera||faixaFina)return {tipo:'neutra',uv:()=>[.5/1024,.5/1024],voltas:0};
  const cabeca=soCabeca&&vertices.length>=500&&min[1]>1.96&&max[1]<2.49;
  const eixo=cabeca?[1,0,0]:eixoPrincipal(p,vertices,centro),referencia=Math.abs(eixo[0])<.85?[1,0,0]:[0,0,1];
  const u=unit(referencia.map((x,k)=>x-dot(referencia,eixo)*eixo[k])),v=cross(eixo,u);
  const raio=Math.max(...pontos.map(q=>{const d=sub(q,centro);return Math.hypot(dot(d,u),dot(d,v));}));
  const voltas=Math.max(1,Math.round(Math.PI*2*raio/periodo));
  return {tipo:cabeca?'radial-cabeca':'longitudinal-membro',voltas,uv:vertice=> {
    const d=sub(ponto(p,vertice),centro),a=dot(d,u),b=dot(d,v),longitudinal=dot(d,eixo),r=Math.hypot(a,b);
    const angular=Math.atan2(b,a)/(Math.PI*2)+.5;
    const comprimento=cabeca?Math.atan2(r,longitudinal)*raio/periodo:longitudinal/periodo;
    return [angular,comprimento,r<1e-7];
  }};
}

function criarUVs(p,ossos,periodo,resolucao) {
  const nova={...p,posicoes:[...p.posicoes],normais:[...p.normais],juntas:[...p.juntas],pesos:[...p.pesos],indices:[],uvs:Array(p.posicoes.length/3*2).fill(0)};
  const cartas=new Map(),tipos=new Map(),baseUV=new Map();
  for(const vertices of componentes(p)) {
    const carta=cartaComponente(p,vertices,ossos,periodo);tipos.set(carta.tipo,(tipos.get(carta.tipo)||0)+1);
    for(const v of vertices) {
      cartas.set(v,carta);const uv=carta.tipo==='neutra'?[.5/resolucao,.5/resolucao,false]:carta.uv(v);baseUV.set(v,uv);
      nova.uvs.splice(v*2,2,carta.tipo==='neutra'?uv[0]:uv[0]*carta.voltas,uv[1]);
    }
  }
  const duplicados=new Map();let polos=0;
  function copiar(v,u) {
    const chave=`${v}:${u}`;if(duplicados.has(chave))return duplicados.get(chave);
    const i=nova.posicoes.length/3;
    nova.posicoes.push(...p.posicoes.slice(v*3,v*3+3));nova.normais.push(...p.normais.slice(v*3,v*3+3));
    nova.juntas.push(...p.juntas.slice(v*4,v*4+4));nova.pesos.push(...p.pesos.slice(v*4,v*4+4));
    nova.uvs.push(u*cartas.get(v).voltas,baseUV.get(v)[1]);duplicados.set(chave,i);return i;
  }
  for(let t=0;t<p.indices.length;t+=3) {
    const tri=p.indices.slice(t,t+3),carta=cartas.get(tri[0]);
    if(carta.tipo==='neutra'){nova.indices.push(...tri);continue;}
    const uv=tri.map(v=>baseUV.get(v)),angulos=uv.filter(p=>!p[2]).map(p=>p[0]);
    const costura=angulos.length&&Math.max(...angulos)-Math.min(...angulos)>.5;
    const ajustados=uv.map(p=>costura&&p[0]<.5?p[0]+1:p[0]);
    for(let k=0;k<3;k++) {
      if(uv[k][2]) {
        const vizinhos=ajustados.filter((_,i)=>i!==k),u=(vizinhos[0]+vizinhos[1])/2;polos++;nova.indices.push(copiar(tri[k],u));
      } else nova.indices.push(ajustados[k]===uv[k][0]?tri[k]:copiar(tri[k],ajustados[k]));
    }
  }
  return {primitiva:nova,duplicados:duplicados.size,polos,componentes:Object.fromEntries(tipos)};
}

const suave=t=>t*t*(3-2*t);
function hash(x,y) {
  let h=Math.imul(x^0x6a09e667,0x45d9f3b)^Math.imul(y^0x3c6ef372,0x119de1f3);h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)/4294967295;
}
function ruido(x,y,nx,ny,tamanho) {
  const a=x/tamanho*nx,b=y/tamanho*ny,ix=Math.floor(a),iy=Math.floor(b),fx=suave(a-ix),fy=suave(b-iy);
  const ler=(i,j)=>hash((i+nx)%nx,(j+ny)%ny);
  const linha0=ler(ix,iy)*(1-fx)+ler(ix+1,iy)*fx,linha1=ler(ix,iy+1)*(1-fx)+ler(ix+1,iy+1)*fx;
  return linha0*(1-fy)+linha1*fy;
}
function crc32(bytes) {
  let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;
}
function chunk(tipo,dados) {
  const b=Buffer.alloc(dados.length+12);b.writeUInt32BE(dados.length);b.write(tipo,4,4,'ascii');dados.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,b.length-4)),b.length-4);return b;
}
export function criarNormalPelagem(resolucao=512) {
  if(![256,512,1024].includes(resolucao))throw new Error('Pelagem: resolução deve ser 256, 512 ou 1024.');
  // Gerar no mesmo domínio de 1024 mantém a escala e a intensidade físicas
  // quando a versão de 512 incorpora a média vetorial de quatro texels.
  const dominio=1024,fator=dominio/resolucao,alturas=new Float32Array(dominio*dominio);
  for(let y=0;y<dominio;y++)for(let x=0;x<dominio;x++) {
    const deriva=(ruido(x,y,8,8,dominio)-.5)*dominio/128;
    const xx=(x+deriva+dominio)%dominio;
    alturas[y*dominio+x]=.55*ruido(xx,y,256,32,dominio)+.30*ruido(xx,y,128,16,dominio)+.15*ruido(x,y,256,256,dominio);
  }
  const dados=Buffer.alloc(resolucao*(1+resolucao*4));
  const amostra=(x,y)=>alturas[((y+dominio)%dominio)*dominio+(x+dominio)%dominio];
  for(let y=0;y<resolucao;y++)for(let x=0;x<resolucao;x++) {
    const soma=[0,0,0];
    for(let j=0;j<fator;j++)for(let i=0;i<fator;i++) {
      const xx=x*fator+i,yy=y*fator+j,dx=(amostra(xx+1,yy)-amostra(xx-1,yy))*.90,dy=(amostra(xx,yy+1)-amostra(xx,yy-1))*.90;
      const n=unit([-dx,-dy,1]);for(let k=0;k<3;k++)soma[k]+=n[k];
    }
    const n=unit(soma),offset=y*(1+resolucao*4)+1+x*4;
    for(let k=0;k<3;k++)dados[offset+k]=Math.round((n[k]*.5+.5)*255);
    dados[offset+3]=255;
  }
  // Um texel neutro para as escleras; UV constante não gera derivadas nem mip.
  const offset=1;dados[offset]=dados[offset+1]=128;dados[offset+2]=255;
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(resolucao);ihdr.writeUInt32BE(resolucao,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(dados)),chunk('IEND',Buffer.alloc(0))]);
}

// Opcional: aplicar DEPOIS do figurino. As costuras UV duplicam apenas dados
// idênticos; a posição e os pesos de cada triângulo permanecem exatos.
export function aplicarPelagemPipoca(dados,{resolucao=512,intensidade=1,periodoMetros=.32}={}) {
  if(dados.extras?.pelagemProcedural) return dados;
  if(!Number.isFinite(intensidade)||intensidade<0||intensidade>1||!Number.isFinite(periodoMetros)||periodoMetros<.08||periodoMetros>.40)throw new Error('Pelagem: intensidade ou escala inválida.');
  if(dados.materiais?.length!==6||!Array.isArray(dados.ossos))throw new Error('Pelagem: exige os seis materiais e o rig da Pipoca.');
  const pele=dados.primitivas.find(p=>p.material===0);
  if(!pele||dados.materiais[0].normalTexture)throw new Error('Pelagem: pele ausente ou normal map já definido.');
  const uv=criarUVs(pele,dados.ossos,periodoMetros,resolucao),materiais=structuredClone(dados.materiais);
  const imagens=[...(dados.imagens||[])],texturas=[...(dados.texturas||[])],samplers=[...(dados.samplers||[])];
  materiais[0].normalTexture={index:texturas.length,scale:intensidade};
  texturas.push({source:imagens.length,sampler:samplers.length});
  samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497});
  imagens.push({name:'pipoca_microrelevo_pelagem_prova_v1',mimeType:'image/png',dados:criarNormalPelagem(resolucao)});
  return {...dados,primitivas:dados.primitivas.map(p=>p===pele?uv.primitiva:p),materiais,imagens,texturas,samplers,
    extras:{...dados.extras,aprovadoFinal:false,pelagemProcedural:{versao:1,status:'prova-opcional-nao-aprovada',resolucao,intensidade,periodoMetros,
      verticesCostura:uv.duplicados,polos:uv.polos,componentes:uv.componentes,geometriaTriangularPreservada:true,
      limites:['Microrelevo de superfície; não substitui pelagem da referência nem altera a silhueta.','Prova visual opcional, pendente de comparação no renderizador real.']}}};
}
