import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

const NOMES = new Set(['cp', 'ck', 'ap', 'ak', 'esp', 'sup']);
const suave = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const unidade = (a, b) => { const q = Quaternion.Identity(); Quaternion.FromUnitVectorsToRef(a.normalizeToNew(), b.normalizeToNew(), q); return q; };
const clonar = pose => pose.map(b => ({ p: b.p.clone(), r: b.r.clone() }));
const interpolar = (a, b, t) => a.map((v, i) => ({ p: Vector3.Lerp(v.p, b[i].p, t), r: Quaternion.Slerp(v.r, b[i].r, t).normalize() }));

export function criarTecnicasPipoca(guarda, ossos, simulador, { posturaBaixa, posturaAerea } = {}) {
  assert.equal(ossos.length, 20, 'Técnicas usam os mesmos vinte ossos');
  const indice = nome => { const i = ossos.findIndex(b => b.nome === nome); assert.ok(i >= 0, `Osso ${nome}`); return i; };
  function poseDoClip(clip, quadro = 0) {
    return ossos.map((osso, i) => {
      const r = clip.canais.find(c => c.osso === i && c.tipo === 'rotation');
      const p = clip.canais.find(c => c.osso === i && c.tipo === 'translation');
      assert.ok(r && p, 'Fonte contém rotação e posição dos vinte ossos');
      function trecho(c) {
        const tempo = quadro / 60;
        let i = 0; while (i < c.tempos.length - 2 && c.tempos[i + 1] < tempo) i++;
        return [i, Math.max(0, Math.min(1, (tempo - c.tempos[i]) / (c.tempos[i + 1] - c.tempos[i])))];
      }
      const [ri, rt] = trecho(r), [pi, pt] = trecho(p);
      return { r: Quaternion.Slerp(Quaternion.FromArray(r.valores, ri * 4), Quaternion.FromArray(r.valores, (ri + 1) * 4), rt).normalize(),
        p: Vector3.Lerp(Vector3.FromArray(p.valores, pi * 3), Vector3.FromArray(p.valores, (pi + 1) * 3), pt) };
    });
  }
  function globais(pose) {
    const g = [];
    for (let i = 0; i < ossos.length; i++) {
      const pai = ossos[i].pai;
      g.push(pai === null ? { p: pose[i].p.clone(), r: pose[i].r.clone() }
        : { p: g[pai].p.add(pose[i].p.applyRotationQuaternion(g[pai].r)), r: g[pai].r.multiply(pose[i].r).normalize() });
    }
    return g;
  }
  const base = poseDoClip(guarda), referencia = globais(base);
  function orientar(pose, nome, rotacaoMundo) {
    const i = indice(nome), pai = ossos[i].pai;
    pose[i].r = pai === null ? rotacaoMundo.normalizeToNew() : Quaternion.Inverse(globais(pose)[pai].r).multiply(rotacaoMundo).normalize();
  }
  function cadeia(poseReferencia, prefixos, lado) {
    const g = globais(poseReferencia), [a, b, c] = prefixos.map(n => indice(`${n}_${lado}`));
    const eixo = g[c].p.subtract(g[a].p).normalize(), dobra = g[b].p.subtract(g[a].p);
    const polo = dobra.subtract(eixo.scale(Vector3.Dot(dobra, eixo))).normalize();
    return { a, b, c, nomes: [ossos[a].nome, ossos[b].nome],
      dir: [g[b].p.subtract(g[a].p), g[c].p.subtract(g[b].p)],
      rot: [g[a].r, g[b].r], polo, comprimento: [poseReferencia[b].p.length(), poseReferencia[c].p.length()] };
  }
  function resolver(pose, c, alvo) {
    const origem = globais(pose)[c.a].p, vetor = alvo.subtract(origem), d = vetor.length(), [a, b] = c.comprimento;
    assert.ok(d > Math.abs(a - b) + 1e-5 && d < a + b - 1e-5, `IK alcançável ${ossos[c.a].nome}: ${d.toFixed(5)} / ${(a + b).toFixed(5)}`);
    const eixo = vetor.scale(1 / d), p = c.polo.subtract(eixo.scale(Vector3.Dot(c.polo, eixo))).normalize();
    assert.ok(p.lengthSquared() > .5, 'Plano da dobra é definido');
    const u = (a * a - b * b + d * d) / (2 * d);
    const junta = origem.add(eixo.scale(u)).add(p.scale(Math.sqrt(Math.max(0, a * a - u * u))));
    for (const [i, direcao] of [junta.subtract(origem), alvo.subtract(junta)].entries()) orientar(pose, c.nomes[i], unidade(c.dir[i], direcao).multiply(c.rot[i]).normalize());
    assert.ok(globais(pose)[c.c].p.subtract(alvo).length() < 1e-5, 'IK chega ao alvo');
  }
  function plantar(pose, lados = ['E', 'D']) {
    for (const lado of lados) {
      // Corrigir a âncora a partir da própria dobra da pose intermediária
      // conserva também a torção autoral da postura baixa v14 nas pontas.
      resolver(pose, cadeia(pose, ['coxa', 'canela', 'pe'], lado), referencia[indice(`pe_${lado}`)].p);
      orientar(pose, `pe_${lado}`, referencia[indice(`pe_${lado}`)].r);
    }
  }
  const baixa = posturaBaixa ? poseDoClip(posturaBaixa) : clonar(base);
  if (!posturaBaixa) { baixa[0].p.y -= .27; plantar(baixa); }
  const aerea = posturaAerea ? poseDoClip(posturaAerea, 8) : clonar(base);
  const bracos = { guarda: cadeia(base, ['braco', 'antebraco', 'mao'], 'E'), baixa: cadeia(baixa, ['braco', 'antebraco', 'mao'], 'E') };
  function girar(pose, nome, eixo, angulo) {
    const atual = globais(pose)[indice(nome)].r;
    orientar(pose, nome, Quaternion.RotationAxis(eixo, angulo).multiply(atual));
  }
  function estenderLuva(pose, alvo, e, c) {
    const antes = globais(pose)[indice('mao_E')].r;
    resolver(pose, c, alvo);
    const antebraco = globais(pose)[indice('antebraco_E')].r;
    orientar(pose, 'mao_E', Quaternion.Slerp(antes, antebraco, e).normalize());
  }
  function secundarios(pose, e) {
    for (const [nome, fator] of [['orelha_E', -.06], ['orelha_D', -.045], ['cauda', .04]]) {
      const i = indice(nome);
      pose[i].r = pose[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), fator * Math.sin(Math.PI * e))).normalize();
    }
  }
  function orientarPe(pose, e, antes) {
    // A diagonal do dedo pertence à malha preservada; direção local em glTF.
    const dedo = new Vector3(.9677, .1456, -.2059).normalize();
    const atual = dedo.applyRotationQuaternion(referencia[indice('pe_E')].r);
    const contato = unidade(atual, new Vector3(1, .02, 0)).multiply(referencia[indice('pe_E')].r).normalize();
    orientar(pose, 'pe_E', Quaternion.Slerp(antes, contato, e).normalize());
  }
  function amostrar(nome, produzir) {
    const duracaoQuadros = simulador.LUTADORES.pipoca.golpes[nome].dur;
    // O reaparecimento do super sobe em dois quadros; 1/8q mantém os apoios
    // também durante a interpolação, sem relaxar a tolerância de um milímetro.
    const divisor = nome === 'sup' ? 8 : 4;
    const quadros = Array.from({ length: duracaoQuadros * divisor + 1 }, (_, i) => i / divisor);
    if (nome === 'sup') for (let i = 0; i <= 64; i++) quadros.push(42 + i / 32);
    const unicos = [...new Set(quadros)].sort((a, b) => a - b), amostras = unicos.map(produzir);
    const tempos = unicos.map(q => q / 60), canais = [];
    for (let i = 0; i < ossos.length; i++) {
      const valores = [];
      for (const pose of amostras) {
        let r = pose[i].r.normalizeToNew();
        if (valores.length && Quaternion.Dot(Quaternion.FromArray(valores, valores.length - 4), r) < 0) r = r.scale(-1);
        valores.push(...r.asArray());
      }
      canais.push({ osso: i, tipo: 'rotation', tempos, valores });
      canais.push({ osso: i, tipo: 'translation', tempos, valores: amostras.flatMap(p => p[i].p.asArray()) });
    }
    return { nome, duracaoQuadros, canais };
  }
  const cp = amostrar('cp', q => {
    const p = clonar(baixa), e = q <= 3 ? suave(q / 3) : q <= 5 ? 1 : 1 - suave((q - 5) / 3);
    girar(p, 'tronco', Vector3.Forward(), -.055 * e);
    girar(p, 'peito', Vector3.Up(), -.12 * e);
    const inicial = globais(p)[indice('mao_E')].p;
    estenderLuva(p, Vector3.Lerp(inicial, new Vector3(.9, 1.02, -.18), e), e, bracos.baixa);
    secundarios(p, e); return p;
  });
  const esp = amostrar('esp', q => {
    const p = clonar(base);
    const avanco = q <= 5 ? 0 : q <= 10 ? suave((q - 5) / 5) : q <= 13 ? 1 : 1 - suave((q - 13) / 12);
    girar(p, 'tronco', Vector3.Forward(), -.065 * avanco);
    girar(p, 'peito', Vector3.Up(), -.16 * avanco);
    const inicial = referencia[indice('mao_E')].p, preparo = new Vector3(.12, 1.78, -.24), lancamento = new Vector3(.75, 2, -.18);
    const alvo = q <= 5 ? Vector3.Lerp(inicial, preparo, suave(q / 5))
      : q <= 10 ? Vector3.Lerp(preparo, lancamento, avanco) : Vector3.Lerp(inicial, lancamento, avanco);
    estenderLuva(p, alvo, avanco, bracos.guarda);
    secundarios(p, avanco); return p;
  });
  const sup = amostrar('sup', q => {
    const baixo = q <= 5 ? suave(q / 5) : q <= 42 ? 1 : 1 - suave((q - 42) / 2);
    const e = q <= 42 ? 0 : q <= 44 ? suave((q - 42) / 2) : q <= 50 ? 1 : 1 - suave((q - 50) / 9);
    const p = interpolar(base, baixa, baixo);
    girar(p, 'tronco', Vector3.Forward(), -.09 * e);
    girar(p, 'peito', Vector3.Up(), -.20 * e);
    const inicial = globais(p)[indice('mao_E')].p;
    estenderLuva(p, Vector3.Lerp(inicial, new Vector3(.36, 2.44, -.16), e), e, bracos.guarda);
    secundarios(p, e); plantar(p); return p;
  });
  const ck = amostrar('ck', q => {
    const p = clonar(baixa);
    const e = q <= 2 ? 0 : q <= 6 ? suave((q - 2) / 4) : q <= 9 ? 1 : 1 - suave((q - 9) / 9);
    p[0].p.x += .15 * e;
    girar(p, 'tronco', Vector3.Forward(), .04 * e);
    const antes = globais(p)[indice('pe_E')].r;
    const c = cadeia(baixa, ['coxa', 'canela', 'pe'], 'E');
    resolver(p, c, Vector3.Lerp(referencia[indice('pe_E')].p, new Vector3(1.02, .28, -.22), e));
    orientarPe(p, e, antes); plantar(p, ['D']); secundarios(p, e); return p;
  });
  const ap = amostrar('ap', q => {
    const p = interpolar(aerea, base, suave((q - 14) / 6));
    const e = q <= 4 ? suave(q / 4) : q <= 14 ? 1 : 1 - suave((q - 14) / 5);
    girar(p, 'tronco', Vector3.Forward(), -.04 * e);
    girar(p, 'peito', Vector3.Up(), -.12 * e);
    if (e > 0) {
      const c = cadeia(p, ['braco', 'antebraco', 'mao'], 'E');
      const inicial = globais(p)[indice('mao_E')].p;
      estenderLuva(p, Vector3.Lerp(inicial, new Vector3(.90, 1.38, -.18), e), e, c);
    }
    secundarios(p, e); return p;
  });
  const ak = amostrar('ak', q => {
    const p = interpolar(aerea, base, suave((q - 16) / 6));
    const e = q <= 1 ? 0 : q <= 5 ? suave((q - 1) / 4) : q <= 16 ? 1 : 1 - suave((q - 16) / 5);
    girar(p, 'tronco', Vector3.Forward(), .07 * e);
    if (e > 0) {
      const c = cadeia(p, ['coxa', 'canela', 'pe'], 'E'), g = globais(p);
      const antes = g[indice('pe_E')].r;
      resolver(p, c, Vector3.Lerp(g[indice('pe_E')].p, new Vector3(.90, 1, -.20), e));
      orientarPe(p, e, antes);
    }
    secundarios(p, e); return p;
  });
  return { versao: 15, aprovadoFinal: false, clips: [cp, ck, ap, ak, esp, sup],
    origem: 'IK de dois segmentos sobre a guarda v4 e a postura baixa v14; torção e dobras preservadas.',
    regras: { raizJogavelImovel: true, pelveDentroDaRaiz: 'Até8cm para trás na postura baixa v14; não move modelo-pipoca.', janelaCriacaoCenoura: 10, visibilidadeSuper: 'p.sumido; não controlada pelo clip',
      apoio: 'Dois pés no chão em cp/esp/sup; D apoia ck. ap/ak usam puloq8 sem ancorar os pés ao chão.', amostragemQuadros: { cp: .25, ck: .25, ap: .25, ak: .25, esp: .25, sup: '.125; .03125 entreq42–44' } },
    pendentes: [], limites: ['Leitura artística e deformações ainda precisam de captura visual.', 'Não aprova os demais movimentos do personagem.'] };
}

export function aplicarTecnicasPipoca(dados, fonte) {
  assert.ok(Array.isArray(fonte?.clips) && fonte.clips.length > 0, 'Fonte contém técnicas autorais');
  const substitutos = new Map();
  for (const clip of fonte.clips) {
    assert.ok(NOMES.has(clip.nome), 'Fonte só substitui técnicas da Pipoca');
    assert.ok(!substitutos.has(clip.nome), 'Técnicas não se repetem');
    assert.equal(clip.duracaoQuadros, dados.clips.find(c => c.nome === clip.nome)?.duracaoQuadros, 'Duração preserva o motor');
    assert.equal(clip.canais.length, 40, 'Vinte ossos com posição e rotação');
    const alvos = new Set();
    for (const c of clip.canais) {
      assert.ok(Number.isInteger(c.osso) && c.osso >= 0 && c.osso < 20);
      assert.ok(['translation', 'rotation'].includes(c.tipo));
      assert.ok(!alvos.has(`${c.osso}:${c.tipo}`)); alvos.add(`${c.osso}:${c.tipo}`);
      const tamanho = c.tipo === 'rotation' ? 4 : 3;
      assert.equal(c.valores.length, c.tempos.length * tamanho);
      assert.equal(c.tempos[0], 0); assert.ok(Math.abs(c.tempos.at(-1) - clip.duracaoQuadros / 60) < 1e-7);
      assert.ok(c.tempos.every((t, i) => Number.isFinite(t) && (!i || t > c.tempos[i - 1])));
      assert.ok(c.valores.every(Number.isFinite));
      if (c.tipo === 'rotation') for (let i = 0; i < c.valores.length; i += 4) assert.ok(Math.abs(Math.hypot(...c.valores.slice(i, i + 4)) - 1) < 1e-5);
      if (c.osso === 0 && c.tipo === 'translation') for (let i = 0; i < c.valores.length; i += 3) assert.ok(Math.abs(c.valores[i]) < .081 && Math.abs(c.valores[i + 2]) < 1e-4, 'Pelve da técnica permanece dentro da postura baixa, sem deslocar a raiz jogável');
    }
    substitutos.set(clip.nome, structuredClone(clip));
  }
  return { ...dados, clips: dados.clips.map(clip => substitutos.get(clip.nome) || clip),
    extras: { ...dados.extras, tecnicasPipoca: { versao: fonte.versao, nomes: [...substitutos.keys()], regras: fonte.regras, pendentes: fonte.pendentes, aprovadoFinal: false } } };
}
