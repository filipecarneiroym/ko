import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { descreverPose } from './estado-visual.mjs';
import { carregarModelo } from './modelo-glb.js';
import { LIMITE_GLB } from './contrato-glb.mjs';
import { criarEfeitos } from './efeitos.js';
import { criarCaixas } from './caixas.js';

const canvas = document.querySelector('#arena-3d');
const aviso = document.querySelector('#estado-3d');
let engine, scene, camera, efeitos, anterior = 0, acumulado = 0, indicador = 0;
let suspenso = false, preservado = false, encerrado = false, carregando = false, operacaoModelo = null;
let estado = KOSim.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
const teclas = new Set(), pulsos = new Map(), toques = new Map();
const modelos = [null, null];
const controles = globalThis.KOControle?.criar();
const ciclo = new AbortController();
const ouvir = (alvo, evento, fn, opcoes = {}) => alvo?.addEventListener(evento, fn, { ...opcoes, signal: ciclo.signal });
const mapa = { KeyA: 'L', KeyD: 'R', KeyW: 'U', KeyS: 'D', KeyJ: 'P', KeyK: 'K', KeyL: 'D_', KeyI: 'S' };
const limparEntrada = () => { teclas.clear(); pulsos.clear(); toques.clear(); };
const reiniciar = () => { if (carregando || encerrado) return; limparEntrada(); efeitos?.limpar(); estado = KOSim.novo({ lutadores: ['pipoca', 'uivo'], treino: true }); };
function teclado(e) {
  if (carregando || suspenso || encerrado) return;
  if (!mapa[e.code] || (e.type === 'keydown' && e.target.closest?.('input,select,textarea,[contenteditable="true"]'))) return;
  e.preventDefault();
  if (e.type === 'keydown') teclas.add(e.code); else teclas.delete(e.code);
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
  const aspecto = Math.max(.2, engine.getRenderWidth() / engine.getRenderHeight());
  const metadeLargura = Math.max(8.5, 3.8 * aspecto), metadeAltura = metadeLargura / aspecto;
  camera.orthoLeft = -metadeLargura; camera.orthoRight = metadeLargura;
  camera.orthoTop = metadeAltura; camera.orthoBottom = -metadeAltura;
}
function retomar() { anterior = performance.now(); acumulado = 0; limparEntrada(); redimensionar(); }
function atualizarImportadores() {
  document.querySelectorAll('[data-modelo], #testar-blockouts, #testar-guarda-pipoca').forEach(el => { el.disabled = carregando || suspenso || encerrado; });
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
  await executarCarregamento('Preparando estudos 3D de Pipoca e Uivo…', async operacao => {
    const novos = [];
    let instalados = false;
    try {
      for (const id of ['pipoca', 'uivo']) {
        const buffer = await aguardarCarregamento(baixarModelo(`/modelos/blockout/${id}-v1.glb`, operacao), operacao);
        const novo = await aguardarCarregamento(carregarModelo(buffer, id, KOSim, scene), operacao, m => m.descartar());
        novos.push(novo); verificarCarregamento(operacao);
      }
      // Só substitui a dupla quando os dois arquivos foram validados e preparados.
      const antigos = modelos.slice();
      modelos.splice(0, 2, ...novos); instalados = true;
      antigos.forEach(m => m?.descartar());
      const avisoModelo = document.querySelector('#estado-modelos');
      if (avisoModelo) avisoModelo.textContent = 'Pipoca e Uivo carregados para teste técnico. Modelos provisórios reprovados visualmente; não são a arte final.';
    } finally {
      if (!instalados) novos.forEach(m => m.descartar());
    }
  });
}
async function testarGuardaPipoca() {
  await executarCarregamento('Preparando os movimentos da Pipoca…', async operacao => {
    let novo, instalado = false;
    try {
      const buffer = await aguardarCarregamento(baixarModelo('/modelos/estudos/pipoca-corpo-v10.glb', operacao), operacao);
      novo = await aguardarCarregamento(carregarModelo(buffer, 'pipoca', KOSim, scene), operacao, m => m.descartar());
      verificarCarregamento(operacao);
      const antigo = modelos[0]; modelos[0] = novo; instalado = true;
      antigo?.descartar();
      const avisoModelo = document.querySelector('#estado-modelos');
      if (avisoModelo) avisoModelo.textContent = 'Movimentos da Pipoca carregados: guarda, dois socos, defesa alta, reação aos golpes e passada. Use os controles para testar. Modelo provisório; os demais movimentos continuam em revisão.';
    } finally { if (!instalado) novo?.descartar(); }
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
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
  scene = new Scene(engine); scene.clearColor.set(.025, .015, .06, 1);
  camera = new FreeCamera('lateral', new Vector3(0, 3.6, -13), scene);
  camera.setTarget(new Vector3(0, 1.5, 0)); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  redimensionar();
  new HemisphericLight('luz', new Vector3(.3, 1, -.5), scene);
  const piso = MeshBuilder.CreateGround('piso', { width: 16, height: 7 }, scene);
  piso.material = material('piso', '#292339');
  const bonecos = [manequim(0, '#ffb12b'), manequim(1, '#6aa8ff')];
  efeitos = criarEfeitos(scene, KOSim, window.matchMedia('(prefers-reduced-motion: reduce)'));
  const caixas = criarCaixas(scene, KOSim);
  const exibirCaixas = document.querySelector('#exibir-caixas');
  anterior = performance.now();
  engine.onContextLostObservable.add(() => { suspenso = true; cancelarCarregamento('Carregamento interrompido pela perda do contexto gráfico. Aguarde a recuperação e tente novamente.'); atualizarImportadores(); limparEntrada(); aviso.textContent = 'Contexto gráfico perdido. Aguardando recuperação…'; });
  engine.onContextRestoredObservable.add(() => { suspenso = false; atualizarImportadores(); retomar(); });
  engine.runRenderLoop(() => {
    const agora = performance.now(), dt = Math.min(100, agora - anterior); anterior = agora;
    if (suspenso || preservado || document.hidden || carregando || encerrado) { acumulado = 0; return; }
    const pads = controles?.atualizar();
    acumulado += dt;
    while (acumulado >= 1000 / 60) {
      let entrada = 0;
      for (const tecla of teclas) entrada |= KOSim.B[mapa[tecla]];
      for (const botao of toques.values()) entrada |= KOSim.B[botao];
      for (const [botao, quadros] of pulsos) {
        entrada |= KOSim.B[botao];
        if (quadros <= 1) pulsos.delete(botao); else pulsos.set(botao, quadros - 1);
      }
      KOSim.passo(estado, [entrada | (pads?.[0]?.bits || 0), pads?.[1]?.bits || 0]);
      efeitos.eventos(estado.ev, estado.f); acumulado -= 1000 / 60;
    }
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
    efeitos.atualizar(estado.f); caixas.atualizar(estado, !!exibirCaixas?.checked);
    scene.render();
    if (agora - indicador > 500) {
      const fps = engine.getFps();
      aviso.textContent = `Protótipo · ${Number.isFinite(fps) ? Math.round(fps) : '…'} FPS · ${estado.fase} · vida ${estado.p[0].vida} / ${estado.p[1].vida}`;
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
  document.querySelectorAll('[data-modelo]').forEach(el => ouvir(el, 'change', importar));
  ouvir(window, 'pagehide', e => { if (e.persisted) { preservado = true; cancelarCarregamento('Teste interrompido ao sair da página. Tente novamente.'); limparEntrada(); } else encerrar(); });
  ouvir(window, 'pageshow', e => { if (e.persisted && !encerrado) { preservado = false; retomar(); } });
} catch (erro) {
  encerrar(); aviso.textContent = 'Não foi possível iniciar a prévia 3D neste navegador. O jogo principal continua disponível pelo menu.';
  console.error('Laboratório 3D:', erro);
}
