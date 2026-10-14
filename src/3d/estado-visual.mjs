// O relógio da animação vem da simulação: hitstop e FPS diferentes não mudam o golpe.
export const ESTADOS_VISUAIS = Object.freeze([
  'parado', 'andando', 'corrida', 'agachado', 'pulo', 'pousando', 'defesa', 'defesaBaixa',
  'dano', 'caido', 'levantando', 'rolando', 'recuo', 'quebra', 'agarrando', 'agarrado',
  'tonto', 'vitoria', 'derrotado', 'final', 'vitimaFinal',
]);
const CICLICOS = new Set(['parado', 'andando', 'corrida', 'agachado', 'defesa', 'defesaBaixa', 'tonto']);
export function descreverPose(lutador, simulador, estado = null) {
  const golpe = lutador.estado === 'golpe' && simulador.LUTADORES[lutador.id]?.golpes[lutador.golpe];
  // Segurar defesa reinicia p.t no motor a cada passo. O relógio da fase
  // mantém seu ciclo vivo e também fica congelado durante o hitstop.
  const usaRelogioDaFase = ['defesa', 'defesaBaixa'].includes(lutador.estado)
    || estado?.fase === 'final' && ['final', 'vitimaFinal'].includes(lutador.estado);
  const foco = golpe && lutador.golpe === 'foc';
  // Final da Lola: gesto do arremesso chamando a chuva (34 quadros) e comemoração.
  const chama = false; // sem chuva de cenouras: no Final a vencedora só comemora
  const fT = Math.max(0, estado?.fT ?? lutador.t);
  return {
    clip: foco ? 'foc' : lutador.estado === 'impulso' ? 'andando' : lutador.estado === 'colapso' ? 'dano'
      : chama ? (fT < 34 ? 'esp' : 'vitoria') : golpe ? lutador.golpe : lutador.estado,
    quadro: foco ? (lutador.focoSolto ? lutador.t : Math.min(12, (lutador.focoCarga || 0) / 2))
      : chama ? (fT < 34 ? fT : fT - 34)
      : Math.max(0, usaRelogioDaFase ? estado?.fT ?? lutador.t : lutador.t),
    ciclico: !golpe && CICLICOS.has(lutador.estado),
    duracao: golpe ? golpe.dur : null,
    x: (lutador.x / simulador.U - simulador.LARGURA / 2) / 24,
    y: lutador.y / simulador.U / 24,
    face: lutador.face,
    visivel: !lutador.sumido,
    ...giros(lutador, simulador, golpe),
  };
}

// Só visual: mortal no pulo para frente/trás. Os giros dos golpes pertencem
// aos seus clipes, sem uma volta extra aplicada ao corpo inteiro.
const suave = t => t * t * (3 - 2 * t);
function giros(l, simulador, golpe) {
  const dados = simulador.LUTADORES[l.id];
  let mortal = 0, volta = 0;
  if (l.estado === 'pulo' && l.vx && dados?.pulo) {
    // vy vai de +pulo (saída) a -pulo (pouso): o progresso não depende do FPS.
    const p = Math.max(0, Math.min(1, (dados.pulo - l.vy) / (2 * dados.pulo) / .85));
    mortal = -Math.sign(l.vx * l.face) * Math.PI * 2 * suave(p);
  }
  return { mortal, volta };
}
// Chuva de Cenouras (Final da Pipoca): 18 quedas a cada 6 quadros; cada uma
// cai por 36 quadros e bate no chão perto da vítima. Mesma conta de efeitos.js.
export function quedasDoFinal(estado, U, ligada = false) {
  if (!ligada) return []; // removida a pedido: o fim da luta não tem mais a chuva de cenouras
  const vencedor = estado?.p?.[estado.vencedor], vitima = estado?.p?.find(p => p.lado !== estado.vencedor);
  if (estado?.fase !== 'final' || vencedor?.id !== 'pipoca' || !vitima) return [];
  return Array.from({ length: 18 }, (_, i) => ({ i, x: vitima.x + ((i * 13) % 40 - 20) * U, idade: Math.max(0, estado.fT) - i * 6, contato: i * 6 + 36 }));
}

export function quadroDoClip(pose, grupo) {
  const fps = grupo.targetedAnimations[0]?.animation.framePerSecond || 60;
  const decorrido = pose.quadro * fps / 60;
  const comprimento = grupo.to - grupo.from;
  return grupo.from + (pose.ciclico && comprimento > 0 ? decorrido % comprimento : Math.min(decorrido, comprimento));
}
