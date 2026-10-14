import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { alturaSolas } from './pipoca-v5.mjs';

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
// Centro do corpo encolhido (bola do rolamento), relativo ao quadril, em repouso.
const BOLA = new Vector3(.18, .3, 0);
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
  // Braços por IK de dois ossos (ombro→cotovelo→punho), como as pernas: a
  // pose-chave diz onde fica a luva (relativo ao ombro) e para onde aponta o
  // cotovelo. Sem 'bracos' na chave, o braço segue a guarda (cinemática direta).
  const braco = l => ({ braco: idx(`braco_${l}`), antebraco: idx(`antebraco_${l}`), mao: idx(`mao_${l}`) });
  const BRACOS = { E: braco('E'), D: braco('D') };
  const B1 = off(BRACOS.E.antebraco).length(), B2 = off(BRACOS.E.mao).length();
  const L1 = off(PERNAS.E.canela).length(), L2 = off(PERNAS.E.pe).length();
  const deDirecao = (de, para) => { const q = Quaternion.Identity(); Quaternion.FromUnitVectorsToRef(de.normalizeToNew(), para.normalizeToNew(), q); return q; };

  // Resolve uma pose: rotações globais e posições de todos os ossos.
  function resolver(p) {
    const G = new Array(n), P = new Array(n), joelhos = {};
    const q0 = idx('quadril'), tronco = idx('tronco');
    // Rotação da pelve: giro (Y) e rolamento (Z, negativo = cambalhota para a
    // frente). Com 'bola' > 0 a pelve gira em volta do centro do corpo
    // encolhido, rente ao chão, em vez de girar em torno do quadril.
    const R = Quaternion.RotationAxis(v(0, 0, 1), p.rol ?? 0).multiply(Quaternion.RotationAxis(v(0, 1, 0), p.giro)).normalize();
    G[q0] = R.multiply(G0[q0]).normalize();
    const emBola = (p.centro ?? v(0, .55, 0)).subtract(BOLA.applyRotationQuaternion(R));
    P[q0] = Vector3.Lerp(P0[q0].add(p.pelve), emBola, p.bola ?? 0);
    for (let i = 0; i < n; i++) {
      if (i === q0) continue;
      const pai = ossos[i].pai;
      P[i] = P[pai].add(off(i).applyRotationQuaternion(G[pai]));
      G[i] = G[pai].multiply(L0[i]).normalize();
      if (i === tronco) G[i] = Quaternion.RotationAxis(v(0, 0, 1), p.inclinacao).multiply(G[i]).normalize();
      // Recolher a cabeça e as orelhas na recuperação: o apoio fica nos
      // ombros, em vez de elevar o corpo inteiro para proteger as pontas.
      if (ossos[i].nome === 'cabeca' && p.pescoco) G[i] = G[i].multiply(Quaternion.RotationAxis(v(0, 0, 1), p.pescoco)).normalize();
      if (/^orelha_[ED]$/.test(ossos[i].nome) && p.orelhas) G[i] = G[i].multiply(Quaternion.RotationAxis(v(0, 0, 1), p.orelhas)).normalize();
      for (const [lado, b] of Object.entries(BRACOS)) {
        const pb = p.bracos?.[lado];
        if (!pb) continue;
        if (i === b.braco) {
          const H = P[i], eixo = pb.alvo, d = Math.min(Math.max(eixo.length(), Math.abs(B1 - B2) + 1e-4), B1 + B2 - 1e-4);
          const e = eixo.normalizeToNew();
          const polo = pb.cotovelo.subtract(e.scale(Vector3.Dot(pb.cotovelo, e))).normalize();
          const u = (B1 * B1 - B2 * B2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, B1 * B1 - u * u));
          const K = H.add(e.scale(u)).add(polo.scale(h));
          joelhos['braco' + lado] = { K, T: H.add(e.scale(d)) };
          G[i] = deDirecao(off(b.antebraco).applyRotationQuaternion(G[i]), K.subtract(H)).multiply(G[i]).normalize();
        } else if (i === b.antebraco) {
          const { K, T } = joelhos['braco' + lado];
          G[i] = deDirecao(off(b.mao).applyRotationQuaternion(G[i]), T.subtract(K)).multiply(G[i]).normalize();
        }
      }
      for (const [lado, b] of Object.entries(PERNAS)) {
        const pp = p.pernas[lado];
        if (i === b.coxa) {
          // Joelho por IK de dois ossos no plano dado pela direção do joelho.
          // Pernas presas ao corpo (loc > 0): tornozelo no referencial da pelve.
          const T = Vector3.Lerp(pp.tornozelo, P[q0].add(pp.local.applyRotationQuaternion(R)), pp.loc);
          const H = P[i], eixo = T.subtract(H);
          const d = Math.min(Math.max(eixo.length(), Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
          const e = eixo.normalizeToNew();
          const dirJoelho = Vector3.Lerp(pp.joelho, pp.joelho.applyRotationQuaternion(R), pp.loc);
          const polo = dirJoelho.subtract(e.scale(Vector3.Dot(dirJoelho, e))).normalize();
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
  function formaPe(lado, forma, joelho, tornozelo, giro, rol = 0) {
    const b = PERNAS[lado];
    if (forma === 'corpo') return Quaternion.RotationAxis(v(0, 0, 1), rol).multiply(Quaternion.RotationAxis(v(0, 1, 0), giro)).multiply(G0[b.pe]).normalize();
    if (forma === 'plano') return Quaternion.RotationAxis(v(0, 1, 0), giro * 0.3).multiply(G0[b.pe]).normalize();
    const canela = tornozelo.subtract(joelho).normalize();
    // Eixo lateral fixo do corpo (girado com a pelve). Derivá-lo de
    // canela × vertical invertia o dorso quando a canela inclinava para trás
    // (pé ao contrário no recolhimento da perna de trás).
    const lateral = v(0, 0, 1).applyRotationQuaternion(Quaternion.RotationAxis(v(0, 1, 0), giro));
    const dorso = Vector3.Cross(lateral, canela).normalize();
    // Pé quase no ângulo natural (20° de extensão), acertando com a sola e a
    // planta: esticar 50° a 90° dobrava a malha da faixa em "Z" na frente do
    // tornozelo (pedido do usuário: suavizar a dobra do pé).
    const a = 70 * Math.PI / 180;
    const frente = canela.scale(Math.cos(a)).add(dorso.scale(Math.sin(a))).normalize();
    const cima = dorso.scale(Math.cos(a)).subtract(canela.scale(Math.sin(a))).normalize();
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
        rol: (a.rol ?? 0) + ((b.rol ?? 0) - (a.rol ?? 0)) * t,
        bola: (a.bola ?? 0) + ((b.bola ?? 0) - (a.bola ?? 0)) * t,
        pescoco: (a.pescoco ?? 0) + ((b.pescoco ?? 0) - (a.pescoco ?? 0)) * t,
        orelhas: (a.orelhas ?? 0) + ((b.orelhas ?? 0) - (a.orelhas ?? 0)) * t,
        pernas: {},
      };
      for (const lado of ['E', 'D']) {
        const pa = a.pernas?.[lado] ?? {}, pb = b.pernas?.[lado] ?? {};
        const tornozelo = lerpV(tornozeloDe(a, lado), tornozeloDe(b, lado), t);
        const joelho = lerpV(pa.joelho ?? v(1, 0, lado === 'E' ? -.15 : .15), pb.joelho ?? v(1, 0, lado === 'E' ? -.15 : .15), t);
        const local = lerpV(pa.local ?? v(.2, -.5, lado === 'E' ? -.15 : .15), pb.local ?? v(.2, -.5, lado === 'E' ? -.15 : .15), t);
        const loc = (pa.loc ?? 0) + ((pb.loc ?? 0) - (pa.loc ?? 0)) * t;
        pose.pernas[lado] = { tornozelo, joelho, local, loc };
      }
      // Forma do pé nas duas chaves, depois interpolada (sem saltos).
      let { G, P } = resolver({ ...pose, pernas: Object.fromEntries(['E', 'D'].map(l => [l, { ...pose.pernas[l], pe: G0[PERNAS[l].pe] }])) });
      for (const lado of ['E', 'D']) {
        const b2 = PERNAS[lado], K = P[b2.canela], T = P[b2.pe];
        const fa = formaPe(lado, a.pernas?.[lado]?.pe ?? 'plano', K, T, pose.giro, pose.rol);
        const fb = formaPe(lado, b.pernas?.[lado]?.pe ?? 'plano', K, T, pose.giro, pose.rol);
        pose.pernas[lado].pe = Quaternion.Slerp(fa, fb, t).normalize();
      }
      if (chaves.some(k => k.bracos)) {
        const fk = resolver(pose).P;
        pose.bracos = {};
        for (const lado of ['E', 'D']) {
          const bb = BRACOS[lado], guardaAlvo = fk[bb.mao].subtract(fk[bb.braco]), guardaCot = fk[bb.antebraco].subtract(fk[bb.braco]);
          const ba = a.bracos?.[lado], bz = b.bracos?.[lado];
          if (!ba && !bz) continue;
          pose.bracos[lado] = {
            alvo: lerpV(ba?.alvo ?? guardaAlvo, bz?.alvo ?? guardaAlvo, t),
            cotovelo: lerpV(ba?.cotovelo ?? guardaCot, bz?.cotovelo ?? guardaCot, t),
          };
        }
      }
      ({ G, P } = resolver(pose));
      // Sola inteira acima do piso: sobe o tornozelo da perna que afunda
      // (ponta do pé apontado ou da rasteira atravessava o chão).
      let ajustou = false;
      for (const lado of ['E', 'D']) {
        const b2 = PERNAS[lado], h = alturaSolas([{ lado, G: G[b2.pe], P: P[b2.pe] }]);
        if (h < 0) { pose.pernas[lado].tornozelo = pose.pernas[lado].tornozelo.add(v(0, -h, 0)); ajustou = true; }
      }
      if (ajustou) ({ G, P } = resolver(pose));
      tempos.push(q / 60);
      for (let i = 0; i < n; i++) {
        const pai = ossos[i].pai;
        rot[i].push(...(pai === null ? G[i] : Quaternion.Inverse(G[pai]).multiply(G[i]).normalize()).asArray());
      }
      raiz.push(...P[0].asArray());
      poses.push(P);
    }
    // Continuidade do sinal dos quaternions (q e -q são a mesma rotação; a
    // interpolação entre quadros escolheria o caminho longo após a volta de 360°).
    for (const r of rot) for (let k = 4; k < r.length; k += 4)
      if (r[k] * r[k - 4] + r[k + 1] * r[k - 3] + r[k + 2] * r[k - 2] + r[k + 3] * r[k - 1] < 0) for (let j = 0; j < 4; j++) r[k + j] = -r[k + j];
    if (laco) for (let i = 0; i < n; i++) assert.ok(rot[i].slice(0, 4).every((x, k) => Math.abs(x - rot[i].at(-4 + k)) < 1e-6), `${nome} fecha o laço`);
    const canais = [];
    for (let i = 0; i < n; i++) {
      canais.push({ osso: i, tipo: 'rotation', tempos, valores: rot[i] });
      canais.push({ osso: i, tipo: 'translation', tempos, valores: i === 0 ? raiz : tempos.flatMap(() => ossos[i].posicao) });
    }
    return { clip: { nome, duracaoQuadros: duracao, canais }, poses };
  }

  // Segmentos osso -> filho (e pontas soltas) para medir o contorno do corpo.
  const PONTAS_OSSOS = ossos.map((o, i) => [i, ossos.findIndex(f => f.pai === i)]).map(([i, j]) => [i, j >= 0 ? j : i]);
  const guarda = P0[PERNAS.E.pe], tras = P0[PERNAS.D.pe];
  const ZE = guarda.z, ZD = tras.z;
  const clips = {};

  // k1: dois chutes médios (24 quadros), perna E nas janelas 6-8, D em 12-14.
  clips.k1 = animar('k1', 24, [
    { q: 0 },
    { q: 3, giro: -.25, inclinacao: .08, pelve: v(-.03, .02, 0), pernas: { E: { tornozelo: v(.42, .82, ZE + .12), joelho: v(1, .8, 0), pe: 'plano' } } },
    { q: 6, giro: -.5, inclinacao: .26, pelve: v(.03, .03, 0), pernas: { E: { tornozelo: v(1.28, 1.02, ZE + .16), joelho: v(0, 1, 0), pe: 'esticado' } } },
    { q: 8, giro: -.5, inclinacao: .26, pelve: v(.04, .03, 0), pernas: { E: { tornozelo: v(1.3, 1.02, ZE + .16), joelho: v(0, 1, 0), pe: 'esticado' } } },
    // Troca de pernas em 4 quadros (o motor fixa E em 6-8 e D em 12-14): a E
    // recolhe em arco por 2 quadros (antes descia 0,8 m em 1 só) e pousa; só
    // então a D dobra e estica. Sempre um pé no chão.
    { q: 9, giro: -.2, inclinacao: .1, pelve: v(.03, .02, 0), pernas: { E: { tornozelo: v(.78, .72, ZE + .13), joelho: v(1, 1, 0), pe: 'plano' } } },
    { q: 10, giro: .05, inclinacao: .06, pelve: v(.06, .01, 0) },
    { q: 11, giro: .45, inclinacao: .16, pelve: v(.1, .02, 0), pernas: { D: { tornozelo: v(.3, .98, ZD - .1), joelho: v(1, 1.3, 0), pe: 'plano' } } },
    { q: 12, giro: .8, inclinacao: .32, pelve: v(.15, .03, 0), pernas: { D: { tornozelo: v(1.08, 1.02, -.02), joelho: v(0, 1, 0), pe: 'esticado' } } },
    { q: 14, giro: .8, inclinacao: .32, pelve: v(.16, .03, 0), pernas: { D: { tornozelo: v(1.1, 1.02, -.02), joelho: v(0, 1, 0), pe: 'esticado' } } },
    { q: 17, giro: .25, inclinacao: .08, pelve: v(.08, .01, 0), pernas: { D: { tornozelo: v(.22, .72, ZD - .08), joelho: v(1, 1, 0), pe: 'plano' } } },
    { q: 20, giro: .05, inclinacao: .02, pelve: v(.01, 0, 0) },
    { q: 24 },
  ]);

  // k2: chute alto de perna E (28 quadros), janela 7-10.
  clips.k2 = animar('k2', 28, [
    { q: 0 },
    { q: 4, giro: -.4, inclinacao: .22, pelve: v(-.06, .03, 0), pernas: { E: { tornozelo: v(.38, 1.22, ZE + .14), joelho: v(1, .9, 0), pe: 'plano' } } },
    { q: 7, giro: -.55, inclinacao: .46, pelve: v(-.04, .04, 0), pernas: { E: { tornozelo: v(1.0, 1.82, ZE + .2), joelho: v(0, 1, .2), pe: 'esticado' } } },
    { q: 10, giro: -.55, inclinacao: .46, pelve: v(-.03, .04, 0), pernas: { E: { tornozelo: v(1.02, 1.8, ZE + .2), joelho: v(0, 1, .2), pe: 'esticado' } } },
    { q: 14, giro: -.3, inclinacao: .18, pelve: v(-.05, .02, 0), pernas: { E: { tornozelo: v(.38, 1.05, ZE + .12), joelho: v(1, .9, 0), pe: 'plano' } } },
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

  // dp: subida com soco (Shoryuken próprio da Pipoca, 30 quadros). Agacha e carrega
  // (4), sobe com o braço da frente em linha reta (10), no ápice o corpo está mais
  // alto e o braço de trás puxa para o quadril; desce e pousa (22-30).
  // Subida com os pés plantados: o motor não tira o lutador do chão, então a
  // força vem da perna de trás empurrando e do tronco inclinado; a pelve sobe pouco.
  clips.dp = animar('dp', 30, [
    { q: 0 },
    { q: 4, giro: 0, inclinacao: -.12, pelve: v(-.02, -.22, 0), pernas: { E: { tornozelo: v(.5, .2, ZE + .06), joelho: v(1, .5, -.2), pe: 'plano' }, D: { joelho: v(1, .1, .06) } }, bracos: { E: { alvo: v(.12, .02, -.14), cotovelo: v(-.2, -.6, -1) }, D: { alvo: v(-.02, .05, .16), cotovelo: v(-.3, -.8, 1) } } },
    { q: 7, giro: .1, inclinacao: .16, pelve: v(.03, .04, 0), pernas: { E: { tornozelo: v(.55, .1, ZE + .08), joelho: v(1, .6, 0), pe: 'plano' }, D: { tornozelo: v(.95, .1, ZD - .04), joelho: v(0, 1, 0), pe: 'esticado' } }, bracos: { E: { alvo: v(.1, .5, -.12), cotovelo: v(-.1, .1, -1) }, D: { alvo: v(-.14, .18, .14), cotovelo: v(-.3, -.2, 1) } } },
    { q: 10, giro: .1, inclinacao: .2, pelve: v(.05, .08, 0), pernas: { E: { tornozelo: v(.4, .1, ZE + .1), joelho: v(1, .6, 0), pe: 'plano' }, D: { tornozelo: v(1.0, .1, ZD - .04), joelho: v(0, 1, 0), pe: 'esticado' } }, bracos: { E: { alvo: v(.04, .7, -.12), cotovelo: v(-.1, .3, -1) }, D: { alvo: v(-.2, .12, .14), cotovelo: v(-.4, -.4, 1) } } },
    { q: 16, giro: 0, inclinacao: .08, pelve: v(.02, .04, 0), pernas: { E: { tornozelo: v(.5, .1, ZE + .08), joelho: v(1, .6, 0), pe: 'plano' }, D: { tornozelo: v(.7, .1, ZD - .06), joelho: v(0, .9, 0), pe: 'plano' } }, bracos: { E: { alvo: v(.06, .5, -.12), cotovelo: v(-.1, .2, -1) }, D: { alvo: v(-.14, .14, .14), cotovelo: v(-.3, -.2, 1) } } },
    { q: 22, giro: 0, inclinacao: -.04, pelve: v(0, .02, 0) },
    { q: 30 },
  ]);

  // agachado: guarda baixa de luta (laço de 60 quadros com respiração).
  const baixa = dy => ({ inclinacao: -.12, pelve: v(-.02, -.30 + dy, 0),
    pernas: { E: { joelho: v(1, 0, -.25) }, D: { joelho: v(1, 0, .3) } } });
  clips.agachado = animar('agachado', 60, [
    { q: 0, ...baixa(0) }, { q: 30, ...baixa(-.012) }, { q: 60, ...baixa(0) },
  ], { laco: true });

  // cp: soco agachado no estilo do SF4 (10 quadros, janela 3-5): da guarda
  // agachada, o ombro gira para dentro e o braço da frente estica reto até a
  // cintura da adversária, cabeça de frente para ela; a outra luva protege o rosto.
  const socoBaixo = (dy, giro, inclinacao, alvo, cotovelo) => ({ ...baixa(dy), giro, inclinacao,
    bracos: { E: { alvo, cotovelo } } });
  clips.cp = animar('cp', 10, [
    { q: 0, ...baixa(0) },
    { q: 2, ...socoBaixo(-.01, -.2, -.12, v(.26, -.04, .06), v(-.2, -1, -.4)) },
    { q: 3, ...socoBaixo(-.03, -.5, -.2, v(.72, -.06, .16), v(0, -.5, -1)) },
    { q: 5, ...socoBaixo(-.03, -.5, -.2, v(.73, -.06, .16), v(0, -.5, -1)) },
    { q: 8, ...socoBaixo(-.01, -.15, -.1, v(.3, -.04, .06), v(-.2, -1, -.4)) },
    { q: 10, ...baixa(0) },
  ]);

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

  // rolando: esquiva (24 quadros, o motor desloca). Mergulho para a frente,
  // corpo em bola rente ao chão com uma volta inteira e levantada na guarda.
  // O herdado dava um salto de cambalhota de mais de 1 m.
  const encolhida = (rol, bola, loc, inclinacao, pelve = v(0, 0, 0)) => ({ rol, bola, inclinacao, pelve,
    pernas: { E: { local: v(.16, -.36, ZE * .4), loc, joelho: v(1, .6, -.1), pe: 'corpo' },
      D: { local: v(.16, -.36, ZD * .4), loc, joelho: v(1, .6, .1), pe: 'corpo' } } });
  clips.rolando = animar('rolando', 24, [
    { q: 0 },
    { q: 4, ...encolhida(-.5, .45, .55, -.5, v(.05, -.4, 0)) },
    { q: 8, ...encolhida(-1.8, 1, 1, -.6) },
    { q: 12, ...encolhida(-3.3, 1, 1, -.6) },
    { q: 16, ...encolhida(-4.8, 1, 1, -.55) },
    { q: 20, ...encolhida(-6.1, .55, .4, -.3, v(0, -.32, 0)) },
    { q: 24, rol: -2 * Math.PI },
  ]);

  // caido (46 quadros, o motor fixa): queda como a do SF4 depois da rasteira.
  // A reação começa no quadro 0 (pernas varridas para a frente, tronco para
  // trás), gira de costas no ar, bate no chão no 9, quica e recupera a guarda
  // com impulso pelos ombros. Pernas presas ao corpo (loc) acompanham o giro;
  // acimaDoPiso() mantém a pele inteira acima do chão.
  // estica: 0 = pernas varridas à frente (no ar); 1 = estendidas no chão.
  const deCostas = (rol, pelve, inclinacao, estica = 0) => ({ rol, pelve, inclinacao,
    pernas: { E: { local: v(.5 - .2 * estica, -.62 - .16 * estica, ZE * .5), loc: 1, joelho: v(1, .6 - .4 * estica, -.1), pe: 'corpo' },
      D: { local: v(.36 - .02 * estica, -.6 - .14 * estica, ZD * .5), loc: 1, joelho: v(1, .6 - .2 * estica, .1), pe: 'corpo' } } });
  // Mãos no chão ao lado da cabeça (empurram o corpo de volta, como no SF4).
  const maos = (alvoY, alvoX) => ({ bracos: { E: { alvo: v(alvoX, alvoY, -.12), cotovelo: v(0, .4, -1) }, D: { alvo: v(alvoX, alvoY, .12), cotovelo: v(0, .4, 1) } } });
  clips.caido = animar('caido', 46, [
    { q: 0, ...deCostas(.45, v(-.08, -.3, 0), .45) },
    { q: 5, ...deCostas(1.25, v(-.3, -.75, 0), .2) },
    { q: 9, ...deCostas(1.57, v(-.42, -.98, 0), .3, .6) },
    { q: 11, ...deCostas(1.5, v(-.44, -.88, 0), .2, .5) },
    { q: 14, ...deCostas(1.38, v(-.45, -1, 0), .62, 1) },
    { q: 30, ...deCostas(1.38, v(-.45, -1, 0), .6, .85) },
    // Recuperação rápida: recolhe as pernas sobre os ombros e dá impulso
    // para plantar os pés. Não completa uma cambalhota suspensa no ar.
    { q: 34, ...encolhida(1.95, .7, .95, .35, v(-.4, -.75, 0)), pescoco: .4, orelhas: -1.2, ...maos(-.3, -.25) },
    { q: 37, ...encolhida(1.55, .85, .95, .3, v(-.32, -.55, 0)), pescoco: .4, orelhas: -1.2, ...maos(-.45, -.15) },
    { q: 40, ...encolhida(.85, .65, .8, -.18, v(-.15, -.35, 0)), pescoco: .15, orelhas: -.7, ...maos(-.6, .05) },
    { q: 43, ...baixa(-.1), rol: .1, orelhas: -.2 },
    // A regra troca no 46; o último quadro visível (45) já encaixa no levantar.
    { q: 44, ...baixa(0) },
    { q: 45, ...baixa(0) },
    { q: 46, ...baixa(0) },
  ]);
  // levantando (40 quadros): das costas com a base agachada, sobe em etapas (a pelve
  // sobe a cada 12 quadros) até a guarda. Antes eram 16 quadros e quase não se via.
  // Mãos no chão empurrando: os braços começam apoiados no chão e vão se esticando
  // conforme o quadril sobe (mesmo ritmo das etapas), até a guarda no fim.
  const apoio = (y, x) => ({ bracos: { E: { alvo: v(x, y, -.12), cotovelo: v(-.1, -.4, -1) }, D: { alvo: v(x, y, .12), cotovelo: v(-.1, -.4, 1) } } });
  // Mola em arco: com os pés plantados e as mãos no chão, o quadril sobe e o tronco
  // inclina para trás (como um C deitado) enquanto os braços empurram; depois a Lola
  // desce o quadril e se firma na guarda.
  clips.levantando = animar('levantando', 40, [
    { q: 0, ...baixa(0) },
    { q: 6, ...baixa(.1), inclinacao: -.2, ...apoio(-.9, .2) },
    { q: 14, ...baixa(.42), inclinacao: -.4, ...apoio(-.55, .18) },
    { q: 21, ...baixa(.4), inclinacao: -.34, ...apoio(-.5, .2) },
    { q: 30, ...baixa(.1), inclinacao: -.08 },
    { q: 40 },
  ]);

  // Rolamento sem atravessar o chão: em cada quadro, mede o ponto mais baixo
  // de todos os ossos (com a espessura do corpo/orelhas) e sobe a pelve.
  {
    const c = clips.rolando, raiz = c.clip.canais.find(k => k.osso === 0 && k.tipo === 'translation');
    const raio = ossos.map(o => /orelha|cabeca/.test(o.nome) ? .1 : /pe_/.test(o.nome) ? .02 : .09);
    c.poses.forEach((P, q) => {
      const pontas = PONTAS_OSSOS.map(([i, j]) => [P[i], P[j] ?? null, raio[i]]);
      let minY = Infinity;
      for (const [a, b, r] of pontas) for (const s of [0, .5, 1]) minY = Math.min(minY, (b ? Vector3.Lerp(a, b, s) : a).y - r);
      if (minY < 0) raiz.valores[q * 3 + 1] -= minY;
    });
  }

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
  // Soco agachado: a luva (mão até a ponta do punho) dentro da caixa do motor.
  {
    const [bx, by, bw, bh] = simulador.LUTADORES.pipoca.golpes.cp.janelas[0].caixa, janela = simulador.LUTADORES.pipoca.golpes.cp.janelas[0];
    const caixa = { x0: bx / PX, x1: (bx + bw) / PX, y0: -(by + bh) / PX, y1: -by / PX }, quadros = [];
    for (let q = janela.de; q <= janela.ate; q++) {
      const P = clips.cp.poses[q], M = P[BRACOS.E.mao], C = P[BRACOS.E.antebraco], dir = M.subtract(C).normalize();
      const pontos = [0, .06, .12].map(d => M.add(dir.scale(d)));
      quadros.push({ q, dentro: pontos.some(p => p.x >= caixa.x0 && p.x <= caixa.x1 && p.y >= caixa.y0 && p.y <= caixa.y1), luva: M.asArray().map(x => +x.toFixed(3)) });
    }
    relatorio.cp = [{ lado: 'E', caixa, quadros, ok: quadros.every(f => f.dentro) }];
  }
  return { clips: Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, c.clip])), relatorio };
}

// A guarda recebida aqui já passou pelo acabamento final dos joelhos no
// gerador. Fechar contra a guarda anterior ao acabamento causava outro estalo.
export function emendarLevantada(clip, guarda) {
  for (const canal of clip.canais) {
    const fonte = guarda.canais.find(c => c.osso === canal.osso && c.tipo === canal.tipo);
    const tamanho = canal.tipo === 'rotation' ? 4 : 3;
    const de = canal.valores.slice(3 * tamanho, 4 * tamanho), para = fonte.valores.slice(0, tamanho);
    for (let q = 4; q <= clip.duracaoQuadros; q++) {
      const peso = suave(Math.min(1, (q - 3) / 7));
      const valor = tamanho === 4
        ? Quaternion.Slerp(Quaternion.FromArray(de), Quaternion.FromArray(para), peso).normalize().asArray()
        : Vector3.Lerp(Vector3.FromArray(de), Vector3.FromArray(para), peso).asArray();
      canal.valores.splice(q * tamanho, tamanho, ...valor);
    }
  }
  return clip;
}

// Olhar no oponente: nos movimentos baixos e de defesa a cabeça mantém a
// direção da guarda (só acompanha o giro da pelve). Com o tronco inclinado
// para agachar, a cabeça ia junto e o olhar caía para o chão.
// seguirGiro=false: a cabeça fica de frente para a adversária mesmo com o
// quadril girado (soco agachado); elevar > 0 levanta o queixo (olhar no rosto dela).
export function olharParaFrente(ossos, clip, guarda, { seguirGiro = true, elevar = 0 } = {}) {
  const n = ossos.length, cab = ossos.findIndex(o => o.nome === 'cabeca');
  const canal = (c, i, t) => c.canais.find(k => k.osso === i && k.tipo === t);
  const globais = (c, q) => {
    const G = [];
    for (let i = 0; i < n; i++) {
      const r = Quaternion.FromArray(canal(c, i, 'rotation').valores, q * 4), pai = ossos[i].pai;
      G.push(pai === null ? r : G[pai].multiply(r).normalize());
    }
    return G;
  };
  const G0 = globais(guarda, 0);
  const rc = canal(clip, cab, 'rotation'), valores = rc.valores.slice();
  for (let q = 0; q < rc.tempos.length; q++) {
    const G = globais(clip, q);
    // giro da pelve só em torno do eixo vertical
    const frente = v(1, 0, 0).applyRotationQuaternion(G[0]);
    const giro = seguirGiro ? Quaternion.RotationAxis(v(0, 1, 0), Math.atan2(-frente.z, frente.x)) : Quaternion.Identity();
    const g0frente = v(1, 0, 0).applyRotationQuaternion(G0[0]);
    const desejada = Quaternion.RotationAxis(v(0, 0, 1), elevar).multiply(giro.multiply(Quaternion.RotationAxis(v(0, 1, 0), -Math.atan2(-g0frente.z, g0frente.x)))).multiply(G0[cab]).normalize();
    const pai = ossos[cab].pai;
    Quaternion.Inverse(G[pai]).multiply(desejada).normalize().toArray(valores, q * 4);
  }
  return { ...clip, canais: clip.canais.map(c => c === rc ? { ...c, valores } : c) };
}

// Pernas e pelve emprestadas de uma pose de referência, braços e tronco do
// próprio clip. Os movimentos baixos herdados (soco baixo, defesa baixa)
// ficavam quase sentados nos calcanhares: usam a guarda baixa do agachamento
// refeito. O soco aéreo usa as pernas recolhidas do pulo refeito.
export function pernasDe(ossos, clip, referencia, quadroRef = null) {
  const pernas = new Set(['quadril', 'coxa_E', 'canela_E', 'pe_E', 'coxa_D', 'canela_D', 'pe_D'].map(nome => ossos.findIndex(o => o.nome === nome)));
  const ref = (i, tipo) => referencia.canais.find(c => c.osso === i && c.tipo === tipo);
  return { ...clip, canais: clip.canais.map(c => {
    if (!pernas.has(c.osso)) return c;
    const r = ref(c.osso, c.tipo), k = c.tipo === 'rotation' ? 4 : 3, nRef = r.tempos.length;
    const valores = c.tempos.flatMap((_, q) => {
      const j = quadroRef ?? q % (nRef - 1);
      return r.valores.slice(j * k, j * k + k);
    });
    return { ...c, valores };
  }) };
}

// Joelhos para a frente nos clips herdados: os movimentos de origem dobravam
// os joelhos para fora com o quadril baixo (postura "de sapo" em soco baixo,
// defesa baixa, soco aéreo, levantar, recuo, quebra-combo, Super). Em cada
// quadro, quadril e tornozelos ficam onde estão; o joelho é recalculado no
// plano que aponta para a frente da pelve (com leve abertura), e a pose do pé
// é mantida. Vale também deitado: a frente é a da pelve, não a do mundo.
export function joelhosParaFrente(ossos, clip, abertura = .12, afastamento = .14) {
  const n = ossos.length, idx = nome => ossos.findIndex(o => o.nome === nome);
  const canal = (i, tipo) => clip.canais.find(c => c.osso === i && c.tipo === tipo);
  const quadros = canal(0, 'rotation').tempos.length;
  const novos = Array.from({ length: n }, () => []);
  const deDirecao = (de, para) => { const q = Quaternion.Identity(); Quaternion.FromUnitVectorsToRef(de.normalizeToNew(), para.normalizeToNew(), q); return q; };
  for (let q = 0; q < quadros; q++) {
    const G = [], P = [];
    for (let i = 0; i < n; i++) {
      const r = Quaternion.FromArray(canal(i, 'rotation').valores, q * 4), t = Vector3.FromArray(canal(i, 'translation').valores, q * 3);
      const pai = ossos[i].pai;
      G.push(pai === null ? r : G[pai].multiply(r).normalize());
      P.push(pai === null ? t : P[pai].add(t.applyRotationQuaternion(G[pai])));
    }
    for (const [lado, s] of [['E', -1], ['D', 1]]) {
      const c = idx(`coxa_${lado}`), k = idx(`canela_${lado}`), p = idx(`pe_${lado}`);
      const L1 = Vector3.FromArray(ossos[k].posicao).length(), L2 = Vector3.FromArray(ossos[p].posicao).length();
      // Cada pé do seu lado do corpo (no recuo um pé cruzava na frente do
      // outro): distância lateral mínima até o eixo da pelve.
      const lateral = v(0, 0, 1).applyRotationQuaternion(G[0]);
      let T = P[p];
      const fora = Vector3.Dot(T.subtract(P[0]), lateral) * s;
      if (fora < afastamento) T = T.add(lateral.scale(s * (afastamento - fora)));
      const H = P[c], eixo = T.subtract(H);
      const d = Math.min(Math.max(eixo.length(), Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4), e = eixo.normalizeToNew();
      // Joelho sobre a ponta do pé (sem cair para dentro), com a frente da pelve.
      const ponta = v(1, 0, 0).applyRotationQuaternion(G[p]);
      const frente = ponta.scale(.7).add(v(1, 0, s * abertura).normalize().applyRotationQuaternion(G[0]).scale(.3)).normalize();
      const polo = frente.subtract(e.scale(Vector3.Dot(frente, e)));
      if (polo.lengthSquared() < 1e-6) continue;                 // perna reta na direção da frente
      polo.normalize();
      const u = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - u * u));
      const K = H.add(e.scale(u)).add(polo.scale(h)), Tn = H.add(e.scale(d));
      const pe = G[p];
      G[c] = deDirecao(Vector3.FromArray(ossos[k].posicao).applyRotationQuaternion(G[c]), K.subtract(H)).multiply(G[c]).normalize();
      G[k] = deDirecao(Vector3.FromArray(ossos[p].posicao).applyRotationQuaternion(G[k]), Tn.subtract(K)).multiply(G[k]).normalize();
      G[p] = pe;
    }
    for (let i = 0; i < n; i++) {
      const pai = ossos[i].pai;
      novos[i].push(...(pai === null ? G[i] : Quaternion.Inverse(G[pai]).multiply(G[i]).normalize()).asArray());
    }
  }
  return { ...clip, canais: clip.canais.map(c => c.tipo === 'rotation' ? { ...c, valores: novos[c.osso] } : c) };
}

// Conferência de todos os clips: em cada quadro, a ponta de cada pé aponta
// para a frente do corpo (componente na direção da pelve > limite). Pegou o
// pé ao contrário que a revisão visual de poucas poses deixou passar.
export function conferirPes(ossos, clips, limite = -0.2) {
  const n = ossos.length, pes = ['pe_E', 'pe_D'].map(nome => ossos.findIndex(o => o.nome === nome));
  const falhas = [];
  for (const clip of clips) {
    const canal = (i, tipo) => clip.canais.find(c => c.osso === i && c.tipo === tipo);
    const quadros = canal(0, 'rotation').tempos.length;
    for (let q = 0; q < quadros; q++) {
      const G = [];
      for (let i = 0; i < n; i++) {
        const r = Quaternion.FromArray(canal(i, 'rotation').valores, q * 4);
        G.push(ossos[i].pai === null ? r : G[ossos[i].pai].multiply(r).normalize());
      }
      const frenteCorpo = v(1, 0, 0).applyRotationQuaternion(G[0]);
      frenteCorpo.y = 0;
      frenteCorpo.normalize();
      for (const i of pes) {
        const ponta = v(1, 0, 0).applyRotationQuaternion(G[i]);
        const d = Vector3.Dot(ponta, frenteCorpo);
        if (d < limite) falhas.push({ clip: clip.nome, quadro: q, osso: ossos[i].nome, d: +d.toFixed(2) });
      }
    }
  }
  return falhas;
}
