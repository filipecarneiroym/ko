/*
 * K.O — desenho: lutadores, cenários, placar e efeitos, em traço liso (estilo desenho animado).
 *
 * O mundo tem 384x216 "pontos" e é desenhado em alta resolução (conforme a tela do celular),
 * com contorno escuro e sombreado suave. Nada aqui muda a luta: só lê o estado de ko-sim.js.
 */
(function () {
  'use strict';
  const K = window.KOSim;
  const U = K.U, W = 384, H = 216, CHAO = 200;
  const CONTORNO = '#1a0f24';
  const FONTE = '"Arial Black", "Segoe UI Black", "Roboto Black", Impact, system-ui, sans-serif';

  // ---------- Esqueleto e poses ----------
  // Pontos a partir do pé (y negativo = para cima), olhando para a direita, corpo de 64 pontos.
  const BASE = { q: [0, -30], p: [1, -45], c: [3, -55], cf: [9, -40], mf: [13, -47], ct: [-3, -38], mt: [5, -45], jf: [6, -15], pf: [8, 0], jt: [-5, -15], pt: [-8, 0] };
  const mistura = (A, Bp, f) => { const o = {}; for (const k in A) o[k] = Bp[k] ? [A[k][0] + (Bp[k][0] - A[k][0]) * f, A[k][1] + (Bp[k][1] - A[k][1]) * f] : A[k]; return o; };
  const com = (base, mud) => Object.assign({}, base, mud);
  const mover = (P, dx, dy, chaves) => { const o = Object.assign({}, P); for (const k of chaves || Object.keys(P)) o[k] = [P[k][0] + dx, P[k][1] + dy]; return o; };
  const girar = (P, ang, cx, cy) => { const o = {}, c = Math.cos(ang), s = Math.sin(ang); for (const k in P) { const x = P[k][0] - cx, y = P[k][1] - cy; o[k] = [cx + x * c - y * s, cy + x * s + y * c]; } return o; };

  const AGACHADO = com(BASE, { q: [0, -18], p: [3, -31], c: [5, -40], cf: [11, -27], mf: [14, -33], ct: [0, -25], mt: [7, -31], jf: [11, -12], pf: [9, 0], jt: [-6, -10], pt: [-9, 0] });
  const PULO = com(BASE, { q: [0, -32], p: [1, -47], c: [3, -57], cf: [9, -52], mf: [12, -58], ct: [-5, -50], mt: [-2, -57], jf: [9, -26], pf: [5, -16], jt: [-3, -24], pt: [-8, -15] });
  const GOLPES = {
    p1: com(BASE, { p: [3, -45], c: [5, -55], cf: [16, -46], mf: [26, -47] }),
    p2: com(BASE, { q: [2, -30], p: [6, -45], c: [8, -55], ct: [15, -46], mt: [28, -48], cf: [9, -45], mf: [11, -51], jt: [-7, -14], pt: [-12, 0] }),
    k1: com(BASE, { q: [-2, -31], p: [-5, -45], c: [-4, -55], jf: [12, -29], pf: [28, -30], jt: [-4, -15], pt: [-5, 0], cf: [4, -42], mf: [9, -48] }),
    k2: com(BASE, { q: [-2, -32], p: [-7, -45], c: [-7, -55], jf: [10, -42], pf: [26, -50], jt: [-3, -16], pt: [-4, 0], cf: [-1, -38], mf: [5, -33], ct: [-11, -40], mt: [-15, -46] }),
    cp: com(AGACHADO, { p: [5, -31], c: [7, -40], cf: [17, -30], mf: [26, -31] }),
    ck: com(AGACHADO, { q: [-2, -12], p: [-6, -25], c: [-7, -34], jf: [14, -6], pf: [33, -3], jt: [-6, -6], pt: [-12, 0], cf: [-2, -18], mf: [3, -12], ct: [-10, -18], mt: [-12, -10] }),
    ap: com(PULO, { cf: [15, -42], mf: [24, -36], p: [3, -46], c: [5, -56] }),
    ak: com(PULO, { jf: [12, -24], pf: [26, -20], jt: [-2, -24], pt: [-8, -16] }),
  };
  const DEFESA = com(BASE, { cf: [10, -45], mf: [10, -54], ct: [6, -42], mt: [11, -49], p: [0, -45], c: [1, -55] });
  const DANO = com(BASE, { q: [-2, -30], p: [-6, -44], c: [-10, -52], cf: [-2, -48], mf: [4, -54], ct: [-12, -44], mt: [-18, -50], jf: [5, -15], pf: [9, 0], jt: [-6, -14], pt: [-10, 0] });
  const CAIDO = { q: [-4, -5], p: [-19, -6], c: [-30, -7], cf: [-14, -3], mf: [-6, -2], ct: [-22, -2], mt: [-14, -1], jf: [7, -9], pf: [19, -3], jt: [6, -5], pt: [19, -1] };
  const VITORIA = com(BASE, { cf: [5, -60], mf: [8, -73], ct: [-6, -40], mt: [-3, -33] });
  const CORRIDA = com(BASE, { q: [1, -29], p: [7, -42], c: [11, -51], cf: [14, -36], mf: [18, -42], ct: [-2, -34], mt: [-6, -28] });

  function poseDe(l) {
    const propria = ARTE[l.id].pose && ARTE[l.id].pose(l);
    if (propria) return propria;
    const t = l.t;
    const respira = Math.sin(t / 14) * 0.8;
    switch (l.estado) {
      case 'parado': case 'pousando': return mover(BASE, 0, respira, ['p', 'c', 'cf', 'mf', 'ct', 'mt']);
      case 'andando': {
        const a = Math.sin(t / 5) * 5, b = Math.abs(Math.cos(t / 5)) * 3;
        return com(BASE, { pf: [8 + a, 0], jf: [6 + a / 2, -15 - b], pt: [-8 - a, 0], jt: [-5 - a / 2, -15 - (3 - b)] });
      }
      case 'corrida': {
        const a = Math.sin(t / 2.6) * 10, sobe = Math.max(0, Math.cos(t / 2.6)) * 6;
        return com(CORRIDA, { pf: [6 + a, -sobe], jf: [8 + a / 2, -16], pt: [-6 - a, -(6 - sobe)], jt: [-2 - a / 2, -16], mf: [18 - a * 0.6, -42], mt: [-6 + a * 0.6, -30] });
      }
      case 'agachado': return mover(AGACHADO, 0, respira, ['p', 'c', 'cf', 'mf', 'ct', 'mt']);
      case 'pulo': return l.vy > 40 ? mistura(BASE, PULO, 0.6) : PULO;
      case 'defesa': return DEFESA;
      case 'defesaBaixa': return com(AGACHADO, { cf: [10, -31], mf: [11, -40], ct: [6, -28], mt: [12, -35] });
      case 'dano': case 'agarrado': return l.y > 0 ? girar(DANO, -0.5, 0, -30) : DANO;
      case 'quebra': return com(BASE, { cf: [14, -50], mf: [22, -58], ct: [-10, -50], mt: [-18, -58], p: [0, -47], c: [1, -57] });
      case 'caido': case 'derrotado': return CAIDO;
      case 'levantando': return mistura(CAIDO, AGACHADO, Math.min(1, t / 14));
      case 'rolando': return girar(com(PULO, { q: [0, -16], p: [3, -24], c: [8, -27], jf: [8, -14], pf: [2, -6], jt: [0, -12], pt: [-6, -6], cf: [8, -20], mf: [4, -14], ct: [2, -20], mt: [-2, -14] }), (t / 24) * Math.PI * 2, 0, -16);
      case 'recuo': return mistura(BASE, DANO, 0.4);
      case 'vitoria': case 'final': return mover(VITORIA, 0, Math.sin(t / 6) * 1.2);
      case 'tonto': return girar(DANO, Math.sin(t / 9) * 0.18, 0, 0);
      case 'agarrando': return t < 10 ? com(BASE, { cf: [16, -44], mf: [24, -46], ct: [12, -40], mt: [22, -42] }) : com(BASE, { p: [-6, -44], c: [-9, -53], cf: [-8, -50], mf: [-16, -56], ct: [-10, -46], mt: [-18, -50] });
      case 'golpe': return poseGolpe(l);
      default: return BASE;
    }
  }

  // Golpe em três tempos: prepara, acerta (pose cheia), volta.
  function poseGolpe(l) {
    if (l.golpe === 'esp' || l.golpe === 'sup') return ARTE[l.id].poseEspecial(l);
    const g = K.LUTADORES[l.id].golpes[l.golpe], js = g.janelas || [];
    const ini = js.length ? js[0].de : 8, fim = js.length ? js[js.length - 1].ate : ini + 4;
    const neutra = l.y > 0 ? PULO : (l.golpe === 'cp' || l.golpe === 'ck' ? AGACHADO : BASE);
    const t = l.t, ease = (x) => 1 - (1 - x) * (1 - x);
    const f = t < ini ? ease(t / Math.max(1, ini)) : t <= fim ? 1 : 1 - (t - fim) / Math.max(1, g.dur - fim);
    return mistura(neutra, GOLPES[l.golpe], Math.max(0, Math.min(1, f)));
  }

  // ---------- Pincel: o mesmo desenho serve para o contorno, a cor e o "piscar branco" ----------
  // Primeiro tudo é desenhado mais grosso em cor escura (contorno), depois por cima com as cores.
  function pincel(g, modo) {
    const contorno = modo === 'contorno', branco = modo === 'branco' || modo === 'madeira' || modo === 'gelo' || modo === 'choque';
    const liso = modo === 'madeira' ? '#b07a44' : modo === 'gelo' ? '#bfe6ff' : modo === 'choque' ? '#fff36a' : '#ffffff';
    const cor = (c) => (contorno ? CONTORNO : branco ? liso : c);
    const extra = contorno ? 2.2 : 0;
    const P = {
      g, contorno, colorido: !contorno && !branco,
      membro(pts, raio, c, claro) {
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = cor(c); g.lineWidth = raio * 2 + extra;
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
        if (P.colorido && claro) {
          g.strokeStyle = claro; g.lineWidth = raio * 0.8; g.globalAlpha = 0.55;
          g.beginPath(); g.moveTo(pts[0][0] - raio * 0.3, pts[0][1] - raio * 0.35); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] - raio * 0.3, pts[i][1] - raio * 0.35); g.stroke();
          g.globalAlpha = 1;
        }
      },
      bola(x, y, r, c, claro) {
        g.beginPath(); g.arc(x, y, r + extra / 2, 0, Math.PI * 2);
        if (P.colorido && claro) { const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r); gr.addColorStop(0, claro); gr.addColorStop(1, c); g.fillStyle = gr; } else g.fillStyle = cor(c);
        g.fill();
      },
      elipse(x, y, rx, ry, rot, c, claro) {
        g.beginPath(); g.ellipse(x, y, rx + extra / 2, ry + extra / 2, rot || 0, 0, Math.PI * 2);
        if (P.colorido && claro) { const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, Math.max(rx, ry)); gr.addColorStop(0, claro); gr.addColorStop(1, c); g.fillStyle = gr; } else g.fillStyle = cor(c);
        g.fill();
      },
      forma(desenho, c) {
        g.beginPath(); desenho(g); g.fillStyle = cor(c); g.fill();
        if (contorno) { g.lineWidth = extra; g.lineJoin = 'round'; g.strokeStyle = CONTORNO; g.stroke(); }
      },
      detalhe(f) { if (P.colorido) f(g); },
    };
    return P;
  }

  const angulo = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const ponto = (a, ang, d) => [a[0] + Math.cos(ang) * d, a[1] + Math.sin(ang) * d];

  function olho(P, x, y, l, iris, tam) {
    const s = tam || 1;
    P.detalhe((g) => {
      if (l.estado === 'tonto' || l.estado === 'derrotado' || l.estado === 'vitimaFinal') {
        g.strokeStyle = CONTORNO; g.lineWidth = 0.7; g.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.3) { const r = a * 0.18 * s; g.lineTo(x + Math.cos(a + l.t / 4) * r, y + Math.sin(a + l.t / 4) * r); }
        g.stroke(); return;
      }
      if (l.estado === 'dano' || l.estado === 'caido' || l.estado === 'agarrado') {
        g.strokeStyle = CONTORNO; g.lineWidth = 0.9; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - 1.6 * s, y - 1.4 * s); g.lineTo(x + 1.2 * s, y); g.lineTo(x - 1.6 * s, y + 1.4 * s); g.stroke(); return;
      }
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, 1.9 * s, 2.5 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = iris || CONTORNO; g.beginPath(); g.ellipse(x + 0.6 * s, y + 0.2 * s, 1.25 * s, 1.75 * s, 0, 0, Math.PI * 2); g.fill();
      if (iris) { g.fillStyle = CONTORNO; g.beginPath(); g.ellipse(x + 0.8 * s, y + 0.3 * s, 0.6 * s, 1.1 * s, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 0.1 * s, y - 0.8 * s, 0.55 * s, 0, Math.PI * 2); g.fill();
      g.strokeStyle = CONTORNO; g.lineWidth = 0.7; g.beginPath(); g.ellipse(x, y, 1.9 * s, 2.5 * s, 0, 0, Math.PI * 2); g.stroke();
    });
  }

  // ---------- Os lutadores ----------
  const ARTE = {
    pipoca: {
      escala: 60 / 64,
      cor: { pelo: '#f8f1e4', peloT: '#e4d6c0', claro: '#ffffff', luva: '#e8383d', luvaC: '#ff8a8f', luvaT: '#b5222b', short: '#2f6fd6', shortC: '#6ea0ff', rosa: '#ff9fb4' },
      desenhar(P, J, l) {
        const c = this.cor;
        P.bola(J.q[0] - 8, J.q[1] - 1, 3.4, c.pelo, c.claro);
        P.membro([J.q, J.jt, J.pt], 3, c.peloT);
        P.elipse(J.pt[0] + 2.5, J.pt[1] - 1.4, 5.5, 2.3, 0, c.peloT);
        P.membro([J.p, J.ct, J.mt], 2.1, c.peloT);
        P.bola(J.mt[0], J.mt[1], 4, c.luvaT, c.luva);
        P.membro([J.q, J.p], 6.2, c.pelo, c.claro);
        P.detalhe((g) => { g.fillStyle = '#fffaf2'; g.beginPath(); g.ellipse((J.q[0] + J.p[0]) / 2 + 2.2, (J.q[1] + J.p[1]) / 2, 3.2, 5.4, angulo(J.q, J.p) + Math.PI / 2, 0, Math.PI * 2); g.fill(); });
        P.elipse(J.q[0], J.q[1] + 1, 7, 5.6, 0, c.short, c.shortC);
        P.detalhe((g) => { g.fillStyle = '#ffffff'; g.fillRect(J.q[0] - 6.6, J.q[1] - 4.4, 13.2, 1.6); g.fillStyle = '#ffd23f'; g.fillRect(J.q[0] - 1, J.q[1] - 4.4, 2, 1.6); });
        const cab = J.c, cai = l.estado === 'dano' || l.estado === 'caido' ? -0.6 : l.estado === 'corrida' ? -0.5 : 0;
        for (const [ox, inc, alt] of [[-2.2, -0.32, 21], [2, -0.08, 20]]) {
          const base = [cab[0] + ox, cab[1] - 4.5], ang = -Math.PI / 2 + inc + cai + Math.sin((l.t || 0) / 10 + ox) * 0.06;
          const meio = ponto(base, ang, alt / 2);
          P.elipse(meio[0], meio[1], 3.2, alt / 2, ang + Math.PI / 2, c.pelo, c.claro);
          P.detalhe((g) => { g.fillStyle = c.rosa; g.beginPath(); g.ellipse(meio[0] + 0.3, meio[1], 1.3, alt / 2 - 2.6, ang + Math.PI / 2, 0, Math.PI * 2); g.fill(); });
        }
        P.bola(cab[0], cab[1], 7.6, c.pelo, c.claro);
        P.detalhe((g) => {
          g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cab[0] + 4.2, cab[1] + 2.8, 3.6, 2.6, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = c.rosa; g.beginPath(); g.ellipse(cab[0] + 7.1, cab[1] + 1.2, 1.4, 1.1, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,120,150,0.35)'; g.beginPath(); g.arc(cab[0] + 1.2, cab[1] + 3.4, 1.8, 0, Math.PI * 2); g.fill();
          g.strokeStyle = CONTORNO; g.lineWidth = 0.6; g.beginPath(); g.moveTo(cab[0] + 7, cab[1] + 2.2); g.quadraticCurveTo(cab[0] + 6.4, cab[1] + 4.2, cab[0] + 4.8, cab[1] + 4); g.stroke();
        });
        olho(P, cab[0] + 3.4, cab[1] - 1.6, l);
        P.membro([J.q, J.jf, J.pf], 3.4, c.pelo, c.claro);
        P.elipse(J.pf[0] + 3.2, J.pf[1] - 1.5, 6.4, 2.6, 0, c.pelo, c.claro);
        P.membro([J.p, J.cf, J.mf], 2.4, c.pelo, c.claro);
        P.detalhe((g) => { const a = angulo(J.cf, J.mf), p = ponto(J.mf, a + Math.PI, 3.6); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(p[0], p[1], 2.4, 0, Math.PI * 2); g.fill(); });
        P.bola(J.mf[0], J.mf[1], 4.8, c.luva, c.luvaC);
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return t < 10 ? com(BASE, { cf: [-6, -52], mf: [-12, -60], p: [-2, -45], c: [-1, -55] }) : com(BASE, { cf: [14, -48], mf: [24, -44], p: [5, -44], c: [7, -54], ct: [-8, -38], mt: [-12, -34] });
        if (t < 44) return com(AGACHADO, { q: [0, -12], p: [3, -22], c: [6, -30], mf: [12, -6], cf: [10, -14], mt: [-6, -6], ct: [-4, -14] });
        return com(BASE, { q: [0, -34], p: [1, -50], c: [2, -60], cf: [6, -62], mf: [8, -76], jf: [4, -18], pf: [2, -6], jt: [-4, -18], pt: [-6, -6] });
      },
    },
    uivo: {
      escala: 66 / 64,
      cor: { pelo: '#9aa3b8', peloC: '#d3d8e3', peloT: '#7d8599', claro: '#eef1f6', colete: '#7a3fc0', coleteC: '#a774e8', calca: '#2c2a3d', calcaC: '#4a4766', faixaC: '#fffaf0', olho: '#ffd23f' },
      desenhar(P, J, l) {
        const c = this.cor, abana = Math.sin((l.t || 0) / 6) * 0.25;
        const base = [J.q[0] - 4, J.q[1] - 2], ang = Math.PI + 0.6 + abana, meio = ponto(base, ang, 8), ponta = ponto(base, ang, 15);
        P.elipse(meio[0], meio[1], 9, 4.4, ang, c.pelo, c.peloC);
        P.elipse(ponta[0], ponta[1], 3.2, 2.6, ang, c.claro);
        P.membro([J.q, J.jt, J.pt], 4, c.calca);
        P.elipse(J.pt[0] + 2.5, J.pt[1] - 1.6, 5.4, 2.4, 0, c.peloT);
        P.membro([J.p, J.ct, J.mt], 3, c.peloT);
        P.bola(J.mt[0], J.mt[1], 3.8, '#c9b98f', '#efe2c2');
        P.membro([J.q, J.p], 7.6, c.colete, c.coleteC);
        P.detalhe((g) => {
          const a = angulo(J.q, J.p), topo = ponto(J.p, a + Math.PI, -2), fundo = ponto(J.q, a, 5);
          g.fillStyle = c.claro; g.beginPath(); g.moveTo(topo[0] - 2.5, topo[1]); g.lineTo(topo[0] + 5, topo[1] + 1); g.lineTo(fundo[0] + 2.5, fundo[1]); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(26,15,36,0.35)'; g.lineWidth = 0.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(topo[0] + 1 + i, topo[1] + 2 + i * 2.6); g.lineTo(topo[0] + 3 + i, topo[1] + 3 + i * 2.6); g.stroke(); }
        });
        P.elipse(J.q[0], J.q[1] + 1.5, 7, 5.4, 0, c.calca, c.calcaC);
        P.detalhe((g) => { g.fillStyle = '#c9a227'; g.fillRect(J.q[0] - 6.8, J.q[1] - 3.4, 13.6, 1.8); });
        const cab = J.c, uiva = l.estado === 'golpe' && l.golpe === 'esp' && l.t >= 8 && l.t <= 24;
        P.forma((g) => { g.moveTo(cab[0] - 6.5, cab[1] - 2); g.lineTo(cab[0] - 4.4, cab[1] - 15); g.lineTo(cab[0] + 0.5, cab[1] - 4.5); g.closePath(); }, c.peloT);
        P.forma((g) => { g.moveTo(cab[0] - 1, cab[1] - 4); g.lineTo(cab[0] + 2.4, cab[1] - 16); g.lineTo(cab[0] + 5.6, cab[1] - 3.5); g.closePath(); }, c.pelo);
        P.detalhe((g) => { g.fillStyle = '#e7a3b0'; g.beginPath(); g.moveTo(cab[0] + 0.6, cab[1] - 5); g.lineTo(cab[0] + 2.4, cab[1] - 12.5); g.lineTo(cab[0] + 4.2, cab[1] - 5); g.fill(); });
        P.bola(cab[0], cab[1], 7.7, c.pelo, c.peloC);
        const boca = uiva ? 3 : 0;
        P.elipse(cab[0] + 7, cab[1] + 1.8 - boca / 2, 6.4, 3.3, -0.05, c.claro);
        if (uiva) P.elipse(cab[0] + 6.4, cab[1] + 5, 5, 2, 0.15, c.claro);
        P.detalhe((g) => {
          if (uiva) { g.fillStyle = '#7a1f35'; g.beginPath(); g.ellipse(cab[0] + 7.5, cab[1] + 3, 3.6, 1.6, 0, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = CONTORNO; g.beginPath(); g.ellipse(cab[0] + 12.6, cab[1] + 0.8 - boca / 2, 1.8, 1.4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(cab[0] + 12.2, cab[1] + 0.2 - boca / 2, 0.5, 0, Math.PI * 2); g.fill();
          g.fillStyle = c.claro; g.beginPath(); g.ellipse(cab[0] - 1.6, cab[1] + 4, 3.4, 2.4, 0, 0, Math.PI * 2); g.fill();
          g.strokeStyle = CONTORNO; g.lineWidth = 1; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 0.6, cab[1] - 5.2); g.lineTo(cab[0] + 5.6, cab[1] - 3.6); g.stroke();
        });
        olho(P, cab[0] + 3.4, cab[1] - 1.4, l, c.olho);
        P.membro([J.q, J.jf, J.pf], 4.2, c.calca, c.calcaC);
        P.elipse(J.pf[0] + 3.2, J.pf[1] - 1.6, 5.8, 2.6, 0, c.pelo, c.peloC);
        P.detalhe((g) => { g.strokeStyle = CONTORNO; g.lineWidth = 0.6; for (const dx of [6.5, 8.5]) { g.beginPath(); g.moveTo(J.pf[0] + dx, J.pf[1] - 2.6); g.lineTo(J.pf[0] + dx, J.pf[1] - 0.5); g.stroke(); } });
        P.membro([J.p, J.cf, J.mf], 3.2, c.pelo, c.peloC);
        P.bola(J.mf[0], J.mf[1], 4.3, '#d8c9a2', c.faixaC);
        P.detalhe((g) => { g.strokeStyle = '#a8946a'; g.lineWidth = 0.7; for (const dy of [-1.6, 0.8]) { g.beginPath(); g.moveTo(J.mf[0] - 3.4, J.mf[1] + dy); g.lineTo(J.mf[0] + 3.2, J.mf[1] + dy + 0.6); g.stroke(); } });
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') {
          return t < 8 ? com(BASE, { p: [-2, -44], c: [-2, -53], cf: [4, -36], mf: [8, -30], ct: [-6, -36], mt: [-4, -30] })
            : com(BASE, { p: [2, -47], c: [5, -59], cf: [12, -50], mf: [20, -56], ct: [-8, -50], mt: [-16, -56], jt: [-8, -14], pt: [-13, 0] });
        }
        const garra = [[6, 12], [20, 26], [34, 42]].some(([a, b]) => t >= a - 2 && t <= b);
        return garra ? com(BASE, { q: [4, -26], p: [12, -38], c: [16, -46], cf: [22, -40], mf: [32, -46], ct: [6, -34], mt: [16, -30], jf: [12, -12], pf: [16, 0], jt: [-6, -12], pt: [-14, 0] })
          : com(AGACHADO, { p: [6, -30], c: [9, -38], cf: [10, -22], mf: [6, -16], ct: [-2, -22], mt: [-6, -16] });
      },
    },

    maromba: {
      escala: 70 / 64,
      cor: { pele: '#d98b55', peleC: '#ffc48f', peleS: '#a5603a', sunga: '#e8383d', sungaC: '#ff7a7f', ouro: '#ffd23f', cabelo: '#2a1a12', tenis: '#ffffff' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando') { // braços abertos de quem acabou de treinar
          const r = Math.sin(t / 14) * 0.8;
          return com(BASE, { p: [1, -45 + r], c: [3, -56 + r], cf: [13, -38 + r], mf: [17, -45 + r], ct: [-9, -38 + r], mt: [-5, -45 + r], pf: [10, 0], pt: [-10, 0], jf: [8, -15], jt: [-7, -15] });
        }
        if (l.estado === 'final') { // supino com o adversário: sobe e desce
          const rep = Math.sin(t / 8) * 4;
          return com(BASE, { cf: [9, -60 + rep], mf: [5, -72 + rep], ct: [-9, -60 + rep], mt: [-5, -72 + rep], pf: [10, 0], pt: [-10, 0] });
        }
        if (l.estado === 'vitoria') return com(BASE, { cf: [12, -52], mf: [10, -64], ct: [-10, -52], mt: [-8, -64], pf: [10, 0], pt: [-10, 0], c: [3, -56 + Math.sin(t / 6)] });
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor;
        const meioBraco = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        // perna e braço de trás
        P.membro([J.q, J.jt, J.pt], 4.6, c.peleS);
        P.elipse(J.pt[0] + 2.5, J.pt[1] - 1.8, 5.8, 2.6, 0, '#dcdcdc');
        P.membro([J.p, J.ct, J.mt], 3.8, c.peleS);
        P.bola(meioBraco(J.p, J.ct)[0], meioBraco(J.p, J.ct)[1], 4.8, c.peleS);
        P.bola(J.mt[0], J.mt[1], 4, c.peleS);
        // tronco em V: ombros largos, cintura fina
        const a = angulo(J.q, J.p), lado = a + Math.PI / 2;
        const o1 = ponto(J.p, lado, 11), o2 = ponto(J.p, lado, -11), c1 = ponto(J.q, lado, 6), c2 = ponto(J.q, lado, -6);
        P.forma((g) => { g.moveTo(o1[0], o1[1]); g.quadraticCurveTo(J.p[0], J.p[1] - 5, o2[0], o2[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c1[0], c1[1]); g.closePath(); }, c.pele);
        P.detalhe((g) => {
          const peito = ponto(J.p, a + Math.PI, -4.5);
          const gr = g.createRadialGradient(peito[0] - 2, peito[1] - 2, 1, peito[0], peito[1], 10); gr.addColorStop(0, c.peleC); gr.addColorStop(1, 'rgba(255,196,143,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(peito[0], peito[1], 10, 0, Math.PI * 2); g.fill();
          g.strokeStyle = c.peleS; g.lineWidth = 0.8; g.lineCap = 'round';
          g.beginPath(); g.moveTo(peito[0] - 6, peito[1] + 2.5); g.quadraticCurveTo(peito[0], peito[1] + 5, peito[0] + 6, peito[1] + 2.5); g.stroke(); // peitoral
          g.beginPath(); g.moveTo(peito[0], peito[1] - 2); g.lineTo(peito[0], peito[1] + 4); g.stroke();
          for (let i = 0; i < 3; i++) { const b = ponto(peito, a + Math.PI, -6 - i * 3.4); g.beginPath(); g.moveTo(b[0] - 3, b[1]); g.lineTo(b[0] + 3, b[1]); g.stroke(); } // gominhos
          g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(o1[0] - 1.5, o1[1] + 1.5, 1.6, 0.8, -0.5, 0, Math.PI * 2); g.fill(); // brilho do óleo
        });
        P.elipse(J.q[0], J.q[1] + 1.5, 7.4, 5.4, 0, c.sunga, c.sungaC);
        P.detalhe((g) => { g.fillStyle = c.ouro; g.fillRect(J.q[0] - 7, J.q[1] - 3.4, 14, 2); });
        // cabeça pequena, cabelo reto e faixa
        const cab = J.c;
        P.membro([J.p, ponto(J.p, a, -3)], 3.6, c.pele); // pescoço grosso
        P.bola(cab[0], cab[1], 6.4, c.pele, c.peleC);
        P.forma((g) => { g.roundRect(cab[0] - 6.2, cab[1] - 10, 12, 5.5, 1.5); }, c.cabelo);
        P.detalhe((g) => {
          g.fillStyle = c.ouro; g.fillRect(cab[0] - 6.4, cab[1] - 5.2, 12.8, 1.8);
          g.strokeStyle = CONTORNO; g.lineWidth = 1.1; g.lineCap = 'round';
          g.beginPath(); g.moveTo(cab[0] + 1.5, cab[1] - 2.6); g.lineTo(cab[0] + 5, cab[1] - 2.2); g.stroke(); // sobrancelha
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cab[0] + 1.6, cab[1] + 2.4); g.quadraticCurveTo(cab[0] + 4, cab[1] + 5, cab[0] + 6, cab[1] + 2.2); g.closePath(); g.fill(); // sorrisão
          g.strokeStyle = CONTORNO; g.lineWidth = 0.6; g.stroke();
        });
        olho(P, cab[0] + 3.4, cab[1] - 0.6, l, null, 0.8);
        // perna e braço da frente, bíceps enorme
        P.membro([J.q, J.jf, J.pf], 4.8, c.pele, c.peleC);
        P.elipse(J.pf[0] + 3, J.pf[1] - 1.8, 6, 2.7, 0, c.tenis);
        P.membro([J.p, J.cf, J.mf], 4, c.pele, c.peleC);
        const bi = meioBraco(J.p, J.cf);
        P.bola(bi[0], bi[1] - 1, 5.2, c.pele, c.peleC);
        P.bola(J.mf[0], J.mf[1], 4.4, c.pele, c.peleC);
      },
      poseEspecial(l) {
        const t = l.t;
        const bicepsDuplo = com(BASE, { cf: [12, -52], mf: [10, -64], ct: [-10, -52], mt: [-8, -64], p: [1, -46], c: [2, -56], pf: [10, 0], pt: [-10, 0] });
        if (l.golpe === 'esp') return t < 4 ? mistura(BASE, bicepsDuplo, t / 4) : mover(bicepsDuplo, 0, Math.sin(t / 3) * 0.6, ['cf', 'mf', 'ct', 'mt']);
        if (t < 40) {
          const poses = [bicepsDuplo, com(BASE, { cf: [14, -40], mf: [6, -34], ct: [-12, -40], mt: [-4, -34], pf: [10, 0], pt: [-10, 0] }), com(BASE, { p: [3, -46], cf: [10, -42], mf: [4, -38], ct: [6, -40], mt: [0, -38], jf: [8, -16], pf: [4, 0] })];
          return poses[Math.floor(t / 9) % 3];
        }
        return com(BASE, { q: [4, -28], p: [12, -40], c: [16, -48], cf: [18, -38], mf: [14, -30], ct: [2, -36], mt: [-4, -30], jf: [12, -14], pf: [16, 0], jt: [-6, -12], pt: [-14, 0] }); // ombrada
      },
    },
    ginga: {
      escala: 62 / 64,
      cor: { pele: '#8d5524', peleC: '#c58a4d', peleS: '#6a3d19', calca: '#f4f1ea', calcaS: '#c9c3b5', corda: '#2fb36b', corda2: '#ffd23f', cabelo: '#1a120c' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'andando') { // a ginga: balanço de um lado para o outro
          const GA = com(BASE, { q: [0, -27], p: [2, -41], c: [4, -51], jf: [9, -14], pf: [14, 0], jt: [-6, -12], pt: [-12, 0], cf: [8, -46], mf: [10, -54], ct: [-8, -34], mt: [-14, -28] });
          const GB = com(BASE, { q: [-2, -27], p: [-1, -41], c: [1, -51], jf: [4, -13], pf: [6, 0], jt: [-10, -14], pt: [-18, 0], cf: [12, -36], mf: [16, -30], ct: [-2, -46], mt: [2, -54] });
          return mistura(GA, GB, (Math.sin(t / (l.estado === 'andando' ? 6 : 11)) + 1) / 2);
        }
        if (l.estado === 'final' || l.estado === 'vitoria') return girar(com(BASE, { cf: [10, -60], mf: [12, -72], ct: [-8, -60], mt: [-10, -72], pf: [12, -4], pt: [-12, -4] }), l.estado === 'final' ? t / 7 : 0, 0, -34);
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor;
        P.membro([J.q, J.jt, J.pt], 4, c.calcaS);
        P.elipse(J.pt[0] + 2.2, J.pt[1] - 1.2, 4.6, 2, 0, c.peleS);
        P.membro([J.p, J.ct, J.mt], 2.5, c.peleS);
        P.bola(J.mt[0], J.mt[1], 3, c.peleS);
        P.membro([J.q, J.p], 5.4, c.pele, c.peleC);
        P.detalhe((g) => {
          const a = angulo(J.q, J.p), peito = ponto(J.p, a + Math.PI, -4);
          g.strokeStyle = c.peleS; g.lineWidth = 0.7; g.lineCap = 'round';
          g.beginPath(); g.moveTo(peito[0] - 4, peito[1] + 2); g.quadraticCurveTo(peito[0], peito[1] + 3.6, peito[0] + 4, peito[1] + 2); g.stroke();
          for (let i = 0; i < 2; i++) { const b = ponto(peito, a + Math.PI, -6 - i * 3.2); g.beginPath(); g.moveTo(b[0] - 2, b[1]); g.lineTo(b[0] + 2, b[1]); g.stroke(); }
        });
        P.elipse(J.q[0], J.q[1] + 1.5, 6.4, 5, 0, c.calca);
        // corda da capoeira (verde e amarela) com a ponta pendurada
        P.detalhe((g) => {
          g.lineCap = 'round';
          for (const [cor, dy] of [[c.corda, -2.6], [c.corda2, -1.4]]) { g.strokeStyle = cor; g.lineWidth = 1.2; g.beginPath(); g.moveTo(J.q[0] - 6, J.q[1] + dy); g.lineTo(J.q[0] + 6, J.q[1] + dy); g.stroke(); }
          g.strokeStyle = c.corda; g.lineWidth = 1.2; g.beginPath(); g.moveTo(J.q[0] + 3, J.q[1] - 2); g.quadraticCurveTo(J.q[0] + 5, J.q[1] + 4, J.q[0] + 3 + Math.sin((l.t || 0) / 6), J.q[1] + 8); g.stroke();
        });
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.8, c.pele, c.peleC);
        for (const [dx, dy] of [[-4, -4], [-1, -6], [2.5, -5.6], [-5.5, -0.5], [5, -3.4]]) P.bola(cab[0] + dx, cab[1] + dy, 2.6, c.cabelo);
        P.detalhe((g) => {
          g.fillStyle = c.corda; g.fillRect(cab[0] - 6.6, cab[1] - 3.8, 13, 1.4); g.fillStyle = c.corda2; g.fillRect(cab[0] - 6.6, cab[1] - 2.4, 13, 1);
          g.strokeStyle = CONTORNO; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 2.6, cab[1] + 3.4); g.quadraticCurveTo(cab[0] + 4.4, cab[1] + 4.6, cab[0] + 6, cab[1] + 3); g.stroke(); // sorriso
        });
        olho(P, cab[0] + 3.4, cab[1] - 0.4, l, null, 0.85);
        P.membro([J.q, J.jf, J.pf], 4.2, c.calca, '#ffffff');
        P.elipse(J.pf[0] + 2.6, J.pf[1] - 1.2, 4.8, 2.1, 0, c.pele);
        P.membro([J.p, J.cf, J.mf], 2.7, c.pele, c.peleC);
        P.bola(J.mf[0], J.mf[1], 3.2, c.pele, c.peleC);
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') { // meia-lua rasteira: mão no chão e a perna varrendo em volta
          const ang = Math.min(1, t / 14) * Math.PI * 1.2;
          const base = com(AGACHADO, { q: [-2, -12], p: [-6, -22], c: [-6, -30], ct: [-10, -12], mt: [-12, -2], cf: [-2, -14], mf: [2, -4] });
          const pe = [-2 + Math.cos(Math.PI - ang) * -30, -4 - Math.sin(ang) * 3];
          return com(base, { jf: [(base.q[0] + pe[0]) / 2, -8], pf: pe });
        }
        for (const [a, b] of [[4, 14], [22, 32], [40, 50]]) if (t >= a && t <= b) { // aú (estrela)
          return girar(com(BASE, { cf: [6, -60], mf: [8, -70], ct: [-6, -60], mt: [-8, -70], jf: [10, -18], pf: [16, -4], jt: [-10, -18], pt: [-16, -4] }), ((t - a) / (b - a)) * Math.PI * 2, 0, -34);
        }
        if (t >= 54) return GOLPES.k2; // martelo
        return mistura(BASE, AGACHADO, 0.4);
      },
    },

    'vo-nena': {
      escala: 56 / 64,
      cor: { pele: '#f2c9a5', peleC: '#ffe3cc', peleS: '#c99a78', vestido: '#9b6fd1', vestidoC: '#c3a2ef', vestidoS: '#6f47a6', cabelo: '#e9e6f0', cabeloS: '#b9b4c8', bolsa: '#8a4b2a', bolsaC: '#b8703f', chinelo: '#ff6fa8', perola: '#ffffff' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando') { // corcundinha, bolsa na frente
          const r = Math.sin(t / 16) * 0.6;
          return com(BASE, { p: [3, -43 + r], c: [7, -52 + r], cf: [10, -36], mf: [14, -30 + r], ct: [-3, -36], mt: [2, -32], pf: [7, 0], pt: [-6, 0], jf: [5, -15], jt: [-4, -15] });
        }
        if (l.estado === 'final') return com(BASE, { p: [2, -44], c: [5, -53], cf: [10, -42], mf: [14, -46 + Math.sin(t / 2) * 2], ct: [6, -40], mt: [12, -44 - Math.sin(t / 2) * 2] }); // tricotando ligeiro
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor;
        P.membro([J.q, J.jt, J.pt], 2.4, c.peleS);
        P.elipse(J.pt[0] + 2, J.pt[1] - 1, 4.6, 1.8, 0, '#d4568a');
        P.membro([J.p, J.ct, J.mt], 2.2, c.vestidoS);
        P.bola(J.mt[0], J.mt[1], 2.4, c.peleS);
        // vestido rodado (do ombro até o joelho)
        const a = angulo(J.q, J.p), lado = a + Math.PI / 2;
        const o1 = ponto(J.p, lado, 6), o2 = ponto(J.p, lado, -6), b1 = ponto(J.q, lado, 11), b2 = ponto(J.q, lado, -11);
        const b1b = ponto(b1, a, -11), b2b = ponto(b2, a, -11);
        P.forma((g) => { g.moveTo(o1[0], o1[1]); g.lineTo(o2[0], o2[1]); g.lineTo(b2b[0], b2b[1]); g.quadraticCurveTo((b1b[0] + b2b[0]) / 2, (b1b[1] + b2b[1]) / 2 + 3, b1b[0], b1b[1]); g.closePath(); }, c.vestido);
        P.detalhe((g) => {
          g.fillStyle = c.vestidoC; for (let i = 0; i < 6; i++) { const f = ponto(J.q, a, -4 - (i % 3) * 3); g.beginPath(); g.arc(f[0] + (i - 2.5) * 3, f[1], 0.9, 0, Math.PI * 2); g.fill(); } // bolinhas
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(o1[0], o1[1]); g.lineTo(J.p[0] + 3, J.p[1] + 3); g.lineTo(o2[0], o2[1]); g.closePath(); g.fill(); // golinha
          g.fillStyle = c.perola; for (let i = -2; i <= 2; i++) { const pp = ponto(J.p, lado, i * 1.6); g.beginPath(); g.arc(pp[0], pp[1] + 2 + Math.abs(i) * -0.4, 0.8, 0, Math.PI * 2); g.fill(); }
        });
        // cabeça: coque com agulhas, óculos redondos
        const cab = J.c;
        P.bola(cab[0] - 4, cab[1] - 6, 4, c.cabelo, '#ffffff');
        P.detalhe((g) => { g.strokeStyle = '#ffb000'; g.lineWidth = 0.9; g.lineCap = 'round'; for (const d of [-0.6, 0.5]) { g.beginPath(); g.moveTo(cab[0] - 4 - Math.cos(d) * 6, cab[1] - 6 - Math.sin(d) * 6 - 2); g.lineTo(cab[0] - 4 + Math.cos(d) * 6, cab[1] - 6 + Math.sin(d) * 6 - 2); g.stroke(); } });
        P.bola(cab[0], cab[1], 6.6, c.pele, c.peleC);
        P.elipse(cab[0] - 2.6, cab[1] - 4.2, 6.4, 3.8, -0.25, c.cabelo, '#ffffff'); // cabelo branquinho só em cima
        P.detalhe((g) => {
          g.fillStyle = 'rgba(255,120,140,0.35)'; g.beginPath(); g.arc(cab[0] + 2, cab[1] + 3, 1.6, 0, Math.PI * 2); g.fill();
          g.strokeStyle = CONTORNO; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 3, cab[1] + 3.6); g.quadraticCurveTo(cab[0] + 4.6, cab[1] + 4.6, cab[0] + 6, cab[1] + 3.2); g.stroke();
        });
        olho(P, cab[0] + 3.6, cab[1] - 0.4, l, null, 0.75);
        P.detalhe((g) => { g.strokeStyle = '#8a5a2a'; g.lineWidth = 0.7; g.beginPath(); g.arc(cab[0] + 3.6, cab[1] - 0.4, 2.6, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cab[0] + 6.2, cab[1] - 0.8); g.lineTo(cab[0] + 7, cab[1] - 1); g.stroke(); });
        // perna da frente com chinelo, braço com a bolsa
        P.membro([J.q, J.jf, J.pf], 2.6, c.pele, c.peleC);
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1, 5, 1.9, 0, c.chinelo);
        P.membro([J.p, J.cf, J.mf], 2.3, c.vestido, c.vestidoC);
        P.bola(J.mf[0], J.mf[1], 2.6, c.pele, c.peleC);
        const atacando = l.estado === 'golpe' && ['p1', 'p2', 'k2', 'sup'].includes(l.golpe);
        const ang = atacando ? angulo(J.cf, J.mf) : Math.PI / 2;
        const centro = ponto(J.mf, ang, 6);
        P.forma((g) => { g.save(); g.translate(centro[0], centro[1]); g.rotate(ang - Math.PI / 2); g.roundRect(-5.5, -3, 11, 9, 2.4); g.restore(); }, c.bolsa);
        P.detalhe((g) => {
          g.save(); g.translate(centro[0], centro[1]); g.rotate(ang - Math.PI / 2);
          g.fillStyle = c.bolsaC; g.fillRect(-5.5, -3, 11, 2.6); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0.2, 1, 0, Math.PI * 2); g.fill();
          g.restore();
          g.strokeStyle = c.bolsa; g.lineWidth = 1; g.beginPath(); g.moveTo(J.mf[0], J.mf[1]); g.lineTo(centro[0], centro[1] - 3); g.stroke();
        });
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return t < 12 ? com(BASE, { p: [-1, -43], c: [2, -52], cf: [-4, -40], mf: [-8, -36] }) : com(AGACHADO, { p: [6, -30], c: [10, -38], cf: [14, -18], mf: [22, -8] }); // joga o novelo rolando
        const arremesso = [14, 22, 30, 38].some((d) => t >= d - 3 && t <= d + 2);
        if (t < 46) return arremesso ? com(BASE, { cf: [14, -50], mf: [24, -54], p: [4, -44], c: [7, -53] }) : com(BASE, { cf: [-4, -52], mf: [-8, -60], p: [-2, -44], c: [0, -53] });
        return com(BASE, { q: [2, -30], p: [7, -43], c: [10, -52], cf: [16, -50], mf: [24, -40], ct: [4, -40], mt: [12, -36] }); // bolsada final
      },
    },
    'vo-tiao': {
      escala: 60 / 64,
      cor: { pele: '#e8b48c', peleC: '#ffd3b0', peleS: '#b9845e', camisa: '#e9d8b0', camisaC: '#fff5dc', colete: '#7a5a3a', coleteC: '#a37a52', calca: '#6b6f7d', calcaC: '#8f93a3', bone: '#3a6b5a', boneC: '#5a9a82', bigode: '#f4f4f4', bengala: '#7a4a24', sapato: '#3a2418' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando' || l.estado === 'andando') { // curvado, apoiado na bengala
          const r = Math.sin(t / 18) * 0.6, passo = l.estado === 'andando' ? Math.sin(t / 6) * 4 : 0;
          return com(BASE, { q: [-1, -29], p: [4, -42 + r], c: [8, -50 + r], cf: [12, -34], mf: [16, -28], ct: [-2, -34], mt: [0, -28], pf: [7 + passo, 0], jf: [5 + passo / 2, -14], pt: [-6 - passo, 0], jt: [-4 - passo / 2, -14] });
        }
        if (l.estado === 'final') return com(BASE, { p: [4, -44], c: [8, -54], cf: [12, -48], mf: [16, -52], ct: [-6, -40], mt: [-8, -32] });
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor;
        P.membro([J.q, J.jt, J.pt], 3, c.calca);
        P.elipse(J.pt[0] + 2.4, J.pt[1] - 1.2, 4.6, 2, 0, c.sapato);
        P.membro([J.p, J.ct, J.mt], 2.4, c.camisa);
        P.bola(J.mt[0], J.mt[1], 2.6, c.peleS);
        P.membro([J.q, J.p], 5.4, c.camisa, c.camisaC);
        P.detalhe((g) => {
          const a = angulo(J.q, J.p), lado = a + Math.PI / 2;
          g.strokeStyle = c.colete; g.lineWidth = 3.4; g.lineCap = 'round';
          for (const d of [-3.6, 3.6]) { const x0 = ponto(J.q, lado, d), x1 = ponto(J.p, lado, d * 0.9); g.beginPath(); g.moveTo(x0[0], x0[1]); g.lineTo(x1[0], x1[1]); g.stroke(); }
          g.fillStyle = '#c9a227'; for (let i = 0; i < 3; i++) { const b = ponto(ponto(J.p, lado, 2), a, -3 - i * 3.6); g.beginPath(); g.arc(b[0], b[1], 0.6, 0, Math.PI * 2); g.fill(); }
        });
        P.elipse(J.q[0], J.q[1] + 1.5, 6.2, 4.6, 0, c.calca, c.calcaC);
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.6, c.pele, c.peleC);
        P.forma((g) => { g.ellipse(cab[0] - 0.5, cab[1] - 4.4, 7, 3.6, 0, Math.PI, 0); g.lineTo(cab[0] + 10, cab[1] - 4); g.lineTo(cab[0] + 6, cab[1] - 2.6); }, c.bone); // boné com aba
        P.detalhe((g) => {
          g.fillStyle = c.boneC; g.beginPath(); g.ellipse(cab[0] - 1.5, cab[1] - 6, 3.6, 1.2, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = c.bigode; g.beginPath(); g.ellipse(cab[0] + 5, cab[1] + 2.6, 3.6, 1.6, 0.15, 0, Math.PI * 2); g.fill(); // bigodão
          g.strokeStyle = 'rgba(26,15,36,0.4)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(cab[0] + 3, cab[1] + 2.4); g.lineTo(cab[0] + 7.6, cab[1] + 2.8); g.stroke();
          g.fillStyle = '#e8a080'; g.beginPath(); g.ellipse(cab[0] + 7, cab[1] + 0.6, 1.6, 1.3, 0, 0, Math.PI * 2); g.fill(); // narigão
          g.fillStyle = c.bigode; g.beginPath(); g.arc(cab[0] - 5.4, cab[1] + 0.5, 1.8, 0, Math.PI * 2); g.fill(); // costeleta branca
        });
        olho(P, cab[0] + 3.4, cab[1] - 1.2, l, null, 0.75);
        P.detalhe((g) => { g.strokeStyle = CONTORNO; g.lineWidth = 0.6; g.strokeRect(cab[0] + 1, cab[1] - 3.2, 4.8, 3.6); });
        P.membro([J.q, J.jf, J.pf], 3.1, c.calca, c.calcaC);
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1.2, 4.8, 2.1, 0, c.sapato);
        // bengala: apoiada no chão ou apontada para frente quando ataca (com gancho na ponta)
        const atacando = l.estado === 'golpe' && ['p1', 'p2', 'k2', 'cp', 'ck', 'esp'].includes(l.golpe);
        const ang = atacando ? angulo(J.cf, J.mf) : Math.PI / 2;
        const comp = l.golpe === 'esp' && l.estado === 'golpe' && l.t >= 10 && l.t <= 20 ? 58 : 28;
        const ponta = atacando ? ponto(J.mf, ang, comp) : [J.mf[0] + 1, 0];
        P.membro([J.mf, ponta], 1.3, c.bengala, '#b07a44');
        P.detalhe((g) => { g.strokeStyle = c.bengala; g.lineWidth = 2.4; g.lineCap = 'round'; const tras = ponto(J.mf, ang + Math.PI, 3); g.beginPath(); g.arc(tras[0] - Math.cos(ang) * 2, tras[1] - 2, 2.6, Math.PI, Math.PI * 2); g.stroke(); });
        P.membro([J.p, J.cf, J.mf], 2.6, c.camisa, c.camisaC);
        P.bola(J.mf[0], J.mf[1], 2.8, c.pele, c.peleC);
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return t < 10 ? com(BASE, { p: [0, -43], c: [3, -52], cf: [-2, -42], mf: [-6, -46] }) : com(BASE, { p: [6, -43], c: [10, -51], cf: [16, -44], mf: [26, -46] });
        return t < 14 ? com(BASE, { p: [2, -44], c: [4, -54], cf: [10, -50], mf: [10, -56] }) : com(BASE, { p: [6, -44], c: [10, -54], cf: [16, -48], mf: [24, -50] }); // tira a dentadura e arremessa
      },
    },

    kira: {
      escala: 62 / 64,
      cor: { pele: '#c98a5e', peleC: '#efb88c', peleS: '#9a6440', top: '#e8383d', topC: '#ff7a7f', short: '#1e1e2a', shortC: '#3a3a52', luva: '#2f6fd6', luvaC: '#7da2ff', canela: '#f4f4f4', cabelo: '#2a160c' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando') { // base de kickboxing, quicando
          const q = Math.abs(Math.sin(t / 7)) * 1.4;
          return com(BASE, { q: [0, -30 + q], p: [2, -45 + q], c: [4, -55 + q], cf: [10, -46 + q], mf: [13, -52 + q], ct: [4, -42 + q], mt: [8, -50 + q], pf: [9, 0], jf: [7, -15 + q / 2], pt: [-9, 0], jt: [-6, -15 + q / 2] });
        }
        if (l.estado === 'final') return girar(GOLPES.k2, t / 3, 0, -30);
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor, cab = J.c, balanco = Math.sin((l.t || 0) / 5) * 0.4 + (l.estado === 'corrida' ? 0.6 : 0);
        // rabo de cavalo balançando
        const base = [cab[0] - 5, cab[1] - 3], ang = Math.PI * 0.85 + balanco;
        P.membro([base, ponto(base, ang, 7), ponto(base, ang + 0.4, 13)], 2.2, c.cabelo);
        P.membro([J.q, J.jt, J.pt], 3, c.peleS);
        P.detalhe((g) => { const m = [(J.jt[0] + J.pt[0]) / 2, (J.jt[1] + J.pt[1]) / 2]; g.strokeStyle = '#d0d0d8'; g.lineWidth = 4.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(J.jt[0], J.jt[1] + 1); g.lineTo(m[0], m[1]); g.stroke(); });
        P.elipse(J.pt[0] + 2, J.pt[1] - 1.2, 4.6, 2, 0, c.peleS);
        P.membro([J.p, J.ct, J.mt], 2.3, c.peleS);
        P.bola(J.mt[0], J.mt[1], 4, '#1d4596', c.luva);
        P.membro([J.q, J.p], 5.2, c.pele, c.peleC);
        P.detalhe((g) => { const a = angulo(J.q, J.p), m = ponto(J.p, a + Math.PI, -6); g.fillStyle = c.top; g.beginPath(); g.ellipse(m[0], m[1], 6.2, 4.6, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); g.fillStyle = c.topC; g.beginPath(); g.ellipse(m[0] - 1, m[1] - 1.5, 3, 1.4, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); });
        P.elipse(J.q[0], J.q[1] + 1.5, 6.6, 5.2, 0, c.short, c.shortC);
        P.detalhe((g) => { g.fillStyle = '#ffffff'; g.fillRect(J.q[0] - 6.4, J.q[1] - 3, 12.8, 1.2); });
        P.bola(cab[0], cab[1], 6.8, c.pele, c.peleC);
        P.forma((g) => { g.ellipse(cab[0] - 1.6, cab[1] - 3.4, 7, 4.2, -0.3, Math.PI * 0.9, Math.PI * 2.1); }, c.cabelo);
        P.detalhe((g) => {
          g.fillStyle = c.top; g.fillRect(cab[0] - 6.6, cab[1] - 4.2, 13, 1.6); // faixa
          g.strokeStyle = CONTORNO; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 3, cab[1] + 3.6); g.lineTo(cab[0] + 5.6, cab[1] + 3.4); g.stroke();
        });
        olho(P, cab[0] + 3.4, cab[1] - 0.6, l, '#5a3a20', 0.85);
        P.membro([J.q, J.jf, J.pf], 3.3, c.pele, c.peleC);
        P.detalhe((g) => { const m = [(J.jf[0] + J.pf[0]) / 2, (J.jf[1] + J.pf[1]) / 2]; g.strokeStyle = c.canela; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(J.jf[0] + (m[0] - J.jf[0]) * 0.2, J.jf[1] + (m[1] - J.jf[1]) * 0.2 + 0.5); g.lineTo(m[0], m[1]); g.stroke(); }); // caneleira
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1.2, 4.8, 2, 0, c.pele);
        P.membro([J.p, J.cf, J.mf], 2.5, c.pele, c.peleC);
        P.bola(J.mf[0], J.mf[1], 4.4, c.luva, c.luvaC);
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return com(PULO, { jf: [12, -40], pf: [6, -26], cf: [12, -56], mf: [18, -62], ct: [-6, -54], mt: [-10, -60] }); // joelhada
        return girar(GOLPES.k2, ((t % 8) / 8) * Math.PI * 2, 0, -30); // chutes girando
      },
    },
    toco: {
      escala: 70 / 64,
      cor: { pele: '#e3a77e', peleC: '#ffc9a0', camisa: '#c8302f', camisaC: '#e85a50', xadrez: '#2a1a1a', barba: '#7a3f1c', barbaC: '#a85a2a', gorro: '#2f6b4f', jeans: '#3a5a96', jeansC: '#5a7cc0', bota: '#5a3418', tora: '#8a5a30', toraC: '#b07a44', anel: '#e3c48c' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando') { // tronco apoiado no ombro
          const r = Math.sin(t / 15) * 0.8;
          return com(BASE, { p: [1, -45 + r], c: [3, -56 + r], cf: [11, -38 + r], mf: [9, -45 + r], ct: [-6, -38], mt: [-2, -32], pf: [10, 0], pt: [-10, 0], jf: [8, -15], jt: [-7, -15] });
        }
        if (l.estado === 'final') return com(BASE, { cf: [14, -46], mf: [20, -40 + (t % 12 < 6 ? -6 : 4)], ct: [-6, -40], mt: [-2, -34] }); // entalhando
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor;
        const bate = l.estado === 'golpe' && ['p1', 'p2', 'k2', 'cp', 'ap'].includes(l.golpe);
        if (!bate) this.tora(P, J, false);
        P.membro([J.q, J.jt, J.pt], 4.4, '#2a4478');
        P.elipse(J.pt[0] + 2.6, J.pt[1] - 2, 6, 3, 0, '#3a2210');
        P.membro([J.p, J.ct, J.mt], 3.6, '#8f2221');
        P.bola(J.mt[0], J.mt[1], 3.6, '#b9845e');
        P.membro([J.q, J.p], 7.6, c.camisa, c.camisaC);
        P.detalhe((g) => { // xadrez da camisa de flanela
          const a = angulo(J.q, J.p), lado = a + Math.PI / 2;
          g.strokeStyle = 'rgba(42,26,26,0.5)'; g.lineWidth = 1.1;
          for (const d of [-4, 0, 4]) { const x0 = ponto(J.q, lado, d), x1 = ponto(J.p, lado, d); g.beginPath(); g.moveTo(x0[0], x0[1]); g.lineTo(x1[0], x1[1]); g.stroke(); }
          for (let i = 1; i < 4; i++) { const m = ponto(J.q, a, -(i * 4)), e = ponto(m, lado, 7), d = ponto(m, lado, -7); g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(d[0], d[1]); g.stroke(); }
        });
        P.elipse(J.q[0], J.q[1] + 1.5, 7.4, 5.4, 0, c.jeans, c.jeansC);
        P.detalhe((g) => { g.fillStyle = '#5a3418'; g.fillRect(J.q[0] - 7.2, J.q[1] - 3.4, 14.4, 2); g.fillStyle = '#ffd23f'; g.fillRect(J.q[0] - 1.2, J.q[1] - 3.4, 2.4, 2); });
        const cab = J.c;
        P.bola(cab[0], cab[1], 7, c.pele, c.peleC);
        P.forma((g) => { g.ellipse(cab[0] + 2.5, cab[1] + 3.8, 6.4, 5.4, 0.1, -0.2, Math.PI + 0.6); }, c.barba); // barbão
        P.forma((g) => { g.ellipse(cab[0], cab[1] - 4, 7.6, 5, 0, Math.PI, 0); g.closePath(); }, c.gorro);
        P.bola(cab[0] - 1, cab[1] - 10, 2.4, '#e8e8e8', '#ffffff');
        P.detalhe((g) => {
          g.fillStyle = c.barbaC; g.beginPath(); g.ellipse(cab[0] + 3, cab[1] + 3, 3.6, 2.4, 0.1, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#245440'; g.fillRect(cab[0] - 7.6, cab[1] - 5.4, 15.2, 2);
          g.fillStyle = '#e08a6a'; g.beginPath(); g.ellipse(cab[0] + 6.6, cab[1] + 0.2, 1.6, 1.3, 0, 0, Math.PI * 2); g.fill();
        });
        olho(P, cab[0] + 3.4, cab[1] - 1.4, l, null, 0.85);
        P.membro([J.q, J.jf, J.pf], 4.6, c.jeans, c.jeansC);
        P.elipse(J.pf[0] + 3, J.pf[1] - 2, 6.4, 3, 0, c.bota);
        if (bate) this.tora(P, J, true);
        P.membro([J.p, J.cf, J.mf], 3.8, c.camisa, c.camisaC);
        P.bola(J.mf[0], J.mf[1], 3.8, c.pele, c.peleC);
      },
      // A tora: no ombro (atrás da cabeça) parado; apontada para frente quando bate.
      tora(P, J, bate) {
        const c = this.cor;
        const ang = bate ? angulo(J.cf, J.mf) : -Math.PI * 0.68;
        const ponta = ponto(J.mf, ang, bate ? 26 : 34), tras = ponto(J.mf, ang + Math.PI, bate ? 4 : 6);
        P.membro([tras, ponta], 4.2, c.tora, c.toraC);
        P.detalhe((g) => {
          g.fillStyle = c.anel; g.beginPath(); g.ellipse(ponta[0], ponta[1], 2, 4, ang, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#8a5a30'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(ponta[0], ponta[1], 1, 2.2, ang, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = 'rgba(60,30,10,0.5)'; g.lineWidth = 0.6; for (const f of [0.3, 0.6]) { const pp = [tras[0] + (ponta[0] - tras[0]) * f, tras[1] + (ponta[1] - tras[1]) * f]; g.beginPath(); g.arc(pp[0], pp[1], 2, ang + 0.5, ang + 2.4); g.stroke(); }
        });
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return t < 16 ? com(BASE, { cf: [-4, -50], mf: [-10, -58], p: [-2, -45], c: [0, -55] }) : com(AGACHADO, { p: [6, -30], c: [9, -38], cf: [14, -18], mf: [22, -8] }); // rola a tora
        return t < 44 ? com(BASE, { cf: [8, -58], mf: [6, -70], ct: [-4, -56], mt: [-6, -68], c: [3, -56] }) : com(BASE, { cf: [16, -44], mf: [24, -40], c: [6, -54] }); // grita "madeiraaa!"
      },
    },

    nix: {
      escala: 62 / 64,
      cor: { pele: '#f3d6c4', peleC: '#fff0e6', roupa: '#4fb6ff', roupaC: '#a9e0ff', roupaS: '#2a7fc9', cabelo: '#dff4ff', cabeloS: '#a8d4ef', patins: '#ffffff', lamina: '#c9d6e3', cachecol: '#ff6fb1' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando') { // pose de patinação, deslizando de leve
          const d = Math.sin(t / 12) * 2;
          return com(BASE, { q: [d * 0.3, -30], p: [2 + d * 0.3, -45], c: [4 + d * 0.3, -55], cf: [12, -46], mf: [18, -50], ct: [-8, -44], mt: [-14, -48], pf: [7 + d, 0], jf: [6 + d / 2, -15], pt: [-7 + d, 0], jt: [-5 + d / 2, -15] });
        }
        if (l.estado === 'andando' || l.estado === 'corrida') { // patinando: pernas abrem para os lados
          const a = Math.sin(t / (l.estado === 'corrida' ? 4 : 7)) * 7;
          return com(BASE, { p: [4, -44], c: [7, -54], cf: [8, -40], mf: [4, -34], ct: [-6, -40], mt: [-12, -34], pf: [6 + a, 0], jf: [6 + a / 2, -14], pt: [-6 - a, -Math.max(0, a) * 0.6], jt: [-4 - a / 2, -14] });
        }
        if (l.estado === 'final' || l.estado === 'vitoria') return girar(com(BASE, { cf: [6, -62], mf: [4, -72], ct: [-6, -62], mt: [-4, -72], jt: [-6, -20], pt: [-2, -28] }), 0, 0, 0); // pirueta de braços para cima
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor;
        const patim = (pe) => {
          P.elipse(pe[0] + 2.4, pe[1] - 2.4, 4.6, 2.4, 0, c.patins);
          P.membro([[pe[0] - 2, pe[1] + 0.2], [pe[0] + 7, pe[1] + 0.2]], 0.6, c.lamina);
        };
        P.membro([J.q, J.jt, J.pt], 2.6, '#e8c4ae');
        patim(J.pt);
        P.membro([J.p, J.ct, J.mt], 2.2, c.roupaS);
        P.bola(J.mt[0], J.mt[1], 2.5, '#e8c4ae');
        P.membro([J.q, J.p], 5, c.roupa, c.roupaC);
        // saiote de patinação
        P.forma((g) => { const a = angulo(J.q, J.p), lado = a + Math.PI / 2, e = ponto(J.q, lado, 6), d = ponto(J.q, lado, -6), e2 = ponto(ponto(J.q, lado, 10), a, -5), d2 = ponto(ponto(J.q, lado, -10), a, -5); g.moveTo(e[0], e[1]); g.lineTo(e2[0], e2[1]); g.quadraticCurveTo(J.q[0], J.q[1] + 7, d2[0], d2[1]); g.lineTo(d[0], d[1]); g.closePath(); }, c.roupa);
        P.detalhe((g) => { g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const pp = ponto(J.p, angulo(J.q, J.p) + Math.PI, -3 - i * 3); g.beginPath(); g.arc(pp[0] + 1, pp[1], 0.6, 0, Math.PI * 2); g.fill(); } }); // brilhos
        const cab = J.c;
        // cachecol esvoaçando
        P.membro([[J.p[0] + 1, J.p[1] - 2], [J.p[0] - 6, J.p[1] - 1 + Math.sin((l.t || 0) / 4)], [J.p[0] - 12, J.p[1] + 1]], 1.6, c.cachecol);
        P.bola(cab[0] - 5, cab[1] - 5, 3.6, c.cabelo, '#ffffff'); // coque
        P.bola(cab[0], cab[1], 6.6, c.pele, c.peleC);
        P.elipse(cab[0] - 1.6, cab[1] - 3.4, 6.6, 3.8, -0.25, c.cabelo, '#ffffff');
        P.detalhe((g) => { g.fillStyle = 'rgba(255,140,170,0.4)'; g.beginPath(); g.arc(cab[0] + 1.6, cab[1] + 3, 1.6, 0, Math.PI * 2); g.fill(); g.strokeStyle = CONTORNO; g.lineWidth = 0.6; g.beginPath(); g.moveTo(cab[0] + 3, cab[1] + 3.6); g.quadraticCurveTo(cab[0] + 4.4, cab[1] + 4.6, cab[0] + 5.8, cab[1] + 3.4); g.stroke(); });
        olho(P, cab[0] + 3.4, cab[1] - 0.6, l, '#4fb6ff', 0.85);
        P.membro([J.q, J.jf, J.pf], 2.8, c.pele, c.peleC);
        patim(J.pf);
        P.membro([J.p, J.cf, J.mf], 2.3, c.roupa, c.roupaC);
        P.bola(J.mf[0], J.mf[1], 2.6, c.pele, c.peleC);
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return com(AGACHADO, { q: [-2, -10], p: [4, -18], c: [10, -22], jf: [12, -6], pf: [22, -2], jt: [-8, -6], pt: [-16, 0], cf: [12, -16], mf: [20, -12], ct: [-6, -16], mt: [-14, -14] }); // deslizando rente ao chão
        return girar(com(BASE, { cf: [10, -48], mf: [22, -48], ct: [-10, -48], mt: [-22, -48], jt: [-8, -20], pt: [-18, -18] }), t / 3, 0, -30); // pirueta
      },
    },
    eco: {
      escala: 64 / 64,
      cor: { pele: '#7a4a2a', peleC: '#a8703f', moletom: '#7a3fc0', moletomC: '#a774e8', calca: '#1f2a3a', calcaC: '#36465e', bone: '#ffd23f', fone: '#1a1a24', foneC: '#4fd8ff', tenis: '#ffffff', caixa: '#2a2a36' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando') { // balançando a cabeça na batida
          const b = Math.abs(Math.sin(t / 8)) * 1.6;
          return com(BASE, { p: [1, -45 + b * 0.4], c: [4, -55 + b], cf: [10, -40], mf: [12, -46], ct: [-4, -40], mt: [2, -46], pf: [9, 0], pt: [-9, 0] });
        }
        if (l.estado === 'final') return com(BASE, { cf: [10, -40], mf: [14, -36 + Math.sin(t / 3) * 2], ct: [4, -40], mt: [8, -36 - Math.sin(t / 3) * 2], c: [4, -55 + Math.abs(Math.sin(t / 5)) * 2] }); // mexendo nos discos
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor;
        // caixas de som nas costas
        const a = angulo(J.q, J.p), costas = ponto(ponto(J.p, a + Math.PI, -6), a + Math.PI / 2, -7); // atrás do corpo
        P.forma((g) => { g.roundRect(costas[0] - 5, costas[1] - 10, 9, 18, 2); }, c.caixa);
        P.detalhe((g) => { const pulsa = 1 + Math.abs(Math.sin((l.t || 0) / 4)) * 0.4; for (const dy of [-5, 3]) { g.fillStyle = '#555566'; g.beginPath(); g.arc(costas[0] - 0.5, costas[1] + dy, 3.2 * pulsa, 0, Math.PI * 2); g.fill(); g.fillStyle = c.foneC; g.beginPath(); g.arc(costas[0] - 0.5, costas[1] + dy, 1.1, 0, Math.PI * 2); g.fill(); } });
        P.membro([J.q, J.jt, J.pt], 3.4, '#141c28');
        P.elipse(J.pt[0] + 2.6, J.pt[1] - 1.6, 5.2, 2.4, 0, '#d8d8e0');
        P.membro([J.p, J.ct, J.mt], 2.8, '#5a2c90');
        P.bola(J.mt[0], J.mt[1], 3, '#5a361e');
        P.membro([J.q, J.p], 6.4, c.moletom, c.moletomC);
        P.detalhe((g) => { const m = ponto(J.p, a + Math.PI, -6); g.strokeStyle = '#ffd23f'; g.lineWidth = 0.8; g.beginPath(); g.arc(m[0] + 1, m[1] - 2, 3.4, 0.3, Math.PI - 0.3); g.stroke(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(m[0] + 1, m[1] + 1.6, 1.2, 0, Math.PI * 2); g.fill(); }); // cordão
        P.elipse(J.q[0], J.q[1] + 1.5, 6.6, 5, 0, c.calca, c.calcaC);
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.8, c.pele, c.peleC);
        P.forma((g) => { g.ellipse(cab[0] - 0.5, cab[1] - 3.6, 7.2, 4.2, 0, Math.PI, 0); g.lineTo(cab[0] - 11, cab[1] - 3); g.closePath(); }, c.bone); // boné virado para trás
        P.detalhe((g) => { g.strokeStyle = CONTORNO; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 2.6, cab[1] + 3.4); g.quadraticCurveTo(cab[0] + 4.6, cab[1] + 5, cab[0] + 6.2, cab[1] + 3); g.stroke(); });
        olho(P, cab[0] + 3.6, cab[1] - 0.4, l, null, 0.85);
        // fones grandes
        P.membro([[cab[0] - 3.6, cab[1] - 2.6], [cab[0] - 1, cab[1] - 8.4], [cab[0] + 3, cab[1] - 6.6]], 1, c.fone);
        P.elipse(cab[0] - 3.4, cab[1] + 0.2, 2.4, 3.4, 0, c.fone); // concha do fone na orelha (atrás do rosto)
        P.detalhe((g) => { g.fillStyle = c.foneC; g.beginPath(); g.ellipse(cab[0] - 3.4, cab[1] + 0.2, 1.1, 1.9, 0, 0, Math.PI * 2); g.fill(); });
        P.membro([J.q, J.jf, J.pf], 3.6, c.calca, c.calcaC);
        P.elipse(J.pf[0] + 2.8, J.pf[1] - 1.8, 5.6, 2.6, 0, c.tenis);
        P.detalhe((g) => { g.fillStyle = '#e8383d'; g.fillRect(J.pf[0] + 0.5, J.pf[1] - 2.6, 4, 1); });
        P.membro([J.p, J.cf, J.mf], 3, c.moletom, c.moletomC);
        P.bola(J.mf[0], J.mf[1], 3.2, c.pele, c.peleC);
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return t < 10 ? com(BASE, { cf: [6, -50], mf: [2, -56], ct: [-6, -48], mt: [-10, -54] }) : com(BASE, { p: [4, -45], c: [6, -55], cf: [16, -46], mf: [26, -46], ct: [14, -42], mt: [24, -42] }); // empurra o som com as mãos
        return t < 24 ? com(AGACHADO, { cf: [8, -36], mf: [4, -44], ct: [-2, -36], mt: [-6, -44] }) : com(BASE, { cf: [14, -58], mf: [22, -66], ct: [-12, -58], mt: [-20, -66], c: [4, -57] }); // solta o grave
      },
    },
    truque: {
      escala: 64 / 64,
      cor: { pele: '#f1c9a0', peleC: '#ffe2c4', terno: '#1f1f2a', ternoC: '#3a3a52', capa: '#c8202f', capaD: '#7a1020', luva: '#ffffff', cartola: '#16161e' },
      pose(l) {
        const t = l.t;
        if (l.estado === 'parado' || l.estado === 'pousando') { // pose de palco, varinha no ar
          const r = Math.sin(t / 14) * 0.8;
          return com(BASE, { p: [1, -45 + r], c: [3, -55 + r], cf: [12, -48 + r], mf: [18, -54 + r], ct: [-6, -38], mt: [-2, -32], pf: [8, 0], pt: [-8, 0] });
        }
        if (l.estado === 'final' || l.estado === 'vitoria') return com(BASE, { cf: [10, -60], mf: [14, -70], ct: [-10, -58], mt: [-14, -66] });
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor, voa = Math.sin((l.t || 0) / 6) * 2 + (l.estado === 'corrida' ? 6 : 0);
        // capa atrás do corpo
        P.forma((g) => { g.moveTo(J.p[0] - 5, J.p[1] - 1); g.lineTo(J.p[0] + 4, J.p[1] - 1); g.quadraticCurveTo(J.q[0] - 4, J.q[1] + 6, J.q[0] - 10 - voa, J.q[1] + 18); g.lineTo(J.q[0] - 18 - voa, J.q[1] + 14); g.closePath(); }, c.capa);
        P.detalhe((g) => { g.fillStyle = c.capaD; g.beginPath(); g.moveTo(J.p[0] - 3, J.p[1]); g.quadraticCurveTo(J.q[0] - 6, J.q[1] + 4, J.q[0] - 14 - voa, J.q[1] + 15); g.lineTo(J.q[0] - 16 - voa, J.q[1] + 14); g.closePath(); g.fill(); });
        P.membro([J.q, J.jt, J.pt], 3, c.terno);
        P.elipse(J.pt[0] + 2.4, J.pt[1] - 1.2, 4.8, 2, 0, '#0c0c12');
        P.membro([J.p, J.ct, J.mt], 2.4, c.terno);
        P.bola(J.mt[0], J.mt[1], 2.8, '#dcdcdc');
        P.membro([J.q, J.p], 5.6, c.terno, c.ternoC);
        P.detalhe((g) => {
          const a = angulo(J.q, J.p), topo = ponto(J.p, a + Math.PI, -1), meio = ponto(J.p, a + Math.PI, -9);
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(topo[0] - 2.4, topo[1]); g.lineTo(topo[0] + 3.4, topo[1]); g.lineTo(meio[0] + 1, meio[1]); g.closePath(); g.fill();
          g.fillStyle = '#e8383d'; g.beginPath(); g.moveTo(topo[0] - 1.6, topo[1] - 0.6); g.lineTo(topo[0] + 2.6, topo[1] + 1.4); g.lineTo(topo[0] + 2.6, topo[1] - 0.6); g.lineTo(topo[0] - 1.6, topo[1] + 1.4); g.closePath(); g.fill(); // gravata-borboleta
        });
        P.elipse(J.q[0], J.q[1] + 1.5, 6, 4.6, 0, c.terno, c.ternoC);
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.6, c.pele, c.peleC);
        P.forma((g) => { g.roundRect(cab[0] - 6, cab[1] - 18, 12, 13, 1.2); g.rect(cab[0] - 9, cab[1] - 6.4, 18, 2.4); }, c.cartola);
        P.detalhe((g) => {
          g.fillStyle = '#c8202f'; g.fillRect(cab[0] - 6, cab[1] - 9, 12, 2);
          g.strokeStyle = CONTORNO; g.lineWidth = 0.9; g.lineCap = 'round';
          g.beginPath(); g.moveTo(cab[0] + 2.4, cab[1] + 2.6); g.quadraticCurveTo(cab[0] + 5, cab[1] + 1.4, cab[0] + 7.6, cab[1] + 1.8); g.stroke(); // bigodinho
          g.beginPath(); g.moveTo(cab[0] + 2.2, cab[1] - 3.4); g.lineTo(cab[0] + 5.6, cab[1] - 4.2); g.stroke(); // sobrancelha arqueada
        });
        olho(P, cab[0] + 3.6, cab[1] - 1, l, null, 0.8);
        P.membro([J.q, J.jf, J.pf], 3.1, c.terno, c.ternoC);
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1.2, 4.8, 2, 0, '#0c0c12');
        P.membro([J.p, J.cf, J.mf], 2.5, c.terno, c.ternoC);
        P.bola(J.mf[0], J.mf[1], 3, c.luva, '#ffffff');
        const ang = angulo(J.cf, J.mf), ponta = ponto(J.mf, ang - 0.4, 13);
        P.membro([J.mf, ponta], 0.9, '#16161e');
        P.detalhe((g) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ponta[0], ponta[1], 1.2, 0, Math.PI * 2); g.fill(); });
      },
      poseEspecial(l) {
        const t = l.t;
        if (l.golpe === 'esp') return t < 12 ? com(AGACHADO, { cf: [6, -40], mf: [-2, -44], ct: [-6, -36], mt: [-12, -40] }) : GOLPES.p2; // reverência na fumaça e o golpe de surpresa
        return com(BASE, { cf: [10, -60], mf: [14, -72], ct: [-8, -58], mt: [-12, -68] }); // conjura a cartola
      },
    },
    mare: {
      escala: 66 / 64,
      cor: { pele: '#d99a6a', peleC: '#ffc48f', peleS: '#a8703f', cabelo: '#ffd77a', cabeloC: '#fff0b8', bermuda: '#2fb3a8', flor: '#ffe14d', prancha: '#ff6f3c', faixa: '#ffffff' },
      pose(l) {
        if (l.estado === 'parado' || l.estado === 'pousando') { // pose de surfista, joelhos soltos
          const r = Math.sin(l.t / 13) * 1.2;
          return com(BASE, { q: [0, -29], p: [2, -44 + r * 0.4], c: [5, -54 + r * 0.4], cf: [12, -40], mf: [18, -38 + r], ct: [-10, -40], mt: [-16, -38 - r], pf: [10, 0], jf: [8, -14], pt: [-10, 0], jt: [-7, -14] });
        }
        if (l.estado === 'final' || l.estado === 'vitoria') return com(BASE, { cf: [10, -58], mf: [12, -70], ct: [-8, -46], mt: [-14, -50] });
        return null;
      },
      prancha(P, J, l, ataca) {
        const c = this.cor, ang = ataca ? angulo(J.cf, J.mf) : -Math.PI / 2 + 0.12;
        const base = ataca ? J.mf : [J.mt[0] - 2, 0], comp = ataca ? 34 : 58;
        const ponta = ponto(base, ang, comp), meio = ponto(base, ang, comp / 2);
        P.elipse(meio[0], meio[1], comp / 2, 4.2, ang, c.prancha, '#ffa27a');
        P.detalhe((g) => { g.strokeStyle = c.faixa; g.lineWidth = 1; g.beginPath(); g.moveTo(base[0] + Math.cos(ang) * 3, base[1] + Math.sin(ang) * 3); g.lineTo(ponta[0] - Math.cos(ang) * 3, ponta[1] - Math.sin(ang) * 3); g.stroke(); });
      },
      desenhar(P, J, l) {
        const c = this.cor, ataca = l.estado === 'golpe' && ['p2', 'k2', 'esp'].includes(l.golpe);
        if (!ataca) this.prancha(P, J, l, false);
        P.membro([J.q, J.jt, J.pt], 3.2, c.peleS);
        P.elipse(J.pt[0] + 2.4, J.pt[1] - 1, 4.8, 1.8, 0, '#ff6fb1'); // chinelo
        P.membro([J.p, J.ct, J.mt], 2.7, c.peleS);
        P.bola(J.mt[0], J.mt[1], 3, c.peleS);
        P.membro([J.q, J.p], 6, c.pele, c.peleC);
        P.detalhe((g) => { const a = angulo(J.q, J.p), m = ponto(J.p, a + Math.PI, -2); g.strokeStyle = '#f4e4c4'; g.lineWidth = 0.8; g.beginPath(); g.arc(m[0] + 1, m[1] - 1, 3.4, 0.4, Math.PI - 0.4); g.stroke(); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff9a7a'; g.beginPath(); g.arc(m[0] + 1 + Math.cos(0.5 + i * 0.6) * 3.4, m[1] - 1 + Math.sin(0.5 + i * 0.6) * 3.4, 0.8, 0, Math.PI * 2); g.fill(); } }); // colar de conchas
        P.elipse(J.q[0], J.q[1] + 2.5, 7, 6, 0, c.bermuda, '#6fe0d6');
        P.detalhe((g) => { g.fillStyle = c.flor; for (const [dx, dy] of [[-3, 0], [2.5, 3], [0, -2.6], [4, -1]]) { g.beginPath(); g.arc(J.q[0] + dx, J.q[1] + 2.5 + dy, 1, 0, Math.PI * 2); g.fill(); } });
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.8, c.pele, c.peleC);
        P.forma((g) => { for (let i = 0; i < 6; i++) { const a = Math.PI * (1.0 + i * 0.2), r = 7.4; g.moveTo(cab[0] - 1, cab[1] - 2); g.lineTo(cab[0] - 1 + Math.cos(a - 0.15) * r, cab[1] - 2 + Math.sin(a - 0.15) * r); g.lineTo(cab[0] - 1 + Math.cos(a + 0.2) * (r + 2.4), cab[1] - 2 + Math.sin(a + 0.2) * (r + 2.4)); } }, c.cabelo); // cabelo bagunçado
        P.detalhe((g) => { g.strokeStyle = CONTORNO; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 2.4, cab[1] + 3); g.quadraticCurveTo(cab[0] + 4.6, cab[1] + 5, cab[0] + 6.6, cab[1] + 2.6); g.stroke(); });
        olho(P, cab[0] + 3.6, cab[1] - 0.6, l, '#2fb3a8', 0.85);
        P.membro([J.q, J.jf, J.pf], 3.4, c.pele, c.peleC);
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1, 4.8, 1.8, 0, '#ff6fb1');
        if (ataca) this.prancha(P, J, l, true);
        P.membro([J.p, J.cf, J.mf], 2.9, c.pele, c.peleC);
        P.bola(J.mf[0], J.mf[1], 3.2, c.pele, c.peleC);
      },
      poseEspecial(l) {
        if (l.golpe === 'esp') return girar(com(BASE, { cf: [14, -46], mf: [26, -46], ct: [-12, -46], mt: [-22, -46] }), (l.t / 10) * Math.PI * 2, 0, -30); // gira com a prancha
        return com(BASE, { q: [0, -26], p: [4, -40], c: [7, -50], cf: [14, -48], mf: [22, -56], ct: [-10, -46], mt: [-18, -52], jf: [10, -12], pf: [14, 0], jt: [-8, -12], pt: [-14, 0] }); // chama a onda
      },
    },
    volt: {
      escala: 64 / 64,
      cor: { pele: '#c68642', peleC: '#e8a868', jaqueta: '#ff8a1f', jaquetaC: '#ffb866', faixa: '#ffe14d', calca: '#253049', calcaC: '#3e4c6e', capacete: '#ffd23f', capaceteC: '#fff0a0', visor: '#1a2a4a', luva: '#4fb6ff', caixa: '#e8383d' },
      pose(l) {
        if (l.estado === 'parado' || l.estado === 'pousando') { // estalando faíscas nas mãos
          const r = Math.sin(l.t / 12) * 0.8;
          return com(BASE, { p: [1, -45 + r], c: [3, -55 + r], cf: [11, -42], mf: [15, -48 + r], ct: [-2, -40], mt: [6, -46], pf: [9, 0], pt: [-9, 0] });
        }
        if (l.estado === 'final') return com(BASE, { cf: [14, -46], mf: [24, -46], ct: [10, -42], mt: [22, -42] });
        return null;
      },
      desenhar(P, J, l) {
        const c = this.cor, moto = l.estado === 'golpe' && l.golpe === 'sup' && l.t >= 6 && l.t <= 68;
        const a = angulo(J.q, J.p), costas = ponto(ponto(J.p, a + Math.PI, -7), a + Math.PI / 2, -8);
        P.forma((g) => { g.roundRect(costas[0] - 6, costas[1] - 7, 11, 13, 1.5); }, c.caixa); // caixa de entrega
        P.detalhe((g) => { g.fillStyle = '#ffffff'; g.font = `900 5px ${FONTE}`; g.fillText('⚡', costas[0] - 3, costas[1] + 2); });
        if (moto) { // a moto embaixo dele
          P.bola(J.q[0] - 14, -6, 6, '#1a1a24'); P.bola(J.q[0] + 16, -6, 6, '#1a1a24');
          P.forma((g) => { g.moveTo(J.q[0] - 14, -8); g.lineTo(J.q[0] - 4, -18); g.lineTo(J.q[0] + 12, -18); g.lineTo(J.q[0] + 18, -24); g.lineTo(J.q[0] + 20, -8); g.closePath(); }, c.caixa);
          P.detalhe((g) => { g.fillStyle = '#c9d6e3'; g.beginPath(); g.arc(J.q[0] - 14, -6, 2.4, 0, Math.PI * 2); g.arc(J.q[0] + 16, -6, 2.4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(J.q[0] + 20, -16, 1.6, 0, Math.PI * 2); g.fill(); });
        }
        P.membro([J.q, J.jt, J.pt], 3.4, '#1a2236');
        P.elipse(J.pt[0] + 2.4, J.pt[1] - 1.6, 5, 2.4, 0, '#2a2a36');
        P.membro([J.p, J.ct, J.mt], 2.8, '#c86a10');
        P.bola(J.mt[0], J.mt[1], 3.4, '#2f7fd0', c.luva);
        P.membro([J.q, J.p], 6.2, c.jaqueta, c.jaquetaC);
        P.detalhe((g) => { const lado = a + Math.PI / 2; g.strokeStyle = c.faixa; g.lineWidth = 1.4; for (const f of [0.35, 0.7]) { const m = [J.q[0] + (J.p[0] - J.q[0]) * f, J.q[1] + (J.p[1] - J.q[1]) * f], e = ponto(m, lado, 6), d = ponto(m, lado, -6); g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(d[0], d[1]); g.stroke(); } });
        P.elipse(J.q[0], J.q[1] + 1.5, 6.4, 4.8, 0, c.calca, c.calcaC);
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.8, c.pele, c.peleC);
        P.forma((g) => { g.arc(cab[0], cab[1] - 0.5, 8, Math.PI * 0.95, Math.PI * 2.05); g.closePath(); }, c.capacete); // capacete
        P.detalhe((g) => {
          g.fillStyle = c.capaceteC; g.beginPath(); g.ellipse(cab[0] - 2, cab[1] - 5.4, 3.4, 1.4, -0.3, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(26,42,74,0.85)'; g.beginPath(); g.roundRect(cab[0] + 1, cab[1] - 3.6, 7.4, 2.6, 1); g.fill(); // viseira levantada
          g.strokeStyle = CONTORNO; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 2.6, cab[1] + 3.6); g.lineTo(cab[0] + 6, cab[1] + 3.2); g.stroke();
        });
        olho(P, cab[0] + 3.6, cab[1] + 0.2, l, null, 0.8);
        P.membro([J.q, J.jf, J.pf], 3.5, c.calca, c.calcaC);
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1.6, 5, 2.4, 0, '#2a2a36');
        P.membro([J.p, J.cf, J.mf], 3, c.jaqueta, c.jaquetaC);
        P.bola(J.mf[0], J.mf[1], 3.8, c.luva, '#bfe6ff');
        P.detalhe((g) => { if ((l.t || 0) % 6 < 3) { g.strokeStyle = '#fff36a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(J.mf[0] - 3, J.mf[1] - 4); g.lineTo(J.mf[0] - 1, J.mf[1] - 2); g.lineTo(J.mf[0] - 3, J.mf[1] - 1); g.lineTo(J.mf[0], J.mf[1] + 2); g.stroke(); } }); // faísca na luva
      },
      poseEspecial(l) {
        if (l.golpe === 'esp') return l.t < 10 ? com(BASE, { cf: [-2, -44], mf: [-6, -40], ct: [-6, -42], mt: [-10, -38] }) : com(BASE, { p: [5, -45], c: [7, -55], cf: [16, -46], mf: [26, -46], ct: [14, -42], mt: [24, -42] });
        if (l.t >= 6 && l.t <= 68) return com(BASE, { q: [0, -24], p: [6, -38], c: [10, -48], jf: [10, -22], pf: [14, -12], jt: [-2, -22], pt: [4, -12], cf: [12, -36], mf: [20, -34], ct: [6, -36], mt: [16, -32] }); // na moto
        return com(AGACHADO, { cf: [12, -26], mf: [18, -24] });
      },
    },
    kilo: {
      escala: 68 / 64,
      cor: { pele: '#e0a07a', peleC: '#ffc9a0', peleS: '#b07a58', regata: '#2f5fd6', regataC: '#6f93ff', cinto: '#2a1a12', barba: '#2a1a12', munhequeira: '#ffffff' },
      pose(l) {
        if (l.estado === 'parado' || l.estado === 'pousando') { // pesadão, braços abertos
          const r = Math.sin(l.t / 16) * 0.8;
          return com(BASE, { p: [1, -44 + r], c: [3, -54 + r], cf: [13, -38], mf: [16, -44 + r], ct: [-9, -38], mt: [-6, -44 + r], pf: [11, 0], jf: [9, -15], pt: [-11, 0], jt: [-8, -15] });
        }
        if (l.estado === 'final') return com(BASE, { cf: [12, -56], mf: [10, -68], ct: [-10, -56], mt: [-8, -68], pf: [11, 0], pt: [-11, 0] });
        return null;
      },
      barra(P, J, l) {
        const ang = (l.t || 0) / 3, c1 = ponto(J.mf, ang, 30), c2 = ponto(J.mf, ang, -30);
        P.membro([c1, c2], 1.2, '#c9ccd6');
        for (const c of [c1, c2]) { P.elipse(c[0], c[1], 3, 8, ang, '#1e1f24'); P.elipse(ponto(c, ang, Math.sign(c[0] - J.mf[0]) * 0)[0], c[1], 2, 6, ang, '#e8383d'); }
      },
      desenhar(P, J, l) {
        const c = this.cor;
        P.membro([J.q, J.jt, J.pt], 5.2, c.peleS);
        P.elipse(J.pt[0] + 2.6, J.pt[1] - 1.8, 6, 2.8, 0, '#2a2a36');
        P.membro([J.p, J.ct, J.mt], 4.4, c.peleS);
        P.bola(J.mt[0], J.mt[1], 4.4, c.peleS);
        // barrigão de levantador com regata
        const a = angulo(J.q, J.p), meio = [(J.q[0] + J.p[0]) / 2 + 2, (J.q[1] + J.p[1]) / 2];
        P.membro([J.q, J.p], 8.4, c.regata, c.regataC);
        P.elipse(meio[0] + 1, meio[1] + 2, 9.4, 10, a + Math.PI / 2, c.regata, c.regataC);
        P.detalhe((g) => { g.fillStyle = c.pele; for (const d of [-5, 5]) { const om = ponto(ponto(J.p, a + Math.PI / 2, d), a, 1); g.beginPath(); g.arc(om[0], om[1], 3, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ffffff'; g.font = `900 6px ${FONTE}`; g.fillText('K', meio[0] - 1, meio[1] + 1); });
        P.elipse(J.q[0], J.q[1] + 1, 9, 3.4, 0, c.cinto);
        P.detalhe((g) => { g.fillStyle = '#c9a227'; g.fillRect(J.q[0] - 2.4, J.q[1] - 1.4, 4.8, 4.2); });
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.6, c.pele, c.peleC); // careca
        P.forma((g) => { g.ellipse(cab[0] + 2.4, cab[1] + 3.6, 5.6, 4, 0.1, -0.1, Math.PI + 0.5); }, c.barba);
        P.detalhe((g) => { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(cab[0] - 2, cab[1] - 4, 2.2, 1, -0.4, 0, Math.PI * 2); g.fill(); g.strokeStyle = CONTORNO; g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 1.4, cab[1] - 3.2); g.lineTo(cab[0] + 5.4, cab[1] - 2.4); g.stroke(); });
        olho(P, cab[0] + 3.6, cab[1] - 0.8, l, null, 0.8);
        P.membro([J.q, J.jf, J.pf], 5.4, c.pele, c.peleC);
        P.elipse(J.pf[0] + 3, J.pf[1] - 1.8, 6.4, 2.8, 0, '#2a2a36');
        if (l.estado === 'golpe' && l.golpe === 'sup' && l.t >= 8 && l.t <= 62) this.barra(P, J, l);
        P.membro([J.p, J.cf, J.mf], 4.6, c.pele, c.peleC);
        P.bola(J.mf[0], J.mf[1], 4.6, c.pele, c.peleC);
        P.detalhe((g) => { const w = ponto(J.mf, angulo(J.cf, J.mf) + Math.PI, 3.6); g.fillStyle = c.munhequeira; g.beginPath(); g.arc(w[0], w[1], 3.2, 0, Math.PI * 2); g.fill(); });
      },
      poseEspecial(l) {
        if (l.golpe === 'esp') return l.t < 10 ? com(BASE, { p: [5, -42], c: [8, -51], cf: [18, -40], mf: [26, -42], ct: [14, -38], mt: [24, -40] }) : com(BASE, { cf: [10, -60], mf: [6, -74], ct: [-6, -60], mt: [-4, -74] }); // agarra e levanta
        return com(BASE, { cf: [12, -50], mf: [16, -50], ct: [4, -48], mt: [10, -50], pf: [11, 0], pt: [-11, 0] }); // gira a barra
      },
    },
    brasa: {
      escala: 64 / 64,
      cor: { pele: '#f2c9a5', peleC: '#ffe3cc', casaco: '#d9b860', casacoC: '#f2d98a', faixa: '#e8e8e8', faixa2: '#ffe14d', capacete: '#d42a2a', capaceteC: '#ff6a5a', cabelo: '#e0662a', bota: '#1e1e26', extintor: '#e8383d' },
      pose(l) {
        if (l.estado === 'parado' || l.estado === 'pousando') {
          const r = Math.sin(l.t / 14) * 0.8;
          return com(BASE, { p: [1, -45 + r], c: [3, -55 + r], cf: [11, -40], mf: [14, -46 + r], ct: [-4, -40], mt: [2, -44], pf: [9, 0], pt: [-9, 0] });
        }
        if (l.estado === 'final') return com(BASE, { cf: [14, -46], mf: [22, -46], ct: [10, -44], mt: [18, -44] });
        return null;
      },
      escada(P, J, l) {
        const ang = (l.t || 0) / 2.4, a = ponto(J.mf, ang, 24), b = ponto(J.mf, ang, -24), lado = ang + Math.PI / 2;
        for (const d of [-3, 3]) P.membro([ponto(a, lado, d), ponto(b, lado, d)], 0.9, '#c9ccd6');
        P.detalhe((g) => { g.strokeStyle = '#c9ccd6'; g.lineWidth = 1.2; for (let i = -4; i <= 4; i++) { const m = ponto(J.mf, ang, i * 5.4), e = ponto(m, lado, 3), d = ponto(m, lado, -3); g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(d[0], d[1]); g.stroke(); } });
      },
      desenhar(P, J, l) {
        const c = this.cor, a = angulo(J.q, J.p);
        const esp = l.estado === 'golpe' && l.golpe === 'esp';
        const costas = ponto(ponto(J.p, a + Math.PI, -6), a + Math.PI / 2, -7);
        if (!esp) P.forma((g) => { g.roundRect(costas[0] - 3.6, costas[1] - 9, 7, 16, 3); }, c.extintor); // extintor nas costas
        P.membro([[J.c[0] - 5, J.c[1] - 1], [J.c[0] - 9, J.c[1] + 6], [J.c[0] - 8, J.c[1] + 13]], 1.8, c.cabelo); // trança
        P.membro([J.q, J.jt, J.pt], 3.2, '#b39646');
        P.elipse(J.pt[0] + 2.4, J.pt[1] - 1.8, 5, 2.6, 0, c.bota);
        P.membro([J.p, J.ct, J.mt], 2.8, '#b39646');
        P.bola(J.mt[0], J.mt[1], 3, '#3a3a44');
        P.membro([J.q, J.p], 6.2, c.casaco, c.casacoC);
        P.detalhe((g) => { const lado = a + Math.PI / 2; for (const [f, cor] of [[0.3, c.faixa2], [0.4, c.faixa], [0.7, c.faixa2], [0.8, c.faixa]]) { const m = [J.q[0] + (J.p[0] - J.q[0]) * f, J.q[1] + (J.p[1] - J.q[1]) * f], e = ponto(m, lado, 6.2), d = ponto(m, lado, -6.2); g.strokeStyle = cor; g.lineWidth = 1; g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(d[0], d[1]); g.stroke(); } });
        P.elipse(J.q[0], J.q[1] + 1.5, 6.4, 4.8, 0, c.casaco, c.casacoC);
        const cab = J.c;
        P.bola(cab[0], cab[1], 6.6, c.pele, c.peleC);
        P.forma((g) => { g.arc(cab[0] - 0.5, cab[1] - 1.6, 7.4, Math.PI, 0); g.lineTo(cab[0] + 11, cab[1] - 1.2); g.lineTo(cab[0] - 10, cab[1] - 1.2); g.closePath(); }, c.capacete); // capacete de bombeira com aba
        P.detalhe((g) => {
          g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(cab[0] - 0.5, cab[1] - 8.6); g.lineTo(cab[0] + 2, cab[1] - 5); g.lineTo(cab[0] - 3, cab[1] - 5); g.closePath(); g.fill(); // escudo
          g.fillStyle = 'rgba(255,120,140,0.35)'; g.beginPath(); g.arc(cab[0] + 1.6, cab[1] + 3.4, 1.6, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(160,80,40,0.5)'; for (const [dx, dy] of [[1, 2], [2.6, 2.6], [0.2, 3.4]]) { g.beginPath(); g.arc(cab[0] + dx, cab[1] + dy, 0.4, 0, Math.PI * 2); g.fill(); } // sardas
          g.strokeStyle = CONTORNO; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 3, cab[1] + 4); g.quadraticCurveTo(cab[0] + 4.6, cab[1] + 5, cab[0] + 6.2, cab[1] + 3.6); g.stroke();
        });
        olho(P, cab[0] + 3.6, cab[1] + 0.2, l, '#2f8a4f', 0.85);
        P.membro([J.q, J.jf, J.pf], 3.4, c.casaco, c.casacoC);
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1.8, 5, 2.6, 0, c.bota);
        if (l.estado === 'golpe' && l.golpe === 'sup' && l.t >= 6 && l.t <= 62) this.escada(P, J, l);
        if (esp) {
          const ang = angulo(J.cf, J.mf), corpo = ponto(J.mf, ang + Math.PI / 2, 2);
          P.elipse(corpo[0], corpo[1], 7, 3.6, ang, c.extintor, '#ff8a8f');
          P.membro([ponto(corpo, ang, 6), ponto(corpo, ang, 11)], 1.2, '#1a1a24');
        }
        P.membro([J.p, J.cf, J.mf], 3, c.casaco, c.casacoC);
        P.bola(J.mf[0], J.mf[1], 3.2, '#3a3a44');
      },
      poseEspecial(l) {
        if (l.golpe === 'esp') return com(BASE, { p: [3, -45], c: [5, -55], cf: [14, -44], mf: [22, -44], ct: [8, -40], mt: [16, -42] }); // aponta o extintor
        return com(BASE, { cf: [12, -48], mf: [18, -48], ct: [6, -46], mt: [14, -48] }); // gira a escada
      },
    },
    fossil: {
      escala: 66 / 64,
      cor: { pele: '#e8c4a0', peleC: '#ffe0c4', jaleco: '#f4f4f0', jalecoS: '#c9c9c4', calca: '#6b4a2e', camisa: '#2fb36b', cabelo: '#d8d8e0', metal: '#8f9bb0', metalC: '#c9d3e3', metalS: '#5a6478' },
      pose(l) {
        if (l.estado === 'parado' || l.estado === 'pousando') { // braço robô estalando a mandíbula
          const r = Math.sin(l.t / 14) * 0.8;
          return com(BASE, { p: [1, -45 + r], c: [3, -55 + r], cf: [12, -40], mf: [18, -42 + r], ct: [-4, -40], mt: [0, -34], pf: [9, 0], pt: [-9, 0] });
        }
        if (l.estado === 'final') return com(BASE, { cf: [14, -50], mf: [24, -56], ct: [-6, -42], mt: [-10, -36] });
        return null;
      },
      mandibula(P, x, y, ang, s, abre) {
        const topo = (g, sinal) => { g.moveTo(x, y); g.lineTo(x + Math.cos(ang - sinal * abre) * 11 * s, y + Math.sin(ang - sinal * abre) * 11 * s); g.lineTo(x + Math.cos(ang - sinal * (abre + 0.6)) * 6 * s, y + Math.sin(ang - sinal * (abre + 0.6)) * 6 * s); g.closePath(); };
        P.forma((g) => topo(g, 1), this.cor.metal);
        P.forma((g) => topo(g, -1), this.cor.metalS);
        P.detalhe((g) => { g.fillStyle = '#ffffff'; for (const sinal of [1, -1]) for (let i = 1; i <= 3; i++) { const d = i * 2.6 * s, a = ang - sinal * abre; g.beginPath(); g.arc(x + Math.cos(a) * d + Math.cos(a + sinal * Math.PI / 2) * 0.6 * s, y + Math.sin(a) * d + Math.sin(a + sinal * Math.PI / 2) * 0.6 * s, 0.7 * s, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(x - Math.cos(ang) * 1.6 * s, y - Math.sin(ang) * 1.6 * s - 1.4 * s, 0.9 * s, 0, Math.PI * 2); g.fill(); });
      },
      desenhar(P, J, l) {
        const c = this.cor, a = angulo(J.q, J.p);
        // jaleco comprido atrás
        P.forma((g) => { const lado = a + Math.PI / 2, o1 = ponto(J.p, lado, 6.4), o2 = ponto(J.p, lado, -6.4), b1 = ponto(ponto(J.q, lado, 8), a, -12), b2 = ponto(ponto(J.q, lado, -8), a, -12); g.moveTo(o1[0], o1[1]); g.lineTo(o2[0], o2[1]); g.lineTo(b2[0], b2[1]); g.lineTo(b1[0], b1[1]); g.closePath(); }, c.jalecoS);
        P.membro([J.q, J.jt, J.pt], 3, c.calca);
        P.elipse(J.pt[0] + 2.4, J.pt[1] - 1.4, 4.8, 2.2, 0, '#2a1a12');
        P.membro([J.p, J.ct, J.mt], 2.6, c.jalecoS);
        P.bola(J.mt[0], J.mt[1], 2.8, c.pele);
        P.membro([J.q, J.p], 6, c.jaleco, '#ffffff');
        P.detalhe((g) => { const topo = ponto(J.p, a + Math.PI, -1), meio = ponto(J.p, a + Math.PI, -10); g.fillStyle = c.camisa; g.beginPath(); g.moveTo(topo[0] - 2, topo[1]); g.lineTo(topo[0] + 3, topo[1]); g.lineTo(meio[0] + 1, meio[1]); g.closePath(); g.fill(); g.fillStyle = '#e8383d'; g.fillRect(topo[0] + 0.2, topo[1] + 1, 1.2, 6); g.fillStyle = '#4fb6ff'; g.fillRect(meio[0] + 3, meio[1] - 4, 1, 3); }); // camisa, gravata e caneta no bolso
        P.elipse(J.q[0], J.q[1] + 1.5, 6.2, 4.6, 0, c.calca);
        const cab = J.c;
        P.forma((g) => { for (let i = 0; i < 7; i++) { const an = Math.PI * (0.95 + i * 0.17); g.moveTo(cab[0] - 1, cab[1] - 2); g.lineTo(cab[0] - 1 + Math.cos(an - 0.12) * 7, cab[1] - 2 + Math.sin(an - 0.12) * 7); g.lineTo(cab[0] - 1 + Math.cos(an) * 11, cab[1] - 2 + Math.sin(an) * 11); } }, c.cabelo); // cabelo de cientista maluco
        P.bola(cab[0], cab[1], 6.6, c.pele, c.peleC);
        P.detalhe((g) => { g.strokeStyle = CONTORNO; g.lineWidth = 0.8; g.beginPath(); g.arc(cab[0] + 3.6, cab[1] - 0.6, 2.8, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(180,220,255,0.35)'; g.fill(); g.lineCap = 'round'; g.beginPath(); g.moveTo(cab[0] + 3, cab[1] + 3.8); g.quadraticCurveTo(cab[0] + 5, cab[1] + 5.2, cab[0] + 6.6, cab[1] + 3.4); g.stroke(); });
        olho(P, cab[0] + 3.6, cab[1] - 0.6, l, null, 0.75);
        P.membro([J.q, J.jf, J.pf], 3.2, c.calca);
        P.elipse(J.pf[0] + 2.4, J.pf[1] - 1.4, 4.8, 2.2, 0, '#2a1a12');
        // braço robô: segmentos de metal e a mandíbula de dinossauro na ponta
        const ang = angulo(J.cf, J.mf), estica = l.estado === 'golpe' && l.golpe === 'esp' && l.t >= 8 && l.t <= 26;
        const mao = estica ? ponto(J.mf, ang, 34) : J.mf;
        P.membro([J.p, J.cf, mao], 3.2, c.metal, c.metalC);
        P.detalhe((g) => { g.fillStyle = c.metalS; for (const f of [0.3, 0.6, 0.85]) { const pp = [J.cf[0] + (mao[0] - J.cf[0]) * f, J.cf[1] + (mao[1] - J.cf[1]) * f]; g.beginPath(); g.arc(pp[0], pp[1], 1.2, 0, Math.PI * 2); g.fill(); } });
        const trex = l.estado === 'golpe' && l.golpe === 'sup' && l.t >= 20;
        this.mandibula(P, mao[0], mao[1], ang, trex ? 2.6 : 1, 0.25 + Math.abs(Math.sin((l.t || 0) / (estica ? 2 : 6))) * 0.35);
      },
      poseEspecial(l) {
        if (l.golpe === 'esp') return com(BASE, { p: [4, -45], c: [6, -55], cf: [16, -46], mf: [24, -46] }); // braço estica e morde
        return com(BASE, { q: [2, -28], p: [8, -42], c: [11, -51], cf: [18, -46], mf: [26, -50], jf: [12, -14], pf: [16, 0], jt: [-6, -12], pt: [-12, 0] }); // T-rex!
      },
    },
  };

  function desenharCorpo(g, l, modo) {
    const arte = ARTE[l.id], J0 = poseDe(l), J = {};
    for (const k in J0) J[k] = [J0[k][0] * arte.escala, J0[k][1] * arte.escala];
    if (modo === 'brilho' || modo === 'forca') { g.save(); g.shadowColor = modo === 'forca' ? '#ff6a2a' : '#ffe066'; g.shadowBlur = 14; arte.desenhar(pincel(g, 'contorno'), J, l); g.restore(); }
    else arte.desenhar(pincel(g, 'contorno'), J, l);
    arte.desenhar(pincel(g, ['branco', 'madeira', 'gelo', 'choque'].includes(modo) ? modo : 'cor'), J, l);
  }

  // ---------- Texto ----------
  function texto(g, txt, x, y, tam, cor, opc) {
    opc = opc || {};
    g.save();
    g.font = `${opc.peso || 900} ${tam}px ${FONTE}`;
    g.textAlign = opc.centro ? 'center' : opc.direita ? 'right' : 'left';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    if (opc.contorno !== false) {
      g.strokeStyle = opc.sombra || CONTORNO; g.lineWidth = Math.max(1.4, tam * 0.2);
      g.strokeText(txt, x + tam * 0.06, y + tam * 0.1); g.strokeText(txt, x, y);
    }
    if (opc.gradiente) { const gr = g.createLinearGradient(0, y, 0, y + tam); gr.addColorStop(0, opc.gradiente[0]); gr.addColorStop(1, opc.gradiente[1]); g.fillStyle = gr; }
    else g.fillStyle = cor;
    g.fillText(txt, x, y);
    g.restore();
  }

  // ---------- Cenários ----------
  function rngFixo(semente) { let x = semente; return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); }
  function degrade(g, y0, y1, cores) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    cores.forEach((c, i) => gr.addColorStop(i / (cores.length - 1), c));
    g.fillStyle = gr; g.fillRect(-2, y0, W + 4, y1 - y0);
  }
  function brilhoRedondo(g, x, y, r, cor, alfa) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alfa === undefined ? 1 : alfa; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }
  function retArred(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function pinheiro(g, x, base, alt, cor, neve, sombra) {
    const camadas = 4;
    for (let i = 0; i < camadas; i++) {
      const topo = base - alt + (alt * i) / (camadas + 1), larg = (alt / 3.2) * ((i + 1.4) / camadas), fundo = topo + alt / 2.4;
      g.fillStyle = cor; g.beginPath(); g.moveTo(x, topo); g.quadraticCurveTo(x + larg * 0.4, topo + (fundo - topo) * 0.6, x + larg, fundo); g.lineTo(x - larg, fundo); g.quadraticCurveTo(x - larg * 0.4, topo + (fundo - topo) * 0.6, x, topo); g.fill();
      if (sombra) { g.fillStyle = sombra; g.beginPath(); g.moveTo(x, topo); g.lineTo(x + larg, fundo); g.lineTo(x, fundo); g.fill(); }
      if (neve) { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, topo); g.quadraticCurveTo(x + larg * 0.3, topo + 4, x + larg * 0.5, topo + (fundo - topo) * 0.45); g.quadraticCurveTo(x, topo + (fundo - topo) * 0.3, x - larg * 0.5, topo + (fundo - topo) * 0.45); g.quadraticCurveTo(x - larg * 0.3, topo + 4, x, topo); g.fill(); }
    }
    g.fillStyle = '#4a2f1e'; g.fillRect(x - 1.6, base - alt / 6, 3.2, alt / 6);
  }
  function nuvem(g, x, y, s, cor) {
    g.fillStyle = cor || '#ffffff';
    for (const [dx, dy, r] of [[0, 0, 8], [9, -4, 10], [20, 0, 8], [-8, 3, 6], [28, 3, 6]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
    g.fillRect(x - 8 * s, y + 2 * s, 42 * s, 7 * s);
  }
  function palmeira(g, x, base, alt, inv) {
    const topo = [x + 16 * inv, base - alt];
    g.strokeStyle = '#6b4530'; g.lineCap = 'round'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + 2 * inv, base - alt * 0.6, topo[0], topo[1]); g.stroke();
    g.strokeStyle = 'rgba(40,20,10,0.35)'; g.lineWidth = 1;
    for (let i = 1; i < 12; i++) { const f = i / 12, px = (1 - f) * (1 - f) * x + 2 * (1 - f) * f * (x + 2 * inv) + f * f * topo[0], py = (1 - f) * (1 - f) * base + 2 * (1 - f) * f * (base - alt * 0.6) + f * f * topo[1]; g.beginPath(); g.moveTo(px - 3, py); g.lineTo(px + 3, py - 1); g.stroke(); }
    for (const [ang, comp] of [[-2.7, 30], [-0.4, 32], [-1.9, 26], [-1.1, 27], [-3.1, 24], [0.2, 24], [-1.5, 20]]) {
      const fim = ponto(topo, ang, comp), ctrl = ponto(topo, ang - 0.25 * Math.sign(Math.cos(ang) || 1), comp * 0.6);
      g.fillStyle = '#1f5a3a'; g.beginPath(); g.moveTo(topo[0], topo[1]); g.quadraticCurveTo(ctrl[0], ctrl[1] - 6, fim[0], fim[1] + 4); g.quadraticCurveTo(ctrl[0], ctrl[1] + 2, topo[0], topo[1] + 3); g.fill();
      g.strokeStyle = '#2f7d4f'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(topo[0], topo[1]); g.quadraticCurveTo(ctrl[0], ctrl[1] - 3, fim[0], fim[1] + 4); g.stroke();
    }
    g.fillStyle = '#5a3a22'; for (const [dx, dy] of [[-2, 3], [2, 4], [0, 6]]) { g.beginPath(); g.arc(topo[0] + dx, topo[1] + dy, 2.2, 0, Math.PI * 2); g.fill(); }
  }
  function pessoa(g, x, y, i, t) {
    const pele = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69'][i % 4], roupa = ['#3a6cf0', '#e8383d', '#2fb36b', '#ffb400', '#8a4af0'][i % 5];
    const pulo = Math.max(0, Math.sin(t / 7 + i * 1.7)) * 2;
    g.fillStyle = roupa; retArred(g, x - 4, y + 6 - pulo, 8, 12, 3); g.fill();
    g.fillStyle = pele; g.beginPath(); g.arc(x, y + 2 - pulo, 3.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x, y + 1 - pulo, 3.6, Math.PI, Math.PI * 2); g.fill();
    g.strokeStyle = pele; g.lineWidth = 2; g.lineCap = 'round'; const braco = Math.sin(t / 5 + i) > 0.6 ? -6 : 2;
    g.beginPath(); g.moveTo(x + 4, y + 8 - pulo); g.lineTo(x + 7, y + 8 + braco - pulo); g.stroke();
  }

  const CENARIOS = {
    praia: {
      fundo(g) {
        degrade(g, 0, 112, ['#2b1450', '#5a1f73', '#b0336e', '#f5795f', '#ffc867']);
        brilhoRedondo(g, 250, 100, 90, 'rgba(255,220,140,0.55)');
        const sol = g.createLinearGradient(0, 76, 0, 112); sol.addColorStop(0, '#fff2b0'); sol.addColorStop(1, '#ff9a3c');
        g.save(); g.beginPath(); g.arc(250, 112, 30, Math.PI, 0); g.clip(); g.fillStyle = sol; g.fillRect(218, 80, 64, 34);
        g.fillStyle = 'rgba(176,51,110,0.9)'; for (const [y, h] of [[96, 1.5], [101, 2], [106, 2.6]]) g.fillRect(218, y, 64, h); g.restore();
        nuvem(g, 40, 40, 0.8, 'rgba(255,190,200,0.45)'); nuvem(g, 320, 30, 0.6, 'rgba(255,190,200,0.35)');
        degrade(g, 112, 152, ['#5b3a9a', '#3354b0', '#1f62b6']);
        const areia = g.createLinearGradient(0, 150, 0, 216); areia.addColorStop(0, '#f6dc9c'); areia.addColorStop(1, '#c99a5a');
        g.fillStyle = areia; g.beginPath(); g.moveTo(0, 156); g.quadraticCurveTo(100, 146, 200, 154); g.quadraticCurveTo(300, 160, W, 150); g.lineTo(W, H); g.lineTo(0, H); g.fill();
        const r = rngFixo(7); g.fillStyle = 'rgba(150,100,50,0.35)'; for (let i = 0; i < 160; i++) { g.beginPath(); g.arc(r() * W, 162 + r() * 54, 0.5 + r() * 0.6, 0, Math.PI * 2); g.fill(); }
        palmeira(g, 26, 172, 118, 1); palmeira(g, 352, 168, 106, -1); palmeira(g, 76, 166, 82, 1);
        g.fillStyle = '#ff6fb1'; g.beginPath(); g.moveTo(300, 186); g.arc(300, 186, 12, Math.PI, 0); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(300, 186, 12, Math.PI * 1.3, Math.PI * 1.5); g.stroke(); g.strokeStyle = '#6b4530'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(300, 174); g.lineTo(304, 200); g.stroke();
      },
      animar(g, t) {
        for (let i = 0; i < 7; i++) {
          const y = 116 + i * 5.5, off = Math.sin(t / 30 + i) * 8;
          g.strokeStyle = `rgba(255,255,255,${0.45 - i * 0.05})`; g.lineWidth = 0.8;
          for (let x = -30 + off + (i * 37) % 40; x < W; x += 56) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 7, y - 1.4, x + 16 - i, y); g.stroke(); }
        }
        g.fillStyle = 'rgba(255,233,161,0.55)'; for (let i = 0; i < 5; i++) { const w = 26 - i * 4; g.fillRect(250 - w / 2 + Math.sin(t / 20 + i) * 3, 116 + i * 7, w, 1.2); }
        const sobe = Math.sin(t / 25) * 2;
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(0, 152 + sobe); for (let x = 0; x <= W; x += 16) g.quadraticCurveTo(x + 8, 150 + sobe + Math.sin(x / 20 + t / 15), x + 16, 152 + sobe); g.lineTo(W, 155 + sobe); g.lineTo(0, 155 + sobe); g.fill();
        for (const [vel, base, fase] of [[0.4, 40, 0], [0.3, 60, 160], [0.35, 30, 280]]) {
          const x = ((t * vel + fase) % (W + 40)) - 20, y = base + Math.sin(t / 40 + fase) * 6, asa = Math.sin(t / 6 + fase) * 2.5;
          g.strokeStyle = '#2b1450'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x - 5, y - asa); g.quadraticCurveTo(x - 2, y - 2, x, y); g.quadraticCurveTo(x + 2, y - 2, x + 5, y - asa); g.stroke();
        }
      },
    },
    telhado: {
      fundo(g) {
        degrade(g, 0, 168, ['#05041a', '#0e0b33', '#1f1757', '#3a2672']);
        const r = rngFixo(3);
        brilhoRedondo(g, 320, 36, 50, 'rgba(255,246,201,0.35)');
        g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(320, 36, 14, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(200,190,140,0.5)'; for (const [dx, dy, rr] of [[-4, -3, 3], [4, 4, 2.4], [-2, 6, 1.6]]) { g.beginPath(); g.arc(320 + dx, 36 + dy, rr, 0, Math.PI * 2); g.fill(); }
        this.estrelas = []; for (let i = 0; i < 70; i++) this.estrelas.push([r() * W, r() * 100, r()]);
        let x = -4; while (x < W) { const w = 22 + r() * 30, h = 50 + r() * 70; g.fillStyle = '#17123d'; g.fillRect(x, 156 - h, w, h + 12); if (r() < 0.3) g.fillRect(x + w / 2 - 1, 156 - h - 10, 2, 10); x += w + 2; }
        this.janelas = []; x = -10;
        while (x < W) { const w = 28 + r() * 34, h = 36 + r() * 64; const gr = g.createLinearGradient(0, 166 - h, 0, 166); gr.addColorStop(0, '#2a2365'); gr.addColorStop(1, '#1b1646'); g.fillStyle = gr; g.fillRect(x, 166 - h, w, h); this.janelas.push([x, 166 - h, w, h, r()]); x += w + 3; }
        const chao = g.createLinearGradient(0, 168, 0, H); chao.addColorStop(0, '#54477e'); chao.addColorStop(1, '#241c42');
        g.fillStyle = chao; g.fillRect(0, 168, W, 48);
        g.fillStyle = '#7a69aa'; g.fillRect(0, 168, W, 1.5);
        g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; for (let i = -12; i < 14; i++) { g.beginPath(); g.moveTo(192 + i * 18, 170); g.lineTo(192 + i * 40, H); g.stroke(); }
        g.fillStyle = '#2b2350'; retArred(g, 30, 126, 34, 42, 3); g.fill(); g.fillStyle = '#3a3068'; g.fillRect(26, 122, 42, 6); g.fillStyle = '#211a40'; for (const dx of [32, 58]) g.fillRect(dx, 150, 3, 18);
        g.strokeStyle = '#2b2350'; g.lineWidth = 2; g.beginPath(); g.moveTo(300, 168); g.lineTo(300, 116); g.moveTo(290, 124); g.lineTo(310, 124); g.moveTo(294, 116); g.lineTo(306, 116); g.stroke();
      },
      animar(g, t) {
        for (const [x, y, k] of this.estrelas) { g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 30 + k * 10)); g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); }
        g.globalAlpha = 1;
        for (const [x, y, w, h, s] of this.janelas) for (let j = y + 5; j < y + h - 4; j += 7) for (let i = x + 4; i < x + w - 4; i += 6) {
          const k = Math.floor(i * 7 + j * 13 + s * 100) % 11; if (k > 4) continue;
          const apaga = k === 0 && Math.floor(t / 50 + i) % 5 === 0;
          g.fillStyle = apaga ? '#2b2560' : k % 2 ? '#ffd166' : '#ffb347'; g.fillRect(i, j, 3, 4);
        }
        const neon = Math.floor(t / 25) % 7 !== 0;
        g.fillStyle = '#1f1430'; retArred(g, 150, 92, 84, 28, 4); g.fill();
        g.save(); if (neon) { g.shadowColor = '#ff4fd8'; g.shadowBlur = 14; }
        texto(g, 'K.O', 192, 95, 20, neon ? '#ff8ae6' : '#5a2a55', { centro: true, contorno: false }); g.restore();
        g.fillStyle = Math.floor(t / 30) % 2 ? '#ff3b3b' : '#5a1a1a'; g.beginPath(); g.arc(300, 114, 1.6, 0, Math.PI * 2); g.fill();
      },
    },
    floresta: {
      fundo(g) {
        degrade(g, 0, 176, ['#a8ecdf', '#86d6c0', '#6cc0a2']);
        brilhoRedondo(g, 280, 30, 120, 'rgba(255,255,220,0.6)');
        const camada = (base, cor, sombra, alt, passo, semente) => { const r = rngFixo(semente); for (let x = -20; x < W + 20; x += passo) pinheiro(g, x + r() * 10, base, alt + r() * 20, cor, false, sombra); };
        camada(132, '#7fbca0', null, 60, 24, 2); camada(156, '#4f9a7a', 'rgba(0,40,30,0.15)', 72, 32, 5); camada(186, '#2a6e55', 'rgba(0,30,20,0.25)', 90, 44, 9);
        g.save(); g.globalAlpha = 0.16; g.fillStyle = '#fffbe0';
        for (const x of [70, 190, 290]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 26, 0); g.lineTo(x + 80, 176); g.lineTo(x + 40, 176); g.fill(); }
        g.restore();
        const grama = g.createLinearGradient(0, 172, 0, H); grama.addColorStop(0, '#6db043'); grama.addColorStop(1, '#386b22');
        g.fillStyle = grama; g.beginPath(); g.moveTo(0, 174); g.quadraticCurveTo(190, 168, W, 174); g.lineTo(W, H); g.lineTo(0, H); g.fill();
        const r = rngFixo(11); g.strokeStyle = '#8fd060'; g.lineWidth = 0.8; for (let i = 0; i < 140; i++) { const x = r() * W, y = 176 + r() * 38; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - 2 - r() * 2); g.stroke(); }
        g.fillStyle = '#6b4226'; retArred(g, 10, 182, 56, 12, 6); g.fill(); g.fillStyle = '#c9a06a'; g.beginPath(); g.ellipse(64, 188, 4, 6, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#8a5a34'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(64, 188, 2, 3.4, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#efe4c8'; g.fillRect(332, 186, 3, 7); g.fillStyle = '#e04a3a'; g.beginPath(); g.ellipse(333.5, 186, 6, 4, 0, Math.PI, 0); g.fill(); g.fillStyle = '#ffffff'; for (const [dx, dy] of [[-2.5, -1.6], [1.5, -2.6], [3, -1]]) { g.beginPath(); g.arc(333.5 + dx, 186 + dy, 0.8, 0, Math.PI * 2); g.fill(); }
      },
      animar(g, t) {
        for (let i = 0; i < 14; i++) {
          const x = ((i * 53 + t * (0.3 + (i % 3) * 0.1)) % (W + 20)) - 10, y = (i * 37 + t * (0.5 + (i % 4) * 0.15)) % 200;
          g.fillStyle = i % 3 ? '#e8a33a' : '#d2622e'; g.beginPath(); g.ellipse(x + Math.sin((t + i * 20) / 15) * 4, y, 2.2, 1, (t + i * 30) / 20, 0, Math.PI * 2); g.fill();
        }
        brilhoRedondo(g, 250 + Math.sin(t / 30) * 30, 120 + Math.cos(t / 20) * 10, 4, 'rgba(255,240,120,0.9)', 0.6 + 0.4 * Math.sin(t / 5));
      },
    },
    feira: {
      fundo(g) {
        degrade(g, 0, 112, ['#3aa8ff', '#7cceff', '#bfe8ff']);
        nuvem(g, 40, 26, 1); nuvem(g, 230, 16, 0.8); nuvem(g, 330, 40, 0.7);
        g.fillStyle = '#f3e4c4'; g.fillRect(0, 66, W, 50);
        g.fillStyle = '#c45a3d'; g.fillRect(0, 62, W, 6);
        for (let x = 6; x < W; x += 48) { g.fillStyle = '#7fb0c9'; retArred(g, x + 6, 76, 14, 18, 2); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(x + 12.4, 76, 1.2, 18); g.fillStyle = '#d9c39b'; g.fillRect(x + 4, 94, 18, 2); }
        const cores = [['#e8383d', '#ffffff'], ['#2fb36b', '#fff5c2'], ['#ffb400', '#ffffff'], ['#3a6cf0', '#ffffff'], ['#ff6fb1', '#ffffff']];
        for (let i = 0; i < 5; i++) {
          const x = 4 + i * 77, [a, b] = cores[i];
          g.fillStyle = '#6b4a2e'; g.fillRect(x + 3, 120, 3, 52); g.fillRect(x + 67, 120, 3, 52);
          for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? b : a; g.beginPath(); g.moveTo(x + k * 9, 110); g.lineTo(x + k * 9 + 9, 110); g.lineTo(x + k * 9 + 9, 124); g.arc(x + k * 9 + 4.5, 124, 4.5, 0, Math.PI); g.fill(); }
          g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 110, 72, 2);
          const cx = g.createLinearGradient(0, 150, 0, 172); cx.addColorStop(0, '#b07a45'); cx.addColorStop(1, '#7a5230');
          g.fillStyle = cx; retArred(g, x + 6, 150, 62, 22, 2); g.fill(); g.strokeStyle = 'rgba(60,35,15,0.5)'; g.lineWidth = 0.8; for (const dy of [157, 164]) { g.beginPath(); g.moveTo(x + 6, dy); g.lineTo(x + 68, dy); g.stroke(); }
          const r = rngFixo(i + 20), frutas = ['#ff4b3e', '#ffd23f', '#7bd651', '#ff9a2e', '#b04ad6'];
          for (let f = 0; f < 18; f++) { const fx = x + 10 + r() * 54, fy = 146 + r() * 5, cor = frutas[(r() * 5) | 0]; g.fillStyle = cor; g.beginPath(); g.arc(fx, fy, 2.6, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(fx - 0.8, fy - 0.9, 0.8, 0, Math.PI * 2); g.fill(); }
        }
        const chao = g.createLinearGradient(0, 172, 0, H); chao.addColorStop(0, '#c4bcae'); chao.addColorStop(1, '#8a8274');
        g.fillStyle = chao; g.fillRect(0, 172, W, 44);
        const r = rngFixo(5); g.strokeStyle = 'rgba(80,72,60,0.35)'; g.lineWidth = 0.7;
        for (let y = 175; y < H; y += 7) for (let x = ((y / 7) % 2) * 9 - 9; x < W; x += 18) { g.beginPath(); g.roundRect(x + r(), y, 16, 6, 2.5); g.stroke(); }
      },
      animar(g, t) {
        for (let i = 0; i < 7; i++) pessoa(g, 20 + i * 52 + Math.sin(i) * 6, 100, i, t);
        const cores = ['#e8383d', '#ffd23f', '#2fb36b', '#3a6cf0', '#ff6fb1'];
        g.strokeStyle = '#5a4a3a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, 92); for (let x = 0; x <= W; x += 64) g.quadraticCurveTo(x + 32, 100 + Math.sin(t / 30) * 1.5, x + 64, 92); g.stroke();
        for (let x = 6, i = 0; x < W; x += 14, i++) {
          const fase = (x % 64) / 64, y = 92 + Math.sin(fase * Math.PI) * (8 + Math.sin(t / 30) * 1.5), bal = Math.sin(t / 12 + i * 0.7) * 0.25;
          g.save(); g.translate(x, y); g.rotate(bal); g.fillStyle = cores[i % 5]; g.beginPath(); g.moveTo(-4, 0); g.lineTo(4, 0); g.lineTo(0, 7); g.fill(); g.restore();
        }
      },
    },
    academia: {
      fundo(g) {
        degrade(g, 0, 172, ['#2f3445', '#40475c', '#4d556c']);
        g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 2, 172);
        const ceu = g.createLinearGradient(0, 40, 0, 120); ceu.addColorStop(0, '#8fd0ff'); ceu.addColorStop(1, '#d8f1ff');
        g.fillStyle = '#20232d'; retArred(g, 36, 36, 128, 88, 4); g.fill(); g.fillStyle = ceu; g.fillRect(41, 41, 118, 78);
        nuvem(g, 70, 70, 0.6); g.fillStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(60 + i * 32, 41); g.lineTo(70 + i * 32, 41); g.lineTo(50 + i * 32, 119); g.lineTo(40 + i * 32, 119); g.fill(); }
        g.fillStyle = '#20232d'; g.fillRect(98, 41, 3, 78);
        g.fillStyle = '#1a1a1a'; retArred(g, 214, 58, 126, 30, 4); g.fill(); g.strokeStyle = '#ffcc00'; g.lineWidth = 2; g.stroke();
        g.save(); g.shadowColor = '#ffcc00'; g.shadowBlur = 10; texto(g, 'K.O GYM', 277, 63, 18, '#ffd84d', { centro: true, contorno: false }); g.restore();
        g.fillStyle = '#6c7280'; retArred(g, 212, 104, 142, 6, 2); g.fill(); g.fillRect(220, 110, 4, 62); g.fillRect(342, 110, 4, 62);
        for (let i = 0; i < 6; i++) { g.fillStyle = '#16171c'; retArred(g, 228 + i * 19, 114, 7, 20, 2); g.fill(); g.fillStyle = '#9aa0ad'; g.fillRect(226 + i * 19, 122, 11, 3); }
        g.strokeStyle = '#c9ccd6'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(166, 152); g.lineTo(204, 152); g.stroke();
        g.fillStyle = '#1e1f24'; for (const x of [164, 200]) { retArred(g, x, 142, 8, 20, 2); g.fill(); }
        const chao = g.createLinearGradient(0, 172, 0, H); chao.addColorStop(0, '#2a2c33'); chao.addColorStop(1, '#16171b');
        g.fillStyle = chao; g.fillRect(0, 172, W, 44);
        g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; for (let i = -10; i < 12; i++) { g.beginPath(); g.moveTo(192 + i * 22, 172); g.lineTo(192 + i * 46, H); g.stroke(); }
        g.fillStyle = '#e8383d'; g.fillRect(0, 172, W, 2);
      },
      animar(g, t) {
        for (let i = 0; i < 4; i++) { const gr = g.createLinearGradient(0, 0, 0, 172); gr.addColorStop(0, `rgba(255,255,230,${0.16 + 0.04 * Math.sin(t / 20 + i)})`); gr.addColorStop(1, 'rgba(255,255,230,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(40 + i * 96, 0); g.lineTo(64 + i * 96, 0); g.lineTo(84 + i * 96, 172); g.lineTo(20 + i * 96, 172); g.fill(); }
        g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { retArred(g, 38 + i * 96, 0, 28, 3, 1.5); g.fill(); }
      },
    },
    neve: {
      fundo(g) {
        degrade(g, 0, 176, ['#7aa6e0', '#a8c6ef', '#dbe8fa']);
        const montanha = (x, base, alt, larg, cor, sombra) => {
          g.fillStyle = cor; g.beginPath(); g.moveTo(x - larg, base); g.lineTo(x, base - alt); g.lineTo(x + larg, base); g.fill();
          g.fillStyle = sombra; g.beginPath(); g.moveTo(x, base - alt); g.lineTo(x + larg, base); g.lineTo(x + larg * 0.2, base); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, base - alt); g.lineTo(x + larg * 0.3, base - alt * 0.7); g.lineTo(x + larg * 0.12, base - alt * 0.74); g.lineTo(x, base - alt * 0.66); g.lineTo(x - larg * 0.14, base - alt * 0.75); g.lineTo(x - larg * 0.3, base - alt * 0.7); g.fill();
        };
        montanha(70, 150, 96, 96, '#7084b0', 'rgba(40,50,90,0.25)'); montanha(230, 150, 118, 128, '#5f74a3', 'rgba(40,50,90,0.3)'); montanha(360, 150, 84, 84, '#7084b0', 'rgba(40,50,90,0.25)');
        const r = rngFixo(4); for (let x = -10; x < W; x += 28) pinheiro(g, x + r() * 8, 178, 44 + r() * 22, '#2e5a5a', true, 'rgba(0,20,30,0.2)');
        const chao = g.createLinearGradient(0, 174, 0, H); chao.addColorStop(0, '#f4f9ff'); chao.addColorStop(1, '#bcd4f0');
        g.fillStyle = chao; g.beginPath(); g.moveTo(0, 176); g.quadraticCurveTo(190, 170, W, 176); g.lineTo(W, H); g.lineTo(0, H); g.fill();
        g.strokeStyle = 'rgba(140,175,220,0.5)'; g.lineWidth = 1; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 186 + ((x / 40) % 3) * 8); g.lineTo(x + 26, 186 + ((x / 40) % 3) * 8); g.stroke(); }
      },
      animar(g, t) {
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 80; i++) {
          const x = (i * 59 + t * 0.4 + Math.sin((t + i * 30) / 40) * 10) % W, y = (i * 31 + t * (0.4 + (i % 5) * 0.12)) % 200;
          g.globalAlpha = i % 4 ? 0.8 : 1; g.beginPath(); g.arc(x, y, i % 4 ? 0.8 : 1.4, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      },
    },
  };

  // ---------- Efeitos ----------
  const parts = [], aneis = [], avisos = [], impactos = [];
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  function impacto(x, y, forte, defesa = false) {
    if (impactos.length >= 20) impactos.shift();
    impactos.push({ x, y, forte, defesa, t: 0, dir: Math.random() * Math.PI });
  }
  function desenharImpactos(g) {
    for (let i = impactos.length - 1; i >= 0; i--) {
      const p = impactos[i], progresso = p.t++ / 12;
      if (progresso >= 1) { impactos.splice(i, 1); continue; }
      const r = (p.defesa ? 10 : 12 + p.forte * 5) * (0.5 + progresso);
      g.save(); g.translate(p.x, p.y); g.rotate(p.dir);
      g.globalAlpha = (1 - progresso) * 0.85;
      g.strokeStyle = p.defesa ? '#8de4ff' : '#ffab38'; g.lineWidth = 2.5 * (1 - progresso) + 0.5;
      g.beginPath(); g.ellipse(0, 0, r, r * 0.65, 0, 0, Math.PI * 2); g.stroke();
      if (!p.defesa) {
        g.fillStyle = '#fff4cf'; g.beginPath();
        for (let n = 0; n < 16; n++) {
          const a = n * Math.PI / 8, raio = n % 2 ? r * 0.2 : r * (n % 4 ? 0.65 : 1.2);
          if (n === 0) g.moveTo(Math.cos(a) * raio, Math.sin(a) * raio);
          else g.lineTo(Math.cos(a) * raio, Math.sin(a) * raio);
        }
        g.closePath(); g.fill();
      }
      g.restore();
    }
  }
  let tremor = 0, flash = 0, superFlash = 0, superLado = -1;
  function faisca(x, y, cor, n, vel, vida) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = vel * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: vida + ((Math.random() * 6) | 0), max: vida + 6, cor, g: 0.05, tam: 0.6 + Math.random() * 1.2, risco: true }); }
  }
  function poeira(x, y, n) { for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 14, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.8, vida: 22 + ((Math.random() * 10) | 0), max: 32, cor: 'rgba(235,225,205,0.8)', g: -0.01, tam: 2 + Math.random() * 2 }); }
  function aviso(txt, opc) { avisos.push(Object.assign({ txt, t: 0, vida: 90, tam: 30, grad: ['#fff3a0', '#ffb000'], y: 70 }, opc)); }
  function nomeCombo(n) { return n >= 10 ? 'MONSTRUOSO!' : n >= 7 ? 'INSANO!' : n >= 5 ? 'BRUTAL!' : n >= 4 ? 'ÓTIMO!' : 'BOM!'; }

  function eventos(s, evs, nomes) {
    for (const e of evs) {
      const ex = e.x !== undefined ? e.x / U : 0, ey = e.y !== undefined ? CHAO - e.y / U : 0;
      switch (e.t) {
        case 'acerto':
          impacto(ex, ey, e.forte || 0);
          faisca(ex, ey, e.forte ? '#ffe066' : '#ffffff', 10 + e.forte * 6, 1.6 + e.forte * 0.6, 10);
          aneis.push({ x: ex, y: ey, r: 3, vida: 12, max: 12, cor: e.forte ? '#ffb000' : '#ffffff', estrela: e.forte >= 1 });
          if (e.forte >= 1) tremor = Math.max(tremor, 3 + e.forte * 2.5);
          if (e.forte >= 2) flash = 3;
          break;
        case 'defendeu': impacto(ex, ey, 0, true); faisca(ex, ey, '#7fd4ff', 7, 1.2, 8); aneis.push({ x: ex, y: ey, r: 3, vida: 9, max: 9, cor: '#7fd4ff' }); break;
        case 'chao': { const l = s.p[e.lado]; poeira(l.x / U, CHAO, 12); tremor = Math.max(tremor, 3); break; }
        case 'super': superFlash = 40; superLado = e.lado; break;
        case 'quebra': { const l = s.p[e.lado]; faisca(l.x / U, CHAO - 40, '#ff4fd8', 26, 2.6, 18); aviso('QUEBRA-COMBO!', { grad: ['#ffd0f6', '#ff4fd8'], tam: 24, y: 58 }); tremor = 8; break; }
        case 'choque': faisca(ex, ey, '#ffffff', 16, 2, 14); break;
        case 'round': aviso(e.final ? 'ROUND FINAL' : 'ROUND ' + e.n, { tam: 34, vida: 60, grad: ['#ffffff', '#c9d6ff'], y: 74 }); break;
        case 'lutem': aviso('LUTEM!', { tam: 46, vida: 45, y: 70 }); break;
        case 'ko': aviso('K.O!', { tam: 64, vida: 110, grad: ['#ffd0d0', '#ff2a2a'], y: 60, sombra: '#ffffff' }); flash = 6; tremor = 10; break;
        case 'tempo': aviso('TEMPO!', { tam: 44, vida: 100, y: 70 }); break;
        case 'perfeito': aviso('PERFEITO!', { tam: 28, vida: 100, grad: ['#d6ffe8', '#2fd07a'], y: 128 }); break;
        case 'acaba': aviso('ACABA!', { tam: 40, vida: 150, grad: ['#ffd0d0', '#ff2a2a'], y: 40 }); break;
        case 'armadura': aneis.push({ x: ex, y: ey, r: 4, vida: 14, max: 14, cor: '#ffd23f', estrela: true }); faisca(ex, ey, '#ffd23f', 10, 1.6, 10); break;
        case 'forca': aviso('FORÇA TOTAL!', { tam: 16, vida: 50, grad: ['#ffe0c0', '#ff6a2a'], y: s.p[e.lado].lado === 0 ? 120 : 120 }); break;
        case 'fumaca': for (let i = 0; i < 18; i++) parts.push({ x: e.x / U + (Math.random() - 0.5) * 30, y: CHAO - Math.random() * 60, vx: (Math.random() - 0.5) * 1.4, vy: -Math.random() * 0.8, vida: 30, max: 30, cor: 'rgba(200,190,230,0.85)', g: -0.01, tam: 3 + Math.random() * 4 }); break;
        case 'gelo': aviso('PISTA DE GELO!', { tam: 20, vida: 70, grad: ['#ffffff', '#4fb6ff'], y: 50 }); break;
        case 'golpeFinal': avisos.length = 0; break; // tira o "ACABA!" da frente da cena
        case 'vitoria':
          avisos.length = 0;
          aviso(String(nomes[e.vencedor] || '').toUpperCase() + ' VENCEU!', { tam: 20, vida: 99999, y: 46 });
          if (e.final) aviso('GOLPE FINAL!', { tam: 24, vida: 99999, grad: ['#ffd0d0', '#ff2a2a'], y: 76 });
          break;
        default: break;
      }
    }
  }

  // ---------- Placar ----------
  const vidaAtraso = [1, 1];
  function barra(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  // Rosto 3D de cada lutadora na ponta de dentro da barra (azul à esquerda,
  // vermelha à direita), recortado do retrato da seleção.
  const rostos = new Map();
  function rosto(id, lado) {
    const url = '/personagens/' + id + '-3d-retrato' + (lado ? '-vermelha' : '') + '.png';
    if (!rostos.has(url)) { const img = new Image(); img.src = url; rostos.set(url, img); }
    const img = rostos.get(url);
    return img.complete && img.naturalWidth ? img : null;
  }
  function placar(g, s, nomes) {
    const larg = 138;
    for (const lado of [0, 1]) {
      const l = s.p[lado], max = K.LUTADORES[l.id].vida, frac = l.vida / max;
      vidaAtraso[lado] = vidaAtraso[lado] > frac ? Math.max(frac, vidaAtraso[lado] - 0.004) : frac;
      const x = lado === 0 ? 10 : W - 10 - larg, y = 7;
      const rx = lado === 0 ? 159 : W - 159, img = rosto(l.id, lado);
      g.save(); g.beginPath(); g.arc(rx, 11, 9.5, 0, Math.PI * 2); g.fillStyle = CONTORNO; g.fill();
      g.beginPath(); g.arc(rx, 11, 8, 0, Math.PI * 2); g.fillStyle = lado ? '#5a1418' : '#1a2a6a'; g.fill(); g.clip();
      if (img) {
        // Cabeça do retrato 640×800 (orelhas cortadas pelo círculo); o lado 2 olha para o centro.
        g.translate(rx, 11); if (lado) g.scale(-1, 1);
        const lw = img.naturalWidth, lh = img.naturalHeight;
        g.drawImage(img, lw * .15, lh * .45, lw * .48, lw * .48, -9, -9, 18, 18);
      }
      g.restore();
      g.lineWidth = 1.2; g.strokeStyle = lado ? '#ff5a5a' : '#6aa8ff'; g.beginPath(); g.arc(rx, 11, 8.6, 0, Math.PI * 2); g.stroke();
      g.fillStyle = CONTORNO; barra(g, x - 2, y - 2, larg + 4, 13, 4); g.fill();
      g.fillStyle = '#4a0e1c'; barra(g, x, y, larg, 9, 3); g.fill();
      const w = larg * frac, wa = larg * vidaAtraso[lado];
      if (wa > 0) { g.fillStyle = '#ff5a5a'; barra(g, lado === 0 ? x + larg - wa : x, y, wa, 9, 3); g.fill(); }
      const perigo = frac <= 0.25 && Math.floor(s.f / 8) % 2;
      const gr = g.createLinearGradient(0, y, 0, y + 9);
      gr.addColorStop(0, perigo ? '#ffb0a0' : '#fff3a0'); gr.addColorStop(0.5, frac > 0.5 ? '#ffd23f' : frac > 0.25 ? '#ffa23f' : '#ff6b3f'); gr.addColorStop(1, frac > 0.5 ? '#e0a400' : '#d04a10');
      g.fillStyle = gr; if (w > 0) { barra(g, lado === 0 ? x + larg - w : x, y, w, 9, 3); g.fill(); }
      texto(g, String(nomes[lado] || '').toUpperCase(), lado === 0 ? x + 1 : x + larg - 1, y + 13, 8, '#ffffff', { direita: lado === 1 });
      for (let i = 0; i < 2; i++) {
        const mx = lado === 0 ? 166 - i * 11 : 218 + i * 11;
        g.fillStyle = CONTORNO; g.beginPath(); g.arc(mx, 25, 4.4, 0, Math.PI * 2); g.fill();
        if (s.rounds[lado] > i) { const ouro = g.createRadialGradient(mx - 1, 24, 0.5, mx, 25, 3.4); ouro.addColorStop(0, '#fff6c0'); ouro.addColorStop(1, '#e0a400'); g.fillStyle = ouro; } else g.fillStyle = '#3a2a4a';
        g.beginPath(); g.arc(mx, 25, 3.3, 0, Math.PI * 2); g.fill();
      }
      // Barra de Super no estilo do SF4: quatro gomos azul-ciano inclinados;
      // gomo cheio acende, o que está enchendo fica escuro; cheia pisca "SUPER!".
      const px = lado === 0 ? 10 : W - 10 - 104, py = H - 14, gomo = 24, folga = 2.7, alt = 6, inc = 3;
      const cheia = l.poder >= K.PODER_MAX, pisca = cheia && Math.floor(s.f / 5) % 2;
      const gomoPath = (x, w) => { g.beginPath(); g.moveTo(x + inc, py); g.lineTo(x + w + inc, py); g.lineTo(x + w, py + alt); g.lineTo(x, py + alt); g.closePath(); };
      for (let i = 0; i < 4; i++) {
        const ordem = lado === 0 ? i : 3 - i, x = px + i * (gomo + folga);
        const frac = Math.max(0, Math.min(1, l.poder / K.PODER_MAX * 4 - ordem));
        g.lineWidth = 2.4; g.strokeStyle = CONTORNO; gomoPath(x, gomo); g.stroke();
        g.fillStyle = '#0d1b3a'; gomoPath(x, gomo); g.fill();
        if (frac > 0) {
          const w = gomo * frac, x0 = lado === 0 ? x : x + gomo - w;
          const gr = g.createLinearGradient(0, py, 0, py + alt);
          if (frac >= 1) { gr.addColorStop(0, pisca ? '#ffffff' : '#c8fbff'); gr.addColorStop(0.45, pisca ? '#bff6ff' : '#3fe0ff'); gr.addColorStop(1, '#0a8fd0'); }
          else { gr.addColorStop(0, '#2a7fb0'); gr.addColorStop(1, '#14507a'); }
          g.save(); gomoPath(x, gomo); g.clip(); g.fillStyle = gr; g.fillRect(x0, py, w + inc, alt); g.restore();
          if (frac >= 1) { g.save(); g.shadowColor = '#4fe6ff'; g.shadowBlur = 6; g.strokeStyle = 'rgba(200,250,255,0.7)'; g.lineWidth = 0.6; gomoPath(x, gomo); g.stroke(); g.restore(); }
        }
      }
      if (cheia) {
        g.save(); g.shadowColor = '#3fd8ff'; g.shadowBlur = 8;
        texto(g, 'SUPER!', lado === 0 ? px + 4 * (gomo + folga) + 3 : px - 5, py - 3, 9, pisca ? '#ffffff' : '#7fefff', { direita: lado === 1 });
        g.restore();
      }
    }
    g.fillStyle = CONTORNO; barra(g, 175, 3, 34, 20, 5); g.fill();
    const rg = g.createLinearGradient(0, 5, 0, 21); rg.addColorStop(0, '#3a2a66'); rg.addColorStop(1, '#1d1338'); g.fillStyle = rg; barra(g, 177, 5, 30, 16, 4); g.fill();
    const urgente = !s.treino && s.timer < 600 && Math.floor(s.f / 15) % 2;
    texto(g, s.treino ? '∞' : String(Math.ceil(s.timer / 60)).padStart(2, '0'), 192, 6.5, 13, urgente ? '#ff5050' : '#ffffff', { centro: true, contorno: false });
  }

  // ---------- Projéteis e efeitos de golpes ----------
  function cenoura(g, x, y, ang, s) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s || 1, s || 1);
    g.fillStyle = '#2fa83c'; for (const a of [-0.5, 0, 0.5]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(9, 0, 4, 1.4, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    g.lineWidth = 1.2; g.strokeStyle = CONTORNO;
    g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-2, -4.2, 6, -3.6); g.quadraticCurveTo(7.6, 0, 6, 3.6); g.quadraticCurveTo(-2, 4.2, -9, 0); g.closePath();
    const gr = g.createLinearGradient(0, -4, 0, 4); gr.addColorStop(0, '#ffb35a'); gr.addColorStop(1, '#e46a10');
    g.fillStyle = gr; g.fill(); g.stroke();
    g.strokeStyle = 'rgba(160,60,0,0.6)'; g.lineWidth = 0.6; for (const dx of [-3, 1, 4]) { g.beginPath(); g.moveTo(dx, -2.4); g.lineTo(dx + 1, -0.6); g.stroke(); }
    g.restore();
  }
  function novelo(g, x, y, r, giro) {
    g.save(); g.translate(x, y); g.rotate(giro);
    g.fillStyle = '#ff7fb6'; g.strokeStyle = CONTORNO; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#ffd0e6'; g.lineWidth = 0.8; for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(0, 0, r * 0.95, r * 0.4, k * 2, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }
  function dentadura(g, x, y, abre, s) {
    g.save(); g.translate(x, y); g.scale(s || 1, s || 1);
    for (const [dy, sinal] of [[-abre, -1], [abre, 1]]) {
      g.fillStyle = '#ff8fa8'; g.strokeStyle = CONTORNO; g.lineWidth = 0.9;
      g.beginPath(); g.ellipse(0, dy + sinal * 2.6, 8, 3, 0, sinal < 0 ? Math.PI : 0, sinal < 0 ? 0 : Math.PI); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.roundRect(i * 2.1 - 0.9, dy + (sinal < 0 ? -0.4 : -1.6), 1.8, 2, 0.5); g.fill(); g.stroke(); }
    }
    g.restore();
  }
  function desenharProj(g, p, t) {
    const x = p.x / U, y = CHAO - p.y / U;
    if (p.tipo === 'novelo') {
      const dono = p.dono;
      novelo(g, x, y, 6, (t / 4) * Math.sign(p.vx));
      g.strokeStyle = 'rgba(255,127,182,0.7)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - Math.sign(p.vx) * 6, y + 4); g.lineTo(x - Math.sign(p.vx) * 40, y + 5); g.stroke(); void dono;
      return;
    }
    if (p.tipo === 'faisca') {
      const dir = Math.sign(p.vx);
      brilhoRedondo(g, x, y, 14, 'rgba(120,200,255,0.6)');
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i <= 6; i++) g.lineTo(x - dir * i * 4, y + (i % 2 ? -4 : 4) * (0.6 + Math.random() * 0.6));
      g.stroke(); g.strokeStyle = '#fff36a'; g.lineWidth = 1; g.stroke();
      return;
    }
    if (p.tipo === 'onda-gigante') {
      const dir = Math.sign(p.vx);
      g.save(); g.translate(x, y + 45); g.scale(dir, 1);
      const gr = g.createLinearGradient(0, -95, 0, 0); gr.addColorStop(0, '#bff4ff'); gr.addColorStop(0.4, '#3aa8e8'); gr.addColorStop(1, '#1f5fb0');
      g.fillStyle = gr; g.strokeStyle = CONTORNO; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-40, 0); g.quadraticCurveTo(-30, -60, 0, -92); g.quadraticCurveTo(26, -100, 30, -78); g.quadraticCurveTo(14, -84, 10, -66); g.quadraticCurveTo(24, -30, 24, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(4 + Math.sin(t / 4 + i) * 6 + i * 3, -88 + i * 3, 3 - i * 0.3, 0, Math.PI * 2); g.fill(); }
      g.restore();
      if (t % 2 === 0) parts.push({ x: x - dir * 20, y: CHAO - 4, vx: -dir * Math.random(), vy: -Math.random(), vida: 20, max: 20, cor: '#dff4ff', g: 0.04, tam: 2 });
      return;
    }
    if (p.tipo === 'onda') {
      const dir = Math.sign(p.vx);
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = i === 0 ? '#ffffff' : i === 1 ? '#4fd8ff' : 'rgba(167,116,232,0.8)'; g.lineWidth = 2.4 - i * 0.5;
        g.beginPath(); g.arc(x - dir * (i * 7 + 10), y, 15 - i * 2, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 0.9 : Math.PI + 0.9); g.stroke();
      }
      return;
    }
    if (p.tipo === 'tora') {
      g.save(); g.translate(x, y);
      g.fillStyle = '#8a5a30'; g.strokeStyle = CONTORNO; g.lineWidth = 1; g.beginPath(); g.roundRect(-14, -8, 28, 16, 7); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(60,30,10,0.6)'; g.lineWidth = 0.7; for (let i = 0; i < 4; i++) { const xx = -10 + ((i * 7 + t * Math.sign(p.vx) * 1.2) % 24 + 24) % 24 - 2; g.beginPath(); g.moveTo(xx, -7); g.lineTo(xx + 2, 7); g.stroke(); }
      g.fillStyle = '#e3c48c'; g.beginPath(); g.ellipse(Math.sign(p.vx) * 13, 0, 3, 7.4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
      if (t % 4 === 0) poeira(x - Math.sign(p.vx) * 12, CHAO - 1, 1);
      return;
    }
    if (p.tipo === 'dentadura') { dentadura(g, x, y, 1.5 + Math.abs(Math.sin(t / 3)) * 2.5, 1.1); return; }
    if (p.tipo === 'cenoura') {
      g.fillStyle = 'rgba(255,170,80,0.3)'; g.beginPath(); g.ellipse(x - Math.sign(p.vx) * 12, y, 10, 2, 0, 0, Math.PI * 2); g.fill();
      cenoura(g, x, y, (t / 3) * (p.vx > 0 ? 1 : -1));
    }
  }
  function estrela(g, x, y, r, cor) {
    g.fillStyle = cor; g.strokeStyle = CONTORNO; g.lineWidth = 0.6; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.stroke();
  }
  function efeitosDoLutador(g, l, t) {
    const x = l.x / U, y = CHAO - l.y / U;
    if (l.estado === 'golpe' && l.id === 'uivo' && l.golpe === 'esp' && l.t >= 10 && l.t <= 26) {
      for (let i = 0; i < 3; i++) {
        const r = (l.t - 10) * 4.4 - i * 11;
        if (r <= 0) continue;
        g.strokeStyle = `rgba(200,230,255,${Math.max(0, 0.9 - r / 80)})`; g.lineWidth = 2.4 - i * 0.5;
        g.beginPath(); g.arc(x + l.face * 14, y - 60, r, l.face > 0 ? -0.9 : Math.PI - 0.9, l.face > 0 ? 0.9 : Math.PI + 0.9); g.stroke();
      }
    }
    if (l.estado === 'golpe' && l.id === 'uivo' && l.golpe === 'sup') {
      for (const [a, b] of [[6, 12], [20, 26], [34, 42]]) if (l.t >= a && l.t <= b + 4) {
        const alfa = 1 - (l.t - a) / (b - a + 5);
        g.strokeStyle = `rgba(255,255,255,${alfa})`; g.lineCap = 'round';
        for (let k = 0; k < 3; k++) { g.lineWidth = 2.2 - k * 0.4; g.beginPath(); g.moveTo(x + l.face * (8 + k * 5), y - 74 + k * 7); g.quadraticCurveTo(x + l.face * (34 + k * 5), y - 54 + k * 7, x + l.face * (40 + k * 4), y - 18 + k * 6); g.stroke(); }
      }
    }
    if (l.estado === 'golpe' && l.id === 'maromba' && l.golpe === 'sup' && l.t >= 18 && l.t <= 32) { // flash das poses
      const f = 1 - Math.abs(l.t - 24) / 9;
      brilhoRedondo(g, x, y - 50, 140, `rgba(255,255,230,${Math.max(0, f)})`);
    }
    if (l.estado === 'golpe' && l.id === 'maromba' && l.golpe === 'esp' && l.t >= 4 && l.t <= 32 && l.armadura) {
      g.strokeStyle = `rgba(255,210,63,${0.5 + 0.3 * Math.sin(t / 2)})`; g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, y - 38, 24, 44, 0, 0, Math.PI * 2); g.stroke();
    }
    if (l.forca > 0 && t % 4 === 0) parts.push({ x: x + (Math.random() - 0.5) * 24, y: y - Math.random() * 60, vx: 0, vy: -0.6, vida: 18, max: 18, cor: '#ff7a2f', g: 0, tam: 1.2 });
    if (l.estado === 'golpe' && l.id === 'ginga' && l.golpe === 'esp' && l.t >= 6 && l.t <= 16 && t % 2 === 0) poeira(x + l.face * 18, CHAO - 2, 2);
    if (l.estado === 'golpe' && l.id === 'toco' && l.golpe === 'sup' && l.t >= 18 && l.t <= 70) {
      const f = Math.min(1, Math.max(0, (l.t - 20) / 26)), ang = (f * f) * (Math.PI / 2) * l.face, base = [x + l.face * 40, CHAO];
      g.save(); g.translate(base[0], base[1]); g.rotate(ang);
      g.fillStyle = '#6b4226'; g.strokeStyle = CONTORNO; g.lineWidth = 1; g.beginPath(); g.roundRect(-4, -120, 8, 120, 2); g.fill(); g.stroke();
      for (const [dy, larg] of [[-128, 18], [-110, 26], [-90, 32]]) { g.fillStyle = '#2f7a4f'; g.beginPath(); g.moveTo(0, dy - 14); g.lineTo(larg, dy + 16); g.lineTo(-larg, dy + 16); g.closePath(); g.fill(); g.stroke(); }
      g.restore();
      if (l.t === 46) { tremor = 10; poeira(base[0] + l.face * 60, CHAO, 30); }
      if (l.t < 46) texto(g, 'MADEIRAAA!', x, y - 92, 12, '#ffffff', { centro: true, gradiente: ['#fff3a0', '#ff9a2e'] });
    }
    if (l.estado === 'golpe' && l.id === 'eco' && l.golpe === 'sup' && l.t >= 20 && l.t <= 44) { // o grave estourando
      for (let i = 0; i < 4; i++) {
        const r = (l.t - 20) * 7 - i * 16; if (r <= 0) continue;
        g.strokeStyle = `rgba(${i % 2 ? '167,116,232' : '79,216,255'},${Math.max(0, 1 - r / 170)})`; g.lineWidth = 4 - i * 0.6;
        g.beginPath(); g.arc(x + l.face * 10, y - 46, r, l.face > 0 ? -1.1 : Math.PI - 1.1, l.face > 0 ? 1.1 : Math.PI + 1.1); g.stroke();
      }
      if (l.t === 24) tremor = 9;
    }
    if (l.estado === 'golpe' && l.id === 'nix' && l.golpe === 'esp' && t % 2 === 0) parts.push({ x: x - l.face * 10, y: CHAO - 2, vx: -l.face * Math.random(), vy: -Math.random() * 0.8, vida: 18, max: 18, cor: '#dff4ff', g: 0.03, tam: 1.4 });
    if (l.enrolado > 0 && l.prende === 'cartola') { // cartola gigante prendendo
      g.fillStyle = '#16161e'; g.strokeStyle = CONTORNO; g.lineWidth = 1.2;
      g.beginPath(); g.roundRect(x - 20, y - 78, 40, 78, 3); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(x, y - 78, 28, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#c8202f'; g.fillRect(x - 20, y - 30, 40, 7);
    }
    if (l.estado === 'golpe' && l.id === 'brasa' && l.golpe === 'esp' && l.t >= 8 && l.t <= 26) {
      for (let i = 0; i < 4; i++) parts.push({ x: x + l.face * (22 + Math.random() * 10), y: y - 46 + (Math.random() - 0.5) * 8, vx: l.face * (2 + Math.random() * 2), vy: (Math.random() - 0.5) * 1.2, vida: 22, max: 22, cor: 'rgba(255,255,255,0.9)', g: -0.02, tam: 3 + Math.random() * 3 });
    }
    if (l.estado === 'golpe' && l.id === 'volt' && l.golpe === 'sup' && t % 2 === 0) parts.push({ x: x - l.face * 20, y: y - 10, vx: -l.face * 2, vy: -Math.random(), vida: 14, max: 14, cor: '#fff36a', g: 0, tam: 1.2, risco: true });
    if (l.enrolado > 0 && l.prende !== 'cartola') { // fios de lã em volta do corpo
      g.strokeStyle = '#ff7fb6'; g.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x, y - 14 - i * 11, 15, 4, (i % 2 ? 0.25 : -0.25), 0, Math.PI * 2); g.stroke(); }
    }
    if (l.sumido) {
      g.fillStyle = '#6b4226'; g.beginPath(); g.ellipse(x, y - 1, 12, 4.5, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(x, y - 2, 8, 3, 0, Math.PI, 0); g.fill();
      if (t % 3 === 0) poeira(x, CHAO - 2, 1);
    }
    if (l.estado === 'tonto' || l.estrelas > 0) {
      for (let i = 0; i < 3; i++) {
        const a = t / 9 + (i * Math.PI * 2) / 3;
        estrela(g, x + Math.cos(a) * 13, y - 72 + Math.sin(a) * 3.5, 2.6, i === 1 ? '#7fd4ff' : '#ffe066');
      }
    }
  }

  // ---------- Golpes Finais (engraçados, sem violência pesada) ----------
  const FINAIS = {
    pipoca: {
      nome: 'CHUVA DE CENOURAS!',
      fundo(g, t) { g.fillStyle = `rgba(255,140,40,${Math.min(0.35, t / 120)})`; g.fillRect(-W, -H, W * 3, H * 3); },
      cena(g, t, ator, vitima) {
        const vx = vitima.x / U;
        for (let i = 0; i < 18; i++) {
          const inicio = i * 6, yy = (t - inicio) * 5 - 20;
          if (t < inicio || yy > CHAO - 32) continue;
          cenoura(g, vx + ((i * 13) % 40) - 20, yy, Math.PI / 2 + Math.sin(i) * 0.3, 1.2);
        }
        if (t > 20 && t < 120 && t % 6 === 0) faisca(vx, CHAO - 60, '#ff8a1f', 5, 1.5, 8);
        return t > 110 ? { achatado: Math.min(1, (t - 110) / 10) } : { tremendo: true };
      },
    },
    uivo: {
      nome: 'UIVO À LUA!',
      fundo(g, t) {
        g.fillStyle = `rgba(10,8,40,${Math.min(0.75, t / 60)})`; g.fillRect(-W, -H, W * 3, H * 3);
        const r = Math.min(30, t / 2);
        brilhoRedondo(g, 192, 52, r * 2.4 + 1, 'rgba(255,246,201,0.5)');
        g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(192, 52, r, 0, Math.PI * 2); g.fill();
      },
      cena(g, t, ator, vitima) {
        const ax = ator.x / U;
        if (t > 40 && t < 100) for (let i = 0; i < 4; i++) { const r = ((t - 40) * 3 + i * 18) % 90; g.strokeStyle = `rgba(200,230,255,${1 - r / 90})`; g.lineWidth = 2; g.beginPath(); g.arc(ax + ator.face * 12, CHAO - 64, r, 0, Math.PI * 2); g.stroke(); }
        if (t >= 70) {
          const sobe = Math.min(400, (t - 70) ** 2 * 0.12);
          if (t < 150 && t % 2 === 0) parts.push({ x: vitima.x / U + (Math.random() - 0.5) * 6, y: CHAO - 30 - sobe, vx: (Math.random() - 0.5) * 0.4, vy: 0.6, vida: 30, max: 30, cor: 'rgba(230,230,240,0.7)', g: 0, tam: 3 + Math.random() * 2 });
          if (t > 150) estrela(g, 224, 30, 2 + Math.sin(t / 3) * 1.5, '#ffffff');
          return { voando: sobe, gira: t / 4 };
        }
        return {};
      },
    },
  };

  FINAIS.maromba = {
    nome: 'SUPINO!',
    fundo(g, t) { g.fillStyle = `rgba(255,120,40,${Math.min(0.3, t / 100)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const dx = (ator.x - vitima.x) / U;
      if (t < 24) return { dx: dx * (t / 24), voando: (t / 24) * 46, gira: -Math.PI / 2 * (t / 24) };
      if (t < 140) {
        if (t % 16 === 8) aviso(String(Math.floor((t - 24) / 16) + 1), { tam: 26, vida: 14, y: 40, grad: ['#ffffff', '#ffd23f'] });
        return { dx, voando: 46 + Math.sin(t / 8) * 4, gira: -Math.PI / 2 };
      }
      const voo = (t - 140) ** 2 * 0.25;
      if (t > 175) estrela(g, ator.x / U + ator.face * 120, 26, 2 + Math.sin(t / 3) * 1.5, '#ffffff');
      return { dx: dx + ator.face * (t - 140) * 4, voando: 46 + voo, gira: -Math.PI / 2 + (t - 140) / 3 };
    },
  };
  FINAIS.ginga = {
    nome: 'RODA DE CAPOEIRA!',
    fundo(g, t) { g.fillStyle = `rgba(60,20,90,${Math.min(0.45, t / 90)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      if (t % 10 === 0 && t < 170) parts.push({ x: vitima.x / U + (Math.random() - 0.5) * 40, y: CHAO - 70, vx: (Math.random() - 0.5) * 0.4, vy: -0.5, vida: 50, max: 50, cor: Math.random() < 0.5 ? '#ffd23f' : '#2fb36b', g: 0, tam: 2.2, nota: true });
      if (t < 150) return { danca: t };
      if (t < 175) return { danca: t, gira: (t - 150) / 2, voando: 0 };
      return { achatado: Math.min(1, (t - 175) / 8) };
    },
  };

  FINAIS['vo-nena'] = {
    nome: 'HORA DO TRICÔ!',
    fundo(g, t) { g.fillStyle = `rgba(255,140,200,${Math.min(0.3, t / 100)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const vx = vitima.x / U, f = Math.min(1, t / 90);
      if (t < 150) { // a lã vai cobrindo até virar um novelão
        novelo(g, vx, CHAO - 30, 4 + f * 30, t / 30);
        return { escondido: f >= 1, tremendo: f < 1 };
      }
      const rola = (t - 150) * 3 * -ator.face;
      novelo(g, vx - rola, CHAO - 34, 34, -(t - 150) / 6 * ator.face);
      return { escondido: true };
    },
  };
  FINAIS['vo-tiao'] = {
    nome: 'DENTADURA GIGANTE!',
    fundo(g, t) { g.fillStyle = `rgba(40,90,70,${Math.min(0.35, t / 100)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const ax = ator.x / U + ator.face * 14, vx = vitima.x / U;
      if (t < 50) { const f = t / 50; dentadura(g, ax + (vx - ax) * f, CHAO - 54 - Math.sin(f * Math.PI) * 20, 3, 1 + f * 3); return {}; }
      if (t < 120) { const abre = Math.abs(Math.sin((t - 50) / 5)) * 10; dentadura(g, vx, CHAO - 36, abre, 4); if ((t - 50) % 10 === 0) faisca(vx, CHAO - 36, '#ffffff', 6, 1.5, 8); return { tremendo: true }; }
      const sobe = (t - 120) ** 2 * 0.2;
      dentadura(g, vx, CHAO - 36 - sobe, 1, 4);
      return { voando: sobe, gira: 0 };
    },
  };

  FINAIS.kira = {
    nome: 'NOCAUTE TÉCNICO!',
    fundo(g, t) { g.fillStyle = `rgba(232,56,61,${Math.min(0.3, t / 100)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t) {
      if (t < 120) return { voando: 0, gira: (t * t) / 300 }; // gira como um pião cada vez mais rápido
      if (t < 150) return { voando: 0, gira: (120 * 120) / 300 + (t - 120) * 0.2, tremendo: true };
      return { achatado: Math.min(1, (t - 150) / 8) };
    },
  };
  FINAIS.toco = {
    nome: 'ESTÁTUA DE MADEIRA!',
    fundo(g, t) { g.fillStyle = `rgba(110,70,30,${Math.min(0.35, t / 100)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      if (t % 4 === 0 && t < 150) parts.push({ x: vitima.x / U + (Math.random() - 0.5) * 20, y: CHAO - 20 - Math.random() * 40, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random(), vida: 30, max: 30, cor: '#e3c48c', g: 0.08, tam: 1.6 });
      return { madeira: t > 40, tremendo: t > 40 && t < 150 };
    },
  };

  FINAIS.nix = {
    nome: 'ESTÁTUA DE GELO!',
    fundo(g, t) { g.fillStyle = `rgba(150,210,255,${Math.min(0.4, t / 90)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const congela = t > 40, sai = t > 130 ? (t - 130) ** 2 * 0.08 * -ator.face : 0, vx = vitima.x / U + sai;
      if (congela) { // bloco de gelo em volta
        g.fillStyle = 'rgba(190,230,255,0.45)'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.2;
        g.beginPath(); g.roundRect(vx - 20, CHAO - 74, 40, 74, 4); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.moveTo(vx - 14, CHAO - 66); g.lineTo(vx - 6, CHAO - 50); g.stroke();
      }
      if (t % 5 === 0 && t < 40) faisca(vitima.x / U, CHAO - 40, '#dff4ff', 5, 1.4, 10);
      return { gelo: congela, dx: sai };
    },
  };
  FINAIS.eco = {
    nome: 'SOM NAS ALTURAS!',
    fundo(g, t) {
      g.fillStyle = `rgba(20,8,50,${Math.min(0.6, t / 60)})`; g.fillRect(-W, -H, W * 3, H * 3);
      for (let i = 0; i < 6; i++) { const cor = ['#ff4fd8', '#4fd8ff', '#ffd23f'][i % 3]; g.fillStyle = cor; g.globalAlpha = 0.25 + 0.2 * Math.abs(Math.sin(t / 6 + i)); g.beginPath(); g.moveTo(40 + i * 60, 0); g.lineTo(60 + i * 60, 0); g.lineTo(90 + i * 60 + Math.sin(t / 10 + i) * 30, CHAO); g.lineTo(30 + i * 60 + Math.sin(t / 10 + i) * 30, CHAO); g.fill(); }
      g.globalAlpha = 1;
    },
    cena(g, t, ator, vitima) {
      if (t % 8 === 0 && t < 150) parts.push({ x: vitima.x / U + (Math.random() - 0.5) * 40, y: CHAO - 70, vx: (Math.random() - 0.5) * 0.4, vy: -0.5, vida: 50, max: 50, cor: Math.random() < 0.5 ? '#ff4fd8' : '#4fd8ff', g: 0, tam: 2.2, nota: true });
      if (t < 110) return { danca: t };
      if (t === 110) { tremor = 12; flash = 5; }
      const sobe = (t - 110) ** 2 * 0.25;
      return { voando: sobe, gira: (t - 110) / 5 };
    },
  };

  FINAIS.truque = {
    nome: 'SUMIU!',
    fundo(g, t) { g.fillStyle = `rgba(60,10,40,${Math.min(0.45, t / 80)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const vx = vitima.x / U, enc = Math.max(0, 1 - Math.max(0, t - 40) / 50);
      g.fillStyle = '#16161e'; g.strokeStyle = CONTORNO; g.lineWidth = 1.2; g.beginPath(); g.ellipse(vx, CHAO, 26, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke(); // cartola de boca para cima no chão
      if (t > 95 && t < 170 && t % 4 === 0) parts.push({ x: vx, y: CHAO - 6, vx: (Math.random() - 0.5) * 3, vy: -1.5 - Math.random() * 1.5, vida: 60, max: 60, cor: '#ffffff', g: -0.01, tam: 2.4, pomba: true });
      return t < 95 ? { escala: enc, tremendo: t < 40 } : { escondido: true };
    },
  };
  FINAIS.mare = {
    nome: 'TUBO PERFEITO!',
    fundo(g, t) { g.fillStyle = `rgba(20,90,160,${Math.min(0.35, t / 90)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const sobe = Math.min(1, t / 60), dir = -ator.face, ox = vitima.x / U + (t > 70 ? dir * (t - 70) * 4 : 0);
      desenharProj(g, { tipo: 'onda-gigante', x: (ox - dir * 18) * U, y: 45 * U * sobe, vx: dir }, t);
      return t > 70 ? { dx: dir * (t - 70) * 4, voando: 20, gira: (t - 70) / 6 } : { tremendo: true };
    },
  };
  FINAIS.volt = {
    nome: 'CHOQUE TOTAL!',
    fundo(g, t) { g.fillStyle = `rgba(10,10,40,${Math.min(0.6, t / 60)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const vx = vitima.x / U;
      if (t > 20 && t < 140 && t % 5 < 3) { // raios caindo
        g.strokeStyle = '#fff36a'; g.lineWidth = 2.4; g.beginPath(); let yy = -40, xx = vx + (Math.random() - 0.5) * 20; g.moveTo(xx, yy);
        while (yy < CHAO - 40) { yy += 12; xx += (Math.random() - 0.5) * 14; g.lineTo(xx, yy); } g.stroke();
        flash = Math.max(flash, 1);
      }
      if (t >= 140 && t % 3 === 0) parts.push({ x: vx + (Math.random() - 0.5) * 16, y: CHAO - 40, vx: 0, vy: -0.6, vida: 40, max: 40, cor: 'rgba(80,80,90,0.7)', g: 0, tam: 3 });
      return t < 140 ? { choque: true, tremendo: true } : {};
    },
  };
  FINAIS.kilo = {
    nome: 'PESO PESADO!',
    fundo(g, t) { g.fillStyle = `rgba(40,40,60,${Math.min(0.4, t / 80)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const vx = vitima.x / U, cai = Math.min(CHAO - 40, -60 + (t - 40) * (t - 40) * 0.12), caiu = t > 40 && cai >= CHAO - 40;
      if (t > 40) {
        if (!caiu) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(vx, CHAO, 30 * Math.min(1, (t - 40) / 40), 4, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#2a2a36'; g.strokeStyle = CONTORNO; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(vx - 30, cai + 40); g.lineTo(vx - 22, cai); g.lineTo(vx + 22, cai); g.lineTo(vx + 30, cai + 40); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#4a4a5a'; g.beginPath(); g.roundRect(vx - 6, cai - 8, 12, 9, 3); g.fill(); g.stroke();
        texto(g, '1000 KG', vx, cai + 16, 9, '#ffffff', { centro: true });
      }
      if (caiu && !this.bateu) { tremor = 14; poeira(vx, CHAO, 30); this.bateu = true; }
      if (t < 40) this.bateu = false;
      return caiu ? { escondido: true } : { tremendo: t > 30 };
    },
  };
  FINAIS.brasa = {
    nome: 'BANHO DE ESPUMA!',
    fundo(g, t) { g.fillStyle = `rgba(200,230,255,${Math.min(0.3, t / 90)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const vx = vitima.x / U, f = Math.min(1, t / 100);
      g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(160,200,230,0.8)'; g.lineWidth = 0.8;
      for (let i = 0; i < Math.floor(f * 30); i++) { const a = i * 2.4, r = 6 + (i % 5) * 1.6; g.beginPath(); g.arc(vx + Math.cos(a) * (8 + (i % 4) * 3), CHAO - 8 - (i * 2.2) % 64, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
      if (t > 150 && t % 3 === 0) parts.push({ x: vx + (Math.random() - 0.5) * 30, y: CHAO - Math.random() * 60, vx: (Math.random() - 0.5), vy: -1 - Math.random(), vida: 40, max: 40, cor: 'rgba(220,240,255,0.9)', g: -0.01, tam: 2 + Math.random() * 2 });
      return f >= 1 ? { escondido: true } : { tremendo: true };
    },
  };
  FINAIS.fossil = {
    nome: 'DINO-RUGIDO!',
    fundo(g, t) { g.fillStyle = `rgba(60,90,40,${Math.min(0.45, t / 80)})`; g.fillRect(-W, -H, W * 3, H * 3); },
    cena(g, t, ator, vitima) {
      const ax = ator.x / U + ator.face * 30, s = Math.min(1, t / 40) * 5, ang = ator.face > 0 ? 0 : Math.PI, abre = 0.5 + Math.abs(Math.sin(t / 6)) * 0.3;
      ARTE.fossil.mandibula(pincel(g, 'contorno'), ax, CHAO - 70, ang, s, abre);
      ARTE.fossil.mandibula(pincel(g, 'cor'), ax, CHAO - 70, ang, s, abre);
      if (t > 50 && t < 120) for (let i = 0; i < 3; i++) { const r = ((t - 50) * 4 + i * 26) % 120; g.strokeStyle = `rgba(255,255,255,${1 - r / 120})`; g.lineWidth = 2; g.beginPath(); g.arc(ax, CHAO - 70, r, 0, Math.PI * 2); g.stroke(); }
      if (t > 70) return { dx: ator.face * (t - 70) * 3.4, voando: Math.abs(Math.sin((t - 70) / 8)) * 10, gira: ((t - 70) / 5) * ator.face };
      return { tremendo: t > 40 };
    },
  };

  // ---------- Tela e câmera ----------
  let ctx, canvas, R = 2, fundoCv = null, fundoNome = null, tAnim = 0;
  function ajustar() {
    // Desenha na resolução real da tela (nítido em qualquer celular), com limite para não pesar.
    const larg = canvas.clientWidth || W;
    // Até 3x (1152x648): nítido em qualquer celular sem pesar nos mais simples.
    const novo = Math.max(1, Math.min(3, Math.round((larg * (window.devicePixelRatio || 1)) / W)));
    if (novo === R && canvas.width === W * R) return;
    R = novo; canvas.width = W * R; canvas.height = H * R;
    const nome = fundoNome; fundoNome = null; if (nome) cenario(nome);
  }
  function iniciar(cv) { canvas = cv; ctx = cv.getContext('2d'); ajustar(); addEventListener('resize', ajustar); }
  const fundosIlustrados = {};
  function fundoIlustrado(nome) {
    if (nome !== 'academia') return null;
    if (!fundosIlustrados[nome]) {
      const img = new Image();
      fundosIlustrados[nome] = img;
      img.onload = () => { if (fundoNome === nome) { fundoNome = null; cenario(nome); } };
      img.src = '/img/cenario-poster-v1.webp';
    }
    const img = fundosIlustrados[nome];
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
  function cenario(nome) {
    if (fundoNome === nome) return;
    const cv = document.createElement('canvas'); cv.width = W * R; cv.height = H * R;
    const g = cv.getContext('2d'); g.scale(R, R);
    CENARIOS[nome].fundo(g);
    const ilustracao = fundoIlustrado(nome);
    if (ilustracao) g.drawImage(ilustracao, 0, 0, W, H);
    fundoCv = cv; fundoNome = nome;
  }

  const cam = { zoom: 1.3, x: 0 };
  function moverCamera(s) {
    const a = s.p[0].x / U, b = s.p[1].x / U;
    const alvo = Math.max(1, Math.min(1.3, W / (Math.abs(a - b) + 150)));
    cam.zoom += (alvo - cam.zoom) * 0.08;
    const vis = W / cam.zoom;
    cam.x = Math.max(0, Math.min(W - vis, (a + b) / 2 - vis / 2));
  }

  function desenharLutador(l, s, extra) {
    if (l.sumido || (extra && extra.escondido)) return;
    const modo = l.estado === 'dano' && l.t < 2 ? 'branco' : (superFlash > 0 && superLado === l.lado) || (l.estado === 'golpe' && l.golpe === 'sup') ? 'brilho' : l.forca > 0 ? 'forca' : 'cor';
    let x = l.x / U; const y = CHAO - l.y / U;
    if (l.estado === 'dano' && s.hitstop > 0) x += (s.f % 2) * 1.6 - 0.8;
    const somb = Math.max(6, 16 - l.y / U / 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, CHAO, somb, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    if (extra && extra.dx) ctx.translate(extra.dx, 0);
    if (extra && extra.escala !== undefined) ctx.scale(extra.escala, extra.escala);
    // Gira em volta do meio do corpo (e não do pé), para voar e rodar do jeito certo.
    if (extra && extra.voando !== undefined) { ctx.translate(0, -extra.voando - 32); ctx.rotate(extra.gira || 0); ctx.translate(0, 32); }
    if (extra && extra.danca) { ctx.translate(0, -Math.abs(Math.sin(extra.danca / 5)) * 4); ctx.rotate(Math.sin(extra.danca / 6) * 0.25); }
    if (extra && extra.achatado) ctx.scale(1 + extra.achatado * 0.6, 1 - extra.achatado * 0.7);
    if (extra && extra.tremendo) ctx.translate(tAnim % 4 < 2 ? -1 : 1, 0);
    ctx.scale(l.face, 1);
    if (l.estado === 'corrida' || l.estado === 'rolando' || (l.estado === 'golpe' && l.golpe === 'sup')) {
      ctx.save(); ctx.globalAlpha = 0.22; ctx.translate(-10, 0); desenharCorpo(ctx, l, 'cor'); ctx.restore();
    }
    const modoExtra = extra && (extra.madeira ? 'madeira' : extra.gelo ? 'gelo' : extra.choque && tAnim % 6 < 3 ? 'choque' : null);
    desenharCorpo(ctx, l, modoExtra || modo);
    ctx.restore();
  }

  function desenhar(s, opc) {
    tAnim++;
    // Orçamento visual por quadro: combos e rajadas não acumulam efeitos sem limite.
    const limiteParticulas = movimentoReduzido.matches ? 96 : 256;
    if (parts.length > limiteParticulas) parts.splice(0, parts.length - limiteParticulas);
    if (aneis.length > 36) aneis.splice(0, aneis.length - 36);
    const nomes = opc.nomes;
    moverCamera(s);
    ctx.setTransform(R, 0, 0, R, 0, 0);
    // Gráficos 3D: arena, lutadores e efeitos vêm do renderizador 3D por baixo;
    // aqui fica só o placar, sobre fundo transparente.
    const so3d = !!opc.somenteHud;
    if (so3d) { ctx.clearRect(0, 0, W, H); parts.length = 0; aneis.length = 0; impactos.length = 0; tremor = superFlash = 0; }
    const final = !so3d && s.fase === 'final' ? FINAIS[s.p[s.vencedor].id] : null;
    if (!so3d) {
    ctx.save();
    if (tremor > 0) { if (!movimentoReduzido.matches) ctx.translate((Math.random() - 0.5) * tremor, (Math.random() - 0.5) * tremor); tremor = Math.max(0, tremor - 0.6); }
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -(H - H / cam.zoom) * 0.85);
    ctx.drawImage(fundoCv, 0, 0, W, H);
    CENARIOS[fundoNome].animar(ctx, tAnim);

    if (s.gelo && s.gelo.f > 0) { // pista de gelo da Nix
      const a = Math.min(1, s.gelo.f / 40);
      const gr = ctx.createLinearGradient(0, CHAO - 10, 0, H); gr.addColorStop(0, `rgba(220,245,255,${0.75 * a})`); gr.addColorStop(1, `rgba(150,210,255,${0.55 * a})`);
      ctx.fillStyle = gr; ctx.fillRect(-W, CHAO - 6, W * 3, H);
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`; ctx.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) { const x0 = ((i * 53 + tAnim * 0.6) % (W + 60)) - 30; ctx.beginPath(); ctx.moveTo(x0, CHAO + 2 + (i % 3) * 4); ctx.lineTo(x0 + 18, CHAO + 2 + (i % 3) * 4); ctx.stroke(); }
    }
    let extraVitima = null;
    if (final) final.fundo(ctx, s.fT);
    if (superFlash > 0) { ctx.fillStyle = `rgba(10,5,30,${Math.min(0.6, superFlash / 30)})`; ctx.fillRect(-W, -H, W * 3, H * 3); superFlash--; }
    if (final) extraVitima = final.cena(ctx, s.fT, s.p[s.vencedor], s.p[1 - s.vencedor]);

    const ordem = s.p[0].estado === 'golpe' && s.p[1].estado !== 'golpe' ? [1, 0] : [0, 1];
    for (const i of ordem) {
      desenharLutador(s.p[i], s, final && i !== s.vencedor ? extraVitima : null);
      efeitosDoLutador(ctx, s.p[i], tAnim);
    }
    for (const p of s.proj) desenharProj(ctx, p, tAnim);

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    desenharImpactos(ctx);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vida--;
      if (p.vida <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.vida / (p.max * 0.5));
      if (p.pomba) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill(); const asa = Math.sin(p.vida / 2) * 2.4; ctx.beginPath(); ctx.moveTo(p.x - 1, p.y); ctx.lineTo(p.x - 3, p.y - 2 - asa); ctx.lineTo(p.x + 1, p.y - 0.5); ctx.fill(); continue; }
      if (p.nota) { ctx.fillStyle = p.cor; ctx.font = `900 9px ${FONTE}`; ctx.fillText('♪', p.x, p.y); continue; }
      if (p.risco) { ctx.strokeStyle = p.cor; ctx.lineWidth = p.tam; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); ctx.stroke(); }
      else { ctx.fillStyle = p.cor; ctx.beginPath(); ctx.arc(p.x, p.y, p.tam, 0, Math.PI * 2); ctx.fill(); }
    }
    for (let i = aneis.length - 1; i >= 0; i--) {
      const a = aneis[i]; a.r += 2.2; a.vida--;
      if (a.vida <= 0) { aneis.splice(i, 1); continue; }
      ctx.globalAlpha = a.vida / a.max;
      if (a.estrela) estrela(ctx, a.x, a.y, a.r * 0.9, a.cor);
      ctx.strokeStyle = a.cor; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    }

    if (flash > 0) { if (!movimentoReduzido.matches) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.22, flash / 12)})`; ctx.fillRect(0, 0, W, H); } flash--; }
    placar(ctx, s, nomes);

    for (const lado of [0, 1]) {
      const v = s.p[1 - lado];
      if (v.combo >= 2 && (v.estado === 'dano' || v.y > 0)) {
        const x = lado === 0 ? 12 : W - 12;
        texto(ctx, v.combo + ' HITS', x, 34, 16, '#ffffff', { direita: lado === 1, gradiente: ['#ffffff', '#c9d6ff'] });
        if (v.combo >= 3) texto(ctx, nomeCombo(v.combo), x, 52, 13, '#ffe066', { direita: lado === 1, gradiente: v.combo >= 5 ? ['#ffd0d0', '#ff2a2a'] : ['#fff3a0', '#ffb000'] });
      }
    }
    if (final) texto(ctx, final.nome, 192, 182, 18, '#ffe066', { centro: true, gradiente: ['#fff3a0', '#ffb000'] });

    for (let i = avisos.length - 1; i >= 0; i--) {
      const a = avisos[i]; a.t++;
      if (a.t > a.vida) { avisos.splice(i, 1); continue; }
      const entra = Math.min(1, a.t / 7), escala = entra < 1 ? 1.8 - entra * 0.8 : 1 + Math.sin(a.t / 8) * 0.015;
      const sai = a.vida - a.t < 8 ? (a.vida - a.t) / 8 : 1;
      ctx.save(); ctx.globalAlpha = sai; ctx.translate(192, a.y + a.tam / 2); ctx.scale(escala, escala);
      texto(ctx, a.txt, 0, -a.tam / 2, a.tam, '#fff', { centro: true, gradiente: a.grad, sombra: a.sombra });
      ctx.restore();
    }
    if (opc.esperando) {
      ctx.fillStyle = 'rgba(10,5,30,0.6)'; ctx.fillRect(0, 96, W, 22);
      texto(ctx, opc.esperando, 192, 102, 10, '#ffffff', { centro: true, contorno: false, peso: 700 });
    }
  }

  function limparAvisos() { avisos.length = 0; parts.length = 0; aneis.length = 0; impactos.length = 0; tremor = flash = superFlash = 0; }

  // Retrato para a tela de escolha: rosto e tronco, em alta resolução.
  const retratos = {};
  function retrato(id) {
    if (retratos[id]) return retratos[id];
    if (!ARTE[id]) return null;
    const cv = document.createElement('canvas'), esc = 4;
    cv.width = 56 * esc; cv.height = 70 * esc;
    const g = cv.getContext('2d');
    // Enquadra pela cabeça: baixinhos e grandões aparecem do mesmo tamanho na carta.
    const falso = { id, estado: 'parado', t: 0, face: 1, y: 0 }, cab = poseDe(falso).c, k = 1.15 / ARTE[id].escala;
    g.scale(esc * k, esc * k); g.translate(28 / k - cab[0] * ARTE[id].escala, 22 / k - cab[1] * ARTE[id].escala);
    desenharCorpo(g, falso, 'cor');
    retratos[id] = cv;
    return cv;
  }

  window.KOArte = { iniciar, cenario, desenhar, eventos, limparAvisos, retrato, CENARIOS, temArte: (id) => !!ARTE[id] };
})();
