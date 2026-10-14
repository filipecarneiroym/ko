const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([import('../../../src/3d/estado-visual.mjs'), import('../../../src/3d/contrato-glb.mjs')]);

function glb(doc) {
  const json = Buffer.from(JSON.stringify(doc));
  const tamanho = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(20 + tamanho, 0x20);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(tamanho, 12); bytes.writeUInt32LE(0x4e4f534a, 16); json.copy(bytes, 20);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
}
test('renderização lê quadros e posições sem modificar a simulação', async () => {
  const [{ descreverPose, quadroDoClip }] = await modulos;
  const s = K.novo({ lutadores: ['pipoca', 'uivo'] });
  s.p[0].estado = 'golpe'; s.p[0].golpe = 'p1'; s.p[0].t = 4; s.hitstop = 5;
  const original = JSON.stringify(s);
  const grupo = { from: 0, to: 12, targetedAnimations: [{ animation: { framePerSecond: 60 } }] };
  for (let i = 0; i < 100; i++) {
    const pose = descreverPose(s.p[0], K);
    assert.equal(pose.clip, 'p1'); assert.equal(quadroDoClip(pose, grupo), 4);
    assert.equal(pose.duracao, K.LUTADORES.pipoca.golpes.p1.dur);
  }
  assert.equal(JSON.stringify(s), original);
  K.passo(s, [0, 0]);
  assert.equal(quadroDoClip(descreverPose(s.p[0], K), grupo), 4, 'hitstop mantém pose');
});
test('animações cíclicas repetem; ataques param no último quadro e respeitam FPS do clip', async () => {
  const [{ quadroDoClip }] = await modulos;
  const g = { from: 10, to: 40, targetedAnimations: [{ animation: { framePerSecond: 30 } }] };
  assert.equal(quadroDoClip({ quadro: 70, ciclico: true }, g), 15);
  assert.equal(quadroDoClip({ quadro: 70, ciclico: false }, g), 40);
});
test('encenação final usa relógio da fase mesmo quando o lutador não avança t', async () => {
  const [{ descreverPose }] = await modulos;
  const s = K.novo({ lutadores: ['pipoca', 'uivo'] });
  s.fase = 'final'; s.fT = 55; s.p[0].estado = 'final'; s.p[0].t = 0;
  assert.equal(descreverPose(s.p[0], K, s).quadro, 55);
  s.p[1].estado = 'vitimaFinal';
  assert.equal(descreverPose(s.p[1], K, s).quadro, 55);
});
test('importação exige GLB com rig, todos os estados e recursos incorporados', async () => {
  const [{ ESTADOS_VISUAIS }, { validarGlb }] = await modulos;
  const doc = { asset: { version: '2.0' }, skins: [{}], meshes: [{}], animations: [...ESTADOS_VISUAIS, ...Object.keys(K.LUTADORES.pipoca.golpes)].map(name => ({ name })) };
  assert.equal(validarGlb(glb(doc), 'pipoca', K).asset.version, '2.0');
  assert.throws(() => validarGlb(new ArrayBuffer(16), 'pipoca', K), /GLB/);
  assert.throws(() => validarGlb(glb({ ...doc, skins: [] }), 'pipoca', K), /esqueleto/);
  assert.throws(() => validarGlb(glb({ ...doc, animations: [] }), 'pipoca', K), /Animações ausentes/);
  assert.throws(() => validarGlb(glb({ ...doc, images: [{ uri: 'https://externo.test/a.png' }] }), 'pipoca', K), /Incorpore/);
  assert.throws(() => validarGlb(glb({ ...doc, extensionsRequired: ['KHR_draco_mesh_compression'] }), 'pipoca', K), /extensões/);
  assert.throws(() => validarGlb(glb({ ...doc, animations: [...doc.animations, doc.animations[0]] }), 'pipoca', K), /únicos/);
});

test('mortal no pulo e chutes sem uma volta artificial antes do contato', async () => {
  const [{ descreverPose }] = await modulos;
  const pulo = K.LUTADORES.pipoca.pulo;
  const base = { id: 'pipoca', x: 0, y: 40, face: 1, t: 3, sumido: 0 };
  const frente = descreverPose({ ...base, estado: 'pulo', vx: 50, vy: 0 }, K);
  const tras = descreverPose({ ...base, estado: 'pulo', vx: -50, vy: 0 }, K);
  assert.ok(frente.mortal < -1 && tras.mortal > 1, 'gira para lados opostos no meio do pulo');
  assert.equal(descreverPose({ ...base, estado: 'pulo', vx: 0, vy: 0 }, K).mortal, 0, 'pulo parado não gira');
  assert.ok(Math.abs(descreverPose({ ...base, estado: 'pulo', vx: 50, vy: -pulo }, K).mortal + Math.PI * 2) < 1e-9, 'pousa de pé (volta completa)');
  for (const golpe of ['k1', 'k2', 'ck', 'ak', 'tatsu', 'tatsuEx'])
    for (let t = 0; t <= K.LUTADORES.pipoca.golpes[golpe].dur; t++)
      assert.equal(descreverPose({ ...base, y: 0, estado: 'golpe', golpe, t, vx: 0, vy: 0 }, K).volta, 0,
        'giro autoral do clipe sem volta extra da raiz');
});
