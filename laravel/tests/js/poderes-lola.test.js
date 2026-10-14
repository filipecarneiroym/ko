const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');
const { B } = K;
function estado() { const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta'; s.fT = 0; return s; }
function rodar(s, a = 0, b = 0, n = 1) { for (let i = 0; i < n; i++) K.passo(s, [a, b]); }
function colar(s) { s.p[0].x = 150 * K.U; s.p[1].x = 180 * K.U; }

test('SP continua especial com barra cheia; Super e Ultra são escolhas separadas', () => {
  const s = estado(); s.p[0].poder = K.PODER_MAX;
  rodar(s, B.S);
  assert.equal(s.p[0].golpe, 'esp'); assert.equal(s.p[0].poder, K.PODER_MAX);
  const superEstado = estado(); superEstado.p[0].poder = K.PODER_MAX; superEstado.p[0].revanche = K.ULTRA_MAX;
  rodar(superEstado, B.S | B.K);
  assert.equal(superEstado.p[0].golpe, 'sup'); assert.equal(superEstado.p[0].poder, 0); assert.equal(superEstado.p[0].revanche, K.ULTRA_MAX);
  const ultraEstado = estado(); ultraEstado.p[0].poder = K.PODER_MAX; ultraEstado.p[0].revanche = K.ULTRA_MIN;
  rodar(ultraEstado, B.S | B.F);
  assert.equal(ultraEstado.p[0].golpe, 'ultra'); assert.equal(ultraEstado.p[0].poder, K.PODER_MAX); assert.equal(ultraEstado.p[0].revanche, 0);
});

test('EX, Super e Ultra sem recurso não gastam nem viram outro golpe', () => {
  for (const bits of [B.S | B.P, B.S | B.K, B.S | B.F]) {
    const s = estado(); rodar(s, bits);
    assert.equal(s.p[0].golpe, null); assert.equal(s.p[0].poder, 0); assert.equal(s.p[0].revanche, 0);
  }
});

test('atalhos direcionais escolhem cada especial e EX nas duas orientações', () => {
  for (const lado of [0, 1]) for (const [sentido, nome] of [[0, 'esp'], [1, 'dp'], [-1, 'tatsu']]) for (const ex of [false, true]) {
    const s = estado(), l = s.p[lado]; l.poder = K.PODER_MAX;
    const frente = l.face === 1 ? B.R : B.L, tras = l.face === 1 ? B.L : B.R;
    const bits = B.S | (sentido === 1 ? frente : sentido === -1 ? tras : 0) | (ex ? B.P : 0);
    const entrada = [0, 0]; entrada[lado] = bits; K.passo(s, entrada);
    assert.equal(l.golpe, nome + (ex ? 'Ex' : '')); assert.equal(l.poder, K.PODER_MAX - (ex ? K.EX_CUSTO : 0));
  }
});

test('Shoryuken aceita o comando terminando na diagonal, sobe e recupera no chão', () => {
  for (const lado of [0, 1]) {
    const s = estado(), l = s.p[lado], frente = l.face === 1 ? B.R : B.L;
    for (const bits of [frente, B.D, B.D | frente | B.P]) { const e = [0, 0]; e[lado] = bits; K.passo(s, e); }
    assert.equal(l.golpe, 'dp');
    let altura = 0;
    for (let i = 0; i < 90; i++) { rodar(s); altura = Math.max(altura, l.y); }
    assert.ok(altura > 30 * K.U); assert.equal(l.y, 0); assert.equal(l.golpe, null); assert.equal(l.estado, 'parado');
  }
});

test('chute furacão aceita quarto para trás, avança baixo e termina sem ficar suspenso', () => {
  for (const lado of [0, 1]) {
    const s = estado(), l = s.p[lado], tras = l.face === 1 ? B.L : B.R, origem = l.x;
    for (const bits of [B.D, B.D | tras, tras | B.K]) { const e = [0, 0]; e[lado] = bits; K.passo(s, e); }
    assert.equal(l.golpe, 'tatsu');
    let altura = 0;
    for (let i = 0; i < 80; i++) { rodar(s); altura = Math.max(altura, l.y); }
    assert.ok((l.x - origem) * l.face > 40 * K.U); assert.ok(altura > 0 && altura < 20 * K.U);
    assert.equal(l.y, 0); assert.equal(l.golpe, null);
  }
});

test('Hadouken EX cria dois projéteis e cobra uma única parte da barra', () => {
  const s = estado(); s.p[0].poder = K.PODER_MAX; s.p[0].x = 40 * K.U; s.p[1].x = 340 * K.U;
  rodar(s, B.S | B.P); rodar(s, 0, 0, 16);
  assert.equal(s.proj.length, 2); assert.ok(s.proj.every(p => p.ex === 1)); assert.equal(s.p[0].poder, 750);
});

test('revanche cresce recebendo dano, não atacando; Ultra usa sua própria reserva', () => {
  const s = estado(); colar(s); rodar(s, B.P); rodar(s, 0, 0, 4);
  assert.equal(s.p[0].revanche, 0); assert.ok(s.p[1].revanche > 0);
  const forte = estado(); forte.p[0].revanche = K.ULTRA_MAX; rodar(forte, B.S | B.F); rodar(forte, 0, 0, 60);
  assert.equal(forte.proj[0].ultra, 1); assert.equal(forte.proj[0].dano, 300);
  const parcial = estado(); parcial.p[0].revanche = K.ULTRA_MIN; rodar(parcial, B.S | B.F); rodar(parcial, 0, 0, 60);
  assert.equal(parcial.proj[0].dano, 255);
});

test('Focus mantém a carga, tem três níveis e solta automaticamente no máximo', () => {
  for (const [carga, nivel] of [[1, 1], [30, 2], [65, 3]]) {
    const s = estado(); rodar(s, B.F, 0, carga);
    assert.equal(s.p[0].golpe, 'foc'); assert.equal(s.p[0].nivelFoco, nivel);
    if (nivel < 3) { assert.equal(s.p[0].focoSolto, 0); assert.ok(s.p[0].t < 19); rodar(s); }
    assert.equal(s.p[0].focoSolto, 1);
    rodar(s, 0, 0, 45); assert.equal(s.p[0].golpe, null);
  }
});

test('Focus nível 2 causa colapso; nível 3 atravessa a guarda', () => {
  for (const nivel of [2, 3]) {
    const s = estado(); colar(s);
    rodar(s, B.F, nivel === 3 ? B.D_ : 0, nivel === 2 ? 30 : 61);
    let colapsou = false;
    for (let i = 0; i < 60; i++) { rodar(s, 0, nivel === 3 ? B.D_ : 0); colapsou ||= s.p[1].estado === 'colapso'; }
    assert.ok(colapsou); assert.ok(s.p[1].vida < K.LUTADORES.pipoca.vida);
  }
});

test('Focus absorve só um golpe, recupera vida cinza e perde a recuperação ao apanhar novamente', () => {
  const s = estado(); colar(s); rodar(s, 0, B.F); rodar(s, B.P, B.F); rodar(s, 0, B.F, 5);
  assert.ok(s.p[1].cinza > 0); assert.equal(s.p[1].armadura, 0);
  const vida = s.p[1].vida;
  s.p[0].x = 60 * K.U; s.p[1].x = 300 * K.U;
  rodar(s, 0, 0, 230);
  assert.ok(s.p[1].vida > vida); assert.equal(s.p[1].cinza, 0);
  const outro = estado(); colar(outro); rodar(outro, 0, B.F); rodar(outro, B.P, B.F); rodar(outro, 0, B.F, 20); rodar(outro, B.P, B.F); rodar(outro, 0, B.F, 15);
  assert.equal(outro.p[1].cinza, 0, 'segundo golpe elimina a vida recuperável');
});

test('Focus cancela a carga em passo sem cobrar barra; cancelamento de especial cobra duas partes', () => {
  const s = estado(); rodar(s, B.F); rodar(s, B.F | B.R); rodar(s, B.F); rodar(s, B.F | B.R);
  assert.equal(s.p[0].estado, 'impulso'); assert.equal(s.p[0].poder, 0);
  rodar(s, 0, 0, 30); assert.equal(s.p[0].estado, 'parado');
  const cancel = estado(); cancel.p[0].poder = K.PODER_MAX; rodar(cancel, B.S | B.R); rodar(cancel, 0, 0, 6);
  cancel.p[0].encostou = 1; rodar(cancel, B.F);
  assert.equal(cancel.p[0].estado, 'impulso'); assert.equal(cancel.p[0].poder, 500);
  rodar(cancel, 0, 0, 40); assert.equal(cancel.p[0].y, 0); assert.equal(cancel.p[0].estado, 'parado');
});

test('novos poderes preservam determinismo, inteiros, congelamento no hitstop e reinício do round', () => {
  const a = estado(), b = structuredClone(a); a.p[0].poder = b.p[0].poder = K.PODER_MAX;
  a.p[0].revanche = b.p[0].revanche = K.ULTRA_MAX;
  for (let i = 0; i < 350; i++) {
    const comando = i === 0 ? B.S | B.P : i === 50 ? B.S | B.R : i === 120 ? B.S | B.L : i === 190 ? B.S | B.F : i > 280 && i < 315 ? B.F : 0;
    rodar(a, comando); rodar(b, comando); assert.equal(K.hash(a), K.hash(b));
    for (const l of a.p) for (const k of ['x', 'y', 'vx', 'vy', 'poder', 'revanche', 'cinza']) assert.ok(Number.isInteger(l[k]), k);
  }
  const s = estado(); rodar(s, B.F, 0, 20); s.hitstop = 4; const carga = s.p[0].focoCarga;
  rodar(s, B.F, 0, 4); assert.equal(s.p[0].focoCarga, carga);
});
