import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

// Golpes da Pipoca v5 animados à mão (poses-chave + cinemática inversa) no
// esqueleto da v5. Substituem os clips procedurais herdados do estudo v13 que
// tinham defeitos visíveis no corpo detalhado: pé de chute dobrado, joelho
// aberto para o lado, rasteira torcida, agachamento "de sapo", pernas
// arqueadas no pulo.
//
// Eixos do projeto: +Y para cima, +X frente, Z lado (E = -Z). 1 m = 24 px do motor.
// Cada pose-chave: quadro, deslocamento da pelve, giro da pelve (Y), inclinação
// do tronco (Z; negativo = para a frente) e, por perna, tornozelo (null =
// plantado na guarda), direção do joelho e forma do pé ('plano' ou 'esticado').

const PX = 24;
const suave = t => t * t * (3 - 2 * t);
const v = (x, y, z) => new Vector3(x, y, z);

export function criarGolpesV5(ossos, parado, simulador) {
  const n = ossos.length, idx = nome => { const i = ossos.findIndex(o => o.nome === nome); assert.ok(i >= 0, nome); return i; };
  const off = i => Vector3.FromArray(ossos[i].posicao);
  // Guarda: rotações locais e globais do quadro 0 de 'parado'.
  const L0 = [], G0 = [], P0 = [];
  for (let i = 0; i < n; i++) {
    const r = Quaternion.FromArray(parado.canais.find(c => c.osso === i && c.tipo === 'rotation').valores.slice(0, 4));
    const t = Vector3.FromArray(parado.canais.find(c => c.osso === i && c.tipo === 'translation').valores.slice(0, 3));
    const pai = ossos[i].pai;
    L0.push(r);
    G0.push(pai === null ? r : G0[pai].multiply(r).normalize());
    P0.push(pai === null ? t : P0[pai].add(t.applyRotationQuaternion(G0[pai])));
  }
  const perna = l => ({ coxa: idx(`coxa_${l}`), canela: idx(`canela_${l}`), pe: idx(`pe_${l}`) });
  const PERNAS = { E: perna('E'), D: perna('D') };
  const L1 = off(PERNAS.E.canela).length(), L2 = off(PERNAS.E.pe).length();
  const deDirecao = (de, para) => { const q = Quaternion.Identity(); Quaternion.FromUnitVectorsToRef(de.normalizeToNew(), para.normalizeToNew(), q); return q; };

  // Resolve uma pose: rotações globais e posições de todos os ossos.
  function resolver(p) {
    const G = new Array(n), P = new Array(n), joelhos = {};
    const q0 = idx('quadril'), tronco = idx('tronco');
    G[q0] = Quaternion.RotationAxis(v(0, 1, 0), p.giro).multiply(G0[q0]).normalize();
    P[q0] = P0[q0].add(p.pelve);
    for (let i = 0; i < n; i++) {
      if (i === q0) continue;
      const pai = ossos[i].pai;
      P[i] = P[pai].add(off(i).applyRotationQuaternion(G[pai]));
      G[i] = G[pai].multiply(L0[i]).normalize();
      if (i === tronco) G[i] = Quaternion.RotationAxis(v(0, 0, 1), p.inclinacao).multiply(G[i]).normalize();
      for (const [lado, b] of Object.entries(PERNAS)) {
        const pp = p.pernas[lado];
        if (i === b.coxa) {
          // Joelho por IK de dois ossos no plano dado pela direção do joelho.
          const H = P[i], T = pp.tornozelo, eixo = T.subtract(H);
          const d = Math.min(Math.max(eixo.length(), Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
          const e = eixo.normalizeToNew();
          const polo = pp.joelho.subtract(e.scale(Vector3.Dot(pp.joelho, e))).normalize();
          const u = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - u * u));
          const K = H.add(e.scale(u)).add(polo.scale(h));
          joelhos[lado] = { K, T: H.add(e.scale(d)) };
          G[i] = deDirecao(off(b.canela).applyRotationQuaternion(G[i]), K.subtract(H)).multiply(G[i]).normalize();
        } else if (i === b.canela) {
          const { K, T } = joelhos[lado];
          G[i] = deDirecao(off(b.pe).applyRotationQuaternion(G[i]), T.subtract(K)).multiply(G[i]).normalize();
        } else if (i === b.pe) {
          G[i] = pp.pe;
        }
      }
    }
    return { G, P };
  }

  // Forma do pé: 'plano' = como na guarda; 'esticado' = ponta continuando a
  // canela (dorso para cima), sem dobra no tornozelo.
  function formaPe(lado, forma, joelho, tornozelo, giro) {
    const b = PERNAS[lado];
    if (forma === 'plano') return Quaternion.RotationAxis(v(0, 1, 0), giro * 0.3).multiply(G0[b.pe]).normalize();
    const frente = tornozelo.subtract(joelho).normalize();
    const lateral = Vector3.Cross(frente, v(0, 1, 0));
    const cima = Vector3.Cross(lateral.lengthSquared() < 1e-6 ? v(0, 0, 1) : lateral.normalize(), frente).normalize();
    const z = Vector3.Cross(frente, cima).normalize();
    return Quaternion.RotationQuaternionFromAxis(frente, cima, z).normalize();
  }

  // Interpola as poses-chave quadro a quadro e grava os canais do clip.
  function animar(nome, duracao, chaves, { laco = false } = {}) {
    assert.equal(chaves[0].q, 0);
    assert.equal(chaves.at(-1).q, duracao);
    const tempos = [], rot = Array.from({ length: n }, () => []), raiz = [], poses = [];
    const lerpV = (a, b, t) => Vector3.Lerp(a, b, t);
    const tornozeloDe = (k, lado) => k.pernas?.[lado]?.tornozelo ?? P0[PERNAS[lado].pe];
    for (let q = 0; q <= duracao; q++) {
      let j = 0;
      while (j < chaves.length - 2 && chaves[j + 1].q <= q) j++;
      const a = chaves[j], b = chaves[j + 1], t = suave(Math.max(0, Math.min(1, (q - a.q) / (b.q - a.q))));
      const pose = {
        pelve: lerpV(a.pelve ?? Vector3.Zero(), b.pelve ?? Vector3.Zero(), t),
        giro: (a.giro ?? 0) + ((b.giro ?? 0) - (a.giro ?? 0)) * t,
        inclinacao: (a.inclinacao ?? 0) + ((b.inclinacao ?? 0) - (a.inclinacao ?? 0)) * t,
        pernas: {},
      };
      for (const lado of ['E', 'D']) {
        const pa = a.pernas?.[lado] ?? {}, pb = b.pernas?.[lado] ?? {};
        const tornozelo = lerpV(tornozeloDe(a, lado), tornozeloDe(b, lado), t);
        const joelho = lerpV(pa.joelho ?? v(1, 0, lado === 'E' ? -.15 : .15), pb.joelho ?? v(1, 0, lado === 'E' ? -.15 : .15), t);
        pose.pernas[lado] = { tornozelo, joelho };
      }
      // Forma do pé nas duas chaves, depois interpolada (sem saltos).
      let { G, P } = resolver({ ...pose, pernas: Object.fromEntries(['E', 'D'].map(l => [l, { ...pose.pernas[l], pe: G0[PERNAS[l].pe] }])) });
      for (const lado of ['E', 'D']) {
        const b2 = PERNAS[lado], K = P[b2.canela], T = P[b2.pe];
        const fa = formaPe(lado, a.pernas?.[lado]?.pe ?? 'plano', K, T, pose.giro);
        const fb = formaPe(lado, b.pernas?.[lado]?.pe ?? 'plano', K, T, pose.giro);
        pose.pernas[lado].pe = Quaternion.Slerp(fa, fb, t).normalize();
      }
      ({ G, P } = resolver(pose));
      tempos.push(q / 60);
      for (let i = 0; i < n; i++) {
        const pai = ossos[i].pai;
        rot[i].push(...(pai === null ? G[i] : Quaternion.Inverse(G[pai]).multiply(G[i]).normalize()).asArray());
      }
      raiz.push(...P[0].asArray());
      poses.push(P);
    }
    if (laco) for (let i = 0; i < n; i++) assert.ok(rot[i].slice(0, 4).every((x, k) => Math.abs(x - rot[i].at(-4 + k)) < 1e-6), `${nome} fecha o laço`);
    const canais = [];
    for (let i = 0; i < n; i++) {
      canais.push({ osso: i, tipo: 'rotation', tempos, valores: rot[i] });
      canais.push({ osso: i, tipo: 'translation', tempos, valores: i === 0 ? raiz : tempos.flatMap(() => ossos[i].posicao) });
    }
    return { clip: { nome, duracaoQuadros: duracao, canais }, poses };
  }

  const guarda = P0[PERNAS.E.pe], tras = P0[PERNAS.D.pe];
  const ZE = guarda.z, ZD = tras.z;
  const clips = {};

  // k1: dois chutes médios (24 quadros), perna E nas janelas 6-8, D em 12-14.
  clips.k1 = animar('k1', 24, [
    { q: 0 },
    { q: 3, giro: -.25, inclinacao: .08, pelve: v(-.03, .02, 0), pernas: { E: { tornozelo: v(.42, .82, ZE + .12), joelho: v(1, .8, 0), pe: 'esticado' } } },
    { q: 6, giro: -.35, inclinacao: .16, pelve: v(.02, .03, 0), pernas: { E: { tornozelo: v(1.24, 1.02, ZE + .16), joelho: v(0, 1, 0), pe: 'esticado' } } },
    { q: 8, giro: -.35, inclinacao: .16, pelve: v(.03, .03, 0), pernas: { E: { tornozelo: v(1.26, 1.02, ZE + .16), joelho: v(0, 1, 0), pe: 'esticado' } } },
    { q: 10, giro: 0, inclinacao: .04, pelve: v(.02, -.01, 0), pernas: { E: { tornozelo: v(.44, .30, ZE + .05) } } },
    { q: 11, giro: .2, inclinacao: .06, pelve: v(.06, .0, 0), pernas: { D: { tornozelo: v(-.1, .78, ZD - .05), joelho: v(1, .8, 0), pe: 'esticado' } } },
    { q: 12, giro: .45, inclinacao: .16, pelve: v(.14, .03, 0), pernas: { D: { tornozelo: v(1.34, 1.02, -.02), joelho: v(0, 1, 0), pe: 'esticado' } } },
    { q: 14, giro: .45, inclinacao: .16, pelve: v(.15, .03, 0), pernas: { D: { tornozelo: v(1.36, 1.02, -.02), joelho: v(0, 1, 0), pe: 'esticado' } } },
    { q: 17, giro: .25, inclinacao: .08, pelve: v(.08, .01, 0), pernas: { D: { tornozelo: v(-.05, .75, ZD - .05), joelho: v(1, .8, 0), pe: 'esticado' } } },
    { q: 20, giro: .05, inclinacao: .02, pelve: v(.01, 0, 0) },
    { q: 24 },
  ]);

  // k2: chute alto de perna E (28 quadros), janela 7-10.
  clips.k2 = animar('k2', 28, [
    { q: 0 },
    { q: 4, giro: -.4, inclinacao: .22, pelve: v(-.06, .03, 0), pernas: { E: { tornozelo: v(.38, 1.22, ZE + .14), joelho: v(1, .9, 0), pe: 'esticado' } } },
    { q: 7, giro: -.55, inclinacao: .46, pelve: v(-.04, .04, 0), pernas: { E: { tornozelo: v(1.0, 1.82, ZE + .2), joelho: v(0, 1, .2), pe: 'esticado' } } },
    { q: 10, giro: -.55, inclinacao: .46, pelve: v(-.03, .04, 0), pernas: { E: { tornozelo: v(1.02, 1.8, ZE + .2), joelho: v(0, 1, .2), pe: 'esticado' } } },
    { q: 14, giro: -.3, inclinacao: .18, pelve: v(-.05, .02, 0), pernas: { E: { tornozelo: v(.38, 1.05, ZE + .12), joelho: v(1, .9, 0), pe: 'esticado' } } },
    { q: 19, giro: -.05, inclinacao: .03, pelve: v(-.01, 0, 0) },
    { q: 28 },
  ]);

  // ck: rasteira (26 quadros), janela 6-9: agacha sobre a perna D e varre com a E rente ao chão.
  clips.ck = animar('ck', 26, [
    { q: 0 },
    { q: 4, giro: -.15, inclinacao: -.18, pelve: v(-.08, -.36, 0), pernas: { E: { tornozelo: v(.62, .16, ZE + .02), joelho: v(1, .5, -.2), pe: 'plano' }, D: { joelho: v(1, .1, .06) } } },
    { q: 6, giro: -.3, inclinacao: -.24, pelve: v(-.06, -.42, 0), pernas: { E: { tornozelo: v(1.0, .14, ZE + .08), joelho: v(0, 1, -.3), pe: 'plano' }, D: { joelho: v(1, .1, .06) } } },
    { q: 9, giro: -.3, inclinacao: -.24, pelve: v(-.05, -.42, 0), pernas: { E: { tornozelo: v(1.02, .14, ZE + .08), joelho: v(0, 1, -.3), pe: 'plano' }, D: { joelho: v(1, .1, .06) } } },
    { q: 14, giro: -.15, inclinacao: -.14, pelve: v(-.06, -.34, 0), pernas: { E: { tornozelo: v(.6, .2, ZE + .02), joelho: v(1, .5, -.2), pe: 'plano' }, D: { joelho: v(1, .1, .06) } } },
    { q: 19, giro: 0, inclinacao: -.04, pelve: v(-.02, -.1, 0) },
    { q: 26 },
  ]);

  // agachado: guarda baixa de luta (laço de 60 quadros com respiração).
  const baixa = dy => ({ inclinacao: -.12, pelve: v(-.02, -.30 + dy, 0),
    pernas: { E: { joelho: v(1, 0, -.25) }, D: { joelho: v(1, 0, .3) } } });
  clips.agachado = animar('agachado', 60, [
    { q: 0, ...baixa(0) }, { q: 30, ...baixa(-.012) }, { q: 60, ...baixa(0) },
  ], { laco: true });

  // pulo: impulso, extensão, pernas recolhidas à frente (joelhos para a frente,
  // não para fora) e preparação do pouso. A altura vem do motor.
  const ar = (dy, eE, eD, inc) => ({ pelve: v(0, dy, 0), inclinacao: inc,
    pernas: { E: { tornozelo: eE, joelho: v(1, .3, -.08), pe: 'esticado' }, D: { tornozelo: eD, joelho: v(1, .3, .08), pe: 'esticado' } } });
  const quadrilY = P0[idx('quadril')].y;
  clips.pulo = animar('pulo', 44, [
    { q: 0 },
    { q: 3, pelve: v(0, -.1, 0), inclinacao: -.08 },
    { q: 6, ...ar(.02, v(.2, quadrilY - 1.02, ZE + .14), v(-.25, quadrilY - 1.0, ZD - .02), -.02) },
    { q: 14, ...ar(0, v(.42, quadrilY - .58, ZE + .2), v(.12, quadrilY - .66, ZD - .06), -.06) },
    { q: 30, ...ar(0, v(.4, quadrilY - .6, ZE + .2), v(.1, quadrilY - .68, ZD - .06), -.06) },
    { q: 44, ...ar(-.02, v(.3, quadrilY - .95, ZE + .1), v(-.3, quadrilY - .95, ZD - .02), -.02) },
  ]);

  // Contato: no meio de cada janela ativa, algum ponto do pé (tornozelo a
  // ponta) precisa estar dentro da caixa do motor (x à frente, altura do pé).
  const ponta = 0.36;
  const relatorio = {};
  for (const nome of ['k1', 'k2', 'ck']) {
    const golpe = simulador.LUTADORES.pipoca.golpes[nome];
    relatorio[nome] = golpe.janelas.map((janela, k) => {
      const lado = nome === 'k1' && k === 1 ? 'D' : 'E';
      const [bx, by, bw, bh] = janela.caixa;
      const caixa = { x0: bx / PX, x1: (bx + bw) / PX, y0: -(by + bh) / PX, y1: -by / PX };
      const quadros = [];
      for (let q = janela.de; q <= janela.ate; q++) {
        const P = clips[nome].poses[q], T = P[PERNAS[lado].pe], K = P[PERNAS[lado].canela];
        const dir = T.subtract(K).normalize(), pontos = [0, .25, .5, .75, 1].map(s => T.add(dir.scale(ponta * s)));
        quadros.push({ q, dentro: pontos.some(p => p.x >= caixa.x0 && p.x <= caixa.x1 && p.y >= caixa.y0 && p.y <= caixa.y1),
          tornozelo: T.asArray().map(x => +x.toFixed(3)) });
      }
      return { lado, caixa, quadros, ok: quadros.every(f => f.dentro) };
    });
  }
  return { clips: Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, c.clip])), relatorio };
}
