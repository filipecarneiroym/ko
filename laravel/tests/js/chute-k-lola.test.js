const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');

function estado() {
  const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
  s.fase = 'luta'; s.fT = 0;
  return s;
}
function passo(s, lado, bits, perto = true) {
  s.p[0].x = 150 * K.U; s.p[1].x = (perto ? 180 : 340) * K.U;
  for (const l of s.p) l.empurrao = 0;
  const entrada = [0, 0]; entrada[lado] = bits;
  K.passo(s, entrada);
  return s.ev.filter(e => e.t === 'acerto').length;
}

for (const lado of [0, 1]) {
  test(`K da Lola, lado ${lado}: um acerto por toque, sem repetir segurando`, () => {
    const s = estado(), vitima = s.p[1 - lado], vida = vitima.vida;
    let acertos = 0;
    for (let q = 0; q < 90; q++) acertos += passo(s, lado, K.B.K);
    assert.equal(acertos, 1);
    assert.equal(vida - vitima.vida, 30);
    passo(s, lado, 0);
    for (let q = 0; q < 90; q++) acertos += passo(s, lado, q === 0 ? K.B.K : 0);
    assert.equal(acertos, 2, 'novo toque depois da recuperação produz um novo chute');
  });
  test(`K da Lola, lado ${lado}: errar a extensão não acerta na antiga segunda janela`, () => {
    const s = estado();
    let acertos = 0;
    for (let q = 0; q < 50; q++) acertos += passo(s, lado, q === 0 ? K.B.K : 0, q >= 10);
    assert.equal(acertos, 0);
  });
}
