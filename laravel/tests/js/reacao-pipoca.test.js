const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const pasta = path.resolve(__dirname, '../../../art/premium/modelos-3d/estudos-mixamo');
const ler = nome => JSON.parse(fs.readFileSync(path.join(pasta, nome)));
const modulos = Promise.all([
  import('../../../scripts/producao-3d/gerar-estudo-reacao.mjs'),
  import('../../../scripts/producao-3d/gerar-estudo-defesa.mjs'),
  import('../../../scripts/producao-3d/glb.mjs'),
  import('../../../src/3d/contrato-glb.mjs'),
]);

function fontes() {
  return [ler('guarda-v4.json'), ler('jab-v5.json'), ler('soco-forte-v6.json'), ler('defesa-v7.json')];
}

function reacaoValida(guarda) {
  const canais = guarda.canais.map(c => {
    const tamanho = c.tipo === 'rotation' ? 4 : 3;
    const inicio = c.valores.slice(0, tamanho);
    return { osso: c.osso, tipo: c.tipo, tempos: Array.from({ length: 13 }, (_, i) => i / 60), valores: Array.from({ length: 13 }, () => inicio).flat() };
  });
  // Fixture independente do Blender; simula recuo unitário no tronco desde o início.
  const tronco = canais.find(c => c.osso === 1 && c.tipo === 'rotation');
  for (let q = 0; q < 7; q++) {
    const e = (7 - q) / 7, a = -.2 * e / 2;
    const [x, y, z, w] = tronco.valores.slice(q * 4, q * 4 + 4);
    const s = Math.sin(a), c = Math.cos(a);
    tronco.valores.splice(q * 4, 4, c * x + s * z, c * y + s * w, c * z - s * x, c * w - s * y);
  }
  return { nome: 'dano', duracaoQuadros: 12, canais };
}

test('reação substitui somente dano, conserva os outros 30 clips e exporta os 31', async () => {
  const [{ criarEstudoReacao }, { criarEstudoDefesa }, { exportarGlb }, { validarGlb }] = await modulos;
  const origem = fontes(), reacao = reacaoValida(origem[0]);
  const antes = JSON.stringify([origem, reacao]);
  const base = criarEstudoDefesa(...origem, K);
  const dados = criarEstudoReacao(...origem, reacao, K);
  assert.equal(JSON.stringify([origem, reacao]), antes, 'Fontes não sofrem mutação');
  assert.deepEqual(dados.clips.filter(c => c.nome !== 'dano'), base.clips.filter(c => c.nome !== 'dano'));
  assert.notEqual(dados.clips.find(c => c.nome === 'dano'), reacao, 'Clip inserido é independente');
  const bytes = exportarGlb(dados);
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K);
  assert.equal(doc.animations.length, 31);
  assert.equal(doc.extras.aprovadoFinal, false);
  assert.equal(doc.animations.find(c => c.name === 'dano').extras.duracaoQuadros, 12);
});

test('reação rejeita recuperação tardia, pés deslocados e impacto atrasado', async () => {
  const [{ criarEstudoReacao }] = await modulos;
  const origem = fontes();
  const casos = [
    [r => { const c = r.canais.find(c => c.osso === 1 && c.tipo === 'rotation'); c.valores.splice(7 * 4, 4, ...c.valores.slice(0, 4)); }, /quadro 7/],
    [r => { r.canais.find(c => c.osso === 12 && c.tipo === 'translation').valores[3] += .1; }, /pernas fixos/],
    [r => { r.canais.find(c => c.osso === 0 && c.tipo === 'translation').valores[3] += .1; }, /raiz horizontalmente/],
    [r => { r.canais.find(c => c.osso === 1 && c.tipo === 'rotation').valores.splice(0, 4, ...origem[0].canais.find(c => c.osso === 1 && c.tipo === 'rotation').valores.slice(0, 4)); }, /primeiro quadro/],
    [r => { r.canais.pop(); }, /20 ossos/],
    [r => { r.canais[0].tempos[4] = 3 / 60; }, /quadros inteiros/],
  ];
  for (const [alterar, esperado] of casos) {
    const reacao = reacaoValida(origem[0]); alterar(reacao);
    assert.throws(() => criarEstudoReacao(...origem, reacao, K), esperado);
  }
});

test('combo longo mantém no mínimo 8 quadros de hitstun no motor atual', () => {
  const estado = K.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
  estado.fase = 'luta'; estado.fT = 0;
  const [vitima, atacante] = estado.p;
  vitima.x = 225 * K.U; vitima.face = -1; vitima.estado = 'dano'; vitima.combo = 20; vitima.stun = 80;
  atacante.x = 200 * K.U; atacante.face = 1; atacante.estado = 'golpe'; atacante.golpe = 'p1';
  atacante.t = K.LUTADORES.uivo.golpes.p1.janelas[0].de - 1;
  K.passo(estado, [0, 0]);
  assert.ok(estado.ev.some(e => e.t === 'acerto'), 'Golpe real alcança a vítima');
  assert.equal(vitima.estado, 'dano');
  assert.equal(vitima.stun, 8, 'Recuperar no quadro 7 antecede até o menor stun de combo');
});
