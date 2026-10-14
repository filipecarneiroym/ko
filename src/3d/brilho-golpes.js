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
  fraco: '#bfe9ff', chute: '#d9e5e9', forte: '#ff7a1c', especial: '#75eaff', super: '#ffd84a',
};
const FORTES = new Set(['p2', 'k2']);
const CHUTES = new Set(['k1', 'k2', 'ck', 'ak', 'tatsu', 'tatsuEx']);

// Tinta escura do Focus Attack (como no SF4): mancha preta-azulada com borda clara.
function texturaTintaFoco(scene) {
  const n = 64, t = new DynamicTexture('golpe-tinta-foco', { width: n, height: n }, scene, false);
  t.hasAlpha = true;
  const g = t.getContext();
  g.clearRect(0, 0, n, n);
  g.save(); g.translate(n / 2, n / 2); g.scale(1, .32); // pincelada: comprida e fina
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, n / 2);
  gr.addColorStop(0, 'rgba(10,8,22,.95)'); gr.addColorStop(.6, 'rgba(20,16,40,.75)'); gr.addColorStop(.85, 'rgba(160,170,220,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, n / 2, 0, Math.PI * 2); g.fill(); g.restore(); t.update();
  return t;
}

function texturaChama(scene) {
  const n = 64, t = new DynamicTexture('golpe-chama', { width: n, height: n }, scene, false);
  t.hasAlpha = true;
  const g = t.getContext(), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.3, '#ffd27a'); gr.addColorStop(.65, 'rgba(255,90,20,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n); t.update();
  return t;
}

// Oito fases de vapor azul: o contorno se desfaz, sem aro ou esfera rígida.
// Atlas compartilhado; animar os UVs mantém todos os projéteis na mesma textura.
function texturaBolaDeFogo(scene) {
  const n = 128, t = new DynamicTexture('hadouken-vapor', { width: n * 4, height: n * 2 }, scene, false);
  t.hasAlpha = true;
  const g = t.getContext();
  g.clearRect(0, 0, n * 4, n * 2);
  function vapor(x, y, rx, ry, cor, alpha) {
    g.save(); g.translate(x, y); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(${cor},${alpha})`);
    gr.addColorStop(.48, `rgba(${cor},${alpha * .75})`);
    gr.addColorStop(1, `rgba(${cor},0)`);
    g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
  }
  for (let fase = 0; fase < 8; fase++) {
    g.save(); g.translate(fase % 4 * n, Math.floor(fase / 4) * n);
    g.beginPath(); g.rect(2, 2, n - 4, n - 4); g.clip();
    const t = fase * Math.PI / 4;
    // Turbilhões azuis separados: a borda tem vazios, pontas e pequenas nuvens.
    for (let i = 0; i < 15; i++) {
      const a = i * 2.399, onda = Math.sin(t + i * 1.7);
      vapor(77 + Math.cos(a) * (25 + onda * 6), 64 + Math.sin(a) * (30 + onda * 7),
        15 + (i % 4) * 3, 13 + (i % 3) * 4, '15,120,255', .55);
    }
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399 + t * .6;
      vapor(76 + Math.cos(a) * 17, 64 + Math.sin(a) * 22, 17, 15, '50,215,255', .7);
    }
    // Miolo quebrado em bolsões claros; não há disco branco uniforme.
    for (let i = 0; i < 4; i++) {
      const a = t + i * 1.8;
      vapor(79 + Math.cos(a) * 8, 64 + Math.sin(a) * 12, 12, 11, '215,255,255', .85);
    }
    for (let i = 0; i < 6; i++) {
      const x = 16 + i * 8, y = 64 + Math.sin(t + i * 1.5) * (23 - i * 2);
      vapor(x, y, 12 + i, 7 + i, '25,155,255', .22 + i * .04);
    }
    g.restore();
  }
  t.update();
  return t;
}

function quadroVapor(malha, quadro) {
  const fase = Math.floor(quadro / 2) % 8, u = fase % 4 / 4, v = Math.floor(fase / 4) / 2;
  malha.updateVerticesData('uv', [u, v, u + .25, v, u + .25, v + .5, u, v + .5]);
}

export function criarBrilhoGolpes(scene, simulador, movimentoReduzido = { matches: false }) {
  // Meia resolução: o brilho é borrado de propósito e pesa pouco no celular.
  const brilho = new GlowLayer('golpes-brilho', scene, { mainTextureRatio: .5, blurKernelSize: 40 });
  brilho.intensity = 1.25; // visível no celular (tela pequena e brilho do aparelho); o pico vem do impacto e da velocidade
  const chama = texturaChama(scene), tintaFoco = texturaTintaFoco(scene);
  const U = simulador.U, xMundo = x => (x / U - simulador.LARGURA / 2) / 24, yMundo = y => y / U / 24;

  // Até dois projéteis EX por lutadora; todos compartilham a textura pronta.
  const texBola = texturaBolaDeFogo(scene);
  function materialBola(nome) {
    // StandardMaterial.clone também clona DynamicTexture em branco. Isso
    // deixava scene.whenReadyAsync esperando uma textura nunca atualizada.
    const mat = new StandardMaterial(nome, scene);
    mat.disableLighting = true; mat.emissiveTexture = texBola; mat.opacityTexture = texBola;
    mat.diffuseColor = new Color3(0, 0, 0); mat.specularColor = Color3.Black();
    mat.emissiveColor = Color3.Black(); mat.backFaceCulling = false; mat.alphaMode = Constants.ALPHA_ADD;
    return mat;
  }
  const bolas = [0, 1, 2, 3].map(dono => {
    const malha = MeshBuilder.CreatePlane(`golpe-bola-${dono}`, { size: 1.9, updatable: true }, scene);
    malha.material = materialBola(`golpe-bola-mat-${dono}`); malha.billboardMode = Mesh.BILLBOARDMODE_ALL; malha.isPickable = false; malha.setEnabled(false);
    brilho.addIncludedOnlyMesh(malha); brilho.setEffectIntensity(malha, .28);
    const fumaca = Array.from({ length: 5 }, (_, i) => {
      const m = MeshBuilder.CreatePlane(`hadouken-fumaca-${dono}-${i}`, { size: 1.9, updatable: true }, scene);
      m.material = materialBola(`hadouken-fumaca-mat-${dono}-${i}`);
      m.material.alpha = .28 * (1 - i / 6);
      m.billboardMode = Mesh.BILLBOARDMODE_ALL; m.isPickable = false; m.setEnabled(false);
      return m;
    });
    return { malha, fumaca };
  });

  const lados = [0, 1].map(lado => {
    const carga = MeshBuilder.CreatePlane(`hadouken-carga-${lado}`, { size: 1, updatable: true }, scene);
    carga.material = materialBola(`hadouken-carga-mat-${lado}`);
    carga.billboardMode = Mesh.BILLBOARDMODE_ALL; carga.isPickable = false; carga.setEnabled(false);
    brilho.addIncludedOnlyMesh(carga); brilho.setEffectIntensity(carga, .45);
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
    const nevoa = new ParticleSystem(`golpe-nevoa-${lado}`, 160, scene);
    nevoa.particleTexture = chama; nevoa.blendMode = ParticleSystem.BLENDMODE_ADD;
    nevoa.emitter = new Vector3(0, -100, 0); nevoa.createSphereEmitter(.08);
    nevoa.minEmitPower = .1; nevoa.maxEmitPower = .5; nevoa.gravity = new Vector3(0, .7, 0);
    nevoa.minSize = .14; nevoa.maxSize = .32; nevoa.minLifeTime = .12; nevoa.maxLifeTime = .3;
    nevoa.addSizeGradient(0, .6); nevoa.addSizeGradient(1, 1.5);
    nevoa.emitRate = 0; nevoa.start();
    // Focus Attack: redemoinho de tinta escura em volta do corpo enquanto carrega.
    const foco = new ParticleSystem(`golpe-foco-${lado}`, 160, scene);
    foco.particleTexture = tintaFoco; foco.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    foco.emitter = new Vector3(0, -100, 0);
    foco.minEmitBox = new Vector3(-.5, -1.1, -.3); foco.maxEmitBox = new Vector3(.5, 1, .3);
    foco.direction1 = new Vector3(-.6, .6, -.2); foco.direction2 = new Vector3(.6, 1.2, .2);
    foco.minEmitPower = .3; foco.maxEmitPower = .9; foco.gravity = new Vector3(0, .6, 0);
    foco.minAngularSpeed = -4; foco.maxAngularSpeed = 4;
    foco.minSize = .35; foco.maxSize = .75; foco.minLifeTime = .25; foco.maxLifeTime = .5;
    foco.color1 = new Color4(1, 1, 1, .85); foco.color2 = new Color4(.8, .85, 1, .7); foco.colorDead = new Color4(.5, .5, .7, 0);
    foco.emitRate = 0; foco.start();
    return { carga, ponta, rastro, mat, aura, foco, nevoa, ativo: false };
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
  const matChuva = materialBola('golpe-chuva-mat');
  const chamasChuva = Array.from({ length: 8 }, (_, i) => {
    const m = MeshBuilder.CreatePlane(`golpe-chuva-fogo-${i}`, { size: .9, updatable: true }, scene);
    m.material = matChuva; m.billboardMode = Mesh.BILLBOARDMODE_ALL; m.isPickable = false; m.setEnabled(false);
    quadroVapor(m, 0);
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
      const projeteis = (estado.proj || []).filter(p => p.tipo === 'cenoura' && p.vida > 0);
      bolas.forEach((b, indice) => {
        const p = projeteis[indice];
        b.malha.setEnabled(!!p);
        b.fumaca.forEach(m => m.setEnabled(false));
        if (!p) return;
        const x = xMundo(p.x), y = yMundo(p.y);
        // Envelope orientado na direção do disparo; pulsação discreta.
        b.malha.position.set(x, y, -.04);
        const tamanho = p.ultra ? 1.65 : p.ex ? 1.15 : 1;
        b.malha.scaling.set(.9 * tamanho, .74 * tamanho, 1);
        quadroVapor(b.malha, movimentoReduzido.matches ? 0 : p.t);
        b.malha.material.emissiveColor = Color3.Black();
        b.malha.rotation.z = p.vx >= 0 ? 0 : Math.PI;
        b.fumaca.forEach((m, i) => {
          const atraso = (i + 1) * 1.4;
          if (movimentoReduzido.matches || p.t <= atraso) return;
          m.setEnabled(true);
          m.position.set(x - p.vx / U / 24 * atraso, y + Math.sin(p.t * .6 + i * 2) * .07 * (i + 1), .02 + i * .005);
          m.scaling.set((.68 + i * .035) * tamanho, (.5 + i * .035) * tamanho, 1);
          m.rotation.z = b.malha.rotation.z;
          quadroVapor(m, p.t + i * 3);
        });
      });
      estado.p.forEach((l, i) => {
        const d = lados[i], modelo = modelos[i];
        const hadouken = ['esp', 'espEx', 'ultra'].includes(l.golpe);
        const chuteComum = ['k1', 'k2', 'ck', 'ak', 'tatsu'].includes(l.golpe);
        const solta = l.golpe === 'ultra' ? 25 : 10;
        d.carga.setEnabled(!!modelo && hadouken && l.estado === 'golpe' && l.t >= 4 && l.t < solta && !l.sumido);
        if (d.carga.isEnabled()) {
          const maos = ['mao_E', 'mao_D'].map(nome => modelo.osso?.(nome));
          if (maos.every(Boolean)) {
            for (const no of maos) {
              const cadeia = []; for (let p = no; p; p = p.parent) cadeia.push(p);
              for (const p of cadeia.reverse()) p.computeWorldMatrix(true);
            }
            d.carga.position.copyFrom(Vector3.Center(maos[0].getAbsolutePosition(), maos[1].getAbsolutePosition()));
            d.carga.position.z -= .22;
            d.carga.scaling.setAll(.34 + .18 * l.t / solta);
            quadroVapor(d.carga, movimentoReduzido.matches ? 0 : l.t);
          } else d.carga.setEnabled(false);
        }
        const golpe = l.estado === 'golpe' && simulador.LUTADORES[l.id]?.golpes[l.golpe];
        // Só durante o golpe de verdade (cada janela: chute duplo tem duas, uma
        // por perna) e um pouco antes; some quando a perna começa a voltar.
        const janela = golpe?.janelas?.find(j => l.t >= j.de - 3 && l.t <= j.ate);
        const ativo = !!(modelo && janela && !l.sumido);
        if (ativo) {
          const m = membro(modelo, l);
          // Trocou de pé ou mão no meio do golpe: recomeça o rastro (sem linha ligando os dois).
          if (m && d.ativo && d.membro !== m.nome) d.rastro.reset();
          if (m) {
            // Rastro acompanha a velocidade do membro: forte no estalo, some quando desacelera.
            const veloc = d.membro === m.nome ? Vector3.Distance(d.ponta.position, m.p) : 0;
            d.mat.alpha = chuteComum ? Math.min(.38, .1 + veloc * .8) : Math.min(1, .35 + veloc * 4.5);
            d.ponta.position.copyFrom(m.p); d.membro = m.nome;
          }
          if (!d.ativo || d.janela !== janela) {
            const tipo = l.golpe === 'sup' ? 'super' : hadouken ? 'especial' : chuteComum ? 'chute' : FORTES.has(l.golpe) ? 'forte' : 'fraco';
            d.mat.emissiveColor = Color3.FromHexString(COR[tipo]);
            d.rastro.diameter = chuteComum ? .07 : tipo === 'fraco' ? .12 : .2;
            d.rastro.reset(); d.rastro.setEnabled(true); d.rastro.start();
            const fogo = tipo !== 'fraco' && !hadouken && !chuteComum;
            d.nevoa.color1 = fogo ? new Color4(1, .78, .35, .8) : new Color4(.8, .92, 1, .6);
            d.nevoa.color2 = fogo ? new Color4(1, .38, .1, .6) : new Color4(.5, .7, 1, .45);
            d.nevoa.colorDead = new Color4(0, 0, 0, 0);
          }
        } else if (d.ativo) { d.rastro.stop(); d.rastro.setEnabled(false); }
        d.nevoa.emitRate = ativo && !chuteComum && !movimentoReduzido.matches ? 140 : 0;
        if (ativo) d.nevoa.emitter = d.ponta.position.clone();
        d.ativo = ativo; d.janela = janela;

        // Focus: tinta enquanto carrega (até soltar o golpe).
        const carregando = l.estado === 'golpe' && l.golpe === 'foc' && l.t < 19 && !movimentoReduzido.matches;
        d.foco.emitRate = carregando ? 140 + (l.nivelFoco || 1) * 65 : 0;
        if (carregando) d.foco.emitter.set((l.x / simulador.U - simulador.LARGURA / 2) / 24, l.y / simulador.U / 24 + 1.15, 0);
        // Hadouken carrega energia nas mãos; aura de fogo fica nos outros poderes.
        const queima = !hadouken && (l.golpe === 'sup' || /Ex$/.test(l.golpe || '')) && l.estado === 'golpe' && !movimentoReduzido.matches;
        d.aura.emitRate = queima ? 260 : 0;
        if (queima) d.aura.emitter.set((l.x / simulador.U - simulador.LARGURA / 2) / 24, l.y / simulador.U / 24 + 1.15, 0);
      });
    },
    limpar() { for (const b of bolas) { b.malha.setEnabled(false); b.fumaca.forEach(m => m.setEnabled(false)); } for (const d of lados) { d.carga.setEnabled(false); d.rastro.stop(); d.rastro.setEnabled(false); d.ativo = false; d.aura.emitRate = 0; d.aura.reset(); d.foco.emitRate = 0; d.foco.reset(); d.nevoa.emitRate = 0; d.nevoa.reset(); } },
    descartar() {
      tintaFoco.dispose();
      for (const d of lados) { d.carga.material.dispose(); d.carga.dispose(); d.nevoa.dispose(); d.foco.dispose(); d.aura.dispose(); d.rastro.dispose(); d.mat.dispose(); d.ponta.dispose(); }
      for (const b of bolas) { for (const m of b.fumaca) { m.material.dispose(); m.dispose(); } b.malha.material.dispose(); b.malha.dispose(); }
      for (const m of chamasChuva) m.dispose();
      matChuva.dispose();
      texBola.dispose(); chama.dispose(); brilho.dispose();
    },
  };
}
