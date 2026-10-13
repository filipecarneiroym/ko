import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { carregarModelo } from '../../src/3d/modelo-glb.js';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';
import { alvoPeEstadoPipoca, deslocamentoEstadoPipoca } from '../../src/producao3d/pipoca-estados.mjs';

const K = createRequire(import.meta.url)('../../public/js/ko-sim.js'), PASSO = .0625;

export async function verificarEstadosPipoca(bytes, simulador = K) {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  const doc = validarGlb(buffer, 'pipoca', simulador), fonte = doc.extras.estadosPipoca;
  assert.ok(fonte?.nomes?.length, 'GLB precisa integrar a fonte autoral v16');
  const engine = new NullEngine(), scene = new Scene(engine); let modelo;
  try {
    modelo = await carregarModelo(buffer, 'pipoca', simulador, scene);
    const esqueleto = modelo.malhas.find(m => m.skeleton).skeleton;
    const no = nome => esqueleto.bones.find(b => b.name === nome).getTransformNode();
    const malhas = modelo.malhas.filter(m => m.skeleton).map(m => {
      const juntas = m.getVerticesData('matricesIndices'), pesos = m.getVerticesData('matricesWeights');
      return { m, pes: Object.fromEntries(['E', 'D'].map(l => [l, Array.from({ length: m.getTotalVertices() }, (_, i) => i).filter(i => juntas[i * 4] === esqueleto.bones.find(b => b.name === `pe_${l}`).getIndex() && pesos[i * 4] > .99)])) };
    });
    function ler(nome, q, face) {
      const distancia = deslocamentoEstadoPipoca(nome, q, fonte.regras);
      modelo.atualizar({ clip: nome, quadro: q, x: face * distancia, y: 0, face, visivel: true, ciclico: false });
      // O verificador de geometria amostra inclusive a ponta do ciclo. Os
      // testes de runtime verificam separadamente a seleção por distância.
      const grupo = scene.animationGroups.find(g => g.name === nome);
      grupo.goToFrame(q * grupo.targetedAnimations[0].animation.framePerSecond / 60);
      const solas = { E: Infinity, D: Infinity }; let piso = Infinity;
      for (const { m, pes } of malhas) {
        m.computeWorldMatrix(true); m.skeleton.prepare(true);
        const p = m.getPositionData(true, false), matriz = m.getWorldMatrix();
        assert.ok(Array.from(m.skeleton.getTransformMatrices(m)).every(Number.isFinite));
        for (const lado of ['E', 'D']) for (const v of pes[lado]) solas[lado] = Math.min(solas[lado], Vector3.TransformCoordinates(Vector3.FromArray(p, v * 3), matriz).y);
        const mundo = matriz.m;
        for (let i = 0; i < p.length; i += 3) piso = Math.min(piso, p[i] * mundo[1] + p[i + 1] * mundo[5] + p[i + 2] * mundo[9] + mundo[13]);
      }
      function absoluto(nome) { const b = no(nome); b.computeWorldMatrix(true); return b.getAbsolutePosition().clone(); }
      const locais = esqueleto.bones.flatMap(b => { const n = b.getTransformNode(); return [...n.position.asArray(), ...n.rotationQuaternion.asArray()]; });
      return { solas, piso, cabeca: absoluto('cabeca'), pes: Object.fromEntries(['E', 'D'].map(l => [l, absoluto(`pe_${l}`)])), locais, distancia };
    }
    const estados = {};
    for (const nome of fonte.nomes) {
      const animacao = doc.animations.find(a => a.name === nome);
      const duracao = Math.round(Math.max(...animacao.samplers.map(s => doc.accessors[s.input].max?.[0] || 0)) * 60);
      const passo = ['caido', 'levantando'].includes(nome) ? .015625 : nome === 'recuo' ? .03125 : PASSO;
      const r = { duracaoQuadros: duracao, passoQuadros: passo, amostras: 0, erroApoioMaximo: 0, erroSolaApoioMaximo: 0, erroTrajetoriaMaximo: 0, pisoMinimo: Infinity, pisoMaximo: -Infinity };
      for (const face of [1, -1]) {
        const guarda = ler('parado', 0, face), repouso = nome === 'caido' ? ler(nome, 12, face) : null;
        for (let i = 0; i <= duracao / passo; i++) {
          const q = i * passo, p = ler(nome, q, face); r.amostras++;
          assert.ok(p.locais.every(Number.isFinite));
          assert.ok(Object.values(p.solas).every(Number.isFinite));
          r.pisoMinimo = Math.min(r.pisoMinimo, p.piso); r.pisoMaximo = Math.max(r.pisoMaximo, p.piso);
          assert.ok(p.piso >= -.001, `${nome} pele/roupa não atravessa o piso q${q}: ${p.piso}`);
          if (['corrida', 'recuo', 'quebra'].includes(nome)) {
            for (const lado of ['E', 'D']) {
              const esperado = alvoPeEstadoPipoca({ regras: fonte.regras }, nome, q, lado);
              const alvoMundo = esperado.alvo.clone(); alvoMundo.x = (alvoMundo.x + p.distancia) * face; alvoMundo.z *= -face;
              // A conversão de mão do glTF reflete Z; X é compensado no importador.
              const erro = p.pes[lado].subtract(alvoMundo).length();
              r.erroTrajetoriaMaximo = Math.max(r.erroTrajetoriaMaximo, erro);
              assert.ok(erro < (esperado.apoio ? .001 : .005), `${nome}/${lado} trajetória q${q} face${face}: ${erro}`);
              assert.ok(p.solas[lado] >= -.001, `${nome} sola não penetra: q${q}, ${p.solas[lado]}`);
              if (esperado.apoio) {
                r.erroApoioMaximo = Math.max(r.erroApoioMaximo, erro);
                r.erroSolaApoioMaximo = Math.max(r.erroSolaApoioMaximo, Math.abs(p.solas[lado]));
                assert.ok(Math.abs(p.solas[lado]) < .001, `${nome}/${lado} sola no apoio q${q}`);
              }
            }
          } else {
            assert.ok(p.piso >= -.001 && p.piso < .001, `${nome} corpo toca o piso sem atravessar q${q}: ${p.piso}`);
            if (nome === 'caido' && q >= 12) {
              assert.ok(p.cabeca.y < .85, 'Cabeça repousa junto ao corpo caído');
              assert.ok(p.locais.every((v, i) => Math.abs(v - repouso.locais[i]) < 1e-6), 'Corpo repousa sem deslizar após a queda');
            }
            if (nome === 'levantando' && q >= 8) for (const lado of ['E', 'D']) {
              const erro = p.pes[lado].subtract(guarda.pes[lado]).length();
              r.erroApoioMaximo = Math.max(r.erroApoioMaximo, erro);
              assert.ok(erro < .001, `Subida planta os dois pés q${q}: ${erro}`);
            }
          }
        }
        if (['recuo', 'quebra', 'levantando'].includes(nome)) {
          const final = ler(nome, duracao, face);
          assert.ok(final.locais.every((v, i) => Math.abs(v - guarda.locais[i]) < 1e-5), `${nome} retorna à guarda inteira`);
        }
        if (nome === 'corrida') {
          const inicio = ler(nome, 0, face), final = ler(nome, duracao, face);
          assert.ok(final.locais.every((v, i) => Math.abs(v - inicio.locais[i]) < 1e-5), 'Corrida fecha o ciclo de todos os ossos');
        }
      }
      if (r.pisoMinimo === Infinity) { delete r.pisoMinimo; delete r.pisoMaximo; }
      estados[nome] = r;
    }
    return { aprovadoFinal: false, sha256Glb: createHash('sha256').update(new Uint8Array(buffer)).digest('hex'), passoQuadros: PASSO,
      amostras: Object.values(estados).reduce((s, e) => s + e.amostras, 0), corrida: fonte.corrida, estados,
      limites: fonte.limites };
  } finally { modelo?.descartar(); scene.dispose(); engine.dispose(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const caminho = process.argv[2] || 'public/modelos/estudos/pipoca-direcao-visual-v13.glb';
  const relato = { caminho, ...await verificarEstadosPipoca(readFileSync(resolve(caminho))) };
  writeFileSync(resolve('art/premium/modelos-3d/estudos-mixamo/importacao-estados-v16.json'), JSON.stringify(relato, null, 2) + '\n');
  console.log(JSON.stringify(relato));
}
