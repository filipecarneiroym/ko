/* Lola: gravações humanas femininas locais (CC0). Reserva sintetizada para os demais. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KOVoz = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PERFIS = {
    pipoca: { hz: 370, vogal: [920, 1950, 3150], pitch: 1.85, esp: 'Hadouken!', sup: 'Salto da toca!', final: 'Hora do lanche!' },
    uivo: { hz: 105, vogal: [350, 650, 2400], pitch: 0.45, esp: 'Auu!', sup: 'Fúria da alcateia!', final: 'Lua cheia!' },
    maromba: { hz: 95, vogal: [650, 1100, 2500], pitch: 0.55, esp: 'Segura o músculo!', sup: 'Brilho de campeão!', final: 'Supino!' },
    ginga: { hz: 180, vogal: [500, 1900, 2600], pitch: 1.05, esp: 'Rasteira!', sup: 'Gira a roda!', final: 'Joga bonito!' },
    'vo-nena': { hz: 245, vogal: [450, 2100, 2900], pitch: 1.35, esp: 'Segura esse novelo!', sup: 'Chinelada!', final: 'Hora do tricô!' },
    'vo-tiao': { hz: 125, vogal: [500, 900, 2200], pitch: 0.7, esp: 'Chega mais!', sup: 'Morde, dentadura!', final: 'Respeita o vovô!' },
    kira: { hz: 265, vogal: [750, 1400, 2800], pitch: 1.4, esp: 'Joelhada!', sup: 'Tempestade de chutes!', final: 'Nocaute técnico!' },
    toco: { hz: 80, vogal: [700, 1000, 2300], pitch: 0.4, esp: 'Vai, tora!', sup: 'Madeira!', final: 'Escultura pronta!' },
    nix: { hz: 285, vogal: [300, 2300, 3100], pitch: 1.55, esp: 'Desliza!', sup: 'Pista congelada!', final: 'Congelou!' },
    eco: { hz: 145, vogal: [400, 800, 2500], pitch: 0.8, esp: 'Solta o som!', sup: 'Sente o grave!', final: 'Som nas alturas!' },
    truque: { hz: 200, vogal: [500, 1700, 2700], pitch: 1.15, esp: 'Cadê?', sup: 'Olha a cartola!', final: 'Sumiu!' },
    mare: { hz: 170, vogal: [600, 1200, 2500], pitch: 0.95, esp: 'Prancha na área!', sup: 'Onda gigante!', final: 'Tubo perfeito!' },
    volt: { hz: 220, vogal: [650, 1800, 2900], pitch: 1.2, esp: 'Faísca!', sup: 'Arrancada elétrica!', final: 'Choque total!' },
    kilo: { hz: 70, vogal: [600, 950, 2100], pitch: 0.3, esp: 'Vem pro supino!', sup: 'Peso pesado!', final: 'Mais uma série!' },
    brasa: { hz: 235, vogal: [700, 1500, 2700], pitch: 1.3, esp: 'Apaga essa!', sup: 'Escada giratória!', final: 'Banho de espuma!' },
    fossil: { hz: 115, vogal: [550, 1050, 2600], pitch: 0.6, esp: 'Mordida mecânica!', sup: 'Força do Tiranossauro!', final: 'Dino rugido!' },
  };

  const AMOSTRAS_LOLA = Object.freeze(Object.fromEntries(['ataque', 'dano', 'salto'].flatMap(tipo =>
    [1, 2, 3].map(i => [`${tipo}-${i}`, `/audio/lola/${tipo}-${i}.mp3`]))));
  const contextos = new WeakMap();
  function dadosDoContexto(ctx) {
    if (!contextos.has(ctx)) contextos.set(ctx, { buffers: new Map(), pedidos: new Map(), vozes: new Map(), eventos: new Map() });
    return contextos.get(ctx);
  }
  function preparar(ctx, saida) {
    if (!ctx || typeof ctx.decodeAudioData !== 'function') return Promise.resolve();
    const dados = dadosDoContexto(ctx);
    dados.saida = saida || dados.saida || ctx.destination;
    return Promise.all(Object.entries(AMOSTRAS_LOLA).map(([nome, url]) => {
      if (!dados.pedidos.has(nome)) dados.pedidos.set(nome, fetch(url).then(r => {
        if (!r.ok) throw new Error(`Voz da Lola indisponível: ${nome}`);
        return r.arrayBuffer();
      }).then(bytes => ctx.decodeAudioData(bytes)).then(buffer => dados.buffers.set(nome, buffer))
        .catch(erro => { dados.pedidos.delete(nome); throw erro; }));
      return dados.pedidos.get(nome);
    }));
  }
  function amostraDoEvento(e = {}, variacao = 0) {
    const numero = Math.abs(variacao | 0) % 3 + 1;
    if (e.t === 'acerto' || e.t === 'chao') return `dano-${numero}`;
    if (e.t === 'pulo') return `salto-${numero}`;
    if (['especial', 'ex', 'super', 'ultra', 'golpeFinal', 'agarrao'].includes(e.t)
      || /^(p2|k2|ck|foc|dp|tatsu)/.test(e.golpe || '')) return 'ataque-3';
    return `ataque-${numero}`;
  }
  function vozGravada(ctx, forte, variacao, evento) {
    const dados = dadosDoContexto(ctx), chave = amostraDoEvento(evento, variacao);
    const buffer = dados.buffers.get(chave);
    if (!buffer) return false; // nunca atrasar um grito esperando o download
    const lado = evento.lado === 1 ? 1 : 0, quadro = evento.quadro ?? variacao;
    // EX pode emitir ataque, especial e ex no mesmo passo: uma voz só.
    if (dados.eventos.get(lado) === quadro) return true;
    dados.eventos.set(lado, quadro);
    const anterior = dados.vozes.get(lado);
    if (anterior) {
      anterior.volume.gain.cancelScheduledValues(ctx.currentTime);
      anterior.volume.gain.setValueAtTime(anterior.volume.gain.value, ctx.currentTime);
      anterior.volume.gain.linearRampToValueAtTime(0, ctx.currentTime + .015);
      anterior.fonte.stop(ctx.currentTime + .02);
    }
    const fonte = ctx.createBufferSource(), volume = ctx.createGain();
    fonte.buffer = buffer; fonte.playbackRate.value = forte ? .97 : 1;
    volume.gain.value = forte ? .66 : .52;
    fonte.connect(volume); volume.connect(dados.saida || ctx.destination);
    const voz = { fonte, volume }; dados.vozes.set(lado, voz);
    fonte.onended = () => { fonte.disconnect(); volume.disconnect(); if (dados.vozes.get(lado) === voz) dados.vozes.delete(lado); };
    fonte.start();
    return true;
  }
  function parar(ctx) {
    const dados = contextos.get(ctx);
    if (!dados) return;
    for (const voz of dados.vozes.values()) { voz.volume.gain.setValueAtTime(0, ctx.currentTime); voz.fonte.stop(); }
    dados.vozes.clear(); dados.eventos.clear();
  }

  function grito(ctx, id, forte, variacao, evento = {}) {
    const perfil = PERFIS[id];
    if (!ctx || ctx.state !== 'running' || !perfil) return;
    if (id === 'pipoca' && vozGravada(ctx, forte, variacao, evento)) return;
    const inicio = ctx.currentTime, dur = forte ? 0.33 : 0.14;
    const fonte = ctx.createOscillator(), volume = ctx.createGain();
    const hz = perfil.hz * (variacao % 2 ? 1.12 : 0.95);
    fonte.type = 'sawtooth';
    fonte.frequency.setValueAtTime(hz * 1.25, inicio);
    fonte.frequency.exponentialRampToValueAtTime(hz * 0.7, inicio + dur);
    volume.gain.setValueAtTime(0.001, inicio);
    volume.gain.exponentialRampToValueAtTime(forte ? 0.12 : 0.075, inicio + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.001, inicio + dur);
    const filtros = perfil.vogal.map((freq, i) => {
      const filtro = ctx.createBiquadFilter(), nivel = ctx.createGain();
      filtro.type = 'bandpass'; filtro.frequency.value = freq; filtro.Q.value = 4;
      nivel.gain.value = 1 / (i + 1);
      fonte.connect(filtro); filtro.connect(nivel); nivel.connect(volume);
      return [filtro, nivel];
    });
    volume.connect(ctx.destination);
    fonte.onended = () => { fonte.disconnect(); volume.disconnect(); filtros.forEach(([f, n]) => { f.disconnect(); n.disconnect(); }); };
    fonte.start(inicio); fonte.stop(inicio + dur);
  }

  return { PERFIS, grito, preparar, parar, amostraDoEvento, AMOSTRAS_LOLA };
});
