import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESTADOS_VISUAIS, descreverPose } from '../src/3d/estado-visual.mjs';
import { LIMITE_GLB, validarGlb } from '../src/3d/contrato-glb.mjs';

const raiz = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const require = createRequire(import.meta.url);
const simulador = require('../public/js/ko-sim.js');
const erros = [], pendencias = [];
const argumentos = process.argv.slice(2);
const exigirPronto = argumentos.includes('--exigir-pronto');

function arquivo(caminho) {
  assert.equal(typeof caminho, 'string', 'Caminho de arquivo ausente.');
  assert.ok(caminho.length && !isAbsolute(caminho), 'Use caminho relativo ao projeto.');
  const destino = realpathSync(resolve(raiz, caminho));
  const rel = relative(raiz, destino);
  assert.ok(rel !== '..' && !rel.startsWith(`..\\`) && !rel.startsWith('../') && !isAbsolute(rel), 'Arquivo fora do projeto.');
  return destino;
}

const lerJson = caminho => JSON.parse(readFileSync(arquivo(caminho), 'utf8'));
const sha256 = caminho => createHash('sha256').update(readFileSync(arquivo(caminho))).digest('hex');
const ordenar = nomes => [...nomes].sort();

function conferir(rotulo, fn) {
  try { fn(); console.log(`OK: ${rotulo}`); }
  catch (erro) { erros.push(`${rotulo}: ${erro.message}`); }
}

let contrato, manifesto;
try {
  assert.ok(argumentos.every(a => a === '--exigir-pronto'), 'Argumento desconhecido. Use somente --exigir-pronto.');
  contrato = lerJson('art/premium/modelos-3d/contrato.json');
  manifesto = lerJson(contrato.fontes.manifesto);
  assert.ok(Array.isArray(contrato.lutadores) && Array.isArray(manifesto), 'Contrato ou manifesto sem elenco.');
} catch (erro) {
  console.error(`ERRO: ${erro.message}`);
  process.exit(1);
}

conferir('simulação e elenco de produção', () => {
  assert.equal(contrato.fontes.simulacao, 'public/js/ko-sim.js');
  assert.equal(contrato.fontes.manifesto, 'art/premium/elenco/manifesto.json');
  assert.equal(sha256(contrato.fontes.simulacao), contrato.fontes.sha256Simulacao, 'A simulação mudou desde o registro do contrato.');
  assert.deepEqual(ordenar(contrato.lutadores.map(l => l.id)), ['pipoca', 'uivo']);
  assert.equal(new Set(manifesto.map(l => l.id)).size, manifesto.length, 'Manifesto com IDs duplicados.');
  assert.equal(contrato.animacao.fpsSimulacao, 60);
});

conferir('contrato de importação local', () => {
  assert.equal(contrato.arquivo.formato, 'GLB glTF 2.0');
  assert.equal(contrato.arquivo.autocontido, true);
  assert.equal(contrato.arquivo.urisExternasPermitidas, false);
  assert.equal(contrato.arquivo.urisEmBuffersOuImagensPermitidas, false);
  assert.deepEqual(contrato.arquivo.extensoesObrigatorias, []);
  assert.deepEqual(contrato.arquivo.extensoesUsadas, []);
  assert.equal(contrato.arquivo.limiteImportacaoBytes, LIMITE_GLB);
  assert.equal(contrato.arquivo.frentePersonagem, '+X');
  assert.equal(contrato.arquivo.eixoVertical, '+Y');
  assert.equal(contrato.arquivo.unidade, 'metro');
});

conferir('21 estados, ciclos e relógio do adaptador', () => {
  assert.equal(ESTADOS_VISUAIS.length, 21);
  assert.equal(new Set(ESTADOS_VISUAIS).size, 21);
  const nomes = contrato.animacao.nomesExatosObrigatorios;
  assert.equal(nomes.length, 31);
  assert.equal(new Set(nomes).size, 31, 'Contrato com clips duplicados.');
  assert.deepEqual(ordenar(nomes.filter(n => ESTADOS_VISUAIS.includes(n))), ordenar(ESTADOS_VISUAIS));
  const estado = simulador.novo({ lutadores: ['pipoca', 'uivo'], treino: true });
  const antes = JSON.stringify(estado);
  const ciclos = ESTADOS_VISUAIS.filter(nome => descreverPose({ ...estado.p[0], estado: nome }, simulador, estado).ciclico);
  assert.deepEqual(ordenar(contrato.animacao.ciclos), ordenar(ciclos));
  for (const nome of ESTADOS_VISUAIS) {
    // Defesa usa o relógio da fase (s.fT); sem fT o quadro viria 0 no estado novo.
    const pose = descreverPose({ ...estado.p[0], estado: nome, t: 12 }, simulador, { ...estado, fT: 12 });
    assert.equal(pose.clip, nome);
    assert.equal(pose.quadro, 12);
  }
  for (const nome of ['final', 'vitimaFinal']) {
    const pose = descreverPose({ ...estado.p[0], estado: nome, t: 12 }, simulador, { ...estado, fase: 'final', fT: 42 });
    assert.equal(pose.quadro, 42, 'Encenação final precisa do relógio de fase.');
  }
  assert.ok(contrato.animacao.terminaisMantemUltimaPose.includes('vitoria'));
  assert.equal(JSON.stringify(estado), antes, 'Adaptador alterou a simulação.');
});

for (const lutador of contrato.lutadores) {
  conferir(`${lutador.id}: arte atual, altura e dez golpes`, () => {
    const atual = manifesto.find(l => l.id === lutador.id);
    assert.ok(atual, 'Lutador ausente do manifesto.');
    assert.equal(lutador.nome, atual.nome);
    assert.equal(lutador.referencia, `art/premium/elenco/${atual.arte}`, 'Referência não corresponde à versão vigente.');
    assert.equal(sha256(lutador.referencia), lutador.sha256Referencia, 'Arte diferente do arquivo revisado.');
    const dados = simulador.LUTADORES[lutador.id];
    assert.ok(dados, 'Lutador ausente da simulação.');
    assert.equal(lutador.alturaCorpoSimulacaoPixels, dados.altura);
    assert.equal(lutador.alturaCorpoVisualInicialMetros, dados.altura / 24);
    const poseAltura = descreverPose({ ...simulador.novo({ lutadores: ['pipoca', 'uivo'] }).p[0], y: dados.altura * simulador.U }, simulador);
    assert.equal(poseAltura.y, lutador.alturaCorpoVisualInicialMetros, 'Escala do adaptador diverge do contrato.');
    assert.equal(Object.keys(dados.golpes).length, 10);
    assert.deepEqual(ordenar(Object.keys(lutador.golpes)), ordenar(Object.keys(dados.golpes)));
    assert.deepEqual(ordenar(contrato.animacao.nomesExatosObrigatorios), ordenar([...ESTADOS_VISUAIS, ...Object.keys(dados.golpes)]));
    for (const [nome, registro] of Object.entries(lutador.golpes)) {
      const real = dados.golpes[nome];
      assert.equal(registro.duracaoQuadros, real.dur, `Duração divergente: ${nome}.`);
      assert.deepEqual(registro.janelasAtivas, (real.janelas || []).map(j => [j.de, j.ate]), `Janelas divergentes: ${nome}.`);
      assert.deepEqual(registro.invisivelQuadrosInclusive, real.toca, `Invisibilidade divergente: ${nome}.`);
      assert.deepEqual(registro.invulneravelQuadrosInclusive, real.inv, `Invulnerabilidade divergente: ${nome}.`);
      assert.deepEqual(registro.movimentosQuadros, real.mov, `Movimento divergente: ${nome}.`);
      if (real.proj) {
        assert.deepEqual(registro.projetil, { tipo: real.proj.tipo, criacaoQuadro: real.proj.quadro, retornoQuadroDoProjetil: real.proj.volta, vidaInicialQuadros: real.proj.vida });
      } else assert.equal(registro.projetil, undefined);
      const pose = descreverPose({ id: lutador.id, estado: 'golpe', golpe: nome, t: 5, x: 0, y: 0, face: 1 }, simulador);
      assert.equal(pose.clip, nome);
      assert.equal(pose.duracao, registro.duracaoQuadros);
      assert.equal(pose.ciclico, false);
    }
  });

  if (lutador.modeloFinal === null) {
    pendencias.push(`${lutador.nome}: modeloFinal=null; GLB final ainda não entregue.`);
  } else {
    conferir(`${lutador.id}: arquivo GLB final`, () => {
      assert.equal(typeof lutador.modeloFinal, 'string', 'modeloFinal deve ser null ou caminho relativo.');
      const buffer = readFileSync(arquivo(lutador.modeloFinal));
      validarGlb(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), lutador.id, simulador);
    });
  }
}

conferir('registro de aceitação explícito', () => {
  assert.ok(contrato.aceitacao && Object.keys(contrato.aceitacao).length, 'Registro de aceitação ausente.');
  assert.deepEqual(ordenar(Object.keys(contrato.aceitacao)), ordenar([
    'identidadeComparadaComReferenciasAtuais', 'glbValidado', 'clipsValidados', 'colisoesComparadas',
    'desempenhoEmIPhoneFisico', 'desempenhoEmAndroidFisico', 'testeEmTVOuComputadorHDMI',
    'aprovadoParaSubstituirRenderizadorPrincipal',
  ]), 'Etapas de aceitação removidas ou desconhecidas.');
  for (const [nome, concluido] of Object.entries(contrato.aceitacao)) {
    assert.equal(typeof concluido, 'boolean', `Aceitação inválida: ${nome}.`);
    if (!concluido) pendencias.push(`Revisão: ${nome}.`);
  }
  if (contrato.aceitacao.aprovadoParaSubstituirRenderizadorPrincipal) {
    assert.ok(contrato.lutadores.every(l => typeof l.modeloFinal === 'string'), 'Aprovação registrada com modelo final ausente.');
    assert.ok(Object.values(contrato.aceitacao).every(Boolean), 'Aprovação registrada com revisão pendente.');
  }
});

for (const erro of erros) console.error(`ERRO: ${erro}`);
for (const pendencia of pendencias) console.log(`PENDENTE: ${pendencia}`);
if (erros.length) process.exitCode = 1;
else if (pendencias.length) {
  console.log('Contrato consistente. Produção 3D PENDENTE; este resultado não indica jogo ou modelos prontos.');
  if (exigirPronto) process.exitCode = 2;
} else {
  console.log('Arquivos e registro de aceitação presentes. A conferência automática não substitui revisão visual nem testes físicos.');
}
