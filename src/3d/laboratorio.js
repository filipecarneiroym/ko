import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { descreverPose } from './estado-visual.mjs';
import { carregarModelo } from './modelo-glb.js';
import { LIMITE_GLB } from './contrato-glb.mjs';
import { criarEfeitos } from './efeitos.js';
import { criarCaixas } from './caixas.js';
import { criarApresentacao } from './apresentacao.js';
import { criarArena, ARENAS } from './arenas.js';
import { criarEfeitosSF4 } from './efeitos-sf4.js';
import { criarBrilhoGolpes } from './brilho-golpes.js';
import { criarCameraLuta, enquadrarCameraLuta } from './camera-luta.js';

const canvas = document.querySelector('#arena-3d');
const aviso = document.querySelector('#estado-3d');
let engine, scene, camera, efeitos, sf4, brilhoGolpes, apresentacao, anterior = 0, acumulado = 0, indicador = 0;
let suspenso = false, preservado = false, encerrado = false, carregando = false, operacaoModelo = null;
let estado = KOSim.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
// Luta Pipoca azul × Pipoca vermelha: contra a máquina (KOCPU) ou 2 jogadores.
let luta = null, cpu = null;
// Acesso de teste ao estado da prévia (laboratório; não existe no jogo).
globalThis.__laboratorio3d = { get estado() { return estado; }, get scene() { return scene; } };
const teclas = new Set(), pulsos = new Map(), toques = new Map();
const modelos = [null, null];
const controles = globalThis.KOControle?.criar();
const ciclo = new AbortController();
const ouvir = (alvo, evento, fn, opcoes = {}) => alvo?.addEventListener(evento, fn, { ...opcoes, signal: ciclo.signal });
const mapa = { KeyA: 'L', KeyD: 'R', KeyW: 'U', KeyS: 'D', KeyJ: 'P', KeyK: 'K', KeyL: 'D_', KeyI: 'S' };
// Jogador 2 no mesmo teclado (modo 2 jogadores): setas + 1/2/3/0 do teclado numérico ou N/M/,/.
const mapa2 = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', Numpad1: 'P', Numpad2: 'K', Numpad3: 'D_', Numpad0: 'S',
  KeyN: 'P', KeyM: 'K', Comma: 'D_', Period: 'S' };
const teclas2 = new Set();
const limparEntrada = () => { teclas.clear(); teclas2.clear(); pulsos.clear(); toques.clear(); };
const reiniciar = () => {
  if (carregando || encerrado) return;
  limparEntrada(); efeitos?.limpar(); sf4?.limpar(); brilhoGolpes?.limpar();
  estado = KOSim.novo(luta ? { lutadores: ['pipoca', 'pipoca'], treino: false } : { lutadores: ['pipoca', 'uivo'], treino: true });
  cpu = luta?.modo === 'cpu' ? globalThis.KOCPU.criar(KOSim, luta.nivel) : null;
};
function teclado(e) {
  if (carregando || suspenso || encerrado) return;
  const segundo = luta?.modo === 'versus' && mapa2[e.code] && !mapa[e.code];
  if ((!mapa[e.code] && !segundo) || (e.type === 'keydown' && e.target.closest?.('input,select,textarea,[contenteditable="true"]'))) return;
  e.preventDefault();
  const alvo = segundo ? teclas2 : teclas;
  if (e.type === 'keydown') alvo.add(e.code); else alvo.delete(e.code);
}
function material(nome, cor) {
  const m = new StandardMaterial(nome, scene);
  m.diffuseColor = Color3.FromHexString(cor); return m;
}
function manequim(lado, cor) {
  const raiz = new TransformNode(`provisorio-${lado}`, scene);
  const tinta = material(`cor-${lado}`, cor);
  const partes = [];
  for (const [nome, tamanho, x, y] of [['tronco', .8, 0, 1.2], ['cabeca', .45, 0, 1.95], ['braco', .35, .65, 1.25], ['perna', .4, .25, .45]]) {
    const m = MeshBuilder.CreateBox(`${nome}-${lado}`, { size: tamanho }, scene);
    m.parent = raiz; m.position.set(x, y, 0); m.material = tinta; partes.push(m);
  }
  return { raiz, braco: partes[2], perna: partes[3] };
}
function encerrar() {
  if (encerrado) return;
  encerrado = true; cancelarCarregamento('A prévia foi encerrada.'); ciclo.abort(); limparEntrada(); engine?.stopRenderLoop();
  modelos.forEach(m => m?.descartar()); scene?.dispose(); engine?.dispose();
}
function redimensionar() {
  if (!engine || encerrado) return;
  engine.resize();
  enquadrarCamera();
}
function enquadrarCamera() { enquadrarCameraLuta(camera, engine, estado, KOSim, sf4?.camera(estado)); }
function retomar() { anterior = performance.now(); acumulado = 0; limparEntrada(); redimensionar(); }
function atualizarImportadores() {
  document.querySelectorAll('[data-modelo], #testar-blockouts, #testar-guarda-pipoca, #iniciar-luta').forEach(el => { el.disabled = carregando || suspenso || encerrado; });
  const botao = document.querySelector('#testar-blockouts');
  if (botao) {
    botao.textContent = carregando ? 'Carregando modelos…' : 'Teste técnico de articulação';
    botao.setAttribute('aria-busy', String(carregando));
  }
  document.querySelector('#testar-guarda-pipoca')?.setAttribute('aria-busy', String(carregando));
}
function cancelarCarregamento(mensagem) { operacaoModelo?.controlador.abort(new Error(mensagem)); }
function verificarCarregamento(operacao) {
  if (operacao.controlador.signal.aborted || encerrado || operacaoModelo !== operacao) {
    throw operacao.controlador.signal.reason || new Error('Carregamento interrompido. Tente novamente.');
  }
}
function aguardarCarregamento(promessa, operacao, descartar) {
  const signal = operacao.controlador.signal;
  return new Promise((resolver, rejeitar) => {
    let concluido = false;
    const interromper = () => {
      if (concluido) return;
      concluido = true; signal.removeEventListener('abort', interromper);
      rejeitar(signal.reason || new Error('Carregamento interrompido. Tente novamente.'));
    };
    signal.addEventListener('abort', interromper, { once: true });
    Promise.resolve(promessa).then(valor => {
      if (concluido || signal.aborted || encerrado || operacaoModelo !== operacao) {
        descartar?.(valor); interromper(); return;
      }
      concluido = true; signal.removeEventListener('abort', interromper); resolver(valor);
    }, erro => {
      if (concluido) return;
      concluido = true; signal.removeEventListener('abort', interromper); rejeitar(erro);
    });
    if (signal.aborted) interromper();
  });
}
async function executarCarregamento(mensagem, carregar) {
  if (carregando || encerrado || suspenso || preservado || document.hidden) return;
  const avisoModelo = document.querySelector('#estado-modelos');
  const operacao = { controlador: new AbortController() };
  operacaoModelo = operacao; carregando = true; limparEntrada(); atualizarImportadores();
  if (avisoModelo) avisoModelo.textContent = mensagem;
  const prazo = setTimeout(() => operacao.controlador.abort(new Error('O carregamento demorou demais. Confira a conexão e tente novamente.')), 30000);
  try {
    await carregar(operacao);
  } catch (erro) {
    if (!encerrado && avisoModelo) avisoModelo.textContent = erro.message || 'Não foi possível carregar o modelo. Tente novamente.';
    if (!encerrado && !operacao.controlador.signal.aborted) console.error('Importação 3D:', erro);
  } finally {
    clearTimeout(prazo);
    operacao.controlador.abort();
    if (operacaoModelo === operacao) {
      operacaoModelo = null; carregando = false; atualizarImportadores();
      if (!encerrado) retomar();
    }
  }
}
async function baixarModelo(caminho, operacao) {
  const resposta = await fetch(caminho, {
    mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-cache',
    signal: operacao.controlador.signal, headers: { Accept: 'model/gltf-binary' },
  });
  if (!resposta.ok) throw new Error('O modelo de estudo não está disponível. Tente novamente em instantes.');
  if (Number(resposta.headers.get('content-length')) > LIMITE_GLB) throw new Error('O modelo excede o limite de 24 MB.');
  const buffer = await resposta.arrayBuffer();
  verificarCarregamento(operacao);
  if (buffer.byteLength > LIMITE_GLB) throw new Error('O modelo excede o limite de 24 MB.');
  return buffer;
}
async function testarBlockouts() {
  await executarCarregamento('Preparando estudos 3D de Lola e Uivo…', async operacao => {
    const novos = [];
    let instalados = false;
    try {
      for (const id of ['pipoca', 'uivo']) {
        const buffer = await aguardarCarregamento(baixarModelo(`/modelos/blockout/${id}-v1.glb`, operacao), operacao);
        const novo = await aguardarCarregamento(carregarModelo(buffer, id, KOSim, scene), operacao, m => m.descartar());
        novos.push(novo); verificarCarregamento(operacao);
        apresentacao.prepararModelo(novo);
      }
      // Só substitui a dupla quando os dois arquivos foram validados e preparados.
      const antigos = modelos.slice();
      modelos.splice(0, 2, ...novos); instalados = true;
      antigos.forEach(m => m?.descartar());
      const avisoModelo = document.querySelector('#estado-modelos');
      if (avisoModelo) avisoModelo.textContent = 'Lola e Uivo carregados para teste técnico. Modelos provisórios reprovados visualmente; não são a arte final.';
    } finally {
      if (!instalados) novos.forEach(m => m.descartar());
    }
  });
}
async function testarGuardaPipoca() {
  await executarCarregamento('Preparando os movimentos da Lola…', async operacao => {
    let novo, instalado = false;
    try {
      const buffer = await aguardarCarregamento(baixarModelo('/modelos/estudos/pipoca-direcao-visual-v13.glb', operacao), operacao);
      novo = await aguardarCarregamento(carregarModelo(buffer, 'pipoca', KOSim, scene), operacao, m => m.descartar());
      verificarCarregamento(operacao);
      apresentacao.prepararModelo(novo);
      const antigo = modelos[0]; modelos[0] = novo; instalado = true;
      antigo?.descartar();
      const avisoModelo = document.querySelector('#estado-modelos');
      if (avisoModelo) avisoModelo.textContent = 'Lola carregada. Teste socos, chutes, ataques baixos e aéreos, salto, defesa, cenoura e Super. Aparência e movimentos em refinamento.';
    } finally { if (!instalado) novo?.descartar(); }
  });
}
async function iniciarLuta() {
  const modo = document.querySelector('#modo-luta')?.value === 'versus' ? 'versus' : 'cpu';
  const nivel = document.querySelector('#nivel-maquina')?.value || 'medio';
  if (modo === 'cpu' && !globalThis.KOCPU?.PERFIS[nivel]) return;
  await executarCarregamento('Preparando Lola azul e Lola vermelha…', async operacao => {
    const novos = [];
    let instalados = false;
    try {
      for (const cor of ['azul', 'vermelha']) {
        const buffer = await aguardarCarregamento(baixarModelo(`/modelos/estudos/pipoca-v5-${cor}.glb`, operacao), operacao);
        const novo = await aguardarCarregamento(carregarModelo(buffer, 'pipoca', KOSim, scene), operacao, m => m.descartar());
        novos.push(novo); verificarCarregamento(operacao);
        apresentacao.prepararModelo(novo);
      }
      const antigos = modelos.slice();
      modelos.splice(0, 2, ...novos); instalados = true;
      antigos.forEach(m => m?.descartar());
      luta = { modo, nivel };
      // Nova luta já com as duas Pipocas (reiniciar ignora pedidos durante o carregamento).
      limparEntrada(); efeitos?.limpar(); sf4?.limpar(); brilhoGolpes?.limpar();
      estado = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: false });
      cpu = modo === 'cpu' ? globalThis.KOCPU.criar(KOSim, nivel) : null;
      const avisoModelo = document.querySelector('#estado-modelos');
      if (avisoModelo) avisoModelo.textContent = modo === 'cpu'
        ? `Luta contra a máquina (${globalThis.KOCPU.PERFIS[nivel].nome}). Você é a Lola azul.`
        : 'Luta 2 jogadores: jogador 1 azul (A/D/W/S, J/K/L/I), jogador 2 vermelha (setas, N/M/vírgula/ponto). Controles também funcionam.';
    } finally {
      if (!instalados) novos.forEach(m => m.descartar());
    }
  });
}
async function importar(e) {
  const arquivo = e.target.files?.[0];
  if (!arquivo || encerrado) return;
  if (carregando) { e.target.value = ''; return; }
  const lado = Number(e.target.dataset.modelo);
  if (lado !== 0 && lado !== 1) return;
  try {
    await executarCarregamento('Validando e preparando modelo…', async operacao => {
      if (arquivo.size > LIMITE_GLB) throw new Error('Use um GLB de até 24 MB.');
      const buffer = await aguardarCarregamento(arquivo.arrayBuffer(), operacao);
      verificarCarregamento(operacao);
      const novo = await aguardarCarregamento(carregarModelo(buffer, estado.p[lado].id, KOSim, scene), operacao, m => m.descartar());
      verificarCarregamento(operacao);
      apresentacao.prepararModelo(novo);
      modelos[lado]?.descartar(); modelos[lado] = novo;
      const avisoModelo = document.querySelector('#estado-modelos');
      if (avisoModelo) avisoModelo.textContent = `${KOSim.LUTADORES[estado.p[lado].id].nome}: modelo de teste carregado. A identidade e os movimentos ainda precisam de revisão visual.`;
    });
  } finally {
    e.target.value = '';
  }
}
try {
  if (!Engine.isSupported()) throw new Error('WebGL indisponível');
  engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
  // iPhone/iPad (Safari) falham ao criar "uniform buffers" no iOS 16.7+/17; desligar
  // os UBOs contorna o "Unable to create uniform buffer".
  engine.disableUniformBuffers = true;
  // Nitidez no celular: desenha na densidade real da tela (até 2×). Antes o
  // motor ignorava o devicePixelRatio e ainda reduzia: imagem esticada e borrada.
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  scene = new Scene(engine); scene.clearColor.set(.025, .015, .06, 1);
  camera = criarCameraLuta(scene);
  redimensionar();
  apresentacao = criarApresentacao(scene);
  // Arena escolhida (seis cenários 3D); a animação ambiente segue o tempo real.
  let arena = { atualizar() {}, descartar() {} }, tempoArena = 0, trocaArena = Promise.resolve();
  const seletorArena = document.querySelector('#arena');
  const trocarArena = nome => {
    trocaArena = trocaArena.then(async () => {
      arena.descartar();
      arena = { atualizar() {}, descartar() {} };
      try { arena = await criarArena(nome, scene, apresentacao); }
      catch (erro) { console.error('Arena 3D:', erro); arena = await criarArena('academia', scene, apresentacao); }
    });
  };
  trocarArena('academia');
  ouvir(seletorArena, 'change', () => trocarArena(ARENAS.includes(seletorArena.value) ? seletorArena.value : 'academia'));
  const bonecos = [manequim(0, '#ffb12b'), manequim(1, '#6aa8ff')];
  efeitos = criarEfeitos(scene, KOSim, window.matchMedia('(prefers-reduced-motion: reduce)'), { impactosFinal: false, chuvaFinal: false });
  sf4 = criarEfeitosSF4(scene, KOSim, window.matchMedia('(prefers-reduced-motion: reduce)'));
  brilhoGolpes = criarBrilhoGolpes(scene, KOSim, window.matchMedia('(prefers-reduced-motion: reduce)'));
  for (const m of sf4.malhasBrilho) brilhoGolpes.brilho.addIncludedOnlyMesh(m);
  const caixas = criarCaixas(scene, KOSim);
  const exibirCaixas = document.querySelector('#exibir-caixas');
  anterior = performance.now();
  engine.onContextLostObservable.add(() => { suspenso = true; cancelarCarregamento('Carregamento interrompido pela perda do contexto gráfico. Aguarde a recuperação e tente novamente.'); atualizarImportadores(); limparEntrada(); aviso.textContent = 'Contexto gráfico perdido. Aguardando recuperação…'; });
  engine.onContextRestoredObservable.add(() => { suspenso = false; atualizarImportadores(); retomar(); });
  engine.runRenderLoop(() => {
    const agora = performance.now(), dt = Math.min(100, agora - anterior); anterior = agora;
    if (suspenso || preservado || document.hidden || carregando || encerrado) { acumulado = 0; return; }
    const pads = controles?.atualizar();
    // Câmera lenta do KO: só espaça os passos na tela; o resultado não muda.
    const lento = sf4.camera(estado).lento;
    acumulado += dt * lento;
    let passos = 0;
    // Pausa de teste: congela o motor (efeitos param no quadro do evento).
    if (globalThis.__laboratorio3d?.pausado) acumulado = 0;
    while (acumulado >= 1000 / 60) {
      let entrada = 0;
      for (const tecla of teclas) entrada |= KOSim.B[mapa[tecla]];
      for (const botao of toques.values()) entrada |= KOSim.B[botao];
      for (const [botao, quadros] of pulsos) {
        entrada |= KOSim.B[botao];
        if (quadros <= 1) pulsos.delete(botao); else pulsos.set(botao, quadros - 1);
      }
      let entrada2 = pads?.[1]?.bits || 0;
      for (const tecla of teclas2) entrada2 |= KOSim.B[mapa2[tecla]];
      if (cpu) entrada2 = cpu(estado, 1);
      KOSim.passo(estado, [entrada | (pads?.[0]?.bits || 0), entrada2]);
      // Impactos e defesas agora são da camada SF4 (tinta); o módulo antigo
      // segue com cenoura, toca, poeira e Chuva de Cenouras.
      efeitos.eventos(estado.ev.filter(e => e.t !== 'acerto' && e.t !== 'defendeu' && e.t !== 'especial'), estado.f, estado);
      sf4.eventos(estado.ev, estado);
      acumulado -= 1000 / 60; passos++;
    }
    sf4.atualizar(estado, passos, camera);
    estado.p.forEach((p, i) => {
      const b = bonecos[i];
      const pose = descreverPose(p, KOSim, estado);
      b.raiz.setEnabled(!modelos[i] && pose.visivel);
      if (modelos[i]) { modelos[i].atualizar(pose); return; }
      b.raiz.position.set(pose.x, pose.y, 0);
      b.raiz.rotation.y = pose.face > 0 ? 0 : Math.PI;
      const golpe = p.estado === 'golpe' ? KOSim.LUTADORES[p.id].golpes[p.golpe] : null;
      const janela = golpe?.janelas?.some(j => p.t >= j.de && p.t <= j.ate);
      b.braco.position.x = janela ? 1.05 : .65;
      b.perna.rotation.z = janela && p.golpe?.includes('k') ? -.9 : 0;
    });
    if (modelos[0] && modelos[1]) brilhoGolpes.atualizar(estado, modelos);
    tempoArena += dt / (1000 / 60); arena.atualizar(tempoArena);
    enquadrarCamera();
    efeitos.atualizar(estado.f, estado); caixas.atualizar(estado, !!exibirCaixas?.checked);
    scene.render();
    if (agora - indicador > 500) {
      const fps = engine.getFps();
      const rotulo = luta ? `Lola azul × Lola vermelha (${luta.modo === 'cpu' ? 'máquina ' + globalThis.KOCPU.PERFIS[luta.nivel].nome : '2 jogadores'}) · round ${estado.round} · ${estado.rounds[0]}–${estado.rounds[1]}` : 'Protótipo';
      aviso.textContent = `${rotulo} · ${Number.isFinite(fps) ? Math.round(fps) : '…'} FPS · ${estado.fase} · vida ${estado.p[0].vida} / ${estado.p[1].vida}`;
      indicador = agora;
    }
  });
  ouvir(window, 'keydown', teclado); ouvir(window, 'keyup', teclado);
  ouvir(window, 'resize', redimensionar); ouvir(window, 'blur', limparEntrada);
  ouvir(document, 'visibilitychange', () => { if (document.hidden) cancelarCarregamento('Teste interrompido ao ocultar a página. Volte à prévia e tente novamente.'); retomar(); });
  document.querySelectorAll('[data-comando]').forEach(b => {
    const comando = b.dataset.comando;
    const segurar = ['L', 'R', 'D', 'D_'].includes(comando);
    ouvir(b, 'pointerdown', e => {
      if (carregando || suspenso || encerrado) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      if (segurar) { toques.set(e.pointerId, comando); if (b.hasPointerCapture?.(e.pointerId) === false) { try { b.setPointerCapture(e.pointerId); } catch { /* Evento sintético de teste. */ } } }
      else pulsos.set(comando, 4);
    });
    for (const evento of ['pointerup', 'pointercancel', 'lostpointercapture']) ouvir(b, evento, e => toques.delete(e.pointerId));
    ouvir(b, 'click', e => { if (!carregando && !suspenso && !encerrado && e.detail === 0) pulsos.set(comando, 4); });
  });
  ouvir(document.querySelector('#reiniciar-3d'), 'click', reiniciar);
  ouvir(document.querySelector('#testar-blockouts'), 'click', testarBlockouts);
  ouvir(document.querySelector('#testar-guarda-pipoca'), 'click', testarGuardaPipoca);
  ouvir(document.querySelector('#iniciar-luta'), 'click', iniciarLuta);
  document.querySelectorAll('[data-modelo]').forEach(el => ouvir(el, 'change', importar));
  ouvir(window, 'pagehide', e => { if (e.persisted) { preservado = true; cancelarCarregamento('Teste interrompido ao sair da página. Tente novamente.'); limparEntrada(); } else encerrar(); });
  ouvir(window, 'pageshow', e => { if (e.persisted && !encerrado) { preservado = false; retomar(); } });
} catch (erro) {
  encerrar(); aviso.textContent = 'Não foi possível iniciar a prévia 3D neste navegador. O jogo principal continua disponível pelo menu.';
  console.error('Laboratório 3D:', erro);
}
