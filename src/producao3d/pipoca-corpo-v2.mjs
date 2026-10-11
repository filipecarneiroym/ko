import { criarPipoca } from './pipoca.mjs';
import { criarLoft, unirPrimitivas } from './pele-fluida.mjs';

const SUBSTITUIDOS = /^(quadril|tronco|peito|braco_[ED]|antebraco_[ED]|coxa_[ED]|canela_[ED])$/;

function preservarPartes(primitiva, removidos) {
  const p = { posicoes: [], normais: [], indices: [], juntas: [], pesos: [], material: primitiva.material };
  const mapa = new Map();
  for (let t = 0; t < primitiva.indices.length; t += 3) {
    const triangulo = primitiva.indices.slice(t, t + 3);
    const apagar = triangulo.map(v => removidos.has(primitiva.juntas[v*4]));
    if (apagar.some(Boolean) && !apagar.every(Boolean)) throw new Error('Triângulo antigo atravessa regiões preservadas; revise a seleção do corpo.');
    if (apagar[0]) continue;
    for (const v of triangulo) {
      if (!mapa.has(v)) {
        mapa.set(v, p.posicoes.length / 3);
        p.posicoes.push(...primitiva.posicoes.slice(v*3, v*3+3));
        p.normais.push(...primitiva.normais.slice(v*3, v*3+3));
        p.juntas.push(...primitiva.juntas.slice(v*4, v*4+4));
        p.pesos.push(...primitiva.pesos.slice(v*4, v*4+4));
      }
      p.indices.push(mapa.get(v));
    }
  }
  return p;
}

function criarShortUnido(cintura, pernas) {
  const segmentos = 24;
  const partes = [cintura,...pernas].map(aneis => criarLoft({aneis,material:1,segmentos}));
  // Flexionar a borda traseira suavemente: a ponte não pode afundar na perna.
  // Frente, posições e demais anéis mantêm os pesos anteriores.
  for(const perna of partes.slice(1))for(let s=10;s<=14;s++) {
    const t=Math.min(1,Math.abs(s-12)/3),suave=t*t*(3-2*t),coxa=.2+.3*suave;
    perna.pesos[s*4]=1-coxa;perna.pesos[s*4+1]=coxa;
  }
  for(const perna of partes.slice(1))for(let s=0;s<segmentos;s++) {
    const frente=Math.max(0,Math.cos(2*Math.PI*s/segmentos));
    perna.posicoes[s*3]+=.015*frente*frente;
  }
  for(let s=0;s<segmentos;s++) {
    const frente=Math.max(0,Math.cos(2*Math.PI*s/segmentos));
    partes[0].posicoes[((cintura.length-1)*segmentos+s)*3]+=.03*frente*frente;
  }
  const p = unirPrimitivas(partes)[0];
  const quadril = (cintura.length-1)*segmentos;
  const e = partes[0].posicoes.length/3;
  const d = e+partes[1].posicoes.length/3;
  const w = s => quadril+s%segmentos;
  const ve = s => e+s%segmentos;
  const vd = s => d+s%segmentos;
  // Cada metade da cintura se liga à metade externa da respectiva perna.
  for(let s=0;s<12;s++)p.indices.push(w(s),w(s+1),vd(s),w(s+1),vd(s+1),vd(s));
  for(let s=12;s<24;s++)p.indices.push(w(s),w(s+1),ve(s),w(s+1),ve(s+1),ve(s));
  // A entreperna é tecido contínuo, com normais para baixo; não fecha as saídas.
  for(let s=0;s<12;s++) {
    const a=ve(s),an=ve(s+1),b=vd((24-s)%24),bn=vd((23-s)%24);
    p.indices.push(a,b,an,b,bn,an);
  }
  p.indices.push(w(0),vd(0),ve(0),w(12),ve(12),vd(12));
  // Recalcular em todos os vértices compartilhados suaviza também as costuras.
  p.normais.fill(0);
  for(let i=0;i<p.indices.length;i+=3) {
    const [a,b,c]=p.indices.slice(i,i+3);
    const u=p.posicoes.slice(b*3,b*3+3).map((v,k)=>v-p.posicoes[a*3+k]);
    const v=p.posicoes.slice(c*3,c*3+3).map((v,k)=>v-p.posicoes[a*3+k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(Math.hypot(...n)<1e-12)throw new Error('Triângulo degenerado na união do short.');
    for(const j of [a,b,c])for(let k=0;k<3;k++)p.normais[j*3+k]+=n[k];
  }
  for(let i=0;i<p.normais.length;i+=3) {
    const tamanho=Math.hypot(...p.normais.slice(i,i+3));
    if(tamanho<1e-10)throw new Error('Normal nula na união do short.');
    for(let k=0;k<3;k++)p.normais[i+k]/=tamanho;
  }
  return p;
}

export function criarPipocaCorpoV2(ossos) {
  const base = criarPipoca(ossos);
  const indice = Object.fromEntries(ossos.map((o, i) => [o.nome, i]));
  const removidos = new Set(ossos.map((o, i) => SUBSTITUIDOS.test(o.nome) ? i : -1));
  const preservadas = base.primitivas.map(p => preservarPartes(p, removidos));
  const novas = [], superficies = [], pernasShort = [];
  const anel = (centro, raios, nomes, pesos) => ({ centro, raios, ossos: nomes.map(n => indice[n]), pesos });
  const construir = (nome, aneis, material, tampas = false) => {
    const p = criarLoft({ aneis, material, segmentos: 24, tampas });
    novas.push(p); superficies.push({ nome, material, aneis: aneis.length, vertices: p.posicoes.length / 3, triangulos: p.indices.length / 3, tampas });
  };
  // Um perfil contínuo substitui as três esferas sobrepostas da cintura e do tórax.
  const torso = [
    // Recolher a pele oculta: o volume antigo atravessava a ponte frontal do short.
    // A cintura visível (a partir de 1,07 m) e o perfil externo da roupa não mudam.
    anel([-.008,1.055,0],[.115,.190],['quadril'],[1]),
    anel([-.008,1.07,0],[.215,.312],['quadril'],[1]),
    anel([-.012,1.16,0],[.187,.282],['quadril','tronco'],[.9,.1]),
    anel([-.014,1.25,0],[.161,.248],['quadril','tronco'],[.55,.45]),
    anel([-.014,1.36,0],[.155,.236],['quadril','tronco'],[.15,.85]),
    anel([-.016,1.47,0],[.172,.258],['tronco','peito'],[.85,.15]),
    anel([-.018,1.58,0],[.199,.289],['tronco','peito'],[.45,.55]),
    anel([-.018,1.71,0],[.218,.310],['tronco','peito'],[.1,.9]),
    anel([-.012,1.82,0],[.179,.282],['peito'],[1]),
    anel([-.012,1.90,0],[.118,.171],['peito','cabeca'],[.5,.5]),
    anel([-.012,1.96,0],[.100,.117],['cabeca'],[1]),
  ];
  construir('pele-torso',torso,0,true);
  const casca = (aneis, distancia) => aneis.map(a => ({ ...a, centro: [...a.centro], raios: a.raios.map(r => r + distancia), ossos: [...a.ossos], pesos: [...a.pesos] }));
  // A roupa é uma casca aberta da mesma superfície e usa as mesmas influências.
  construir('top',casca(torso.slice(5,9),.009),1);
  // Perfil descendente: cintura estreita, abertura de quadril mais ampla.
  const cintura = [
    anel([-.012,1.16,0],[.199,.294],['quadril','tronco'],[.9,.1]),
    anel([-.010,1.115,0],[.215,.318],['quadril'],[1]),
    anel([-.006,1.065,0],[.220,.330],['quadril'],[1]),
  ];
  construir('faixa-cintura',casca([
    anel([-.011,1.125,0],[.201,.295],['quadril'],[1]),
    anel([-.012,1.151,0],[.191,.286],['quadril','tronco'],[.95,.05]),
  ],.014),0);

  for (const [lado, sinal] of [['E',-1],['D',1]]) {
    const b = `braco_${lado}`, a = `antebraco_${lado}`, c = `coxa_${lado}`, k = `canela_${lado}`, p = `pe_${lado}`;
    const ponto = (x,y,z) => [x,y,z*sinal];
    // As extremidades entram sob o tronco e o punho preservado, sem tampas visíveis.
    const braco = [
      anel(ponto(-.006,1.80,.285),[.113,.112],['peito',b],[.85,.15]),
      anel(ponto(-.003,1.795,.395),[.140,.145],['peito',b],[.2,.8]),
      anel(ponto(.022,1.72,.466),[.140,.133],[b],[1]),
      anel(ponto(.055,1.585,.528),[.128,.125],[b],[1]),
      anel(ponto(.082,1.445,.584),[.108,.107],[b,a],[.85,.15]),
      anel(ponto(.100,1.36,.620),[.103,.103],[b,a],[.5,.5]),
      anel(ponto(.116,1.285,.640),[.109,.106],[b,a],[.15,.85]),
      anel(ponto(.144,1.18,.669),[.105,.102],[a],[1]),
      anel(ponto(.175,1.065,.699),[.085,.085],[a],[1]),
    ];
    construir(`pele-braco-${lado}`,braco,0);
    const perna = [
      anel(ponto(0,.98,.20),[.164,.157],['quadril',c],[.5,.5]),
      anel(ponto(.009,.90,.208),[.168,.160],['quadril',c],[.15,.85]),
      anel(ponto(.016,.79,.218),[.158,.153],[c],[1]),
      anel(ponto(.024,.66,.225),[.129,.125],[c],[1]),
      anel(ponto(.027,.60,.228),[.113,.110],[c,k],[.85,.15]),
      anel(ponto(.030,.53,.230),[.107,.105],[c,k],[.5,.5]),
      anel(ponto(.023,.47,.232),[.103,.100],[c,k],[.15,.85]),
      anel(ponto(.006,.35,.236),[.105,.108],[k],[1]),
      anel(ponto(.003,.23,.238),[.082,.084],[k,p],[.9,.1]),
      anel(ponto(.001,.17,.240),[.077,.079],[k,p],[.4,.6]),
    ];
    construir(`pele-perna-${lado}`,perna,0);
    pernasShort.push(casca(perna.slice(0,3),.012));
    construir(`barra-short-${lado}`,casca([
      anel(ponto(.016,.804,.217),[.159,.154],[c],[1]),
      anel(ponto(.016,.790,.218),[.158,.153],[c],[1]),
    ],.014),0);
  }
  const short = criarShortUnido(cintura,pernasShort);
  novas.push(short);
  superficies.push({nome:'short-continuo',material:1,aneis:cintura.length+pernasShort.reduce((s,p)=>s+p.length,0),
    vertices:short.posicoes.length/3,triangulos:short.indices.length/3,tampas:false,
    uniao:'Cintura e pernas compartilham vértices; apenas cintura e duas barras permanecem abertas.'});
  const primitivas = unirPrimitivas([...preservadas,...novas]);
  let verticesMistos = 0;
  for (const p of primitivas) for (let i = 0; i < p.pesos.length; i += 4) if (p.pesos.slice(i,i+4).filter(v => v > 1e-8).length > 1) verticesMistos++;
  return { primitivas, materiais: base.materiais, extras: { ...base.extras,
    status: 'estudo-corpo-fluido', aprovadoFinal: false,
    corpo: { versao: 2, superficies, verticesMistos, rigPreservado: true,
      partesPreservadas: ['cabeca','mandibula','orelha_E','orelha_D','mao_E','mao_D','pe_E','pe_D','cauda'],
      tecnica: 'Lofts com anéis compartilhados, normais suaves e até duas influências por vértice.' },
    limites: ['Estudo de superfície corporal; ainda requer revisão artística e de dobras.', 'Rosto, luvas, pés, orelhas e cauda anteriores preservados.', 'Uniões sob roupas e ombros exigem inspeção em todas as poses; sem pelagem ou tecido texturizado.'],
  } };
}
