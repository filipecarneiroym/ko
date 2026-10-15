/* Locutor masculino em arquivos locais e impactos originais em Web Audio. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KOSom = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FALAS = Object.freeze({
    'round-1': '/audio/locutor/round-1.mp3',
    'round-2': '/audio/locutor/round-2.mp3',
    'round-3': '/audio/locutor/round-3.mp3',
    'round-final': '/audio/locutor/round-final.mp3',
    lutem: '/audio/locutor/lutem.mp3',
    ko: '/audio/locutor/ko.mp3',
    perfeito: '/audio/locutor/perfeito.mp3',
    tempo: '/audio/locutor/tempo.mp3',
    empate: '/audio/locutor/empate.mp3',
  });
  // "<Lutador> venceu!": baixado só quando a luta acaba (um arquivo por lutador).
  const urlDaFala = id => FALAS[id] || (/^vitoria-[a-z-]+$/.test(id) ? '/audio/locutor/' + id + '.mp3' : null);

  function falaDoEvento(e) {
    if (!e || typeof e !== 'object') return null;
    if (e.t === 'round') return e.final ? 'round-final' : 'round-' + e.n;
    if (e.t === 'vitoria') return e.vencedor < 0 ? 'empate' : typeof e.lutador === 'string' ? 'vitoria-' + e.lutador : null;
    return ['lutem', 'ko', 'perfeito', 'tempo'].includes(e.t) ? e.t : null;
  }

  // Camadas: grave que desce, corpo filtrado e estalo curto. Os quatro
  // timbres por força já ficam em memória, sem download durante os golpes.
  function criarImpacto(ctx, forca, variante, defesa) {
    const duracao = defesa ? .16 : .19 + forca * .055;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duracao), ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    let estado = 7817 + variante * 1327 + forca * 7919, baixo = 0, anterior = 0, fase = 0, pico = 0;
    const ruido = () => { estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0; return estado / 2147483648 - 1; };
    const filtro = 1 - Math.exp(-2 * Math.PI * (defesa ? 1400 : 720 + forca * 140) / ctx.sampleRate);
    for (let i = 0; i < dados.length; i++) {
      const t = i / ctx.sampleRate, ataque = Math.min(1, t / .0007);
      const n = ruido(); baixo += filtro * (n - baixo);
      const agudo = n - anterior; anterior = n;
      const freq = (defesa ? 150 : 48) + (defesa ? 690 : 136 + forca * 28) * Math.exp(-t * (defesa ? 50 : 35));
      fase += 2 * Math.PI * freq / ctx.sampleRate;
      const grave = Math.sin(fase) * Math.exp(-t / (defesa ? .025 : .044 + forca * .014));
      const corpo = baixo * Math.exp(-t / (defesa ? .027 : .031 + forca * .009));
      const estalo = agudo * Math.exp(-t / (defesa ? .009 : .006 + forca * .002));
      const metal = defesa ? Math.sin(t * (2680 + variante * 71) * Math.PI * 2) * Math.exp(-t / .019) * .12 : 0;
      dados[i] = ataque * (grave * (defesa ? .22 : .48) + corpo * .75 + estalo * .23 + metal);
      pico = Math.max(pico, Math.abs(dados[i]));
    }
    const ganho = .88 / Math.max(.01, pico);
    for (let i = 0; i < dados.length; i++) dados[i] *= ganho;
    return buffer;
  }

  function criar(ctx) {
    if (!ctx || typeof ctx.createBuffer !== 'function') throw new Error('Contexto de áudio indisponível.');
    const saida = ctx.createGain(), limitador = ctx.createDynamicsCompressor(), teto = ctx.createWaveShaper();
    saida.gain.value = .84;
    limitador.threshold.value = -7; limitador.knee.value = 3; limitador.ratio.value = 12;
    limitador.attack.value = .002; limitador.release.value = .09;
    const curva = new Float32Array(4096);
    // Reserva margem também para a reconstrução do filtro de oversampling.
    for (let i = 0; i < curva.length; i++) curva[i] = .86 * Math.tanh((i * 2 / (curva.length - 1) - 1) * 1.1) / Math.tanh(1.1);
    teto.curve = curva; teto.oversample = '2x';
    saida.connect(limitador); limitador.connect(teto); teto.connect(ctx.destination);

    const impactos = [0, 1, 2].map(forca => [0, 1, 2, 3].map(v => criarImpacto(ctx, forca, v, false)));
    const defesas = [0, 1, 2, 3].map(v => criarImpacto(ctx, 0, v, true));
    const vozes = new Map();
    let preparacao = null, voz = null, pedidoVoz = 0, sequencia = 0;

    function preparar() {
      if (preparacao) return preparacao;
      preparacao = Promise.all(Object.keys(FALAS).map(carregar)).catch(erro => { preparacao = null; throw erro; });
      return preparacao;
    }

    // A fala anterior some em 80 ms (sem corte seco no eco de arena).
    function pararVoz() {
      pedidoVoz++;
      if (!voz) return;
      const { fonte, volume } = voz, agora = ctx.currentTime;
      volume.gain.setValueAtTime(volume.gain.value, agora);
      volume.gain.linearRampToValueAtTime(0, agora + .08);
      try { fonte.stop(agora + .09); } catch { /* A chamada já pode ter terminado. */ }
      voz = null;
    }

    async function carregar(id) {
      if (vozes.has(id)) return;
      const resposta = await fetch(urlDaFala(id), { credentials: 'same-origin', cache: 'no-cache' });
      if (!resposta.ok) throw new Error('Não foi possível carregar a voz do locutor (HTTP ' + resposta.status + ').');
      vozes.set(id, await ctx.decodeAudioData(await resposta.arrayBuffer()));
    }

    function reproduzirVoz(id, pedido) {
      if (pedido !== pedidoVoz || ctx.state !== 'running' || !vozes.has(id)) return;
      const fonte = ctx.createBufferSource(), volume = ctx.createGain();
      fonte.buffer = vozes.get(id); fonte.connect(volume); volume.connect(saida);
      const atual = { fonte, volume }; voz = atual;
      fonte.onended = () => { fonte.disconnect(); volume.disconnect(); if (voz === atual) voz = null; };
      fonte.start();
    }

    return {
      saida,
      preparar,
      pararVoz,
      locutor(e) {
        const id = falaDoEvento(e);
        if (!id || !urlDaFala(id)) return false;
        pararVoz();
        const pedido = pedidoVoz;
        if (vozes.has(id)) reproduzirVoz(id, pedido);
        else (FALAS[id] ? preparar() : carregar(id)).then(() => reproduzirVoz(id, pedido)).catch(erro => console.warn('K.O: locutor indisponível.', erro));
        return true;
      },
      evento(e) {
        if (!e || !['acerto', 'defendeu'].includes(e.t)) return false;
        if (ctx.state !== 'running') return true;
        const defesa = e.t === 'defendeu', forca = Math.max(0, Math.min(2, Number(e.forte) || 0)) | 0;
        const variante = sequencia++ % 4, fonte = ctx.createBufferSource(), volume = ctx.createGain();
        fonte.buffer = defesa ? defesas[variante] : impactos[forca][variante];
        fonte.playbackRate.value = [1, .96, 1.035, .985][variante];
        volume.gain.value = defesa ? .31 : [.47, .61, .75][forca];
        fonte.connect(volume); volume.connect(saida);
        fonte.onended = () => { fonte.disconnect(); volume.disconnect(); };
        fonte.start();
        return true;
      },
    };
  }

  return { criar };
});
