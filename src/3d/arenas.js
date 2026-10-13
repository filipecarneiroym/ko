import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { criarArenaAcademia } from './arena-academia.js';
import { criarArenaNeve } from './arena-neve.js';

// As seis arenas do jogo em 3D, com a identidade de cada cenário 2D
// (CENARIOS em ko-arte.js). Lutadores em z = 0; câmera ortográfica em z < 0
// olhando levemente de cima: quanto mais ao fundo (z), mais alto o objeto
// aparece. O fundo fica entre z = 4 e z = 16.
export const ARENAS = Object.freeze(['academia', 'praia', 'telhado', 'floresta', 'feira', 'neve']);

function semente(n) { let s = n; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function base(scene, nome, apresentacao) {
  const raiz = new TransformNode(`arena-${nome}`, scene);
  const descartaveis = [], cache = new Map();
  // Materiais sem textura são reaproveitados (centenas de pinheiros e frutas
  // não podem virar centenas de materiais no celular).
  const mat = (id, cor, opcoes = {}) => {
    const chave = opcoes.textura ? null : JSON.stringify([id, cor, opcoes]);
    if (chave && cache.has(chave)) return cache.get(chave);
    const m = novoMat(id, cor, opcoes);
    if (chave) cache.set(chave, m);
    return m;
  };
  const novoMat = (id, cor, { emissivo, especular = .06, textura, alpha, luz = true } = {}) => {
    const m = new StandardMaterial(`${nome}-${id}`, scene);
    m.diffuseColor = Color3.FromHexString(cor);
    m.specularColor = new Color3(especular, especular, especular);
    if (emissivo) m.emissiveColor = Color3.FromHexString(emissivo);
    if (textura) { m.diffuseTexture = textura; if (textura.hasAlpha) m.useAlphaFromDiffuseTexture = true; }
    if (alpha !== undefined) m.alpha = alpha;
    if (!luz) m.disableLighting = true;
    return m;
  };
  // Material só emissivo (céu, letreiros, janelas): a textura soma à cor
  // emissiva, então a cor fica preta e só a textura acende.
  const brilho = (id, textura) => {
    const m = new StandardMaterial(`${nome}-${id}`, scene);
    m.disableLighting = true; m.diffuseColor = new Color3(0, 0, 0); m.emissiveColor = new Color3(0, 0, 0);
    m.emissiveTexture = textura; if (textura.hasAlpha) { m.opacityTexture = textura; }
    return m;
  };
  const tex = (id, w, h, desenhar, { alpha = false } = {}) => {
    const t = new DynamicTexture(`${nome}-${id}`, { width: w, height: h }, scene, true);
    t.hasAlpha = alpha;
    const g = t.getContext();
    g.clearRect(0, 0, w, h);
    desenhar(g, w, h);
    t.update();
    return t;
  };
  const sombra = m => { apresentacao?.projetarSombra?.(m); m.receiveShadows = true; return m; };
  const pai = m => { m.parent = raiz; m.isPickable = false; return m; };
  const caixa = (id, w, h, d, x, y, z, material, comSombra = true) => {
    const m = pai(MeshBuilder.CreateBox(`${nome}-${id}`, { width: w, height: h, depth: d }, scene));
    m.position.set(x, y, z); m.material = material;
    if (comSombra) sombra(m); else m.receiveShadows = true;
    return m;
  };
  const cilindro = (id, dTopo, dBase, h, x, y, z, material, opcoes = {}) => {
    const m = pai(MeshBuilder.CreateCylinder(`${nome}-${id}`, { diameterTop: dTopo, diameterBottom: dBase, height: h, tessellation: opcoes.lados || 18 }, scene));
    m.position.set(x, y, z); m.material = material;
    if (opcoes.rx) m.rotation.x = opcoes.rx;
    if (opcoes.rz) m.rotation.z = opcoes.rz;
    if (opcoes.sombra !== false) sombra(m);
    return m;
  };
  const plano = (id, w, h, x, y, z, material) => {
    const m = pai(MeshBuilder.CreatePlane(`${nome}-${id}`, { width: w, height: h }, scene));
    m.position.set(x, y, z); m.material = material;
    return m;
  };
  const chao = (id, textura, { largura = 34, profundidade = 18, uScale = 4, vScale = 2 } = {}) => {
    textura.wrapU = textura.wrapV = Texture.WRAP_ADDRESSMODE;
    textura.uScale = uScale; textura.vScale = vScale;
    const m = pai(MeshBuilder.CreateGround(`${nome}-${id}`, { width: largura, height: profundidade }, scene));
    m.position.z = profundidade / 2 - 3; m.material = mat(id, '#ffffff', { textura, especular: .04 });
    m.receiveShadows = true;
    return m;
  };
  // Céu: plano grande no fundo, gradiente vertical desenhado.
  const ceu = (cores, extra) => {
    const t = tex('ceu', 512, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      cores.forEach((c, i) => grad.addColorStop(i / (cores.length - 1), c));
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      extra?.(g, w, h);
    });
    const m = plano('ceu', 70, 30, 0, 8, 16, brilho('ceu', t));
    return m;
  };
  const glow = (intensidade = .5) => {
    const gl = new GlowLayer(`${nome}-brilho`, scene, { mainTextureSamples: 2, blurKernelSize: 32 });
    gl.intensity = intensidade; descartaveis.push(gl);
    return gl;
  };
  const particulas = (id, textura, opcoes) => {
    const ps = new ParticleSystem(`${nome}-${id}`, opcoes.max || 400, scene);
    ps.particleTexture = textura; ps.emitter = opcoes.emissor;
    ps.minEmitBox = opcoes.caixaMin; ps.maxEmitBox = opcoes.caixaMax;
    ps.color1 = Color4.FromHexString(opcoes.cor1); ps.color2 = Color4.FromHexString(opcoes.cor2); ps.colorDead = Color4.FromHexString(opcoes.morta || '#00000000');
    ps.minSize = opcoes.tamanho[0]; ps.maxSize = opcoes.tamanho[1];
    ps.minLifeTime = opcoes.vida[0]; ps.maxLifeTime = opcoes.vida[1];
    ps.emitRate = opcoes.taxa; ps.gravity = opcoes.gravidade || Vector3.Zero();
    ps.direction1 = opcoes.dir1; ps.direction2 = opcoes.dir2;
    ps.minEmitPower = opcoes.forca?.[0] ?? .3; ps.maxEmitPower = opcoes.forca?.[1] ?? .8;
    ps.minAngularSpeed = -1; ps.maxAngularSpeed = 1;
    if (opcoes.blend) ps.blendMode = opcoes.blend;
    ps.preWarmCycles = 200; ps.preWarmStepOffset = 4;
    ps.start(); descartaveis.push(ps);
    return ps;
  };
  const pontoTex = (id, cor, forma = 'disco') => tex(id, 64, 64, (g) => {
    if (forma === 'folha') {
      g.fillStyle = cor; g.beginPath(); g.ellipse(32, 32, 26, 12, .5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 44); g.lineTo(54, 20); g.stroke();
    } else {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, cor); grad.addColorStop(.6, cor); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    }
  }, { alpha: true });
  // Pinheiro: tronco + três cones.
  const pinheiro = (id, x, z, altura, corFolha, neve = false) => {
    const folha = mat(`pinheiro-folha-${corFolha}`, corFolha, { especular: .02 });
    const branco = neve ? mat('pinheiro-neve', '#f4f9ff', { especular: .1 }) : null;
    cilindro(`${id}-tronco`, .16, .22, altura * .3, x, altura * .15, z, mat('tronco', '#5a3a22'));
    for (let k = 0; k < 3; k++) {
      const h = altura * (.42 - k * .06), y = altura * (.32 + k * .2) + h / 2, d = altura * (.42 - k * .1);
      cilindro(`${id}-copa-${k}`, 0, d, h, x, y, z, folha, { lados: 10 });
      if (neve) cilindro(`${id}-neve-${k}`, 0, d * .55, h * .42, x, y + h * .3, z, branco, { lados: 10 });
    }
  };
  // Palmeira: tronco curvo em segmentos e folhas em leque.
  const palmeira = (id, x, z, altura, lado) => {
    const tronco = mat('palmeira-tronco', '#8a6238'), folha = mat('palmeira-folha', '#2f8a3e', { especular: .04 });
    let px = x, py = 0;
    for (let k = 0; k < 7; k++) {
      const h = altura / 7, ang = lado * (.05 + k * .045);
      const seg = cilindro(`${id}-t${k}`, .2 - k * .015, .24 - k * .015, h * 1.05, px, py + h / 2, z, tronco, { lados: 8 });
      seg.rotation.z = -ang;
      px += Math.sin(ang) * h; py += Math.cos(ang) * h;
    }
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2;
      const f = pai(MeshBuilder.CreateBox(`${nome}-${id}-f${k}`, { width: 1.8, height: .05, depth: .42 }, scene));
      f.material = folha; f.position.set(px + Math.cos(a) * .8, py - .25, z + Math.sin(a) * .8);
      f.rotation.y = -a; f.rotation.z = -.45; sombra(f);
    }
    cilindro(`${id}-cocos`, .3, .3, .25, px, py - .1, z, mat('coco', '#5a3a1e'), { lados: 8 });
  };
  return { scene, raiz, mat, brilho, tex, caixa, cilindro, plano, chao, ceu, glow, particulas, pontoTex, pinheiro, palmeira, descartaveis, sombra, pai };
}

// ---------------------------------------------------------------- praia --
function praia(scene, apresentacao) {
  const a = base(scene, 'praia', apresentacao);
  a.ceu(['#2b1450', '#5a1f73', '#b0336e', '#f5795f', '#ffc867'], (g, w, h) => {
    // Sol meio-poente com faixas.
    const cx = w * .66, cy = h * .58;
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, 160); halo.addColorStop(0, 'rgba(255,220,140,.6)'); halo.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    const sol = g.createLinearGradient(0, cy - 70, 0, cy); sol.addColorStop(0, '#fff2b0'); sol.addColorStop(1, '#ff9a3c');
    g.fillStyle = sol; g.beginPath(); g.arc(cx, cy, 70, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(176,51,110,.9)'; for (const [y, hh] of [[-34, 4], [-20, 5], [-8, 6]]) g.fillRect(cx - 72, cy + y, 144, hh);
    g.fillStyle = 'rgba(255,190,200,.4)';
    for (const [x, y, s] of [[90, 120, 1], [400, 80, .7]]) for (const [dx, dy, r] of [[0, 0, 26], [28, -8, 32], [58, 2, 24]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
  });
  // Mar: faixa larga ao fundo com ondas animadas (textura que desliza).
  const texMar = a.tex('mar', 512, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#5b3a9a'); grad.addColorStop(.5, '#3354b0'); grad.addColorStop(1, '#1f62b6');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 3;
    const r = semente(5);
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 4, x + 34, y); g.stroke(); }
    g.fillStyle = 'rgba(255,233,161,.5)'; for (let i = 0; i < 6; i++) g.fillRect(330 - (40 - i * 5), 10 + i * 22, 2 * (40 - i * 5), 3);
  });
  texMar.wrapU = Texture.WRAP_ADDRESSMODE; texMar.uScale = 3;
  const mar = a.pai(MeshBuilder.CreateGround('praia-mar', { width: 70, height: 10 }, scene));
  mar.position.set(0, .02, 12); mar.material = a.brilho('mar', texMar);
  // Espuma na beira.
  const espuma = a.plano('espuma', 70, .25, 0, .04, 7.05, a.mat('espuma', '#ffffff', { emissivo: '#bbbbbb' }));
  espuma.rotation.x = Math.PI / 2;
  // Areia.
  const texAreia = a.tex('areia', 512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#f6dc9c'); grad.addColorStop(1, '#d9b070');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const r = semente(7);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(150,100,50,${.1 + r() * .25})`; g.fillRect(r() * w, r() * h, 2, 2); }
  });
  const areia = a.chao('areia', texAreia, { profundidade: 10.5 });
  areia.position.z = 1.9;
  // Palmeiras e guarda-sol.
  a.palmeira('palmeira-1', -10.5, 4.5, 5.2, 1);
  a.palmeira('palmeira-2', 10.2, 4.2, 4.8, -1);
  a.palmeira('palmeira-3', -7.4, 6, 3.8, 1);
  const rosa = a.mat('guarda-sol', '#ff6fb1'), branco = a.mat('branco', '#ffffff');
  a.cilindro('guarda-sol-haste', .06, .06, 2.4, 6.4, 1.2, 4.2, a.mat('haste', '#6b4530'));
  const copa = a.cilindro('guarda-sol-copa', 0, 2.6, .7, 6.4, 2.5, 4.2, rosa, { lados: 12 });
  a.cilindro('guarda-sol-faixa', 0, 2.62, .25, 6.4, 2.72, 4.2, branco, { lados: 12 });
  void copa;
  a.caixa('toalha', 1.4, .03, 2.2, 5.2, .02, 3.6, a.mat('toalha', '#3a6cf0'), false);
  // Gaivotas: pares de asas que planam no céu.
  const gaivotas = [0, 1, 2].map(i => {
    const n = new TransformNode(`praia-gaivota-${i}`, scene); n.parent = a.raiz;
    for (const s of [-1, 1]) {
      const asa = a.pai(MeshBuilder.CreateBox(`praia-asa-${i}-${s}`, { width: .5, height: .04, depth: .12 }, scene));
      asa.parent = n; asa.position.x = s * .24; asa.material = a.mat('gaivota', '#2b1450', { luz: false, emissivo: '#2b1450' });
      asa.metadata = s;
    }
    return { n, fase: i * 2.1, vel: .35 + i * .08, alt: 5.8 + i * .7, z: 12 };
  });
  return {
    raiz: a.raiz, descartaveis: a.descartaveis,
    atualizar(t) {
      texMar.uOffset = (t * .0006) % 1;
      espuma.position.z = 7.05 + Math.sin(t * .03) * .12;
      for (const gv of gaivotas) {
        gv.n.position.set(((t * gv.vel * .02 + gv.fase * 5) % 30) - 15, gv.alt + Math.sin(t * .02 + gv.fase) * .3, gv.z);
        for (const asa of gv.n.getChildren()) asa.rotation.z = asa.metadata * Math.sin(t * .15 + gv.fase) * .5;
      }
    },
  };
}

// -------------------------------------------------------------- telhado --
function telhado(scene, apresentacao) {
  const a = base(scene, 'telhado', apresentacao);
  const r = semente(3);
  const estrelas = Array.from({ length: 90 }, () => [r() * 512, r() * 300, r()]);
  const texCeu = a.tex('ceu-noite', 512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    ['#05041a', '#0e0b33', '#1f1757', '#3a2672'].forEach((c, i) => grad.addColorStop(i / 3, c));
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const halo = g.createRadialGradient(400, 110, 0, 400, 110, 90); halo.addColorStop(0, 'rgba(255,246,201,.4)'); halo.addColorStop(1, 'rgba(255,246,201,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(400, 110, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200,190,140,.5)'; for (const [dx, dy, rr] of [[-8, -6, 6], [9, 8, 5], [-4, 12, 3]]) { g.beginPath(); g.arc(400 + dx, 110 + dy, rr, 0, Math.PI * 2); g.fill(); }
  });
  const ceu = a.plano('ceu', 70, 30, 0, 8, 16, a.brilho('ceu', texCeu));
  // Estrelas piscando (pontinhos emissivos).
  const matEstrela = a.mat('estrela', '#ffffff', { emissivo: '#ffffff', luz: false });
  const pontos = estrelas.map(([x, y, k], i) => {
    const m = a.plano(`estrela-${i}`, .05, .05, (x / 512 - .5) * 40, 14 - y / 300 * 7, 15.5, matEstrela);
    m.metadata = k; return m;
  });
  void ceu;
  // Prédios: duas fileiras, janelas desenhadas em textura emissiva com
  // luzes que apagam e acendem.
  const texJanelas = a.tex('janelas', 256, 512, (g, w, h) => {
    g.fillStyle = '#1b1646'; g.fillRect(0, 0, w, h);
    const rr = semente(9);
    for (let y = 10; y < h - 10; y += 22) for (let x = 10; x < w - 10; x += 20) {
      const k = rr(); if (k > .45) continue;
      g.fillStyle = k < .2 ? '#ffd166' : '#ffb347'; g.fillRect(x, y, 10, 13);
    }
  });
  texJanelas.wrapU = texJanelas.wrapV = Texture.WRAP_ADDRESSMODE;
  const matPredio = a.mat('predio', '#ffffff', { especular: .02 });
  matPredio.diffuseTexture = texJanelas; matPredio.emissiveTexture = texJanelas; matPredio.emissiveColor = new Color3(0, 0, 0);
  const matFundo = a.mat('predio-fundo', '#17123d', { especular: 0 });
  let x = -18;
  while (x < 18) {
    const w = 1.4 + r() * 1.6, h = 3 + r() * 4;
    a.caixa('predio-fundo', w, h, 1, x + w / 2, h / 2 - 1, 13, matFundo, false);
    x += w + .15;
  }
  x = -17;
  while (x < 17) {
    const w = 1.8 + r() * 1.8, h = 2 + r() * 3.4;
    const p = a.caixa('predio', w, h, 1.2, x + w / 2, h / 2 - 1.2, 10, matPredio, false);
    p.scaling.y = 1;
    x += w + .3;
  }
  // Telhado onde a luta acontece: laje com borda.
  const texLaje = a.tex('laje', 512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#54477e'); grad.addColorStop(1, '#2e2552');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 3;
    for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  });
  a.chao('laje', texLaje, { profundidade: 10 }).position.z = 1.5;
  a.caixa('mureta', 34, .4, .3, 0, .2, 6.6, a.mat('mureta', '#7a69aa'));
  // Caixa d'água, antena com luz e letreiro neon "K.O".
  const metal = a.mat('caixa-agua', '#2b2350');
  a.cilindro('caixa-agua', 1.4, 1.4, 1.5, -8.6, 1.95, 5.2, metal);
  a.cilindro('caixa-agua-tampa', .2, 1.6, .4, -8.6, 2.9, 5.2, a.mat('caixa-agua-topo', '#3a3068'));
  for (const dx of [-.5, .5]) a.caixa('caixa-agua-pe', .12, 1.2, .12, -8.6 + dx, .6, 5.2, metal);
  a.cilindro('antena', .05, .05, 3, 8.4, 1.5, 5.5, metal);
  a.caixa('antena-barra', .8, .05, .05, 8.4, 2.4, 5.5, metal);
  const luzAntena = a.pai(MeshBuilder.CreateSphere('telhado-luz-antena', { diameter: .14 }, scene));
  luzAntena.position.set(8.4, 3.05, 5.5); luzAntena.material = a.mat('luz-antena', '#000000', { emissivo: '#ff3b3b', luz: false });
  const texNeon = a.tex('neon', 512, 192, (g, w, h) => {
    g.fillStyle = '#1f1430'; g.fillRect(0, 0, w, h);
    g.font = '900 140px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff4fd8'; g.shadowBlur = 24; g.fillStyle = '#ff8ae6'; g.fillText('K.O', w / 2, h / 2 + 6);
  });
  const neon = a.plano('neon', 3, 1.1, 0, 3.2, 9.3, a.brilho('neon', texNeon));
  const gl = a.glow(.6); gl.addIncludedOnlyMesh(neon); gl.addIncludedOnlyMesh(luzAntena);
  const luzNeon = new PointLight('telhado-luz-neon', new Vector3(0, 3, 8), scene);
  luzNeon.diffuse = Color3.FromHexString('#ff6fe0'); luzNeon.intensity = .5; luzNeon.range = 10;
  a.descartaveis.push(luzNeon);
  return {
    raiz: a.raiz, descartaveis: a.descartaveis,
    atualizar(t) {
      for (const p of pontos) p.visibility = .35 + .65 * Math.abs(Math.sin(t / 30 + p.metadata * 10));
      const aceso = Math.floor(t / 25) % 7 !== 0;
      neon.visibility = aceso ? 1 : .25; luzNeon.intensity = aceso ? .5 : .1;
      luzAntena.visibility = Math.floor(t / 30) % 2 ? 1 : .2;
      texJanelas.vOffset = Math.floor(t / 600) * .17;   // algumas janelas trocam de tempos em tempos
    },
  };
}

// ------------------------------------------------------------- floresta --
function floresta(scene, apresentacao) {
  const a = base(scene, 'floresta', apresentacao);
  a.ceu(['#a8ecdf', '#86d6c0', '#6cc0a2'], (g, w, h) => {
    const halo = g.createRadialGradient(w * .73, h * .2, 0, w * .73, h * .2, 220); halo.addColorStop(0, 'rgba(255,255,220,.7)'); halo.addColorStop(1, 'rgba(255,255,220,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
  });
  const r = semente(9);
  // Três camadas de pinheiros (claro ao fundo, escuro à frente).
  for (const [z, cor, alt, passo] of [[14, '#7fbca0', 5, 1.6], [10.5, '#4f9a7a', 5.6, 2], [7, '#2a6e55', 6.2, 2.6]]) {
    for (let x = -17; x < 17; x += passo) a.pinheiro(`pinheiro-${z}-${x.toFixed(1)}`, x + r() * .8, z + r() * .8, alt + r() * 1.5, cor);
  }
  // Feixes de luz entre as árvores.
  const matLuz = a.mat('feixe', '#fffbe0', { emissivo: '#fffbe0', luz: false, alpha: .13 });
  const feixes = [-6, 1, 7].map((x, i) => { const f = a.plano(`feixe-${i}`, 1.2, 9, x, 4.2, 5.5, matLuz); f.rotation.z = -.38; return f; });
  // Grama.
  const texGrama = a.tex('grama', 512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#6db043'); grad.addColorStop(1, '#4a8a2c');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const rr = semente(11); g.strokeStyle = '#8fd060'; g.lineWidth = 2;
    for (let i = 0; i < 1600; i++) { const x = rr() * w, y = rr() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rr() - .5) * 4, y - 4 - rr() * 6); g.stroke(); }
  });
  a.chao('grama', texGrama);
  // Tronco caído e cogumelo vermelho de bolinhas.
  const tronco = a.cilindro('tronco-caido', .7, .7, 3.2, -7.2, .35, 3.2, a.mat('tronco-caido', '#6b4226'), { rz: Math.PI / 2 });
  void tronco;
  a.cilindro('tronco-corte', .62, .62, .02, -5.59, .35, 3.2, a.mat('corte', '#c9a06a'), { rz: Math.PI / 2 });
  a.cilindro('cogumelo-pe', .22, .26, .6, 6.8, .3, 3, a.mat('cogumelo-pe', '#efe4c8'));
  const chapeu = a.pai(MeshBuilder.CreateSphere('floresta-cogumelo', { diameter: 1.1, slice: .5 }, scene));
  chapeu.position.set(6.8, .55, 3); chapeu.material = a.mat('cogumelo', '#e04a3a', { especular: .2 }); a.sombra(chapeu);
  for (const [dx, dy, dz] of [[-.2, .35, -.25], [.25, .4, -.1], [0, .48, .1], [.3, .25, -.3]]) {
    const b = a.pai(MeshBuilder.CreateSphere('floresta-bolinha', { diameter: .13 }, scene));
    b.position.set(6.8 + dx, .55 + dy, 3 + dz); b.material = a.mat('bolinha', '#ffffff');
  }
  // Folhas caindo e vaga-lume.
  a.particulas('folhas', a.pontoTex('folha', '#e8a33a', 'folha'), {
    emissor: new Vector3(0, 7, 3), caixaMin: new Vector3(-14, 0, -2), caixaMax: new Vector3(14, 1, 5),
    cor1: '#e8a33aff', cor2: '#d2622eff', morta: '#d2622e00', tamanho: [.14, .26], vida: [6, 10], taxa: 6,
    gravidade: new Vector3(0, -.25, 0), dir1: new Vector3(-.4, -.2, 0), dir2: new Vector3(.4, -.4, 0), forca: [.2, .5],
  });
  const vagalume = a.pai(MeshBuilder.CreateSphere('floresta-vagalume', { diameter: .1 }, scene));
  vagalume.material = a.mat('vagalume', '#000000', { emissivo: '#fff078', luz: false });
  const gl = a.glow(.8); gl.addIncludedOnlyMesh(vagalume);
  return {
    raiz: a.raiz, descartaveis: a.descartaveis,
    atualizar(t) {
      vagalume.position.set(3.5 + Math.sin(t / 30) * 1.6, 1.4 + Math.cos(t / 20) * .3, 2.5);
      vagalume.visibility = .6 + .4 * Math.sin(t / 5);
      feixes.forEach((f, i) => { f.visibility = .8 + .2 * Math.sin(t / 40 + i); });
    },
  };
}

// ---------------------------------------------------------------- feira --
function feira(scene, apresentacao) {
  const a = base(scene, 'feira', apresentacao);
  a.ceu(['#3aa8ff', '#7cceff', '#bfe8ff'], (g, w) => {
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (const [x, y, s] of [[60, 70, 1], [300, 40, .8], [450, 100, .7]]) for (const [dx, dy, rr] of [[0, 0, 26], [28, -10, 32], [60, 2, 26], [30, 12, 30]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2); g.fill(); }
    void w;
  });
  // Prédio creme com telhado de telha e janelas, ao fundo.
  const texFachada = a.tex('fachada', 1024, 256, (g, w, h) => {
    g.fillStyle = '#f3e4c4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c45a3d'; g.fillRect(0, 0, w, 26);
    for (let x = 24; x < w; x += 128) {
      g.fillStyle = '#7fb0c9'; g.fillRect(x + 24, 70, 56, 90);
      g.fillStyle = '#ffffff'; g.fillRect(x + 50, 70, 5, 90);
      g.fillStyle = '#d9c39b'; g.fillRect(x + 16, 160, 72, 10);
    }
  });
  a.plano('fachada', 34, 5.2, 0, 3, 11, a.mat('fachada', '#ffffff', { textura: texFachada, especular: 0 }));
  // Pessoas ao fundo: silhuetas simples (cápsulas coloridas).
  const coresPessoa = ['#e8383d', '#2fb36b', '#3a6cf0', '#ffb400', '#ff6fb1', '#7a4fd6', '#3aa8ff'];
  const pessoas = coresPessoa.map((cor, i) => {
    const p = a.pai(MeshBuilder.CreateCapsule(`feira-pessoa-${i}`, { radius: .22, height: 1.3 }, scene));
    p.position.set(-12 + i * 4, .65, 9); p.material = a.mat(`pessoa-${i}`, cor);
    const cab = a.pai(MeshBuilder.CreateSphere(`feira-cabeca-${i}`, { diameter: .34 }, scene));
    cab.parent = p; cab.position.y = .82; cab.material = a.mat('pele', '#e8b48a');
    return p;
  });
  // Cinco barracas com toldo listrado e caixote de frutas.
  const cores = [['#e8383d', '#ffffff'], ['#2fb36b', '#fff5c2'], ['#ffb400', '#ffffff'], ['#3a6cf0', '#ffffff'], ['#ff6fb1', '#ffffff']];
  const madeira = a.mat('madeira', '#6b4a2e'), caixote = a.mat('caixote', '#9a6a3c');
  const frutas = ['#ff4b3e', '#ffd23f', '#7bd651', '#ff9a2e', '#b04ad6'].map((c, i) => a.mat(`fruta-${i}`, c, { especular: .3 }));
  const rr = semente(20);
  cores.forEach(([c1, c2], i) => {
    const x = -12 + i * 6, z = 5.8;
    const listras = a.tex(`toldo-${i}`, 256, 64, (g, w, h) => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? c2 : c1; g.fillRect(k * 32, 0, 32, h); } });
    const toldo = a.caixa(`toldo-${i}`, 4.4, .08, 1.8, x, 3.1, z, a.mat(`toldo-${i}`, '#ffffff', { textura: listras }));
    toldo.rotation.x = -.18;
    // Babado do toldo.
    a.caixa(`babado-${i}`, 4.4, .35, .04, x, 2.85, z - .92, a.mat(`babado-${i}`, '#ffffff', { textura: listras }), false);
    for (const dx of [-2, 2]) for (const dz of [-.8, .8]) a.caixa(`poste-${i}`, .12, 3.1, .12, x + dx, 1.55, z + dz, madeira);
    a.caixa(`balcao-${i}`, 3.8, .9, 1.2, x, .45, z, caixote);
    for (let f = 0; f < 22; f++) {
      const fr = a.pai(MeshBuilder.CreateSphere(`feira-fruta-${i}-${f}`, { diameter: .2 }, scene));
      fr.position.set(x - 1.6 + rr() * 3.2, .98 + rr() * .08, z - .4 + rr() * .8); fr.material = frutas[(rr() * 5) | 0];
    }
  });
  // Bandeirinhas num varal que balança.
  const coresBand = ['#e8383d', '#ffd23f', '#2fb36b', '#3a6cf0', '#ff6fb1'];
  const bandeiras = [];
  for (let k = 0; k < 44; k++) {
    const b = a.pai(MeshBuilder.CreateDisc(`feira-bandeira-${k}`, { radius: .22, tessellation: 3 }, scene));
    b.material = a.mat(`bandeira-${k % 5}`, coresBand[k % 5]);
    b.material.backFaceCulling = false;
    b.rotation.z = -Math.PI / 2; bandeiras.push(b);
  }
  // Calçamento de pedra.
  const texPedra = a.tex('pedra', 512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#c4bcae'); grad.addColorStop(1, '#a29a8a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,72,60,.45)'; g.lineWidth = 3;
    for (let y = 0; y < h; y += 32) for (let x = ((y / 32) % 2) * 32 - 32; x < w; x += 64) { g.beginPath(); g.roundRect(x + 3, y + 3, 58, 26, 10); g.stroke(); }
  });
  a.chao('pedra', texPedra, { uScale: 6, vScale: 3 });
  return {
    raiz: a.raiz, descartaveis: a.descartaveis,
    atualizar(t) {
      bandeiras.forEach((b, k) => {
        const x = -17 + k * .78, fase = ((x + 17) % 6.4) / 6.4;
        b.position.set(x, 4.6 - Math.sin(fase * Math.PI) * (.55 + Math.sin(t / 30) * .08), 4.2);
        b.rotation.x = Math.sin(t / 12 + k * .7) * .35;
      });
      pessoas.forEach((p, i) => { p.position.y = .65 + Math.abs(Math.sin(t / 18 + i)) * .05; p.position.x = -12 + i * 4 + Math.sin(t / 90 + i) * .6; });
    },
  };
}

// ----------------------------------------------------------------- neve --
function neve(scene, apresentacao) {
  const a = base(scene, 'neve', apresentacao);
  a.ceu(['#7aa6e0', '#a8c6ef', '#dbe8fa']);
  // Montanhas com pico nevado.
  const rocha = a.mat('montanha', '#6a7eab', { especular: .02 }), rochaEsc = a.mat('montanha-escura', '#5a6d98', { especular: .02 });
  const neveMat = a.mat('neve-pico', '#ffffff', { especular: .15 });
  for (const [x, z, alt, larg, m] of [[-11, 14, 7, 9, rocha], [0, 15, 8.6, 11, rochaEsc], [11, 14, 6.4, 8, rocha]]) {
    a.cilindro(`montanha-${x}`, 0, larg, alt, x, alt / 2 - 1.2, z, m, { lados: 7, sombra: false });
    a.cilindro(`pico-${x}`, 0, larg * .3, alt * .3, x, alt - 1.2 - alt * .15 + .02, z, neveMat, { lados: 7, sombra: false });
  }
  const r = semente(4);
  for (let x = -17; x < 17; x += 2.2) a.pinheiro(`pinheiro-${x.toFixed(1)}`, x + r() * .6, 8 + r() * 1.5, 3.6 + r() * 1.6, '#2e5a5a', true);
  // Chão de neve com marcas de vento.
  const texNeve = a.tex('chao-neve', 512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#f4f9ff'); grad.addColorStop(1, '#d3e2f5');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(140,175,220,.5)'; g.lineWidth = 3;
    const rr = semente(6);
    for (let i = 0; i < 30; i++) { const x = rr() * w, y = rr() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 50, y); g.stroke(); }
  });
  a.chao('chao-neve', texNeve);
  // Bonecos de neve nas laterais.
  const branco = a.mat('boneco', '#ffffff', { especular: .15 });
  for (const x of [-9.5, 9.8]) {
    for (const [d, y] of [[1.1, .5], [.8, 1.35], [.55, 1.95]]) { const s = a.pai(MeshBuilder.CreateSphere('neve-boneco', { diameter: d }, scene)); s.position.set(x, y, 4); s.material = branco; a.sombra(s); }
    a.cilindro('neve-nariz', 0, .1, .35, x, 1.95, 3.6, a.mat('cenoura-nariz', '#ff8a2e'), { rx: -Math.PI / 2 });
  }
  // Neve caindo.
  a.particulas('flocos', a.pontoTex('floco', '#ffffff'), {
    emissor: new Vector3(0, 8, 4), caixaMin: new Vector3(-16, 0, -6), caixaMax: new Vector3(16, 1, 8), max: 900,
    cor1: '#ffffffff', cor2: '#e8f2ffff', morta: '#ffffff00', tamanho: [.05, .13], vida: [9, 14], taxa: 60,
    gravidade: new Vector3(0, -.12, 0), dir1: new Vector3(-.2, -.4, 0), dir2: new Vector3(.3, -.6, 0), forca: [.2, .4],
  });
  return { raiz: a.raiz, descartaveis: a.descartaveis, atualizar() {} };
}

const CONSTRUTORES = { praia, telhado, floresta, feira, neve };

// Assíncrona: as arenas realistas carregam recursos (foto 360°, HDR, modelos).
export async function criarArena(nome, scene, apresentacao) {
  if (nome === 'neve') {
    const arena = await criarArenaNeve(scene, apresentacao);
    return { nome, atualizar: arena.atualizar, descartar: arena.descartar };
  }
  if (nome === 'academia') {
    const arena = criarArenaAcademia(scene, apresentacao);
    return { nome, atualizar() {}, descartar: arena.descartar };
  }
  const construir = CONSTRUTORES[nome];
  if (!construir) throw new Error(`Arena desconhecida: ${nome}`);
  scene.getMeshByName('piso')?.setEnabled(false);
  scene.getMeshByName('limite-arena')?.setEnabled(false);
  const arena = construir(scene, apresentacao);
  return {
    nome,
    atualizar: arena.atualizar,
    descartar() { for (const d of arena.descartaveis) d.dispose(); arena.raiz.dispose(false, true); },
  };
}
