const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inflateSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const modulos=Promise.all([
  import('../../../src/producao3d/pipoca-pelagem.mjs'),
  import('../../../src/producao3d/pipoca-visual-v3.mjs'),
  import('../../../src/producao3d/pipoca-figurino.mjs'),
  import('../../../src/producao3d/rig.mjs'),
  import('../../../scripts/producao-3d/glb.mjs'),
]);
const fonte=modulos.then(([,visual,figurino,rig])=> {
  const ossos=rig.criarRig();return {nome:'Pipoca prova pelagem',ossos,...figurino.refinarFigurino(visual.criarPipocaVisualV3(ossos),ossos)};
});
function assinatura(p,tri) {
  return tri.flatMap(v=>[...p.posicoes.slice(v*3,v*3+3),...p.normais.slice(v*3,v*3+3),...p.juntas.slice(v*4,v*4+4),...p.pesos.slice(v*4,v*4+4)]);
}
function conferirGeometria(a,b) {
  assert.equal(a.indices.length,b.indices.length);
  for(let t=0;t<a.indices.length;t+=3)assert.deepEqual(assinatura(a,a.indices.slice(t,t+3)),assinatura(b,b.indices.slice(t,t+3)),`Triângulo ${t/3} preservado exatamente`);
}
function pixels(png) {
  const largura=png.readUInt32BE(16),altura=png.readUInt32BE(20),partes=[];
  for(let i=8;i<png.length;){const n=png.readUInt32BE(i);if(png.toString('ascii',i+4,i+8)==='IDAT')partes.push(png.subarray(i+8,i+8+n));i+=n+12;}
  return {largura,altura,raw:inflateSync(Buffer.concat(partes))};
}

test('pelagem opcional preserva todos os triângulos, rig, roupa, cores e animações',async()=> {
  const [{aplicarPelagemPipoca}]=await modulos,dados=await fonte,antes=JSON.stringify(dados),resultado=aplicarPelagemPipoca(dados);
  assert.equal(JSON.stringify(dados),antes,'Nenhuma mutação na fonte');assert.equal(resultado.ossos,dados.ossos);assert.equal(resultado.clips,dados.clips);
  assert.equal(resultado.materiais.length,6);
  for(let i=1;i<6;i++)assert.deepEqual(resultado.materiais[i],dados.materiais[i]);
  assert.deepEqual(resultado.materiais[0].pbrMetallicRoughness,dados.materiais[0].pbrMetallicRoughness);
  for(const p of dados.primitivas) {
    const depois=resultado.primitivas.find(q=>q.material===p.material);
    if(p.material===0)conferirGeometria(p,depois);else assert.equal(depois,p,'Roupa e detalhes usam o objeto original');
  }
  const p=resultado.primitivas.find(p=>p.material===0),origem=dados.primitivas.find(p=>p.material===0);
  assert.equal((p.posicoes.length-origem.posicoes.length)/3,resultado.extras.pelagemProcedural.verticesCostura);
  assert.ok(resultado.extras.pelagemProcedural.verticesCostura>0);
  assert.equal(p.uvs.length,p.posicoes.length/3*2);assert.ok(p.uvs.every(Number.isFinite));
  assert.equal(resultado.extras.aprovadoFinal,false);assert.equal(aplicarPelagemPipoca(resultado),resultado);
});

test('UVs são calculados por componentes e continuam válidos com vértices reordenados',async()=> {
  const [{aplicarPelagemPipoca}]=await modulos,dados=await fonte,p=dados.primitivas.find(p=>p.material===0),n=p.posicoes.length/3;
  const novo={...p};
  for(const [campo,tamanho]of [['posicoes',3],['normais',3],['juntas',4],['pesos',4]]) {
    novo[campo]=[];for(let v=n-1;v>=0;v--)novo[campo].push(...p[campo].slice(v*tamanho,(v+1)*tamanho));
  }
  novo.indices=p.indices.map(v=>n-1-v);
  const entrada={...dados,primitivas:dados.primitivas.map(q=>q===p?novo:q)},resultado=aplicarPelagemPipoca(entrada,{resolucao:256});
  conferirGeometria(novo,resultado.primitivas.find(p=>p.material===0));
  const info=resultado.extras.pelagemProcedural;
  assert.equal(info.componentes['radial-cabeca'],1);assert.ok(info.componentes['longitudinal-membro']>=10);assert.ok(info.componentes.neutra>=4);
  const pele=resultado.primitivas.find(p=>p.material===0),neutro=.5/256;let esclera=0;
  for(let v=0;v<n;v++)if(pele.posicoes[v*3+1]>2.17&&pele.posicoes[v*3+1]<2.33&&pele.uvs[v*2]===neutro&&pele.uvs[v*2+1]===neutro)esclera++;
  assert.ok(esclera>300,'Escleras e reflexos permanecem em um texel neutro');
});

test('normal map direcional é reproduzível, suave, neutro nas escleras e menor que 512 KB em 512',async()=> {
  const [{criarNormalPelagem}]=await modulos,png=criarNormalPelagem(512),repetido=criarNormalPelagem(512),{largura,altura,raw}=pixels(png);
  assert.equal(createHash('sha256').update(png).digest('hex'),createHash('sha256').update(repetido).digest('hex'));
  assert.equal(largura,512);assert.equal(altura,512);assert.ok(png.length<512*1024);
  assert.deepEqual([...raw.subarray(1,5)],[128,128,255,255]);
  let variacaoX=0,variacaoY=0;
  for(let y=0;y<altura;y+=7)for(let x=0;x<largura;x+=7) {
    const i=y*(1+largura*4)+1+x*4,n=[0,1,2].map(k=>raw[i+k]/255*2-1);
    assert.ok(Math.abs(Math.hypot(...n)-1)<.012,'Normais codificadas unitárias');assert.ok(n[2]>.93,'Microrelevo limitado a menos de 22 graus');
    variacaoX+=n[0]*n[0];variacaoY+=n[1]*n[1];
  }
  assert.ok(variacaoX>variacaoY*2,'Fibras alongadas na direção longitudinal do UV');
});

test('PNG e normalTexture são incorporados com os índices certos, sem URI nem sétimo material',async()=> {
  const [{aplicarPelagemPipoca},,,,{exportarGlb}]=await modulos,dados=await fonte,resultado=aplicarPelagemPipoca(dados),glb=exportarGlb(resultado);
  const doc=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12))),mapa=doc.materials[0].normalTexture;
  assert.equal(doc.materials.length,6);assert.equal(doc.images.length,dados.imagens.length+1);assert.equal(mapa.scale,1);
  assert.equal(mapa.index,doc.textures.length-1);const imagem=doc.images[doc.textures[mapa.index].source];
  assert.equal(imagem.mimeType,'image/png');assert.equal(imagem.uri,undefined);assert.equal(doc.buffers[0].uri,undefined);
  assert.equal(doc.samplers[doc.textures[mapa.index].sampler].wrapS,10497);
  const pele=doc.meshes[0].primitives.find(p=>p.material===0),uv=doc.accessors[pele.attributes.TEXCOORD_0];
  assert.equal(uv.type,'VEC2');assert.equal(uv.count,doc.accessors[pele.attributes.POSITION].count);
  assert.throws(()=>aplicarPelagemPipoca(dados,{intensidade:NaN}),/intensidade/);
  assert.throws(()=>aplicarPelagemPipoca(dados,{periodoMetros:.01}),/escala/);
  assert.throws(()=>aplicarPelagemPipoca(dados,{resolucao:2048}),/resolução/);
});

test('agachado mantém as pernas em espelho e sem empurrar o pé para trás',async()=> {
  const {criarRig}=await import('../../../src/producao3d/rig.mjs');
  const {criarAnimacoes}=await import('../../../src/producao3d/animacoes.mjs');
  const ossos=criarRig();
  const clips=criarAnimacoes('pipoca',ossos,{LUTADORES:{pipoca:{golpes:{}}}});
  const agachado=clips.find(c=>c.nome==='agachado');
  const idx={E:ossos.findIndex(o=>o.nome==='coxa_E'),D:ossos.findIndex(o=>o.nome==='coxa_D')};
  const canal=(osso,tipo)=>agachado.canais.find(c=>c.osso===osso&&c.tipo===tipo);
  const qE=canal(idx.E,'rotation').valores.slice(0,4);
  const qD=canal(idx.D,'rotation').valores.slice(0,4);
  assert.ok(Math.abs(qE[2]+qD[2])<1e-5,'As rotações laterais do agachado devem seguir espelho para evitar o deslocamento para trás');
  assert.ok(Math.abs(qE[0]-qD[0])<1e-5 && Math.abs(qE[1]-qD[1])<1e-5,'A rotação de coxa deve permanecer simétrica nos eixos X/Y');
});

test('as poses principais da Pipoca preservam espelho e não deformam cintura nem short em toda a rotina',async()=> {
  const {criarRig}=await import('../../../src/producao3d/rig.mjs');
  const {criarAnimacoes}=await import('../../../src/producao3d/animacoes.mjs');
  const ossos=criarRig();
  const clips=criarAnimacoes('pipoca',ossos,{LUTADORES:{pipoca:{golpes:{}}}});
  const nomes=['parado','agachado','defesa','defesaBaixa','andando','corrida','pulo','pousando','dano','caido','recuo'];
  const idx={quadril:ossos.findIndex(o=>o.nome==='quadril'),coxa_E:ossos.findIndex(o=>o.nome==='coxa_E'),coxa_D:ossos.findIndex(o=>o.nome==='coxa_D'),canela_E:ossos.findIndex(o=>o.nome==='canela_E'),canela_D:ossos.findIndex(o=>o.nome==='canela_D'),pe_E:ossos.findIndex(o=>o.nome==='pe_E'),pe_D:ossos.findIndex(o=>o.nome==='pe_D')};
  for (const nome of nomes) {
    const clip=clips.find(c=>c.nome===nome);
    assert.ok(clip,`${nome} deve existir no conjunto principal`);
    const chama=(osso,tipo,frame=0)=>{
      const canal=clip.canais.find(c=>c.osso===osso&&c.tipo===tipo);
      assert.ok(canal,`${nome} precisa do canal ${tipo} em ${osso}`);
      const t=frame/60;
      let i=0; while (i < canal.tempos.length - 2 && canal.tempos[i + 1] < t) i++;
      const n = tipo === 'rotation' ? 4 : 3;
      const a = canal.valores.slice(i*n, i*n+n);
      const b = canal.valores.slice((i+1)*n, (i+1)*n+n);
      const u = (t - canal.tempos[i]) / (canal.tempos[i + 1] - canal.tempos[i]);
      return tipo === 'rotation' ? a.map((v,j)=>v*(1-u)+b[j]*u) : a.map((v,j)=>v*(1-u)+b[j]*u);
    };
    for (const [lado, outro] of [['E','D'],['D','E']]) {
      const coxa=chama(idx[`coxa_${lado}`],'rotation',0);
      const coxaOp=chama(idx[`coxa_${outro}`],'rotation',0);
      assert.ok(Math.abs(coxa[2]+coxaOp[2])<0.22,`${nome}: espelho da coxa ${lado}/${outro} está fora do limite`);
      const pe=chama(idx[`pe_${lado}`],'rotation',0);
      const peOp=chama(idx[`pe_${outro}`],'rotation',0);
      assert.ok(Math.abs(pe[2]+peOp[2])<0.22,`${nome}: espelho do pé ${lado}/${outro} está fora do limite`);
    }
    const quadril=chama(idx.quadril,'rotation',0);
    assert.ok(Math.abs(quadril[0])<0.4 && Math.abs(quadril[1])<0.4 && Math.abs(quadril[2])<0.7,`${nome}: quadril fora do envelope de postura`);
  }
});

test('rolamento e golpes não podem empurrar uma perna para o lado oposto',async()=> {
  const {criarRig}=await import('../../../src/producao3d/rig.mjs');
  const {criarAnimacoes}=await import('../../../src/producao3d/animacoes.mjs');
  const ossos=criarRig();
  const sim={LUTADORES:{pipoca:{golpes:{cp:{dur:12,janelas:[{de:2,ate:8}]},ck:{dur:12,janelas:[{de:2,ate:8}]},esp:{dur:18,janelas:[{de:4,ate:12}]},sup:{dur:60,janelas:[{de:10,ate:38}]},p1:{dur:10,janelas:[{de:2,ate:7}]},p2:{dur:10,janelas:[{de:2,ate:7}]},k1:{dur:10,janelas:[{de:2,ate:7}]},k2:{dur:10,janelas:[{de:2,ate:7}]}}}}};
  const clips=criarAnimacoes('pipoca',ossos,sim);
  for (const nome of ['rolando','cp','ck','esp','sup']) {
    const clip=clips.find(c=>c.nome===nome);
    assert.ok(clip,`${nome} deve existir`);
    const idxE=ossos.findIndex(o=>o.nome==='coxa_E');
    const idxD=ossos.findIndex(o=>o.nome==='coxa_D');
    const canalE=clip.canais.find(c=>c.osso===idxE&&c.tipo==='rotation');
    const canalD=clip.canais.find(c=>c.osso===idxD&&c.tipo==='rotation');
    assert.ok(canalE && canalD,`${nome} precisa de coxas em rotação`);
    const e=canalE.valores.slice(0,4);
    const d=canalD.valores.slice(0,4);
    assert.ok(Math.abs(e[2]+d[2])<0.08,`${nome}: o espelho da coxa está invertido e empurra a perna para o lado errado`);
  }
});
