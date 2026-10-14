// Testes do motor da luta: `node --test tests/js` (dentro de laravel/). Sem dependências.
const test = require('node:test');
const assert = require('node:assert');
const K = require('../../../public/js/ko-sim.js');

const { B } = K;
test('hash detecta diferenças que alteram quadros futuros', () => {
  const a = K.novo({ lutadores: ['pipoca', 'uivo'] });
  const b = structuredClone(a);
  b.p[0].vx = 1;
  assert.notEqual(K.hash(a), K.hash(b));
  b.p[0].vx = 0;
  b.p[0].estado = 'xyzabcd'; // mesmo comprimento de parado
  assert.notEqual(K.hash(a), K.hash(b));
});
// Gerador pseudoaleatório com semente (o teste se repete igual toda vez).
function rng(semente) { let x = semente >>> 0 || 1; return () => (x = (Math.imul(x ^ (x >>> 15), 2246822519) + 0x9e3779b9) >>> 0); }

function botaoAleatorio(r) {
  const n = r() ^ (r() >>> 7);
  let b = 0;
  if (n & 1) b |= B.L; else if (n & 2) b |= B.R;
  if ((n & 12) === 12) b |= B.U;
  if ((n & 48) === 48) b |= B.D;
  if ((n & 0x300) === 0x300) b |= B.P;
  if ((n & 0xc00) === 0xc00) b |= B.K;
  if ((n & 0x7000) === 0x7000) b |= B.D_;
  if ((n & 0x78000) === 0x78000) b |= B.S;
  return b;
}

function jogar(lutadores, semente, quadros) {
  const s = K.novo({ lutadores });
  const r0 = rng(semente), r1 = rng(semente * 7 + 3);
  const eventos = {};
  let segura0 = 0, segura1 = 0;
  for (let i = 0; i < quadros; i++) {
    if (i % 5 === 0) { segura0 = botaoAleatorio(r0); segura1 = botaoAleatorio(r1); }
    K.passo(s, [segura0, segura1]);
    for (const e of s.ev) eventos[e.t] = (eventos[e.t] || 0) + 1;
    for (const l of s.p) {
      assert.ok(Number.isInteger(l.x) && Number.isInteger(l.y) && Number.isInteger(l.vida), `número quebrado no quadro ${i}: ${JSON.stringify(l)}`);
      assert.ok(l.vida >= 0 && l.y >= 0, 'vida ou altura negativa');
      assert.ok(l.x >= 18 * K.U && l.x <= (K.LARGURA - 18) * K.U, 'saiu da arena');
      assert.ok(l.poder >= 0 && l.poder <= K.PODER_MAX, 'barra de poder fora do limite');
    }
  }
  return { s, eventos };
}

test('mesmos botões dão a mesma luta nos dois celulares (determinismo)', () => {
  for (const semente of [1, 42, 2026]) {
    const a = jogar(['pipoca', 'uivo'], semente, 6000);
    const b = jogar(['pipoca', 'uivo'], semente, 6000);
    assert.strictEqual(K.hash(a.s), K.hash(b.s));
    assert.deepStrictEqual(a.s.rounds, b.s.rounds);
  }
});

test('luta aleatória longa não quebra e tem de tudo um pouco', () => {
  const total = {};
  const todos = Object.keys(K.LUTADORES);
  const pares = todos.flatMap((a, i) => todos.map((b, j) => [[a, b], 7 + i * 10 + j]));
  for (const [l, semente] of pares) {
    const { eventos } = jogar(l, semente, 8000);
    for (const [k, v] of Object.entries(eventos)) total[k] = (total[k] || 0) + v;
  }
  for (const e of ['acerto', 'defendeu', 'especial', 'pulo', 'round', 'lutem']) assert.ok(total[e] > 0, `nunca aconteceu: ${e} ${JSON.stringify(total)}`);
});

// Roteiro: aperta um botão por alguns quadros e solta.
function roteiro(s, passos) {
  for (const [b0, b1, n] of passos) for (let i = 0; i < n; i++) K.passo(s, [b0, b1]);
}
function prontaParaLutar(lut = ['pipoca', 'uivo']) {
  const s = K.novo({ lutadores: lut });
  roteiro(s, [[0, 0, 101]]);
  assert.strictEqual(s.fase, 'luta');
  return s;
}
function colar(s) { s.p[0].x = 180 * K.U; s.p[1].x = 208 * K.U; }

test('combo soco, soco, chute emenda e conta hits', () => {
  const s = prontaParaLutar();
  colar(s);
  let maior = 0;
  // Cada botão apertado no meio do golpe anterior (o jogo guarda o toque por alguns quadros).
  for (const [b, espera] of [[B.P, 9], [B.P, 12], [B.K, 50]]) {
    K.passo(s, [b, 0]);
    for (let i = 0; i < espera; i++) { K.passo(s, [0, 0]); maior = Math.max(maior, s.p[1].combo); }
  }
  assert.strictEqual(maior, 3, 'combo de 3 hits não emendou');
  assert.ok(s.p[1].vida < K.LUTADORES.uivo.vida - 100);
});

test('defesa segura soco e a rasteira passa por baixo da defesa em pé', () => {
  const s = prontaParaLutar();
  colar(s);
  const vida = s.p[1].vida;
  roteiro(s, [[B.P, B.D_, 1], [0, B.D_, 20]]);
  assert.strictEqual(s.p[1].vida, vida, 'defesa em pé não segurou o soco');
  roteiro(s, [[B.D | B.K, B.D_, 1], [B.D, B.D_, 30]]);
  assert.ok(s.p[1].vida < vida, 'rasteira deveria passar pela defesa em pé');
});

test('defesa permite avançar e recuar mais devagar nos dois lados', () => {
  for (const lado of [0, 1]) for (const frente of [true, false]) {
    const s = prontaParaLutar(['pipoca', 'pipoca']);
    const l = s.p[lado], x = l.x;
    const direcao = (l.face === 1) === frente ? B.R : B.L;
    const entrada = [0, 0]; entrada[lado] = direcao;
    const normal = structuredClone(s);
    K.passo(normal, entrada);
    entrada[lado] |= B.D_;
    for (let i = 0; i < 12; i++) K.passo(s, entrada);
    assert.equal(l.estado, 'defesa');
    assert.equal(Math.sign(l.x - x), direcao === B.R ? 1 : -1);
    assert.equal(l.x - x, l.vx * 12);
    assert.ok(Math.abs(l.vx) >= Math.abs(normal.p[lado].vx) * 0.55);
    assert.ok(Math.abs(l.vx) <= Math.abs(normal.p[lado].vx) * 0.65);
    assert.ok(Number.isInteger(l.x) && Number.isInteger(l.vx));
    assert.equal(l.y, 0);
  }
});

test('caminhar na guarda continua bloqueando socos, avançando ou recuando', () => {
  for (const lado of [0, 1]) for (const frente of [true, false]) {
    const s = prontaParaLutar(['pipoca', 'pipoca']); colar(s);
    const defensor = s.p[lado], vida = defensor.vida;
    const direcao = (defensor.face === 1) === frente ? B.R : B.L;
    const entrada = [0, 0]; entrada[lado] = B.D_ | direcao; entrada[1 - lado] = B.P;
    K.passo(s, entrada); entrada[1 - lado] = 0;
    let bloqueou = false;
    for (let i = 0; i < 8 && !bloqueou; i++) {
      K.passo(s, entrada);
      bloqueou = s.ev.some((e) => e.t === 'defendeu' && e.lado === lado);
    }
    assert.ok(bloqueou, `lado ${lado}, ${frente ? 'avançando' : 'recuando'}`);
    assert.equal(defensor.vida, vida);
    assert.equal(defensor.estado, 'defesa');
    assert.ok(defensor.stun > 0);
    assert.equal(defensor.vx, 0, 'o impacto interrompe a caminhada');
  }
});

test('defesa agachada fica no lugar mesmo segurando direção', () => {
  for (const lado of [0, 1]) for (const direcao of [B.L, B.R]) {
    const s = prontaParaLutar(['pipoca', 'pipoca']);
    const l = s.p[lado], x = l.x, entrada = [0, 0]; entrada[lado] = B.D_ | B.D | direcao;
    for (let i = 0; i < 12; i++) K.passo(s, entrada);
    assert.equal(l.estado, 'defesaBaixa');
    assert.equal(l.x, x); assert.equal(l.vx, 0); assert.equal(l.y, 0);
  }
});

test('soltar a defesa recupera a caminhada e toque duplo na guarda não corre', () => {
  for (const lado of [0, 1]) {
    const s = prontaParaLutar(['pipoca', 'pipoca']);
    const l = s.p[lado], frente = l.face === 1 ? B.R : B.L, entrada = [0, 0];
    entrada[lado] = frente; K.passo(s, entrada); const normal = l.vx;
    entrada[lado] |= B.D_; K.passo(s, entrada); const guarda = l.vx;
    entrada[lado] = B.D_; K.passo(s, entrada);
    assert.equal(l.vx, 0, 'soltar o direcional interrompe a caminhada na guarda');
    entrada[lado] = B.D_ | frente; K.passo(s, entrada);
    assert.equal(l.estado, 'defesa'); assert.equal(l.vx, guarda);
    entrada[lado] = frente; K.passo(s, entrada);
    assert.equal(l.estado, 'andando'); assert.equal(l.vx, normal);
  }
});

test('caminhada defensiva respeita as paredes e a separação entre lutadores', () => {
  const s = prontaParaLutar(['pipoca', 'pipoca']);
  roteiro(s, [[B.D_ | B.L, B.D_ | B.R, 180]]);
  assert.equal(s.p[0].x, 18 * K.U);
  assert.equal(s.p[1].x, (K.LARGURA - 18) * K.U);
  for (let i = 0; i < 200; i++) {
    K.passo(s, [B.D_ | B.R, B.D_ | B.L]);
    assert.ok(s.p[0].x >= 18 * K.U && s.p[1].x <= (K.LARGURA - 18) * K.U);
    assert.ok(s.p[1].x - s.p[0].x >= 26 * K.U, 'as guardas não atravessam os corpos');
    assert.equal(s.p[0].y, 0); assert.equal(s.p[1].y, 0);
  }
});

test('impacto na guarda impede caminhada e mantém só o empurrão até recuperar', () => {
  const s = prontaParaLutar(['pipoca', 'pipoca']); colar(s);
  K.passo(s, [B.P, B.D_ | B.L]);
  for (let i = 0; i < 8 && !s.p[1].stun; i++) K.passo(s, [0, B.D_ | B.L]);
  assert.ok(s.p[1].stun > 0);
  const parada = structuredClone(s);
  while (s.p[1].stun > 0) {
    K.passo(s, [0, B.D_ | B.L]); K.passo(parada, [0, B.D_]);
    assert.equal(s.p[1].x, parada.p[1].x, 'direção não altera o recuo durante o impacto');
    assert.equal(s.p[1].estado, 'defesa'); assert.equal(s.p[1].vx, 0);
  }
  K.passo(s, [0, B.D_ | B.L]);
  assert.ok(s.p[1].vx < 0, 'a caminhada volta depois da recuperação');
});

test('direção com defesa não interrompe introdução, ataque ou atordoamento', () => {
  const intro = K.novo({ lutadores: ['pipoca', 'pipoca'] });
  const x = intro.p[0].x;
  roteiro(intro, [[B.D_ | B.R, 0, 20]]);
  assert.equal(intro.fase, 'intro'); assert.equal(intro.p[0].x, x);

  const ataque = prontaParaLutar(['pipoca', 'pipoca']);
  K.passo(ataque, [B.P, 0]); const xAtaque = ataque.p[0].x;
  roteiro(ataque, [[B.D_ | B.R, 0, 4]]);
  assert.equal(ataque.p[0].estado, 'golpe'); assert.equal(ataque.p[0].x, xAtaque);

  const dano = prontaParaLutar(['pipoca', 'pipoca']); colar(dano);
  K.passo(dano, [B.P, 0]);
  for (let i = 0; i < 8 && dano.p[1].estado !== 'dano'; i++) K.passo(dano, [0, 0]);
  assert.equal(dano.p[1].estado, 'dano');
  const neutra = structuredClone(dano);
  while (dano.p[1].estado === 'dano') {
    K.passo(dano, [0, B.D_ | B.L]); K.passo(neutra, [0, 0]);
    assert.equal(dano.p[1].x, neutra.p[1].x);
    assert.equal(dano.p[1].estado, neutra.p[1].estado);
  }
});

test('especial com barra cheia vira Super', () => {
  const s = prontaParaLutar();
  s.p[0].poder = K.PODER_MAX;
  K.passo(s, [B.S, 0]);
  assert.strictEqual(s.p[0].golpe, 'sup');
  assert.strictEqual(s.p[0].poder, 0);
});

test('como no SF4: segurar para trás defende com ataque por perto e anda para trás sem ameaça', () => {
  const s = prontaParaLutar();
  colar(s);
  // p[1] olha para a esquerda: trás = direita.
  K.passo(s, [B.P, B.R]);
  let defendeu = false;
  for (let i = 0; i < 12; i++) { K.passo(s, [0, B.R]); defendeu ||= s.ev.some((e) => e.t === 'defendeu'); }
  assert.ok(defendeu, 'segurar para trás deveria defender o soco');
  const livre = prontaParaLutar();
  livre.p[0].x = 100 * K.U; livre.p[1].x = 300 * K.U;
  const x = livre.p[1].x;
  for (let i = 0; i < 10; i++) K.passo(livre, [0, B.R]);
  assert.equal(livre.p[1].estado, 'andando');
  assert.ok(livre.p[1].x > x, 'sem ameaça, trás é andar para trás');
});

test('Focus Attack (F) aguenta um golpe na carga e devolve o soco', () => {
  const s = prontaParaLutar();
  colar(s);
  K.passo(s, [0, B.F]);
  assert.equal(s.p[1].golpe, 'foc');
  K.passo(s, [B.P, 0]);
  let armadura = false, acertou = false;
  for (let i = 0; i < 40; i++) {
    K.passo(s, [0, 0]);
    armadura ||= s.ev.some((e) => e.t === 'armadura');
    acertou ||= s.ev.some((e) => e.t === 'acerto' && e.lado === 1);
  }
  assert.ok(armadura, 'o soco bate na armadura');
  assert.ok(acertou, 'o Focus devolve o golpe');
});

test('dois rounds vencidos levam ao "ACABA!" e ao Golpe Final', () => {
  const s = prontaParaLutar();
  for (let r = 0; r < 2; r++) {
    s.p[1].vida = 1; colar(s);
    roteiro(s, [[B.P, 0, 1], [0, 0, 40]]);
    assert.strictEqual(s.rounds[0], r + 1, 'round não contou');
    let guarda = 0;
    while (s.fase !== 'luta' && s.fase !== 'acaba' && guarda++ < 600) K.passo(s, [0, 0]);
  }
  assert.strictEqual(s.fase, 'acaba');
  assert.strictEqual(s.p[1].estado, 'tonto');
  s.p[0].x = s.p[1].x - 40 * K.U;
  K.passo(s, [B.S, 0]);
  assert.strictEqual(s.fase, 'final');
  roteiro(s, [[0, 0, 260]]);
  assert.strictEqual(s.fase, 'fim');
  assert.strictEqual(s.vencedor, 0);
});

test('acabou o tempo: vence quem tem mais vida', () => {
  const s = prontaParaLutar();
  s.timer = 2; s.p[0].vida -= 100;
  roteiro(s, [[0, 0, 5]]);
  assert.strictEqual(s.rounds[1], 1);
});

test('esquiva rolando atravessa o adversário sem apanhar', () => {
  const s = prontaParaLutar();
  colar(s);
  const x1 = s.p[1].x;
  roteiro(s, [[B.P | B.K, 0, 1], [0, 0, 30]]);
  assert.ok(s.p[0].x > x1, 'a esquiva deveria passar para o outro lado');
});

test('cenoura vai, volta e some', () => {
  const s = prontaParaLutar();
  s.p[0].x = 60 * K.U; s.p[1].x = 330 * K.U;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 15]]);
  assert.strictEqual(s.proj.length, 1);
  roteiro(s, [[0, 0, 120]]);
  assert.strictEqual(s.proj.length, 0);
});

test('agarrão interrompido solta quem estava preso', () => {
  const s = prontaParaLutar();
  colar(s);
  K.passo(s, [B.R | B.P, 0]);
  assert.strictEqual(s.p[1].estado, 'agarrado');
  s.p[0].estado = 'dano'; s.p[0].stun = 10; // apanhou de uma cenoura no meio do agarrão
  roteiro(s, [[0, 0, 2]]);
  assert.notStrictEqual(s.p[1].estado, 'agarrado');
});

test('pose do Maromba aguenta um golpe sem recuar e depois bate mais forte', () => {
  const s = prontaParaLutar(['uivo', 'maromba']);
  colar(s);
  K.passo(s, [0, B.S]);
  roteiro(s, [[0, 0, 6]]);
  const vida = s.p[1].vida;
  roteiro(s, [[B.P, 0, 1], [0, 0, 12]]);
  assert.ok(s.p[1].vida < vida, 'deveria levar dano');
  assert.notStrictEqual(s.p[1].estado, 'dano', 'não deveria recuar durante a pose');
  roteiro(s, [[0, 0, 40]]);
  assert.ok(s.p[1].forca > 0, 'depois de posar fica mais forte');
});

test('rasteira giratória do Ginga passa por baixo da cenoura', () => {
  const s = prontaParaLutar(['pipoca', 'ginga']);
  s.p[0].x = 120 * K.U; s.p[1].x = 220 * K.U;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 12]]);
  const vida = s.p[1].vida;
  K.passo(s, [0, B.S]);
  roteiro(s, [[0, 0, 20]]);
  assert.strictEqual(s.p[1].vida, vida, 'a cenoura deveria passar por cima');
});

test('Super do Maromba cega mesmo quem está defendendo', () => {
  const s = prontaParaLutar(['maromba', 'pipoca']);
  colar(s);
  s.p[0].poder = K.PODER_MAX;
  K.passo(s, [B.S, B.D_]);
  roteiro(s, [[0, B.D_, 130]]);
  assert.ok(s.p[1].vida < K.LUTADORES.pipoca.vida - 150, 'super deveria acertar através da defesa');
});

test('novelo da Vó Nena rola no chão: em pé defendendo não segura, agachado segura', () => {
  for (const [defesa, segura] of [[B.D_, false], [B.D_ | B.D, true]]) {
    const s = prontaParaLutar(['vo-nena', 'uivo']);
    s.p[0].x = 120 * K.U; s.p[1].x = 220 * K.U;
    const vida = s.p[1].vida;
    K.passo(s, [B.S, defesa]);
    roteiro(s, [[0, defesa, 60]]);
    assert.strictEqual(s.p[1].vida === vida || s.p[1].estado !== 'dano', segura, segura ? 'agachado deveria segurar' : 'em pé não deveria segurar');
    if (!segura) assert.ok(s.p[1].enrolado > 0, 'deveria ficar enrolado');
  }
});

test('bengala do Vô Tião puxa o adversário para perto', () => {
  const s = prontaParaLutar(['vo-tiao', 'pipoca']);
  s.p[0].x = 150 * K.U; s.p[1].x = 210 * K.U;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 30]]);
  assert.ok(Math.abs(s.p[1].x - s.p[0].x) <= 32 * K.U, 'deveria ter puxado');
  assert.ok(s.p[1].vida < K.LUTADORES.pipoca.vida);
});

test('dentadura do Super gruda e morde várias vezes', () => {
  const s = prontaParaLutar(['vo-tiao', 'pipoca']);
  s.p[0].x = 120 * K.U; s.p[1].x = 220 * K.U; s.p[0].poder = K.PODER_MAX;
  K.passo(s, [B.S, 0]);
  let mordidas = 0;
  for (let i = 0; i < 260; i++) { K.passo(s, [0, 0]); mordidas += s.ev.filter((e) => e.t === 'acerto').length; }
  assert.ok(mordidas >= 5, 'mordeu só ' + mordidas + ' vezes');
});

test('joelhada voadora da Kira sai do chão e acerta', () => {
  const s = prontaParaLutar(['kira', 'uivo']);
  s.p[0].x = 170 * K.U; s.p[1].x = 220 * K.U;
  K.passo(s, [B.S, 0]);
  let subiu = false;
  for (let i = 0; i < 40; i++) { K.passo(s, [0, 0]); if (s.p[0].y > 20 * K.U) subiu = true; }
  assert.ok(subiu, 'deveria sair do chão');
  assert.ok(s.p[1].vida < K.LUTADORES.uivo.vida);
  roteiro(s, [[0, 0, 60]]);
  assert.strictEqual(s.p[0].y, 0);
});

test('tora do Toco derruba e a árvore do Super cai na frente dele', () => {
  const s = prontaParaLutar(['toco', 'pipoca']);
  s.p[0].x = 120 * K.U; s.p[1].x = 220 * K.U;
  K.passo(s, [B.S, 0]);
  let caiu = false;
  for (let i = 0; i < 120; i++) { K.passo(s, [0, 0]); if (s.p[1].estado === 'caido') caiu = true; }
  assert.ok(caiu, 'a tora deveria derrubar');
  const vida = s.p[1].vida;
  roteiro(s, [[0, 0, 90]]);
  s.p[0].poder = K.PODER_MAX; s.p[0].x = 120 * K.U; s.p[1].x = 220 * K.U;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 120]]);
  assert.ok(s.p[1].vida < vida - 150, 'a árvore deveria acertar');
});

test('pista de gelo da Nix faz o outro escorregar', () => {
  const s = prontaParaLutar(['nix', 'uivo']);
  s.p[0].poder = K.PODER_MAX; s.p[0].x = 120 * K.U; s.p[1].x = 250 * K.U;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 200]]);
  assert.ok(s.gelo.f > 0, 'o chão deveria estar congelado');
  roteiro(s, [[0, B.L, 30]]); // anda em direção à Nix...
  K.passo(s, [0, 0]); // ...e solta: no gelo não para na hora
  assert.notStrictEqual(s.p[1].vx, 0, 'deveria continuar escorregando');
  roteiro(s, [[0, 0, 500]]);
  assert.strictEqual(s.gelo.f, 0, 'o gelo derrete depois de um tempo');
});

test('onda sonora do Eco empurra para longe', () => {
  const s = prontaParaLutar(['eco', 'kira']);
  s.p[0].x = 120 * K.U; s.p[1].x = 200 * K.U;
  const antes = s.p[1].x;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 50]]);
  assert.ok(s.p[1].vida < K.LUTADORES.kira.vida);
  assert.ok(s.p[1].x - antes > 20 * K.U, 'deveria empurrar');
});

test('Truque some na fumaça e aparece atrás do adversário', () => {
  const s = prontaParaLutar(['truque', 'uivo']);
  s.p[0].x = 150 * K.U; s.p[1].x = 220 * K.U;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 14]]);
  assert.ok(s.p[0].x > s.p[1].x, 'deveria estar do outro lado');
  roteiro(s, [[0, 0, 20]]);
  assert.ok(s.p[1].vida < K.LUTADORES.uivo.vida, 'deveria acertar ao reaparecer');
});

test('cartola do Truque prende quem não defende em pé', () => {
  const s = prontaParaLutar(['truque', 'pipoca']);
  s.p[0].x = 120 * K.U; s.p[1].x = 200 * K.U; s.p[0].poder = K.PODER_MAX;
  K.passo(s, [B.S, 0]);
  roteiro(s, [[0, 0, 60]]);
  assert.strictEqual(s.p[1].prende, 'cartola');
});

test('agarrão especial do Kilo pega de mais longe e não dá para defender', () => {
  const s = prontaParaLutar(['kilo', 'nix']);
  s.p[0].x = 150 * K.U; s.p[1].x = 196 * K.U; // longe demais para o agarrão comum
  K.passo(s, [B.S, B.D_]);
  roteiro(s, [[0, B.D_, 20]]);
  assert.ok(s.p[1].vida <= K.LUTADORES.nix.vida - 150, 'deveria ter agarrado mesmo defendendo');
});

test('Fóssil defende especiais sem levar raspão', () => {
  const s = prontaParaLutar(['volt', 'fossil']);
  s.p[0].x = 120 * K.U; s.p[1].x = 220 * K.U;
  K.passo(s, [B.S, B.D_]);
  roteiro(s, [[0, B.D_, 60]]);
  assert.strictEqual(s.p[1].vida, K.LUTADORES.fossil.vida);
});

test('onda gigante do Maré não dá para pular por cima', () => {
  const s = prontaParaLutar(['mare', 'kira']);
  s.p[0].x = 100 * K.U; s.p[1].x = 260 * K.U; s.p[0].poder = K.PODER_MAX;
  K.passo(s, [B.S, 0]);
  let pegou = false;
  for (let i = 0; i < 160; i++) { K.passo(s, [0, i % 40 === 20 ? B.U : 0]); if (s.p[1].vida < K.LUTADORES.kira.vida) pegou = true; }
  assert.ok(pegou, 'a onda deveria pegar mesmo pulando');
});

test('rasteira derruba o boneco no lugar (não escorrega deitado)', () => {
  const s = prontaParaLutar(['pipoca', 'pipoca']);
  colar(s);
  let caiu = false, medindo = false, xMax = -Infinity, xMin = Infinity, vxSuspeito = 0;
  for (let i = 0; i < 220; i++) {
    // p1 agachado dá rasteira (ck); p0 anda para a direita, em direção ao p1.
    K.passo(s, [B.R, B.D | (i % 10 === 0 ? B.K : 0)]);
    const v = s.p[0];
    const noChao_ = v.estado === 'caido' || v.estado === 'levantando';
    if (noChao_ && !medindo) { medindo = true; caiu = true; xMax = xMin = v.x; }
    if (medindo && noChao_) {
      xMax = Math.max(xMax, v.x); xMin = Math.min(xMin, v.x);
      if (v.vx !== 0) vxSuspeito++;
    }
    if (medindo && !noChao_) break; // fim da primeira queda basta
  }
  assert.ok(caiu, 'a rasteira deveria derrubar o boneco');
  assert.ok(xMax - xMin < 20 * K.U, 'escorregou deitado ' + (xMax - xMin) + ' unidades');
  assert.strictEqual(vxSuspeito, 0, 'o caído ficou com velocidade horizontal');
});

test('arrancada de moto do Volt e escada da Brasa acertam várias vezes', () => {
  for (const id of ['volt', 'brasa']) {
    const s = prontaParaLutar([id, 'uivo']);
    colar(s); s.p[0].poder = K.PODER_MAX;
    K.passo(s, [B.S, 0]);
    let maior = 0;
    for (let i = 0; i < 200; i++) { K.passo(s, [0, 0]); maior = Math.max(maior, s.p[1].combo); }
    assert.ok(maior >= 4, id + ' só fez ' + maior + ' hits');
  }
});

test('analógico: leve anda na metade da velocidade e o peteleco para trás vira recuo', () => {
  const andar = (bits) => {
    const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
    s.fase = 'luta'; const x0 = s.p[0].x;
    for (let i = 0; i < 30; i++) K.passo(s, [bits, 0]);
    return s.p[0].x - x0;
  };
  const normal = andar(K.B.R), leve = andar(K.B.R | K.B.LV);
  assert.ok(normal > 0 && leve > 0 && Math.abs(leve * 2 - normal) <= 60, `leve ${leve} ≈ metade de ${normal}`);
  const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
  s.fase = 'luta';
  K.passo(s, [K.B.L | K.B.RC, 0]);
  assert.equal(s.p[0].estado, 'recuo');
});
