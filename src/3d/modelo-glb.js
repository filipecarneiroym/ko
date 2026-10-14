import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Bone } from '@babylonjs/core/Bones/bone.pure.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { validarGlb, GOLPES_OPCIONAIS } from './contrato-glb.mjs';
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
      if (!g && GOLPES_OPCIONAIS.includes(nome)) continue; // arquivo de estudo sem este golpe
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
    const ciclosPorDistancia = new Map();
    for (const [nome, fonte] of [['andando', documento.extras?.marcha], ['corrida', documento.extras?.estadosPipoca?.corrida]]) {
      if (fonte?.clip === nome && Number.isFinite(fonte.distanciaCiclo)
        && fonte.distanciaCiclo > .1 && fonte.distanciaCiclo < 10) ciclosPorDistancia.set(nome, fonte.distanciaCiclo);
    }
    let faseMarcha = 0, ultimoX = null, ultimaFace = null;
    // Chute rodado: a volta é em torno do pé de apoio (o mais baixo), que
    // continua plantado; o corpo gira sobre ele.
    const pes = nosDosOssos.filter(no => /^pe_[ED]$/.test(no.name));
    function posicaoMundo(no) {
      const cadeia = []; for (let n = no; n; n = n.parent) cadeia.unshift(n);
      for (const n of cadeia) n.computeWorldMatrix(true);
      return no.getAbsolutePosition().clone();
    }
    function girarSobreApoio(volta) {
      if (!pes.length) { raiz.rotation.y += volta; return; }
      const apoio = pes.map(posicaoMundo).reduce((a, b) => (b.y < a.y ? b : a));
      const dx = apoio.x - raiz.position.x, dz = apoio.z - raiz.position.z, c = Math.cos(volta), sn = Math.sin(volta);
      raiz.rotation.y += volta;
      // Ry(volta) aplicado ao deslocamento até o pé (convenção do Babylon).
      raiz.position.x += dx - (dx * c + dz * sn);
      raiz.position.z += dz - (-dx * sn + dz * c);
    }
    const malhas = Object.freeze(container.meshes.filter(m => m.getTotalVertices() > 0));
    let atual = null;
    let transicao = null;
    return {
      get malhas() { return malhas; },
      // Osso pelo nome (os dois lutadores têm os mesmos nomes; a cena não serve).
      osso(nome) { return nosDosOssos.find(no => no.name === nome) || null; },
      atualizar(pose) {
        // Mortal gira em volta da cintura (não dos pés): compensa a posição.
        const giro = pose.mortal || 0, centro = 1.15;
        raiz.position.set(pose.x + pose.face * centro * Math.sin(giro), pose.y + centro * (1 - Math.cos(giro)), 0);
        raiz.rotation.y = pose.face > 0 ? 0 : Math.PI;
        raiz.rotation.z = giro;
        raiz.setEnabled(pose.visivel);
        // Estudos históricos não trazem os golpes novos; só o laboratório usa
        // essa reserva. Os GLBs jogáveis exportam os clipes próprios.
        const reservas = { foc: 'p2', espEx: 'esp', dpEx: 'dp', tatsuEx: 'tatsu', ultra: 'esp' };
        const grupo = grupos.get(pose.clip) || grupos.get(reservas[pose.clip]);
        if (!grupo) return;
        const distanciaCiclo = ciclosPorDistancia.get(grupo.name);
        const marchaAtiva = !!distanciaCiclo;
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
          const emendaChute = atual?.name === 'p2' && grupo.name === 'k2';
          // Chutes (troca de perna, chute cortado, volta à guarda) também fundem
          // as poses em 4 quadros, antes da janela ativa. Defesa e dano entram na hora.
          // (Rasteira e chute aéreo ficam de fora: a fusão perto do piso o atravessaria.)
          // Chute agachado (ck) também funde ao voltar para a guarda ou para o agachar.
          const trocaChute = !!atual && !emendaChute && (/^(k1|k2)$/.test(grupo.name)
            || /^(k1|k2)$/.test(atual.name) && ['parado', 'andando', 'recuo'].includes(grupo.name)
            || atual.name === 'ck' && ['parado', 'agachado'].includes(grupo.name));
          const PASSADAS = ['parado', 'andando', 'recuo', 'pousando']; // corrida entra direto na passada certa
          const trocaPassada = !!atual && PASSADAS.includes(atual.name) && PASSADAS.includes(grupo.name);
          // Fim da queda emenda no levantar sem estalo.
          const levanta = atual?.name === 'caido' && grupo.name === 'levantando';
          const fimTransicao = emendaChute || trocaPassada || levanta ? 6 : 4;
          const suavizar = atual?.name === 'p1' && grupo.name === 'p2'
            || emendaChute || trocaChute || trocaPassada || levanta
            || atual?.name === 'defesa' && grupo.name === 'parado';
          transicao = id === 'pipoca' && suavizar && pose.quadro < fimTransicao ? {
            inicio: Math.max(0, pose.quadro),
            fim: fimTransicao,
            // A perna de apoio continua na IK do chute. Suavizar também quadril
            // e pernas deslocaria a sola entre duas poses com o pé ancorado.
            ossos: nosDosOssos.filter(no => !emendaChute || !/^(quadril|coxa_[ED]|canela_[ED]|pe_[ED])$/.test(no.name)).map(no => ({
              no, posicao: no.position.clone(), escala: no.scaling.clone(),
              rotacao: no.rotationQuaternion?.clone() || Quaternion.FromEulerVector(no.rotation),
            })),
          } : null;
          atual?.stop(); grupo.start(false); grupo.pause(); atual = grupo;
        }
        grupo.goToFrame(marchaAtiva ? grupo.from + faseMarcha : quadroDoClip(pose, grupo));
        if (transicao && pose.quadro >= transicao.fim) transicao = null;
        if (transicao) {
          const t = Math.max(0, Math.min(1, (pose.quadro - transicao.inicio) / (transicao.fim - transicao.inicio)));
          const peso = t * t * (3 - 2 * t);
          for (const { no, posicao, escala, rotacao } of transicao.ossos) {
            Vector3.LerpToRef(posicao, no.position, peso, no.position);
            Vector3.LerpToRef(escala, no.scaling, peso, no.scaling);
            no.rotationQuaternion ||= Quaternion.FromEulerVector(no.rotation);
            Quaternion.SlerpToRef(rotacao, no.rotationQuaternion, peso, no.rotationQuaternion);
          }
        }
        if (pose.volta) girarSobreApoio(pose.volta);
      },
      descartar() { container.dispose(); raiz.dispose(); },
    };
  } catch (erro) { container.dispose(); raiz?.dispose(); throw erro; }
}
