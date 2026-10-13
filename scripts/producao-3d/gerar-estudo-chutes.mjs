import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarEstudoCorpo } from './gerar-estudo-corpo.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REVISADOS = ['parado', 'p1', 'p2', 'defesa', 'dano', 'andando', 'k1', 'k2'];

// k1 são dois chutes médios (perna E, depois D); k2 é o chute alto de perna E.
const LADO_POR_JANELA = { k1: ['E', 'D'], k2: ['E'] };

function substituirChute(dados, clip, nome, simulador) {
  const golpe = simulador.LUTADORES.pipoca.golpes[nome];
  assert.ok(nome === 'k1' || nome === 'k2', 'Somente os chutes k1/k2 são substituídos');
  assert.equal(clip.nome, nome, 'Somente o chute escolhido é substituído');
  assert.equal(clip.duracaoQuadros, golpe.dur, 'Duração segue o motor');
  assert.equal(clip.canais.length, 40, 'Rotação e posição dos 20 ossos');
  const alvos = new Set();
  for (const canal of clip.canais) {
    assert.equal(canal.tempos[0], 0);
    assert.ok(Math.abs(canal.tempos.at(-1) - golpe.dur / 60) < 1e-7);
    assert.ok(Number.isInteger(canal.osso) && canal.osso >= 0 && canal.osso < 20, 'Osso pertence ao rig');
    assert.ok(['rotation', 'translation'].includes(canal.tipo), 'Tipo de canal conhecido');
    const alvo = `${canal.osso}:${canal.tipo}`;
    assert.ok(!alvos.has(alvo), `Canal de ${nome} não se repete`); alvos.add(alvo);
    const tamanho = canal.tipo === 'rotation' ? 4 : 3;
    assert.equal(canal.valores.length, canal.tempos.length * tamanho);
    if (canal.osso === 0 && canal.tipo === 'translation') {
      // O impulso da pelve é animação interna (a posição jogável vem da simulação):
      // começa/termina em zero e sem deslocamento lateral, com avanço frontal limitado.
      for (let i = 0; i < canal.valores.length; i += 3) {
        assert.ok(Math.abs(canal.valores[i]) < .16, `Pelve de ${nome} dentro do avanço do quadril`);
        assert.ok(Math.abs(canal.valores[i + 2]) < .02, `Pelve de ${nome} sem lateral`);
      }
      assert.ok(Math.abs(canal.valores[0]) < 1e-4 && Math.abs(canal.valores.at(-3)) < 1e-4, `${nome} com pelve em zero nas pontas`);
    }
  }
  for (let i = 0; i < 20; i++) for (const tipo of ['rotation', 'translation']) assert.ok(alvos.has(`${i}:${tipo}`));
  return { ...dados, clips: dados.clips.map(c => c.nome === nome ? structuredClone(clip) : c) };
}

export function criarEstudoChutes(guarda, jab, forte, defesa, reacao, marcha, k1, k2, simulador) {
  let dados = criarEstudoCorpo(guarda, jab, forte, defesa, reacao, marcha, simulador);
  // substituirChute é uma função pura: o retorno precisa ser capturado, senão o
  // GLB mantém o placeholder k1/k2 da marcha e ignora os canais dos chutes.
  for (const [clip, nome] of [[k1, 'k1'], [k2, 'k2']]) dados = substituirChute(dados, clip, nome, simulador);
  // Os dois chutes começam e terminam na guarda completa, incluindo todos os ossos.
  for (const clip of [k1, k2]) for (const canal of clip.canais) {
    const referencia = guarda.canais.find(c => c.osso === canal.osso && c.tipo === canal.tipo);
    assert.ok(referencia, 'Canal presente na guarda');
    const tamanho = canal.tipo === 'rotation' ? 4 : 3;
    for (const valores of [canal.valores.slice(0, tamanho), canal.valores.slice(-tamanho)]) {
      const alvo = referencia.valores.slice(0, tamanho);
      const sinal = canal.tipo === 'rotation' && valores.reduce((s, v, i) => s + v * alvo[i], 0) < 0 ? -1 : 1;
      assert.ok(valores.every((v, i) => Math.abs(sinal * v - alvo[i]) < .001), 'Chute começa e termina na guarda completa');
    }
  }
  for (const [nome, lados] of Object.entries(LADO_POR_JANELA)) {
    assert.equal(simulador.LUTADORES.pipoca.golpes[nome].janelas.length, lados.length, `${nome} com janela por perna`);
  }
  dados.extras.status = 'estudo-guarda-socos-defesa-reacao-marcha-chutes';
  assert.ok(dados.extras.corpo.verticesMistos > 0, 'Os chutes preservam o corpo contínuo e seus pesos graduais');
  dados.extras.animacoes = 'Guarda, dois socos, defesa, reação, marcha e chutes por IK; outros 23 clips preservados.';
  dados.extras.chutes = {
    k1: { ladoJanelas: LADO_POR_JANELA.k1, alturaJanelas: ['media', 'media'], duracaoQuadros: k1.duracaoQuadros,
      apoio: 'Perna oposta ancorada durante a extensão', impulso: 'Quadril transladado e girado dentro da raiz' },
    k2: { ladoJanelas: LADO_POR_JANELA.k2, alturaJanelas: ['alta'], duracaoQuadros: k2.duracaoQuadros,
      apoio: 'Perna oposta ancorada durante a extensão', impulso: 'Quadril transladado e girado dentro da raiz' },
  };
  return dados;
}

export function gerarEstudoChutes() {
  const pasta = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo');
  const ler = nome => JSON.parse(readFileSync(resolve(pasta, nome)));
  const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
  const shaSim = createHash('sha256').update(readFileSync(resolve(raiz, 'public/js/ko-sim.js'))).digest('hex');
  for (const arquivo of ['jab-relatorio-v5.json', 'soco-forte-relatorio-v6.json', 'defesa-relatorio-v7.json',
    'reacao-relatorio-v8.json', 'marcha-relatorio-v9.json', 'chute-relatorio-v11.json', 'chute-forte-relatorio-v12.json']) {
    assert.equal(ler(arquivo).sha256Simulacao, shaSim, 'Fontes seguem o motor atual');
  }
  assert.deepEqual(ler('chute-relatorio-v11.json').janelaContato, [[6, 8], [12, 14]], 'k1 com as janelas do motor');
  assert.deepEqual(ler('chute-forte-relatorio-v12.json').janelaContato, [[7, 10]], 'k2 com a janela do motor');
  const dados = criarEstudoChutes(ler('guarda-v4.json'), ler('jab-v5.json'), ler('soco-forte-v6.json'),
    ler('defesa-v7.json'), ler('reacao-v8.json'), ler('andando-v9.json'), ler('chute-v11.json'),
    ler('chute-forte-v12.json'), K);
  const bytes = exportarGlb(dados);
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K);
  assert.equal(doc.animations.length, 31);
  assert.equal(doc.extras.status, 'estudo-guarda-socos-defesa-reacao-marcha-chutes');
  const caminho = 'public/modelos/estudos/pipoca-chutes-v12.glb';
  writeFileSync(resolve(raiz, caminho), bytes);
  const relatorio = { aprovadoFinal: false, caminho, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), clips: 31, substituidos: REVISADOS,
    chutes: dados.extras.chutes, guardaCompletaNasExtremidades: true,
    golpes: [ler('chute-v11.json'), ler('chute-forte-v12.json')].map(c => ({
      nome: c.nome, duracaoQuadros: c.duracaoQuadros,
      janelas: K.LUTADORES.pipoca.golpes[c.nome].janelas.map(j => [j.de, j.ate]),
    })),
    preservados: dados.clips.filter(c => !REVISADOS.includes(c.nome)).map(c => c.nome),
    limites: ['Corpo com pesos graduais; acabamento artístico ainda em revisão.', 'Alcance e alturas validados no importador; leitura visual ainda pendente.',
      'Corrida e demais clips permanecem em revisão.'] };
  writeFileSync(resolve(pasta, 'integracao-v12.json'), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(JSON.stringify(relatorio));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) gerarEstudoChutes();
