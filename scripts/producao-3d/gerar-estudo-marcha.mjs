import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarEstudoReacao } from './gerar-estudo-reacao.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DISTANCIA_CICLO = 1.3125;
const REVISADOS = ['parado', 'p1', 'p2', 'defesa', 'dano', 'andando'];

export function criarEstudoMarcha(guarda, jab, forte, defesa, reacao, marcha, simulador) {
  const dados = criarEstudoReacao(guarda, jab, forte, defesa, reacao, simulador);
  assert.equal(marcha.nome, 'andando', 'Somente a marcha andando é substituída');
  assert.equal(marcha.duracaoQuadros, 12, 'Marcha de 12 quadros');
  assert.equal(marcha.canais.length, 40, 'Marcha define os 20 ossos completos');
  const alvos = new Set();
  for (const canal of marcha.canais) {
    assert.ok(Number.isInteger(canal.osso) && canal.osso >= 0 && canal.osso < 20, 'Osso pertence ao rig');
    assert.ok(['rotation', 'translation'].includes(canal.tipo));
    const alvo = `${canal.osso}:${canal.tipo}`;
    assert.ok(!alvos.has(alvo), 'Canal da marcha não se repete'); alvos.add(alvo);
    assert.equal(canal.tempos.length, 25, 'Marcha amostrada a cada meio quadro');
    const tamanho = canal.tipo === 'rotation' ? 4 : 3;
    assert.equal(canal.valores.length, canal.tempos.length * tamanho);
    for (let i = 0; i < canal.tempos.length; i++) {
      assert.ok(Number.isFinite(canal.tempos[i]) && Math.abs(canal.tempos[i] - i / 120) < 1e-8, 'Tempos de meio quadro a 60 FPS');
      const valores = canal.valores.slice(i * tamanho, (i + 1) * tamanho);
      assert.ok(valores.every(Number.isFinite), 'Canais contêm apenas valores finitos');
      if (canal.tipo === 'rotation') assert.ok(Math.abs(Math.hypot(...valores) - 1) < .002, 'Quaternion normalizado');
      if (canal.osso === 0 && canal.tipo === 'translation') assert.ok(Math.abs(valores[0]) < 1e-5 && Math.abs(valores[2]) < 1e-5, 'Marcha não desloca raiz horizontalmente');
    }
    const inicio = canal.valores.slice(0, tamanho), fim = canal.valores.slice(-tamanho);
    const sinal = canal.tipo === 'rotation' && inicio.reduce((s, v, i) => s + v * fim[i], 0) < 0 ? -1 : 1;
    assert.ok(inicio.every((v, i) => Math.abs(v - sinal * fim[i]) < 1e-6), 'Ciclo da marcha fecha sem mudança de pose');
  }
  for (let i = 0; i < 20; i++) for (const tipo of ['rotation', 'translation']) assert.ok(alvos.has(`${i}:${tipo}`));
  const velocidadeReferencia = simulador.LUTADORES.pipoca.andar / (simulador.U * 24);
  assert.equal(velocidadeReferencia * marcha.duracaoQuadros, DISTANCIA_CICLO, 'Passada acompanha a velocidade atual da Pipoca');
  dados.clips = dados.clips.map(c => c.nome === 'andando' ? structuredClone(marcha) : c);
  dados.extras.status = 'estudo-guarda-socos-defesa-reacao-marcha';
  dados.extras.animacoes = 'Guarda, dois socos, defesa alta, reação e marcha revisados; outros 25 clips preservados.';
  dados.extras.marcha = { clip: 'andando', distanciaCiclo: DISTANCIA_CICLO, duracaoQuadros: 12,
    apoioQuadros: 6, excursao: .328125, alturaBalanco: .08, amostragemQuadros: .5,
    velocidadeReferencia, fase: 'distancia-horizontal-assinada', personagem: 'pipoca' };
  return dados;
}

export function gerarEstudoMarcha() {
  const pasta = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo');
  const ler = nome => JSON.parse(readFileSync(resolve(pasta, nome)));
  const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
  const shaSim = createHash('sha256').update(readFileSync(resolve(raiz, 'public/js/ko-sim.js'))).digest('hex');
  for (const arquivo of ['jab-relatorio-v5.json', 'soco-forte-relatorio-v6.json', 'defesa-relatorio-v7.json', 'reacao-relatorio-v8.json', 'marcha-relatorio-v9.json']) {
    assert.equal(ler(arquivo).sha256Simulacao, shaSim, 'Fontes seguem o motor atual');
  }
  const origem = ler('marcha-relatorio-v9.json');
  assert.equal(origem.distanciaCiclo, DISTANCIA_CICLO);
  assert.equal(origem.duracaoQuadros, 12);
  assert.equal(origem.apoioQuadros, 6);
  assert.equal(origem.amostragemQuadros, .5);
  const dados = criarEstudoMarcha(ler('guarda-v4.json'), ler('jab-v5.json'), ler('soco-forte-v6.json'),
    ler('defesa-v7.json'), ler('reacao-v8.json'), ler('andando-v9.json'), K);
  const bytes = exportarGlb(dados);
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K);
  assert.equal(doc.animations.length, 31);
  assert.equal(doc.extras.marcha.distanciaCiclo, DISTANCIA_CICLO);
  const caminho = 'public/modelos/estudos/pipoca-marcha-v9.glb';
  writeFileSync(resolve(raiz, caminho), bytes);
  const relatorio = { aprovadoFinal: false, caminho, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), clips: 31, substituidos: REVISADOS,
    marcha: dados.extras.marcha, preservados: dados.clips.filter(c => !REVISADOS.includes(c.nome)).map(c => c.nome),
    limites: ['Arte provisória com pesos rígidos.', 'Os 25 clips restantes, incluindo corrida, permanecem em revisão.',
      'Passada por distância validada separadamente no importador; transições de entrada e saída exigem inspeção.'] };
  writeFileSync(resolve(pasta, 'integracao-v9.json'), JSON.stringify(relatorio, null, 2)+'\n');
  console.log(JSON.stringify(relatorio));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) gerarEstudoMarcha();
