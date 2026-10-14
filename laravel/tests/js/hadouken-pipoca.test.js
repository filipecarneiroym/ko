// Quarto de círculo + soco = cenoura (Hadouken). Rodar: `node --test tests/js/hadouken-pipoca.test.js` (dentro de laravel/).
const test = require('node:test');
const assert = require('node:assert');
const K = require('../../../public/js/ko-sim.js');

const { B } = K;
function roteiro(s, passos) {
  for (const [b0, b1, n] of passos) for (let i = 0; i < n; i++) K.passo(s, [b0, b1]);
}
function pronta() {
  const s = K.novo({ lutadores: ['pipoca', 'uivo'] });
  roteiro(s, [[0, 0, 101]]);
  assert.strictEqual(s.fase, 'luta');
  s.p[0].x = 60 * K.U; s.p[1].x = 330 * K.U;
  return s;
}

test('quarto de círculo para frente + soco solta a cenoura', () => {
  const s = pronta();
  const frente = s.p[0].face === 1 ? B.R : B.L;
  roteiro(s, [[B.D, 0, 1], [B.D | frente, 0, 1], [frente, 0, 1], [frente | B.P, 0, 1]]);
  roteiro(s, [[0, 0, 15]]);
  assert.strictEqual(s.proj.length, 1, 'o quarto de círculo deveria soltar a cenoura');
});

test('soco sem o quarto de círculo continua sendo soco', () => {
  const s = pronta();
  roteiro(s, [[B.P, 0, 1]]);
  assert.strictEqual(s.p[0].golpe, 'p1');
  roteiro(s, [[0, 0, 15]]);
  assert.strictEqual(s.proj.length, 0);
});

test('o quarto de círculo não solta duas cenouras seguidas', () => {
  const s = pronta();
  const frente = s.p[0].face === 1 ? B.R : B.L;
  const giro = [[B.D, 0, 1], [B.D | frente, 0, 1], [frente, 0, 1]];
  roteiro(s, [...giro, [frente | B.P, 0, 1], [0, 0, 60], ...giro, [frente | B.P, 0, 1], [0, 0, 1]]);
  assert.ok(s.proj.length <= 1, 'uma cenoura por vez');
});
