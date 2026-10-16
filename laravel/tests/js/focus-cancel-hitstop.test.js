const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');

for (const lado of [0, 1]) for (const frente of [false, true])
  test(`Focus: passo ${frente ? 'à frente' : 'para trás'} durante hitstop, lado ${lado}`, () => {
    const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta';
    s.p[0].x = 150 * K.U; s.p[1].x = 180 * K.U;
    const l = s.p[lado], bitFrente = l.face > 0 ? K.B.R : K.B.L;
    const bit = frente ? bitFrente : bitFrente === K.B.R ? K.B.L : K.B.R;
    const passo = bits => { const entradas = [0, 0]; entradas[lado] = bits; K.passo(s, entradas); };
    for (let q = 0; q < 100 && !s.hitstop; q++) passo(K.B.F);
    assert.equal(l.golpe, 'foc'); assert.ok(l.encostou && s.hitstop >= 4);
    for (const bits of [bit, 0, bit, 0]) passo(bits);
    while (s.hitstop > 0) passo(0);
    passo(0);
    assert.equal(l.estado, 'impulso', 'o toque duplo feito durante o impacto é executado na retomada');
    assert.ok(l.vx * l.face * (frente ? 1 : -1) > 0, 'passo segue o lado solicitado');
    assert.equal(s.ev.filter(e => e.t === 'passoFoco').length, 1);
  });
