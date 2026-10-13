import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

const DURACOES = Object.freeze({ rolando: 24, agarrando: 30, agarrado: 30, tonto: 60, vitoria: 100, derrotado: 100, final: 200, vitimaFinal: 200 });
const limitar = t => Math.max(0, Math.min(1, t));
const suave = t => { t = limitar(t); return t * t * (3 - 2 * t); };
const clonar = p => p.map(b => ({ p: b.p.clone(), r: b.r.clone() }));
const interpolar = (a, b, t) => a.map((v, i) => ({ p: Vector3.Lerp(v.p, b[i].p, t), r: Quaternion.Slerp(v.r, b[i].r, t).normalize() }));
const unidade = (a, b) => { const q = Quaternion.Identity(); Quaternion.FromUnitVectorsToRef(a.normalizeToNew(), b.normalizeToNew(), q); return q; };

export function criarAtuacaoPipoca(guarda, ossos, simulador, { posturaBaixa, estados, primitivas } = {}) {
  assert.equal(ossos.length, 20); assert.ok(primitivas?.length && estados?.clips?.length);
  const indice = nome => { const i = ossos.findIndex(b => b.nome === nome); assert.ok(i >= 0); return i; };
  function ler(clip, q = 0) {
    return ossos.map((_, osso) => {
      function amostrar(tipo, n) {
        const c = clip.canais.find(v => v.osso === osso && v.tipo === tipo); assert.ok(c);
        let k = 0; while (k < c.tempos.length - 2 && c.tempos[k + 1] < q / 60) k++;
        const t = limitar((q / 60 - c.tempos[k]) / (c.tempos[k + 1] - c.tempos[k]));
        return n === 4 ? Quaternion.Slerp(Quaternion.FromArray(c.valores, k * n), Quaternion.FromArray(c.valores, (k + 1) * n), t).normalize()
          : Vector3.Lerp(Vector3.FromArray(c.valores, k * n), Vector3.FromArray(c.valores, (k + 1) * n), t);
      }
      return { p: amostrar('translation', 3), r: amostrar('rotation', 4) };
    });
  }
  function globais(p) {
    const g = [];
    for (let i = 0; i < 20; i++) {
      const pai = ossos[i].pai;
      g.push(pai === null ? { p: p[i].p.clone(), r: p[i].r.clone() }
        : { p: g[pai].p.add(p[i].p.applyRotationQuaternion(g[pai].r)), r: g[pai].r.multiply(p[i].r).normalize() });
    }
    return g;
  }
  function orientar(p, i, r) { const pai = ossos[i].pai; p[i].r = pai === null ? r.normalizeToNew() : Quaternion.Inverse(globais(p)[pai].r).multiply(r).normalize(); }
  function girar(p, nome, eixo, angulo) { const i = indice(nome); orientar(p, i, Quaternion.RotationAxis(eixo, angulo).multiply(globais(p)[i].r)); }
  const base = ler(guarda), baixa = ler(posturaBaixa), referencia = globais(base), caido = estados.clips.find(c => c.nome === 'caido'), deitada = ler(caido, caido.duracaoQuadros);
  function resolver(p, lado, nomes, alvo) {
    const [a, b, c] = nomes.map(n => indice(`${n}_${lado}`)), g = globais(p), origem = g[a].p;
    const eixoAntigo = g[c].p.subtract(origem).normalize(), dobra = g[b].p.subtract(origem);
    const polo = dobra.subtract(eixoAntigo.scale(Vector3.Dot(dobra, eixoAntigo))).normalize();
    const dir = [g[b].p.subtract(origem), g[c].p.subtract(g[b].p)], rot = [g[a].r, g[b].r];
    const v = alvo.subtract(origem), d = v.length(), l1 = p[b].p.length(), l2 = p[c].p.length();
    assert.ok(d > Math.abs(l1 - l2) + 1e-5 && d < l1 + l2 - 1e-5, `${nomes[0]}_${lado}: IK ${d}/${l1 + l2}, origem${origem.asArray()}, alvo${alvo.asArray()}`);
    const eixo = v.scale(1 / d), plano = polo.subtract(eixo.scale(Vector3.Dot(polo, eixo))).normalize();
    const u = (l1 * l1 - l2 * l2 + d * d) / (2 * d), junta = origem.add(eixo.scale(u)).add(plano.scale(Math.sqrt(Math.max(0, l1 * l1 - u * u))));
    for (const [j, vetor] of [junta.subtract(origem), alvo.subtract(junta)].entries()) orientar(p, [a, b][j], unidade(dir[j], vetor).multiply(rot[j]));
    assert.ok(globais(p)[c].p.subtract(alvo).length() < 1e-5);
  }
  function plantar(p) { for (const lado of ['E', 'D']) { resolver(p, lado, ['coxa', 'canela', 'pe'], referencia[indice(`pe_${lado}`)].p); orientar(p, indice(`pe_${lado}`), referencia[indice(`pe_${lado}`)].r); } }
  function luva(p, lado, alvo, e = 1) {
    const g = globais(p), i = indice(`mao_${lado}`), inicial = g[i].p, rotacao = g[i].r;
    resolver(p, lado, ['braco', 'antebraco', 'mao'], Vector3.Lerp(inicial, Vector3.FromArray(alvo), e));
    orientar(p, i, Quaternion.Slerp(rotacao, globais(p)[indice(`antebraco_${lado}`)].r, e).normalize());
  }
  function orelhas(p, e, q = 0) {
    for (const [nome, fator, atraso] of [['orelha_E', .12, 0], ['orelha_D', .09, -.4], ['cauda', .035, .2]]) {
      const i = indice(nome); p[i].r = p[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), fator * e * Math.sin(q / 8 + atraso))).normalize();
    }
  }
  const repouso = [];
  for (const b of ossos) repouso.push(Vector3.FromArray(b.posicao).add(b.pai === null ? Vector3.Zero() : repouso[b.pai]));
  const vertices = primitivas.flatMap(m => Array.from({ length: m.posicoes.length / 3 }, (_, v) => ({
    influencias: Array.from({ length: 4 }, (_, k) => ({ junta: m.juntas[v * 4 + k], peso: m.pesos[v * 4 + k],
      p: Vector3.FromArray(m.posicoes, v * 3).subtract(repouso[m.juntas[v * 4 + k]]) })).filter(i => i.peso > 0) })));
  function piso(p) {
    const g = globais(p); let yMin = Infinity;
    for (const v of vertices) { let y = 0; for (const i of v.influencias) y += (i.p.applyRotationQuaternion(g[i.junta].r).y + g[i.junta].p.y) * i.peso; yMin = Math.min(yMin, y); }
    return yMin;
  }
  function assentar(p) { p[0].p.y += .0004 - piso(p); return p; }

  function atordoada(q) {
    const p = clonar(base), onda = Math.sin(q / 60 * 2 * Math.PI);
    p[0].p.y -= .025 * onda * onda;
    girar(p, 'tronco', Vector3.Forward(), .045 * onda);
    girar(p, 'peito', Vector3.Up(), .045 * Math.sin(q / 60 * 2 * Math.PI + .2));
    girar(p, 'cabeca', Vector3.Right(), .07 * Math.sin(q / 60 * 2 * Math.PI - .4));
    girar(p, 'cabeca', Vector3.Forward(), .10);
    luva(p, 'E', [.20, 1.12, -.30]); luva(p, 'D', [-.04, 1.08, .32]);
    // As duas orelhas têm atraso diferente e fecham o mesmo ciclo de60q.
    for (const [nome, fase] of [['orelha_E', .4], ['orelha_D', -.3]]) {
      const i = indice(nome); p[i].r = p[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), -.10 + .045 * Math.sin(q / 60 * 2 * Math.PI + fase))).normalize();
    }
    plantar(p); return p;
  }
  function comemorar(q) {
    const p = clonar(base), subir = suave(q / 24), assimetria = suave((q - 65) / 20);
    const e = Math.sin(Math.PI * limitar((q - 20) / 60)) ** 2;
    p[0].p.y -= .015 * e;
    girar(p, 'peito', Vector3.Up(), -.07 * subir);
    luva(p, 'E', [.30, 2.44, -.30], subir);
    luva(p, 'D', [.04, 2.42, .32], subir * (1 - assimetria));
    orelhas(p, e, q); plantar(p); return p;
  }
  function agarrar(q) {
    const p = clonar(base), e = suave(q / 4) * (1 - suave((q - 10) / 14));
    p[0].p.x += .13 * e; p[0].p.y -= .035 * e;
    girar(p, 'tronco', Vector3.Forward(), -.22 * e);
    girar(p, 'peito', Vector3.Up(), .10 * e - .35 * suave((q - 8) / 4) * (1 - suave((q - 14) / 10)));
    const release = suave((q - 8) / 2), soltar = suave((q - 12) / 12);
    const eAlvo = Vector3.Lerp(new Vector3(1.08, 1.53, -.14), new Vector3(.35, 1.92, -.18), release);
    const dAlvo = Vector3.Lerp(new Vector3(.88, 1.53, .30), new Vector3(.16, 1.78, .22), release);
    luva(p, 'E', eAlvo.asArray(), e * (1 - soltar)); luva(p, 'D', dAlvo.asArray(), e * (1 - soltar));
    plantar(p); orelhas(p, e, q); return p;
  }
  function presa(q) {
    const p = clonar(base), e = suave(q / 3), susto = suave((q - 7) / 3);
    p[0].p.y -= .035 * e;
    girar(p, 'tronco', Vector3.Forward(), -.08 * e + .12 * susto);
    girar(p, 'cabeca', Vector3.Forward(), .08 * e);
    luva(p, 'E', [.36, 1.48, -.14], e); luva(p, 'D', [.24, 1.50, .20], e);
    plantar(p); orelhas(p, .4 * e, q); return p;
  }
  const encolhida = clonar(baixa);
  for (const [nome, angulo] of [['tronco', -.95], ['peito', -.35], ['cabeca', -.15]]) {
    const i = indice(nome); encolhida[i].r = encolhida[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), angulo)).normalize();
  }
  luva(encolhida, 'E', [.65, .53, -.18]); luva(encolhida, 'D', [.52, .51, .22]);
  function rolar(q) {
    if (q <= 2) return assentar(interpolar(base, encolhida, suave(q / 2)));
    if (q <= 14) {
      const p = clonar(encolhida);
      // Um giro completo acompanha os12quadros centrais de avanço do KSim.
      p[0].r = Quaternion.RotationAxis(Vector3.Forward(), -(q - 2) / 12 * 2 * Math.PI).multiply(p[0].r).normalize();
      return assentar(p);
    }
    if (q <= 16) return assentar(interpolar(encolhida, baixa, suave((q - 14) / 2)));
    const p = interpolar(baixa, base, suave((q - 16) / 8)); plantar(p); return p;
  }
  function perder(q) {
    if (q >= 34) return clonar(deitada);
    const p = q < 12 ? interpolar(base, baixa, suave(q / 12)) : interpolar(baixa, deitada, suave((q - 12) / 22));
    return assentar(p);
  }
  function chuva(q) {
    const p = clonar(base), comando = suave(q / 18) * (1 - suave((q - 138) / 22));
    const comemora = suave((q - 160) / 14) * (1 - suave((q - 180) / 20));
    const batida = q >= 36 && q <= 138 ? Math.sin(Math.PI * ((q - 36) % 6) / 6) ** 2 : 0;
    girar(p, 'peito', Vector3.Up(), -.10 * comando);
    girar(p, 'cabeca', Vector3.Forward(), -.025 * comando + .035 * batida);
    luva(p, 'E', [.44, 2.35 + .035 * batida, -.22], Math.max(comando, comemora));
    luva(p, 'D', [.15, 2.40, .30], comemora);
    orelhas(p, comando + comemora, q); plantar(p); return p;
  }
  function vitima(q) {
    if (q >= 176) return clonar(deitada);
    const p = atordoada(Math.min(q, 36));
    const idade = q >= 36 && q <= 138 ? (q - 36) % 6 : 6, impacto = 1 - suave(idade / 4);
    p[0].p.y -= .035 * impacto;
    girar(p, 'tronco', Vector3.Forward(), .065 * impacto);
    girar(p, 'cabeca', Vector3.Forward(), .09 * impacto);
    plantar(p);
    return q <= 138 ? p : assentar(interpolar(p, deitada, suave((q - 138) / 38)));
  }
  const produtores = { rolando: rolar, agarrando: agarrar, agarrado: presa, tonto: atordoada, vitoria: comemorar, derrotado: perder, final: chuva, vitimaFinal: vitima };
  const clips = [];
  for (const [nome, produzir] of Object.entries(produtores)) {
    const duracaoQuadros = DURACOES[nome], divisor = ['rolando', 'agarrando', 'agarrado'].includes(nome) ? 8 : 4;
    const corpoNoChao = ['rolando', 'derrotado', 'vitimaFinal'].includes(nome), quadros = [0], poses = [produzir(0)];
    function inserir(a, pa, b, pb, nivel = 0) {
      if (corpoNoChao) {
        const y = piso(interpolar(pa, pb, .5));
        if ((y < -.0005 || y > .0008) && nivel < 10) {
          const meio = (a + b) / 2, pm = produzir(meio);
          inserir(a, pa, meio, pm, nivel + 1); inserir(meio, pm, b, pb, nivel + 1); return;
        }
      }
      quadros.push(b); poses.push(pb);
    }
    for (let i = 1; i <= duracaoQuadros * divisor; i++) inserir((i - 1) / divisor, poses.at(-1), i / divisor, produzir(i / divisor));
    const tempos = quadros.map(q => q / 60), canais = [];
    for (let osso = 0; osso < 20; osso++) {
      const valores = [];
      for (const p of poses) { let r = p[osso].r.normalizeToNew(); if (valores.length && Quaternion.Dot(Quaternion.FromArray(valores, valores.length - 4), r) < 0) r = r.scale(-1); valores.push(...r.asArray()); }
      canais.push({ osso, tipo: 'rotation', tempos, valores });
      canais.push({ osso, tipo: 'translation', tempos, valores: poses.flatMap(p => p[osso].p.asArray()) });
    }
    clips.push({ nome, duracaoQuadros, canais });
  }
  return { versao: 17, aprovadoFinal: false, clips, origem: 'Atuação autoral sobre guarda v4, baixa v14 e repouso v16; IK de luvas e apoios, envelope CPU do corpo.',
    regras: { raizJogavelImovel: true, rolando: { velocidadeMotor: 88, ultimoQuadroMovimento: 16, giro: [2, 14], retornoApoios: [16, 24] },
      agarrando: { contatoNominal: [4, 8], lancamentoMotor: 10, pulsosContato: { E: [1.08, 1.53, -.14], D: [.88, 1.53, .30] }, distanciaMotorPixels: [26, 36], ajustadoPorVitima: false },
      agarrado: { lancamentoMotor: 10, ultimos20quadros: 'Reserva do contrato; KSim já troca para dano/voo no quadro10.' },
      final: { identidade: 'Comanda a Chuva de Cenouras, guarda e comemoração de boxeadora; não anima eventos de gameplay.', contatosVfx: Array.from({ length: 18 }, (_, i) => 36 + i * 6), relogio: 's.fT, inclusive hitstop', terminaNaGuarda: true },
      entradaDerrotadoDepoisDeVitimaFinal: 'Usar pose final do derrotado; a vítima já está deitada no fim do Final.',
      amostragemQuadros: '1/8q em rolagem/agarrão; 1/4q nas atuações; chaves adaptativas nos contatos do corpo com o piso.' },
    pendentes: ['Contato de duas luvas por vítima e por distância de agarrão.', 'Validação visual de rolagem, silhueta, mãos/joelhos e expressões.', 'Transições de entrada contextual (tonto→vitimaFinal, vitimaFinal→derrotado).'],
    limites: ['Ter31fontes autorais não significa aprovação premium final.', 'Vítima do Final reage à faixa de impactos; outros finalizadores terão direção visual própria.', 'Sem áudio, expressão facial esculpida ou trama/pelagem final.'] };
}

export function aplicarAtuacaoPipoca(dados, fonte) {
  assert.equal(fonte?.versao, 17); assert.ok(fonte.clips?.length > 0);
  const novos = new Map();
  for (const clip of fonte.clips) {
    assert.ok(clip.nome in DURACOES && !novos.has(clip.nome)); assert.equal(clip.duracaoQuadros, DURACOES[clip.nome]);
    assert.ok(dados.clips.some(c => c.nome === clip.nome)); assert.equal(clip.canais.length, 40);
    const alvos = new Set();
    for (const c of clip.canais) {
      assert.ok(Number.isInteger(c.osso) && c.osso >= 0 && c.osso < 20 && ['translation', 'rotation'].includes(c.tipo));
      const chave = `${c.osso}/${c.tipo}`; assert.ok(!alvos.has(chave)); alvos.add(chave);
      const n = c.tipo === 'rotation' ? 4 : 3;
      assert.equal(c.valores.length, c.tempos.length * n); assert.ok(c.valores.every(Number.isFinite));
      assert.equal(c.tempos[0], 0); assert.ok(Math.abs(c.tempos.at(-1) - clip.duracaoQuadros / 60) < 1e-7);
      assert.ok(c.tempos.every((v, i) => Number.isFinite(v) && (!i || v > c.tempos[i - 1])));
      if (n === 4) for (let i = 0; i < c.valores.length; i += 4) assert.ok(Math.abs(Math.hypot(...c.valores.slice(i, i + 4)) - 1) < 1e-5);
      if (c.osso === 0 && n === 3) for (let i = 0; i < c.valores.length; i += 3) assert.ok(Math.abs(c.valores[i]) <= .131 && Math.abs(c.valores[i + 2]) < 1e-4, 'Pelve interna limitada; raiz jogável externa');
    }
    novos.set(clip.nome, structuredClone(clip));
  }
  return { ...dados, clips: dados.clips.map(c => novos.get(c.nome) || c), extras: { ...dados.extras,
    atuacaoPipoca: { versao: 17, nomes: [...novos.keys()], regras: fonte.regras, pendentes: fonte.pendentes, limites: fonte.limites, aprovadoFinal: false } } };
}
