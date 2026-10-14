const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');
function estado() { const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta'; return s; }
function passo(s, lado, bits) {
  const entrada = [0, 0]; entrada[lado] = bits;
  K.passo(s, entrada);
}
for (const lado of [0, 1]) {
  test(`P lado ${lado}: segurar não emenda sozinho; novo toque emenda após contato`, () => {
    const s = estado(); s.p[0].x = 150 * K.U; s.p[1].x = 180 * K.U;
    const ataques = [];
    for (let q = 0; q < 90; q++) {
      passo(s, lado, K.B.P);
      ataques.push(...s.ev.filter(e => e.t === 'ataque').map(e => e.golpe));
    }
    assert.deepEqual(ataques, ['p1']);
    const combo = estado(); combo.p[0].x = 150 * K.U; combo.p[1].x = 180 * K.U;
    passo(combo, lado, K.B.P);
    for (let q = 0; !combo.p[lado].encostou && q < 20; q++) passo(combo, lado, 0);
    assert.ok(combo.p[lado].encostou);
    while (combo.hitstop) passo(combo, lado, 0);
    passo(combo, lado, K.B.P);
    assert.equal(combo.p[lado].golpe, 'p2');
  });
  test(`P lado ${lado}: agachado e aéreo escolhem seus próprios socos`, () => {
    const baixo = estado(); passo(baixo, lado, K.B.D | K.B.P);
    assert.equal(baixo.p[lado].golpe, 'cp');
    const ar = estado(); passo(ar, lado, K.B.U);
    for (let q = 0; q < 8; q++) passo(ar, lado, 0);
    passo(ar, lado, K.B.P);
    assert.equal(ar.p[lado].golpe, 'ap');
  });
  test(`F lado ${lado}: carga não ataca; soltar causa um único contato`, () => {
    const s = estado(); let contatos = 0;
    for (let q = 0; q < 30; q++) {
      s.p[0].x = 150 * K.U; s.p[1].x = 180 * K.U;
      passo(s, lado, K.B.F);
      contatos += s.ev.filter(e => e.t === 'acerto').length;
    }
    assert.equal(s.p[lado].golpe, 'foc'); assert.equal(s.p[lado].nivelFoco, 2);
    assert.equal(contatos, 0);
    for (let q = 0; q < 90; q++) {
      s.p[0].x = 150 * K.U; s.p[1].x = 180 * K.U;
      for (const l of s.p) l.empurrao = 0;
      passo(s, lado, 0);
      contatos += s.ev.filter(e => e.t === 'acerto').length;
    }
    assert.equal(contatos, 1);
    assert.equal(s.p[lado].estado, 'parado');
  });
}
