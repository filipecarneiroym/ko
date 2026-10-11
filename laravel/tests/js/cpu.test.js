const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');
const CPU = require('../../../public/js/ko-cpu.js');
function estado(distancia) {
  const s = K.novo({ lutadores: ['pipoca', 'uivo'] });
  s.fase = 'luta'; s.p[0].x = 50 * K.U; s.p[1].x = (50 + distancia) * K.U;
  return s;
}
test('difícil reage antes do fácil sem mudar os atributos da luta', () => {
  const s = estado(160), antes = structuredClone(s);
  const facil = CPU.criar(K, 'facil', () => 0.5), dificil = CPU.criar(K, 'dificil', () => 0.5);
  let primeiroFacil = 0, primeiroDificil = 0;
  for (let n = 1; n <= 30; n++) {
    if (facil(s, 1) && !primeiroFacil) primeiroFacil = n;
    if (dificil(s, 1) && !primeiroDificil) primeiroDificil = n;
  }
  assert.ok(primeiroDificil > 0 && primeiroDificil < primeiroFacil);
  assert.deepEqual(s, antes);
});
test('dificuldade altera defesa e combos, sem ler comandos futuros', () => {
  const s = estado(60); s.p[0].estado = 'golpe'; s.p[0].golpe = 'ck';
  const facil = CPU.criar(K, 'facil', () => 0.4), dificil = CPU.criar(K, 'dificil', () => 0.4);
  let defesasFacil = 0, defesasDificil = 0;
  for (let n = 0; n < 120; n++) {
    if (facil(s, 1) & K.B.D_) defesasFacil++;
    if (dificil(s, 1) & K.B.D_) defesasDificil++;
  }
  assert.equal(defesasFacil, 0); assert.ok(defesasDificil > 0);
  s.p[0].estado = 'parado'; s.p[1].x = s.p[0].x + 30 * K.U;
  const simples = CPU.criar(K, 'facil', () => 0.1), combo = CPU.criar(K, 'dificil', () => 0.1);
  let botoesFacil = 0, botoesDificil = 0;
  for (let n = 0; n < 120; n++) { botoesFacil |= simples(s, 1); botoesDificil |= combo(s, 1); }
  assert.equal(botoesFacil & K.B.S, 0); assert.ok(botoesDificil & K.B.S);
});
test('bot fica neutro entre rounds e aceita nível desconhecido como médio', () => {
  const s = estado(160); s.fase = 'round';
  const bot = CPU.criar(K, 'invalido', () => 0.5);
  for (let n = 0; n < 30; n++) assert.equal(bot(s, 1), 0);
  s.fase = 'luta';
  for (let n = 0; n < 11; n++) assert.equal(bot(s, 1), 0);
  assert.equal(bot(s, 1), K.B.L);
});
