import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { descreverPose } from './estado-visual.mjs';
import { carregarModelo } from './modelo-glb.js';
import { criarEfeitos } from './efeitos.js';
import { criarEfeitosSF4 } from './efeitos-sf4.js';
import { criarApresentacao } from './apresentacao.js';
import { criarArena } from './arenas.js';
import { criarCameraLuta, enquadrarCameraLuta } from './camera-luta.js';

// Renderizador 3D do jogo. Só desenha: o motor (ko-sim), os controles, a
// máquina e o online continuam iguais. A tela 2D fica por cima, transparente,
// com o placar. Personagens com modelo 3D: por enquanto a Pipoca (roupa azul
// no lado 1 e vermelha no lado 2).
const MODELOS = { pipoca: ['/modelos/estudos/pipoca-v5-azul.glb', '/modelos/estudos/pipoca-v5-vermelha.glb'] };

function suportado() {
  try { return Engine.isSupported(); } catch { return false; }
}

async function baixar(url) {
  const r = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
  if (!r.ok) throw new Error(`Recurso 3D indisponível: ${url}`);
  return r.arrayBuffer();
}

function criar(canvas, { cenario, lutadores }) {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true });
  // Celular: limita a resolução interna (cada pixel a mais custa bateria).
  engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.5));
  const scene = new Scene(engine);
  const camera = criarCameraLuta(scene);
  const apresentacao = criarApresentacao(scene);
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const efeitos = criarEfeitos(scene, KOSim, reduzido);
  const sf4 = criarEfeitosSF4(scene, KOSim, reduzido, { letreiros: false });
  const modelos = [null, null];
  let arena = null, encerrado = false, ultimoF = null;
  const redimensionar = () => engine.resize();
  addEventListener('resize', redimensionar);

  const pronto = (async () => {
    arena = await criarArena(cenario, scene, apresentacao);
    for (const lado of [0, 1]) {
      const buffer = await baixar(MODELOS[lutadores[lado]][lado]);
      if (encerrado) return;
      modelos[lado] = await carregarModelo(buffer, lutadores[lado], KOSim, scene);
      apresentacao.prepararModelo(modelos[lado]);
    }
    // Primeira compilação dos shaders antes da luta (sem engasgo no 1º golpe).
    engine.resize();
    await scene.whenReadyAsync();
  })();

  return {
    pronto,
    // Chamado a cada passo do motor, com os eventos daquele passo.
    eventos(evs, s) {
      if (encerrado) return;
      efeitos.eventos(evs.filter(e => e.t !== 'acerto' && e.t !== 'defendeu'), s.f, s);
      sf4.eventos(evs, s);
    },
    // Chamado a cada quadro de tela.
    desenhar(s) {
      if (encerrado || !modelos[0] || !modelos[1]) return;
      const passos = ultimoF === null ? 0 : Math.max(0, s.f - ultimoF);
      ultimoF = s.f;
      s.p.forEach((p, i) => modelos[i].atualizar(descreverPose(p, KOSim, s)));
      arena?.atualizar(s.f);
      sf4.atualizar(s, passos, camera);
      enquadrarCameraLuta(camera, engine, s, KOSim, sf4.camera(s));
      efeitos.atualizar(s.f, s);
      scene.render();
    },
    limpar() { efeitos.limpar(); sf4.limpar(); ultimoF = null; },
    descartar() {
      if (encerrado) return;
      encerrado = true;
      removeEventListener('resize', redimensionar);
      modelos.forEach(m => m?.descartar()); arena?.descartar();
      scene.dispose(); engine.dispose();
    },
  };
}

window.KO3D = {
  // O 3D só entra quando o aparelho aguenta e os dois lutadores têm modelo.
  disponivel: (lutadores) => suportado() && lutadores.every(id => MODELOS[id]),
  criar,
};
