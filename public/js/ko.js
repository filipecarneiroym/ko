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
  const prontos = Object.keys(cfg.lutadores).filter((id) => cfg.lutadores[id].pronto && K.LUTADORES[id]);
  const guarda = (f) => { try { return f(); } catch (e) { return null; } };

  A.iniciar(canvas);

  // ---------- Som (sintetizado na hora, sem arquivos) ----------
  let audio = null;
  let somLigado = guarda(() => localStorage.getItem('ko-som')) !== 'nao';
  function acordarAudio() {
    if (audio || !window.AudioContext) return;
    audio = new AudioContext();
  }
  function tom(freq, dur, tipo, vol, desliza) {
    if (!audio || !somLigado) return;
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = tipo || 'square'; o.frequency.setValueAtTime(freq, t);
    if (desliza) o.frequency.exponentialRampToValueAtTime(desliza, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
  }
  function ruido(dur, vol, filtro) {
    if (!audio || !somLigado) return;
    const n = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audio.createBufferSource(), g = audio.createGain(), f = audio.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filtro || 1800;
    src.buffer = buf; g.gain.value = vol || 0.3;
    src.connect(f).connect(g).connect(audio.destination); src.start();
  }
  const SONS = {
    acerto: (e) => { ruido(0.08 + e.forte * 0.05, 0.35 + e.forte * 0.1, 900 + e.forte * 500); tom(140 - e.forte * 30, 0.1, 'square', 0.12, 60); },
    defendeu: () => { tom(900, 0.05, 'square', 0.06); ruido(0.04, 0.12, 4000); },
    pulo: () => tom(300, 0.12, 'square', 0.04, 600),
    especial: () => tom(500, 0.25, 'sawtooth', 0.08, 1200),
    super: () => { tom(200, 0.6, 'sawtooth', 0.12, 1600); tom(300, 0.6, 'square', 0.06, 2400); },
    agarrao: () => ruido(0.15, 0.3, 600),
    chao: () => ruido(0.2, 0.35, 400),
    quebra: () => { tom(1200, 0.3, 'square', 0.1, 200); ruido(0.2, 0.3, 3000); },
    choque: () => ruido(0.12, 0.3, 5000),
    ko: () => { ruido(0.5, 0.5, 700); tom(110, 0.6, 'sawtooth', 0.15, 40); },
    golpeFinal: () => tom(220, 1.2, 'triangle', 0.12, 880),
  };

  // Locutor com a voz do próprio celular (pt-BR).
  function locutor(frase) {
    if (!somLigado || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(frase);
    u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 0.55; u.volume = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
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
    if (e.pointerId === dedoDir) { dedoDir = null; bitsDir = 0; direcional.dataset.dir = ''; }
    dedosBotao.delete(e.pointerId);
    recalcularToque();
  };
  controles.addEventListener('pointerup', soltar);
  controles.addEventListener('pointercancel', soltar);
  controles.addEventListener('contextmenu', (e) => e.preventDefault());

  // Os comandos chegam "virados" para quem está do lado direito? Não: direita é direita, como no fliperama.
  function lerBotoes() { const b = bitsToque | bitsTeclado | bitsPulso; bitsPulso = 0; return b; }

  // ---------- Computador (só no modo contra o CPU) ----------
  function cerebroCPU() {
    let fila = [], espera = 0, segura = 0;
    return function (s, lado) {
      const eu = s.p[lado], ele = s.p[1 - lado];
      if (s.fase !== 'luta') return 0;
      const dx = ele.x - eu.x, dist = Math.abs(dx) / K.U, frente = dx > 0 ? B.R : B.L, tras = dx > 0 ? B.L : B.R;
      if (fila.length) { const [b, n] = fila[0]; if (--fila[0][1] <= 0) fila.shift(); void n; return b; }
      if (espera > 0) { espera--; return segura; }
      const sorte = Math.random();
      // Quebra-combo de vez em quando.
      if (eu.estado === 'dano' && eu.combo >= 2 && eu.poder >= K.PODER_MAX / 2 && sorte < 0.25) return B.D_ | B.S;
      // Defende quando vê golpe vindo (não sempre: é para ser divertido).
      const vindo = (ele.estado === 'golpe' && dist < 70) || s.proj.some((p) => p.dono !== lado && Math.abs(p.x - eu.x) < 90 * K.U);
      if (vindo && sorte < 0.55) { espera = 10; segura = ele.golpe === 'ck' ? B.D_ | B.D : B.D_; return segura; }
      if (eu.poder >= K.PODER_MAX && dist < 90 && sorte < 0.5) { fila = [[B.S, 2]]; return 0; }
      if (dist > 110) {
        if (sorte < 0.04) { fila = [[B.S, 2]]; return 0; }
        if (sorte < 0.08) { fila = [[frente | B.U, 4], [0, 20], [B.K, 2]]; return 0; }
        espera = 8; segura = frente; return frente;
      }
      if (dist < 44) {
        const r = Math.random();
        if (r < 0.35) fila = [[B.P, 2], [0, 7], [B.P, 2], [0, 10], [B.K, 2], [0, 6], [B.S, 2], [0, 20]];
        else if (r < 0.5) fila = [[B.D | B.K, 3], [0, 20]];
        else if (r < 0.62) fila = [[frente | B.P, 2], [0, 20]];
        else if (r < 0.75) fila = [[B.D | B.P, 2], [B.D, 6], [B.D | B.P, 2], [0, 14]];
        else if (r < 0.85) { espera = 14; segura = tras; return tras; }
        else fila = [[B.U | tras, 4], [0, 24]];
        return 0;
      }
      espera = 6; segura = sorte < 0.75 ? frente : 0; return segura;
    };
  }

  // ---------- Rede ----------
  const rede = { ws: null, aberto: false, outroAqui: false, rtt: 120, pings: {}, seq: 0 };
  function conectar() {
    if (cfg.modo !== 'online') return;
    const ws = new WebSocket(cfg.relay);
    rede.ws = ws;
    ws.onopen = () => {
      rede.aberto = true; enviar({ t: 'ola', apelido: cfg.eu, emLuta: !!luta });
      if (luta && luta.online) {
        // A internet piscou: pede o que pode ter se perdido e reenvia os próprios botões que o outro ainda pode precisar.
        enviar({ t: 'reenvia', de: luta.recebidoAte + 1 });
        for (let f = Math.max(0, luta.s.f - luta.atraso - 1); f < luta.minhas.length; f++) if (luta.minhas[f] !== undefined) enviar({ t: 'i', f, b: luta.minhas[f] });
      }
    };
    ws.onmessage = (m) => { const d = guarda(() => JSON.parse(m.data)); if (d) receber(d); };
    ws.onclose = () => { rede.aberto = false; rede.outroAqui = false; atualizarSala(); setTimeout(conectar, 1500); };
  }
  function enviar(d) { if (rede.aberto) rede.ws.send(JSON.stringify(d)); }
  setInterval(() => { if (rede.aberto) { const id = ++rede.seq; rede.pings[id] = performance.now(); enviar({ t: 'pi', id }); } }, 1000);

  const outro = cfg.lado === 'host' ? 'convidado' : 'host';
  const meuLado = cfg.lado === 'convidado' ? 1 : 0;
  const nomes = ['', ''];
  if (cfg.modo === 'online') { nomes[0] = cfg.host; nomes[1] = cfg.convidado || 'Convidado'; }

  const estadoSala = { minhaEscolha: null, escolhaDele: null, euPronto: false, elePronto: false, numero: cfg.proxima || 1, revanche: [false, false] };

  function receber(d) {
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
        if (cfg.lado === 'convidado' && !luta && prontos.includes(d.lh) && prontos.includes(d.lc) && cfg.cenarios.includes(d.c)) {
          comecarLuta({ n: d.n | 0, lh: d.lh, lc: d.lc, c: d.c, d: Math.max(1, Math.min(15, d.d | 0)) });
        }
        break;
      case 'i':
        if (luta && luta.online && Number.isInteger(d.f) && d.f >= 0 && d.f < luta.s.f + 600) {
          luta.entradas[1 - meuLado][d.f] = d.b & 255; luta.recebidoAte = Math.max(luta.recebidoAte, d.f);
        }
        break;
      case 'reenvia': if (luta && luta.online) for (let f = d.de; f < luta.minhas.length; f++) if (luta.minhas[f] !== undefined) enviar({ t: 'i', f, b: luta.minhas[f] }); break;
      case 'h': if (luta && luta.online) conferirHash(d.f, d.h, 1 - meuLado); break;
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
    painel.innerHTML = ''; painel.className = 'painel';
    controles.hidden = false;
    A.limparAvisos();
    A.cenario(d.c);
    const online = cfg.modo === 'online';
    const s = K.novo({ lutadores: [d.lh, d.lc], treino: cfg.modo === 'treino' });
    luta = {
      s, online, numero: d.n, cenario: d.c, atraso: d.d || 0, entradas: [[], []], minhas: [], recebidoAte: -1,
      cpu: cfg.modo === 'cpu' ? cerebroCPU() : null, sobra: 0, ultimo: performance.now(), hashes: {}, parado: 0, aviso: '', fimEm: 0,
    };
    if (online) for (let f = 0; f < luta.atraso; f++) { luta.entradas[0][f] = 0; luta.entradas[1][f] = 0; luta.minhas[f] = 0; }
    if (!online) { nomes[0] = cfg.eu; nomes[1] = cfg.modo === 'cpu' ? 'CPU' : 'Boneco'; }
    modoJogo();
    tratarEventos(s.ev);
  }

  function encerrarLuta() { luta = null; controles.hidden = true; }

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
    for (const e of evs) {
      if (SONS[e.t]) SONS[e.t](e);
      if (e.t === 'acerto' && (e.lado === meuLado || luta.s.p[meuLado].estado === 'dano') && e.forte) vibrar(e.forte * 20);
      const fala = {
        round: e.final ? 'Round final!' : 'Round ' + e.n, lutem: 'Lutem!', ko: 'K.O.!', tempo: 'Tempo!', acaba: 'Acaba!',
        perfeito: 'Perfeito!', quebra: 'Quebra-combo!', golpeFinal: 'Golpe final!',
        vitoria: e.vencedor !== undefined ? nomes[e.vencedor] + ' venceu!' : null,
        combo: e.n === 4 ? 'Ótimo!' : e.n === 5 ? 'Brutal!' : e.n === 7 ? 'Insano!' : e.n === 10 ? 'Monstruoso!' : null,
      }[e.t];
      if (fala) locutor(fala);
    }
  }

  function quadro(agora) {
    requestAnimationFrame(quadro);
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
    A.desenhar(luta.s, { nomes, esperando });
    if (luta.s.fase === 'fim' && !luta.fimEm) { luta.fimEm = agora; fimDaLuta(); }
  }
  requestAnimationFrame(quadro);

  // Um quadro da luta. No online, só anda se os botões do outro para este quadro já chegaram.
  function avancar() {
    const s = luta.s;
    if (luta.pausado) return false; // só pausa fora do online: lá a luta não para para um só
    if (!luta.online) {
      const meus = lerBotoes();
      const dele = luta.cpu ? luta.cpu(s, 1) : 0;
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
  async function fimDaLuta() {
    const s = luta.s;
    if (luta.online && !luta.dessincronizou) {
      const token = document.querySelector('meta[name="csrf-token"]').content;
      const corpo = {
        numero: luta.numero, lutador_host: s.lutadores[0], lutador_convidado: s.lutadores[1], cenario: luta.cenario,
        vencedor: s.vencedor === 0 ? 'host' : 'convidado', rounds_host: s.rounds[0], rounds_convidado: s.rounds[1],
      };
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const ok = await fetch(cfg.resultado, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': token }, body: JSON.stringify(corpo) }).then((r) => r.ok).catch(() => false);
        if (ok) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    setTimeout(atualizarFim, 2500);
  }

  function atualizarFim() {
    if (!luta || luta.s.fase !== 'fim' || !luta.fimEm) return;
    const venci = luta.s.vencedor === meuLado;
    const online = luta.online;
    const r = estadoSala.revanche;
    painel.className = 'painel painel-fim';
    painel.innerHTML = `
      <div class="cartao-fim">
        <h2>${venci ? 'Você venceu!' : (online ? 'Não foi dessa vez!' : 'O computador venceu!')}</h2>
        <p class="placar-fim">${esc(nomes[0])} <b>${luta.s.rounds[0]}</b> × <b>${luta.s.rounds[1]}</b> ${esc(nomes[1])}</p>
        <div class="acoes">
          ${online ? `<button class="botao" data-acao="revanche" ${r[meuLado] ? 'disabled' : ''}>${r[meuLado] ? (r[1 - meuLado] ? 'Bora!' : 'Esperando o amigo…') : (r[1 - meuLado] ? 'Aceitar revanche!' : 'Revanche')}</button>`
            : `<button class="botao" data-acao="denovo">Jogar de novo</button><button class="botao botao-sec" data-acao="trocar">Trocar lutador</button>`}
          <a class="botao botao-sec" href="${cfg.inicio}">Sair</a>
        </div>
      </div>`;
    painel.querySelector('[data-acao="revanche"]')?.addEventListener('click', () => { estadoSala.revanche[meuLado] = true; enviar({ t: 'revanche' }); atualizarFim(); });
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
    painel.dataset.tela = 'espera';
    painel.className = 'painel painel-espera';
    const link = location.origin + '/?sala=' + cfg.sala;
    painel.innerHTML = `
      <div class="cartao-espera">
        <p class="rotulo">Código da sala</p>
        <p class="codigo">${esc(cfg.sala)}</p>
        <p>${rede.aberto ? 'Passa esse código para o seu amigo entrar.' : 'Conectando…'}</p>
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
    painel.dataset.tela = 'escolha';
    painel.className = 'painel painel-escolha';
    const cartas = Object.entries(cfg.lutadores).map(([id, l]) => {
      const ok = prontos.includes(id);
      return `<button class="carta ${ok ? '' : 'bloqueada'}" data-id="${id}" ${ok ? '' : 'disabled'} aria-label="${esc(l.nome)}${ok ? '' : ' (em breve)'}">
        ${ok ? '<canvas width="224" height="280"></canvas>' : '<span class="silhueta">?</span>'}
        <span class="nome">${esc(l.nome)}</span>${ok ? '' : '<span class="breve">em breve</span>'}
      </button>`;
    }).join('');
    painel.innerHTML = `
      <div class="escolha">
        <header><h2>Escolha seu lutador</h2>${recado ? `<p class="recado">${esc(recado)}</p>` : ''}</header>
        <div class="grade">${cartas}</div>
        <footer>
          <div class="detalhe" id="detalhe"></div>
          <div class="lado-dele" id="ladoDele"></div>
          <button class="botao botao-grande" id="pronto" disabled>Pronto!</button>
        </footer>
      </div>`;
    painel.querySelectorAll('.carta canvas').forEach((cv) => {
      const r = A.retrato(cv.closest('.carta').dataset.id), g = cv.getContext('2d');
      if (r) g.drawImage(r, 0, 0);
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
      if (cfg.modo !== 'online') return comecarLocal(estadoSala.minhaEscolha);
      estadoSala.euPronto = true;
      enviar({ t: 'escolha', l: estadoSala.minhaEscolha, pronto: true });
      marcarEscolhas(); talvezComecar();
    });
    marcarEscolhas();
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
    }
  }

  function comecarLocal(meu) {
    estadoSala.minhaEscolha = meu;
    const outros = prontos.filter((id) => id !== meu);
    const dele = cfg.modo === 'cpu' ? (outros.length ? outros[(Math.random() * outros.length) | 0] : meu) : meu;
    const cenario = cfg.cenarios[(Math.random() * cfg.cenarios.length) | 0];
    estadoSala.numero++;
    comecarLuta({ n: estadoSala.numero, lh: meu, lc: dele, c: cenario, d: 0 });
  }

  // ---------- Menu de pausa ----------
  $('#pausa').addEventListener('click', () => {
    if (!luta) return;
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
    sobreposicao.querySelector('[data-acao="voltar"]').onclick = () => { sobreposicao.remove(); if (luta) { luta.pausado = false; luta.ultimo = performance.now(); } };
    sobreposicao.querySelector('[data-acao="som"]').onclick = (e) => { somLigado = !somLigado; guarda(() => localStorage.setItem('ko-som', somLigado ? 'sim' : 'nao')); e.target.textContent = 'Som: ' + (somLigado ? 'ligado' : 'desligado'); };
  });

  // Para testes automáticos (endereço terminando em #teste): deixa ver e mexer na luta pelo console.
  if (location.hash === '#teste') window.KOTeste = { luta: () => luta };

  // ---------- Começo ----------
  if (cfg.modo === 'online') { conectar(); telaEspera(); } else telaEscolha();
})();
