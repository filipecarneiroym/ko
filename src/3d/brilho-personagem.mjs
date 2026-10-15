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
