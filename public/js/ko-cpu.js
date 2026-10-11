/* O bot só produz comandos: não modifica vida, dano, velocidade ou estado da luta. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KOCPU = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PERFIS = {
    facil: { nome: 'Fácil', reacao: 22, defesa: 0.2, quebra: 0.05, combo: 0, super: 0.2 },
    medio: { nome: 'Médio', reacao: 12, defesa: 0.5, quebra: 0.2, combo: 0.35, super: 0.5 },
    dificil: { nome: 'Difícil', reacao: 6, defesa: 0.75, quebra: 0.45, combo: 0.65, super: 0.75 },
  };
  function criar(K, nivel = 'medio', aleatorio = Math.random) {
    const perfil = PERFIS[nivel] || PERFIS.medio, B = K.B;
    let fila = [], espera = 0, segura = 0, pensar = perfil.reacao;
    return function (s, lado) {
      if (s.fase !== 'luta') { fila = []; espera = segura = 0; pensar = perfil.reacao; return 0; }
      if (fila.length) { const b = fila[0][0]; if (--fila[0][1] <= 0) fila.shift(); return b; }
      if (espera > 0) { espera--; return segura; }
      if (--pensar > 0) return 0;
      pensar = perfil.reacao;
      const eu = s.p[lado], ele = s.p[1 - lado], dx = ele.x - eu.x, dist = Math.abs(dx) / K.U;
      const frente = dx > 0 ? B.R : B.L, tras = dx > 0 ? B.L : B.R, sorte = aleatorio();
      if (eu.estado === 'dano' && eu.combo >= 2 && eu.poder >= K.PODER_MAX / 2 && sorte < perfil.quebra) return B.D_ | B.S;
      const vindo = (ele.estado === 'golpe' && dist < 70) || s.proj.some((p) => p.dono !== lado && Math.abs(p.x - eu.x) < 90 * K.U);
      if (vindo && sorte < perfil.defesa) { espera = 10; segura = ele.golpe === 'ck' ? B.D_ | B.D : B.D_; return segura; }
      if (eu.poder >= K.PODER_MAX && dist < 90 && sorte < perfil.super) { fila = [[B.S, 2]]; return 0; }
      if (dist > 110) {
        if (sorte < 0.04) fila = [[B.S, 2]];
        else if (sorte < 0.08) fila = [[frente | B.U, 4], [0, 20], [B.K, 2]];
        else { espera = 8; segura = frente; return frente; }
        return 0;
      }
      if (dist < 44) {
        const r = aleatorio();
        if (r < perfil.combo) fila = [[B.P, 2], [0, 7], [B.P, 2], [0, 10], [B.K, 2], [0, 6], [B.S, 2], [0, 20]];
        else if (r < 0.72) fila = [[r < 0.4 ? B.P : B.D | B.K, 3], [0, 20]];
        else if (r < 0.88) { espera = 14; segura = tras; return tras; }
        else fila = [[B.U | tras, 4], [0, 24]];
        return 0;
      }
      espera = 6; segura = sorte < 0.75 ? frente : 0; return segura;
    };
  }
  return { PERFIS, criar };
});
