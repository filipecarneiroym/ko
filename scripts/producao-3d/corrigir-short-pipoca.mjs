import { analisarCruzamentos } from './verificar-roupa-pipoca.mjs';
import { Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector.js';

const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const point=(p,i)=>Array.from(p.slice(i*3,i*3+3));
const unit=a=>mul(a,1/Math.max(1e-12,Math.hypot(...a)));
const qmul=([x,y,z,w],[a,b,c,d])=>[w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c];

export function peleDualQuaternion(posicoes,juntas,pesos,matrizes) {
  const transformacoes=Array.from({length:matrizes.length/16},(_,i)=>{
    const r=Quaternion.FromRotationMatrix(Matrix.FromArray(matrizes,i*16)).asArray();
    const t=Array.from(matrizes.slice(i*16+12,i*16+15));return {r,d:mul(qmul([...t,0],r),.5)};
  });
  const resultado=[];
  for(let v=0;v<posicoes.length/3;v++) {
    let r=[0,0,0,0],d=[0,0,0,0],referencia=null;
    for(let j=0;j<4;j++) {
      const w=pesos[v*4+j];if(!w)continue;const dq=transformacoes[juntas[v*4+j]];
      referencia||=dq.r;const sinal=dot(referencia,dq.r)<0?-1:1;
      r=add(r,mul(dq.r,w*sinal));d=add(d,mul(dq.d,w*sinal));
    }
    const norma=Math.hypot(...r);r=mul(r,1/norma);d=mul(d,1/norma);d=sub(d,mul(r,dot(r,d)));
    const conjugado=[-r[0],-r[1],-r[2],r[3]],p=qmul(qmul(r,[...point(posicoes,v),0]),conjugado);
    const t=mul(qmul(d,conjugado),2);resultado.push(...[0,1,2].map(k=>p[k]+t[k]));
  }
  return resultado;
}

export function componentesDaMalha(indices) {
  const grafo=new Map();
  for(let t=0;t<indices.length;t+=3)for(const [a,b]of[[indices[t],indices[t+1]],[indices[t+1],indices[t+2]],[indices[t+2],indices[t]]]) {
    if(!grafo.has(a))grafo.set(a,new Set());if(!grafo.has(b))grafo.set(b,new Set());
    grafo.get(a).add(b);grafo.get(b).add(a);
  }
  const vistos=new Set(),grupos=[];
  for(const vertice of grafo.keys())if(!vistos.has(vertice)) {
    const fila=[vertice],grupo=[];vistos.add(vertice);
    while(fila.length){const v=fila.pop();grupo.push(v);for(const n of grafo.get(v))if(!vistos.has(n)){vistos.add(n);fila.push(n);}}
    grupos.push(grupo);
  }
  return grupos;
}

function perto(p,a,b,c) {
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return a;
  const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
  if(d3>=0&&d4<=d3)return b;
  const vc=d1*d4-d3*d2;
  if(vc<=0&&d1>=0&&d3<=0)return add(a,mul(ab,d1/(d1-d3)));
  const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
  if(d6>=0&&d5<=d6)return c;
  const vb=d5*d2-d1*d6;
  if(vb<=0&&d2>=0&&d6<=0)return add(a,mul(ac,d2/(d2-d6)));
  const va=d3*d6-d5*d4;
  if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return add(b,mul(sub(c,b),(d4-d3)/((d4-d3)+(d5-d6))));
  const inv=1/(va+vb+vc);return add(a,add(mul(ab,vb*inv),mul(ac,vc*inv)));
}

const DIRECAO=unit([1,.193,.127]);
function raio(p,tri,direcao=DIRECAO) {
  const [a,b,c]=tri,e1=sub(b,a),e2=sub(c,a),h=cross(direcao,e2),det=dot(e1,h);
  if(Math.abs(det)<1e-10)return null;
  const inv=1/det,s=sub(p,a),u=dot(s,h)*inv;
  if(u< -1e-9||u>1+1e-9)return null;
  const q=cross(s,e1),v=dot(direcao,q)*inv;
  if(v< -1e-9||u+v>1+1e-9)return null;
  const t=dot(e2,q)*inv;return t>1e-8?t:null;
}

function prepararColisor(triangulos) {
  return {triangulos,min:[0,1,2].map(k=>Math.min(...triangulos.flat().map(p=>p[k]))),
    max:[0,1,2].map(k=>Math.max(...triangulos.flat().map(p=>p[k])))};
}
export function dentro(p,colisor) {
  if(p.some((v,k)=>v<colisor.min[k]||v>colisor.max[k]))return false;
  const batidas=colisor.triangulos.map(t=>raio(p,t)).filter(t=>t!==null).sort((a,b)=>a-b);
  let distintas=0,ultima=-Infinity;for(const t of batidas)if(t-ultima>1e-7){distintas++;ultima=t;}
  return distintas%2===1;
}
export function maisPerto(p,colisor) {
  let distancia=Infinity,alvo,normal;
  for(const tri of colisor.triangulos) {
    const q=perto(p,...tri),d=Math.hypot(...sub(q,p));
    if(d<distancia){distancia=d;alvo=q;normal=unit(cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])));}
  }
  return {alvo,distancia};
}
function penetracao(p,colisores,espessura) {
  const estados=colisores.map(c=>dentro(p,c));
  if(!estados.some(Boolean))return null;
  let melhor=null;
  const direcoes=colisores.filter((_,i)=>estados[i]).map(c=>unit(sub(maisPerto(p,c).alvo,p)));
  if(direcoes.length>1)direcoes.push(unit(direcoes.reduce(add,[0,0,0])));
  for(const direcao of direcoes) {
    const eventos=[];
    colisores.forEach((c,i)=>{const tempos=c.triangulos.map(t=>raio(p,t,direcao)).filter(t=>t!==null).sort((a,b)=>a-b);let ultimo=-Infinity;for(const t of tempos)if(t-ultimo>1e-7){eventos.push({t,i});ultimo=t;}});
    eventos.sort((a,b)=>a.t-b.t);const atuais=estados.slice();
    for(const {t,i}of eventos){atuais[i]=!atuais[i];if(!atuais.some(Boolean)){if(!melhor||t<melhor.distancia)melhor={delta:mul(direcao,t+espessura),distancia:t};break;}}
  }
  return melhor;
}

export function criarColisoresPele(posicoes,indices,grupos) {
  return grupos.map(grupo=>{
    const conjunto=new Set(grupo),tris=[];
    for(let t=0;t<indices.length;t+=3)if(conjunto.has(indices[t]))tris.push(Array.from(indices.slice(t,t+3),i=>point(posicoes,i)));
    const arestas=new Map();
    for(let t=0;t<indices.length;t+=3)if(conjunto.has(indices[t]))for(const [a,b]of[[indices[t],indices[t+1]],[indices[t+1],indices[t+2]],[indices[t+2],indices[t]]]) {
      const chave=[a,b].sort((x,y)=>x-y).join(':');if(!arestas.has(chave))arestas.set(chave,[]);arestas.get(chave).push([a,b]);
    }
    const bordas=[...arestas.values()].filter(a=>a.length===1).map(a=>a[0]);
    const usadas=new Set();
    for(const [inicio]of bordas)if(!usadas.has(inicio)) {
      const contorno=[inicio];let atual=inicio;
      do {usadas.add(atual);const proxima=bordas.find(([a])=>a===atual)?.[1];if(proxima===undefined)throw new Error('Borda da pele incoerente.');atual=proxima;if(atual!==inicio)contorno.push(atual);}while(atual!==inicio);
      const centro=[0,1,2].map(k=>contorno.reduce((s,i)=>s+posicoes[i*3+k],0)/contorno.length);
      for(let i=0;i<contorno.length;i++)tris.push([centro,point(posicoes,contorno[(i+1)%contorno.length]),point(posicoes,contorno[i])]);
    }
    return prepararColisor(tris);
  });
}

function separarFaces(a,b,folga) {
  let melhor=null;
  for(const tri of [a,b]) {
    const n=unit(cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])));
    const pa=a.map(p=>dot(p,n)),pb=b.map(p=>dot(p,n));
    const positivos=Math.max(...pa)-Math.min(...pb),negativos=Math.max(...pb)-Math.min(...pa);
    const sinal=positivos<negativos?1:-1,distancia=Math.min(positivos,negativos)+folga;
    if(distancia>0&&(!melhor||distancia<melhor.distancia))melhor={n:mul(n,sinal),distancia};
  }
  return melhor;
}

export function regularizarShort({posicoes,indices,triangulosShort,colisores,iteracoes=150,espessura=.003}) {
  const original=Array.from(posicoes),p=original.slice();
  const vertices=[...new Set(triangulosShort.flatMap(t=>Array.from(indices.slice(t*3,t*3+3))))];
  const vizinhos=new Map(vertices.map(i=>[i,new Set()])),arestas=new Map();
  for(const t of triangulosShort){const ids=Array.from(indices.slice(t*3,t*3+3));for(const [a,b]of[[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]]){vizinhos.get(a).add(b);vizinhos.get(b).add(a);const chave=[a,b].sort((x,y)=>x-y).join(':');arestas.set(chave,(arestas.get(chave)||0)+1);}}
  const borda=new Set([...arestas.entries()].filter(([,n])=>n===1).flatMap(([k])=>k.split(':').map(Number)));
  let melhor=null;const historico=[];
  for(let iteracao=0;iteracao<=iteracoes;iteracao++) {
    if(iteracao){const suavizada=p.slice();for(const id of vertices)if(!borda.has(id)){const lista=[...vizinhos.get(id)];for(let k=0;k<3;k++)suavizada[id*3+k]+=.2*(lista.reduce((s,i)=>s+p[i*3+k],0)/lista.length-p[id*3+k]);}p.splice(0,p.length,...suavizada);}
    const cruzamentos=analisarCruzamentos(p,indices,triangulosShort);
    let penetracoes=0,maxPenetracao=0;
    const forcas=Array(p.length).fill(0),contagens=Array(p.length/3).fill(0);
    const corrigir=(ids,amostra)=>{
        const pen=penetracao(amostra,colisores,espessura);if(!pen)return;
        penetracoes++;maxPenetracao=Math.max(maxPenetracao,pen.distancia);
        for(const id of ids){contagens[id]++;for(let k=0;k<3;k++)forcas[id*3+k]+=pen.delta[k];}
    };
    for(const id of vertices)corrigir([id],point(p,id));
    for(const t of triangulosShort) {
      const ids=Array.from(indices.slice(t*3,t*3+3)),tri=ids.map(i=>point(p,i));
      corrigir(ids,[0,1,2].map(k=>tri.reduce((s,v)=>s+v[k],0)/3));
    }
    const score=cruzamentos.length*10+penetracoes;
    if(iteracao<4||iteracao%25===0)historico.push({iteracao,cruzamentos:cruzamentos.length,penetracoes});
    if(!melhor||score<melhor.score)melhor={score,posicoes:p.slice(),cruzamentos:cruzamentos.length,penetracoes,maxPenetracao,iteracao};
    if(score===0)break;
    for(const {triangulos:[ta,tb]}of cruzamentos) {
      const ia=Array.from(indices.slice(ta*3,ta*3+3)),ib=Array.from(indices.slice(tb*3,tb*3+3));
      const separar=separarFaces(ia.map(i=>point(p,i)),ib.map(i=>point(p,i)),.0005);if(!separar)continue;
      for(const [ids,sinal]of[[ia,-1],[ib,1]])for(const id of ids){contagens[id]++;for(let k=0;k<3;k++)forcas[id*3+k]+=separar.n[k]*separar.distancia*sinal*.55;}
    }
    for(const id of vertices)if(contagens[id])for(let k=0;k<3;k++)p[id*3+k]+=forcas[id*3+k]/contagens[id];
  }
  melhor.maxDeslocamento=Math.max(...vertices.map(i=>Math.hypot(...sub(point(melhor.posicoes,i),point(original,i)))));
  melhor.historico=historico;
  return melhor;
}
