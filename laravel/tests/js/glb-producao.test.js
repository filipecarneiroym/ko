const { test } = require('node:test');
const assert = require('node:assert/strict');
const modulos = Promise.all([
  import('../../../scripts/producao-3d/glb.mjs'),
  import('../../../src/3d/contrato-glb.mjs'),
  import('../../../src/3d/estado-visual.mjs'),
]);
const K = require('../../../public/js/ko-sim.js');

function modelo() {
  return {
    nome: 'Modelo de teste',
    primitivas: [{
      posicoes: [2, 3, 0, 3, 3, 0, 2, 4, 0], normais: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2], juntas: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      pesos: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], material: 0,
    }],
    ossos: [{ nome: 'quadril', pai: null, posicao: [2, 0, 0] }, { nome: 'mão', pai: 0, posicao: [0, 3, 0] }],
    clips: [{ nome: 'parado', duracaoQuadros: 60, canais: [{ osso: 1, tipo: 'translation', tempos: [0, 1], valores: [0, 3, 0, 0, 3.1, 0] }] }],
    materiais: [{ name: 'Vermelho', pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    extras: { etapa: 'blockout', final: false },
  };
}

function abrirGlb(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  const tamanhoJson = buffer.readUInt32LE(12), inicioBin = 20 + tamanhoJson;
  const doc = JSON.parse(buffer.toString('utf8', 20, inicioBin));
  assert.equal(buffer.readUInt32LE(inicioBin + 4), 0x004e4942);
  const bin = buffer.subarray(inicioBin + 8);
  assert.equal(buffer.readUInt32LE(inicioBin), bin.length);
  assert.equal(doc.buffers[0].byteLength, bin.length);
  assert.equal(buffer.length % 4, 0);
  function ler(index) {
    const a = doc.accessors[index], v = doc.bufferViews[a.bufferView];
    const componentes = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const bytes = a.componentType === 5123 ? 2 : 4;
    return Array.from({ length: a.count * componentes }, (_, i) => {
      const offset = v.byteOffset + (a.byteOffset || 0) + i * bytes;
      return a.componentType === 5126 ? bin.readFloatLE(offset) : bytes === 2 ? bin.readUInt16LE(offset) : bin.readUInt32LE(offset);
    });
  }
  return { doc, bin, ler };
}

test('GLB produzido contém dados binários alinhados, limites exatos e materiais incorporados', async () => {
  const [{ exportarGlb }] = await modulos;
  const { doc, bin, ler } = abrirGlb(exportarGlb(modelo()));
  for (const view of doc.bufferViews) {
    assert.equal(view.byteOffset % 4, 0);
    assert.ok(view.byteOffset + view.byteLength <= bin.length);
  }
  const p = doc.meshes[0].primitives[0];
  assert.deepEqual(ler(p.attributes.POSITION), modelo().primitivas[0].posicoes);
  assert.deepEqual(doc.accessors[p.attributes.POSITION].min, [2, 3, 0]);
  assert.deepEqual(doc.accessors[p.attributes.POSITION].max, [3, 4, 0]);
  assert.deepEqual(ler(p.indices), [0, 1, 2]);
  assert.equal(doc.accessors[p.indices].componentType, 5123);
  assert.deepEqual(doc.materials, modelo().materiais);
  assert.equal(doc.extras.final, false);
  assert.equal(doc.buffers[0].uri, undefined);
});

test('inverse bind preserva os vértices no repouso, inclusive com pai deslocado', async () => {
  const [{ exportarGlb }] = await modulos;
  const { doc, ler } = abrirGlb(exportarGlb(modelo()));
  const inversas = ler(doc.skins[0].inverseBindMatrices);
  const p = doc.meshes[0].primitives[0], posicoes = ler(p.attributes.POSITION);
  const juntas = ler(p.attributes.JOINTS_0), pesos = ler(p.attributes.WEIGHTS_0);
  for (let v = 0; v < posicoes.length / 3; v++) {
    const origem = posicoes.slice(v * 3, v * 3 + 3), resultado = [0, 0, 0];
    for (let j = 0; j < 4; j++) {
      const osso = juntas[v * 4 + j], peso = pesos[v * 4 + j];
      const no = doc.nodes[doc.skins[0].joints[osso]];
      const pai = osso === 1 ? doc.nodes[doc.skins[0].joints[0]].translation : [0, 0, 0];
      const absoluto = no.translation.map((n, i) => n + pai[i]);
      for (let eixo = 0; eixo < 3; eixo++) resultado[eixo] += peso * (origem[eixo] + inversas[osso * 16 + 12 + eixo] + absoluto[eixo]);
    }
    assert.deepEqual(resultado, origem, 'a pose de repouso não deve deslocar a malha');
  }
  assert.deepEqual(doc.nodes[0].children, [1, 2]);
  assert.equal(doc.nodes[1].skin, 0);
  assert.deepEqual(doc.nodes[2].children, [3]);
});

test('exportação completa passa pelo contrato real de animações do laboratório', async () => {
  const [{ exportarGlb }, { validarGlb }, { ESTADOS_VISUAIS }] = await modulos;
  const dados = modelo();
  dados.clips = [...ESTADOS_VISUAIS, ...Object.keys(K.LUTADORES.pipoca.golpes)].map(nome => ({ ...dados.clips[0], nome }));
  const arquivo = exportarGlb(dados);
  const doc = validarGlb(arquivo.buffer.slice(arquivo.byteOffset, arquivo.byteOffset + arquivo.length), 'pipoca', K);
  assert.equal(doc.animations.length, dados.clips.length);
  const { ler } = abrirGlb(arquivo), clip = doc.animations.find(c => c.name === 'p1');
  assert.deepEqual(ler(clip.samplers[0].input), [0, 1]);
  assert.equal(clip.channels[0].target.node, doc.skins[0].joints[1]);
  assert.equal(clip.channels[0].target.path, 'translation');
});

test('exportação recusa corrupção de geometria, pesos, hierarquia e animação', async () => {
  const [{ exportarGlb }] = await modulos;
  const casos = [
    [d => { d.primitivas[0].indices[2] = 3; }, /índice fora/],
    [d => { d.primitivas[0].pesos[0] = 0.5; }, /somar 1/],
    [d => { d.primitivas[0].juntas[0] = 2; }, /junta fora/],
    [d => { d.primitivas[0].normais[0] = NaN; }, /número inválido/],
    [d => { d.ossos[0].pai = 1; }, /ciclo/],
    [d => { d.clips[0].canais[0].tempos = [0.5, 0.5]; }, /tempos precisam aumentar/],
    [d => { d.clips[0].canais.push(d.clips[0].canais[0]); }, /canal repetido/],
    [d => { d.clips[0].canais[0].tipo = 'rotation'; d.clips[0].canais[0].valores = Array(8).fill(0); }, /quaternion/],
  ];
  for (const [corromper, esperado] of casos) {
    const dados = modelo(); corromper(dados);
    assert.throws(() => exportarGlb(dados), esperado);
  }
});

test('malhas maiores que 65535 índices usam inteiros de 32 bits sem truncar', async () => {
  const [{ exportarGlb }] = await modulos;
  const dados = modelo(), p = dados.primitivas[0];
  const quantidade = 65537;
  p.posicoes = Array(quantidade * 3).fill(0); p.normais = [];
  p.juntas = []; p.pesos = [];
  for (let i = 0; i < quantidade; i++) { p.normais.push(0, 0, 1); p.juntas.push(0, 0, 0, 0); p.pesos.push(1, 0, 0, 0); }
  p.indices = [0, 65535, 65536];
  const { doc, ler } = abrirGlb(exportarGlb(dados));
  const indice = doc.meshes[0].primitives[0].indices;
  assert.equal(doc.accessors[indice].componentType, 5125);
  assert.deepEqual(ler(indice), [0, 65535, 65536]);
});
