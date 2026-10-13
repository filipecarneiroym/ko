import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';

// Arena "Academia" em 3D, com a identidade da versão 2D (ko-arte.js): paredes
// cinza-azuladas, janela com céu, letreiro neon K.O GYM, rack de halteres,
// supino, piso escuro com faixa vermelha e luzes no teto. Lutadores em z = 0,
// câmera em z < 0; o fundo fica em z > 0. A área de luta do motor tem
// 16 m (384 px / 24) com paredes a ±7,25 m: o cenário vai além disso para a
// câmera ortográfica não mostrar bordas.
export function criarArenaAcademia(scene, apresentacao) {
  const raiz = new TransformNode('arena-academia', scene);
  const mat = (nome, cor, { emissivo, especular = .08, textura } = {}) => {
    const m = new StandardMaterial(`academia-${nome}`, scene);
    m.diffuseColor = Color3.FromHexString(cor);
    m.specularColor = new Color3(especular, especular, especular);
    if (emissivo) m.emissiveColor = Color3.FromHexString(emissivo);
    if (textura) m.diffuseTexture = textura;
    return m;
  };
  const caixa = (nome, w, h, d, x, y, z, material, opcoes = {}) => {
    const m = MeshBuilder.CreateBox(nome, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z); m.material = material; m.parent = raiz;
    if (opcoes.sombra !== false) apresentacao?.projetarSombra?.(m);
    m.receiveShadows = true;
    return m;
  };
  const cilindro = (nome, diametro, altura, x, y, z, material, rot = {}) => {
    const m = MeshBuilder.CreateCylinder(nome, { diameter: diametro, height: altura, tessellation: 24 }, scene);
    m.position.set(x, y, z); m.material = material; m.parent = raiz;
    if (rot.x) m.rotation.x = rot.x;
    if (rot.z) m.rotation.z = rot.z;
    apresentacao?.projetarSombra?.(m);
    m.receiveShadows = true;
    return m;
  };

  // O piso e a linha provisórios da apresentação dão lugar ao piso da arena.
  scene.getMeshByName('piso')?.setEnabled(false);
  scene.getMeshByName('limite-arena')?.setEnabled(false);

  // Piso de borracha de academia: placas com juntas e leve granulado.
  const texPiso = new DynamicTexture('academia-piso-tex', { width: 1024, height: 512 }, scene, true);
  {
    const g = texPiso.getContext();
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#2c2e36'); grad.addColorStop(1, '#1b1c21');
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${.015 + r() * .03})`; g.fillRect(r() * 1024, r() * 512, 1.5, 1.5); }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
    for (let x = 0; x <= 1024; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    texPiso.update();
  }
  texPiso.wrapU = texPiso.wrapV = Texture.WRAP_ADDRESSMODE;
  texPiso.uScale = 3; texPiso.vScale = 1.5;
  const piso = MeshBuilder.CreateGround('academia-piso', { width: 30, height: 14 }, scene);
  piso.position.z = 2; piso.parent = raiz;
  piso.material = mat('piso', '#ffffff', { textura: texPiso, especular: .12 });
  piso.receiveShadows = true;
  // Faixa vermelha na frente da área de luta, como no 2D.
  const faixa = MeshBuilder.CreateGround('academia-faixa', { width: 30, height: .14 }, scene);
  faixa.position.set(0, .004, -2.2); faixa.parent = raiz;
  faixa.material = mat('faixa', '#e8383d', { emissivo: '#3a0607' });

  // Parede do fundo com gradiente e frisos verticais.
  const texParede = new DynamicTexture('academia-parede-tex', { width: 1024, height: 512 }, scene, true);
  {
    const g = texParede.getContext();
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#3a4054'); grad.addColorStop(.6, '#4d556c'); grad.addColorStop(1, '#5a637c');
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (let x = 0; x < 1024; x += 64) g.fillRect(x, 0, 4, 512);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 470, 1024, 42);        // rodapé
    texParede.update();
  }
  const parede = MeshBuilder.CreatePlane('academia-parede', { width: 30, height: 8 }, scene);
  parede.position.set(0, 4, 6); parede.parent = raiz;
  parede.material = mat('parede', '#ffffff', { textura: texParede, especular: 0 });
  parede.receiveShadows = true;
  // Paredes laterais em ângulo fecham o volume.
  for (const s of [-1, 1]) {
    const lado = MeshBuilder.CreatePlane(`academia-lateral-${s}`, { width: 10, height: 8 }, scene);
    lado.position.set(s * 13, 4, 2); lado.rotation.y = s * Math.PI / 2.6; lado.parent = raiz;
    lado.material = parede.material; lado.receiveShadows = true;
  }

  // Janela com céu (emissiva, ilumina o ambiente de leve).
  const texCeu = new DynamicTexture('academia-ceu', { width: 512, height: 256 }, scene, true);
  {
    const g = texCeu.getContext();
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#8fd0ff'); grad.addColorStop(1, '#d8f1ff');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (const [x, y, s] of [[120, 90, 1], [330, 60, .8], [420, 140, .6]]) {
      for (const [dx, dy, rr] of [[0, 0, 28], [30, -10, 34], [62, 2, 26], [28, 12, 30]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = 'rgba(255,255,255,.25)';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(60 + i * 120, 0); g.lineTo(100 + i * 120, 0); g.lineTo(20 + i * 120, 256); g.lineTo(-20 + i * 120, 256); g.fill(); }
    texCeu.update();
  }
  const janela = MeshBuilder.CreatePlane('academia-janela', { width: 4.6, height: 2.6 }, scene);
  janela.position.set(-5.2, 2.35, 5.96); janela.parent = raiz;
  // Emissivo abaixo de 1: com o tone mapping ACES o céu saturava em cinza.
  // A textura emissiva soma à cor emissiva: cor preta, só a textura acende.
  const vidro = mat('janela', '#000000', { emissivo: '#000000', especular: 0 });
  vidro.emissiveTexture = texCeu; vidro.disableLighting = true;
  // Fora do tone mapping ACES (o céu saturava em cinza chapado).
  vidro.imageProcessingConfiguration = new ImageProcessingConfiguration();
  vidro.imageProcessingConfiguration.toneMappingEnabled = false;
  vidro.imageProcessingConfiguration.isEnabled = false;
  janela.material = vidro;
  const moldura = mat('moldura', '#20232d');
  for (const [w, h, x, y] of [[4.9, .16, -5.2, 3.73], [4.9, .16, -5.2, .97], [.16, 2.9, -7.57, 2.35], [.16, 2.9, -2.83, 2.35], [.1, 2.6, -5.2, 2.35]])
    caixa('academia-moldura', w, h, .12, x, y, 5.92, moldura, { sombra: false });

  // Letreiro neon "K.O GYM".
  const texNeon = new DynamicTexture('academia-neon', { width: 1024, height: 256 }, scene, true);
  {
    const g = texNeon.getContext();
    g.fillStyle = '#121212'; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = '#ffcc00'; g.lineWidth = 12; g.strokeRect(14, 14, 996, 228);
    g.font = 'bold 150px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ffcc00'; g.shadowBlur = 30; g.fillStyle = '#ffd84d';
    g.fillText('K.O GYM', 512, 136);
    texNeon.update();
  }
  const placa = MeshBuilder.CreatePlane('academia-letreiro', { width: 4.4, height: 1.1 }, scene);
  placa.position.set(3.6, 2.45, 5.9); placa.parent = raiz;
  const neon = mat('letreiro', '#000000', { emissivo: '#000000', especular: 0 });
  neon.emissiveTexture = texNeon; neon.disableLighting = true;
  neon.imageProcessingConfiguration = new ImageProcessingConfiguration();
  neon.imageProcessingConfiguration.isEnabled = false;
  placa.material = neon;
  const luzNeon = new PointLight('academia-luz-neon', new Vector3(3.6, 2.2, 5), scene);
  luzNeon.diffuse = Color3.FromHexString('#ffd25a'); luzNeon.intensity = .55; luzNeon.range = 7;

  // Rack de halteres sob o letreiro.
  const metal = mat('metal', '#6c7280', { especular: .5 });
  const ferro = mat('ferro', '#16171c', { especular: .35 });
  const cromo = mat('cromo', '#9aa0ad', { especular: .8 });
  caixa('academia-rack-topo', 4.2, .1, .7, 3.6, 1.35, 4.9, metal);
  caixa('academia-rack-base', 4.2, .1, .7, 3.6, .75, 4.9, metal);
  for (const x of [1.6, 5.6]) caixa('academia-rack-pe', .12, 1.4, .7, x, .7, 4.9, metal);
  for (let i = 0; i < 6; i++) for (const y of [1.58, .98]) {
    const x = 1.95 + i * .66;
    cilindro('academia-halter-barra', .07, .5, x, y, 4.9, cromo, { x: Math.PI / 2 });
    for (const dz of [-.2, .2]) cilindro('academia-halter-anilha', .26 - i * .012, .1, x, y, 4.9 + dz, ferro, { x: Math.PI / 2 });
  }

  // Supino com barra e anilhas.
  caixa('academia-banco', 1.7, .14, .5, -1.6, .62, 4.2, ferro);
  for (const x of [-2.25, -.95]) caixa('academia-banco-pe', .1, .55, .45, x, .28, 4.2, metal);
  for (const x of [-2.3, -.9]) caixa('academia-suporte', .08, 1.3, .08, x, .65, 4.55, metal);
  cilindro('academia-barra', .06, 2.4, -1.6, 1.25, 4.55, cromo, { z: Math.PI / 2 });
  for (const x of [-2.55, -.65]) cilindro('academia-anilha', .7, .1, x, 1.25, 4.55, ferro, { z: Math.PI / 2 });

  // Sacos de pancada nas laterais (profundidade e leitura de academia de luta).
  const couro = mat('saco', '#7d1d22', { especular: .25 });
  for (const x of [-9.4, 9.4]) {
    cilindro('academia-saco', .75, 1.9, x, 2.6, 3.2, couro);
    cilindro('academia-saco-corrente', .04, 1.6, x, 4.35, 3.2, cromo);
  }

  // Luminárias no teto: barras emissivas + luz de preenchimento quente.
  const lampada = mat('lampada', '#000000', { emissivo: '#fff6dc', especular: 0 });
  lampada.disableLighting = true;
  for (const x of [-6, -2, 2, 6]) caixa('academia-luminaria', 2.2, .08, .35, x, 7.7, 2.5, lampada, { sombra: false });

  const brilho = new GlowLayer('academia-brilho', scene, { mainTextureSamples: 2, blurKernelSize: 24 });
  brilho.intensity = .3;
  brilho.addIncludedOnlyMesh(placa);
  brilho.addIncludedOnlyMesh(faixa);
  for (const m of scene.meshes) if (m.name === 'academia-luminaria') brilho.addIncludedOnlyMesh(m);

  return {
    raiz,
    descartar() { brilho.dispose(); luzNeon.dispose(); raiz.dispose(false, true); },
  };
}
