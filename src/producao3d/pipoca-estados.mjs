import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

const DURACOES = Object.freeze({ corrida: 8, recuo: 18, quebra: 16, caido: 46, levantando: 16 });
const limitar = t => Math.max(0, Math.min(1, t));
const suave = t => { t = limitar(t); return t * t * (3 - 2 * t); };
const clonar = pose => pose.map(b => ({ p: b.p.clone(), r: b.r.clone() }));
const interpolar = (a, b, t) => a.map((v, i) => ({ p: Vector3.Lerp(v.p, b[i].p, t), r: Quaternion.Slerp(v.r, b[i].r, t).normalize() }));
const unidade = (a, b) => { const q = Quaternion.Identity(); Quaternion.FromUnitVectorsToRef(a.normalizeToNew(), b.normalizeToNew(), q); return q; };

// Todos os deslocamentos são locais ao clip. A posição jogável continua no KSim.
export function deslocamentoEstadoPipoca(nome, q, regras) {
  if (nome === 'corrida') return q * regras.corrida.velocidadeMetrosQuadro;
  if (nome === 'recuo') return -q * regras.recuo.velocidadeMetrosQuadro;
  if (nome === 'quebra') {
    const inteiros = Math.floor(Math.min(10, q)), fracao = q - inteiros;
    const unidades = 40 * inteiros - 2 * inteiros * (inteiros - 1)
      + (inteiros < 10 ? fracao * (40 - 4 * inteiros) : 0);
    return -unidades / regras.unidadesMetro;
  }
  return 0;
}

export function alvoPeEstadoPipoca(fonte, nome, q, lado) {
  const r = fonte.regras, inicial = Vector3.FromArray(r.pes[ lado ]), deslocamento = deslocamentoEstadoPipoca(nome, q, r);
  if (nome === 'corrida') {
    const duracao = r.corrida.duracaoQuadros, continua = q + (lado === 'E' ? 0 : duracao / 2);
    const fase = ((continua % duracao) + duracao) % duracao, apoio = fase <= duracao / 2 + 1e-8;
    const excursao = r.corrida.distanciaCiclo / 4, velocidade = r.corrida.velocidadeMetrosQuadro;
    const u = (fase - duracao / 2) / (duracao / 2);
    inicial.x = r.centros[lado] + (apoio ? excursao - velocidade * fase : -excursao + 2 * excursao * suave(u));
    if (!apoio) inicial.y += r.corrida.alturaBalanco * Math.sin(Math.PI * u) ** 2;
    return { alvo: inicial, apoio, segmento: Math.floor(continua / duracao), altura: apoio ? 0 : inicial.y - r.pes[lado][1] };
  }
  const trajetoria = r[nome]?.passos?.[lado];
  assert.ok(trajetoria, `Trajetória do pé ${nome}/${lado}`);
  const passo = trajetoria.find(p => q >= p.de - 1e-8 && q <= p.ate + 1e-8) || trajetoria.at(-1);
  const u = limitar((q - passo.de) / (passo.ate - passo.de));
  inicial.x = passo.apoio ? passo.mundo : passo.inicio + (passo.fim - passo.inicio) * suave(u);
  inicial.x -= deslocamento;
  const altura = passo.apoio ? 0 : r[nome].alturaBalanco * Math.sin(Math.PI * u) ** 2;
  inicial.y += altura;
  return { alvo: inicial, apoio: passo.apoio, segmento: passo.de, altura };
}

export function criarEstadosPipoca(guarda, ossos, simulador, { posturaBaixa, reacao, primitivas = [] } = {}) {
  assert.equal(ossos.length, 20);
  const indice = nome => { const i = ossos.findIndex(b => b.nome === nome); assert.ok(i >= 0, nome); return i; };
  function ler(clip, q = 0) {
    return ossos.map((_, osso) => {
      function canal(tipo, n) {
        const c = clip.canais.find(v => v.osso === osso && v.tipo === tipo); assert.ok(c);
        let k = 0; while (k < c.tempos.length - 2 && c.tempos[k + 1] < q / 60) k++;
        const t = limitar((q / 60 - c.tempos[k]) / (c.tempos[k + 1] - c.tempos[k]));
        return n === 4 ? Quaternion.Slerp(Quaternion.FromArray(c.valores, k * n), Quaternion.FromArray(c.valores, (k + 1) * n), t).normalize()
          : Vector3.Lerp(Vector3.FromArray(c.valores, k * n), Vector3.FromArray(c.valores, (k + 1) * n), t);
      }
      return { p: canal('translation', 3), r: canal('rotation', 4) };
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
  const base = ler(guarda), baixa = ler(posturaBaixa), impacto = reacao ? ler(reacao) : clonar(base), referencia = globais(base);
  function orientar(pose, i, mundo) {
    const pai = ossos[i].pai;
    pose[i].r = pai === null ? mundo.normalizeToNew() : Quaternion.Inverse(globais(pose)[pai].r).multiply(mundo).normalize();
  }
  function girar(pose, nome, eixo, angulo) {
    const i = indice(nome); orientar(pose, i, Quaternion.RotationAxis(eixo, angulo).multiply(globais(pose)[i].r));
  }
  function resolverPerna(pose, lado, alvo, preservarDobra = false) {
    const [a, b, c] = ['coxa', 'canela', 'pe'].map(n => indice(`${n}_${lado}`)), g = globais(pose);
    const ref = preservarDobra ? g : referencia, dir = [ref[b].p.subtract(ref[a].p), ref[c].p.subtract(ref[b].p)], rot = [ref[a].r, ref[b].r];
    const dobra = ref[b].p.subtract(ref[a].p), antigoEixo = ref[c].p.subtract(ref[a].p).normalize();
    const polo = dobra.subtract(antigoEixo.scale(Vector3.Dot(dobra, antigoEixo))).normalize();
    const vetor = alvo.subtract(g[a].p), d = vetor.length(), l1 = pose[b].p.length(), l2 = pose[c].p.length();
    assert.ok(d > Math.abs(l1 - l2) + 1e-5 && d < l1 + l2 - 1e-5, `${lado}: alvo da perna alcançável ${d}/${l1 + l2}`);
    const eixo = vetor.scale(1 / d), p = polo.subtract(eixo.scale(Vector3.Dot(polo, eixo))).normalize();
    const u = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const joelho = g[a].p.add(eixo.scale(u)).add(p.scale(Math.sqrt(Math.max(0, l1 * l1 - u * u))));
    for (const [j, direcao] of [joelho.subtract(g[a].p), alvo.subtract(joelho)].entries()) orientar(pose, [a, b][j], unidade(dir[j], direcao).multiply(rot[j]));
    orientar(pose, c, referencia[c].r);
    assert.ok(globais(pose)[c].p.subtract(alvo).length() < 1e-5);
  }
  const velocidade = simulador.LUTADORES.pipoca.correr / (simulador.U * 24);
  const regras = { unidadesMetro: simulador.U * 24,
    pes: Object.fromEntries(['E', 'D'].map(l => [l, referencia[indice(`pe_${l}`)].p.asArray()])),
    centros: Object.fromEntries(['E', 'D'].map(l => [l, referencia[indice(`coxa_${l}`)].p.x])),
    corrida: { clip: 'corrida', duracaoQuadros: 8, distanciaCiclo: velocidade * 8, velocidadeMetrosQuadro: velocidade, velocidadeMotor: simulador.LUTADORES.pipoca.correr, alturaBalanco: .15 },
    recuo: { velocidadeMetrosQuadro: 90 / (simulador.U * 24), alturaBalanco: .11, passos: { E: [], D: [] } },
    quebra: { alturaBalanco: .065, passos: { E: [], D: [] } },
    amostragemQuadros: { corrida: .125, recuo: .0625, quebra: .125, caido: .03125, levantando: .03125 },
    raizJogavel: 'Posição, parede, velocidade, hitstop e orientação pertencem ao KSim.',
    queda: 'Envelope da pele impede penetração; contato de corpo no chão e apoio dos pés na segunda metade da subida. Não aprova atuação artística.' };
  function apoiar(nome, lado, de, ate, mundo) { regras[nome].passos[lado].push({ de, ate, apoio: true, mundo }); }
  function balancar(nome, lado, de, ate, inicio, fim) { regras[nome].passos[lado].push({ de, ate, apoio: false, inicio, fim }); }
  const desloc = (nome, q) => deslocamentoEstadoPipoca(nome, q, regras);
  for (const lado of ['E', 'D']) {
    const x = regras.pes[lado][0];
    if (lado === 'E') {
      let mundo = x;
      for (const [de, pouso, fimApoio, localPouso] of [[0, 2, 6, -.35], [6, 10, 14, -.35], [14, 16, 18, x + desloc('recuo', 18) - desloc('recuo', 16)]]) {
        const novo = localPouso + desloc('recuo', pouso);
        balancar('recuo', lado, de, pouso, mundo, novo); apoiar('recuo', lado, pouso, fimApoio, novo); mundo = novo;
      }
      const novo = x + desloc('quebra', 10);
      balancar('quebra', lado, 0, 5, x, novo); apoiar('quebra', lado, 5, 16, novo);
    } else {
      apoiar('recuo', lado, 0, 2, x); let mundo = x;
      for (const [de, pouso, fimApoio] of [[2, 6, 10], [10, 14, 16], [16, 18, 18]]) {
        const novo = (pouso === 18 ? x : -.45) + desloc('recuo', pouso);
        balancar('recuo', lado, de, pouso, mundo, novo);
        if (fimApoio > pouso) apoiar('recuo', lado, pouso, fimApoio, novo); mundo = novo;
      }
      apoiar('quebra', lado, 0, 5, x); const novo = x + desloc('quebra', 10);
      balancar('quebra', lado, 5, 10, x, novo); apoiar('quebra', lado, 10, 16, novo);
    }
  }
  const fonte = { versao: 16, aprovadoFinal: false, regras, clips: [] };
  function secundarios(p, q, amplitude) {
    for (const [nome, fase, fator] of [['orelha_E', .16, 1], ['orelha_D', -.1, .8], ['cauda', .25, .65]]) {
      const i = indice(nome); p[i].r = p[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), amplitude * fator * Math.sin(q * Math.PI / 4 - fase))).normalize();
    }
  }
  function locomocao(nome, q) {
    const p = clonar(base), onda = Math.sin(q * Math.PI / 4), ciclo = Math.sin(q * Math.PI / 4) ** 2;
    const entrada = nome === 'corrida' ? 1 : suave(q / 2) * (1 - suave((q - DURACOES[nome] + 2) / 2));
    p[0].p.y -= (nome === 'corrida' ? .07 - .015 * ciclo : .16 * entrada);
    girar(p, 'tronco', Vector3.Forward(), (nome === 'recuo' ? .08 : -.10) * entrada);
    girar(p, 'peito', Vector3.Up(), .065 * onda * entrada);
    girar(p, 'cabeca', Vector3.Forward(), .035 * entrada);
    for (const lado of ['E', 'D']) resolverPerna(p, lado, alvoPeEstadoPipoca(fonte, nome, q, lado).alvo);
    // Luvas altas: preparação de soco, sem braços pendulares de corrida genérica.
    for (const [nome, sinal] of [['braco_E', 1], ['braco_D', -1]]) {
      const i = indice(nome); p[i].r = p[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), .035 * onda * entrada * sinal)).normalize();
    }
    secundarios(p, q, .045 * entrada); return p;
  }
  function quebra(q) {
    const p = interpolar(base, baixa, .40 * Math.sin(Math.PI * limitar(q / 16)) ** 2);
    const e = suave(q / 3) * (1 - suave((q - 5) / 8));
    girar(p, 'peito', Vector3.Up(), -.10 * e);
    for (const [nome, sinal] of [['braco_E', 1], ['braco_D', -1]]) {
      const i = indice(nome); p[i].r = p[i].r.multiply(Quaternion.RotationAxis(Vector3.Up(), sinal * .20 * e)).normalize();
    }
    for (const lado of ['E', 'D']) resolverPerna(p, lado, alvoPeEstadoPipoca(fonte, 'quebra', q, lado).alvo, true);
    secundarios(p, q, .06 * e); return p;
  }
  // A queda recebe postura do impacto. A pelve roda para trás enquanto as
  // pernas se recolhem; não se inclina um boneco de repouso inteiro no chão.
  const deitada = clonar(baixa);
  deitada[0].r = Quaternion.RotationAxis(Vector3.Forward(), Math.PI / 2).multiply(base[0].r).normalize();
  deitada[0].p.set(0, .36, 0);
  for (const [nome, angulo] of [['tronco', -.10], ['peito', .08], ['cabeca', -.15]]) {
    const i = indice(nome); deitada[i].r = deitada[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), angulo)).normalize();
  }
  for (const [nome, angulo] of [['coxa_E', -.55], ['canela_E', .45], ['coxa_D', -.35], ['canela_D', .25]]) {
    const i = indice(nome); deitada[i].r = deitada[i].r.multiply(Quaternion.RotationAxis(Vector3.Forward(), angulo)).normalize();
  }
  // Envelope CPU da geometria em repouso com os quatro pesos originais.
  const repouso = [];
  for (const b of ossos) repouso.push(Vector3.FromArray(b.posicao).add(b.pai === null ? Vector3.Zero() : repouso[b.pai]));
  const vertices = primitivas.flatMap(m => Array.from({ length: m.posicoes.length / 3 }, (_, v) => ({
    p: Vector3.FromArray(m.posicoes, v * 3), juntas: m.juntas.slice(v * 4, v * 4 + 4), pesos: m.pesos.slice(v * 4, v * 4 + 4) })));
  function menorPiso(p) {
    assert.ok(vertices.length > 0, 'Queda e subida precisam da pele para validar contato com o piso');
    const g = globais(p); let menor = Infinity;
    for (const v of vertices) {
      let y = 0;
      for (let k = 0; k < 4; k++) if (v.pesos[k]) {
        const j = v.juntas[k]; y += (v.p.subtract(repouso[j]).applyRotationQuaternion(g[j].r).y + g[j].p.y) * v.pesos[k];
      }
      menor = Math.min(menor, y);
    }
    return menor;
  }
  function assentar(p) { p[0].p.y += .0004 - menorPiso(p); return p; }
  const repousando = assentar(clonar(deitada));
  function queda(q) {
    if (q >= 12) return clonar(repousando);
    const p = interpolar(impacto, deitada, suave(q / 12));
    // O contato assenta a pele a partir do piso; até o impacto, os pés podem
    // sair do chão e a cabeça nunca atravessa a superfície.
    return assentar(p);
  }
  function subir(q) {
    if (q <= 8) return assentar(interpolar(repousando, baixa, suave(q / 8)));
    const p = interpolar(baixa, base, suave((q - 8) / 8));
    for (const lado of ['E', 'D']) resolverPerna(p, lado, referencia[indice(`pe_${lado}`)].p, true);
    return p;
  }
  function amostrar(nome, produzir) {
    const duracaoQuadros = DURACOES[nome], divisor = ['caido', 'levantando'].includes(nome) ? 32 : nome === 'recuo' ? 16 : 8;
    const quadros = [0], poses = [produzir(0)], contatoCorpo = ['caido', 'levantando'].includes(nome);
    function inserir(a, pa, b, pb, nivel = 0) {
      if (contatoCorpo) {
        const piso = menorPiso(interpolar(pa, pb, .5));
        // Quando o ponto mais baixo troca de parte do corpo, a envoltória do
        // chão tem uma quina. Inserir só as chaves necessárias nessa troca
        // evita flutuar entre duas poses assentadas e não infla o clip inteiro.
        if ((piso < -.0005 || piso > .0008) && nivel < 10) {
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
      for (const pose of poses) {
        let r = pose[osso].r.normalizeToNew();
        if (valores.length && Quaternion.Dot(Quaternion.FromArray(valores, valores.length - 4), r) < 0) r = r.scale(-1);
        valores.push(...r.asArray());
      }
      canais.push({ osso, tipo: 'rotation', tempos, valores });
      canais.push({ osso, tipo: 'translation', tempos, valores: poses.flatMap(p => p[osso].p.asArray()) });
    }
    return { nome, duracaoQuadros, canais };
  }
  fonte.clips = [amostrar('corrida', q => locomocao('corrida', q)), amostrar('recuo', q => locomocao('recuo', q)), amostrar('quebra', quebra), amostrar('caido', queda), amostrar('levantando', subir)];
  fonte.origem = 'Guarda v4, postura baixa v14 e reação v8; corrida e recuo por trajetória compensada e IK de dois segmentos.';
  fonte.pendentes = ['rolando', 'agarrando', 'agarrado', 'tonto', 'vitoria', 'derrotado', 'final', 'vitimaFinal'];
  fonte.limites = ['Queda e primeira metade da subida exigem direção de atuação e revisão de contatos de mão/joelho.', 'Rig, piso e fonte autoral não equivalem à aprovação de arte e silhueta.'];
  return fonte;
}

export function aplicarEstadosPipoca(dados, fonte) {
  assert.equal(fonte?.versao, 16);
  assert.ok(fonte.clips?.length > 0);
  const novos = new Map();
  for (const clip of fonte.clips) {
    assert.ok(clip.nome in DURACOES && !novos.has(clip.nome), 'Estado permitido e único');
    assert.equal(clip.duracaoQuadros, DURACOES[clip.nome], 'Duração do estado segue o motor');
    assert.ok(dados.clips.some(c => c.nome === clip.nome));
    assert.equal(clip.canais.length, 40);
    const alvos = new Set();
    for (const c of clip.canais) {
      assert.ok(Number.isInteger(c.osso) && c.osso >= 0 && c.osso < 20 && ['rotation', 'translation'].includes(c.tipo));
      const chave = `${c.osso}/${c.tipo}`; assert.ok(!alvos.has(chave)); alvos.add(chave);
      const n = c.tipo === 'rotation' ? 4 : 3;
      assert.equal(c.valores.length, c.tempos.length * n);
      assert.ok(c.valores.every(Number.isFinite));
      assert.equal(c.tempos[0], 0); assert.ok(Math.abs(c.tempos.at(-1) - clip.duracaoQuadros / 60) < 1e-7);
      assert.ok(c.tempos.every((v, i) => Number.isFinite(v) && (!i || v > c.tempos[i - 1])));
      if (n === 4) for (let i = 0; i < c.valores.length; i += 4) assert.ok(Math.abs(Math.hypot(...c.valores.slice(i, i + 4)) - 1) < 1e-5);
      if (c.osso === 0 && n === 3) for (let i = 0; i < c.valores.length; i += 3) assert.ok(Math.abs(c.valores[i]) < .081 && Math.abs(c.valores[i + 2]) < 1e-4, 'Animação não desloca a raiz jogável');
    }
    novos.set(clip.nome, structuredClone(clip));
  }
  return { ...dados, clips: dados.clips.map(c => novos.get(c.nome) || c), extras: { ...dados.extras,
    estadosPipoca: { versao: 16, nomes: [...novos.keys()], corrida: fonte.regras.corrida, regras: fonte.regras, pendentes: fonte.pendentes, limites: fonte.limites, aprovadoFinal: false } } };
}
