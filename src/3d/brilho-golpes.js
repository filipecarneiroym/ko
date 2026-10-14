import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { TrailMesh } from '@babylonjs/core/Meshes/trailMesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { quedasDoFinal } from './estado-visual.mjs';

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

// Bola de fogo do especial (como o hadouken): miolo branco, corpo laranja e
// línguas de chama em volta.
function texturaBolaDeFogo(scene) {
  const n = 256, c = n / 2, t = new DynamicTexture('golpe-bola-fogo', { width: n, height: n }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext();
  g.clearRect(0, 0, n, n);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, comp = c * (.62 + (i % 3) * .1);
    g.save(); g.translate(c, c); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, comp, 0);
    gr.addColorStop(0, 'rgba(255,200,90,.9)'); gr.addColorStop(.6, 'rgba(255,90,20,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -c * .14); g.quadraticCurveTo(comp * .7, -c * .1, comp, 0); g.quadraticCurveTo(comp * .7, c * .1, 0, c * .14); g.fill();
    g.restore();
  }
  const miolo = g.createRadialGradient(c, c, 0, c, c, c * .55);
  miolo.addColorStop(0, '#ffffff'); miolo.addColorStop(.25, '#fff0a0'); miolo.addColorStop(.6, 'rgba(255,120,30,.75)'); miolo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = miolo; g.fillRect(0, 0, n, n);
  t.update();
  return t;
}

export function criarBrilhoGolpes(scene, simulador, movimentoReduzido = { matches: false }) {
  // Meia resolução: o brilho é borrado de propósito e pesa pouco no celular.
  const brilho = new GlowLayer('golpes-brilho', scene, { mainTextureRatio: .5, blurKernelSize: 40 });
  brilho.intensity = 1.1;
  const chama = texturaChama(scene);
  const U = simulador.U, xMundo = x => (x / U - simulador.LARGURA / 2) / 24, yMundo = y => y / U / 24;

  // Uma bola de fogo por dono (mesmo pool das cenouras de efeitos.js).
  const texBola = texturaBolaDeFogo(scene);
  const matBola = new StandardMaterial('golpe-bola-mat', scene);
  matBola.disableLighting = true; matBola.emissiveTexture = texBola; matBola.opacityTexture = texBola;
  matBola.diffuseColor = new Color3(0, 0, 0); matBola.backFaceCulling = false; matBola.alphaMode = Constants.ALPHA_ADD;
  const bolas = [0, 1].map(dono => {
    const malha = MeshBuilder.CreatePlane(`golpe-bola-${dono}`, { size: 1.15 }, scene);
    malha.material = matBola; malha.billboardMode = Mesh.BILLBOARDMODE_ALL; malha.isPickable = false; malha.setEnabled(false);
    brilho.addIncludedOnlyMesh(malha);
    const fogo = new ParticleSystem(`golpe-bola-rastro-${dono}`, 200, scene);
    fogo.particleTexture = chama; fogo.blendMode = ParticleSystem.BLENDMODE_ADD;
    fogo.emitter = new Vector3(0, -100, 0); fogo.createSphereEmitter(.18);
    fogo.minEmitPower = .2; fogo.maxEmitPower = .6; fogo.gravity = new Vector3(0, .8, 0);
    fogo.minSize = .16; fogo.maxSize = .38; fogo.minLifeTime = .12; fogo.maxLifeTime = .3;
    fogo.color1 = new Color4(1, .85, .4, .9); fogo.color2 = new Color4(1, .4, .1, .8); fogo.colorDead = new Color4(.3, 0, 0, 0);
    fogo.emitRate = 0; fogo.start();
    return { malha, fogo };
  });

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
      if (f > frente) { frente = f; melhor = { p, nome }; }
    }
    return melhor;
  }

  // Chuva de Cenouras do Final: as que estão caindo ganham a mesma bola de fogo.
  const chamasChuva = Array.from({ length: 8 }, (_, i) => {
    const m = MeshBuilder.CreatePlane(`golpe-chuva-fogo-${i}`, { size: .9 }, scene);
    m.material = matBola; m.billboardMode = Mesh.BILLBOARDMODE_ALL; m.isPickable = false; m.setEnabled(false);
    brilho.addIncludedOnlyMesh(m);
    return m;
  });

  return {
    brilho,
    // Depois de os modelos receberem a pose do quadro.
    atualizar(estado, modelos) {
      for (const m of chamasChuva) m.setEnabled(false);
      let livre = 0;
      for (const q of quedasDoFinal(estado, U)) {
        if (q.idade < 0 || q.idade >= 36 || livre >= chamasChuva.length || movimentoReduzido.matches) continue;
        const m = chamasChuva[livre++];
        m.setEnabled(true);
        m.position.set(xMundo(q.x), (140 - q.idade * 3.6) / 24 + .25, -.18);
        m.scaling.setAll(1 + .15 * Math.sin(q.idade * .8)); m.rotation.z = q.idade * .3;
      }
      bolas.forEach((b, dono) => {
        const p = estado.proj?.find(p => p.dono === dono && p.tipo === 'cenoura' && p.vida > 0);
        b.malha.setEnabled(!!p);
        b.fogo.emitRate = p && !movimentoReduzido.matches ? 160 : 0;
        if (!p) return;
        const x = xMundo(p.x), y = yMundo(p.y);
        // Atrás da cenoura (z maior = mais longe da câmera), pulsando e girando.
        b.malha.position.set(x, y, -.04);
        b.malha.scaling.setAll(1 + .12 * Math.sin(p.t * .9));
        b.malha.rotation.z = p.t * .35;
        b.fogo.emitter.set(x - Math.sign(p.vx || 1) * .15, y, -.1);
        b.fogo.direction1 = new Vector3(-Math.sign(p.vx || 1) * 2.2, -.3, 0); b.fogo.direction2 = new Vector3(-Math.sign(p.vx || 1) * 3, .4, 0);
      });
      estado.p.forEach((l, i) => {
        const d = lados[i], modelo = modelos[i];
        const golpe = l.estado === 'golpe' && simulador.LUTADORES[l.id]?.golpes[l.golpe];
        // Só durante o golpe de verdade (cada janela: chute duplo tem duas, uma
        // por perna) e um pouco antes; some quando a perna começa a voltar.
        const janela = golpe?.janelas?.find(j => l.t >= j.de - 3 && l.t <= j.ate);
        const ativo = !!(modelo && janela && !l.sumido);
        if (ativo) {
          const m = membro(modelo, l);
          // Trocou de pé ou mão no meio do golpe: recomeça o rastro (sem linha ligando os dois).
          if (m && d.ativo && d.membro !== m.nome) d.rastro.reset();
          if (m) { d.ponta.position.copyFrom(m.p); d.membro = m.nome; }
          if (!d.ativo || d.janela !== janela) {
            const tipo = l.golpe === 'sup' ? 'super' : l.golpe === 'esp' ? 'especial' : FORTES.has(l.golpe) ? 'forte' : 'fraco';
            d.mat.emissiveColor = Color3.FromHexString(COR[tipo]);
            d.rastro.diameter = tipo === 'fraco' ? .12 : .2;
            d.rastro.reset(); d.rastro.setEnabled(true); d.rastro.start();
          }
        } else if (d.ativo) { d.rastro.stop(); d.rastro.setEnabled(false); }
        d.ativo = ativo; d.janela = janela;

        // Aura de fogo só no Super (no especial, o fogo é o da cenoura).
        const queima = l.golpe === 'sup' && l.estado === 'golpe' && !movimentoReduzido.matches;
        d.aura.emitRate = queima ? 260 : 0;
        if (queima) d.aura.emitter.set((l.x / simulador.U - simulador.LARGURA / 2) / 24, l.y / simulador.U / 24 + 1.15, 0);
      });
    },
    limpar() { for (const b of bolas) { b.malha.setEnabled(false); b.fogo.emitRate = 0; b.fogo.reset(); } for (const d of lados) { d.rastro.stop(); d.rastro.setEnabled(false); d.ativo = false; d.aura.emitRate = 0; d.aura.reset(); } },
    descartar() {
      for (const d of lados) { d.aura.dispose(); d.rastro.dispose(); d.mat.dispose(); d.ponta.dispose(); }
      for (const b of bolas) { b.fogo.dispose(); b.malha.dispose(); }
      matBola.dispose(); texBola.dispose(); chama.dispose(); brilho.dispose();
    },
  };
}
