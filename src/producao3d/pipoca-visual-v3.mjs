import { criarPipocaCorpoV2 } from './pipoca-corpo-v2.mjs';
import { criarLoft, unirPrimitivas } from './pele-fluida.mjs';

const sub = (a,b) => a.map((v,i)=>v-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

function superficie(posicoes,indices,material,junta) {
  const normais=Array(posicoes.length).fill(0);
  for(let t=0;t<indices.length;t+=3) {
    const [a,b,c]=indices.slice(t,t+3);
    const n=cross(sub(posicoes.slice(b*3,b*3+3),posicoes.slice(a*3,a*3+3)),sub(posicoes.slice(c*3,c*3+3),posicoes.slice(a*3,a*3+3)));
    if(Math.hypot(...n)<1e-12)throw new Error('Triângulo degenerado no rosto da Pipoca.');
    for(const v of [a,b,c])for(let k=0;k<3;k++)normais[v*3+k]+=n[k];
  }
  for(let i=0;i<normais.length;i+=3) {
    const comprimento=Math.hypot(...normais.slice(i,i+3));
    if(comprimento<1e-10)throw new Error('Normal nula no rosto da Pipoca.');
    for(let k=0;k<3;k++)normais[i+k]/=comprimento;
  }
  const juntas=[],pesos=[];
  for(let i=0;i<posicoes.length/3;i++){juntas.push(junta,0,0,0);pesos.push(1,0,0,0);}
  return {posicoes,normais,indices,juntas,pesos,material};
}

function preservarForaDoRosto(p,removidos) {
  const saida={posicoes:[],normais:[],indices:[],juntas:[],pesos:[],material:p.material},mapa=new Map();
  for(let t=0;t<p.indices.length;t+=3) {
    const tri=p.indices.slice(t,t+3);
    if(removidos.has(t/3))continue;
    for(const v of tri) {
      if(!mapa.has(v)) {
        mapa.set(v,saida.posicoes.length/3);
        saida.posicoes.push(...p.posicoes.slice(v*3,v*3+3));saida.normais.push(...p.normais.slice(v*3,v*3+3));
        saida.juntas.push(...p.juntas.slice(v*4,v*4+4));saida.pesos.push(...p.pesos.slice(v*4,v*4+4));
      }
      saida.indices.push(mapa.get(v));
    }
  }
  return saida;
}

function partesFaciais(p,removidos) {
  // O torso contínuo tem anéis finais 100% cabeça. Como seu componente também
  // inclui peito, a seleção por componente preserva todo o pescoço existente.
  const incidentes=new Map();
  for(let t=0;t<p.indices.length;t+=3)for(const v of p.indices.slice(t,t+3)) {
    if(!incidentes.has(v))incidentes.set(v,[]);incidentes.get(v).push(t/3);
  }
  const vistos=new Set(),apagar=new Set();
  for(let t=0;t<p.indices.length/3;t++)if(!vistos.has(t)) {
    const fila=[t],componente=[];let somenteRosto=true;vistos.add(t);
    while(fila.length) {
      const i=fila.pop();componente.push(i);
      for(const v of p.indices.slice(i*3,i*3+3)) {
        for(let k=0;k<4;k++)if(p.pesos[v*4+k]>1e-8&&!removidos.has(p.juntas[v*4+k]))somenteRosto=false;
        for(const vizinho of incidentes.get(v))if(!vistos.has(vizinho)){vistos.add(vizinho);fila.push(vizinho);}
      }
    }
    if(somenteRosto)for(const i of componente)apagar.add(i);
  }
  return apagar;
}

// Seções de um único crânio: o focinho e as bochechas são deformações da mesma
// superfície, sem acrescentar esferas ao redor dos olhos ou sobre a mandíbula.
const PERFIL=[
  [1.987,.020,.083,.089],[2.008,.012,.119,.142],[2.033,-.005,.164,.192],
  [2.064,-.020,.204,.246],[2.100,-.028,.232,.300],[2.137,-.034,.244,.306],
  [2.177,-.041,.252,.290],[2.217,-.041,.256,.272],[2.257,-.039,.248,.258],
  [2.297,-.037,.240,.244],[2.337,-.037,.218,.222],[2.373,-.038,.194,.195],
  [2.405,-.038,.160,.155],[2.431,-.038,.117,.112],[2.449,-.038,.066,.061],
];

function perfilEm(y) {
  let i=0;while(i<PERFIL.length-2&&y>PERFIL[i+1][0])i++;
  const a=PERFIL[i],b=PERFIL[i+1],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));
  const anterior=PERFIL[Math.max(0,i-1)],proximo=PERFIL[Math.min(PERFIL.length-1,i+2)],h=b[0]-a[0];
  return a.map((v,k)=> {
    if(k===0)return y;
    const m0=(b[k]-anterior[k])/(b[0]-anterior[0]),m1=(proximo[k]-a[k])/(proximo[0]-a[0]);
    return (2*t**3-3*t*t+1)*v+(t**3-2*t*t+t)*h*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*m1;
  });
}

function pelagemBochecha(y,c) {
  // Três ondulações largas e curtas na própria pele criam a silhueta macia
  // das bochechas da referência sem cones ou peças soltas. A amplificação
  // leve aqui evita a face demasiadamente plana na vista de três quartos.
  const gauss=(centro,raio)=>Math.exp(-(((y-centro)/raio)**2));
  const volume=.010*gauss(2.115,.060)+.006*gauss(2.076,.010)+.011*gauss(2.115,.011)+.009*gauss(2.157,.010);
  return volume*Math.exp(-(((c+.40)/.28)**2));
}

function frente(y,z) {
  const [,cx,rx,rz]=perfilEm(y);
  let minimo=0,maximo=Math.PI/2;
  for(let i=0;i<22;i++) {
    const a=(minimo+maximo)/2,c=Math.cos(a),distancia=(rz+pelagemBochecha(y,c))*Math.sin(a);
    if(distancia<Math.abs(z))minimo=a;else maximo=a;
  }
  const c=Math.cos((minimo+maximo)/2);
  const focinho=.103*Math.exp(-(((y-2.088)/.058)**2))*Math.exp(-((z/.137)**2))*c**4;
  return cx+rx*c+focinho;
}

function cabecaUnida(junta) {
  const segmentos=48,p=[],indices=[];
  const secoes=PERFIL.flatMap((anel,i)=>i===PERFIL.length-1?[anel]:Array.from({length:4},(_,s)=>perfilEm(anel[0]+(PERFIL[i+1][0]-anel[0])*s/4)));
  for(const [y,cx,rx,rz]of secoes)for(let s=0;s<segmentos;s++) {
    const a=2*Math.PI*s/segmentos,c=Math.cos(a),z=-(rz+pelagemBochecha(y,c))*Math.sin(a);
    const focinho=.103*Math.exp(-(((y-2.088)/.058)**2))*Math.exp(-((z/.137)**2))*Math.max(0,c)**4;
    p.push(cx+rx*c+focinho,y,z);
  }
  for(let a=0;a<secoes.length-1;a++)for(let s=0;s<segmentos;s++) {
    const i=a*segmentos+s,n=a*segmentos+(s+1)%segmentos,b=i+segmentos,bn=n+segmentos;
    indices.push(i,n,b,n,bn,b);
  }
  const inferior=p.length/3;p.push(.015,1.975,0);
  const superior=p.length/3;p.push(-.035,2.458,0);
  for(let s=0;s<segmentos;s++) {
    const n=(s+1)%segmentos,ultimo=(secoes.length-1)*segmentos;
    indices.push(inferior,n,s,superior,ultimo+s,ultimo+n);
  }
  return superficie(p,indices,0,junta);
}

// Uma lâmina com raiz estreita substitui a cápsula e a esfera da implantação.
// A concavidade frontal pertence à própria superfície; o interior rosa é uma
// película fina sobre ela, com os mesmos pesos em cada altura.
const PERFIL_ORELHA=[
  [2.365,-.058,.135,.034,.036],[2.425,-.060,.166,.039,.050],
  [2.490,-.064,.190,.044,.069],[2.565,-.062,.210,.053,.090],
  [2.655,-.055,.233,.060,.118],[2.750,-.041,.259,.066,.142],
  [2.845,-.024,.286,.062,.150],[2.935,-.010,.312,.053,.136],
  [3.020,.000,.334,.040,.108],[3.095,.006,.352,.026,.074],
  [3.155,.003,.366,.016,.040],[3.195,-.003,.379,.008,.016],
];
function perfilOrelhaEm(y) {
  let i=0;while(i<PERFIL_ORELHA.length-2&&y>PERFIL_ORELHA[i+1][0])i++;
  const a=PERFIL_ORELHA[i],b=PERFIL_ORELHA[i+1],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));
  const anterior=PERFIL_ORELHA[Math.max(0,i-1)],proximo=PERFIL_ORELHA[Math.min(PERFIL_ORELHA.length-1,i+2)],h=b[0]-a[0];
  return a.map((v,k)=> {
    if(k===0)return y;
    const m0=(b[k]-anterior[k])/(b[0]-anterior[0]),m1=(proximo[k]-a[k])/(proximo[0]-a[0]);
    return (2*t**3-3*t*t+1)*v+(t**3-2*t*t+t)*h*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*m1;
  });
}
function pesoOrelha(y) {
  const t=Math.max(0,Math.min(1,(y-2.385)/.185));return t*t*(3-2*t);
}
function frenteOrelha(y,z,sinal) {
  const [,cx,cz,rx,rz]=perfilOrelhaEm(y),u=(z-sinal*cz)/rz,c=Math.sqrt(Math.max(0,1-u*u));
  const cavidade=rx*.64*Math.sin(Math.PI*Math.max(0,Math.min(1,(y-2.42)/.80)));
  return cx+rx*c-cavidade*c**4;
}
function peleOrelha(p,indices,material,junta,cabeca) {
  const malha=superficie(p,indices,material,junta);
  for(let v=0;v<p.length/3;v++) {
    const peso=pesoOrelha(p[v*3+1]);
    malha.juntas.splice(v*4,4,junta,cabeca,0,0);malha.pesos.splice(v*4,4,peso,1-peso,0,0);
  }
  return malha;
}
function orelhaOrganica(sinal,junta,cabeca) {
  const segmentos=40,p=[],indices=[];
  const secoes=PERFIL_ORELHA.flatMap((anel,i)=>i===PERFIL_ORELHA.length-1?[anel]:Array.from({length:4},(_,s)=>perfilOrelhaEm(anel[0]+(PERFIL_ORELHA[i+1][0]-anel[0])*s/4)));
  for(const [y,cx,cz,rx,rz]of secoes)for(let s=0;s<segmentos;s++) {
    const a=s/segmentos*Math.PI*2,c=Math.cos(a),z=sinal*cz-rz*Math.sin(a);
    const x=c>0?frenteOrelha(y,z,sinal):cx+rx*c;
    p.push(x,y,z);
  }
  for(let a=0;a<secoes.length-1;a++)for(let s=0;s<segmentos;s++) {
    const i=a*segmentos+s,n=a*segmentos+(s+1)%segmentos,b=i+segmentos,bn=n+segmentos;
    indices.push(i,n,b,n,bn,b);
  }
  const inferior=p.length/3;p.push(-.052,2.345,sinal*.119);
  const superior=p.length/3;p.push(-.008,3.218,sinal*.342);
  for(let s=0;s<segmentos;s++) {
    const n=(s+1)%segmentos,ultimo=(secoes.length-1)*segmentos;
    indices.push(inferior,n,s,superior,ultimo+s,ultimo+n);
  }
  const exterior=peleOrelha(p,indices,0,junta,cabeca),rosa=[],tri=[];
  const linhas=26,colunas=16,y0=2.515,y1=3.158;
  for(let i=0;i<=linhas;i++) {
    // A ponta e o início se estreitam sem triângulos de área nula.
    const t=i/linhas,y=y0+(y1-y0)*t,[,,cz,,rz]=perfilOrelhaEm(y);
    const largura=rz*(.17+.64*Math.sin(Math.PI*t)**.30);
    for(let j=0;j<=colunas;j++) {
      const z=sinal*cz+largura*(2*j/colunas-1);
      rosa.push(frenteOrelha(y,z,sinal)+.0022,y,z);
      if(i&&j) {
        const b=i*(colunas+1)+j,a=b-colunas-1;
        tri.push(a-1,b-1,a,a,b-1,b);
      }
    }
  }
  // Orientação frontal +X; mantém culling de face traseira habilitado.
  for(let i=0;i<tri.length;i+=3) {
    const [a,b,c]=tri.slice(i,i+3).map(v=>rosa.slice(v*3,v*3+3));
    if(cross(sub(b,a),sub(c,a))[0]<0)[tri[i+1],tri[i+2]]=[tri[i+2],tri[i+1]];
  }
  return [exterior,peleOrelha(rosa,tri,3,junta,cabeca)];
}

function placa({y,z,largura,altura,material,junta,projetar,segmentos=36,aneis=5,inclinacao=0,amendoa=false}) {
  const p=[projetar(y,z),y,z],indices=[];
  for(let r=1;r<=aneis;r++)for(let s=0;s<segmentos;s++) {
    const a=s/segmentos*Math.PI*2,t=r/aneis,cos=Math.cos(a),sin=Math.sin(a);
    const zz=z+largura*cos*t;
    const yy=y+altura*sin*t*(amendoa?.90+.10*Math.abs(sin):1)+inclinacao*(zz-z);
    p.push(projetar(yy,zz),yy,zz);
  }
  for(let s=0;s<segmentos;s++)indices.push(0,1+(s+1)%segmentos,1+s);
  for(let r=1;r<aneis;r++)for(let s=0;s<segmentos;s++) {
    const a=1+(r-1)*segmentos+s,n=1+(r-1)*segmentos+(s+1)%segmentos,b=a+segmentos,bn=n+segmentos;
    indices.push(a,n,b,n,bn,b);
  }
  return superficie(p,indices,material,junta);
}

function contornoOlho(y,z,largura,altura,sinal,junta) {
  const p=[],indices=[],segmentos=36;
  for(let r=0;r<3;r++)for(let s=0;s<segmentos;s++) {
    const t=r/2,a=s/segmentos*Math.PI*2,c=Math.cos(a),sin=Math.sin(a);
    const zz=z+(largura+.006*t)*c,yy=y+(altura+.005*t)*sin*(.90+.10*Math.abs(sin))+sinal*.05*(zz-z);
    p.push(frente(yy,zz)+.011-.002*t,yy,zz);
  }
  for(let r=0;r<2;r++)for(let s=0;s<segmentos;s++) {
    const a=r*segmentos+s,n=r*segmentos+(s+1)%segmentos,b=a+segmentos,bn=n+segmentos;
    indices.push(a,n,b,n,bn,b);
  }
  return superficie(p,indices,4,junta);
}

function faixaCurva(pontos,espessura,material,junta,offset=.009,projetar=frente) {
  const p=[],indices=[],passos=24;
  for(let i=0;i<=passos;i++) {
    const t=i/passos,u=1-t;
    const [z,y]=[0,1].map(k=>u*u*pontos[0][k]+2*u*t*pontos[1][k]+t*t*pontos[2][k]);
    const largura=typeof espessura==='function'?espessura(t):espessura;
    const tangente=[0,1].map(k=>2*u*(pontos[1][k]-pontos[0][k])+2*t*(pontos[2][k]-pontos[1][k]));
    const tamanho=Math.hypot(...tangente),normal=[-tangente[1]/tamanho,tangente[0]/tamanho];
    for(const sinal of [-1,1]) {
      const zz=z+sinal*largura*.5*normal[0],yy=y+sinal*largura*.5*normal[1];
      p.push(projetar(yy,zz)+offset,yy,zz);
    }
    if(i>0) {
      const a=(i-1)*2,b=i*2;
      const orientar=tri=> {
        const [x,y,z]=tri.map(v=>p.slice(v*3,v*3+3));
        if(cross(sub(y,x),sub(z,x))[0]<0)[tri[1],tri[2]]=[tri[2],tri[1]];
        indices.push(...tri);
      };
      orientar([a,b,a+1]);orientar([a+1,b,b+1]);
    }
  }
  return superficie(p,indices,material,junta);
}

export function criarPipocaVisualV3(ossos) {
  const base=criarPipocaCorpoV2(ossos),indice=Object.fromEntries(ossos.map((o,i)=>[o.nome,i]));
  for(const nome of ['cabeca','mandibula','peito','orelha_E','orelha_D'])if(!Number.isInteger(indice[nome]))throw new Error(`Osso obrigatório ausente: ${nome}`);
  const removidos=new Set([indice.cabeca,indice.mandibula,indice.orelha_E,indice.orelha_D]);
  const preservadas=base.primitivas.map(p=>preservarForaDoRosto(p,partesFaciais(p,removidos)));
  const novas=[cabecaUnida(indice.cabeca)],partes=[{nome:'cranio-bochechas-focinho',tecnica:'superficie-unica',junta:'cabeca'}];
  novas.push(criarLoft({aneis:[
    {centro:[-.012,1.930,0],raios:[.101,.116],ossos:[indice.cabeca],pesos:[1]},
    {centro:[-.010,1.977,0],raios:[.108,.121],ossos:[indice.cabeca],pesos:[1]},
    {centro:[-.006,2.025,0],raios:[.119,.132],ossos:[indice.cabeca],pesos:[1]},
  ],material:0,segmentos:32}));
  for(const [sufixo,sinal]of [['E',-1],['D',1]])novas.push(...orelhaOrganica(sinal,indice[`orelha_${sufixo}`],indice.cabeca));
  for(const sinal of [-1,1]) {
    const y=2.250,z=.146*sinal,largura=.081,altura=.086;
    const superficieOlho=(yy,zz)=>frente(yy,zz)+.011+.012*Math.max(0,1-((zz-z)/largura)**2-((yy-y)/altura)**2);
    novas.push(contornoOlho(y,z,largura,altura,sinal,indice.cabeca));
    novas.push(placa({y,z,largura,altura,material:0,junta:indice.cabeca,amendoa:true,inclinacao:sinal*.05,projetar:superficieOlho}));
    const irisZ=z-sinal*.006;
    novas.push(placa({y:y-.003,z:irisZ,largura:.035,altura:.055,material:5,junta:indice.cabeca,projetar:(yy,zz)=>superficieOlho(yy,zz)+.009}));
    novas.push(placa({y:y-.003,z:irisZ-sinal*.003,largura:.017,altura:.044,material:4,junta:indice.cabeca,projetar:(yy,zz)=>superficieOlho(yy,zz)+.012}));
    novas.push(placa({y:y+.026,z:irisZ-sinal*.011,largura:.009,altura:.011,material:0,junta:indice.cabeca,aneis:3,segmentos:20,projetar:(yy,zz)=>superficieOlho(yy,zz)+.015}));
    novas.push(faixaCurva([[sinal*.052,2.326],[sinal*.132,2.382],[sinal*.210,2.320]],t=>.007+.010*Math.sin(Math.PI*t),4,indice.cabeca,.014));
    // Cílios nascem no contorno superior. A continuação tangente evita projetar
    // a ponta fora do crânio, o que dobrava a fita em triângulos sobre o olho.
    for(let cilio=0;cilio<2;cilio++) {
      const z0=.197+cilio*.011,y0=2.308-cilio*.009,x0=frente(y0,sinal*z0);
      novas.push(faixaCurva([
        [sinal*z0,y0],
        [sinal*(z0+.019),y0+.009],
        [sinal*(z0+.033),y0+.024],
      ],t=>.0045*(1-t)+.0006,4,indice.cabeca,.014,(yy,zz)=>x0-.45*(sinal*zz-z0)+.10*(yy-y0)));
    }
    novas.push(faixaCurva([[0,2.056],[sinal*.087,2.050],[sinal*.133,2.092]],t=>.006-.003*t,4,indice.mandibula,.014));
  }
  novas.push(placa({y:2.119,z:0,largura:.043,altura:.023,material:3,junta:indice.cabeca,segmentos:32,aneis:5,projetar:(y,z)=>frente(y,z)+.011+.008*Math.max(0,1-(z/.043)**2-((y-2.119)/.023)**2)}));
  novas.push(faixaCurva([[0,2.102],[.0001,2.082],[0,2.056]],.0045,4,indice.mandibula,.014));
  partes.push({nome:'olhos-amendoados',tecnica:'placas-projetadas-na-face',projecaoMaximaMetros:.040,distanciaIrisEscleraMetros:.009},{nome:'sobrancelhas-e-sorriso',tecnica:'fitas-curvas-projetadas'});
  partes.push({nome:'orelhas-organicas',tecnica:'laminas-concavas-continuas',componentesExternos:2,alturaMaximaMetros:3.218,transicaoCabecaOrelha:[2.385,2.570],espessuraInteriorRosaMetros:.0022});
  partes.push({nome:'silhueta-pelagem-bochechas',tecnica:'ondulacoes-suaves-integradas',deslocamentoMaximoMetros:.017,mapaPelagem:false});
  return {primitivas:unirPrimitivas([...preservadas,...novas]),materiais:base.materiais,extras:{...base.extras,
    status:'estudo-visual-pipoca-v3',aprovadoFinal:false,
    rosto:{versao:3,partes,referencias:['art/premium/elenco/pipoca-v1.png','art/premium/modelos-3d/referencias/pipoca-referencia-v1.png'],
      rigPreservado:true,componentesExternosPreservados:true,anatomia:'Crânio, bochechas e focinho contínuos; olhos baixos projetados na superfície e sorriso curto.'},
    limites:['Estudo de anatomia e identidade; ainda não é arte final aprovada.','Pelagem, tecido e couro ainda precisam de mapas de superfície e revisão artística.','Corpo, luvas, pés e cauda preservados da cadeia anterior; orelhas refinadas sem alterar o rig.'],
  }};
}
