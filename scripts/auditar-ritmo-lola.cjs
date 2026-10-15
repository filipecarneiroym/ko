// Auditoria reproduzível: entrada passa pelo leitor real de controle.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const K = require('../public/js/ko-sim.js');
const C = require('../public/js/ko-controle.js');
const CPU = require('../public/js/ko-cpu.js');
const { B } = K;
const relatorio = { golpes: [], defesa: [], lutas: [], movimentos: {} };
function controle(bits) {
  const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
  for (const [bit, botao] of [[B.P, 2], [B.K, 0], [B.F, 1], [B.S, 3], [B.L, 14], [B.R, 15], [B.U, 12], [B.D, 13]])
    if (bits & bit) pad.buttons[botao].pressed = true;
  const lido = C.ler(pad, C.PADRAO).bits;
  assert.equal(lido, bits); return lido;
}
function novo(lado = 0, perto = true) {
  const s = K.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta'; s.fT = 0;
  s.p[0].x = (perto ? 150 : 50) * K.U; s.p[1].x = (perto ? 180 : 330) * K.U;
  s.p[lado].poder = K.PODER_MAX; s.p[lado].revanche = K.ULTRA_MAX; return s;
}
const nomes = [...Object.keys(K.LUTADORES.pipoca.golpes), 'foc'];
for (const lado of [0, 1]) for (const nome of nomes) {
  const s = novo(lado, !['esp', 'espEx', 'ultra', 'ap', 'ak'].includes(nome)), l = s.p[lado];
  const frente = l.face > 0 ? B.R : B.L, tras = l.face > 0 ? B.L : B.R;
  const simples = { p1: B.P, cp: B.D | B.P, k1: B.K, ck: B.D | B.K, esp: B.S,
    dp: frente | B.S, tatsu: tras | B.S, espEx: B.S | B.P, dpEx: frente | B.S | B.P,
    tatsuEx: tras | B.S | B.P, sup: B.S | B.K, ultra: B.S | B.F };
  const vistos = new Set(), projeteis = new Set(), eventos = []; let combo = 0, inicio = null, fim = null;
  for (let i = 0; i < 240; i++) {
    let bits = i === 0 ? simples[nome] || 0 : 0;
    if (nome === 'foc') bits = i < 61 ? B.F : 0;
    if (['ap', 'ak'].includes(nome)) bits = i === 0 ? B.U : i === 6 ? (nome === 'ap' ? B.P : B.K) : 0;
    if (['p2', 'k2'].includes(nome)) {
      bits = i === 0 ? B.P : 0;
      if (l.golpe === 'p1' && l.encostou && combo === 0) { bits = B.P; combo = 1; }
      if (nome === 'k2' && l.golpe === 'p2' && l.encostou && combo === 1) { bits = B.K; combo = 2; }
    }
    const ent = [0, 0]; ent[lado] = controle(bits); K.passo(s, ent);
    if (l.golpe) vistos.add(l.golpe);
    for (const p of s.proj) if (p.dono === lado) projeteis.add(p);
    eventos.push(...s.ev);
    if (l.golpe === nome && inicio === null) inicio = i;
    if (inicio !== null && fim === null && l.golpe !== nome) fim = i;
  }
  assert.ok(vistos.has(nome), `${lado}: comando não iniciou ${nome}`);
  assert.equal(l.golpe, null, `${nome} preso em golpe`); assert.equal(l.estado, 'parado'); assert.equal(l.y, 0);
  const g = K.LUTADORES.pipoca.golpes[nome] || {};
  if (g.proj) assert.equal(projeteis.size, g.proj.quadros?.length || 1, `${nome}: quantidade de projéteis`);
  relatorio.golpes.push({ lado, nome, duracaoRegra: g.dur ?? null, duracaoMs: g.dur ? +(g.dur / 60 * 1000).toFixed(1) : null,
    primeiroAtivo: g.janelas?.[0]?.de ?? g.proj?.quadro, quadrosDecorridos: fim - inicio,
    acertos: eventos.filter(e => e.t === 'acerto' && e.lado === lado).length,
    projeteis: projeteis.size });
}
for (const lado of [0, 1]) for (const baixo of [false, true]) {
  const s = novo(lado), d = s.p[lado], tras = d.face > 0 ? B.L : B.R; let defesas = 0;
  for (let i = 0; i < 80; i++) {
    const ent = []; ent[lado] = controle(tras | (baixo ? B.D : 0));
    ent[1 - lado] = controle(i === 0 ? B.K | (baixo ? B.D : 0) : 0);
    K.passo(s, ent); defesas += s.ev.filter(e => e.t === 'defendeu' && e.lado === lado).length;
  }
  assert.ok(defesas > 0, `guarda ${baixo ? 'baixa' : 'alta'} lado ${lado}`);
  relatorio.defesa.push({ lado, baixa: baixo, bloqueios: defesas, vida: d.vida });
}
for (const [nome, entrada] of [['frente', B.R], ['tras', B.L]]) {
  const s = novo(0, false); s.p[0].x = 150 * K.U; const x = s.p[0].x;
  for (let i = 0; i < 30; i++) K.passo(s, [controle(entrada), 0]);
  relatorio.movimentos[nome] = { pixelsPorSegundo: Math.abs(s.p[0].x - x) / K.U * 2 };
}
{
  const s = novo(0, false); let pouso = 0, altura = 0;
  for (let i = 0; i < 100; i++) { K.passo(s, [controle(i === 0 ? B.U : 0), 0]);
    altura = Math.max(altura, s.p[0].y / K.U); if (i > 2 && s.p[0].estado === 'pousando') { pouso = i + 1; break; } }
  relatorio.movimentos.salto = { quadrosAtePouso: pouso, milissegundos: pouso / 60 * 1000, alturaPixels: altura };
}
for (const nivel of ['facil', 'medio', 'dificil']) {
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const s = K.novo({ lutadores: ['pipoca', 'pipoca'] }), a = CPU.criar(K, nivel, rnd), b = CPU.criar(K, nivel, rnd);
  const ev = {}; let passos = 0;
  while (s.fase !== 'fim' && passos++ < 24000) {
    // CPU usa D_ interno. Não remapear a guarda dela para Focus do gamepad.
    K.passo(s, [a(s, 0), b(s, 1)]);
    for (const e of s.ev) ev[e.t] = (ev[e.t] || 0) + 1;
  }
  assert.equal(s.fase, 'fim', `partida ${nivel} não terminou`); assert.ok(ev.acerto > 0);
  relatorio.lutas.push({ nivel, passos, segundosSimulados: +(passos / 60).toFixed(2), rounds: s.rounds, eventos: ev });
}
const saida = path.resolve(__dirname, '../art/premium/modelos-3d/auditoria-ritmo-lola.json');
fs.writeFileSync(saida, JSON.stringify(relatorio, null, 2) + '\n');
console.log(JSON.stringify({ golpes: relatorio.golpes.length, defesa: relatorio.defesa, movimentos: relatorio.movimentos, lutas: relatorio.lutas, saida }, null, 2));
