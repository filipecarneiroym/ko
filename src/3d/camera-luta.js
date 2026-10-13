import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';

// Câmera de luta compartilhada por laboratório e jogo: perspectiva com lente
// fechada (teleobjetiva, ~23°), como em Street Fighter IV. Enquadra os dois
// lutadores pela distância entre eles e pela altura do pulo; atende pedidos
// da camada de efeitos (tremor, foco e zoom do Super/KO).
export function criarCameraLuta(scene) {
  const camera = new FreeCamera('camera-luta', new Vector3(0, 3.6, -13), scene);
  camera.setTarget(new Vector3(0, 1.5, 0));
  camera.mode = Camera.PERSPECTIVE_CAMERA;
  camera.fov = .4; camera.minZ = .5;
  return camera;
}

export function enquadrarCameraLuta(camera, engine, estado, simulador, pedido = null) {
  const aspecto = Math.max(.2, engine.getRenderWidth() / engine.getRenderHeight());
  const xs = estado.p.map(p => (p.x / simulador.U - simulador.LARGURA / 2) / 24);
  const centro = (xs[0] + xs[1]) / 2;
  // O enquadramento depende só do estado da luta; FPS e hitstop não movem a câmera.
  const alturaPulo = Math.max(...estado.p.map(p => p.y / simulador.U / 24));
  const metadeAltura = Math.max(2.3, 1.4 + alturaPulo, (Math.abs(xs[1] - xs[0]) + 4) / (2 * aspecto));
  let cx = centro, cy = 1.5 + Math.max(0, alturaPulo - .9) / 2, zoom = 1;
  if (pedido?.foco) {
    const k = 1 - pedido.zoom;
    cx += (pedido.foco.x - cx) * Math.min(1, k * 2.5); cy += (pedido.foco.y - cy) * Math.min(1, k * 2.5); zoom = pedido.zoom;
  }
  const d = pedido?.desloc || Vector3.Zero();
  const distancia = metadeAltura * zoom / Math.tan(camera.fov / 2);
  // Quase na horizontal: o fundo ocupa a metade de cima.
  camera.position.set(cx + d.x, cy + d.y + distancia * .05, -distancia);
  camera.setTarget(new Vector3(cx + d.x, cy + d.y, 0));
  camera.maxZ = distancia + 160;   // inclui o fundo 360° das arenas
}
