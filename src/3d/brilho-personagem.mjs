// Estados visuais do corpo: somente leitura, no relógio de 60 passos do motor.
export function descreverBrilhoPersonagem(l, s, K, reduzido = false) {
  const apagado = { tipo: '', cor: [0, 0, 0], alfa: 0, emissao: 0 };
  if (!l || l.id !== 'pipoca' || l.sumido || s?.fase !== 'luta'
    || ['caido', 'derrotado', 'tonto'].includes(l.estado)) return apagado;
  const golpe = l.estado === 'golpe' ? l.golpe : '', t = Math.max(0, l.t || 0);
  if (golpe === 'foc') {
    const carga = l.focoCarga || 0;
    const pulso = !l.focoSolto && carga >= 24 && carga < 30 ? 1 - (carga - 24) / 6
      : l.focoSolto && carga >= 60 && t >= 14 && t < 20 ? 1 - Math.max(0, t - 15) / 5 : 0;
    return pulso && !reduzido ? { tipo: 'focus', cor: [1, 1, 1], alfa: .94 * pulso, emissao: .65 * pulso } : apagado;
  }
  if (/Ex$/.test(golpe)) {
    const dur = K.LUTADORES[l.id].golpes[golpe]?.dur || 30;
    const fade = Math.min(1, Math.max(0, (dur - t) / 6));
    const pulso = reduzido ? .4 : .42 + .16 * Math.sin(t * Math.PI / 5) ** 2;
    return { tipo: 'ex', cor: [1, .67, .08], alfa: pulso * fade, emissao: .24 * fade };
  }
  if (['sup', 'ultra'].includes(golpe) && t < 18) {
    const fade = Math.max(0, 1 - t / 18);
    return { tipo: golpe, cor: golpe === 'ultra' ? [1, .68, .2] : [.4, .76, 1],
      alfa: (reduzido ? .16 : .55) * fade, emissao: .3 * fade };
  }
  return apagado;
}

// Chamas acompanham os ossos; o Focus luminoso foi pedido por Filipe.
export function descreverChamasPersonagem(l, s, K, reduzido = false) {
  if (reduzido || !l || l.id !== 'pipoca' || l.estado !== 'golpe' || l.sumido || s?.fase !== 'luta') return null;
  const g = l.golpe, t = l.t;
  if (g === 'foc' && ((!l.focoSolto && l.focoCarga >= 48) || (l.focoSolto && l.nivelFoco === 3 && t < 23)))
    return { tipo: 'focus', cor: [.55, .8, 1], cor2: [.15, .4, 1], taxa: 160 };
  if (['dp', 'dpEx'].includes(g) && t >= 5 && t < 25)
    return { tipo: 'subida', cor: [1, .7, .12], cor2: [1, .18, .02], taxa: g === 'dpEx' ? 240 : 180 };
  if (/Ex$/.test(g) && t >= 2 && t < K.LUTADORES[l.id].golpes[g].dur - 5)
    return { tipo: 'ex', cor: [1, .8, .22], cor2: [1, .38, .04], taxa: 120 };
  if (g === 'sup' && t < 14) return { tipo: 'super', cor: [.65, .87, 1], cor2: [.2, .55, 1], taxa: 120 };
  if (g === 'ultra' && t < 18) return { tipo: 'ultra', cor: [1, .7, .15], cor2: [1, .25, .03], taxa: 180 };
  return null;
}

// Overlay acompanha a malha deformada, inclusive mãos e orelhas. Restaurar
// propriedades originais evita deixar o corpo pintado após gastar a barra.
export function criarBrilhoPersonagem(Color3, glow) {
  const malhas = new Map(), materiais = new Map();
  function restaurar(m) {
    const base = malhas.get(m);
    if (!base || m.isDisposed()) return;
    m.renderOverlay = base.ativo; m.overlayAlpha = base.alfa; m.overlayColor.copyFrom(base.cor);
    const tinta = materiais.get(m.material);
    if (tinta) m.material.emissiveColor.copyFrom(tinta);
  }
  return {
    atualizar(modelo, efeito) {
      for (const m of modelo?.malhas || []) {
        if (!malhas.has(m)) {
          malhas.set(m, { ativo: m.renderOverlay, alfa: m.overlayAlpha, cor: m.overlayColor.clone() });
          if (m.material?.emissiveColor && !materiais.has(m.material)) materiais.set(m.material, m.material.emissiveColor.clone());
          glow.addIncludedOnlyMesh(m); glow.setEffectIntensity(m, .4);
        }
        if (!efeito.tipo) { restaurar(m); continue; }
        m.renderOverlay = true; m.overlayAlpha = efeito.alfa;
        m.overlayColor.copyFromFloats(...efeito.cor);
        const tinta = materiais.get(m.material);
        if (tinta) m.material.emissiveColor.copyFrom(tinta.add(Color3.FromArray(efeito.cor).scale(efeito.emissao)));
      }
    },
    limpar() { for (const m of malhas.keys()) restaurar(m); },
    descartar() { for (const m of malhas.keys()) { restaurar(m); glow.removeIncludedOnlyMesh(m); } malhas.clear(); materiais.clear(); },
  };
}
