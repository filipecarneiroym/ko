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
  return {
    clip: golpe ? lutador.golpe : lutador.estado,
    quadro: Math.max(0, usaRelogioDaFase ? estado?.fT ?? lutador.t : lutador.t),
    ciclico: !golpe && CICLICOS.has(lutador.estado),
    duracao: golpe ? golpe.dur : null,
    x: (lutador.x / simulador.U - simulador.LARGURA / 2) / 24,
    y: lutador.y / simulador.U / 24,
    face: lutador.face,
    visivel: !lutador.sumido,
  };
}
export function quadroDoClip(pose, grupo) {
  const fps = grupo.targetedAnimations[0]?.animation.framePerSecond || 60;
  const decorrido = pose.quadro * fps / 60;
  const comprimento = grupo.to - grupo.from;
  return grupo.from + (pose.ciclico && comprimento > 0 ? decorrido % comprimento : Math.min(decorrido, comprimento));
}
