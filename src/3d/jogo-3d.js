import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { descreverPose } from './estado-visual.mjs';
import { carregarModelo } from './modelo-glb.js';
import { urlModeloAtual } from './versao-modelos.mjs';
import { criarEfeitos } from './efeitos.js';
import { criarEfeitosSF4 } from './efeitos-sf4.js';
import { criarBrilhoGolpes } from './brilho-golpes.js';
import { criarApresentacao } from './apresentacao.js';
import { criarArena } from './arenas.js';
import { criarCameraLuta, enquadrarCameraLuta } from './camera-luta.js';

// Renderizador 3D do jogo. Só desenha: o motor (ko-sim), os controles, a
// máquina e o online continuam iguais. A tela 2D fica por cima, transparente,
// com o placar. Personagens com modelo 3D: por enquanto a Pipoca (roupa azul
// no lado 1 e vermelha no lado 2).

// Etiqueta da versão do 3D. Aparece no aviso de erro para conferir se o aparelho
// carregou o arquivo novo (o Safari do iOS guarda JavaScript em cache com facilidade).
const VERSAO_3D = 'ko3d-2026-10-16-toque-chute-recuperacao';
// iPhone/iPad: o WebGL do Safari é mais frágil e a memória é curta.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Diagnóstico do aparelho, colhido ao criar o motor (não abre contexto extra).
let ultimoDispositivo = null, perdeuContexto = false;
function lerDispositivo(engine) {
  const info = { versao: VERSAO_3D, iphone: IOS, uboDesligado: engine.disableUniformBuffers === true };
  try {
    const caps = engine.getCaps();
    return { ...info, webGL: engine.webGLVersion, renderer: caps.renderer, texturaMax: caps.maxTextureSize, memoria: navigator.deviceMemory ?? null };
  } catch { return info; }
}

function lerModelos() {
  let config;
  try { config = JSON.parse(document.getElementById('ko-config')?.textContent || 'null'); }
  catch { throw new Error('A configuração dos modelos 3D é inválida.'); }
  if (!config?.lutadores) throw new Error('A configuração dos modelos 3D não foi carregada.');
  return Object.fromEntries(Object.entries(config.lutadores).filter(([, lutador]) =>
    Array.isArray(lutador?.modelos3d) && lutador.modelos3d.length === 2
      && lutador.modelos3d.every(url => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//'))
  ).map(([id, lutador]) => [id, lutador.modelos3d]));
}

function erroNaEtapa(erro, etapa) {
  if (erro?.etapa3d) return erro;
  const falha = new Error(erro?.message || String(erro || 'Não foi possível preparar o 3D.'));
  falha.etapa3d = etapa;
  falha.cause = erro;
  return falha;
}

function suportado() {
  try { return Engine.isSupported(); } catch { return false; }
}

async function baixar(url, sinal) {
  const controle = new AbortController();
  const cancelar = () => controle.abort();
  let expirou = false;
  const prazo = setTimeout(() => { expirou = true; controle.abort(); }, 90000);
  sinal.addEventListener('abort', cancelar, { once: true });
  if (sinal.aborted) cancelar();
  try {
    // Revalidar a URL evita reutilizar um modelo antigo após uma publicação.
    const r = await fetch(urlModeloAtual(url), { credentials: 'same-origin', cache: 'no-cache', signal: controle.signal });
    if (!r.ok) throw new Error(`Não foi possível baixar o modelo 3D (HTTP ${r.status}).`);
    return await r.arrayBuffer();
  } catch (erro) {
    if (expirou) throw new Error('O download do modelo 3D excedeu 90 segundos. Confira a conexão e tente novamente.');
    throw erro;
  } finally {
    clearTimeout(prazo);
    sinal.removeEventListener('abort', cancelar);
  }
}

function criar(canvas, { cenario, lutadores, aoFalhar } = {}) {
  let engine, scene, camera, apresentacao, efeitos, sf4, brilhoGolpes;
  const modelos = [null, null], controle = new AbortController();
  let arena = null, encerrado = false, ultimoF = null, preparado = false, falha = null;
  perdeuContexto = false;
  let etapa = 'configuração', rejeitarCarga;
  const redimensionar = () => {
    if (encerrado) return;
    try { engine.resize(); } catch (erro) { falhar(erro, 'redimensionamento'); }
  };
  const interrupcao = new Promise((_, rejeitar) => { rejeitarCarga = rejeitar; });
  // O observador pode falhar antes de a promessa de carga ser registrada.
  interrupcao.catch(() => {});

  function liberar() {
    if (encerrado) return;
    encerrado = true;
    controle.abort();
    removeEventListener('resize', redimensionar);
    canvas?.removeEventListener('webglcontextlost', contextoPerdido);
    for (const recurso of [...modelos.filter(Boolean), arena, scene, engine]) {
      try { if (recurso?.descartar) recurso.descartar(); else recurso?.dispose(); }
      catch (erro) { console.warn('K.O: falha ao liberar um recurso 3D.', erro); }
    }
  }

  function falhar(erro, origem) {
    if (encerrado || falha) return;
    falha = erroNaEtapa(erro, origem);
    rejeitarCarga(falha);
    liberar();
    if (preparado && typeof aoFalhar === 'function') {
      try { aoFalhar(falha); }
      catch (erro) { console.error('K.O: falha ao mostrar o erro do 3D.', erro); }
    }
  }

  function contextoPerdido(evento) {
    evento.preventDefault();
    perdeuContexto = true;
    falhar(new Error('O navegador interrompeu o contexto 3D. Tente carregar a luta novamente.'), 'contexto WebGL');
  }

  let catalogo;
  try {
    catalogo = lerModelos();
    if (!Array.isArray(lutadores) || lutadores.length !== 2 || lutadores.some(id => !catalogo[id])) {
      throw new Error('Os dois lutadores precisam de modelos 3D disponíveis.');
    }
    etapa = 'contexto WebGL';
    engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true });
    // iPhone/iPad (Safari) falham ao criar "uniform buffers" (bug conhecido do WebGL no
    // iOS 16.7+/17: "Unable to create uniform buffer"). Desligar os UBOs usa o caminho de
    // uniforms simples e deixa o 3D rodar nesses aparelhos.
    engine.disableUniformBuffers = true;
    ultimoDispositivo = lerDispositivo(engine);
    // Nitidez no celular: desenha na densidade real da tela (até 2×). Antes o
    // motor ignorava o devicePixelRatio e ainda reduzia: imagem esticada e borrada.
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
    canvas.addEventListener('webglcontextlost', contextoPerdido);
    etapa = 'apresentação';
    scene = new Scene(engine);
    camera = criarCameraLuta(scene);
    apresentacao = criarApresentacao(scene);
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    efeitos = criarEfeitos(scene, KOSim, reduzido, { impactosFinal: false, chuvaFinal: false });
    sf4 = criarEfeitosSF4(scene, KOSim, reduzido, { letreiros: false });
    brilhoGolpes = criarBrilhoGolpes(scene, KOSim, reduzido);
    for (const m of sf4.malhasBrilho) brilhoGolpes.brilho.addIncludedOnlyMesh(m);
    addEventListener('resize', redimensionar);
  } catch (erro) {
    liberar();
    throw erroNaEtapa(erro, etapa);
  }

  const carga = (async () => {
    etapa = 'arena';
    const novaArena = await criarArena(cenario, scene, apresentacao);
    if (encerrado) { novaArena?.descartar(); return; }
    arena = novaArena;
    for (const lado of [0, 1]) {
      etapa = lado === 0 ? 'modelo do jogador' : 'modelo do adversário';
      const buffer = await baixar(catalogo[lutadores[lado]][lado], controle.signal);
      if (encerrado) return;
      const modelo = await carregarModelo(buffer, lutadores[lado], KOSim, scene);
      if (encerrado) { modelo.descartar(); return; }
      modelos[lado] = modelo;
      apresentacao.prepararModelo(modelo);
    }
    // Primeira compilação dos shaders antes da luta (sem engasgo no 1º golpe).
    etapa = 'shaders';
    engine.resize();
    await scene.whenReadyAsync();
    if (!encerrado) preparado = true;
  })();
  const pronto = Promise.race([carga, interrupcao]).catch(erro => {
    if (encerrado && !falha) return;
    falha = falha || erroNaEtapa(erro, etapa);
    liberar();
    throw falha;
  });

  return {
    pronto,
    // Chamado a cada passo do motor, com os eventos daquele passo.
    eventos(evs, s) {
      if (encerrado || !preparado) return;
      try {
        efeitos.eventos(evs.filter(e => e.t !== 'acerto' && e.t !== 'defendeu' && e.t !== 'especial'), s.f, s);
        sf4.eventos(evs, s);
      } catch (erro) { falhar(erro, 'efeitos'); }
    },
    // Chamado a cada quadro de tela.
    desenhar(s) {
      if (encerrado || !preparado) return;
      try {
        const passos = ultimoF === null ? 0 : Math.max(0, s.f - ultimoF);
        ultimoF = s.f;
        s.p.forEach((p, i) => modelos[i].atualizar(descreverPose(p, KOSim, s)));
        brilhoGolpes.atualizar(s, modelos);
        arena?.atualizar(s.f);
        sf4.atualizar(s, passos, camera);
        enquadrarCameraLuta(camera, engine, s, KOSim, sf4.camera(s));
        efeitos.atualizar(s.f, s);
        scene.render();
      } catch (erro) { falhar(erro, 'renderização'); }
    },
    limpar() {
      if (encerrado) return;
      try { efeitos.limpar(); sf4.limpar(); brilhoGolpes.limpar(); ultimoF = null; }
      catch (erro) { falhar(erro, 'efeitos'); }
    },
    descartar() {
      liberar();
      rejeitarCarga(new Error('Carregamento 3D cancelado.'));
    },
  };
}

window.KO3D = {
  // Etiqueta de versão: aparece no aviso de erro para conferir o que o aparelho baixou.
  versao: VERSAO_3D,
  // O 3D só entra quando o aparelho aguenta e os dois lutadores têm modelo.
  disponivel: (lutadores) => {
    try {
      const modelos = lerModelos();
      return suportado() && lutadores.every(id => modelos[id]);
    } catch { return false; }
  },
  criar,
  // Dados do aparelho para o aviso de erro (WebGL, UBO, contexto perdido).
  diagnostico: () => ({ ...(ultimoDispositivo || { versao: VERSAO_3D, iphone: IOS }), contextoPerdido: perdeuContexto }),
};
