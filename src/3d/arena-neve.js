import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture.js';
import { PhotoDome } from '@babylonjs/core/Helpers/photoDome.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { Scene } from '@babylonjs/core/scene.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';

// Arena Neve realista: fundo fotográfico 360° (Poly Haven, CC0), luz ambiente
// HDR da mesma foto (ilumina as lutadoras com a luz do cenário), chão de neve
// PBR com relevo, pinheiros/pedras/tocos 3D com neve, névoa e neve caindo em
// camadas de profundidade com vento.
const BASE = '/arenas/neve/';

function textura(scene, arquivo, { normal = false, repetir = 1 } = {}) {
  const t = new Texture(BASE + arquivo, scene);
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = t.vScale = repetir;
  if (normal) t.gammaSpace = false;
  return t;
}

// Floco macio: centro opaco, borda difusa, levemente irregular.
function texturaFloco(scene, nome, desfocado) {
  const t = new DynamicTexture(nome, { width: 64, height: 64 }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext();
  g.clearRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (desfocado) {
    grad.addColorStop(0, 'rgba(255,255,255,.55)'); grad.addColorStop(.5, 'rgba(255,255,255,.3)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.35, 'rgba(255,255,255,.9)'); grad.addColorStop(.7, 'rgba(240,246,255,.25)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  t.update();
  return t;
}

function nevar(scene, nome, { max, taxa, tamanho, caixaMin, caixaMax, velocidade, desfocado = false, alpha = 1 }) {
  const ps = new ParticleSystem(nome, max, scene);
  ps.particleTexture = texturaFloco(scene, `${nome}-tex`, desfocado);
  ps.emitter = new Vector3(0, 0, 0);
  ps.minEmitBox = caixaMin; ps.maxEmitBox = caixaMax;
  // Leve tom frio: flocos legíveis também contra o chão claro.
  ps.color1 = new Color4(.97, .98, 1, alpha); ps.color2 = new Color4(.82, .88, .98, alpha * .9); ps.colorDead = new Color4(1, 1, 1, 0);
  ps.minSize = tamanho[0]; ps.maxSize = tamanho[1];
  ps.minLifeTime = 8; ps.maxLifeTime = 14;
  ps.emitRate = taxa;
  // Queda lenta com vento lateral e oscilação (gravidade leve + direção variada).
  ps.direction1 = new Vector3(.25, -1, -.1); ps.direction2 = new Vector3(.6, -1, .1);
  ps.minEmitPower = velocidade[0]; ps.maxEmitPower = velocidade[1];
  ps.gravity = new Vector3(.05, -.05, 0);
  ps.minAngularSpeed = -.8; ps.maxAngularSpeed = .8;
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.preWarmCycles = 300; ps.preWarmStepOffset = 5;
  ps.renderingGroupId = 0;
  ps.start();
  return ps;
}

export async function criarArenaNeve(scene, apresentacao) {
  const raiz = new TransformNode('arena-neve', scene);
  const descartaveis = [];
  scene.getMeshByName('piso')?.setEnabled(false);
  scene.getMeshByName('limite-arena')?.setEnabled(false);

  // Luz ambiente da própria foto (PBR das lutadoras e do cenário).
  const anterior = { ambiente: scene.environmentTexture, intensidade: scene.environmentIntensity, nevoa: scene.fogMode };
  const ambiente = new HDRCubeTexture(BASE + 'ambiente.hdr', scene, 256, false, true, false, true);
  scene.environmentTexture = ambiente; scene.environmentIntensity = .45;
  // Luz da foto (céu aberto, sol baixo): as luzes de estúdio do laboratório
  // ficam mais fracas e frias aqui, senão as lutadoras estouram de claro.
  const luzes = scene.lights.map(l => ({ l, i: l.intensity }));
  for (const { l } of luzes) l.intensity *= l.name === 'luz-quente' ? .55 : .45;
  descartaveis.push(ambiente);

  // Fundo 360°: o caminho entre as árvores fica atrás da luta.
  const domo = new PhotoDome('neve-fundo', BASE + 'fundo.jpg', { resolution: 48, size: 140, useDirectMapping: false }, scene);
  domo.mesh.parent = raiz;
  domo.mesh.rotation.y = Math.PI * .5;
  domo.mesh.position.y = 1.6;   // centro na altura da câmera: horizonte da foto no lugar
  domo.imageMode = PhotoDome.MODE_MONOSCOPIC;
  // A foto já tem a atmosfera dela: sem névoa por cima.
  domo.material.fogEnabled = false;
  descartaveis.push(domo);

  // Chão de neve PBR com relevo, do pé da câmera ao fundo.
  const chao = MeshBuilder.CreateGround('neve-chao', { width: 90, height: 70, subdivisions: 2 }, scene);
  chao.parent = raiz; chao.position.z = 18; chao.receiveShadows = true;
  const neve = new PBRMaterial('neve-chao-mat', scene);
  neve.albedoTexture = textura(scene, 'neve_diff.jpg', { repetir: 7 });
  neve.bumpTexture = textura(scene, 'neve_nor_gl.jpg', { normal: true, repetir: 7 });
  neve.bumpTexture.level = .55;   // relevo suave: rachaduras fortes repetiam o padrão
  neve.microSurfaceTexture = textura(scene, 'neve_rough.jpg', { repetir: 7 });
  neve.useRoughnessFromMetallicTextureAlpha = false;
  neve.metallic = 0; neve.roughness = .82;
  // Clareia a textura (as marcas escuras da foto de neve viravam padrão repetido).
  neve.albedoColor = new Color3(1.12, 1.14, 1.2);
  neve.environmentIntensity = 1.1;
  neve.invertNormalMapX = false;
  chao.material = neve;
  descartaveis.push(neve);

  // Névoa fria: profundidade atmosférica entre o meio e o fundo.
  // Montes de neve acumulada (esferas achatadas com o mesmo material do chão):
  // volume no meio do caminho e transição até a foto.
  for (const [x, z, larg, alt, prof] of [[-10, 5, 7, 1.1, 3], [11, 6, 8, 1.3, 3.5], [-15, 11, 10, 2, 5], [16, 12, 11, 2.2, 5],
    [-3, 13, 9, 1, 4], [5, 14, 10, 1.2, 4], [0, 22, 40, 2.5, 8]]) {
    const monte = MeshBuilder.CreateSphere('neve-monte', { diameter: 1, segments: 24 }, scene);
    monte.parent = raiz; monte.material = neve; monte.receiveShadows = true;
    // Afundados no chão: só a curva de cima aparece, sem borda marcada.
    monte.scaling.set(larg, alt * 2, prof); monte.position.set(x, -alt * .55, z);
  }

  // Névoa da cor da neve da foto: o chão 3D se dissolve na foto, sem emenda.
  // Linear e só depois das lutadoras (a câmera fica a ~12-16 m da luta).
  scene.fogMode = Scene.FOGMODE_LINEAR; scene.fogStart = 20; scene.fogEnd = 44; scene.fogColor = new Color3(.86, .9, .97);

  // Pinheiros, pedras e tocos com neve (GLB preparados em Blender).
  const pecas = [
    // arquivo, x, z, escala, giro
    // As árvores vêm da foto (as mudas 3D perdiam as agulhas ao reduzir).
    ['boulder_01.glb', -7, 3.2, .8, .4], ['boulder_01.glb', 8, 4, .6, 2.2], ['boulder_01.glb', -11, 7, 1.1, 1.7],
    ['tree_stump_01.glb', 6.2, 2.8, .7, 1.3], ['tree_stump_01.glb', -12, 5, .8, 3.3],
  ];
  const contêineres = new Map();
  for (const [arquivo] of pecas) {
    if (contêineres.has(arquivo)) continue;
    const c = await LoadAssetContainerAsync(BASE + arquivo, scene);
    contêineres.set(arquivo, c); descartaveis.push(c);
  }
  for (const [arquivo, x, z, escala, giro] of pecas) {
    const inst = contêineres.get(arquivo).instantiateModelsToScene(n => `neve-${n}`, false);
    const no = inst.rootNodes[0];
    no.parent = raiz; no.position.set(x, 0, z); no.scaling.scaleInPlace(escala); no.rotation = new Vector3(0, giro, 0);
    for (const m of no.getChildMeshes()) { m.receiveShadows = true; apresentacao?.projetarSombra?.(m); }
    descartaveis.push(...inst.rootNodes);
  }

  // Neve caindo em três camadas: fundo fino e denso, meio, e flocos grandes
  // desfocados passando perto da câmera.
  const flocos = [
    nevar(scene, 'neve-longe', { max: 2200, taxa: 180, tamanho: [.04, .08], velocidade: [.35, .6],
      caixaMin: new Vector3(-30, 14, 4), caixaMax: new Vector3(30, 16, 30) }),
    nevar(scene, 'neve-meio', { max: 1400, taxa: 110, tamanho: [.07, .14], velocidade: [.4, .7],
      caixaMin: new Vector3(-16, 9, -4), caixaMax: new Vector3(16, 10, 6) }),
    nevar(scene, 'neve-perto', { max: 320, taxa: 30, tamanho: [.12, .24], velocidade: [.5, .9], desfocado: true, alpha: .8,
      // Entre a câmera (~11 m à frente da luta) e as lutadoras.
      caixaMin: new Vector3(-8, 7, -8), caixaMax: new Vector3(8, 8, -4) }),
  ];
  descartaveis.push(...flocos);

  globalThis.__arenaPronta = 'neve';
  return {
    atualizar() {},
    descartar() {
      for (const d of descartaveis) d.dispose?.();
      for (const { l, i } of luzes) l.intensity = i;
      raiz.dispose(false, true);
      scene.environmentTexture = anterior.ambiente; scene.environmentIntensity = anterior.intensidade; scene.fogMode = anterior.nevoa;
    },
  };
}
