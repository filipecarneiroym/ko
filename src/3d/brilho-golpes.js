import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { TrailMesh } from '@babylonjs/core/Meshes/trailMesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';

// Luminosidade dos golpes no estilo do SF4 de celular: rastro de luz na mão
// ou no pé que bate (branco-azulado no fraco, fogo no forte, energia no
// especial/Super), aura de fogo no especial e no Super e uma camada de brilho
// que faz faíscas e rastros "vazarem" luz. Só visual: lê o estado do motor.
const COR = {
  fraco: '#bfe9ff', forte: '#ff7a1c', especial: '#ff9a2a', super: '#ffd84a',
};
const FORTES = new Set(['p2', 'k2']);
const CHUTES = new Set(['k1', 'k2', 'ck', 'ak']);

function texturaChama(scene) {
  const n = 64, t = new DynamicTexture('golpe-chama', { width: n, height: n }, scene, false);
  t.hasAlpha = true;
  const g = t.getContext(), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.3, '#ffd27a'); gr.addColorStop(.65, 'rgba(255,90,20,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n); t.update();
  return t;
}

export function criarBrilhoGolpes(scene, simulador, movimentoReduzido = { matches: false }) {
  // Meia resolução: o brilho é borrado de propósito e pesa pouco no celular.
  const brilho = new GlowLayer('golpes-brilho', scene, { mainTextureRatio: .5, blurKernelSize: 40 });
  brilho.intensity = 1.1;
  const chama = texturaChama(scene);

  const lados = [0, 1].map(lado => {
    const ponta = new TransformNode(`golpe-ponta-${lado}`, scene);
    const rastro = new TrailMesh(`golpe-rastro-${lado}`, ponta, scene, { diameter: .16, length: 9, autoStart: false });
    const mat = new StandardMaterial(`golpe-rastro-mat-${lado}`, scene);
    mat.disableLighting = true; mat.backFaceCulling = false; mat.alpha = .85; mat.alphaMode = Constants.ALPHA_ADD;
    rastro.material = mat; rastro.isPickable = false; rastro.setEnabled(false);
    brilho.addIncludedOnlyMesh(rastro);

    const aura = new ParticleSystem(`golpe-aura-${lado}`, 180, scene);
    aura.particleTexture = chama; aura.blendMode = ParticleSystem.BLENDMODE_ADD;
    aura.emitter = new Vector3(0, -100, 0);
    aura.minEmitBox = new Vector3(-.45, -1.1, -.25); aura.maxEmitBox = new Vector3(.45, 1, .25);
    aura.direction1 = new Vector3(-.2, 1, 0); aura.direction2 = new Vector3(.2, 1.6, 0);
    aura.minEmitPower = .8; aura.maxEmitPower = 1.8; aura.gravity = new Vector3(0, 1.5, 0);
    aura.minSize = .18; aura.maxSize = .42; aura.minLifeTime = .18; aura.maxLifeTime = .45;
    aura.color1 = new Color4(1, .78, .3, .9); aura.color2 = new Color4(1, .35, .08, .8); aura.colorDead = new Color4(.3, 0, 0, 0);
    aura.emitRate = 0; aura.start();
    return { ponta, rastro, mat, aura, ativo: false };
  });

  // O membro que bate é o mais esticado para a frente (mão ou pé).
  function membro(modelo, l) {
    const nomes = CHUTES.has(l.golpe) ? ['pe_E', 'pe_D'] : ['mao_E', 'mao_D'];
    let melhor = null, frente = -Infinity;
    for (const nome of nomes) {
      const no = modelo.osso?.(nome);
      if (!no) continue;
      const p = no.getAbsolutePosition(), f = p.x * l.face;
      if (f > frente) { frente = f; melhor = p; }
    }
    return melhor;
  }

  return {
    brilho,
    // Depois de os modelos receberem a pose do quadro.
    atualizar(estado, modelos) {
      estado.p.forEach((l, i) => {
        const d = lados[i], modelo = modelos[i];
        const golpe = l.estado === 'golpe' && simulador.LUTADORES[l.id]?.golpes[l.golpe];
        const janela = golpe?.janelas?.[0];
        const ativo = !!(modelo && janela && l.t >= janela.de - 3 && l.t <= janela.ate + 2 && !l.sumido);
        if (ativo) {
          const p = membro(modelo, l);
          if (p) d.ponta.position.copyFrom(p);
          if (!d.ativo) {
            const tipo = l.golpe === 'sup' ? 'super' : l.golpe === 'esp' ? 'especial' : FORTES.has(l.golpe) ? 'forte' : 'fraco';
            d.mat.emissiveColor = Color3.FromHexString(COR[tipo]);
            d.rastro.diameter = tipo === 'fraco' ? .12 : .2;
            d.rastro.reset(); d.rastro.setEnabled(true); d.rastro.start();
          }
        } else if (d.ativo) { d.rastro.stop(); d.rastro.setEnabled(false); }
        d.ativo = ativo;

        // Aura de fogo enquanto solta o especial/Super.
        const queima = (l.golpe === 'esp' || l.golpe === 'sup') && l.estado === 'golpe' && !movimentoReduzido.matches;
        d.aura.emitRate = queima ? (l.golpe === 'sup' ? 260 : 140) : 0;
        if (queima) d.aura.emitter.set((l.x / simulador.U - simulador.LARGURA / 2) / 24, l.y / simulador.U / 24 + 1.15, 0);
      });
    },
    limpar() { for (const d of lados) { d.rastro.stop(); d.rastro.setEnabled(false); d.ativo = false; d.aura.emitRate = 0; d.aura.reset(); } },
    descartar() {
      for (const d of lados) { d.aura.dispose(); d.rastro.dispose(); d.mat.dispose(); d.ponta.dispose(); }
      chama.dispose(); brilho.dispose();
    },
  };
}
