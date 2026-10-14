const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('../../../src/3d/contrato-glb.mjs'),
  import('../../../scripts/producao-3d/auditar-pipoca.mjs'),
  import('@babylonjs/core/Maths/math.vector.js'),
]);

// Lê a geometria exportada: o teste não regenera nem modifica o modelo.
// O leitor segue o de glb-producao.test.js, incluindo o stride do accessor.
function lerAccessor(bytes, doc, indice) {
  const a = doc.accessors[indice], vista = doc.bufferViews[a.bufferView];
  const componentes = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const tamanho = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  assert.ok(componentes && tamanho && !a.sparse, 'Accessor sem compressão dentro do contrato');
  const inicioBin = 28 + bytes.readUInt32LE(12);
  const inicio = inicioBin + (vista.byteOffset || 0) + (a.byteOffset || 0);
  const stride = vista.byteStride || componentes * tamanho;
  const ler = { 5121: 'readUInt8', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[a.componentType];
  return Array.from({ length: a.count * componentes }, (_, i) =>
    bytes[ler](inicio + Math.floor(i / componentes) * stride + i % componentes * tamanho));
}

async function carregar(variante) {
  const [{ validarGlb }, { extrairClipsPipoca }, matematica] = await modulos;
  const bytes = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${variante}.glb`));
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K);
  const clips = new Map(extrairClipsPipoca(bytes, doc).map(clip => [clip.nome, clip]));
  const juntas = doc.skins[0].joints;
  const pais = juntas.map(indice => juntas.findIndex(pai => doc.nodes[pai].children?.includes(indice)));
  const inversas = lerAccessor(bytes, doc, doc.skins[0].inverseBindMatrices);
  const { Matrix, Vector3 } = matematica;
  const malhas = doc.meshes.flatMap(m => m.primitives).map(primitiva => {
    const posicoes = lerAccessor(bytes, doc, primitiva.attributes.POSITION);
    const indices = lerAccessor(bytes, doc, primitiva.attributes.JOINTS_0);
    const pesos = lerAccessor(bytes, doc, primitiva.attributes.WEIGHTS_0);
    const locais = new Float64Array(pesos.length * 3);
    const ibm = juntas.map((_, i) => Matrix.FromArray(inversas, i * 16));
    for (let v = 0; v < posicoes.length / 3; v++) for (let k = 0; k < 4; k++) {
      const j = v * 4 + k;
      if (!pesos[j]) continue;
      const local = Vector3.TransformCoordinates(Vector3.FromArray(posicoes, v * 3), ibm[indices[j]]);
      locais.set(local.asArray(), j * 3);
    }
    return { indices, pesos, locais, vertices: posicoes.length / 3 };
  });
  return { doc, clips, juntas, pais, malhas, ...matematica };
}

const modelos = Object.fromEntries(['azul', 'vermelha'].map(v => [v, carregar(v)]));

function amostrar(canal, quadro, modelo) {
  const tempo = quadro / 60, ultimo = canal.tempos.length - 1;
  let i = 0;
  while (i < ultimo && canal.tempos[i + 1] <= tempo) i++;
  const j = Math.min(i + 1, ultimo);
  const t = j === i ? 0 : Math.max(0, Math.min(1, (tempo - canal.tempos[i]) / (canal.tempos[j] - canal.tempos[i])));
  if (canal.tipo === 'rotation') {
    return modelo.Quaternion.Slerp(modelo.Quaternion.FromArray(canal.valores, i * 4),
      modelo.Quaternion.FromArray(canal.valores, j * 4), t);
  }
  return modelo.Vector3.Lerp(modelo.Vector3.FromArray(canal.valores, i * 3),
    modelo.Vector3.FromArray(canal.valores, j * 3), t);
}

function pose(modelo, nome, quadro) {
  const clip = modelo.clips.get(nome);
  assert.ok(clip, `Clipe ${nome} presente`);
  const matrizes = [];
  for (let i = 0; i < modelo.juntas.length; i++) {
    const no = modelo.doc.nodes[modelo.juntas[i]];
    const canal = tipo => clip.canais.find(c => c.osso === i && c.tipo === tipo);
    const translacao = canal('translation') ? amostrar(canal('translation'), quadro, modelo)
      : modelo.Vector3.FromArray(no.translation || [0, 0, 0]);
    const rotacao = canal('rotation') ? amostrar(canal('rotation'), quadro, modelo)
      : modelo.Quaternion.FromArray(no.rotation || [0, 0, 0, 1]);
    const escala = canal('scale') ? amostrar(canal('scale'), quadro, modelo)
      : modelo.Vector3.FromArray(no.scale || [1, 1, 1]);
    const local = modelo.Matrix.Compose(escala, rotacao, translacao);
    const pai = modelo.pais[i];
    assert.ok(pai < i, 'Hierarquia de ossos em ordem de composição');
    matrizes.push(pai < 0 ? local : local.multiply(matrizes[pai]));
  }
  return matrizes;
}

function vertice(malha, matrizes, v) {
  const resultado = [0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const j = v * 4 + k, peso = malha.pesos[j];
    if (!peso) continue;
    const m = matrizes[malha.indices[j]].m;
    const x = malha.locais[j * 3], y = malha.locais[j * 3 + 1], z = malha.locais[j * 3 + 2];
    for (let eixo = 0; eixo < 3; eixo++)
      resultado[eixo] += peso * (x * m[eixo] + y * m[4 + eixo] + z * m[8 + eixo] + m[12 + eixo]);
  }
  return resultado;
}

function compararEmenda(modelo, antes, depois) {
  let maiorOsso = 0, maiorVertice = 0;
  for (let i = 0; i < antes.length; i++) maiorOsso = Math.max(maiorOsso,
    Math.hypot(...[12, 13, 14].map(k => depois[i].m[k] - antes[i].m[k])));
  for (const malha of modelo.malhas) for (let v = 0; v < malha.vertices; v++) {
    const a = vertice(malha, antes, v), b = vertice(malha, depois, v);
    maiorVertice = Math.max(maiorVertice, Math.hypot(...a.map((valor, eixo) => b[eixo] - valor)));
  }
  return { maiorOsso, maiorVertice };
}

for (const variante of ['azul', 'vermelha']) {
  test(`recuperação v5 ${variante} preserva os 31 clipes de base e o dp, 20 ossos e durações da regra`, async () => {
    const modelo = await modelos[variante];
    assert.equal(modelo.doc.animations.length, 32);
    assert.equal(modelo.doc.skins[0].joints.length, 20);
    for (const [nome, duracao] of [['caido', 46], ['levantando', 16]]) {
      const clip = modelo.clips.get(nome);
      assert.equal(clip.duracaoQuadros, duracao, `${nome} preserva duração da regra`);
      for (const canal of clip.canais) {
        assert.ok(canal.tempos.length >= duracao + 1, `${nome}: ao menos uma amostra a cada passo`);
        for (let i = 1; i < canal.tempos.length; i++)
          assert.ok(canal.tempos[i] - canal.tempos[i - 1] <= 1 / 60 + 1e-6, `${nome}: intervalo não excede um passo`);
        assert.ok(Math.abs(canal.tempos.at(-1) * 60 - duracao) < 1e-4);
      }
    }
  });

  test(`recuperação v5 ${variante} emenda os últimos quadros visíveis sem estalo`, async t => {
    const modelo = await modelos[variante];
    // O motor muda de estado ao atingir 46/16: os últimos quadros desenhados
    // são 45 e 15. Comparar somente os finais 46/16 esconderia o defeito.
    for (const [antes, q, depois] of [['caido', 45, 'levantando'], ['levantando', 15, 'parado']]) {
      const erro = compararEmenda(modelo, pose(modelo, antes, q), pose(modelo, depois, 0));
      t.diagnostic(JSON.stringify({ variante, antes, quadro: q, depois, ...erro }));
      assert.ok(erro.maiorOsso < .001, `${antes}${q} → ${depois}0: nó salta ${(erro.maiorOsso * 100).toFixed(2)} cm`);
      assert.ok(erro.maiorVertice < .001, `${antes}${q} → ${depois}0: malha salta ${(erro.maiorVertice * 100).toFixed(2)} cm`);
    }
  });

  test(`recuperação v5 ${variante} mantém pele e orelhas acima do piso entre quadros`, async t => {
    const modelo = await modelos[variante];
    let menorY = Infinity, pior = null, menorYInteiro = Infinity, piorInteiro = null;
    // Inclui cada chave exportada e o meio de seu intervalo LINEAR/Slerp,
    // independentemente da frequência de amostragem escolhida pelo gerador.
    // Todos os vértices são medidos, incluindo as pontas das orelhas.
    for (const nome of ['caido', 'levantando']) {
      const chaves = modelo.clips.get(nome).canais.find(c => c.osso === 0 && c.tipo === 'translation').tempos;
      const quadros = chaves.flatMap((tempo, i) => i === chaves.length - 1
        ? [tempo * 60] : [tempo * 60, (tempo + chaves[i + 1]) * 30]);
      for (const q of quadros) {
        const matrizes = pose(modelo, nome, q);
        for (const malha of modelo.malhas) for (let v = 0; v < malha.vertices; v++) {
          const y = vertice(malha, matrizes, v)[1];
          if (y < menorY) { menorY = y; pior = { nome, quadro: q, vertice: v }; }
          if (Math.abs(q - Math.round(q)) < 1e-4 && y < menorYInteiro) {
            menorYInteiro = y; piorInteiro = { nome, quadro: q, vertice: v };
          }
        }
      }
    }
    t.diagnostic(JSON.stringify({ variante, menorY, ...pior, inteiro: { menorY: menorYInteiro, ...piorInteiro } }));
    assert.ok(menorY >= -.005, `${variante}: malha penetra ${(-menorY * 1000).toFixed(2)} mm no piso (${pior.nome}, quadro ${pior.quadro})`);
  });
}
