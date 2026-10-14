import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { quedasDoFinal } from './estado-visual.mjs';

// Efeitos de luta no estilo Street Fighter IV, em 3D: respingos de tinta de
// pincel com miolo de luz, faíscas, escudo de defesa, rastro de tinta, Super
// com tela escurecida, flash e aproximação (sem nome escrito, como no SF4),
// KO com câmera lenta e "K.O.".
// Tudo segue os eventos e o relógio do motor; nada altera a luta.
// Câmera: devolve tremor, aproximação e fator de câmera lenta para o
// laboratório aplicar (a câmera lenta só espaça os passos na tela).

function semente(n) { let s = n; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// --- Texturas desenhadas (canvas) --------------------------------------
function texturaTinta(scene, nome, { tinta, borda, miolo, raios = 0, seed = 3, tamanho = 512 }) {
  const t = new DynamicTexture(nome, { width: tamanho, height: tamanho }, scene, true);
  t.hasAlpha = true;
  const final = t.getContext(), c = tamanho / 2, r = semente(seed);
  final.clearRect(0, 0, tamanho, tamanho);
  // A tinta é pintada à parte e entra de uma vez, translúcida e com borda
  // macia (pincel molhado): o golpe não vira mancha sobre a lutadora.
  const rascunho = document.createElement('canvas');
  rascunho.width = rascunho.height = tamanho;
  const g = rascunho.getContext('2d');
  // Pinceladas radiais irregulares (respingo de tinta sumi-e).
  const traco = (ang, comp, larg, cor) => {
    g.save(); g.translate(c, c); g.rotate(ang);
    g.fillStyle = cor; g.beginPath();
    g.moveTo(comp * .18, -larg * .5);
    g.quadraticCurveTo(comp * .6, -larg * .9, comp, 0);
    g.quadraticCurveTo(comp * .6, larg * .9, comp * .18, larg * .5);
    g.fill(); g.restore();
  };
  for (let i = 0; i < 26; i++) traco(r() * Math.PI * 2, c * (.55 + r() * .42), c * (.06 + r() * .16), borda);
  for (let i = 0; i < 22; i++) traco(r() * Math.PI * 2, c * (.42 + r() * .4), c * (.05 + r() * .13), tinta);
  for (let i = 0; i < raios; i++) traco(i / raios * Math.PI * 2 + r() * .2, c * .98, c * .05, tinta);
  // Gotas soltas.
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = c * (.5 + r() * .45), s = c * (.01 + r() * .035);
    g.fillStyle = r() < .5 ? tinta : borda;
    g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, s, 0, Math.PI * 2); g.fill();
  }
  final.filter = `blur(${Math.round(tamanho / 200)}px)`; final.globalAlpha = .72;
  final.drawImage(rascunho, 0, 0);
  final.filter = 'none'; final.globalAlpha = 1;
  if (miolo) {
    const grad = final.createRadialGradient(c, c, 0, c, c, c * .42);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(.35, miolo); grad.addColorStop(1, 'rgba(0,0,0,0)');
    final.fillStyle = grad; final.beginPath(); final.arc(c, c, c * .42, 0, Math.PI * 2); final.fill();
  }
  t.update();
  return t;
}

function texturaEstrela(scene, nome, cor) {
  const n = 256, c = n / 2, t = new DynamicTexture(nome, { width: n, height: n }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext();
  g.clearRect(0, 0, n, n);
  g.globalCompositeOperation = 'lighter';
  // Raios: 4 longos e 4 curtos, afinando para a ponta.
  for (let i = 0; i < 8; i++) {
    const comp = c * (i % 2 ? .55 : .98), larg = c * (i % 2 ? .05 : .075);
    g.save(); g.translate(c, c); g.rotate(i * Math.PI / 4);
    const gr = g.createLinearGradient(0, 0, comp, 0);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, cor); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -larg); g.lineTo(comp, 0); g.lineTo(0, larg); g.closePath(); g.fill();
    g.restore();
  }
  const miolo = g.createRadialGradient(c, c, 0, c, c, c * .32);
  miolo.addColorStop(0, '#ffffff'); miolo.addColorStop(.4, cor); miolo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = miolo; g.fillRect(0, 0, n, n);
  t.update();
  return t;
}

function texturaBrilho(scene, nome, cor) {
  const t = new DynamicTexture(nome, { width: 128, height: 128 }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext(), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(.25, cor); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); t.update();
  return t;
}

function texturaEscudo(scene) {
  const t = new DynamicTexture('sf4-escudo', { width: 512, height: 512 }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext(), c = 256;
  const grad = g.createRadialGradient(c, c, c * .2, c, c, c);
  grad.addColorStop(0, 'rgba(160,230,255,.0)'); grad.addColorStop(.62, 'rgba(120,210,255,.35)');
  grad.addColorStop(.8, 'rgba(230,250,255,.95)'); grad.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
  // Hexágonos do escudo.
  g.strokeStyle = 'rgba(220,250,255,.55)'; g.lineWidth = 4;
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const px = c + x * 46 + (y % 2) * 23, py = c + y * 40;
    if (Math.hypot(px - c, py - c) > c * .82) continue;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(px + Math.cos(a) * 22, py + Math.sin(a) * 22); }
    g.closePath(); g.stroke();
  }
  t.update();
  return t;
}

function texturaTexto(scene, nome, texto, { cor = '#ffffff', contorno = '#000000', tinta = '#c4161c' } = {}) {
  const t = new DynamicTexture(nome, { width: 2048, height: 512 }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext(), r = semente(11);
  g.clearRect(0, 0, 2048, 512);
  // Faixa de pincelada atrás do texto.
  g.fillStyle = tinta;
  for (let i = 0; i < 14; i++) {
    const y = 180 + r() * 150, h = 40 + r() * 70;
    g.beginPath(); g.moveTo(80 + r() * 120, y);
    g.quadraticCurveTo(1024, y - 40 + r() * 80, 1900 + r() * 100, y + r() * 30);
    g.lineTo(1880, y + h); g.quadraticCurveTo(1024, y + h + 20, 120, y + h * .7); g.fill();
  }
  g.font = 'italic 900 230px "Arial Black", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 26; g.strokeStyle = contorno; g.strokeText(texto, 1024, 266);
  g.fillStyle = cor; g.fillText(texto, 1024, 266);
  t.update();
  return t;
}

export function criarEfeitosSF4(scene, simulador, movimentoReduzido = { matches: false }, { letreiros = true } = {}) {
  const U = simulador.U;
  const xMundo = x => (x / U - simulador.LARGURA / 2) / 24;
  const yMundo = y => y / U / 24;
  const materialPlano = (nome, textura, { aditivo = false } = {}) => {
    const m = new StandardMaterial(nome, scene);
    m.disableLighting = true; m.emissiveTexture = textura; m.opacityTexture = textura;
    m.diffuseColor = new Color3(0, 0, 0); m.emissiveColor = new Color3(0, 0, 0);
    m.backFaceCulling = false; m.useAlphaFromDiffuseTexture = false;
    if (aditivo) m.alphaMode = Constants.ALPHA_ADD;
    return m;
  };
  const plano = (nome, material, tamanho = 1) => {
    const m = MeshBuilder.CreatePlane(nome, { size: tamanho }, scene);
    m.material = material; m.isPickable = false; m.billboardMode = Mesh.BILLBOARDMODE_ALL;
    m.renderingGroupId = 1; m.setEnabled(false);
    return m;
  };

  // Variações de tinta: escura (tinta) com borda colorida e miolo de luz.
  const texFraco = texturaTinta(scene, 'sf4-tinta-fraco', { tinta: '#14101c', borda: '#ff9a2e', miolo: '#ffe27a', seed: 3 });
  const texForte = texturaTinta(scene, 'sf4-tinta-forte', { tinta: '#14101c', borda: '#ff4a1c', miolo: '#fff1a8', raios: 10, seed: 9 });
  const texPoeira = texturaTinta(scene, 'sf4-tinta-poeira', { tinta: 'rgba(40,36,48,.75)', borda: 'rgba(170,160,150,.6)', seed: 21, tamanho: 256 });
  const texEspecial = texturaTinta(scene, 'sf4-tinta-especial', { tinta: '#1a0f08', borda: '#ff7a14', miolo: '#ffd27a', raios: 6, seed: 33 });
  const texEscudo = texturaEscudo(scene);
  const texFaisca = texturaBrilho(scene, 'sf4-faisca', '#ffb347');
  const texFaiscaFria = texturaBrilho(scene, 'sf4-faisca-fria', '#7fd6ff');
  const matFraco = materialPlano('sf4-mat-fraco', texFraco), matForte = materialPlano('sf4-mat-forte', texForte);
  const matPoeira = materialPlano('sf4-mat-poeira', texPoeira), matEspecial = materialPlano('sf4-mat-especial', texEspecial);
  const matEscudo = materialPlano('sf4-mat-escudo', texEscudo, { aditivo: true });
  const matFlash = materialPlano('sf4-mat-flash', texturaBrilho(scene, 'sf4-flash', '#fff6d8'), { aditivo: true });

  // Pool de respingos.
  const respingos = Array.from({ length: 14 }, (_, i) => ({ malha: plano(`sf4-respingo-${i}`, matFraco), nasc: -1e9, dur: 1, tam: 1, giro: 0, tipo: '', forca: 1 }));
  let cursor = 0;
  // forca: opacidade máxima (as manchas grandes ficam atrás da lutadora, z > 0).
  function respingo(material, x, y, z, tam, dur, tipo, forca = .85) {
    const r = respingos[cursor++ % respingos.length];
    r.malha.material = material; r.malha.position.set(x, y, z); r.malha.rotation.z = Math.random() * Math.PI * 2;
    Object.assign(r, { nasc: relogio, dur, tam, tipo, forca, giro: (Math.random() - .5) * .08 });
    r.malha.renderingGroupId = z > 0 ? 0 : 1;
  }

  // Faíscas 3D (sistema de partículas por cor, reutilizado).
  function sistema(nome, textura, cor1, cor2) {
    const ps = new ParticleSystem(nome, 260, scene);
    ps.particleTexture = textura; ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = Color4.FromHexString(cor1); ps.color2 = Color4.FromHexString(cor2); ps.colorDead = new Color4(0, 0, 0, 0);
    ps.minSize = .1; ps.maxSize = .3; ps.minLifeTime = .12; ps.maxLifeTime = .34;
    ps.minEmitPower = 3; ps.maxEmitPower = 9; ps.gravity = new Vector3(0, -9, 0);
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED; ps.minScaleX = .18; ps.maxScaleX = .3;
    ps.createSphereEmitter(.08); ps.emitRate = 0; ps.manualEmitCount = 0; ps.renderingGroupId = 1;
    ps.start();
    return ps;
  }
  const faiscas = sistema('sf4-faiscas', texFaisca, '#ffe6a0ff', '#ff7a1cff');
  const faiscasFrias = sistema('sf4-faiscas-frias', texFaiscaFria, '#e8fbffff', '#4fb8ffff');
  function explodir(ps, x, y, z, n) { ps.emitter = new Vector3(x, y, z); ps.manualEmitCount = n; }

  // Escudo de defesa (anel com hexágonos, voltado para a câmera).
  const escudos = Array.from({ length: 4 }, (_, i) => ({ malha: plano(`sf4-escudo-${i}`, matEscudo, 1), nasc: -1e9 }));
  let cursorEscudo = 0;

  // Rastro de tinta da cenoura: cópias que ficam para trás e somem.
  const rastro = Array.from({ length: 16 }, (_, i) => ({ malha: plano(`sf4-rastro-${i}`, matEspecial, .55), nasc: -1e9 }));
  let cursorRastro = 0;

  // Tela escurecida do Super e flash de tela cheia (planos presos à câmera).
  const escuro = MeshBuilder.CreatePlane('sf4-escuro', { width: 60, height: 40 }, scene);
  const matEscuro = new StandardMaterial('sf4-mat-escuro', scene);
  matEscuro.disableLighting = true; matEscuro.diffuseColor = new Color3(0, 0, 0); matEscuro.emissiveColor = new Color3(.02, 0, .05);
  escuro.material = matEscuro; escuro.position.set(0, 3, 3.5); escuro.isPickable = false; escuro.visibility = 0;
  const flash = MeshBuilder.CreatePlane('sf4-flash-tela', { width: 60, height: 40 }, scene);
  const matFlashTela = new StandardMaterial('sf4-mat-flash-tela', scene);
  matFlashTela.disableLighting = true; matFlashTela.emissiveColor = new Color3(1, 1, 1); matFlashTela.alphaMode = Constants.ALPHA_ADD;
  flash.material = matFlashTela; flash.position.set(0, 3, -6); flash.isPickable = false; flash.visibility = 0; flash.renderingGroupId = 2;
  const bolasFlash = Array.from({ length: 3 }, (_, i) => plano(`sf4-flash-${i}`, matFlash, 1));
  const matEstrela = materialPlano('sf4-mat-estrela', texturaEstrela(scene, 'sf4-estrela', '#ffd36a'), { aditivo: true });
  const matEstrelaFria = materialPlano('sf4-mat-estrela-fria', texturaEstrela(scene, 'sf4-estrela-fria', '#8fdcff'), { aditivo: true });
  const estrelas = Array.from({ length: 4 }, (_, i) => ({ malha: plano(`sf4-estrela-${i}`, matEstrela, 1), nasc: -1e9, tam: 1, dur: 9 }));
  let cursorEstrela = 0;
  function estrela(material, x, y, z, tam, dur = 9) {
    const e = estrelas[cursorEstrela++ % estrelas.length];
    e.malha.material = material; e.malha.position.set(x, y, z); e.malha.rotation.z = Math.random() * Math.PI;
    Object.assign(e, { nasc: relogio, tam, dur });
  }

  // Letreiros (Super, K.O., Perfeito).
  const letreiros_ = new Map();
  function letreiro(chave, texto, opcoes) {
    if (!letreiros_.has(chave)) {
      const tex = texturaTexto(scene, `sf4-texto-${chave}`, texto, opcoes);
      const m = MeshBuilder.CreatePlane(`sf4-letreiro-${chave}`, { width: 8, height: 2 }, scene);
      m.material = materialPlano(`sf4-mat-texto-${chave}`, tex); m.isPickable = false; m.renderingGroupId = 2; m.setEnabled(false);
      letreiros_.set(chave, { malha: m, nasc: -1e9, dur: 1 });
    }
    return letreiros_.get(chave);
  }
  // No jogo, K.O./PERFEITO já vêm dos avisos 2D do placar (letreiros: false).
  function mostrarLetreiro(chave, texto, dur, opcoes) { if (!letreiros) return; const l = letreiro(chave, texto, opcoes); l.nasc = relogio; l.dur = dur; }

  // Estado da câmera pedido ao laboratório.
  let relogio = 0, tremor = 0, tremorNasc = -1e9, flashNasc = -1e9, flashForca = 0;
  let superLado = -1, superNasc = -1e9, koNasc = -1e9, koLado = -1, faseAnterior = null;
  const reduzido = () => !!movimentoReduzido.matches;

  // Como no SF4, o impacto nasce onde o golpe encostou (canela, barriga,
  // cabeça): centro da interseção da caixa do golpe com o corpo de quem
  // apanhou. Projéteis e casos sem caixa usam o ponto do motor.
  function contato(e, estado) {
    // No 'acerto' o lado é de quem bate; no 'defendeu', de quem defende.
    const ia = e.t === 'acerto' ? e.lado : 1 - e.lado;
    const a = estado?.p?.[ia], v = estado?.p?.[1 - ia];
    const golpe = a?.estado === 'golpe' && simulador.LUTADORES[a.id]?.golpes[a.golpe];
    const j = golpe?.janelas?.find((j, i) => (a.acertos & (1 << i)) && a.t >= j.de - 1 && a.t <= j.ate + 1);
    if (!v || !j || !simulador.caixaHit) return { x: xMundo(e.x), y: yMundo(e.y) };
    const h = simulador.caixaHit(a, j.caixa), c = simulador.corpo(v);
    const x0 = Math.max(h.x, c.x), x1 = Math.min(h.x + h.w, c.x + c.w);
    const y0 = Math.max(h.y, c.y), y1 = Math.min(h.y + h.h, c.y + c.h);
    if (x1 < x0 || y1 < y0) return { x: xMundo(e.x), y: yMundo(e.y) };
    return { x: xMundo((x0 + x1) / 2), y: yMundo((y0 + y1) / 2) };
  }

  function eventos(lista, estado) {
    for (const e of lista) {
      if (e.t === 'acerto') {
        const forte = Math.max(0, Math.min(2, e.forte || 0)), { x, y } = contato(e, estado);
        const pesado = forte >= 1 || (e.dano || 0) >= 50;
        respingo(pesado ? matForte : matFraco, x, y, -.5, pesado ? 1.6 : 1, pesado ? 20 : 15, 'acerto', pesado ? .9 : .8);
        bolasFlash[cursor % 3].position.set(x, y, -.6); bolasFlash[cursor % 3].metadata = { nasc: relogio, tam: pesado ? 2.6 : 1.5 };
        estrela(matEstrela, x, y, -.7, pesado ? 2.4 : 1.5, pesado ? 11 : 8);
        if (!reduzido()) explodir(faiscas, x, y, -.5, pesado ? 70 : 30);
        tremor = pesado ? .16 : .06; tremorNasc = relogio;
        if (pesado) { flashNasc = relogio; flashForca = .18; }
      } else if (e.t === 'defendeu') {
        const { x, y } = contato(e, estado), s = escudos[cursorEscudo++ % escudos.length];
        s.malha.position.set(x, y, -.55); s.nasc = relogio;
        estrela(matEstrelaFria, x, y, -.7, 1.2, 7);
        if (!reduzido()) explodir(faiscasFrias, x, y, -.55, 24);
        tremor = .03; tremorNasc = relogio;
      } else if (e.t === 'choque') {
        const x = xMundo(e.x), y = yMundo(e.y) + 1.4;
        respingo(matForte, x, y, -.5, 1.4, 14, 'choque');
        if (!reduzido()) { explodir(faiscas, x, y, -.5, 40); explodir(faiscasFrias, x, y, -.5, 40); }
      } else if (e.t === 'quebra') {
        const p = estado?.p?.[e.lado];
        if (p) { respingo(matEspecial, xMundo(p.x), yMundo(p.y) + 1.2, .6, 2.2, 18, 'quebra', .7); flashNasc = relogio; flashForca = .25; }
      // Especial: nada no arremesso (só a cenoura em chamas voa, em
      // brilho-golpes.js); o impacto vem no evento de acerto.
      } else if (e.t === 'armadura') {
        const x = xMundo(e.x), y = yMundo(e.y);
        estrela(matEstrelaFria, x, y, -.7, 2, 10);
        bolasFlash[cursor % 3].position.set(x, y, -.6); bolasFlash[cursor % 3].metadata = { nasc: relogio, tam: 2.4 };
        if (!reduzido()) explodir(faiscasFrias, x, y, -.55, 40);
        flashNasc = relogio; flashForca = .25;
      } else if (e.t === 'golpeFinal') {
        // Como o Ultra do SF4: tela escura e clarão.
        superLado = e.lado; superNasc = relogio; flashNasc = relogio; flashForca = .5;
      } else if (e.t === 'super') {
        const p = estado?.p?.[e.lado];
        superLado = e.lado; superNasc = relogio;
        flashNasc = relogio; flashForca = .45;
        // Como no Street Fighter IV: sem nome escrito; o lutador grita o nome
        // do golpe (ko-voz) enquanto a tela escurece e a câmera aproxima.
        if (p) respingo(matEspecial, xMundo(p.x), yMundo(p.y) + 1.3, .6, 2.6, 26, 'super', .65);
      } else if (e.t === 'pulo' || e.t === 'chao') {
        const p = estado?.p?.[e.lado];
        if (p) respingo(matPoeira, xMundo(p.x), .18, -.3, e.t === 'chao' ? 1.3 : .9, 14, 'poeira');
      } else if (e.t === 'perfeito') {
        // Depois do K.O. e mais baixo: as duas faixas não se sobrepõem.
        mostrarLetreiro('perfeito', 'PERFEITO!', 90, { tinta: '#d4a20c' }); if (letreiros) letreiros_.get('perfeito').nasc = relogio + 60;
      }
    }
    // KO: a fase muda para 'ko' (sem evento próprio).
    if (estado?.fase === 'ko' && faseAnterior !== 'ko') {
      koNasc = relogio; koLado = estado.vencedorRound;
      flashNasc = relogio; flashForca = .7; tremor = .22; tremorNasc = relogio;
      mostrarLetreiro('ko', 'K.O.', 80, { tinta: '#c4161c' });
      const v = estado.p[1 - koLado];
      if (v) respingo(matForte, xMundo(v.x), yMundo(v.y) + 1.3, .6, 2.6, 30, 'ko', .7);
    }
    faseAnterior = estado?.fase ?? null;
  }

  let ultimoFinal = null;
  // dt em quadros de motor (fração quando a tela está em câmera lenta).
  function atualizar(estado, dt, camera) {
    relogio += dt;
    const quedas = quedasDoFinal(estado, U), fT = estado?.fT ?? 0;
    for (const q of quedas) {
      if (ultimoFinal === null || ultimoFinal >= q.contato || fT < q.contato) continue;
      const x = xMundo(q.x), y = .75;
      estrela(matEstrela, x, y, -.7, 1.7, 9);
      respingo(matForte, x, y, -.5, 1.3, 16, 'acerto', .8);
      if (!reduzido()) explodir(faiscas, x, y, -.5, 40);
      tremor = .1; tremorNasc = relogio;
    }
    ultimoFinal = quedas.length ? fT : null;
    for (const r of respingos) {
      const idade = relogio - r.nasc, f = idade / r.dur;
      const vivo = idade >= 0 && f < 1;
      r.malha.setEnabled(vivo);
      if (!vivo) continue;
      const cresce = 1 - Math.pow(1 - Math.min(1, f * 2.2), 3);
      r.malha.scaling.setAll(r.tam * (.45 + .75 * cresce));
      r.malha.rotation.z += r.giro * dt;
      // Entra rápido e some em curva (sem ficar parado cheio na tela).
      const sai = Math.max(0, (f - .3) / .7);
      r.malha.visibility = r.forca * Math.min(1, .6 + f * 6) * (1 - sai * sai * (3 - 2 * sai));
    }
    for (const e of estrelas) {
      const f = (relogio - e.nasc) / e.dur;
      e.malha.setEnabled(f >= 0 && f < 1);
      if (f < 0 || f >= 1) continue;
      e.malha.scaling.setAll(e.tam * (.55 + .6 * Math.min(1, f * 4)));
      e.malha.rotation.z += .02 * dt;
      e.malha.visibility = 1 - f * f;
    }
    for (const b of bolasFlash) {
      const d = b.metadata; if (!d) { b.setEnabled(false); continue; }
      const f = (relogio - d.nasc) / 6;
      b.setEnabled(f >= 0 && f < 1);
      b.scaling.setAll(d.tam * (1 - f * .4)); b.visibility = 1 - f;
    }
    for (const s of escudos) {
      const f = (relogio - s.nasc) / 14;
      s.malha.setEnabled(f >= 0 && f < 1);
      s.malha.scaling.setAll(1.1 + f * .5); s.malha.visibility = 1 - f * f;
    }
    // Rastro de tinta atrás de projéteis (a cenoura usa só o fogo de brilho-golpes.js).
    for (const p of estado?.proj || []) {
      if (p.tipo === 'cenoura' || p.vida <= 0 || Math.floor(relogio) % 2) continue;
      const r = rastro[cursorRastro++ % rastro.length];
      if (r.ultimo === Math.floor(relogio)) continue;
      r.ultimo = Math.floor(relogio); r.nasc = relogio;
      r.malha.position.set(xMundo(p.x) - Math.sign(p.vx || 1) * .25, yMundo(p.y), -.1);
      r.malha.rotation.z = Math.random() * 6.3;
    }
    for (const r of rastro) {
      const f = (relogio - r.nasc) / 12;
      r.malha.setEnabled(f >= 0 && f < 1);
      r.malha.scaling.setAll(.9 - f * .6); r.malha.visibility = (1 - f) * .85;
    }
    // Tela escura do Super: entra rápido, segura e sai.
    const fs = (relogio - superNasc) / 40;
    escuro.visibility = fs >= 0 && fs < 1 ? .62 * Math.min(1, fs * 6) * Math.min(1, (1 - fs) * 3) : 0;
    escuro.setEnabled(escuro.visibility > 0);
    const ff = (relogio - flashNasc) / 8;
    flash.visibility = ff >= 0 && ff < 1 ? flashForca * (1 - ff) : 0;
    flash.setEnabled(flash.visibility > 0);
    for (const l of letreiros_.values()) {
      const f = (relogio - l.nasc) / l.dur;
      l.malha.setEnabled(f >= 0 && f < 1);
      if (f < 0 || f >= 1) continue;
      // Entra com pancada (escala), segura, sai deslizando.
      const entra = Math.min(1, f * 8), s = 1.35 - .35 * (1 - Math.pow(1 - entra, 3));
      l.malha.scaling.setAll(s * .45); // faixa fina no alto: não cobre as lutadoras
      l.malha.visibility = f < .8 ? 1 : 1 - (f - .8) / .2;
      if (camera) {
        const frente = camera.getDirection(new Vector3(0, 0, 1));
        const alvo = camera.position.add(frente.scale(6));
        l.malha.position.copyFrom(alvo); l.malha.position.y += l.malha.name.endsWith('perfeito') ? .25 : .72;
        l.malha.rotation.copyFrom(camera.rotation);
      }
    }
    if (camera) {
      // Planos de tela cheia acompanham a câmera.
      const frente = camera.getDirection(new Vector3(0, 0, 1));
      flash.position.copyFrom(camera.position.add(frente.scale(2))); flash.rotation.copyFrom(camera.rotation);
    }
  }

  // Pedido de câmera: deslocamento de tremor, alvo/zoom do Super e do KO.
  function camera(estado) {
    const idade = relogio - tremorNasc;
    const t = idade < 10 && !reduzido() ? tremor * (1 - idade / 10) : 0;
    const desloc = new Vector3(Math.sin(relogio * 2.7) * t, Math.cos(relogio * 3.3) * t, 0);
    let foco = null, zoom = 1;
    const fs = (relogio - superNasc) / 40;
    if (fs >= 0 && fs < 1 && estado?.p?.[superLado]) {
      const p = estado.p[superLado];
      foco = new Vector3(xMundo(p.x), yMundo(p.y) + 1.3, 0);
      zoom = 1 - .35 * Math.sin(Math.min(1, fs * 1.4) * Math.PI);
    }
    const fk = (relogio - koNasc) / 70;
    if (fk >= 0 && fk < 1 && estado?.p) {
      const v = estado.p[1 - koLado];
      if (v) { foco = new Vector3(xMundo(v.x), yMundo(v.y) + 1.1, 0); zoom = 1 - .3 * Math.sin(fk * Math.PI); }
    }
    // Câmera lenta curta no KO (só visual).
    const lento = fk >= 0 && fk < .5 && !reduzido() ? .3 : 1;
    return { desloc, foco, zoom, lento };
  }

  function limpar() {
    relogio = 0; tremor = 0; superNasc = koNasc = flashNasc = tremorNasc = -1e9; faseAnterior = null;
    for (const r of [...respingos, ...escudos, ...rastro]) { r.nasc = -1e9; r.malha.setEnabled(false); }
    for (const l of letreiros_.values()) { l.nasc = -1e9; l.malha.setEnabled(false); }
  }

  // Malhas que acendem na camada de brilho (estrelas, tinta, escudos, flash).
  const malhasBrilho = [...estrelas.map(e => e.malha), ...respingos.map(r => r.malha), ...escudos.map(e => e.malha), ...bolasFlash];
  return { eventos, atualizar, camera, limpar, malhasBrilho };
}
