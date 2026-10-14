import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { PERFIL_PIPOCA } from './perfil-pipoca.mjs';

const TAMANHO_POOL = 12;
const LIMITES = Object.freeze({ impacto: 16, defesa: 12, poeira: 14, toca: 18, especial: 12 });

export function criarEfeitos(scene, simulador, movimentoReduzido = { matches: false }, { impactosFinal = true, chuvaFinal = true } = {}) {
  let cursor = 0, relogio = 0, ultimoQuadro = null, ultimoQuadroEventos = null, ultimaFase = null, ultimoFT = null, ultimoFinal = null, encerrado = false;
  const personagens = [], memoria = new Map();
  function material(nome, cor) {
    const tinta = new StandardMaterial(nome, scene);
    tinta.disableLighting = true; tinta.emissiveColor = Color3.FromHexString(cor);
    tinta.backFaceCulling = false;
    return tinta;
  }
  const brilho = material('pipoca-vfx-brilho', PERFIL_PIPOCA.brilho);
  const interior = material('pipoca-vfx-interior-toca', PERFIL_PIPOCA.interiorToca);
  const laranja = material('pipoca-vfx-cenoura', PERFIL_PIPOCA.cenoura);
  const verde = material('pipoca-vfx-folhas', PERFIL_PIPOCA.folhas);
  for (const tinta of [laranja, verde]) {
    tinta.disableLighting = false;
    tinta.diffuseColor = tinta.emissiveColor.clone();
    tinta.emissiveColor.scaleInPlace(.18);
    tinta.specularColor.set(.15, .12, .08);
    tinta.specularPower = 24;
  }

  function raios(nome) {
    const malha = new Mesh(nome, scene), dados = new VertexData();
    dados.positions = []; dados.indices = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), base = i * 4;
      for (const [raio, largura] of [[.21, -.025], [.58, -.012], [.58, .012], [.21, .025]]) {
        dados.positions.push(c * raio - s * largura, s * raio + c * largura, -.012);
      }
      dados.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    dados.normals = []; VertexData.ComputeNormals(dados.positions, dados.indices, dados.normals);
    dados.applyToMesh(malha);
    malha.material = brilho; malha.isPickable = false;
    return malha;
  }

  const pool = Array.from({ length: TAMANHO_POOL }, (_, i) => {
    const raiz = new TransformNode(`impacto-raiz-${i}`, scene);
    const anel = MeshBuilder.CreateTorus(`impacto-${i}`, { diameter: 1, thickness: .055, tessellation: 24 }, scene);
    const tinta = material(`impacto-cor-${i}`, '#ffcc55');
    anel.material = tinta; anel.parent = raiz; anel.isPickable = false;
    const tracos = raios(`pipoca-vfx-raios-${i}`); tracos.parent = raiz;
    const centro = MeshBuilder.CreateDisc(`pipoca-vfx-toca-${i}`, { radius: .46, tessellation: 24 }, scene);
    centro.parent = raiz; centro.material = interior; centro.isPickable = false;
    raiz.setEnabled(false);
    return { raiz, anel, tracos, centro, material: tinta, nascimento: -100, forte: 0, tipo: 'impacto', pipoca: false, face: 1 };
  });

  function criarCenoura(nome) {
    const raiz = new TransformNode(nome, scene);
    const corpo = MeshBuilder.CreateCylinder(`${nome}-corpo`, { height: .54, diameterTop: .19, diameterBottom: .025, tessellation: 16 }, scene);
    corpo.parent = raiz; corpo.rotation.z = Math.PI / 2; corpo.material = laranja; corpo.isPickable = false;
    for (let i = 0; i < 3; i++) {
      const folha = MeshBuilder.CreateCylinder(`${nome}-folha-${i}`, { height: .24, diameterTop: .025, diameterBottom: .055, tessellation: 5 }, scene);
      folha.parent = raiz; folha.material = verde; folha.isPickable = false;
      folha.position.set(-.29, (i - 1) * .045, 0); folha.rotation.z = Math.PI / 2 + (i - 1) * .55;
    }
    // Hadouken: só a chama (brilho-golpes.js) aparece; o modelo de cenoura fica oculto.
    raiz.getChildMeshes().forEach(m => { m.isVisible = false; });
    raiz.setEnabled(false);
    return raiz;
  }
  const cenouras = Array.from({ length: 2 }, (_, dono) => criarCenoura(`pipoca-cenoura-${dono}`));
  // Dezoito quedas, espaçadas por seis quadros, reutilizam oito cenouras.
  // Cada queda dura 36 quadros: nenhum slot é reutilizado ainda visível.
  const chuva = Array.from({ length: 8 }, (_, i) => {
    const raiz = cenouras[0].clone(`pipoca-final-cenoura-${i}`);
    raiz.setEnabled(false);
    return raiz;
  });

  const xMundo = x => (x / simulador.U - simulador.LARGURA / 2) / 24;
  const yMundo = y => y / simulador.U / 24;
  const idDoLado = (lado, estado) => estado?.p?.[lado]?.id || personagens[lado];

  function emitir(tipo, x, y, { forte = 0, pipoca = false, face = 1 } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const item = pool[cursor++ % pool.length];
    Object.assign(item, { tipo, forte: Math.max(0, Math.min(2, forte)), pipoca, face, nascimento: relogio });
    item.raiz.position.set(xMundo(x), yMundo(y), tipo === 'toca' ? 0 : -.35);
    const cor = tipo === 'defesa' ? pipoca ? PERFIL_PIPOCA.defesa : '#69d9ff'
      : tipo === 'poeira' ? PERFIL_PIPOCA.poeira : tipo === 'toca' ? PERFIL_PIPOCA.toca
      : tipo === 'especial' ? PERFIL_PIPOCA.defesa : pipoca ? PERFIL_PIPOCA.impacto : '#ffcc55';
    item.material.emissiveColor = Color3.FromHexString(cor);
  }

  function limpar() {
    cursor = 0; relogio = 0; ultimoQuadro = null; ultimoQuadroEventos = null; ultimaFase = null; ultimoFT = null; ultimoFinal = null;
    memoria.clear(); personagens.length = 0;
    for (const item of pool) { item.nascimento = -100; item.raiz.setEnabled(false); }
    for (const raiz of cenouras) raiz.setEnabled(false);
    for (const raiz of chuva) raiz.setEnabled(false);
  }

  function sincronizar(quadro, estado) {
    if (!Number.isFinite(quadro) || quadro === ultimoQuadro) return;
    if (ultimoQuadro !== null && quadro < ultimoQuadro) limpar();
    if (ultimoQuadro !== null) {
      // f continua durante hitstop; fT fica imóvel. A pausa do laboratório não
      // chama novos passos. Não há tempo de parede nem relógio independente.
      const delta = estado && Number.isFinite(estado.fT) && ultimaFase === estado.fase && ultimoFT !== null
        ? Math.max(0, estado.fT - ultimoFT) : quadro - ultimoQuadro;
      relogio += Math.max(0, delta);
    }
    ultimoQuadro = quadro; ultimaFase = estado?.fase ?? null; ultimoFT = Number.isFinite(estado?.fT) ? estado.fT : null;
  }

  function observar(estado) {
    if (!estado?.p) return;
    for (const p of estado.p) {
      personagens[p.lado] = p.id;
      if (p.id !== 'pipoca') continue;
      const anterior = memoria.get(p.lado);
      if (p.sumido && !anterior?.sumido) emitir('toca', p.x, .6 * simulador.U, { pipoca: true, face: p.face });
      if (!p.sumido && anterior?.sumido) emitir('poeira', p.x, 2 * simulador.U, { pipoca: true, forte: 1, face: p.face });
      if (p.estado === 'pousando' && anterior?.estado !== 'pousando') emitir('poeira', p.x, 2 * simulador.U, { pipoca: true, face: p.face });
      memoria.set(p.lado, { sumido: !!p.sumido, estado: p.estado });
    }
  }

  function eventos(lista, quadro, estado = null) {
    if (encerrado) return;
    sincronizar(quadro, estado);
    if (ultimoQuadroEventos === quadro) { observar(estado); return; }
    ultimoQuadroEventos = quadro;
    for (const e of lista) {
      if (e.id && Number.isInteger(e.lado)) personagens[e.lado] = e.id;
      if (e.t === 'acerto' || e.t === 'defendeu') {
        emitir(e.t === 'defendeu' ? 'defesa' : 'impacto', e.x, e.y,
          { forte: e.forte || 0, pipoca: idDoLado(e.lado, estado) === 'pipoca', face: estado?.p?.[e.lado]?.face || 1 });
      } else if (idDoLado(e.lado, estado) === 'pipoca') {
        const p = estado?.p?.[e.lado];
        if (!p) continue;
        if (e.t === 'especial') emitir('especial', p.x + p.face * 14 * simulador.U, p.y + 42 * simulador.U, { pipoca: true, face: p.face });
        if (e.t === 'pulo' || e.t === 'chao' || e.t === 'super') emitir('poeira', p.x, Math.max(2 * simulador.U, p.y), { pipoca: true, forte: e.t === 'super' ? 1 : 0, face: p.face });
      }
    }
    observar(estado);
  }

  function atualizar(quadro, estado = null) {
    if (encerrado) return;
    sincronizar(quadro, estado); observar(estado);
    const reduzido = !!movimentoReduzido.matches;
    const vencedor = estado?.p?.[estado.vencedor];
    const vitima = estado?.p?.find(p => p.lado !== estado.vencedor);
    const finalPipoca = chuvaFinal && estado?.fase === 'final' && vencedor?.id === 'pipoca' && vitima;
    for (const raiz of chuva) raiz.setEnabled(false);
    if (finalPipoca) {
      const tempo = Math.max(0, estado.fT);
      for (let i = 0; i < 18; i++) {
        const idade = tempo - i * 6;
        const x = vitima.x + ((i * 13) % 40 - 20) * simulador.U;
        if (idade >= 0 && idade < 36 && (!reduzido || idade >= 30)) {
          const raiz = chuva[i % chuva.length];
          raiz.setEnabled(true);
          raiz.position.set(xMundo(x), reduzido ? .5 : (140 - idade * 3.6) / 24, -.22 + (i % 3) * .08);
          raiz.rotation.z = -Math.PI / 2 + Math.sin(i) * .3;
          raiz.scaling.setAll(reduzido ? .75 : 1.15);
        }
        const contato = i * 6 + 36;
        if (ultimoFinal !== null && ultimoFinal < contato && tempo >= contato) {
          if (impactosFinal) emitir('impacto', x, 18 * simulador.U, { pipoca: true });
        }
      }
      ultimoFinal = tempo;
    } else ultimoFinal = null;
    for (const item of pool) {
      const idade = relogio - item.nascimento;
      const generico = !item.pipoca && ['impacto', 'defesa'].includes(item.tipo);
      const duracao = generico ? 16 : LIMITES[item.tipo];
      item.raiz.setEnabled(idade >= 0 && idade < duracao);
      if (idade < 0 || idade >= duracao) continue;
      const fase = idade / duracao, piso = item.tipo === 'toca';
      const tamanho = generico || item.tipo === 'impacto' ? .3 + item.forte * .1 + (reduzido ? 0 : idade * .04)
        : item.tipo === 'defesa' ? .34 + (reduzido ? 0 : idade * .013)
        : item.tipo === 'especial' ? .3 + (reduzido ? 0 : idade * .018)
        : .5 + item.forte * .15 + (reduzido ? 0 : idade * .025);
      item.raiz.scaling.set(tamanho, piso ? 1 : item.tipo === 'poeira' ? tamanho * .45 : tamanho, piso ? tamanho * .55 : tamanho);
      item.raiz.rotation.z = reduzido || !item.pipoca || piso ? 0 : item.face * .12;
      item.anel.rotation.x = piso ? 0 : Math.PI / 2;
      item.tracos.rotation.x = piso ? Math.PI / 2 : 0;
      item.centro.rotation.x = Math.PI / 2;
      item.centro.position.y = -.006;
      item.material.alpha = Math.max(0, (1 - fase) * .8);
      item.tracos.setEnabled(item.pipoca && item.tipo === 'impacto' && !reduzido);
      item.tracos.visibility = Math.max(0, 1 - fase);
      item.centro.setEnabled(piso);
      item.centro.visibility = Math.max(0, (1 - fase) * .75);
    }
    for (let dono = 0; dono < cenouras.length; dono++) {
      const raiz = cenouras[dono];
      const p = estado?.proj?.find(p => p.dono === dono && p.tipo === 'cenoura' && p.vida > 0 && idDoLado(dono, estado) === 'pipoca');
      raiz.setEnabled(!!p);
      if (!p) continue;
      raiz.position.set(xMundo(p.x), yMundo(p.y), -.12);
      // Ponta sempre para onde a cenoura vai (na volta do bumerangue, vira junto).
      raiz.rotation.z = p.vx >= 0 ? 0 : Math.PI;
    }
  }

  function descartar() {
    if (encerrado) return;
    encerrado = true;
    scene.onDisposeObservable.remove(aoEncerrar);
    for (const item of pool) { item.raiz.dispose(); item.material.dispose(); }
    for (const raiz of cenouras) raiz.dispose();
    for (const raiz of chuva) raiz.dispose();
    for (const tinta of [brilho, interior, laranja, verde]) tinta.dispose();
    memoria.clear();
  }
  const aoEncerrar = scene.onDisposeObservable.addOnce(descartar);
  return { eventos, atualizar, limpar, descartar };
}
