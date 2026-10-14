/*
 * K.O — motor da luta.
 *
 * Roda igualzinho nos dois celulares: recebe só os botões de cada quadro e chega no mesmo estado.
 * Por isso aqui é tudo número inteiro (nada de Math.random, Date ou ponto flutuante na regra),
 * e o desenho fica em ko-arte.js. Distâncias em "unidades": 16 unidades = 1 pixel da arena.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.KOSim = fabrica();
})(this, function () {
  'use strict';

  // ---------- Constantes ----------
  const U = 16;                       // unidades por pixel
  const LARGURA = 384;                // arena em pixels
  const PAREDE_E = 18 * U, PAREDE_D = (LARGURA - 18) * U;
  const SEPARACAO = 26 * U;           // distância mínima entre os corpos
  const ROUND_FRAMES = 99 * 60;
  const PODER_MAX = 1000;
  const BUFFER = 6;                   // quadros que um botão apertado fica "guardado"
  const INTRO = 100, FIM_ROUND = 150, JANELA_FINAL = 300, DURACAO_FINAL = 200;

  // Botões (um bit cada): esquerda, direita, cima, baixo, soco, chute, defesa, especial
  const B = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, D_: 64, S: 128 };
  const DEF = B.D_;

  // ---------- Elenco ----------
  // Caixas: [x à frente do corpo, y (negativo = para cima, a partir do pé), largura, altura] em pixels.
  // janelas: quadros em que o golpe acerta. cancel: o que dá para emendar se o golpe encostou.
  const P = (o) => Object.assign({ tipo: 'medio', bs: 10, hs: 16, empurra: 5 }, o);

  const LUTADORES = {
    pipoca: {
      nome: 'Lola', vida: 950, andar: 42, tras: 32, correr: 86, pulo: 150, puloX: 50, gravidade: 9, pulosAr: 1,
      altura: 60, golpes: {
        p1: { dur: 12, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 35, hs: 14, bs: 9, caixa: [6, -50, 24, 10] })] },
        p2: { dur: 18, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 50, hs: 17, bs: 11, caixa: [6, -48, 28, 12] })] },
        k1: { dur: 24, cancel: { S: 1 }, janelas: [P({ de: 6, ate: 8, dano: 30, hs: 15, caixa: [4, -30, 30, 12] }), P({ de: 12, ate: 14, dano: 35, hs: 18, caixa: [4, -30, 30, 12] })] },
        k2: { dur: 28, cancel: { S: 1 }, janelas: [P({ de: 7, ate: 10, dano: 60, hs: 22, caixa: [2, -46, 32, 18], lanca: [30, 100] })] },
        cp: { dur: 10, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 25, hs: 12, bs: 8, caixa: [6, -28, 22, 9] })] },
        ck: { dur: 26, janelas: [P({ de: 6, ate: 9, dano: 45, tipo: 'baixo', derruba: 1, caixa: [4, -10, 34, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 45, tipo: 'aereo', caixa: [4, -40, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 55, hs: 18, tipo: 'aereo', caixa: [2, -26, 28, 12] })] },
        // Cenoura bumerangue: vai, volta e acerta nas duas passadas.
        esp: { dur: 30, proj: { quadro: 10, tipo: 'cenoura', vx: 100, y: 48, w: 16, h: 8, vida: 110, volta: 30, dano: 55, hs: 20, bs: 14 } },
        // Toca: some no chão, anda por baixo e salta debaixo do adversário.
        sup: { dur: 62, inv: [0, 46], toca: [8, 42], janelas: [P({ de: 44, ate: 50, dano: 230, hs: 34, bs: 20, caixa: [-16, -86, 32, 86], lanca: [16, 190], derruba: 1 })] },
      },
    },
    uivo: {
      nome: 'Uivo', vida: 1050, andar: 34, tras: 26, correr: 100, pulo: 160, puloX: 46, gravidade: 10, pulosAr: 0,
      altura: 66, golpes: {
        p1: { dur: 14, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 45, hs: 15, caixa: [6, -54, 26, 12] })] },
        p2: { dur: 22, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 6, ate: 9, dano: 65, hs: 18, bs: 12, caixa: [6, -60, 30, 22] })] },
        k1: { dur: 24, cancel: { S: 1 }, janelas: [P({ de: 7, ate: 10, dano: 60, hs: 17, caixa: [4, -34, 34, 14] })] },
        k2: { dur: 32, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 12, dano: 80, hs: 24, bs: 14, caixa: [-8, -42, 46, 18], lanca: [40, 80] })] },
        cp: { dur: 12, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 30, hs: 12, bs: 8, caixa: [6, -30, 24, 10] })] },
        ck: { dur: 30, janelas: [P({ de: 7, ate: 10, dano: 55, tipo: 'baixo', derruba: 1, caixa: [4, -10, 38, 10] })] },
        ap: { dur: 22, janelas: [P({ de: 5, ate: 14, dano: 50, tipo: 'aereo', caixa: [4, -44, 24, 16] })] },
        ak: { dur: 24, janelas: [P({ de: 6, ate: 16, dano: 65, hs: 18, tipo: 'aereo', caixa: [0, -24, 30, 14] })] },
        // Uivo: onda de som curta que deixa o outro tonto (abre combo).
        esp: { dur: 40, janelas: [P({ de: 12, ate: 18, dano: 50, hs: 42, bs: 16, caixa: [0, -76, 66, 76], empurra: 2, tonto: 1 })] },
        // Três investidas de garra, a última arremessa.
        sup: {
          dur: 64, inv: [0, 8], mov: [[4, 13, 170], [18, 27, 170], [32, 41, 170]], janelas: [
            P({ de: 6, ate: 12, dano: 70, hs: 30, bs: 14, caixa: [0, -58, 40, 34] }),
            P({ de: 20, ate: 26, dano: 70, hs: 30, bs: 14, caixa: [0, -58, 40, 34] }),
            P({ de: 34, ate: 42, dano: 110, hs: 34, bs: 18, caixa: [0, -62, 42, 40], lanca: [36, 150], derruba: 1 }),
          ],
        },
      },
    },
    maromba: {
      nome: 'Maromba', vida: 1200, andar: 30, tras: 22, correr: 80, pulo: 145, puloX: 44, gravidade: 10, pulosAr: 0,
      altura: 70, golpes: {
        p1: { dur: 16, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 50, hs: 15, caixa: [6, -56, 28, 14] })] },
        p2: { dur: 26, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 8, ate: 11, dano: 80, hs: 20, bs: 13, caixa: [6, -58, 32, 20] })] },
        k1: { dur: 26, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 11, dano: 65, hs: 17, caixa: [4, -34, 34, 14] })] },
        k2: { dur: 34, cancel: { S: 1 }, janelas: [P({ de: 10, ate: 14, dano: 95, hs: 26, bs: 14, caixa: [2, -50, 40, 26], lanca: [44, 70] })] },
        cp: { dur: 14, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 35, hs: 12, bs: 8, caixa: [6, -30, 26, 10] })] },
        ck: { dur: 32, janelas: [P({ de: 8, ate: 11, dano: 65, tipo: 'baixo', derruba: 1, caixa: [4, -10, 40, 10] })] },
        ap: { dur: 22, janelas: [P({ de: 5, ate: 14, dano: 60, tipo: 'aereo', caixa: [4, -44, 26, 18] })] },
        ak: { dur: 24, janelas: [P({ de: 6, ate: 16, dano: 70, hs: 18, tipo: 'aereo', caixa: [0, -24, 32, 14] })] },
        // Pose de bíceps: aguenta um golpe sem recuar e, depois de posar, bate 30% mais forte por 4 segundos.
        esp: { dur: 40, armadura: [4, 32], forca: 240 },
        // Sequência de poses: o brilho cega (não dá para defender) e a ombrada arremessa.
        sup: {
          dur: 72, inv: [0, 20], mov: [[40, 54, 200]], janelas: [
            P({ de: 22, ate: 28, dano: 40, hs: 70, bs: 20, caixa: [0, -92, 110, 92], tonto: 1, empurra: 0, imparavel: 1 }),
            P({ de: 44, ate: 54, dano: 200, hs: 34, bs: 20, caixa: [0, -62, 44, 56], lanca: [50, 150], derruba: 1 }),
          ],
        },
      },
    },
    ginga: {
      nome: 'Ginga', vida: 950, andar: 40, tras: 36, correr: 92, pulo: 156, puloX: 52, gravidade: 9, pulosAr: 0,
      altura: 62, golpes: {
        p1: { dur: 12, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 30, hs: 14, bs: 9, caixa: [6, -50, 24, 10] })] },
        p2: { dur: 18, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 45, hs: 17, bs: 11, caixa: [6, -46, 26, 12] })] },
        k1: { dur: 24, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 6, ate: 9, dano: 50, hs: 17, caixa: [4, -40, 36, 14] })] },
        k2: { dur: 30, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 13, dano: 70, hs: 22, bs: 13, caixa: [-6, -58, 44, 22], lanca: [30, 90] })] },
        cp: { dur: 10, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 25, hs: 12, bs: 8, caixa: [6, -28, 22, 9] })] },
        ck: { dur: 26, janelas: [P({ de: 5, ate: 9, dano: 50, tipo: 'baixo', derruba: 1, caixa: [2, -10, 40, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 45, tipo: 'aereo', caixa: [4, -40, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 55, hs: 18, tipo: 'aereo', caixa: [0, -26, 32, 12] })] },
        // Rasteira giratória: abaixa tanto que golpes altos passam por cima, e derruba.
        esp: { dur: 34, corpoBaixo: 1, mov: [[2, 14, 90]], janelas: [P({ de: 8, ate: 14, dano: 60, hs: 22, tipo: 'baixo', derruba: 1, caixa: [-10, -14, 46, 14] })] },
        // Roda de capoeira: três aús rodando para cima do adversário e um martelo que arremessa.
        sup: {
          dur: 72, inv: [0, 10], mov: [[4, 14, 110], [22, 32, 110], [40, 50, 110]], janelas: [
            P({ de: 8, ate: 12, dano: 50, hs: 30, bs: 12, caixa: [-6, -60, 40, 56] }),
            P({ de: 26, ate: 30, dano: 50, hs: 30, bs: 12, caixa: [-6, -60, 40, 56] }),
            P({ de: 44, ate: 48, dano: 50, hs: 30, bs: 12, caixa: [-6, -60, 40, 56] }),
            P({ de: 58, ate: 64, dano: 130, hs: 34, bs: 18, caixa: [0, -66, 42, 40], lanca: [40, 150], derruba: 1 }),
          ],
        },
      },
    },
    'vo-nena': {
      nome: 'Vó Nena', vida: 950, andar: 30, tras: 26, correr: 70, pulo: 135, puloX: 40, gravidade: 9, pulosAr: 0,
      altura: 56, golpes: {
        p1: { dur: 14, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 35, hs: 14, bs: 9, caixa: [6, -44, 28, 12] })] },
        p2: { dur: 24, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 8, ate: 11, dano: 60, hs: 19, bs: 12, caixa: [2, -50, 36, 22] })] },
        k1: { dur: 22, cancel: { S: 1 }, janelas: [P({ de: 6, ate: 9, dano: 45, hs: 16, caixa: [4, -24, 30, 12] })] },
        k2: { dur: 32, cancel: { S: 1 }, janelas: [P({ de: 9, ate: 13, dano: 75, hs: 24, bs: 13, caixa: [0, -46, 40, 24], lanca: [36, 80] })] },
        cp: { dur: 12, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 28, hs: 12, bs: 8, caixa: [6, -24, 24, 9] })] },
        ck: { dur: 28, janelas: [P({ de: 6, ate: 9, dano: 50, tipo: 'baixo', derruba: 1, caixa: [4, -10, 38, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 45, tipo: 'aereo', caixa: [4, -38, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 50, hs: 18, tipo: 'aereo', caixa: [0, -24, 30, 12] })] },
        // Novelo de lã: rola pelo chão (tem que pular ou defender agachado) e enrola quem pega.
        esp: { dur: 34, proj: { quadro: 12, tipo: 'novelo', vx: 70, y: 7, w: 12, h: 12, vida: 120, dano: 45, hs: 54, bs: 14, tipoGolpe: 'baixo', enrola: 1 } },
        // Chuva de chineladas: quatro chinelos voando e uma bolsada final.
        sup: {
          dur: 70, inv: [0, 12], janelas: [
            ...[14, 22, 30, 38].map((de) => P({ de, ate: de + 3, dano: 30, hs: 26, bs: 12, caixa: [0, -60, 80, 56] })),
            P({ de: 48, ate: 54, dano: 110, hs: 30, bs: 18, caixa: [0, -60, 90, 56], lanca: [44, 120], derruba: 1 }),
          ],
        },
      },
    },
    'vo-tiao': {
      nome: 'Vô Tião', vida: 1000, andar: 28, tras: 24, correr: 68, pulo: 130, puloX: 38, gravidade: 9, pulosAr: 0,
      altura: 60, golpes: {
        p1: { dur: 16, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 40, hs: 15, bs: 9, caixa: [6, -40, 36, 8] })] },
        p2: { dur: 24, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 8, ate: 11, dano: 60, hs: 18, bs: 12, caixa: [4, -54, 40, 20] })] },
        k1: { dur: 24, cancel: { S: 1 }, janelas: [P({ de: 7, ate: 10, dano: 50, hs: 17, caixa: [4, -26, 32, 12] })] },
        k2: { dur: 32, cancel: { S: 1 }, janelas: [P({ de: 9, ate: 13, dano: 75, hs: 24, bs: 13, caixa: [-4, -50, 44, 26], lanca: [34, 80] })] },
        cp: { dur: 14, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 30, hs: 12, bs: 8, caixa: [6, -20, 34, 8] })] },
        ck: { dur: 30, janelas: [P({ de: 7, ate: 10, dano: 55, tipo: 'baixo', derruba: 1, caixa: [4, -8, 44, 8] })] },
        ap: { dur: 22, janelas: [P({ de: 5, ate: 14, dano: 45, tipo: 'aereo', caixa: [4, -40, 24, 14] })] },
        ak: { dur: 24, janelas: [P({ de: 6, ate: 16, dano: 55, hs: 18, tipo: 'aereo', caixa: [0, -24, 30, 12] })] },
        // Bengala-gancho: alcança longe e puxa o adversário para perto (abre combo).
        esp: { dur: 38, janelas: [P({ de: 12, ate: 16, dano: 40, hs: 34, bs: 12, caixa: [10, -56, 62, 20], puxa: 1, empurra: 0 })] },
        // Dentadura voadora: gruda no adversário e morde seis vezes.
        sup: { dur: 50, inv: [0, 14], proj: { quadro: 14, tipo: 'dentadura', vx: 80, y: 44, w: 16, h: 12, vida: 150, dano: 32, hs: 20, bs: 10, mordidas: 6, intervalo: 9 } },
      },
    },
    kira: {
      nome: 'Kira', vida: 950, andar: 42, tras: 34, correr: 96, pulo: 158, puloX: 50, gravidade: 10, pulosAr: 0,
      altura: 62, golpes: {
        p1: { dur: 11, cancel: { P: 'p2', K: 'k1', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 30, hs: 14, bs: 9, caixa: [6, -48, 24, 10] })] },
        p2: { dur: 18, cancel: { K: 'k1', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 45, hs: 17, bs: 11, caixa: [6, -48, 28, 12] })] },
        k1: { dur: 22, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 5, ate: 8, dano: 50, hs: 18, caixa: [4, -42, 36, 14] })] },
        k2: { dur: 30, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 12, dano: 75, hs: 24, bs: 13, caixa: [-2, -58, 42, 22], lanca: [32, 100] })] },
        cp: { dur: 10, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 25, hs: 12, bs: 8, caixa: [6, -28, 22, 9] })] },
        ck: { dur: 24, janelas: [P({ de: 5, ate: 8, dano: 50, tipo: 'baixo', derruba: 1, caixa: [2, -10, 38, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 45, tipo: 'aereo', caixa: [4, -40, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 60, hs: 18, tipo: 'aereo', caixa: [0, -26, 34, 12] })] },
        // Joelhada voadora: sobe para a frente acertando (boa contra quem pula).
        esp: { dur: 40, salta: [4, 60, 120], inv: [0, 6], janelas: [P({ de: 6, ate: 18, dano: 75, hs: 24, bs: 14, caixa: [4, -50, 26, 26], lanca: [30, 90] })] },
        // Chuva de chutes giratórios: sete chutes seguidos e um final que arremessa.
        sup: {
          dur: 76, inv: [0, 10], mov: [[4, 60, 36]], janelas: [
            ...[6, 14, 22, 30, 38, 46, 54].map((de) => P({ de, ate: de + 3, dano: 28, hs: 26, bs: 12, caixa: [0, -60, 42, 50] })),
            P({ de: 62, ate: 68, dano: 110, hs: 30, bs: 18, caixa: [0, -62, 44, 50], lanca: [44, 140], derruba: 1 }),
          ],
        },
      },
    },
    toco: {
      nome: 'Toco', vida: 1150, andar: 28, tras: 24, correr: 76, pulo: 140, puloX: 42, gravidade: 10, pulosAr: 0,
      altura: 70, golpes: {
        p1: { dur: 18, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 6, ate: 8, dano: 50, hs: 16, bs: 10, caixa: [6, -48, 40, 12] })] },
        p2: { dur: 28, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 10, ate: 13, dano: 85, hs: 21, bs: 14, caixa: [8, -70, 36, 40] })] },
        k1: { dur: 26, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 11, dano: 60, hs: 17, caixa: [4, -32, 34, 14] })] },
        k2: { dur: 36, cancel: { S: 1 }, janelas: [P({ de: 11, ate: 15, dano: 95, hs: 26, bs: 15, caixa: [-6, -56, 56, 30], lanca: [46, 80] })] },
        cp: { dur: 16, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 6, ate: 8, dano: 40, hs: 13, bs: 8, caixa: [6, -26, 36, 10] })] },
        ck: { dur: 32, janelas: [P({ de: 8, ate: 11, dano: 65, tipo: 'baixo', derruba: 1, caixa: [4, -10, 46, 10] })] },
        ap: { dur: 24, janelas: [P({ de: 6, ate: 15, dano: 60, tipo: 'aereo', caixa: [4, -46, 28, 18] })] },
        ak: { dur: 26, janelas: [P({ de: 7, ate: 17, dano: 70, hs: 18, tipo: 'aereo', caixa: [0, -26, 34, 14] })] },
        // Tora rolando: lenta, grande e derruba quem pega.
        esp: { dur: 40, proj: { quadro: 16, tipo: 'tora', vx: 56, y: 9, w: 26, h: 18, vida: 150, dano: 70, hs: 30, bs: 16, derruba: 1 } },
        // "Madeiraaa!": uma árvore cai na frente dele (defende só em pé).
        sup: { dur: 80, inv: [0, 24], janelas: [P({ de: 44, ate: 50, dano: 220, hs: 40, bs: 24, caixa: [30, -130, 130, 130], tipo: 'aereo', derruba: 1, empurra: 2 })] },
      },
    },
    nix: {
      nome: 'Nix', vida: 900, andar: 46, tras: 38, correr: 104, pulo: 160, puloX: 54, gravidade: 10, pulosAr: 0,
      altura: 62, golpes: {
        p1: { dur: 10, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 28, hs: 14, bs: 9, caixa: [6, -48, 24, 10] })] },
        p2: { dur: 16, cancel: { K: 'k1', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 40, hs: 17, bs: 11, caixa: [6, -46, 26, 12] })] },
        k1: { dur: 20, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 5, ate: 8, dano: 45, hs: 18, caixa: [4, -36, 36, 12] })] },
        k2: { dur: 28, cancel: { S: 1 }, janelas: [P({ de: 7, ate: 12, dano: 65, hs: 24, bs: 13, caixa: [-8, -56, 46, 24], lanca: [30, 100] })] },
        cp: { dur: 10, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 24, hs: 12, bs: 8, caixa: [6, -28, 22, 9] })] },
        ck: { dur: 24, janelas: [P({ de: 5, ate: 8, dano: 48, tipo: 'baixo', derruba: 1, caixa: [2, -10, 40, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 42, tipo: 'aereo', caixa: [4, -40, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 52, hs: 18, tipo: 'aereo', caixa: [0, -26, 32, 12] })] },
        // Deslize cortante: patina rente ao chão (passa por baixo de projéteis) e corta baixo, sem derrubar (dá para emendar).
        esp: { dur: 32, corpoBaixo: 1, mov: [[3, 18, 150]], janelas: [P({ de: 6, ate: 18, dano: 50, hs: 26, bs: 12, tipo: 'baixo', caixa: [4, -14, 30, 14] })] },
        // Pista de gelo: corte em volta que derruba e congela o chão por 7 segundos (o outro escorrega).
        sup: { dur: 50, inv: [0, 26], gelo: [20, 420], janelas: [P({ de: 20, ate: 26, dano: 120, hs: 40, bs: 20, tipo: 'baixo', derruba: 1, caixa: [-60, -16, 180, 16] })] },
      },
    },
    eco: {
      nome: 'Eco', vida: 980, andar: 34, tras: 30, correr: 84, pulo: 150, puloX: 46, gravidade: 10, pulosAr: 0,
      altura: 64, golpes: {
        p1: { dur: 14, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 38, hs: 15, bs: 9, caixa: [6, -50, 26, 12] })] },
        p2: { dur: 22, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 7, ate: 10, dano: 58, hs: 18, bs: 12, caixa: [6, -52, 30, 16] })] },
        k1: { dur: 24, cancel: { S: 1 }, janelas: [P({ de: 7, ate: 10, dano: 55, hs: 17, caixa: [4, -32, 36, 14] })] },
        k2: { dur: 30, cancel: { S: 1 }, janelas: [P({ de: 9, ate: 13, dano: 75, hs: 24, bs: 13, caixa: [-2, -52, 42, 22], lanca: [34, 80] })] },
        cp: { dur: 12, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 28, hs: 12, bs: 8, caixa: [6, -28, 24, 9] })] },
        ck: { dur: 28, janelas: [P({ de: 6, ate: 9, dano: 52, tipo: 'baixo', derruba: 1, caixa: [2, -10, 40, 10] })] },
        ap: { dur: 22, janelas: [P({ de: 5, ate: 14, dano: 45, tipo: 'aereo', caixa: [4, -42, 22, 14] })] },
        ak: { dur: 24, janelas: [P({ de: 6, ate: 16, dano: 55, hs: 18, tipo: 'aereo', caixa: [0, -26, 32, 12] })] },
        // Onda sonora: rápida, bate pouco e empurra para longe (luta de longe).
        esp: { dur: 30, proj: { quadro: 10, tipo: 'onda', vx: 112, y: 40, w: 14, h: 30, vida: 70, dano: 40, hs: 18, bs: 12, empurra: 14 } },
        // O grave estoura: explosão de som na frente que atordoa e machuca.
        sup: { dur: 60, inv: [0, 22], janelas: [P({ de: 24, ate: 30, dano: 160, hs: 60, bs: 22, caixa: [0, -92, 160, 92], tonto: 1, empurra: 10 })] },
      },
    },
    truque: {
      nome: 'Truque', vida: 930, andar: 38, tras: 34, correr: 90, pulo: 156, puloX: 50, gravidade: 9, pulosAr: 0,
      altura: 64, golpes: {
        p1: { dur: 12, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 32, hs: 14, bs: 9, caixa: [6, -50, 26, 10] })] },
        p2: { dur: 20, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 6, ate: 8, dano: 52, hs: 17, bs: 11, caixa: [6, -52, 34, 10] })] },
        k1: { dur: 22, cancel: { S: 1 }, janelas: [P({ de: 6, ate: 9, dano: 48, hs: 17, caixa: [4, -34, 32, 12] })] },
        k2: { dur: 30, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 12, dano: 72, hs: 24, bs: 13, caixa: [-2, -56, 40, 22], lanca: [32, 90] })] },
        cp: { dur: 11, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 26, hs: 12, bs: 8, caixa: [6, -28, 24, 9] })] },
        ck: { dur: 26, janelas: [P({ de: 6, ate: 9, dano: 50, tipo: 'baixo', derruba: 1, caixa: [2, -10, 40, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 44, tipo: 'aereo', caixa: [4, -40, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 54, hs: 18, tipo: 'aereo', caixa: [0, -26, 32, 12] })] },
        // Troca na fumaça: some e reaparece atrás do adversário, já acertando.
        esp: { dur: 30, inv: [0, 18], teleporta: 12, janelas: [P({ de: 18, ate: 21, dano: 40, hs: 20, bs: 10, caixa: [2, -50, 30, 20] })] },
        // Cartola gigante: cai do alto e prende o adversário (só defende em pé).
        sup: { dur: 70, inv: [0, 20], janelas: [P({ de: 24, ate: 30, dano: 130, hs: 80, bs: 24, caixa: [20, -110, 120, 110], tipo: 'aereo', prende: 'cartola', empurra: 0 })] },
      },
    },
    mare: {
      nome: 'Maré', vida: 1000, andar: 36, tras: 30, correr: 92, pulo: 150, puloX: 48, gravidade: 10, pulosAr: 0,
      altura: 66, golpes: {
        p1: { dur: 14, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 40, hs: 15, bs: 9, caixa: [6, -50, 30, 12] })] },
        p2: { dur: 24, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 8, ate: 11, dano: 62, hs: 19, bs: 12, caixa: [4, -56, 44, 24] })] },
        k1: { dur: 24, cancel: { S: 1 }, janelas: [P({ de: 7, ate: 10, dano: 55, hs: 17, caixa: [4, -34, 36, 14] })] },
        k2: { dur: 32, cancel: { S: 1 }, janelas: [P({ de: 9, ate: 13, dano: 78, hs: 24, bs: 13, caixa: [-4, -56, 48, 26], lanca: [36, 85] })] },
        cp: { dur: 12, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 28, hs: 12, bs: 8, caixa: [6, -28, 26, 9] })] },
        ck: { dur: 28, janelas: [P({ de: 7, ate: 10, dano: 55, tipo: 'baixo', derruba: 1, caixa: [4, -10, 46, 10] })] },
        ap: { dur: 22, janelas: [P({ de: 5, ate: 14, dano: 48, tipo: 'aereo', caixa: [4, -42, 26, 16] })] },
        ak: { dur: 24, janelas: [P({ de: 6, ate: 16, dano: 58, hs: 18, tipo: 'aereo', caixa: [0, -26, 34, 12] })] },
        // Prancha girando: acerta na frente e atrás, com alcance enorme.
        esp: { dur: 36, janelas: [P({ de: 8, ate: 16, dano: 70, hs: 24, bs: 14, caixa: [-30, -60, 90, 50], lanca: [40, 70], empurra: 8 })] },
        // Onda gigante: alta demais para pular; atravessa a tela e derruba.
        sup: { dur: 60, inv: [0, 20], proj: { quadro: 20, tipo: 'onda-gigante', vx: 60, y: 45, w: 44, h: 90, vida: 140, dano: 180, hs: 34, bs: 20, derruba: 1, empurra: 8 } },
      },
    },
    volt: {
      nome: 'Volt', vida: 980, andar: 38, tras: 32, correr: 100, pulo: 154, puloX: 50, gravidade: 10, pulosAr: 0,
      altura: 64, golpes: {
        p1: { dur: 12, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 34, hs: 14, bs: 9, caixa: [6, -50, 26, 10] })] },
        p2: { dur: 20, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 6, ate: 8, dano: 55, hs: 18, bs: 11, caixa: [6, -50, 30, 14] })] },
        k1: { dur: 22, cancel: { S: 1 }, janelas: [P({ de: 6, ate: 9, dano: 52, hs: 17, caixa: [4, -34, 34, 12] })] },
        k2: { dur: 30, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 12, dano: 74, hs: 24, bs: 13, caixa: [-2, -56, 42, 22], lanca: [34, 90] })] },
        cp: { dur: 11, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 27, hs: 12, bs: 8, caixa: [6, -28, 24, 9] })] },
        ck: { dur: 26, janelas: [P({ de: 6, ate: 9, dano: 52, tipo: 'baixo', derruba: 1, caixa: [2, -10, 40, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 45, tipo: 'aereo', caixa: [4, -40, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 55, hs: 18, tipo: 'aereo', caixa: [0, -26, 32, 12] })] },
        // Faísca: projétil elétrico rápido em linha reta.
        esp: { dur: 34, proj: { quadro: 11, tipo: 'faisca', vx: 96, y: 44, w: 18, h: 12, vida: 90, dano: 60, hs: 22, bs: 14 } },
        // Arrancada de moto: atravessa a tela acertando várias vezes.
        sup: {
          dur: 80, inv: [0, 70], mov: [[10, 60, 170]], janelas: [
            ...[14, 24, 34, 44, 54].map((de) => P({ de, ate: de + 4, dano: 40, hs: 26, bs: 12, caixa: [-10, -50, 50, 50] })),
            P({ de: 60, ate: 66, dano: 100, hs: 30, bs: 18, caixa: [-10, -56, 50, 56], lanca: [44, 140], derruba: 1 }),
          ],
        },
      },
    },
    kilo: {
      nome: 'Kilo', vida: 1250, andar: 26, tras: 22, correr: 70, pulo: 135, puloX: 40, gravidade: 11, pulosAr: 0,
      altura: 68, golpes: {
        p1: { dur: 18, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 55, hs: 16, bs: 10, caixa: [6, -50, 28, 14] })] },
        p2: { dur: 28, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 9, ate: 12, dano: 90, hs: 21, bs: 14, caixa: [6, -56, 32, 22] })] },
        k1: { dur: 28, cancel: { S: 1 }, janelas: [P({ de: 9, ate: 12, dano: 70, hs: 17, caixa: [4, -32, 34, 14] })] },
        k2: { dur: 36, cancel: { S: 1 }, janelas: [P({ de: 11, ate: 15, dano: 100, hs: 26, bs: 15, caixa: [2, -54, 42, 28], lanca: [46, 70] })] },
        cp: { dur: 16, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 6, ate: 8, dano: 40, hs: 13, bs: 8, caixa: [6, -28, 28, 10] })] },
        ck: { dur: 32, janelas: [P({ de: 8, ate: 11, dano: 70, tipo: 'baixo', derruba: 1, caixa: [4, -10, 40, 10] })] },
        ap: { dur: 24, janelas: [P({ de: 6, ate: 15, dano: 65, tipo: 'aereo', caixa: [4, -44, 28, 18] })] },
        ak: { dur: 26, janelas: [P({ de: 7, ate: 17, dano: 75, hs: 18, tipo: 'aereo', caixa: [0, -24, 34, 14] })] },
        // Agarrão de supino: agarra de mais longe que o agarrão normal e machuca muito (não dá para defender).
        esp: { dur: 40, agarra: { quadro: 8, alcance: 54, dano: 170 } },
        // Barra giratória: gira a barra em volta (acerta dos dois lados) e arremessa no fim.
        sup: {
          dur: 72, inv: [0, 20], janelas: [
            ...[14, 24, 34, 44].map((de) => P({ de, ate: de + 4, dano: 45, hs: 28, bs: 12, caixa: [-50, -70, 100, 60] })),
            P({ de: 54, ate: 60, dano: 120, hs: 30, bs: 18, caixa: [-50, -70, 100, 60], lanca: [50, 140], derruba: 1 }),
          ],
        },
      },
    },
    brasa: {
      nome: 'Brasa', vida: 1000, andar: 38, tras: 32, correr: 94, pulo: 152, puloX: 48, gravidade: 10, pulosAr: 0,
      altura: 64, golpes: {
        p1: { dur: 13, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 4, ate: 6, dano: 36, hs: 14, bs: 9, caixa: [6, -50, 26, 10] })] },
        p2: { dur: 22, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 7, ate: 10, dano: 60, hs: 18, bs: 12, caixa: [4, -58, 40, 22] })] },
        k1: { dur: 22, cancel: { S: 1 }, janelas: [P({ de: 6, ate: 9, dano: 52, hs: 17, caixa: [4, -34, 34, 12] })] },
        k2: { dur: 30, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 12, dano: 76, hs: 24, bs: 13, caixa: [-2, -56, 44, 24], lanca: [34, 90] })] },
        cp: { dur: 11, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 3, ate: 5, dano: 27, hs: 12, bs: 8, caixa: [6, -28, 24, 9] })] },
        ck: { dur: 26, janelas: [P({ de: 6, ate: 9, dano: 52, tipo: 'baixo', derruba: 1, caixa: [2, -10, 42, 10] })] },
        ap: { dur: 20, janelas: [P({ de: 4, ate: 14, dano: 46, tipo: 'aereo', caixa: [4, -40, 22, 14] })] },
        ak: { dur: 22, janelas: [P({ de: 5, ate: 16, dano: 56, hs: 18, tipo: 'aereo', caixa: [0, -26, 32, 12] })] },
        // Nuvem de extintor: espuma na cara que deixa tonto (abre combo).
        esp: { dur: 40, janelas: [P({ de: 10, ate: 22, dano: 35, hs: 46, bs: 14, caixa: [10, -64, 64, 60], tonto: 1, empurra: 2 })] },
        // Escada-hélice: gira a escada e avança acertando várias vezes.
        sup: {
          dur: 70, inv: [0, 12], mov: [[6, 56, 60]], janelas: [
            ...[8, 16, 24, 32, 40, 48].map((de) => P({ de, ate: de + 3, dano: 32, hs: 26, bs: 12, caixa: [-4, -68, 48, 60] })),
            P({ de: 56, ate: 62, dano: 110, hs: 30, bs: 18, caixa: [-4, -68, 50, 60], lanca: [44, 130], derruba: 1 }),
          ],
        },
      },
    },
    fossil: {
      nome: 'Fóssil', vida: 1100, andar: 30, tras: 26, correr: 78, pulo: 140, puloX: 42, gravidade: 10, pulosAr: 0,
      altura: 66, defesaForte: 1, golpes: {
        p1: { dur: 16, cancel: { P: 'p2', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 45, hs: 15, bs: 9, caixa: [6, -50, 32, 12] })] },
        p2: { dur: 26, cancel: { K: 'k2', S: 1 }, janelas: [P({ de: 9, ate: 12, dano: 72, hs: 20, bs: 13, caixa: [6, -56, 40, 22] })] },
        k1: { dur: 26, cancel: { S: 1 }, janelas: [P({ de: 8, ate: 11, dano: 60, hs: 17, caixa: [4, -32, 34, 14] })] },
        k2: { dur: 34, cancel: { S: 1 }, janelas: [P({ de: 10, ate: 14, dano: 85, hs: 25, bs: 14, caixa: [-2, -56, 46, 26], lanca: [40, 80] })] },
        cp: { dur: 14, cancel: { P: 'cp', K: 'ck', S: 1 }, janelas: [P({ de: 5, ate: 7, dano: 34, hs: 13, bs: 8, caixa: [6, -28, 28, 10] })] },
        ck: { dur: 30, janelas: [P({ de: 7, ate: 10, dano: 58, tipo: 'baixo', derruba: 1, caixa: [4, -10, 42, 10] })] },
        ap: { dur: 22, janelas: [P({ de: 5, ate: 14, dano: 50, tipo: 'aereo', caixa: [4, -42, 24, 16] })] },
        ak: { dur: 24, janelas: [P({ de: 6, ate: 16, dano: 60, hs: 18, tipo: 'aereo', caixa: [0, -26, 32, 12] })] },
        // Mordida mecânica: o braço robô estica e morde três vezes.
        esp: { dur: 40, janelas: [10, 16, 22].map((de) => P({ de, ate: de + 2, dano: 30, hs: 20, bs: 10, caixa: [8, -52, 64, 20], empurra: 1 })) },
        // Cabeça de T-rex: o braço vira um dinossauro, avança e esmaga.
        sup: { dur: 70, inv: [0, 24], mov: [[30, 44, 170]], janelas: [P({ de: 34, ate: 46, dano: 230, hs: 36, bs: 22, caixa: [0, -70, 54, 64], lanca: [50, 150], derruba: 1 })] },
      },
    },
  };
  // Agarrão (frente + soco colado): igual para todos, não dá para defender.
  const AGARRAO = { alcance: 36 * U, dano: 110, dur: 30 };

  // ---------- Criação ----------
  function lutadorNovo(id, lado) {
    const d = LUTADORES[id];
    return {
      id, lado, x: lado === 0 ? 112 * U : 272 * U, y: 0, vx: 0, vy: 0, face: lado === 0 ? 1 : -1,
      vida: d.vida, poder: 0, estado: 'parado', t: 0, golpe: null, encostou: 0, acertos: 0,
      stun: 0, combo: 0, juggle: 0, inv: 0, pulosAr: 0, empurrao: 0, sumido: 0, armadura: 0, forca: 0, enrolado: 0, prende: '', estrelas: 0,
      bAnt: 0, buf: { P: 0, K: 0, S: 0, B: 0, U: 0 }, quandoP: -99, quandoK: -99,
      toqueFrente: -99, toqueTras: -99, soltouFrente: 1, soltouTras: 1,
    };
  }

  function novo(cfg) {
    const s = {
      f: 0, fase: 'intro', fT: 0, round: 1, rounds: [0, 0], timer: ROUND_FRAMES, hitstop: 0,
      vencedorRound: -1, vencedor: -1, finalFeito: 0, lutadores: cfg.lutadores.slice(),
      p: [lutadorNovo(cfg.lutadores[0], 0), lutadorNovo(cfg.lutadores[1], 1)], proj: [], ev: [],
      treino: !!cfg.treino, gelo: { lado: -1, f: 0 },
    };
    s.ev.push({ t: 'round', n: 1 });
    return s;
  }

  function novoRound(s) {
    s.round++;
    s.p = [lutadorNovo(s.lutadores[0], 0), lutadorNovo(s.lutadores[1], 1)].map((n, i) => {
      n.poder = s.p[i].poder; // a barra de poder passa de um round para o outro, como no KOF
      return n;
    });
    s.proj = []; s.gelo = { lado: -1, f: 0 }; s.timer = ROUND_FRAMES; s.fase = 'intro'; s.fT = 0; s.hitstop = 0; s.vencedorRound = -1;
    s.ev.push({ t: 'round', n: s.round, final: s.rounds[0] === 1 && s.rounds[1] === 1 });
  }

  // ---------- Utilidades ----------
  const dados = (l) => LUTADORES[l.id];
  const noChao = (l) => l.y === 0;
  const temBit = (bits, b) => (bits & b) !== 0;
  function frenteBit(l) { return l.face === 1 ? B.R : B.L; }
  function trasBit(l) { return l.face === 1 ? B.L : B.R; }
  const livre = (l) => l.estado === 'parado' || l.estado === 'andando' || l.estado === 'agachado' || l.estado === 'corrida';

  function mudar(l, estado) { l.estado = estado; l.t = 0; }

  // No gelo da Nix, quem não é dono escorrega: a velocidade muda devagar (não dá para parar na hora).
  function vel(s, l, alvo) {
    if (s.gelo.f > 0 && s.gelo.lado !== l.lado && noChao(l)) { const d = alvo - l.vx; l.vx += d > 5 ? 5 : d < -5 ? -5 : d; }
    else l.vx = alvo;
  }

  function caixaHit(l, c) {
    // Caixa do golpe no mundo, espelhada conforme o lado para onde o lutador olha.
    const x0 = l.face === 1 ? l.x + c[0] * U : l.x - (c[0] + c[2]) * U;
    return { x: x0, y: l.y - (c[1] + c[3]) * U, w: c[2] * U, h: c[3] * U }; // y = base (de baixo para cima)
  }

  function corpo(l) {
    // Onde o lutador pode ser acertado.
    const g = l.estado === 'golpe' && l.golpe ? dados(l).golpes[l.golpe] : null;
    const alt = g && g.corpoBaixo ? 30 : l.estado === 'agachado' || l.estado === 'defesaBaixa' || (l.golpe && (l.golpe === 'cp' || l.golpe === 'ck'))
      ? 42 : (l.estado === 'pulo' ? 54 : dados(l).altura);
    return { x: l.x - 13 * U, y: l.y, w: 26 * U, h: alt * U };
  }

  const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // ---------- Entrada ----------
  function lerEntrada(s, l, bits) {
    const sobe = bits & ~l.bAnt;
    for (const [k, b] of [['P', B.P], ['K', B.K], ['S', B.S], ['B', DEF], ['U', B.U]]) {
      if (sobe & b) l.buf[k] = BUFFER;
      else if (l.buf[k] > 0 && s.hitstop === 0) l.buf[k]--;
    }
    if (sobe & B.P) l.quandoP = s.f;
    if (sobe & B.K) l.quandoK = s.f;
    // Toque duplo para frente = correr; para trás = recuo rápido.
    const fr = frenteBit(l), tr = trasBit(l);
    l.toqueDuploFrente = 0; l.toqueDuploTras = 0;
    if (sobe & fr) { if (s.f - l.toqueFrente <= 12 && l.soltouFrente) l.toqueDuploFrente = 1; l.toqueFrente = s.f; l.soltouFrente = 0; }
    if (!(bits & fr) && l.toqueFrente !== s.f) l.soltouFrente = 1;
    if (sobe & tr) { if (s.f - l.toqueTras <= 12 && l.soltouTras) l.toqueDuploTras = 1; l.toqueTras = s.f; l.soltouTras = 0; }
    if (!(bits & tr) && l.toqueTras !== s.f) l.soltouTras = 1;
    l.bAnt = bits;
  }

  function usar(l, k) { if (l.buf[k] > 0) { l.buf[k] = 0; return true; } return false; }

  function iniciarGolpe(s, l, nome) {
    l.golpe = nome; l.estado = 'golpe'; l.t = 0; l.encostou = 0; l.acertos = 0;
    if (nome !== 'esp' && nome !== 'sup') s.ev.push({ t: 'ataque', lado: l.lado, id: l.id, golpe: nome });
    if (nome === 'esp') s.ev.push({ t: 'especial', lado: l.lado, id: l.id });
    if (nome === 'sup') { l.poder = 0; s.ev.push({ t: 'super', lado: l.lado, id: l.id }); s.hitstop = 24; }
  }

  function tentarEspecial(s, l) {
    if (!usar(l, 'S')) return false;
    if (l.poder >= PODER_MAX) { iniciarGolpe(s, l, 'sup'); return true; }
    if (dados(l).golpes.esp.proj && s.proj.some((p) => p.dono === l.lado)) return false; // um projétil por vez
    iniciarGolpe(s, l, 'esp');
    return true;
  }

  // ---------- Decisão de cada lutador ----------
  function pensar(s, l, o, bits) {
    const d = dados(l);
    const fr = frenteBit(l), tr = trasBit(l);
    const segura = (b) => temBit(bits, b);

    // Quebra-combo (Killer Instinct): defesa + especial no meio do combo, gastando meia barra.
    if (l.estado === 'dano' && l.combo >= 2 && l.poder >= PODER_MAX / 2 && segura(DEF) && segura(B.S) && (l.buf.S || l.buf.B)) {
      l.buf.S = l.buf.B = 0; l.poder -= PODER_MAX / 2; l.stun = 0; l.combo = 0; l.inv = 20;
      mudar(l, 'quebra'); l.vx = -l.face * 40;
      if (o.estado === 'golpe' || o.estado === 'dano') { mudar(o, 'dano'); o.golpe = null; o.stun = 24; o.vx = -o.face * 70; }
      s.ev.push({ t: 'quebra', lado: l.lado });
      s.hitstop = 10;
      return;
    }

    if (l.estado === 'golpe') {
      // Cancelar no próximo golpe (combo) quando o golpe atual encostou.
      const g = d.golpes[l.golpe] || {};
      if (l.encostou && g.cancel) {
        if (g.cancel.S && l.buf.S && tentarEspecial(s, l)) return;
        for (const k of ['P', 'K']) if (g.cancel[k] && usar(l, k)) { iniciarGolpe(s, l, g.cancel[k]); return; }
      }
      // Esquiva (KOF) logo no comecinho de um soco/chute, para o "soco+chute" juntos funcionar.
      if (l.t <= 2 && (l.golpe === 'p1' || l.golpe === 'k1') && Math.abs(l.quandoP - l.quandoK) <= 3 && noChao(l)) {
        rolar(l); return;
      }
      return;
    }

    if (!noChao(l) && l.estado === 'pulo') {
      if (l.pulosAr > 0 && l.buf.U && l.t > 6) { // pulo duplo
        l.buf.U = 0; l.pulosAr--; l.vy = d.pulo - 20; l.t = 0;
        l.vx = segura(fr) ? l.face * d.puloX : segura(tr) ? -l.face * d.puloX : 0;
        s.ev.push({ t: 'pulo', lado: l.lado });
      } else if (!l.atacouNoAr && usar(l, 'K')) { l.atacouNoAr = 1; iniciarGolpe(s, l, 'ak'); l.estado = 'golpe'; }
      else if (!l.atacouNoAr && usar(l, 'P')) { l.atacouNoAr = 1; iniciarGolpe(s, l, 'ap'); }
      return;
    }

    if (!livre(l) && l.estado !== 'defesa' && l.estado !== 'defesaBaixa') return;

    // Esquiva rolando: soco + chute juntos.
    if ((l.buf.P || l.buf.K) && Math.abs(l.quandoP - l.quandoK) <= 3 && l.quandoP > s.f - BUFFER && l.quandoK > s.f - BUFFER) {
      l.buf.P = l.buf.K = 0; rolar(l); return;
    }
    if (tentarEspecial(s, l)) return;

    const agachado = segura(B.D);
    // Agarrão: frente + soco colado num adversário de pé.
    if (l.buf.P && segura(fr) && !agachado && Math.abs(o.x - l.x) <= AGARRAO.alcance && noChao(o) && livreParaAgarrar(o)) {
      l.buf.P = 0; agarrar(s, l, o); return;
    }
    if (usar(l, 'P')) { iniciarGolpe(s, l, agachado ? 'cp' : 'p1'); return; }
    if (usar(l, 'K')) { iniciarGolpe(s, l, agachado ? 'ck' : (l.estado === 'corrida' ? 'k2' : 'k1')); return; }

    if (segura(DEF)) {
      // O relógio do estado reinicia a cada quadro (como já era antes): a entrada e a
      // saída da guarda seguem as poses testadas.
      mudar(l, agachado ? 'defesaBaixa' : 'defesa');
      // Guarda em pé permite avançar/recuar a 60% da caminhada, sem correr. Agachado fica
      // no lugar e, durante o impacto na guarda, só vale o empurrão do golpe.
      const alvo = agachado || l.stun > 0 ? 0 : segura(fr) ? l.face * ((d.andar * 3 / 5) | 0) : segura(tr) ? -l.face * ((d.tras * 3 / 5) | 0) : 0;
      vel(s, l, alvo); return;
    }
    if (l.estado === 'defesa' || l.estado === 'defesaBaixa') mudar(l, 'parado');

    if (l.buf.U || segura(B.U)) {
      l.buf.U = 0;
      mudar(l, 'pulo'); l.vy = d.pulo; l.pulosAr = d.pulosAr; l.atacouNoAr = 0;
      l.vx = segura(fr) ? l.face * d.puloX : segura(tr) ? -l.face * d.puloX : 0;
      s.ev.push({ t: 'pulo', lado: l.lado });
      return;
    }
    if (agachado) { if (l.estado !== 'agachado') mudar(l, 'agachado'); vel(s, l, 0); return; }
    if (l.toqueDuploTras) { mudar(l, 'recuo'); l.inv = 8; l.vx = -l.face * 90; return; }
    if (segura(fr)) {
      if (l.toqueDuploFrente || l.estado === 'corrida') { if (l.estado !== 'corrida') mudar(l, 'corrida'); vel(s, l, l.face * d.correr); return; }
      if (l.estado !== 'andando') mudar(l, 'andando');
      vel(s, l, l.face * d.andar); return;
    }
    if (segura(tr)) { if (l.estado !== 'andando') mudar(l, 'andando'); vel(s, l, -l.face * d.tras); return; }
    if (l.estado !== 'parado') mudar(l, 'parado');
    vel(s, l, 0);
  }

  function livreParaAgarrar(o) {
    return o.inv === 0 && o.estado !== 'dano' && o.estado !== 'caido' && o.estado !== 'levantando' && o.estado !== 'rolando' && o.estado !== 'quebra';
  }

  function rolar(l) { mudar(l, 'rolando'); l.golpe = null; l.inv = 18; l.vx = l.face * 88; }

  function agarrar(s, l, o) {
    mudar(l, 'agarrando'); l.vx = 0;
    mudar(o, 'agarrado'); o.vx = 0; o.golpe = null;
    l.alvoAgarrao = 1;
    s.ev.push({ t: 'agarrao', lado: l.lado });
  }

  // ---------- Física e andamento dos estados ----------
  function andar(s, l, o) {
    const d = dados(l);
    l.t++;
    if (l.inv > 0) l.inv--;

    if (l.estado === 'golpe') {
      const g = d.golpes[l.golpe];
      if (g.mov) { l.vx = 0; for (const [de, ate, v] of g.mov) if (l.t >= de && l.t <= ate) l.vx = l.face * v; }
      if (g.inv && l.t >= g.inv[0] && l.t <= g.inv[1]) l.inv = Math.max(l.inv, 1);
      if (g.toca) {
        l.sumido = l.t >= g.toca[0] && l.t <= g.toca[1] ? 1 : 0;
        if (l.sumido) { const alvo = o.x - l.x; l.vx = alvo > 96 ? 96 : alvo < -96 ? -96 : alvo; }
        else if (l.t > g.toca[1]) l.vx = 0;
      }
      if (g.proj && l.t === g.proj.quadro) soltarProjetil(s, l, g.proj);
      if (g.teleporta && l.t === g.teleporta) {
        // Aparece atrás do adversário; se ele está colado na parede, aparece na frente mesmo.
        const lado = o.x >= l.x ? 1 : -1, destino = o.x + lado * 30 * U;
        l.x = destino < PAREDE_E || destino > PAREDE_D ? o.x - lado * 30 * U : destino;
        l.face = o.x >= l.x ? 1 : -1;
        s.ev.push({ t: 'fumaca', lado: l.lado, x: l.x });
      }
      if (g.agarra && l.t === g.agarra.quadro && Math.abs(o.x - l.x) <= g.agarra.alcance * U && noChao(o) && livreParaAgarrar(o)) {
        o.face = -l.face;
        receberDano(s, o, l, { dano: g.agarra.dano, hs: 30, derruba: 1, lanca: [-70, 110], tipo: 'agarrao', empurra: 0 }, 1);
        o.x = l.x - l.face * 20 * U;
        s.ev.push({ t: 'agarrao', lado: l.lado });
      }
      if (g.salta && l.t === g.salta[0]) { l.vx = l.face * g.salta[1]; l.vy = g.salta[2]; } // golpe que sai do chão
      if (g.armadura) { if (l.t === g.armadura[0]) l.armadura = 1; else if (l.t > g.armadura[1]) l.armadura = 0; }
      if (g.forca && l.t === g.dur) { l.forca = g.forca; s.ev.push({ t: 'forca', lado: l.lado }); }
      if (noChao(l) && l.vy <= 0 && !g.mov && !g.toca && l.golpe !== 'k2') vel(s, l, 0);
      if (g.gelo && l.t === g.gelo[0]) { s.gelo = { lado: l.lado, f: g.gelo[1] }; s.ev.push({ t: 'gelo', lado: l.lado }); }
      if (l.t >= g.dur) { l.golpe = null; l.sumido = 0; mudar(l, noChao(l) ? 'parado' : 'pulo'); l.vx = noChao(l) ? 0 : l.vx; }
    } else if (l.estado === 'agarrando') {
      if (l.t === 10) {
        // Joga o outro para trás de si e derruba.
        o.face = -l.face; o.inv = 0;
        receberDano(s, o, l, { dano: AGARRAO.dano, hs: 30, derruba: 1, lanca: [-60, 90], tipo: 'agarrao', empurra: 0 }, 0);
        o.x = l.x - l.face * 20 * U;
      }
      if (l.t >= AGARRAO.dur) mudar(l, 'parado');
    } else if (l.estado === 'agarrado') {
      // Fica preso até o agarrão terminar (receberDano tira daqui). Se quem agarrou apanhou no meio, solta.
      if (o.estado !== 'agarrando') mudar(l, 'parado');
    } else if (l.estado === 'rolando') {
      if (l.t >= 24) { mudar(l, 'parado'); l.vx = 0; } else if (l.t > 16) l.vx = 0;
    } else if (l.estado === 'recuo') {
      if (l.t >= 18) { mudar(l, 'parado'); l.vx = 0; }
    } else if (l.estado === 'dano' || l.estado === 'quebra') {
      if (noChao(l)) {
        if (l.stun > 0) l.stun--;
        if (l.estado === 'quebra' ? l.t >= 16 : l.stun === 0) { mudar(l, 'parado'); l.combo = 0; l.juggle = 0; }
      }
    } else if (l.estado === 'defesa' || l.estado === 'defesaBaixa') {
      if (l.stun > 0) l.stun--;
    } else if (l.estado === 'caido') {
      l.inv = 2;
      l.vx = 0; // nada de escorregar deitado: a queda para onde encostou
      if (l.t >= 46) { mudar(l, 'levantando'); }
    } else if (l.estado === 'levantando') {
      l.inv = 2;
      l.vx = 0;
      if (l.t >= 16) { mudar(l, 'parado'); l.combo = 0; l.juggle = 0; l.inv = 4; }
    } else if (l.estado === 'pousando') {
      if (l.t >= 4) mudar(l, 'parado');
    }

    // Empurrão de quem apanhou (diminui a cada quadro).
    if (l.empurrao !== 0) {
      l.x += l.empurrao;
      l.empurrao = l.empurrao > 0 ? Math.max(0, l.empurrao - 8) : Math.min(0, l.empurrao + 8);
    }

    // Movimento e gravidade.
    l.x += l.vx;
    if (!noChao(l) || l.vy > 0) {
      l.y += l.vy; l.vy -= d.gravidade;
      if (l.y <= 0) {
        l.y = 0; l.vy = 0;
        if (l.estado === 'dano' && (l.derrubado || l.combo > 0)) { mudar(l, l.vida > 0 ? 'caido' : 'derrotado'); l.vx = 0; l.derrubado = 0; s.ev.push({ t: 'chao', lado: l.lado }); }
        else if (l.estado === 'pulo' || l.estado === 'golpe') { l.golpe = null; mudar(l, 'pousando'); l.vx = 0; }
        else if (l.estado === 'dano') l.vx = 0;
      }
    }
    if (l.estado === 'corrida' || l.estado === 'rolando' || l.estado === 'recuo' || l.estado === 'quebra') {
      if (l.estado === 'quebra' && l.vx !== 0) l.vx = l.vx > 0 ? Math.max(0, l.vx - 4) : Math.min(0, l.vx + 4);
    }
  }

  function soltarProjetil(s, l, p) {
    s.proj.push({
      dono: l.lado, tipo: p.tipo, x: l.x + l.face * 18 * U, y: p.y * U, vx: l.face * p.vx, vida: p.vida, t: 0,
      volta: p.volta, w: p.w * U, h: p.h * U, dano: p.dano, hs: p.hs, bs: p.bs, acertou: 0, voltando: 0,
      tipoGolpe: p.tipoGolpe || 'medio', enrola: p.enrola || 0, derruba: p.derruba || 0, empurra: p.empurra || 4, mordidas: p.mordidas || 0, intervalo: p.intervalo || 0, colado: 0, espera: 0,
    });
  }

  // ---------- Acertos ----------
  function ativas(l) {
    if (l.estado !== 'golpe' || l.sumido) return [];
    const g = dados(l).golpes[l.golpe];
    if (!g.janelas) return [];
    return g.janelas.map((j, i) => [j, i]).filter(([j, i]) => l.t >= j.de && l.t <= j.ate && !(l.acertos & (1 << i)));
  }

  function defende(v, golpe) {
    if (golpe.tipo === 'agarrao' || golpe.imparavel) return false;
    if (v.estado === 'defesa') return golpe.tipo !== 'baixo';
    if (v.estado === 'defesaBaixa') return golpe.tipo !== 'aereo';
    return false;
  }

  function receberDano(s, v, a, golpe, especial, deX) {
    // deX: de onde veio o golpe (projétil voltando acerta pelas costas). Sem ele, vale a posição de quem bateu.
    const lado = a.lado;
    const dirDe = () => ((deX !== undefined ? deX : a.x) >= v.x ? 1 : -1);
    if (defende(v, golpe)) {
      const forte = dados(v).defesaForte; // Fóssil: defesa forte, sem raspão e recupera mais rápido
      const raspa = especial && !forte ? Math.max(1, (golpe.dano / 5) | 0) : 0; // especial "raspa" na defesa
      v.vida = Math.max(s.treino ? 1 : 0, v.vida - raspa);
      v.stun = forte ? (golpe.bs * 3) >> 2 : golpe.bs; v.empurrao = -dirDe() * golpe.empurra * 8; v.vx = 0;
      v.poder = Math.min(PODER_MAX, v.poder + ((golpe.dano / 2) | 0));
      a.poder = Math.min(PODER_MAX, a.poder + ((golpe.dano / 2) | 0));
      s.hitstop = Math.max(s.hitstop, 5);
      s.ev.push({ t: 'defendeu', lado: v.lado, x: v.x, y: v.y + 40 * U });
      return 'defesa';
    }
    // Pose do Maromba: aguenta o golpe (leva metade do dano) sem recuar.
    if (v.armadura > 0 && golpe.tipo !== 'agarrao') {
      v.armadura = 0;
      v.vida = Math.max(s.treino ? 1 : 0, v.vida - ((golpe.dano / 2) | 0));
      a.poder = Math.min(PODER_MAX, a.poder + ((golpe.dano / 2) | 0));
      s.hitstop = Math.max(s.hitstop, 8);
      s.ev.push({ t: 'armadura', lado: v.lado, x: v.x, y: v.y + 44 * U });
      return 'armadura';
    }
    // Combo: cada acerto seguido rende menos (sem isso um combo longo mata de uma vez).
    const noCombo = v.estado === 'dano' || v.estado === 'agarrado' || !noChao(v);
    v.combo = noCombo ? v.combo + 1 : 1;
    const escala = Math.max(40, 100 - 10 * Math.max(0, v.combo - 2));
    const base = a.forca > 0 ? ((golpe.dano * 130) / 100) | 0 : golpe.dano; // Maromba depois de posar
    const dano = Math.max(1, ((base * escala) / 100) | 0);
    v.vida = Math.max(s.treino ? 1 : 0, v.vida - dano);
    // Barra enche batendo e apanhando (quem apanha enche um pouco mais, para poder virar o jogo).
    a.poder = Math.min(PODER_MAX, a.poder + dano);
    v.poder = Math.min(PODER_MAX, v.poder + ((dano * 3) >> 1));
    v.golpe = null; v.sumido = 0; v.armadura = 0;
    mudar(v, 'dano');
    v.stun = Math.max(8, golpe.hs - 2 * Math.max(0, v.combo - 3));
    v.empurrao = -dirDe() * golpe.empurra * 8;

    const noAr = !noChao(v);
    if (golpe.lanca || noAr || v.vida === 0) {
      v.juggle++;
      const [lx, ly] = golpe.lanca || [24, 60];
      v.vx = -dirDe() * lx; v.vy = v.juggle > 3 ? 20 : ly; // depois de 3 no ar, cai logo
      v.y = Math.max(v.y, 1);
      v.derrubado = 1;
    }
    if (golpe.derruba) v.derrubado = 1;
    if (golpe.derruba && !golpe.lanca && noChao(v)) { mudar(v, 'caido'); v.vx = 0; }
    if (golpe.tonto) v.estrelas = 50;
    if (golpe.enrola || golpe.prende) { v.enrolado = golpe.hs; v.prende = golpe.prende || 'la'; } // lã da Vó Nena, cartola do Truque
    // Bengala do Vô Tião: puxa quem foi fisgado para colado nele.
    if (golpe.puxa) { v.x = a.x + a.face * 30 * U; v.empurrao = 0; v.vx = 0; }

    const forte = golpe.dano >= 80 ? 2 : golpe.dano >= 50 ? 1 : 0;
    s.hitstop = Math.max(s.hitstop, especial === 2 ? 14 : 6 + forte * 2);
    s.ev.push({ t: 'acerto', lado, forte, x: v.x, y: v.y + 40 * U, combo: v.combo, dano });
    if (v.combo >= 3) s.ev.push({ t: 'combo', lado, n: v.combo });
    return 'acerto';
  }

  function checarAcertos(s) {
    const [p0, p1] = s.p;
    const golpes = [];
    for (const [a, v] of [[p0, p1], [p1, p0]]) {
      for (const [j, i] of ativas(a)) {
        if (v.inv > 0 || v.sumido) continue;
        if (cruza(caixaHit(a, j.caixa), corpo(v))) golpes.push([a, v, j, i]);
      }
    }
    // Os dois golpes valem no mesmo quadro (troca de socos), por isso aplica depois de checar.
    for (const [a, v, j, i] of golpes) {
      a.acertos |= 1 << i; a.encostou = 1;
      receberDano(s, v, a, j, a.golpe === 'sup' ? 2 : a.golpe === 'esp' ? 1 : 0);
    }

    // Projéteis.
    for (const p of s.proj) {
      p.t++;
      const alvo = s.p[1 - p.dono];
      if (p.colado) { p.x = alvo.x; p.y = alvo.y + 44 * U; if (p.espera > 0) p.espera--; } // dentadura grudada mordendo
      else p.x += p.vx;
      if (p.volta && p.t === p.volta) { p.vx = -p.vx; p.voltando = 1; p.acertou = 0; }
      const dono = s.p[p.dono];
      if (p.voltando && Math.abs(p.x - dono.x) < 14 * U) p.vida = 0; // a cenoura voltou para a mão
      if (--p.vida <= 0 || p.x < 0 || p.x > LARGURA * U) { p.vida = 0; continue; }
      const v = s.p[1 - p.dono];
      const caixa = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
      if (!p.acertou && p.espera === 0 && v.inv === 0 && !v.sumido && (p.colado || cruza(caixa, corpo(v)))) {
        p.acertou = 1;
        const r = receberDano(s, v, dono, { dano: p.dano, hs: p.hs, bs: p.bs, tipo: p.tipoGolpe, empurra: p.colado ? 0 : p.empurra, enrola: p.enrola, derruba: p.derruba }, 1, p.x - p.vx * 4);
        if (p.mordidas > 1 && r === 'acerto') { p.mordidas--; p.colado = 1; p.espera = p.intervalo; p.acertou = 0; p.vida = Math.max(p.vida, 30); }
        else if (!p.volta) p.vida = 0;
      }
    }
    // Dois projéteis se encontrando se anulam.
    for (const a of s.proj) for (const b of s.proj) {
      if (a.dono === 0 && b.dono === 1 && a.vida > 0 && b.vida > 0 && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) {
        a.vida = b.vida = 0; s.ev.push({ t: 'choque', x: (a.x + b.x) >> 1, y: a.y });
      }
    }
    s.proj = s.proj.filter((p) => p.vida > 0);
  }

  // ---------- Empurra-empurra, paredes e lado ----------
  function separar(s) {
    const [a, b] = s.p;
    const atravessa = (l) => l.estado === 'rolando' || l.sumido || l.estado === 'caido' || l.estado === 'agarrado';
    if (!atravessa(a) && !atravessa(b) && Math.abs(a.y - b.y) < 50 * U) {
      const dx = b.x - a.x, dist = Math.abs(dx);
      if (dist < SEPARACAO) {
        const falta = SEPARACAO - dist, metade = (falta / 2) | 0;
        const dir = dx > 0 ? 1 : dx < 0 ? -1 : (a.lado === 0 ? 1 : -1);
        a.x -= dir * metade; b.x += dir * (falta - metade);
      }
    }
    const parede = (l) => { if (l.x < PAREDE_E) l.x = PAREDE_E; if (l.x > PAREDE_D) l.x = PAREDE_D; };
    parede(a); parede(b);
    // Encostado na parede, quem bateu (de perto) é que recua, como no Street Fighter.
    for (const [vit, atk] of [[a, b], [b, a]]) {
      if (vit.empurrao !== 0 && (vit.x === PAREDE_E || vit.x === PAREDE_D) && atk.estado === 'golpe' && Math.abs(atk.x - vit.x) < 80 * U) {
        atk.x += (vit.x === PAREDE_E ? 1 : -1) * ((Math.abs(vit.empurrao) / 2) | 0); vit.empurrao = 0;
        parede(atk);
      }
    }
    for (const [l, o] of [[a, b], [b, a]]) {
      if (noChao(l) && (livre(l) || l.estado === 'pousando' || l.estado === 'defesa' || l.estado === 'defesaBaixa')) {
        const nova = o.x >= l.x ? 1 : -1;
        if (o.x !== l.x) l.face = nova;
      }
    }
  }

  // ---------- Rounds, tempo e Golpe Final ----------
  function fimDeRound(s, vencedor, motivo) {
    s.fase = 'ko'; s.fT = 0; s.vencedorRound = vencedor;
    if (vencedor >= 0) s.rounds[vencedor]++;
    s.ev.push({ t: motivo, vencedor });
    const v = s.p[vencedor];
    if (v && v.vida === dados(v).vida) s.ev.push({ t: 'perfeito', vencedor });
    if (vencedor >= 0 && s.rounds[vencedor] === 2) {
      // Último round (Mortal Kombat): o perdedor fica tonto e dá para fazer o Golpe Final.
      s.vencedor = vencedor;
      const perdedor = s.p[1 - vencedor];
      perdedor.vida = Math.max(perdedor.vida, 0);
    }
  }

  function fases(s, entradas) {
    s.fT++;
    if (s.fase === 'intro') {
      if (s.fT === 60) s.ev.push({ t: 'lutem' });
      if (s.fT >= INTRO) { s.fase = 'luta'; s.fT = 0; }
      return false;
    }
    if (s.fase === 'ko') {
      if (s.fT >= 90 && s.vencedor >= 0 && s.p[s.vencedor].estado !== 'dano') {
        const perdedor = s.p[1 - s.vencedor];
        if (perdedor.estado === 'derrotado' || perdedor.estado === 'caido') mudar(perdedor, 'levantando');
        if (s.fT >= 110) {
          mudar(perdedor, 'tonto'); perdedor.inv = 0; perdedor.vx = 0;
          s.fase = 'acaba'; s.fT = 0; s.ev.push({ t: 'acaba' });
        }
        return true;
      }
      if (s.fT >= FIM_ROUND && s.vencedor < 0) novoRound(s);
      return true;
    }
    if (s.fase === 'acaba') {
      const v = s.p[s.vencedor], perd = s.p[1 - s.vencedor];
      // Golpe Final: especial colado no adversário tonto.
      if (temBit(entradas[s.vencedor], B.S) && !temBit(v.bAntFinal || 0, B.S) && Math.abs(v.x - perd.x) <= 110 * U && noChao(v)) {
        s.fase = 'final'; s.fT = 0; s.finalFeito = 1;
        mudar(v, 'final'); mudar(perd, 'vitimaFinal'); v.vx = 0;
        s.ev.push({ t: 'golpeFinal', lado: s.vencedor, id: v.id });
        return false;
      }
      v.bAntFinal = entradas[s.vencedor];
      if (s.fT >= JANELA_FINAL) { s.fase = 'fim'; s.fT = 0; mudar(v, 'vitoria'); s.ev.push({ t: 'vitoria', vencedor: s.vencedor }); }
      return true;
    }
    if (s.fase === 'final') {
      if (s.fT >= DURACAO_FINAL) { s.fase = 'fim'; s.fT = 0; mudar(s.p[s.vencedor], 'vitoria'); mudar(s.p[1 - s.vencedor], 'derrotado'); s.ev.push({ t: 'vitoria', vencedor: s.vencedor, final: 1 }); }
      return false;
    }
    if (s.fase === 'fim') return false;

    // Luta rolando.
    if (!s.treino && --s.timer <= 0) {
      s.timer = 0;
      const [a, b] = s.p;
      const pa = (a.vida * 1000 / dados(a).vida) | 0, pb = (b.vida * 1000 / dados(b).vida) | 0;
      fimDeRound(s, pa > pb ? 0 : pb > pa ? 1 : -1, 'tempo');
      // Round comum perdido no tempo: o perdedor cai de joelhos. No último, fica tonto para o Golpe Final.
      if (s.vencedor < 0 && s.vencedorRound >= 0) mudar(s.p[1 - s.vencedorRound], 'derrotado');
      return true;
    }
    return true;
  }

  function checarKO(s) {
    if (s.fase !== 'luta') return;
    const [a, b] = s.p;
    if (a.vida > 0 && b.vida > 0) return;
    const vencedor = a.vida === 0 && b.vida === 0 ? -1 : a.vida === 0 ? 1 : 0;
    fimDeRound(s, vencedor, 'ko');
    if (s.vencedor < 0) {
      // Round comum: quem perdeu cai de vez.
      for (const l of s.p) if (l.vida === 0 && noChao(l)) mudar(l, 'derrotado');
    }
    for (const l of s.p) if (l.vida > 0 && l.estado !== 'dano') { l.golpe = null; l.sumido = 0; mudar(l, noChao(l) ? 'parado' : 'pulo'); }
    s.hitstop = 30;
  }

  // ---------- Um quadro ----------
  function passo(s, entradas) {
    s.ev = [];
    s.f++;
    const [p0, p1] = s.p;
    lerEntrada(s, p0, entradas[0]);
    lerEntrada(s, p1, entradas[1]);
    if (s.hitstop > 0) { s.hitstop--; return s; }

    const podeAgir = fases(s, entradas);
    if (podeAgir && s.fase === 'luta') {
      pensar(s, p0, p1, entradas[0]);
      pensar(s, p1, p0, entradas[1]);
    }
    if (s.fase !== 'acaba' && s.fase !== 'final') {
      andar(s, p0, p1);
      andar(s, p1, p0);
    } else {
      for (const l of s.p) { l.t++; if (l.estado === 'vitimaFinal' || l.estado === 'final' || l.estado === 'tonto') continue; l.x += l.vx; }
    }
    if (s.fase === 'luta' || s.fase === 'ko') {
      if (s.fase === 'luta') checarAcertos(s);
      separar(s);
      checarKO(s);
    } else separar(s);
    if (s.gelo.f > 0 && s.fase === 'luta') s.gelo.f--;
    for (const l of s.p) { if (l.estrelas > 0) l.estrelas--; if (l.forca > 0) l.forca--; if (l.enrolado > 0) l.enrolado--; }
    return s;
  }

  // Impressão digital do estado: os dois celulares comparam de tempos em tempos.
  function hash(s) {
    let h = 2166136261;
    const mix = (n) => { h ^= n & 0xffffffff; h = Math.imul(h, 16777619) >>> 0; };
    // Inclui velocidades, buffers e estados completos: todos podem mudar o próximo quadro.
    const texto = JSON.stringify(s, (chave, valor) => chave === 'ev' ? undefined : valor);
    for (let i = 0; i < texto.length; i++) mix(texto.charCodeAt(i));
    return h;
  }

  return { U, LARGURA, B, LUTADORES, PODER_MAX, ROUND_FRAMES, novo, passo, hash, caixaHit, corpo };
});
