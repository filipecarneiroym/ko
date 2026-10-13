const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deflateSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const modulo=import('../../../scripts/producao-3d/glb.mjs');

function modelo() {
  return {nome:'UV opcional',ossos:[{nome:'raiz',pai:null,posicao:[0,0,0]}],clips:[],
    primitivas:[{posicoes:[0,0,0,1,0,0,0,1,0],normais:[0,0,1,0,0,1,0,0,1],indices:[0,1,2],
      juntas:[0,0,0,0,0,0,0,0,0,0,0,0],pesos:[1,0,0,0,1,0,0,0,1,0,0,0],material:0}],
    materiais:[{name:'tinta',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.8}}],extras:{final:false}};
}
function chunk(tipo,dados) {
  const nome=Buffer.from(tipo),corpo=Buffer.concat([nome,dados]);let crc=0xffffffff;
  for(const byte of corpo){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  const b=Buffer.alloc(dados.length+12);b.writeUInt32BE(dados.length);corpo.copy(b,4);b.writeUInt32BE((crc^0xffffffff)>>>0,b.length-4);return b;
}
function png({largura=2,altura=1,pixels=Buffer.from([0,255,0,0,255,0,0,255,255]),idat}={}) {
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(largura);ihdr.writeUInt32BE(altura,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',idat??deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
function texturizado() {
  const d=modelo();d.primitivas[0].uvs=[0,0,1,0,0,1];
  d.imagens=[{name:'duas cores',mimeType:'image/png',dados:png()}];d.texturas=[{source:0,sampler:0}];
  d.samplers=[{magFilter:9729,minFilter:9729,wrapS:33071,wrapT:33071}];
  d.materiais[0].pbrMetallicRoughness.baseColorTexture={index:0};return d;
}
function abrir(bytes) {
  const jsonFim=20+bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,jsonFim)),bin=bytes.subarray(jsonFim+8);
  assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(doc.buffers[0].byteLength,bin.length);
  return {doc,bin};
}

test('UV opcional produz VEC2 float e incorpora PNG exato em bufferView alinhado',async()=> {
  const {exportarGlb}=await modulo,d=texturizado(),antes=structuredClone(d),{doc,bin}=abrir(exportarGlb(d));
  antes.imagens[0].dados=Buffer.from(antes.imagens[0].dados);
  assert.deepEqual(d,antes,'Exportação não altera o modelo de entrada');
  const p=doc.meshes[0].primitives[0],uv=doc.accessors[p.attributes.TEXCOORD_0],view=doc.bufferViews[uv.bufferView];
  assert.equal(uv.type,'VEC2');assert.equal(uv.componentType,5126);assert.equal(uv.count,3);
  assert.deepEqual(Array.from({length:6},(_,i)=>bin.readFloatLE(view.byteOffset+i*4)),d.primitivas[0].uvs);
  for(const v of doc.bufferViews){assert.equal(v.byteOffset%4,0);assert.ok(v.byteOffset+v.byteLength<=bin.length);}
  const imagem=doc.images[0],pngView=doc.bufferViews[imagem.bufferView];
  assert.equal(imagem.mimeType,'image/png');assert.equal(imagem.uri,undefined);assert.equal(pngView.target,undefined);
  assert.deepEqual(bin.subarray(pngView.byteOffset,pngView.byteOffset+pngView.byteLength),d.imagens[0].dados);
  assert.deepEqual(doc.textures,d.texturas);assert.deepEqual(doc.samplers,d.samplers);
  assert.deepEqual(doc.materials[0].pbrMetallicRoughness.baseColorTexture,{index:0});
});

test('exportação sem textura preserva o formato legado e listas opcionais vazias não mudam bytes',async()=> {
  const {exportarGlb}=await modulo,d=modelo(),bytes=exportarGlb(d),{doc}=abrir(bytes);
  assert.deepEqual(bytes,exportarGlb({...d,imagens:[],texturas:[],samplers:[]}));
  assert.equal(doc.images,undefined);assert.equal(doc.textures,undefined);assert.equal(doc.samplers,undefined);
  assert.equal(doc.meshes[0].primitives[0].attributes.TEXCOORD_0,undefined);
  // Fixture binária comparada também ao exportador anterior à inclusão de UV/PNG.
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'c50767450129e8d5a1dca50f991845dd2c2d6a7eccdd858e48b1f3f092a74e6c');
});

test('UVs e referências de materiais, imagens e samplers inválidos são recusados',async()=> {
  const {exportarGlb}=await modulo;
  const casos=[
    [d=>{d.primitivas[0].uvs.pop();},/UVs: quantidade/],
    [d=>{d.primitivas[0].uvs[0]=NaN;},/UVs: número/],
    [d=>{d.primitivas[0].uvs[0]=Infinity;},/UVs: número/],
    [d=>{delete d.primitivas[0].uvs;},/exige TEXCOORD_0/],
    [d=>{d.texturas[0].source=1;},/source inválida/],
    [d=>{d.texturas[0].sampler=1;},/sampler inválido/],
    [d=>{d.samplers[0].wrapS=0;},/wrapS inválido/],
    [d=>{d.materiais[0].pbrMetallicRoughness.baseColorTexture.index=1;},/índice de textura/],
    [d=>{d.materiais[0].normalTexture={index:0,texCoord:1};},/somente TEXCOORD_0/],
    [d=>{d.imagens[0].uri='fora.png';},/sem URI/],
    [d=>{d.texturas[0].uri='fora.png';},/URI externa/],
  ];
  for(const [corromper,erro]of casos){const d=texturizado();corromper(d);assert.throws(()=>exportarGlb(d),erro);}
});

test('PNG corrompido, pixels inválidos e resolução excessiva não são incorporados',async()=> {
  const {exportarGlb}=await modulo;
  const casos=[
    [()=>{const b=png();b[0]=0;return b;},/assinatura/],
    [()=>{const b=png();b[29]^=1;return b;},/CRC/],
    [()=>png({largura:2049}),/resolução máxima/],
    [()=>png({idat:Buffer.from([0,1,2,3])}),/IDAT comprimido/],
    [()=>png({pixels:Buffer.from([0,255])}),/quantidade de pixels/],
    [()=>png({pixels:Buffer.from([5,255,0,0,255,0,0,255,255])}),/filtro de linha/],
    [()=>Buffer.concat([png(),Buffer.from([0])]),/bytes extras/],
    [()=>png().subarray(0,-2),/IDAT\/IEND|truncado/],
  ];
  for(const [corromper,erro]of casos){const d=texturizado();d.imagens[0].dados=corromper();assert.throws(()=>exportarGlb(d),erro);}
});
