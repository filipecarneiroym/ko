const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const bytes = () => fs.readFileSync(path.resolve(__dirname, '../../../public/modelos/estudos/pipoca-direcao-visual-v13.glb'));

test('auditoria deriva integração dos31clips por canais FLOAT reais, sem aprovar arte pelos nomes', async () => {
  const { auditarPipoca } = await import('../../../scripts/producao-3d/auditar-pipoca.mjs');
  const r = auditarPipoca(bytes());
  assert.equal(r.total, 31); assert.equal(r.aprovadoFinal, false);
  assert.equal(r.integrados.length + r.genericos.length + r.fontesDivergentes.length, 31);
  for (const nome of ['parado', 'andando', 'p1', 'p2', 'k1', 'k2', 'dano', 'defesa', 'agachado', 'defesaBaixa', 'pulo', 'pousando', 'cp', 'ck', 'ap', 'ak', 'esp', 'sup']) assert.ok(r.integrados.includes(nome), `${nome} fonte integrada`);
  for (const nome of ['rolando', 'agarrando', 'agarrado', 'tonto', 'vitoria', 'derrotado', 'final', 'vitimaFinal']) assert.ok(r.extras.atuacao?.nomes?.includes(nome) ? r.integrados.includes(nome) : r.genericos.includes(nome));
  assert.ok(r.clips.every(c => !c.aprovadoFinal));
  assert.ok(r.evidencias.every(e => e.atual === (e.sha256Glb === r.sha256Glb)));
});

test('alterar um canal real invalida a integração e a evidência do GLB mesmo mantendo todos os nomes', async () => {
  const [{ auditarPipoca }, { validarGlb }] = await Promise.all([import('../../../scripts/producao-3d/auditar-pipoca.mjs'), import('../../../src/3d/contrato-glb.mjs')]);
  const b = bytes(), doc = validarGlb(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), 'pipoca', K);
  const a = doc.animations.find(a => a.name === 'cp'), acesso = doc.accessors[a.samplers[a.channels[0].sampler].output], vista = doc.bufferViews[acesso.bufferView];
  const offset = 20 + b.readUInt32LE(12) + 8 + (vista.byteOffset || 0) + (acesso.byteOffset || 0);
  b.writeFloatLE(b.readFloatLE(offset) + .001, offset);
  const r = auditarPipoca(b);
  assert.ok(r.fontesDivergentes.includes('cp'));
  assert.ok(!r.integrados.includes('cp'));
  assert.ok(!r.evidencias.some(e => e.atual));
  assert.equal(r.total, 31);
});

test('hash canônico corresponde aos FLOAT exportados, independe da ordem dos canais e detecta mudança de duração', async () => {
  const { hashClipPipoca } = await import('../../../scripts/producao-3d/auditar-pipoca.mjs');
  const c = { nome: 'prova', duracaoQuadros: 2, canais: [
    { osso: 0, tipo: 'translation', tempos: [0, 2 / 60], valores: [0, 1 / 3, 0, 0, 1 / 3, 0] },
    { osso: 0, tipo: 'rotation', tempos: [0, 2 / 60], valores: [0, 0, 0, 1, 0, 0, 0, 1] },
  ] };
  const arredondado = structuredClone(c); arredondado.canais.reverse();
  for (const canal of arredondado.canais) for (const campo of ['tempos', 'valores']) canal[campo] = canal[campo].map(Math.fround);
  assert.equal(hashClipPipoca(c), hashClipPipoca(arredondado));
  arredondado.duracaoQuadros++;
  assert.notEqual(hashClipPipoca(c), hashClipPipoca(arredondado));
});
