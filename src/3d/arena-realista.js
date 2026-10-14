import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture.js';
import { PhotoDome } from '@babylonjs/core/Helpers/photoDome.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { Scene } from '@babylonjs/core/scene.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';

// Arenas realistas: fundo fotográfico 360° e luz ambiente HDR da mesma foto
// (Poly Haven, CC0), chão PBR com relevo, objetos 3D, névoa depois das
// lutadoras e um efeito de ambiente por cenário. Recursos preparados por
// scripts/producao-3d/preparar-arena.py em public/arenas/<arena>/.

// Configuração por arena.
//  giro: rotação do fundo (qual parte da foto fica atrás da luta), escolhida
//        em teste de 8 ângulos (laravel/tests/browser/giro-arenas-3d.cjs)
//  luz: [ambiente HDR, fator das luzes de estúdio]
//  chao: [repetições, nível do relevo, tom (multiplica a cor)]
//  nevoa: [início, fim, cor]
//  pecas: [arquivo, x, z, escala, giro]
//  montes: [x, z, largura, altura, profundidade] (volumes do mesmo material do chão)
export const CONFIG = {
  neve: {
    giro: Math.PI * .75, luz: [.45, .5], chao: [7, .55, [1.12, 1.14, 1.2]], nevoa: [20, 44, [.86, .9, .97]],
    pecas: [['boulder_01', -7, 3.2, .8, .4], ['boulder_01', 8, 4, .6, 2.2], ['boulder_01', -11, 7, 1.1, 1.7],
      ['tree_stump_01', 6.2, 2.8, .7, 1.3], ['tree_stump_01', -12, 5, .8, 3.3]],
    montes: [[-10, 5, 7, 1.1, 3], [11, 6, 8, 1.3, 3.5], [-15, 11, 10, 2, 5], [16, 12, 11, 2.2, 5], [-3, 13, 9, 1, 4], [5, 14, 10, 1.2, 4], [0, 22, 40, 2.5, 8]],
    efeito: 'neve',
  },
  academia: {
    giro: Math.PI * 1.5, luz: [.55, .55], chao: [5, .6, [1, 1, 1]], nevoa: [22, 50, [.42, .2, .2]],
    pecas: [], montes: [], efeito: 'poeira', corPoeira: '#fff2d8',
  },
  praia: {
    giro: Math.PI * .25, luz: [.55, .5], chao: [6, .8, [1.05, 1, .95]], nevoa: [22, 50, [.95, .8, .65]],
    pecas: [['boulder_01', -9, 4.5, .9, .5], ['boulder_01', 10, 5.5, 1.2, 2.3], ['boulder_01', -13, 8, 1.4, 1.2]],
    montes: [[-12, 9, 14, 1.2, 6], [13, 10, 14, 1.4, 6]],
    efeito: 'areia',
  },
  telhado: {
    giro: Math.PI * .5, luz: [.5, .35], chao: [5, .7, [.9, .9, 1]], nevoa: [24, 55, [.3, .25, .42]],
    pecas: [],   // o ar-condicionado do Poly Haven se desmontava ao reduzir
    montes: [], efeito: 'chuva',
  },
  floresta: {
    giro: Math.PI * .5, luz: [.55, .5], chao: [6, .8, [1, 1, 1]], nevoa: [18, 46, [.62, .72, .58]],
    pecas: [['rock_moss_set_01', -11, 8, .55, .3], ['rock_moss_set_01', 12, 9, .5, 2.4], ['tree_stump_02', 7, 3.5, 1, 1.1],
      ['fern_02', -6.5, 3, 1, 0], ['fern_02', 9.5, 3.5, 1.1, 1.5], ['fern_02', -12, 4, 1.2, 2.8], ['fern_02', 4, 6, .9, .7]],
    montes: [], efeito: 'folhas',
  },
  feira: {
    giro: Math.PI * .5, luz: [.55, .55], chao: [5, .7, [1, 1, 1]], nevoa: [22, 52, [.78, .8, .82]],
    pecas: [['wooden_crate_01', -8, 4, 1.4, .2], ['wooden_crate_01', -8.3, 4.1, 1.3, 1.7], ['Barrel_01', 8.5, 4.5, 1.4, 0],
      ['Barrel_01', 9.6, 5, 1.3, 1], ['wooden_crate_01', 10, 3.6, 1.2, .9]],
    montes: [], efeito: 'poeira', corPoeira: '#fff8e0',
  },
};

function textura(scene, url, { normal = false, repetir = 1 } = {}) {
  const t = new Texture(url, scene);
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = t.vScale = repetir;
  if (normal) t.gammaSpace = false;
  return t;
}

function texturaDesenhada(scene, nome, tamanho, desenhar) {
  const t = new DynamicTexture(nome, { width: tamanho, height: tamanho }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext();
  g.clearRect(0, 0, tamanho, tamanho);
  desenhar(g, tamanho);
  t.update();
  return t;
}

const pontoMacio = (alpha = 1, cor = '255,255,255') => (g, n) => {
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, `rgba(${cor},${alpha})`); grad.addColorStop(.4, `rgba(${cor},${alpha * .8})`);
  grad.addColorStop(.75, `rgba(${cor},${alpha * .2})`); grad.addColorStop(1, `rgba(${cor},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, n, n);
};

function sistema(scene, nome, textura, opcoes) {
  const ps = new ParticleSystem(nome, opcoes.max, scene);
  ps.particleTexture = textura;
  ps.emitter = new Vector3(0, 0, 0);
  ps.minEmitBox = opcoes.caixa[0]; ps.maxEmitBox = opcoes.caixa[1];
  ps.color1 = Color4.FromHexString(opcoes.cor[0]); ps.color2 = Color4.FromHexString(opcoes.cor[1]);
  ps.colorDead = Color4.FromHexString(opcoes.cor[2] ?? '#ffffff00');
  ps.minSize = opcoes.tamanho[0]; ps.maxSize = opcoes.tamanho[1];
  ps.minLifeTime = opcoes.vida[0]; ps.maxLifeTime = opcoes.vida[1];
  ps.emitRate = opcoes.taxa;
  ps.direction1 = opcoes.dir[0]; ps.direction2 = opcoes.dir[1];
  ps.minEmitPower = opcoes.forca[0]; ps.maxEmitPower = opcoes.forca[1];
  ps.gravity = opcoes.gravidade ?? Vector3.Zero();
  ps.minAngularSpeed = opcoes.giro?.[0] ?? -.8; ps.maxAngularSpeed = opcoes.giro?.[1] ?? .8;
  ps.minInitialRotation = 0; ps.maxInitialRotation = Math.PI * 2;
  if (opcoes.esticado) { ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED; ps.minScaleY = opcoes.esticado[0]; ps.maxScaleY = opcoes.esticado[1]; }
  ps.blendMode = opcoes.aditivo ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
  ps.preWarmCycles = 300; ps.preWarmStepOffset = 5;
  ps.start();
  return ps;
}

// Efeitos de ambiente.
function efeitos(scene, tipo, cfg) {
  const V = (x, y, z) => new Vector3(x, y, z);
  if (tipo === 'neve') {
    const floco = (n, d) => texturaDesenhada(scene, n, 64, pontoMacio(d ? .55 : 1));
    return [
      sistema(scene, 'neve-longe', floco('floco-a'), { max: 2200, taxa: 180, tamanho: [.04, .08], vida: [8, 14], forca: [.35, .6],
        caixa: [V(-30, 14, 4), V(30, 16, 30)], cor: ['#f8faffff', '#d2e0faE6'], dir: [V(.25, -1, -.1), V(.6, -1, .1)], gravidade: V(.05, -.05, 0) }),
      sistema(scene, 'neve-meio', floco('floco-b'), { max: 1400, taxa: 110, tamanho: [.07, .14], vida: [8, 14], forca: [.4, .7],
        caixa: [V(-16, 9, -4), V(16, 10, 6)], cor: ['#f8faffff', '#d2e0faE6'], dir: [V(.25, -1, -.1), V(.6, -1, .1)], gravidade: V(.05, -.05, 0) }),
      sistema(scene, 'neve-perto', floco('floco-c', true), { max: 320, taxa: 30, tamanho: [.12, .24], vida: [8, 14], forca: [.5, .9],
        caixa: [V(-8, 7, -8), V(8, 8, -4)], cor: ['#f8faffcc', '#d2e0faaa'], dir: [V(.25, -1, -.1), V(.6, -1, .1)], gravidade: V(.05, -.05, 0) }),
    ];
  }
  if (tipo === 'chuva') {
    const gota = texturaDesenhada(scene, 'gota', 32, (g, n) => {
      const grad = g.createLinearGradient(0, 0, 0, n); grad.addColorStop(0, 'rgba(200,215,255,0)'); grad.addColorStop(.5, 'rgba(210,225,255,.75)'); grad.addColorStop(1, 'rgba(200,215,255,0)');
      g.fillStyle = grad; g.fillRect(n / 2 - 2, 0, 4, n);
    });
    return [
      sistema(scene, 'chuva', gota, { max: 2600, taxa: 700, tamanho: [.04, .07], vida: [.9, 1.2], forca: [11, 14],
        caixa: [V(-20, 12, -6), V(20, 13, 20)], cor: ['#c8d6ffcc', '#a8b8e899'], dir: [V(-.12, -1, 0), V(-.08, -1, 0)], esticado: [6, 9], giro: [0, 0] }),
      // Respingos no chão.
      sistema(scene, 'respingos', texturaDesenhada(scene, 'respingo', 32, pontoMacio(.7, '220,230,255')), { max: 400, taxa: 160, tamanho: [.05, .12],
        vida: [.12, .25], forca: [.5, 1.2], caixa: [V(-14, .02, -4), V(14, .05, 10)], cor: ['#dfe8ffaa', '#c0d0f088'], dir: [V(-.5, 1, -.5), V(.5, 1.5, .5)], gravidade: V(0, -9, 0) }),
    ];
  }
  if (tipo === 'folhas') {
    const folha = (n, cor) => texturaDesenhada(scene, n, 64, (g) => {
      g.fillStyle = cor; g.beginPath(); g.ellipse(32, 32, 26, 12, .5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 44); g.lineTo(54, 20); g.stroke();
    });
    return [
      sistema(scene, 'folhas-a', folha('folha-a', '#c98a2e'), { max: 160, taxa: 9, tamanho: [.14, .24], vida: [7, 11], forca: [.2, .5],
        caixa: [V(-14, 8, -4), V(14, 9, 8)], cor: ['#ffffffff', '#e8d8c0ff'], dir: [V(-.5, -.5, -.2), V(.5, -.8, .2)], gravidade: V(.08, -.2, 0), giro: [-2.5, 2.5] }),
      sistema(scene, 'folhas-b', folha('folha-b', '#7e9a3a'), { max: 100, taxa: 5, tamanho: [.12, .2], vida: [7, 11], forca: [.2, .5],
        caixa: [V(-14, 8, -4), V(14, 9, 8)], cor: ['#ffffffff', '#e0e8c8ff'], dir: [V(-.5, -.5, -.2), V(.5, -.8, .2)], gravidade: V(.08, -.2, 0), giro: [-2.5, 2.5] }),
      sistema(scene, 'poeira-sol', texturaDesenhada(scene, 'poeira-sol', 32, pontoMacio(.9, '255,250,215')), { max: 260, taxa: 22, tamanho: [.03, .06],
        vida: [6, 10], forca: [.02, .08], caixa: [V(-10, .5, -3), V(10, 5, 6)], cor: ['#fff8d0aa', '#fff0b070'], dir: [V(-.3, .1, -.3), V(.3, .3, .3)], aditivo: true }),
    ];
  }
  if (tipo === 'areia') {
    return [
      sistema(scene, 'areia', texturaDesenhada(scene, 'grao', 32, pontoMacio(.8, '235,205,160')), { max: 900, taxa: 120, tamanho: [.02, .05],
        vida: [2, 4], forca: [2.5, 4.5], caixa: [V(-22, .05, -4), V(-18, .9, 10)], cor: ['#ecd0a0cc', '#d8b88a88'], dir: [V(1, .02, -.05), V(1, .12, .05)], gravidade: V(0, -.3, 0) }),
    ];
  }
  // poeira suspensa na luz (academia, feira)
  const rgb = Color3.FromHexString(cfg.corPoeira || '#fff4e0');
  const cor = `${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)}`;
  return [
    sistema(scene, 'poeira', texturaDesenhada(scene, 'poeira', 32, pontoMacio(.9, cor)), { max: 300, taxa: 25, tamanho: [.025, .05],
      vida: [8, 14], forca: [.02, .07], caixa: [V(-12, .3, -3), V(12, 6, 8)], cor: [`${cfg.corPoeira || '#fff4e0'}99`, `${cfg.corPoeira || '#fff4e0'}55`], dir: [V(-.3, -.05, -.3), V(.3, .2, .3)], aditivo: true }),
  ];
}

export async function criarArenaRealista(nome, scene, apresentacao) {
  const cfg = CONFIG[nome];
  if (!cfg) throw new Error(`Arena realista desconhecida: ${nome}`);
  const base = `/arenas/${nome}/`;
  const raiz = new TransformNode(`arena-${nome}`, scene);
  const descartaveis = [];
  scene.getMeshByName('piso')?.setEnabled(false);
  scene.getMeshByName('limite-arena')?.setEnabled(false);

  // Luz da foto: ilumina lutadoras e cenário; as luzes de estúdio do
  // laboratório ficam mais fracas, senão as lutadoras estouram de claro.
  const anterior = { ambiente: scene.environmentTexture, intensidade: scene.environmentIntensity,
    nevoa: [scene.fogMode, scene.fogStart, scene.fogEnd, scene.fogColor.clone()] };
  // .env (cubo pré-filtrado em PNG RGBD, de gerar-env-arenas.cjs): funciona em
  // qualquer celular. O HDR em float chegava preto no iPhone (lutadora escura).
  const ambiente = CubeTexture.CreateFromPrefilteredData(base + 'ambiente.env', scene);
  scene.environmentTexture = ambiente; scene.environmentIntensity = cfg.luz[0];
  descartaveis.push(ambiente);
  const luzes = scene.lights.map(l => ({ l, i: l.intensity }));
  for (const { l } of luzes) l.intensity *= cfg.luz[1];

  // Fundo 360°, centro na altura da câmera (horizonte da foto no lugar).
  const domo = new PhotoDome(`${nome}-fundo`, base + 'fundo.jpg', { resolution: 48, size: 140, useDirectMapping: true }, scene);
  domo.mesh.parent = raiz; domo.mesh.rotation.y = cfg.giro; domo.mesh.position.y = 1.6;
  domo.imageMode = PhotoDome.MODE_MONOSCOPIC;
  domo.material.fogEnabled = false;   // a foto já tem a atmosfera dela
  descartaveis.push(domo);

  // Chão PBR com relevo.
  const [repetir, relevo, tom] = cfg.chao;
  const chao = MeshBuilder.CreateGround(`${nome}-chao`, { width: 90, height: 70 }, scene);
  chao.parent = raiz; chao.position.z = 18; chao.receiveShadows = true;
  const piso = new PBRMaterial(`${nome}-chao-mat`, scene);
  piso.albedoTexture = textura(scene, base + 'chao_cor.jpg', { repetir });
  piso.bumpTexture = textura(scene, base + 'chao_normal.jpg', { normal: true, repetir });
  piso.bumpTexture.level = relevo;
  piso.metallic = 0; piso.roughness = .85;
  piso.albedoColor = new Color3(...tom);
  chao.material = piso;
  // O chão 3D se desfaz ao fundo e revela o chão da própria foto (sem emenda
  // e sem névoa colorida por cima).
  const fade = new DynamicTexture(`${nome}-chao-fade`, { width: 4, height: 256 }, scene, false);
  { const g = fade.getContext(), grad = g.createLinearGradient(0, 0, 0, 256);
    // Chão de z = -17 a 53: opaco até z ≈ 8 (topo da imagem = fundo), some até z ≈ 14.
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(.557, 'rgba(0,0,0,0)'); grad.addColorStop(.643, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256); fade.update(); }
  fade.hasAlpha = true; fade.getAlphaFromRGB = true;
  piso.opacityTexture = fade; piso.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  piso.fogEnabled = false;
  descartaveis.push(piso, fade);
  if (cfg.efeito === 'chuva') { piso.roughness = .45; piso.environmentIntensity = .8; }   // chão molhado reflete (sem estourar)
  const pisoMonte = piso.clone(`${nome}-monte-mat`); pisoMonte.opacityTexture = null; pisoMonte.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
  descartaveis.push(pisoMonte);
  for (const [x, z, larg, alt, prof] of cfg.montes) {
    const monte = MeshBuilder.CreateSphere(`${nome}-monte`, { diameter: 1, segments: 24 }, scene);
    monte.parent = raiz; monte.material = pisoMonte; monte.receiveShadows = true;
    monte.scaling.set(larg, alt * 2, prof); monte.position.set(x, -alt * .55, z);
  }

  // Névoa linear, só depois das lutadoras (câmera a ~12-16 m da luta).
  const [ini, fim, corNevoa] = cfg.nevoa;
  scene.fogMode = Scene.FOGMODE_LINEAR; scene.fogStart = ini; scene.fogEnd = fim; scene.fogColor = new Color3(...corNevoa);
  scene.fogMode = Scene.FOGMODE_NONE;   // a foto dá a atmosfera; névoa só nos objetos distantes

  // Objetos 3D.
  const conteineres = new Map();
  for (const [arquivo] of cfg.pecas) {
    if (conteineres.has(arquivo)) continue;
    const c = await LoadAssetContainerAsync(`${base}${arquivo}.glb`, scene);
    conteineres.set(arquivo, c); descartaveis.push(c);
  }
  for (const [arquivo, x, z, escala, giro] of cfg.pecas) {
    const inst = conteineres.get(arquivo).instantiateModelsToScene(n => `${nome}-${n}`, false);
    const no = inst.rootNodes[0];
    no.parent = raiz; no.position.set(x, 0, z); no.scaling.scaleInPlace(escala); no.rotation = new Vector3(0, giro, 0);
    for (const m of no.getChildMeshes()) { m.receiveShadows = true; apresentacao?.projetarSombra?.(m); }
    descartaveis.push(...inst.rootNodes);
  }

  descartaveis.push(...efeitos(scene, cfg.efeito, cfg));
  globalThis.__arenaPronta = nome;
  return {
    atualizar() {},
    descartar() {
      for (const d of descartaveis) d.dispose?.();
      for (const { l, i } of luzes) l.intensity = i;
      raiz.dispose(false, true);
      scene.environmentTexture = anterior.ambiente; scene.environmentIntensity = anterior.intensidade;
      [scene.fogMode, scene.fogStart, scene.fogEnd] = anterior.nevoa; scene.fogColor = anterior.nevoa[3];
    },
  };
}
