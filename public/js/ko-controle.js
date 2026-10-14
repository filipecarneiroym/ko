/* Gamepad API: dois jogadores independentes e mapeamento de controles reconhecidos pelo navegador. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KOControle = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ACOES = ['L', 'R', 'U', 'D', 'P', 'K', 'D_', 'S', 'menu'];
  // A ação D_ do controle (botão 3) agora é o Focus Attack (F, bit 1024); defender é segurar para trás.
  const BITS = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, D_: 1024, S: 128 };
  const botao = (indice) => ({ tipo: 'botao', indice });
  const eixo = (indice, sinal) => ({ tipo: 'eixo', indice, sinal });
  const PADRAO = {
    L: [botao(14), eixo(0, -1)], R: [botao(15), eixo(0, 1)],
    U: [botao(12), eixo(1, -1)], D: [botao(13), eixo(1, 1)],
    // Mesmo desenho do celular: especial em cima (Y), soco à esquerda (X), Focus à direita (B), chute embaixo (A).
    P: [botao(2)], K: [botao(0)], D_: [botao(1)], S: [botao(3)], menu: [botao(9)],
  };

  function pressionado(pad, comando) {
    if (!comando || !Number.isInteger(comando.indice) || comando.indice < 0 || comando.indice > 63) return false;
    if (comando.tipo === 'botao') return !!pad.buttons?.[comando.indice]?.pressed || (pad.buttons?.[comando.indice]?.value || 0) > 0.5;
    if (comando.tipo === 'eixo' && [-1, 1].includes(comando.sinal)) {
      const valor = pad.axes?.[comando.indice];
      return Number.isFinite(valor) && valor * comando.sinal > 0.35;
    }
    return false;
  }

  function mapaValido(mapa) {
    return !!mapa && ACOES.every((acao) => Array.isArray(mapa[acao]) && mapa[acao].length > 0 && mapa[acao].length <= 4 && mapa[acao].every((c) =>
      c && Number.isInteger(c.indice) && c.indice >= 0 && c.indice <= 63 &&
      (c.tipo === 'botao' || (c.tipo === 'eixo' && [-1, 1].includes(c.sinal)))));
  }

  function ler(pad, mapa) {
    const saida = { bits: 0, menu: false, confirmar: false, voltar: false, eixoX: 0 };
    if (!pad || pad.connected === false || !mapaValido(mapa)) return saida;
    for (const acao of ACOES) {
      const ativo = mapa[acao].some((c) => pressionado(pad, c));
      if (ativo && BITS[acao]) saida.bits |= BITS[acao];
      // Esquerda/direita pelo analógico: guarda quanto está inclinado (botão = 1).
      if (ativo && (acao === 'L' || acao === 'R')) {
        const forca = Math.max(...mapa[acao].map((c) => c.tipo === 'eixo' ? Math.abs(pad.axes?.[c.indice] || 0) : (pressionado(pad, c) ? 1 : 0)));
        saida.eixoX = (acao === 'R' ? 1 : -1) * forca;
        if (forca < 0.75) saida.bits |= 256; // leve: anda devagar
      }
      if (acao === 'menu') saida.menu = ativo;
    }
    saida.confirmar = !!(saida.bits & BITS.K);
    saida.voltar = !!(saida.bits & BITS.S);
    return saida;
  }

  function entradaAtiva(pad, limiar = 0.65) {
    const b = (pad.buttons || []).findIndex((v) => v.pressed || v.value > 0.5);
    if (b >= 0) return botao(b);
    const a = (pad.axes || []).findIndex((v) => Number.isFinite(v) && Math.abs(v) > limiar);
    return a >= 0 ? eixo(a, pad.axes[a] > 0 ? 1 : -1) : null;
  }

  function criar(opcoes = {}) {
    const obter = opcoes.obter || (() => navigator.getGamepads ? navigator.getGamepads() : []);
    const carregar = opcoes.carregar || (() => null), salvar = opcoes.salvar || (() => {});
    const slots = [null, null], mapas = new Map();
    let configuracao = null;
    function mapa(pad) {
      if (!mapas.has(pad.id)) {
        let guardado;
        try { guardado = carregar(pad.id); } catch (e) { guardado = null; }
        mapas.set(pad.id, mapaValido(guardado) ? guardado : (pad.mapping === 'standard' ? PADRAO : null));
      }
      return mapas.get(pad.id);
    }
    function atualizar() {
      let pads;
      try { pads = Array.from(obter() || []).filter((p) => p && p.connected !== false); } catch (e) { pads = []; }
      for (const pad of pads) {
        if (slots.some((s) => s && s.indice === pad.index && s.id === pad.id)) continue;
        const livre = slots.indexOf(null);
        if (livre >= 0 && entradaAtiva(pad)) slots[livre] = { indice: pad.index, id: pad.id, antes: { bits: 0 } };
      }
      return slots.map((slot, lado) => {
        const pad = slot && pads.find((p) => p.index === slot.indice && p.id === slot.id);
        const binding = pad ? mapa(pad) : null;
        const atual = ler(pad, configuracao?.lado === lado ? null : binding);
        const antes = slot?.antes || { bits: 0 };
        const estado = { ...atual, conectado: !!pad, mapeado: !!binding, id: slot?.id || '',
          pulso: atual.bits & ~antes.bits, menuClicado: atual.menu && !antes.menu,
          confirmarClicado: atual.confirmar && !antes.confirmar, voltarClicado: atual.voltar && !antes.voltar };
        if (slot) slot.antes = atual;
        if (configuracao?.lado === lado && pad) {
          const entrada = entradaAtiva(pad);
          if (!entrada) configuracao.neutro = true;
          else if (configuracao.neutro) {
            const repetido = Object.values(configuracao.mapa).some((lista) => JSON.stringify(lista[0]) === JSON.stringify(entrada));
            if (!repetido) {
              configuracao.mapa[ACOES[configuracao.passo++]] = [entrada];
              configuracao.neutro = false;
              if (configuracao.passo === ACOES.length) {
                mapas.set(pad.id, configuracao.mapa);
                try { salvar(pad.id, configuracao.mapa); } catch (e) { /* funciona nesta sessão mesmo sem armazenamento */ }
                configuracao = null;
              }
            }
          }
        }
        return estado;
      });
    }
    function configurar(lado) {
      if (!slots[lado]) return false;
      configuracao = { lado, passo: 0, neutro: false, mapa: {} };
      return true;
    }
    function cancelar() { configuracao = null; }
    function liberar(lado) { cancelar(); slots[lado] = null; }
    return { atualizar, configurar, cancelar, liberar, configuracao: () => configuracao };
  }

  // Navegação espacial: em uma grade, cima/baixo seguem a posição visual.
  function navegar(raiz, estado) {
    if (!raiz || !estado) return;
    const opcoes = [...raiz.querySelectorAll('button:not(:disabled), a[href], input:not([type="hidden"]):not(:disabled)')]
      .filter((el) => el.getClientRects().length && !el.closest('[hidden]'));
    if (!opcoes.length) return;
    const atual = raiz.ownerDocument.activeElement;
    let destino = opcoes.includes(atual) ? atual : null;
    const direcao = estado.pulso & (BITS.L | BITS.R | BITS.U | BITS.D);
    if (direcao) {
      if (!destino) destino = opcoes[0];
      else {
        const r = destino.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const horizontal = !!(direcao & (BITS.L | BITS.R));
        const sinal = direcao & (BITS.L | BITS.U) ? -1 : 1;
        let melhor = Infinity, candidata = null;
        for (const el of opcoes) {
          if (el === destino) continue;
          const b = el.getBoundingClientRect(), dx = b.left + b.width / 2 - x, dy = b.top + b.height / 2 - y;
          const frente = (horizontal ? dx : dy) * sinal, lateral = Math.abs(horizontal ? dy : dx);
          if (frente <= 2) continue;
          const peso = Math.hypot(dx, dy) + lateral * 2;
          if (peso < melhor) { melhor = peso; candidata = el; }
        }
        destino = candidata || destino;
      }
      destino.focus({ preventScroll: true });
      destino.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
    if (estado.confirmarClicado) {
      destino = destino || opcoes[0];
      destino.focus({ preventScroll: true });
      destino.click();
    }
  }

  return { ACOES, BITS, PADRAO, mapaValido, ler, criar, navegar };
});
