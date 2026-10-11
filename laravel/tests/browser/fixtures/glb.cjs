const { deflateSync } = require('node:zlib');

function pngDeTeste() {
  const crc32 = buffer => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (nome, dados) => {
    const buffer = Buffer.alloc(dados.length + 12);
    buffer.writeUInt32BE(dados.length, 0);
    buffer.write(nome, 4, 'ascii'); dados.copy(buffer, 8);
    buffer.writeUInt32BE(crc32(buffer.subarray(4, 8 + dados.length)), 8 + dados.length);
    return buffer;
  };
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(2, 0); cabecalho.writeUInt32BE(2, 4);
  cabecalho[8] = 8; cabecalho[9] = 6;
  const linha = Buffer.from([0, 255, 40, 180, 255, 255, 40, 180, 255]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', cabecalho),
    chunk('IDAT', deflateSync(Buffer.concat([linha, linha]))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Triângulo de teste com um osso, sem qualquer arte de lutador nem recurso externo.
function criarGlbDeTeste(nomes, { textura = false } = {}) {
  const png = textura ? pngDeTeste() : null;
  const bin = Buffer.alloc(png ? 236 + Math.ceil(png.length / 4) * 4 : 212);
  const floats = (valores, offset) => valores.forEach((valor, i) => bin.writeFloatLE(valor, offset + i * 4));
  floats([-.5, 0, 0, .5, 0, 0, 0, 1, 0], 0);
  floats([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 60);
  [0, 1, 2].forEach((valor, i) => bin.writeUInt16LE(valor, 108 + i * 2));
  floats([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 116);
  floats([0, 2], 180);
  floats([0, 0, 0, 0, .1, 0], 188);
  const documento = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1] }],
    nodes: [{ mesh: 0, skin: 0 }, { name: 'osso-teste' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 }, indices: 3 }] }],
    skins: [{ joints: [1], skeleton: 1, inverseBindMatrices: 4 }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [[0, 36], [36, 24], [60, 48], [108, 6], [116, 64], [180, 8], [188, 24]]
      .map(([byteOffset, byteLength]) => ({ buffer: 0, byteOffset, byteLength })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-.5, 0, 0], max: [.5, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
      { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
      { bufferView: 4, componentType: 5126, count: 1, type: 'MAT4' },
      { bufferView: 5, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [2] },
      { bufferView: 6, componentType: 5126, count: 2, type: 'VEC3' },
    ],
    animations: nomes.map(name => ({ name, samplers: [{ input: 5, output: 6, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }] })),
  };
  if (png) {
    floats([0, 0, 1, 0, .5, 1], 212); png.copy(bin, 236);
    documento.bufferViews.push({ buffer: 0, byteOffset: 212, byteLength: 24 }, { buffer: 0, byteOffset: 236, byteLength: png.length });
    documento.accessors.push({ bufferView: 7, componentType: 5126, count: 3, type: 'VEC2' });
    documento.meshes[0].primitives[0].attributes.TEXCOORD_0 = 7;
    documento.meshes[0].primitives[0].material = 0;
    documento.images = [{ bufferView: 8, mimeType: 'image/png' }];
    documento.textures = [{ source: 0 }];
    documento.materials = [{ doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }];
  }
  const jsonBruto = Buffer.from(JSON.stringify(documento));
  const json = Buffer.alloc(Math.ceil(jsonBruto.length / 4) * 4, 0x20);
  jsonBruto.copy(json);
  const glb = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  const offsetBin = 20 + json.length;
  glb.writeUInt32LE(bin.length, offsetBin); glb.writeUInt32LE(0x004e4942, offsetBin + 4); bin.copy(glb, offsetBin + 8);
  return glb;
}

module.exports = { criarGlbDeTeste };
