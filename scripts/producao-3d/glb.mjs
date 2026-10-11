// GLB autocontido: a malha usa posições de repouso no espaço da raiz, sem arquivos externos.
const COMPONENTES = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 };
const TIPOS = { FLOAT: 5126, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125 };
const alinhar = n => Math.ceil(n / 4) * 4;

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function numeros(valores, tamanho, nome) {
  exigir(Array.isArray(valores) || ArrayBuffer.isView(valores), `${nome}: use uma lista numérica.`);
  exigir(valores.length === tamanho, `${nome}: quantidade inválida.`);
  for (const valor of valores) exigir(typeof valor === 'number' && Number.isFinite(Math.fround(valor)), `${nome}: número inválido.`);
}

function copiarJson(valor, nome) {
  try {
    return JSON.parse(JSON.stringify(valor));
  } catch {
    throw new Error(`${nome}: objeto JSON inválido.`);
  }
}

function hierarquia(ossos) {
  exigir(Array.isArray(ossos) && ossos.length > 0 && ossos.length <= 65535, 'Defina entre 1 e 65535 ossos.');
  const nomes = new Set();
  for (const [i, osso] of ossos.entries()) {
    exigir(typeof osso.nome === 'string' && osso.nome.length > 0 && !nomes.has(osso.nome), 'Os ossos precisam de nomes únicos.');
    nomes.add(osso.nome);
    numeros(osso.posicao, 3, `Posição do osso ${osso.nome}`);
    exigir(osso.pai === null || (Number.isInteger(osso.pai) && osso.pai >= 0 && osso.pai < ossos.length && osso.pai !== i), `Pai inválido no osso ${osso.nome}.`);
  }
  const absolutos = [], visitando = new Set();
  function absoluto(i) {
    if (absolutos[i]) return absolutos[i];
    exigir(!visitando.has(i), 'O esqueleto contém um ciclo.');
    visitando.add(i);
    const { pai, posicao } = ossos[i];
    const origem = pai === null ? [0, 0, 0] : absoluto(pai);
    const resultado = posicao.map((p, eixo) => p + origem[eixo]);
    numeros(resultado, 3, `Posição absoluta do osso ${ossos[i].nome}`);
    visitando.delete(i);
    absolutos[i] = resultado;
    return resultado;
  }
  ossos.forEach((_, i) => absoluto(i));
  return absolutos;
}

export function exportarGlb({ nome, primitivas, ossos, clips = [], materiais, extras = {} }) {
  exigir(typeof nome === 'string' && nome.length > 0, 'Defina o nome do modelo.');
  const absolutos = hierarquia(ossos);
  exigir(Array.isArray(primitivas) && primitivas.length > 0, 'Defina pelo menos uma primitiva.');
  exigir(Array.isArray(materiais) && materiais.length > 0, 'Defina os materiais do modelo.');
  exigir(Array.isArray(clips), 'Defina a lista de animações.');
  const documento = {
    asset: { version: '2.0', generator: 'K.O produção 3D local' },
    scene: 0, scenes: [{ name: nome, nodes: [0] }],
    nodes: [
      { name: 'lutador', children: [1] },
      { name: `${nome}-malha`, mesh: 0, skin: 0 },
      ...ossos.map(o => ({ name: o.nome, translation: Array.from(o.posicao) })),
    ],
    meshes: [{ name: nome, primitives: [] }],
    skins: [{ name: `${nome}-esqueleto`, joints: ossos.map((_, i) => i + 2) }],
    materials: copiarJson(materiais, 'Materiais'),
    accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }],
    extras: copiarJson(extras, 'Metadados'),
  };
  const raizes = [];
  ossos.forEach((osso, i) => {
    if (osso.pai === null) { documento.nodes[0].children.push(i + 2); raizes.push(i + 2); }
    else (documento.nodes[osso.pai + 2].children ||= []).push(i + 2);
  });
  documento.skins[0].skeleton = raizes.length === 1 ? raizes[0] : 0;
  const partes = [];
  let comprimentoBin = 0;
  function accessor(valores, tipo, componente, { limites = false, target } = {}) {
    const tamanhoComponente = componente === TIPOS.UNSIGNED_SHORT ? 2 : 4;
    const bytes = Buffer.alloc(alinhar(valores.length * tamanhoComponente));
    for (let i = 0; i < valores.length; i++) {
      const offset = i * tamanhoComponente;
      if (componente === TIPOS.FLOAT) bytes.writeFloatLE(valores[i], offset);
      else if (componente === TIPOS.UNSIGNED_SHORT) bytes.writeUInt16LE(valores[i], offset);
      else bytes.writeUInt32LE(valores[i], offset);
    }
    const view = { buffer: 0, byteOffset: comprimentoBin, byteLength: valores.length * tamanhoComponente };
    if (target) view.target = target;
    const item = { bufferView: documento.bufferViews.length, componentType: componente, count: valores.length / COMPONENTES[tipo], type: tipo };
    if (limites) {
      item.min = Array(COMPONENTES[tipo]).fill(Infinity);
      item.max = Array(COMPONENTES[tipo]).fill(-Infinity);
      valores.forEach((v, i) => {
        const eixo = i % COMPONENTES[tipo];
        const valor = componente === TIPOS.FLOAT ? Math.fround(v) : v;
        item.min[eixo] = Math.min(item.min[eixo], valor);
        item.max[eixo] = Math.max(item.max[eixo], valor);
      });
    }
    documento.bufferViews.push(view);
    documento.accessors.push(item);
    partes.push(bytes); comprimentoBin += bytes.length;
    return documento.accessors.length - 1;
  }
  for (const [i, primitiva] of primitivas.entries()) {
    const vertices = primitiva.posicoes?.length / 3;
    exigir(Number.isInteger(vertices) && vertices > 0, `Primitiva ${i}: posições inválidas.`);
    numeros(primitiva.posicoes, vertices * 3, `Primitiva ${i}: posições`);
    numeros(primitiva.normais, vertices * 3, `Primitiva ${i}: normais`);
    numeros(primitiva.juntas, vertices * 4, `Primitiva ${i}: juntas`);
    numeros(primitiva.pesos, vertices * 4, `Primitiva ${i}: pesos`);
    exigir(Number.isInteger(primitiva.material) && primitiva.material >= 0 && primitiva.material < materiais.length, `Primitiva ${i}: material inválido.`);
    for (let v = 0; v < vertices; v++) {
      const normal = Math.hypot(...primitiva.normais.slice(v * 3, v * 3 + 3));
      exigir(Math.abs(normal - 1) < 0.002, `Primitiva ${i}: normal não unitária.`);
      let peso = 0;
      for (let j = 0; j < 4; j++) {
        const junta = primitiva.juntas[v * 4 + j], valor = primitiva.pesos[v * 4 + j];
        exigir(Number.isInteger(junta) && junta >= 0 && junta < ossos.length, `Primitiva ${i}: junta fora do esqueleto.`);
        exigir(valor >= 0 && valor <= 1, `Primitiva ${i}: peso inválido.`);
        peso += valor;
      }
      exigir(Math.abs(peso - 1) < 0.0001, `Primitiva ${i}: os pesos precisam somar 1.`);
    }
    const indices = primitiva.indices;
    exigir((Array.isArray(indices) || ArrayBuffer.isView(indices)) && indices.length > 0 && indices.length % 3 === 0, `Primitiva ${i}: defina triângulos completos.`);
    let maiorIndice = 0;
    for (const indice of indices) {
      exigir(Number.isInteger(indice) && indice >= 0 && indice < vertices, `Primitiva ${i}: índice fora da malha.`);
      maiorIndice = Math.max(maiorIndice, indice);
    }
    const attributes = {
      POSITION: accessor(primitiva.posicoes, 'VEC3', TIPOS.FLOAT, { limites: true, target: 34962 }),
      NORMAL: accessor(primitiva.normais, 'VEC3', TIPOS.FLOAT, { target: 34962 }),
      JOINTS_0: accessor(primitiva.juntas, 'VEC4', TIPOS.UNSIGNED_SHORT, { target: 34962 }),
      WEIGHTS_0: accessor(primitiva.pesos, 'VEC4', TIPOS.FLOAT, { target: 34962 }),
    };
    documento.meshes[0].primitives.push({
      attributes, indices: accessor(indices, 'SCALAR', maiorIndice <= 65535 ? TIPOS.UNSIGNED_SHORT : TIPOS.UNSIGNED_INT, { limites: true, target: 34963 }),
      material: primitiva.material, mode: 4,
    });
  }
  const matrizes = absolutos.flatMap(([x, y, z]) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
  documento.skins[0].inverseBindMatrices = accessor(matrizes, 'MAT4', TIPOS.FLOAT);
  const nomesClips = new Set();
  for (const clip of clips) {
    exigir(typeof clip.nome === 'string' && clip.nome.length > 0 && !nomesClips.has(clip.nome), 'As animações precisam de nomes únicos.');
    nomesClips.add(clip.nome);
    exigir(Array.isArray(clip.canais) && clip.canais.length > 0, `Animação ${clip.nome}: defina os canais.`);
    if (clip.duracaoQuadros !== undefined) exigir(Number.isInteger(clip.duracaoQuadros) && clip.duracaoQuadros > 0, `Animação ${clip.nome}: duração inválida.`);
    const animation = { name: clip.nome, samplers: [], channels: [] };
    if (clip.duracaoQuadros !== undefined) animation.extras = { duracaoQuadros: clip.duracaoQuadros };
    const alvos = new Set();
    for (const canal of clip.canais) {
      exigir(Number.isInteger(canal.osso) && canal.osso >= 0 && canal.osso < ossos.length, `Animação ${clip.nome}: osso inválido.`);
      exigir(['rotation', 'translation'].includes(canal.tipo), `Animação ${clip.nome}: canal inválido.`);
      const alvo = `${canal.osso}:${canal.tipo}`;
      exigir(!alvos.has(alvo), `Animação ${clip.nome}: canal repetido.`); alvos.add(alvo);
      const quantidade = canal.tempos?.length;
      exigir(Number.isInteger(quantidade) && quantidade >= 2, `Animação ${clip.nome}: defina ao menos dois quadros.`);
      numeros(canal.tempos, quantidade, `Animação ${clip.nome}: tempos`);
      const componentes = canal.tipo === 'rotation' ? 4 : 3;
      numeros(canal.valores, quantidade * componentes, `Animação ${clip.nome}: valores`);
      for (let t = 0; t < quantidade; t++) {
        const tempo = Math.fround(canal.tempos[t]);
        exigir(tempo >= 0 && (t === 0 || tempo > Math.fround(canal.tempos[t - 1])), `Animação ${clip.nome}: tempos precisam aumentar.`);
        if (componentes === 4) exigir(Math.abs(Math.hypot(...canal.valores.slice(t * 4, t * 4 + 4)) - 1) < 0.002, `Animação ${clip.nome}: quaternion não unitário.`);
      }
      animation.channels.push({ sampler: animation.samplers.length, target: { node: canal.osso + 2, path: canal.tipo } });
      animation.samplers.push({
        input: accessor(canal.tempos, 'SCALAR', TIPOS.FLOAT, { limites: true }),
        output: accessor(canal.valores, componentes === 4 ? 'VEC4' : 'VEC3', TIPOS.FLOAT),
        interpolation: 'LINEAR',
      });
    }
    (documento.animations ||= []).push(animation);
  }
  documento.buffers[0].byteLength = comprimentoBin;
  const jsonBruto = Buffer.from(JSON.stringify(documento), 'utf8');
  const json = Buffer.alloc(alinhar(jsonBruto.length), 0x20); jsonBruto.copy(json);
  const tamanho = 12 + 8 + json.length + 8 + comprimentoBin;
  exigir(tamanho <= 24 * 1024 * 1024, 'O GLB ultrapassa o limite de 24 MB do laboratório.');
  const glb = Buffer.alloc(tamanho);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(tamanho, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  const inicioBin = 20 + json.length;
  glb.writeUInt32LE(comprimentoBin, inicioBin); glb.writeUInt32LE(0x004e4942, inicioBin + 4);
  Buffer.concat(partes, comprimentoBin).copy(glb, inicioBin + 8);
  return glb;
}
