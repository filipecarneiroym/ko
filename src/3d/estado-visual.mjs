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
    ...giros(lutador, simulador, golpe),
  };
}

// Só visual (como no SF4): mortal no pulo para frente/trás e volta inteira
// antes do chute forte. A regra (posição, caixas, tempo) não muda.
const suave = t => t * t * (3 - 2 * t);
function giros(l, simulador, golpe) {
  const dados = simulador.LUTADORES[l.id];
  let mortal = 0, volta = 0;
  if (l.estado === 'pulo' && l.vx && dados?.pulo) {
    // vy vai de +pulo (saída) a -pulo (pouso): o progresso não depende do FPS.
    const p = Math.max(0, Math.min(1, (dados.pulo - l.vy) / (2 * dados.pulo) / .85));
    mortal = -Math.sign(l.vx * l.face) * Math.PI * 2 * suave(p);
  }
  // Chute forte e rasteira (como a do SF4) dão a volta inteira antes de soltar a perna.
  const janela = golpe && (l.golpe === 'k2' || l.golpe === 'ck') && golpe.janelas?.[0];
  if (janela) volta = Math.PI * 2 * suave(Math.min(1, l.t / janela.de));
  return { mortal, volta };
}
export function quadroDoClip(pose, grupo) {
  const fps = grupo.targetedAnimations[0]?.animation.framePerSecond || 60;
  const decorrido = pose.quadro * fps / 60;
  const comprimento = grupo.to - grupo.from;
  return grupo.from + (pose.ciclico && comprimento > 0 ? decorrido % comprimento : Math.min(decorrido, comprimento));
}
