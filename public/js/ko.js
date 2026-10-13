/*
 * K.O — o jogo no navegador: telas, controles de toque, rede (lockstep), computador, som e locutor.
 *
 * Rede: os dois celulares rodam a mesma luta (ko-sim.js) e trocam só os botões de cada quadro.
 * Cada botão vale para um quadro um pouco no futuro (atraso), assim dá tempo de chegar no outro
 * celular; se ainda não chegou, a luta espera. Ninguém "manda" no estado, então ninguém roubando.
 */
(function () {
  'use strict';
  const K = window.KOSim, A = window.KOArte, B = K.B;
  const cfg = JSON.parse(document.getElementById('ko-config').textContent);
  const $ = (sel) => document.querySelector(sel);
  const painel = $('#painel'), canvas = $('#tela'), controles = $('#controles');
  const PASSO_MS = 1000 / 60;
  const prontos = Object.keys(cfg.lutadores).filter((id) => cfg.lutadores[id].pronto && cfg.lutadores[id].modelos3d?.length === 2 && K.LUTADORES[id]);
  const guarda = (f) => { try { return f(); } catch (e) { return null; } };
  const dificuldadeSalva = guarda(() => localStorage.getItem('ko-dificuldade'));
  cfg.dificuldade = KOCPU.PERFIS[dificuldadeSalva] ? dificuldadeSalva : 'medio';
  const versus = cfg.modo === 'versus';
  const pads = KOControle.criar({
    carregar: (id) => guarda(() => JSON.parse(localStorage.getItem('ko-pad:' + id))),
    salvar: (id, mapa) => guarda(() => localStorage.setItem('ko-pad:' + id, JSON.stringify(mapa))),
  });
  let estadosPads = [{ bits: 0 }, { bits: 0 }], pulsosPads = [0, 0], primeiroLocal = null;
  if (versus) document.body.classList.add('versus-local');

  function atualizarPads() {
    estadosPads = pads.atualizar();
    const ajuste = document.querySelector('.painel-controle');
    if (ajuste) {
      const passo = pads.configuracao();
      ajuste.querySelector('[role="status"]').textContent = passo
        ? 'Solte os botões, depois pressione: ' + ({ L: 'esquerda', R: 'direita', U: 'cima', D: 'baixo', P: 'soco', K: 'chute / confirmar', D_: 'defesa', S: 'especial', menu: 'menu' }[KOControle.ACOES[passo.passo]])
        : estadosPads.map((p, i) => 'Jogador ' + (i + 1) + ': ' + (!p.conectado ? 'aperte um botão no controle' : p.mapeado ? 'pronto' : 'precisa configurar')).join(' · ');
      pulsosPads = [0, 0];
      if (!passo) KOControle.navegar(ajuste, estadosPads.find((p) => p.pulso || p.confirmarClicado));
      return;
    }
    const sobre = document.querySelector('.painel-pausa');
    if (luta && luta.s.fase !== 'fim' && !sobre) {
      for (let i = 0; i < 2; i++) pulsosPads[i] |= estadosPads[i].pulso;
      if (versus && estadosPads.some((p) => !p.conectado || !p.mapeado)) {
        luta.aviso = 'Reconecte os dois controles e volte para a luta.';
        $('#pausa').click();
      } else if (estadosPads.some((p) => p.menuClicado)) $('#pausa').click();
      return;
    }
    pulsosPads = [0, 0];
    const alvo = sobre || painel;
    const ativo = estadosPads[versus && primeiroLocal ? 1 : 0];
    if (!ativo) return;
    if (versus && painel.dataset.tela === 'escolha') {
      const status = $('#ladoDele');
      if (status) status.textContent = estadosPads.map((p, i) => 'Controle ' + (i + 1) + ': ' + (!p.conectado ? 'aperte um botão para conectar' : p.mapeado ? 'pronto' : 'abra Configurar controles')).join(' · ');
    }
    KOControle.navegar(alvo, sobre ? estadosPads.find((p) => p.pulso || p.confirmarClicado) : ativo);
    if (sobre && estadosPads.some((p) => p.menuClicado)) sobre.querySelector('[data-acao="voltar"]').click();
  }

  A.iniciar(canvas);

  // ---------- Som (sintetizado na hora, sem arquivos) ----------
  let audio = null, somArena = null;
  let somLigado = guarda(() => localStorage.getItem('ko-som')) !== 'nao';
  // A luta usa apenas modelos 3D. Preferências antigas de 2D não se aplicam.
  const tela3d = document.getElementById('tela-3d');
  function acordarAudio() {
    if (!window.AudioContext) return;
    if (!audio) {
      audio = new AudioContext();
      if (window.KOSom) {
        somArena = KOSom.criar(audio);
        somArena.preparar().catch(erro => console.warn('K.O: não foi possível preparar o locutor.', erro));
      }
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  }
  function tom(freq, dur, tipo, vol, desliza) {
    if (!audio || !somLigado) return;
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = tipo || 'square'; o.frequency.setValueAtTime(freq, t);
    if (desliza) o.frequency.exponentialRampToValueAtTime(desliza, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  function ruido(dur, vol, filtro) {
    if (!audio || !somLigado) return;
    const n = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audio.createBufferSource(), g = audio.createGain(), f = audio.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filtro || 1800;
    src.buffer = buf; g.gain.value = vol || 0.3;
    src.connect(f).connect(g).connect(audio.destination); src.start();
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  }
  // Timbres originais por estilo; os gritos continuam em ko-voz.js.
  const TIMBRES_ESPECIAIS = {
    pipoca: [620, 1100, 'triangle', 2200], uivo: [150, 65, 'sawtooth', 650],
    maromba: [100, 55, 'triangle', 400], ginga: [380, 760, 'triangle', 1900],
    'vo-nena': [740, 370, 'sine', 1400], 'vo-tiao': [210, 440, 'triangle', 900],
    kira: [420, 130, 'triangle', 2800], toco: [120, 45, 'triangle', 500],
    nix: [1200, 1900, 'sine', 5000], eco: [85, 45, 'sine', 800],
    volt: [650, 1800, 'sawtooth', 6000], kilo: [80, 35, 'triangle', 350],
    brasa: [380, 180, 'sawtooth', 2400], mare: [260, 100, 'sine', 1600],
    truque: [880, 1760, 'sine', 3200], fossil: [130, 60, 'sawtooth', 1100],
  };
  function somEspecial(e, superGolpe = false) {
    const [de, para, tipo, filtro] = TIMBRES_ESPECIAIS[e.id] || [500, 1200, 'triangle', 1800];
    tom(de, superGolpe ? 0.4 : 0.19, tipo, 0.08, para);
    ruido(superGolpe ? 0.2 : 0.09, superGolpe ? 0.17 : 0.1, filtro);
    if (superGolpe) tom(70, 0.3, 'sine', 0.12, 35);
  }
  const SONS = {
    pulo: () => tom(300, 0.12, 'square', 0.04, 600),
    especial: (e) => somEspecial(e),
    super: (e) => somEspecial(e, true),
    agarrao: () => ruido(0.15, 0.3, 600),
    chao: () => ruido(0.2, 0.35, 400),
    quebra: () => { tom(1200, 0.3, 'square', 0.1, 200); ruido(0.2, 0.3, 3000); },
    choque: () => ruido(0.12, 0.3, 5000),
    ko: () => { ruido(0.5, 0.5, 700); tom(110, 0.6, 'sawtooth', 0.15, 40); },
    golpeFinal: () => tom(220, 1.2, 'triangle', 0.12, 880),
  };

  const ultimoGrito = [-999, -999];
  function vozLutador(e) {
    if (!somLigado || !window.KOVoz || !luta) return;
    const lado = e.lado;
    if (lado !== 0 && lado !== 1) return;
    const id = luta.s.p[lado].id, perfil = KOVoz.PERFIS[id];
    if (!perfil || !['ataque', 'especial', 'super', 'agarrao', 'golpeFinal'].includes(e.t)) return;
    if (e.t === 'ataque' && luta.s.f - ultimoGrito[lado] < 12) return;
    ultimoGrito[lado] = luta.s.f;
    KOVoz.grito(audio, id, e.t !== 'ataque', luta.s.f);
  }

  function vibrar(ms) { if (navigator.vibrate) guarda(() => navigator.vibrate(ms)); }

  // ---------- Tela cheia, deitado e tela sempre acesa ----------
  let travaTela = null;
  async function modoJogo() {
    acordarAudio();
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await guarda(() => el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}));
    if (screen.orientation && screen.orientation.lock) guarda(() => screen.orientation.lock('landscape').catch(() => {}));
    if (navigator.wakeLock && !travaTela) guarda(() => navigator.wakeLock.request('screen').then((t) => { travaTela = t; t.addEventListener('release', () => { travaTela = null; }); }).catch(() => {}));
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && luta) modoJogo(); });

  // ---------- Controles ----------
  // bitsPulso guarda toques rápidos (apertou e soltou entre dois quadros) para não se perderem.
  let bitsToque = 0, bitsTeclado = 0, bitsPulso = 0;
  const TECLAS = { KeyA: B.L, ArrowLeft: B.L, KeyD: B.R, ArrowRight: B.R, KeyW: B.U, ArrowUp: B.U, Space: B.U, KeyS: B.D, ArrowDown: B.D, KeyJ: B.P, KeyK: B.K, KeyL: B.D_, KeyI: B.S };
  addEventListener('keydown', (e) => { if (TECLAS[e.code]) { bitsTeclado |= TECLAS[e.code]; bitsPulso |= TECLAS[e.code]; e.preventDefault(); acordarAudio(); } });
  addEventListener('keyup', (e) => { if (TECLAS[e.code]) bitsTeclado &= ~TECLAS[e.code]; });
  addEventListener('blur', () => { bitsTeclado = 0; bitsToque = 0; });

  // Direcional em cruz: encosta em qualquer lugar da metade esquerda; a direção vale a partir do centro da cruz.
  const direcional = $('#direcional');
  let dedoDir = null, bitsDir = 0;
  function atualizarDirecional(x, y) {
    const r = direcional.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
    const escala = dist ? Math.min(dist, r.width * 0.3) / dist : 0;
    direcional.style.setProperty('--analogico-x', dx * escala + 'px');
    direcional.style.setProperty('--analogico-y', dy * escala + 'px');
    bitsDir = 0;
    if (dist > r.width * 0.12) {
      const ang = Math.atan2(dy, dx), s = Math.sin(ang), c = Math.cos(ang);
      if (c > 0.38) bitsDir |= B.R; if (c < -0.38) bitsDir |= B.L;
      if (s < -0.5) bitsDir |= B.U; if (s > 0.5) bitsDir |= B.D;
    }
    direcional.dataset.dir = (bitsDir & B.U ? 'c' : '') + (bitsDir & B.D ? 'b' : '') + (bitsDir & B.L ? 'e' : '') + (bitsDir & B.R ? 'd' : '');
  }
  // Botões: quem encosta perto da divisa aperta os dois (soco+chute = esquiva, defesa+especial = quebra-combo).
  const botoes = [...document.querySelectorAll('.botoes .b')].map((el) => ({ el, bit: { P: B.P, K: B.K, B: B.D_, S: B.S }[el.dataset.b] }));
  const dedosBotao = new Map();
  function botoesSob(x, y) {
    let bits = 0;
    for (const b of botoes) {
      const r = b.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (Math.hypot(x - cx, y - cy) <= r.width / 2 + 6) bits |= b.bit;
    }
    return bits;
  }
  function recalcularToque() {
    let bits = bitsDir;
    for (const v of dedosBotao.values()) bits |= v;
    bitsPulso |= bits & ~bitsToque;
    bitsToque = bits;
    for (const b of botoes) b.el.classList.toggle('apertado', !!(bits & b.bit));
  }
  controles.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.pausa')) return;
    e.preventDefault(); acordarAudio();
    controles.setPointerCapture(e.pointerId);
    if (e.clientX < innerWidth * 0.45 && dedoDir === null) {
      dedoDir = e.pointerId;
      atualizarDirecional(e.clientX, e.clientY);
    } else {
      const bits = botoesSob(e.clientX, e.clientY);
      dedosBotao.set(e.pointerId, bits);
      if (bits) vibrar(8);
    }
    recalcularToque();
  });
  controles.addEventListener('pointermove', (e) => {
    if (e.pointerId === dedoDir) atualizarDirecional(e.clientX, e.clientY);
    else if (dedosBotao.has(e.pointerId)) dedosBotao.set(e.pointerId, botoesSob(e.clientX, e.clientY));
    recalcularToque();
  });
  const soltar = (e) => {
    if (e.pointerId === dedoDir) { dedoDir = null; bitsDir = 0; direcional.dataset.dir = ''; direcional.style.removeProperty('--analogico-x'); direcional.style.removeProperty('--analogico-y'); }
    dedosBotao.delete(e.pointerId);
    recalcularToque();
  };
  controles.addEventListener('pointerup', soltar);
  controles.addEventListener('pointercancel', soltar);
  controles.addEventListener('lostpointercapture', soltar);
  function limparControles() {
    dedoDir = null; bitsDir = bitsToque = bitsTeclado = bitsPulso = 0;
    dedosBotao.clear(); direcional.dataset.dir = '';
    direcional.style.removeProperty('--analogico-x'); direcional.style.removeProperty('--analogico-y');
    recalcularToque();
  }
  addEventListener('blur', limparControles);
  document.addEventListener('visibilitychange', () => { if (document.hidden) limparControles(); });
  controles.addEventListener('contextmenu', (e) => e.preventDefault());

  // Os comandos chegam "virados" para quem está do lado direito? Não: direita é direita, como no fliperama.
  function lerBotoes() { const b = bitsToque | bitsTeclado | bitsPulso | estadosPads[0].bits | pulsosPads[0]; bitsPulso = pulsosPads[0] = 0; return b; }

  // ---------- Rede ----------
  const rede = { ws: null, aberto: false, outroAqui: false, rtt: 120, pings: {}, seq: 0, erro: '' };
  function conectar() {
    if (cfg.modo !== 'online') return;
    let ws;
    try { ws = new WebSocket(cfg.relay); }
    catch (e) { rede.erro = 'Sala online indisponível. Volte ao menu e tente novamente em instantes.'; atualizarSala(); return; }
    rede.ws = ws;
    ws.onopen = () => {
      rede.aberto = true; rede.erro = ''; atualizarSala(); enviar({ t: 'ola', apelido: cfg.eu, emLuta: !!luta });
      if (luta && luta.online) {
        // A internet piscou: pede o que pode ter se perdido e reenvia os próprios botões que o outro ainda pode precisar.
        enviar({ t: 'reenvia', de: luta.recebidoAte + 1 });
        for (let f = Math.max(0, luta.s.f - luta.atraso - 1); f < luta.minhas.length; f++) if (luta.minhas[f] !== undefined) enviar({ t: 'i', f, b: luta.minhas[f] });
      }
    };
    ws.onmessage = (m) => { const d = guarda(() => JSON.parse(m.data)); if (d) receber(d); };
    ws.onclose = () => { rede.aberto = false; rede.outroAqui = false; rede.erro = 'Sem conexão com o servidor de partidas. Tentando novamente…'; atualizarSala(); setTimeout(conectar, 1500); };
    ws.onerror = () => { rede.erro = 'Não foi possível conectar ao servidor de partidas. Tentando novamente…'; atualizarSala(); };
  }
  function enviar(d) {
    if (luta && ['i', 'h', 'reenvia', 'revanche'].includes(d.t)) d.n = luta.numero;
    if (rede.aberto && rede.ws.readyState === WebSocket.OPEN) rede.ws.send(JSON.stringify(d));
  }
  setInterval(() => {
    if (!rede.aberto) return;
    const agora = performance.now();
    for (const id in rede.pings) if (agora - rede.pings[id] > 10000) delete rede.pings[id];
    const id = ++rede.seq; rede.pings[id] = agora; enviar({ t: 'pi', id });
  }, 1000);

  const outro = cfg.lado === 'host' ? 'convidado' : 'host';
  const meuLado = cfg.lado === 'convidado' ? 1 : 0;
  const nomes = ['', ''];
  if (cfg.modo === 'online') { nomes[0] = cfg.host; nomes[1] = cfg.convidado || 'Convidado'; }

  const estadoSala = { minhaEscolha: null, escolhaDele: null, euPronto: false, elePronto: false, numero: cfg.proxima || 1, revanche: [false, false] };

  function receber(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return;
    if (['i', 'h', 'reenvia', 'revanche'].includes(d.t) && (!luta || d.n !== luta.numero)) return;
    switch (d.t) {
      case 'sala':
        rede.outroAqui = !!d[outro];
        if (rede.outroAqui) enviar({ t: 'ola', apelido: cfg.eu, emLuta: !!luta });
        if (!rede.outroAqui && luta && luta.online && luta.s.fase !== 'fim') luta.aviso = 'Seu amigo caiu. Esperando voltar…';
        atualizarSala();
        break;
      case 'ola':
        nomes[1 - meuLado] = String(d.apelido || '').slice(0, 16);
        // O outro recarregou a página no meio da luta: não dá para continuar de onde parou.
        if (luta && luta.online && !d.emLuta && luta.s.fase !== 'fim') { encerrarLuta(); estadoSala.euPronto = estadoSala.elePronto = false; telaEscolha('A luta foi interrompida. Bora de novo?'); }
        if (estadoSala.minhaEscolha) enviar({ t: 'escolha', l: estadoSala.minhaEscolha, pronto: estadoSala.euPronto });
        atualizarSala();
        break;
      case 'pi': enviar({ t: 'po', id: d.id }); break;
      case 'po': if (rede.pings[d.id]) { rede.rtt = rede.rtt * 0.7 + (performance.now() - rede.pings[d.id]) * 0.3; delete rede.pings[d.id]; } break;
      // Tudo que vem do outro celular é conferido antes de usar (um lutador ou cenário inválido travaria a luta).
      case 'escolha': if (prontos.includes(d.l)) { estadoSala.escolhaDele = d.l; estadoSala.elePronto = !!d.pronto; atualizarSala(); talvezComecar(); } break;
      case 'comecar':
        if (cfg.lado === 'convidado' && !luta && Number.isInteger(d.n) && d.n > 0 && d.n <= 100000 && prontos.includes(d.lh) && prontos.includes(d.lc) && cfg.cenarios.includes(d.c)) {
          comecarLuta({ n: d.n | 0, lh: d.lh, lc: d.lc, c: d.c, d: Math.max(1, Math.min(15, d.d | 0)) });
        }
        break;
      case 'i':
        if (luta && luta.online && Number.isInteger(d.f) && d.f >= luta.s.f && d.f < luta.s.f + 600 && Number.isInteger(d.b) && d.b >= 0 && d.b <= 255) {
          const entradas = luta.entradas[1 - meuLado];
          if (entradas[d.f] !== undefined && entradas[d.f] !== d.b) {
            luta.dessincronizou = true; luta.aviso = 'Comandos divergentes. Esta luta não contará no ranking.'; return;
          }
          entradas[d.f] = d.b;
          while (entradas[luta.recebidoAte + 1] !== undefined) luta.recebidoAte++;
        }
        break;
      case 'reenvia':
        if (luta && luta.online && Number.isInteger(d.de) && d.de >= 0 && d.de <= luta.minhas.length) {
          for (let f = d.de; f < Math.min(luta.minhas.length, d.de + 600); f++) if (luta.minhas[f] !== undefined) enviar({ t: 'i', f, b: luta.minhas[f] });
        }
        break;
      case 'h': if (luta && luta.online && Number.isInteger(d.f) && d.f >= Math.max(0, luta.s.f - 600) && d.f <= luta.s.f + 600 && Number.isInteger(d.h) && d.h >= 0 && d.h <= 0xffffffff) conferirHash(d.f, d.h, 1 - meuLado); break;
      case 'revanche': estadoSala.revanche[1 - meuLado] = true; atualizarFim(); break;
      default: break;
    }
  }

  function talvezComecar() {
    if (cfg.lado !== 'host' || !estadoSala.euPronto || !estadoSala.elePronto || luta) return;
    // Cenário muda a cada luta; atraso calculado pelo ping (metade do ida-e-volta, em quadros, com folga).
    const cenario = cfg.cenarios[(estadoSala.numero - 1 + hashCodigo(cfg.sala)) % cfg.cenarios.length];
    const atraso = Math.max(3, Math.min(12, Math.ceil(rede.rtt / 2 / PASSO_MS) + 2));
    const d = { t: 'comecar', n: estadoSala.numero, lh: estadoSala.minhaEscolha, lc: estadoSala.escolhaDele, c: cenario, d: atraso };
    enviar(d);
    comecarLuta(d);
  }
  const hashCodigo = (c) => [...(c || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0);

  // ---------- A luta ----------
  let luta = null;
  function comecarLuta(d) {
    document.body.classList.add('em-luta');
    limparControles();
    painel.innerHTML = ''; painel.className = 'painel';
    controles.hidden = false;
    A.limparAvisos();
    ultimoGrito[0] = ultimoGrito[1] = -999;
    const online = cfg.modo === 'online';
    const s = K.novo({ lutadores: [d.lh, d.lc], treino: cfg.modo === 'treino' });
    luta = {
      s, online, numero: d.n, cenario: d.c, atraso: d.d || 0, entradas: [[], []], minhas: [], recebidoAte: online ? d.d - 1 : -1,
      cpu: cfg.modo === 'cpu' ? KOCPU.criar(K, cfg.dificuldade) : null, dificuldade: cfg.dificuldade, sobra: 0, ultimo: performance.now(), hashes: {}, parado: 0, aviso: '', fimEm: 0,
    };
    if (online) for (let f = 0; f < luta.atraso; f++) { luta.entradas[0][f] = 0; luta.entradas[1][f] = 0; luta.minhas[f] = 0; }
    prepararGraficos(luta, [d.lh, d.lc], d.c);
    if (!online) { nomes[0] = cfg.eu; nomes[1] = versus ? 'Jogador 2' : cfg.modo === 'cpu' ? 'CPU · ' + KOCPU.PERFIS[cfg.dificuldade].nome : 'Boneco'; }
    modoJogo();
    tratarEventos(s.ev);
  }

  function encerrarLuta() { somArena?.pararVoz(); descartarGraficos(luta); luta = null; controles.hidden = true; document.body.classList.remove('em-luta'); limparControles(); }

  // ---------- Gráficos 3D ----------
  let r3d = null, painelGraficos = null;
  function fecharPainelGraficos() { painelGraficos?.remove(); painelGraficos = null; }
  function mostrarEstadoGraficos(partida, erro) {
    fecharPainelGraficos();
    painelGraficos = document.createElement('div');
    painelGraficos.className = 'painel painel-graficos';
    painelGraficos.setAttribute('aria-live', 'polite');
    painelGraficos.innerHTML = `<div class="cartao-fim">
      <h2>${erro ? 'O 3D não carregou' : 'Preparando a arena'}</h2>
      <p role="status">${erro ? 'Confira sua conexão e tente novamente para entrar na luta.' : 'Carregando o cenário e as lutadoras…'}</p>
      ${erro ? `<details><summary>Detalhes do erro</summary><p>${esc(erro.message || String(erro))}</p></details>
        <button class="botao" data-acao="tentar-3d">Tentar novamente</button>` : '<span class="carregando-3d" aria-hidden="true"></span>'}
      <a class="botao botao-sec" href="${cfg.inicio}">Voltar ao menu</a>
    </div>`;
    document.getElementById('jogo').appendChild(painelGraficos);
    painelGraficos.querySelector('[data-acao="tentar-3d"]')?.addEventListener('click', () => {
      if (luta !== partida) return;
      if (!window.KO3D) { location.reload(); return; }
      prepararGraficos(partida, partida.s.lutadores, partida.cenario);
    });
  }
  function descartarGraficos(partida) {
    const anterior = partida?.r3d || r3d;
    anterior?.descartar();
    if (partida) partida.r3d = null;
    if (r3d === anterior) r3d = null;
    fecharPainelGraficos();
    document.body.classList.remove('graficos-3d');
  }
  function prepararGraficos(partida, ids, cenario) {
    descartarGraficos(partida);
    const tentativa = partida.tentativa3d = {};
    partida.carregando3d = true; partida.erro3d = null; partida.aviso = '';
    controles.hidden = true;
    limparControles();
    mostrarEstadoGraficos(partida);
    const atual = () => luta === partida && partida.tentativa3d === tentativa;
    const falhar = (erro) => {
      if (!atual()) return;
      console.warn('K.O: falha nos gráficos 3D.', erro);
      descartarGraficos(partida);
      partida.carregando3d = false; partida.erro3d = erro; partida.sobra = 0;
      controles.hidden = true;
      window.KODiagnostico3D = { etapa: erro.etapa3d || 'inicialização', mensagem: erro.message || String(erro), data: new Date().toISOString() };
      mostrarEstadoGraficos(partida, erro);
    };
    // Canvas visível antes de criar o motor, para calcular a resolução correta.
    document.body.classList.add('graficos-3d');
    try {
      if (!window.KO3D) throw new Error('O arquivo dos gráficos 3D não carregou. Tente recarregar a página.');
      if (!tela3d || !KO3D.disponivel(ids)) throw new Error('O navegador não conseguiu iniciar os gráficos 3D. Feche outras abas e recarregue a página.');
      r3d = KO3D.criar(tela3d, { cenario, lutadores: ids, aoFalhar: falhar });
    } catch (erro) { falhar(erro); return; }
    partida.r3d = r3d;
    r3d.pronto.then(() => {
      if (!atual() || partida.erro3d) return;
      fecharPainelGraficos(); controles.hidden = false;
      window.KODiagnostico3D = null;
      partida.carregando3d = false; partida.aviso = ''; partida.ultimo = performance.now(); partida.sobra = 0;
      if (somLigado && partida.s.fase === 'intro') somArena?.locutor({ t: 'round', n: partida.s.round, final: partida.s.rounds.every(n => n === 1) });
    }, falhar);
  }

  function conferirHash(f, h, deQuem) {
    const reg = luta.hashes[f] || (luta.hashes[f] = {});
    reg[deQuem] = h;
    if (reg[0] !== undefined && reg[1] !== undefined && reg[0] !== reg[1]) {
      console.error('K.O: as duas lutas ficaram diferentes no quadro', f);
      luta.aviso = 'Conexão instável: a luta saiu de sincronia.';
      luta.dessincronizou = true;
    }
  }

  function tratarEventos(evs) {
    if (!evs.length) return;
    A.eventos(luta.s, evs, nomes);
    if (luta.r3d && !luta.carregando3d) luta.r3d.eventos(evs, luta.s);
    for (const e of evs) {
      if (somLigado) {
        if (!somArena?.evento(e) && SONS[e.t]) SONS[e.t](e);
        // O primeiro round só é anunciado depois de a arena ficar pronta.
        if (!(e.t === 'round' && (luta.carregando3d || luta.erro3d))) somArena?.locutor(e);
      }
      vozLutador(e);
      if (e.t === 'acerto' && (e.lado === meuLado || luta.s.p[meuLado].estado === 'dano') && e.forte) vibrar(e.forte * 20);
    }
  }

  function quadro(agora) {
    requestAnimationFrame(quadro);
    atualizarPads();
    if (!luta) return;
    luta.sobra += Math.min(250, agora - luta.ultimo);
    luta.ultimo = agora;
    let passos = 0;
    while (luta && luta.sobra >= PASSO_MS && passos < 8) {
      if (!avancar()) { luta.sobra = Math.min(luta.sobra, PASSO_MS * 2); break; }
      luta.sobra -= PASSO_MS; passos++;
    }
    if (!luta) return;
    const esperando = luta.aviso || (luta.parado > 30 ? 'Esperando o outro celular…' : '');
    const em3d = !!luta.r3d && !luta.carregando3d && !luta.erro3d;
    if (em3d) {
      luta.r3d.desenhar(luta.s);
      A.desenhar(luta.s, { nomes, esperando, somenteHud: true });
    } else canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (luta.s.fase === 'fim' && !luta.fimEm) { luta.fimEm = agora; fimDaLuta(); }
  }
  requestAnimationFrame(quadro);

  // Um quadro da luta. No online, só anda se os botões do outro para este quadro já chegaram.
  function avancar() {
    const s = luta.s;
    if (s.fase === 'fim') return false;
    if (luta.pausado) return false; // só pausa fora do online: lá a luta não para para um só
    if (luta.carregando3d || luta.erro3d || !luta.r3d) return false; // espera a arena 3D (o outro celular espera junto)
    if (!luta.online) {
      const meus = lerBotoes();
      const dele = versus ? estadosPads[1].bits | pulsosPads[1] : luta.cpu ? luta.cpu(s, 1) : 0;
      pulsosPads[1] = 0;
      K.passo(s, [meus, dele]);
      tratarEventos(s.ev);
      return true;
    }
    const f = s.f; // quadro que vamos rodar agora
    const alvo = f + luta.atraso;
    if (luta.minhas[alvo] === undefined) {
      const b = lerBotoes();
      luta.minhas[alvo] = b; luta.entradas[meuLado][alvo] = b;
      enviar({ t: 'i', f: alvo, b });
    }
    const dele = luta.entradas[1 - meuLado][f];
    if (dele === undefined) { luta.parado++; return false; }
    luta.parado = 0;
    if (rede.outroAqui && luta.aviso.startsWith('Seu amigo')) luta.aviso = '';
    const ent = meuLado === 0 ? [luta.entradas[0][f], dele] : [dele, luta.entradas[1][f]];
    K.passo(s, ent);
    tratarEventos(s.ev);
    if (s.f % 120 === 0) { const h = K.hash(s); conferirHash(s.f, h, meuLado); enviar({ t: 'h', f: s.f, h }); }
    return true;
  }

  // ---------- Fim da luta ----------
  const FRASES_VITORIA = {
    pipoca: 'Piscou? Já era!', uivo: 'A arena ouviu meu uivo!', maromba: 'Treino feito, vitória conquistada!',
    ginga: 'Na roda, quem manda é a ginga!', 'vo-nena': 'Respeita a experiência, meu filho!', 'vo-tiao': 'Ainda tenho muita história pra contar!',
    kira: 'Precisão em cada golpe.', toco: 'Madeira firme não cai fácil!', nix: 'Deslizando até a vitória!',
    eco: 'Essa vitória merece um grave!', volt: 'Vitória entregue!', kilo: 'O treino pesou a seu favor? Hoje não!',
    brasa: 'Missão cumprida!', mare: 'Peguei a onda certa!', truque: 'O segredo fica na cartola.', fossil: 'Experimento concluído com sucesso!',
  };
  async function fimDaLuta() {
    const partida = luta;
    partida.statusResultado = partida.dessincronizou ? 'Luta fora de sincronia: não conta no ranking.' : 'Confirmando resultado com seu amigo…';
    setTimeout(() => { if (luta === partida) atualizarFim(); }, 1500);
    if (partida.online && !partida.dessincronizou) await salvarResultado(partida);
  }

  async function salvarResultado(partida) {
    if (partida.salvando || partida.dessincronizou) return;
    partida.salvando = true;
    partida.statusResultado = 'Confirmando resultado com seu amigo…';
    if (luta === partida) atualizarFim();
    const s = partida.s;
    try {
      const token = document.querySelector('meta[name="csrf-token"]').content;
      const corpo = {
        numero: partida.numero, lutador_host: s.lutadores[0], lutador_convidado: s.lutadores[1], cenario: partida.cenario,
        vencedor: s.vencedor === 0 ? 'host' : 'convidado', rounds_host: s.rounds[0], rounds_convidado: s.rounds[1],
      };
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        if (partida.dessincronizou) break;
        const controller = new AbortController();
        const limite = setTimeout(() => controller.abort(), 6000);
        try {
          const r = await fetch(cfg.resultado, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': token }, body: JSON.stringify(corpo) });
          if (r.ok && (await r.json()).valeu === true) {
            partida.resultadoSalvo = true; partida.statusResultado = 'Resultado confirmado no ranking.'; return;
          }
          if ([401, 403, 419, 422].includes(r.status)) {
            partida.statusResultado = 'Não foi possível registrar. Volte ao menu e confira sua sessão.'; return;
          }
        } catch (e) { /* reconexão ou timeout: reenvio é idempotente */ }
        finally { clearTimeout(limite); }
        if (tentativa < 4) await new Promise((r) => setTimeout(r, 1500));
      }
      partida.statusResultado = partida.dessincronizou ? 'Luta fora de sincronia: não conta no ranking.' : 'Resultado pendente. Você pode tentar confirmar novamente.';
    } finally {
      partida.salvando = false;
      if (luta === partida) atualizarFim();
    }
  }

  function atualizarFim() {
    if (!luta || luta.s.fase !== 'fim' || !luta.fimEm) return;
    const venci = luta.s.vencedor === meuLado;
    const online = luta.online;
    const r = estadoSala.revanche;
    const idVencedor = luta.s.lutadores[luta.s.vencedor];
    const lutadorVencedor = cfg.lutadores[idVencedor];
    painel.className = 'painel painel-fim';
    painel.innerHTML = `
      <div class="cartao-fim cartao-vencedor">
        ${lutadorVencedor?.arte ? `<div class="vencedor-arte"><img src="/img/elenco/${esc(lutadorVencedor.arte)}" alt="${esc(lutadorVencedor.nome)}" data-vencedor="${esc(idVencedor)}"></div>` : ''}
        <div class="vencedor-conteudo">
        <p class="vencedor-selo">${lutadorVencedor ? 'VITÓRIA · ' + esc(lutadorVencedor.nome) : 'RESULTADO'}</p>
        <h2>${versus ? (luta.s.vencedor < 0 ? 'Empate!' : esc(nomes[luta.s.vencedor]) + ' venceu!') : venci ? 'Você venceu!' : (online ? 'Não foi dessa vez!' : 'O computador venceu!')}</h2>
        <p class="placar-fim">${esc(nomes[0])} <b>${luta.s.rounds[0]}</b> × <b>${luta.s.rounds[1]}</b> ${esc(nomes[1])}</p>
        ${FRASES_VITORIA[idVencedor] ? `<p class="vencedor-frase">“${esc(FRASES_VITORIA[idVencedor])}”</p>` : ''}
        ${online ? `<p class="dica" role="status">${esc(luta.statusResultado || '')}</p>` : ''}
        <div class="acoes">
          ${online && !luta.resultadoSalvo && !luta.salvando && !luta.dessincronizou ? '<button class="botao botao-sec" data-acao="confirmar">Confirmar resultado</button>' : ''}
          ${online ? `<button class="botao" data-acao="revanche" ${r[meuLado] ? 'disabled' : ''}>${r[meuLado] ? (r[1 - meuLado] ? 'Bora!' : 'Esperando o amigo…') : (r[1 - meuLado] ? 'Aceitar revanche!' : 'Revanche')}</button>`
            : `<button class="botao" data-acao="denovo">Jogar de novo</button><button class="botao botao-sec" data-acao="trocar">Trocar lutador</button>`}
          <a class="botao botao-sec" href="${cfg.inicio}">Sair</a>
        </div>
        </div>
      </div>`;
    painel.querySelector('[data-acao="revanche"]')?.addEventListener('click', () => { estadoSala.revanche[meuLado] = true; enviar({ t: 'revanche' }); atualizarFim(); });
    painel.querySelector('[data-acao="confirmar"]')?.addEventListener('click', () => salvarResultado(luta));
    painel.querySelector('[data-acao="denovo"]')?.addEventListener('click', () => comecarLocal(estadoSala.minhaEscolha));
    painel.querySelector('[data-acao="trocar"]')?.addEventListener('click', () => { encerrarLuta(); telaEscolha(); });
    if (online && r[0] && r[1]) {
      estadoSala.revanche = [false, false]; estadoSala.numero = luta.numero + 1;
      estadoSala.euPronto = estadoSala.elePronto = false;
      encerrarLuta();
      telaEscolha();
    }
  }

  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Telas de sala e escolha ----------
  function atualizarSala() {
    if (luta) return;
    if (cfg.modo === 'online' && !rede.outroAqui && !estadoSala.minhaEscolha) return telaEspera();
    if (painel.dataset.tela !== 'escolha') telaEscolha();
    else marcarEscolhas();
  }

  function telaEspera() {
    const mensagem = rede.erro || (rede.aberto ? 'Passa esse código para o seu amigo entrar.' : 'Conectando ao servidor de partidas…');
    const status = $('#conexao-sala');
    // Preserva os botões sob o dedo durante as tentativas de reconexão.
    if (painel.dataset.tela === 'espera' && status) { status.textContent = mensagem; return; }
    painel.dataset.tela = 'espera';
    painel.className = 'painel painel-espera';
    const link = location.origin + '/?sala=' + cfg.sala;
    painel.innerHTML = `
      <div class="cartao-espera">
        <p class="rotulo">Código da sala</p>
        <p class="codigo">${esc(cfg.sala)}</p>
        <p role="status" id="conexao-sala">${esc(mensagem)}</p>
        ${navigator.share ? '<button class="botao" data-acao="compartilhar">Mandar para o amigo</button>' : ''}
        <a class="botao botao-sec" href="${cfg.inicio}">Voltar</a>
      </div>`;
    painel.querySelector('[data-acao="compartilhar"]')?.addEventListener('click', () => guarda(() => navigator.share({ title: 'K.O', text: `Bora lutar no K.O! Entra na sala ${cfg.sala}`, url: link }).catch(() => {})));
  }

  const STATUS = {
    pipoca: { forca: 2, velocidade: 5, alcance: 4, estilo: 'Coelha boxeadora. Pula alto, pulo duplo e cenoura bumerangue.' },
    uivo: { forca: 4, velocidade: 3, alcance: 3, estilo: 'Lobo lutador. Investidas ferozes e um uivo que deixa tonto.' },
    maromba: { forca: 5, velocidade: 2, alcance: 3, estilo: 'Fisiculturista. Posando aguenta um golpe e fica mais forte; o Super cega com o brilho.' },
    ginga: { forca: 3, velocidade: 5, alcance: 4, estilo: 'Capoeirista. Rasteira que passa por baixo dos golpes e uma roda de aús no Super.' },
    'vo-nena': { forca: 3, velocidade: 2, alcance: 4, estilo: 'Vovó da bolsa pesada. Novelo de lã que rola no chão e enrola; Super de chineladas voadoras.' },
    'vo-tiao': { forca: 3, velocidade: 2, alcance: 5, estilo: 'Vovô da bengala. O gancho puxa o adversário de longe; no Super a dentadura voa e morde.' },
    kira: { forca: 3, velocidade: 5, alcance: 3, estilo: 'Kickboxer. Combos rápidos de chute e uma joelhada voadora; no Super, chuva de chutes girando.' },
    toco: { forca: 5, velocidade: 1, alcance: 5, estilo: 'Lenhador. Bate com o tronco, rola uma tora que derruba e no Super derruba uma árvore.' },
    nix: { forca: 2, velocidade: 5, alcance: 3, estilo: 'Patinadora. Desliza rente ao chão por baixo dos golpes; no Super congela o chão e o outro escorrega.' },
    eco: { forca: 3, velocidade: 3, alcance: 5, estilo: 'DJ. Ondas sonoras que empurram para longe; no Super o grave estoura e deixa tonto.' },
    truque: { forca: 3, velocidade: 4, alcance: 3, estilo: 'Mágico. Some na fumaça e aparece atrás do adversário; no Super uma cartola gigante prende.' },
    mare: { forca: 3, velocidade: 3, alcance: 5, estilo: 'Surfista. Prancha girando com alcance enorme; no Super uma onda gigante que não dá para pular.' },
    volt: { forca: 3, velocidade: 4, alcance: 4, estilo: 'Motoboy elétrico. Faísca em linha reta; no Super atravessa a tela de moto.' },
    kilo: { forca: 5, velocidade: 1, alcance: 2, estilo: 'Levantador de peso. Agarrão especial de longe que não dá para defender; no Super gira a barra.' },
    brasa: { forca: 3, velocidade: 4, alcance: 4, estilo: 'Bombeira. Espuma do extintor que deixa tonto; no Super a escada gira como hélice.' },
    fossil: { forca: 4, velocidade: 2, alcance: 4, estilo: 'Cientista. Defesa forte, braço robô que estica e morde; no Super vira um T-rex.' },
  };

  function telaEscolha(recado) {
    if (versus) primeiroLocal = null;
    painel.dataset.tela = 'escolha';
    painel.className = 'painel painel-escolha';
    const cartas = prontos.map((id) => {
      const l = cfg.lutadores[id];
      return `<button class="carta" data-id="${id}" aria-label="${esc(l.nome)}">
        <canvas width="480" height="600"></canvas>
        <span class="nome">${esc(l.nome)}</span>
      </button>`;
    }).join('');
    painel.innerHTML = `
      <div class="escolha">
        <header><h2>Escolha seu lutador</h2>${recado ? `<p class="recado">${esc(recado)}</p>` : ''}</header>
        ${cfg.modo === 'cpu' ? `<div class="dificuldade" role="group" aria-label="Dificuldade do computador">${Object.entries(KOCPU.PERFIS).map(([id, perfil]) => `<button type="button" class="botao botao-sec" data-nivel="${id}" aria-pressed="${cfg.dificuldade === id}">${perfil.nome}</button>`).join('')}</div>` : ''}
        <div class="grade">${cartas}</div>
        <footer>
          <div class="detalhe" id="detalhe"></div>
          <div class="lado-dele" id="ladoDele"></div>
          <button class="botao botao-grande" id="pronto" disabled>Pronto!</button>
          <button class="botao botao-sec" id="ajustar-controles">Configurar controles</button>
        </footer>
      </div>`;
    painel.querySelectorAll('.carta canvas').forEach((cv) => {
      const id = cv.closest('.carta').dataset.id, g = cv.getContext('2d');
      // O retrato 2D aparece na hora; quando existe, o retrato 3D do modelo o substitui.
      const desenho = A.retrato(id);
      if (desenho) g.drawImage(desenho, 0, 0, cv.width, cv.height);
      const foto = new Image();
      foto.onload = () => {
        if (!cv.isConnected) return;
        g.clearRect(0, 0, cv.width, cv.height); // o fundo do retrato 3D é transparente
        g.drawImage(foto, 0, 0, cv.width, cv.height);
      };
      foto.src = `/personagens/${id}-3d-retrato.png`;
    });
    painel.querySelectorAll('.carta:not(.bloqueada)').forEach((b) => b.addEventListener('click', () => {
      acordarAudio(); tom(660, 0.06, 'square', 0.08);
      if (estadoSala.euPronto) return;
      estadoSala.minhaEscolha = b.dataset.id;
      enviar({ t: 'escolha', l: b.dataset.id, pronto: false });
      marcarEscolhas();
    }));
    $('#pronto').addEventListener('click', () => {
      if (!estadoSala.minhaEscolha) return;
      modoJogo(); tom(880, 0.1, 'square', 0.1);
      if (versus) {
        if (!primeiroLocal) {
          primeiroLocal = estadoSala.minhaEscolha;
          estadoSala.minhaEscolha = null;
          marcarEscolhas();
          return;
        }
        if (estadosPads.some((p) => !p.conectado || !p.mapeado)) return;
      }
      if (cfg.modo !== 'online') return comecarLocal(estadoSala.minhaEscolha);
      estadoSala.euPronto = true;
      enviar({ t: 'escolha', l: estadoSala.minhaEscolha, pronto: true });
      marcarEscolhas(); talvezComecar();
    });
    $('#ajustar-controles').onclick = abrirControles;
    painel.querySelectorAll('[data-nivel]').forEach((b) => b.onclick = () => {
      cfg.dificuldade = b.dataset.nivel;
      guarda(() => localStorage.setItem('ko-dificuldade', cfg.dificuldade));
      painel.querySelectorAll('[data-nivel]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.nivel === cfg.dificuldade)));
    });
    marcarEscolhas();
  }

  function abrirControles() {
    const sobre = document.createElement('div');
    sobre.className = 'painel painel-controle';
    sobre.innerHTML = '<div class="cartao-fim"><h2>Controles</h2><p role="status"></p><p class="dica">Ligue os controles ao aparelho que está rodando o jogo e aperte um botão em cada um. Padrão: botão inferior confirma/chuta; esquerdo soca; superior defende; direito usa especial.</p><div class="acoes"><button class="botao" data-pad="0">Configurar jogador 1</button><button class="botao" data-pad="1">Configurar jogador 2</button><button class="botao botao-sec" data-fechar>Voltar</button></div></div>';
    document.getElementById('jogo').appendChild(sobre);
    sobre.querySelectorAll('[data-pad]').forEach((b) => b.onclick = () => pads.configurar(Number(b.dataset.pad)));
    sobre.querySelector('[data-fechar]').onclick = () => { pads.cancelar(); sobre.remove(); limparControles(); pulsosPads = [0, 0]; $('#ajustar-controles')?.focus(); };
  }

  function marcarEscolhas() {
    painel.querySelectorAll('.carta').forEach((b) => {
      b.classList.toggle('minha', b.dataset.id === estadoSala.minhaEscolha);
      b.classList.toggle('dele', b.dataset.id === estadoSala.escolhaDele);
    });
    const det = $('#detalhe'), st = STATUS[estadoSala.minhaEscolha];
    if (det) det.innerHTML = st ? `<strong>${esc(cfg.lutadores[estadoSala.minhaEscolha].nome)}</strong><span>${esc(st.estilo)}</span>
      <div class="barras">${['forca', 'velocidade', 'alcance'].map((k) => `<label>${{ forca: 'Força', velocidade: 'Velocidade', alcance: 'Alcance' }[k]}<i data-v="${st[k]}"></i></label>`).join('')}</div>` : '<span>Toque num lutador.</span>';
    const dele = $('#ladoDele');
    if (dele && cfg.modo === 'online') {
      const nome = nomes[1 - meuLado] || 'Amigo';
      dele.textContent = !rede.outroAqui ? `${nome} saiu da sala…` : estadoSala.elePronto ? `${nome} está pronto!` : estadoSala.escolhaDele ? `${nome} está escolhendo…` : `${nome} entrou!`;
    }
    const pronto = $('#pronto');
    if (pronto) {
      pronto.disabled = !estadoSala.minhaEscolha || estadoSala.euPronto || (cfg.modo === 'online' && !rede.outroAqui);
      pronto.textContent = estadoSala.euPronto ? 'Esperando o amigo…' : 'Pronto!';
      if (versus) pronto.textContent = primeiroLocal ? 'Jogador 2: pronto! (dois controles necessários)' : 'Jogador 1: confirmar lutador';
    }
  }

  function comecarLocal(meu) {
    estadoSala.minhaEscolha = meu;
    // Espelho em 3D: a adversária usa a variação vermelha do mesmo modelo.
    const dele = meu;
    const cenario = cfg.cenarios[(Math.random() * cfg.cenarios.length) | 0];
    estadoSala.numero++;
    comecarLuta({ n: estadoSala.numero, lh: versus ? primeiroLocal : meu, lc: dele, c: cenario, d: 0 });
  }

  // ---------- Menu de pausa ----------
  $('#pausa').addEventListener('click', () => {
    if (!luta || luta.carregando3d || luta.erro3d || luta.s.fase === 'fim' || document.querySelector('.painel-pausa')) return;
    const pausavel = !luta.online;
    if (pausavel) luta.pausado = true;
    const sobreposicao = document.createElement('div');
    sobreposicao.className = 'painel painel-pausa';
    sobreposicao.innerHTML = `<div class="cartao-fim"><h2>${pausavel ? 'Pausa' : 'Menu'}</h2>
      <div class="acoes"><button class="botao" data-acao="voltar">Voltar para a luta</button>
      <button class="botao botao-sec" data-acao="som">Som: ${somLigado ? 'ligado' : 'desligado'}</button>
      <a class="botao botao-sec" href="${cfg.inicio}">${luta.online ? 'Desistir e sair' : 'Sair'}</a></div>
      <p class="dica">Soco+chute juntos: esquiva · Defesa+especial no meio do combo dele: quebra-combo · Toque duplo para frente: corrida</p></div>`;
    document.getElementById('jogo').appendChild(sobreposicao);
    sobreposicao.querySelector('[data-acao="voltar"]').onclick = () => {
      if (versus && estadosPads.some((p) => !p.conectado || !p.mapeado)) return;
      sobreposicao.remove(); limparControles(); pulsosPads = [0, 0];
      if (luta) { luta.pausado = false; luta.aviso = ''; luta.ultimo = performance.now(); }
    };
    sobreposicao.querySelector('[data-acao="som"]').onclick = (e) => { somLigado = !somLigado; if (!somLigado) somArena?.pararVoz(); guarda(() => localStorage.setItem('ko-som', somLigado ? 'sim' : 'nao')); e.target.textContent = 'Som: ' + (somLigado ? 'ligado' : 'desligado'); };
  });

  // Para testes automáticos (endereço terminando em #teste): deixa ver e mexer na luta pelo console.
  if (location.hash === '#teste') window.KOTeste = { luta: () => luta, rede: () => rede };

  // ---------- Começo ----------
  if (cfg.modo === 'online') { conectar(); telaEspera(); } else telaEscolha();
})();
