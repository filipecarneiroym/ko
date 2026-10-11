import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Bone } from '@babylonjs/core/Bones/bone.pure.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { validarGlb } from './contrato-glb.mjs';
import { quadroDoClip } from './estado-visual.mjs';

export async function carregarModelo(buffer, id, simulador, scene) {
  const documento = validarGlb(buffer, id, simulador);
  // A importação explícita inicializa Bone antes do carregador glTF no bundle IIFE.
  if (typeof Bone !== 'function') throw new Error('Módulo de esqueleto indisponível.');
  const container = await LoadAssetContainerAsync(new Uint8Array(buffer), scene, {
    pluginExtension: '.glb',
    pluginOptions: { gltf: { animationStartMode: 0 } },
  });
  let raiz;
  try {
    if (scene.isDisposed) throw new Error('A prévia foi encerrada durante o carregamento.');
    if (!container.skeletons.length || !container.meshes.some(m => m.getTotalVertices() > 0)) throw new Error('GLB sem malha animável.');
    const grupos = new Map(container.animationGroups.map(g => [g.name, g]));
    for (const nome of [...new Set([...Object.keys(simulador.LUTADORES[id].golpes), 'parado'])]) {
      const g = grupos.get(nome);
      const duracao = simulador.LUTADORES[id].golpes[nome]?.dur;
      const fps = g?.targetedAnimations[0]?.animation.framePerSecond;
      if (!g || !fps || g.to <= g.from || g.from !== 0) throw new Error(`Revise os quadros da animação ${nome}.`);
      if (duracao && g.to / fps + 1 / 60 < (duracao - 1) / 60) throw new Error(`A animação ${nome} termina antes do golpe.`);
    }
    raiz = new TransformNode(`modelo-${id}`, scene);
    // O conversor glTF AUTO reflete X na cena Babylon de mão esquerda.
    // Nossos ativos têm frente +X: compensar numa raiz visual fixa mantém
    // face=1 voltado para +X, sem escala negativa adicionada ao esqueleto.
    const orientacao = new TransformNode(`orientacao-${id}`, scene);
    orientacao.parent = raiz;
    orientacao.rotation.y = scene.useRightHandedSystem ? 0 : Math.PI;
    // Primeiro anexar a hierarquia do container; só depois ligá-la à raiz da cena.
    container.addAllToScene();
    for (const node of [...container.meshes, ...container.transformNodes]) if (!node.parent) node.parent = orientacao;
    for (const grupo of container.animationGroups) grupo.stop();
    const nosDosOssos = [...new Set(container.skeletons.flatMap(esqueleto =>
      esqueleto.bones.map(osso => osso.getTransformNode()).filter(Boolean)))];
    const marcha = documento.extras?.marcha;
    const distanciaCiclo = marcha?.clip === 'andando' && Number.isFinite(marcha.distanciaCiclo)
      && marcha.distanciaCiclo > .1 && marcha.distanciaCiclo < 10 ? marcha.distanciaCiclo : null;
    let faseMarcha = 0, ultimoX = null, ultimaFace = null;
    let atual = null;
    let transicao = null;
    return {
      atualizar(pose) {
        raiz.position.set(pose.x, pose.y, 0);
        raiz.rotation.y = pose.face > 0 ? 0 : Math.PI;
        raiz.setEnabled(pose.visivel);
        const grupo = grupos.get(pose.clip);
        if (!grupo) return;
        const marchaAtiva = distanciaCiclo && grupo.name === 'andando';
        if (marchaAtiva) {
          // A distância real dirige a passada: recuo inverte o ciclo, parede e
          // hitstop congelam. Ler a raiz evita depender dos FPS ou de vx desejado.
          const deslocamento = ultimoX === null ? 0 : (pose.x - ultimoX) * pose.face;
          if (grupo !== atual || ultimaFace !== pose.face || Math.abs(deslocamento) > distanciaCiclo * 2) faseMarcha = 0;
          else faseMarcha += deslocamento / distanciaCiclo * (grupo.to - grupo.from);
          const comprimento = grupo.to - grupo.from;
          faseMarcha = ((faseMarcha % comprimento) + comprimento) % comprimento;
        }
        ultimoX = pose.x; ultimaFace = pose.face;
        if (grupo !== atual) {
          // Suavizar a emenda dos socos e o relaxamento da defesa pelo relógio
          // do novo estado. Entrar em defesa aplica a proteção imediatamente.
          const suavizar = atual?.name === 'p1' && grupo.name === 'p2'
            || atual?.name === 'defesa' && grupo.name === 'parado';
          transicao = id === 'pipoca' && suavizar && pose.quadro < 4 ? {
            inicio: Math.max(0, pose.quadro),
            ossos: nosDosOssos.map(no => ({
              no, posicao: no.position.clone(), escala: no.scaling.clone(),
              rotacao: no.rotationQuaternion?.clone() || Quaternion.FromEulerVector(no.rotation),
            })),
          } : null;
          atual?.stop(); grupo.start(false); grupo.pause(); atual = grupo;
        }
        grupo.goToFrame(marchaAtiva ? grupo.from + faseMarcha : quadroDoClip(pose, grupo));
        if (transicao && pose.quadro >= 4) transicao = null;
        if (transicao) {
          const t = Math.max(0, Math.min(1, (pose.quadro - transicao.inicio) / (4 - transicao.inicio)));
          const peso = t * t * (3 - 2 * t);
          for (const { no, posicao, escala, rotacao } of transicao.ossos) {
            Vector3.LerpToRef(posicao, no.position, peso, no.position);
            Vector3.LerpToRef(escala, no.scaling, peso, no.scaling);
            no.rotationQuaternion ||= Quaternion.FromEulerVector(no.rotation);
            Quaternion.SlerpToRef(rotacao, no.rotationQuaternion, peso, no.rotationQuaternion);
          }
        }
      },
      descartar() { container.dispose(); raiz.dispose(); },
    };
  } catch (erro) { container.dispose(); raiz?.dispose(); throw erro; }
}
