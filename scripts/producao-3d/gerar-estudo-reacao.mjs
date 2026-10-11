import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarEstudoDefesa } from './gerar-estudo-defesa.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const recuperacaoQuadro = 7;
const stunMinimoMotor = 8;

function mesmaPose(valores, referencia, tipo, tolerancia = 1e-5) {
  const sinal = tipo === 'rotation' && valores.reduce((s, v, i) => s + v * referencia[i], 0) < 0 ? -1 : 1;
  return valores.every((v, i) => Math.abs(sinal * v - referencia[i]) < tolerancia);
}

export function criarEstudoReacao(guarda, jab, forte, defesa, reacao, simulador) {
  const dados = criarEstudoDefesa(guarda, jab, forte, defesa, simulador);
  assert.equal(reacao.nome, 'dano', 'Somente a reação dano é substituída');
  assert.equal(reacao.duracaoQuadros, 12, 'Reação tem 12 quadros e recupera antes do hitstun mínimo');
  assert.equal(reacao.canais.length, 40, 'Reação define os 20 ossos completos');
  const alvos = new Set();
  const pernas = new Set(dados.ossos.map((o, i) => /^(coxa|canela|pe)_/.test(o.nome) ? i : -1));
  let impacto = false;
  for (const canal of reacao.canais) {
    assert.ok(Number.isInteger(canal.osso) && canal.osso >= 0 && canal.osso < 20, 'Osso pertence ao rig');
    assert.ok(['rotation', 'translation'].includes(canal.tipo), 'Tipo de canal conhecido');
    const alvo = `${canal.osso}:${canal.tipo}`;
    assert.ok(!alvos.has(alvo), 'Canal de reação não se repete'); alvos.add(alvo);
    assert.equal(canal.tempos.length, 13, 'Reação amostra cada quadro inclusive recuperação');
    const tamanho = canal.tipo === 'rotation' ? 4 : 3;
    assert.equal(canal.valores.length, canal.tempos.length * tamanho);
    const referencia = guarda.canais.find(c => c.osso === canal.osso && c.tipo === canal.tipo)?.valores.slice(0, tamanho);
    assert.ok(referencia, 'Canal presente na guarda');
    for (let i = 0; i < canal.tempos.length; i++) {
      assert.ok(Math.abs(canal.tempos[i] - i / 60) < 1e-7, 'Tempos seguem quadros inteiros de 60 Hz');
      const valores = canal.valores.slice(i * tamanho, (i + 1) * tamanho);
      assert.ok(valores.every(Number.isFinite), 'Reação contém somente valores finitos');
      if (canal.tipo === 'rotation') assert.ok(Math.abs(Math.hypot(...valores) - 1) < .002, 'Quaternion unitário');
      if (canal.osso === 0 && canal.tipo === 'translation') assert.ok(Math.abs(valores[0]) < 1e-5 && Math.abs(valores[2]) < 1e-5, 'Reação não desloca raiz horizontalmente');
      if (i >= recuperacaoQuadro) assert.ok(mesmaPose(valores, referencia, canal.tipo), 'Reação recupera guarda completa no quadro 7 e a mantém');
      if (pernas.has(canal.osso) || canal.osso === 0) assert.ok(mesmaPose(valores, referencia, canal.tipo), 'Reação mantém quadril e pernas fixos');
      if (i === 0 && canal.tipo === 'rotation' && ['tronco', 'cabeca'].includes(dados.ossos[canal.osso].nome)) impacto ||= !mesmaPose(valores, referencia, canal.tipo, .01);
    }
  }
  for (let i = 0; i < 20; i++) for (const tipo of ['rotation', 'translation']) assert.ok(alvos.has(`${i}:${tipo}`));
  assert.ok(impacto, 'A reação mostra o impacto desde o primeiro quadro');
  dados.clips = dados.clips.map(c => c.nome === 'dano' ? structuredClone(reacao) : c);
  dados.extras.status = 'estudo-guarda-socos-defesa-reacao';
  dados.extras.animacoes = 'Guarda, dois socos, defesa alta e reação revisados; outros 26 clips preservados.';
  return dados;
}

export function gerarEstudoReacao() {
  const pasta = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo');
  const ler = nome => JSON.parse(readFileSync(resolve(pasta, nome)));
  const fonteSim = readFileSync(resolve(raiz, 'public/js/ko-sim.js'));
  const limite = fonteSim.toString('utf8').match(/v\.stun\s*=\s*Math\.max\((\d+),\s*golpe\.hs/);
  assert.equal(Number(limite?.[1]), stunMinimoMotor, 'Revise recuperação se o hitstun mínimo mudar');
  const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
  const shaSim = createHash('sha256').update(fonteSim).digest('hex');
  for (const arquivo of ['jab-relatorio-v5.json', 'soco-forte-relatorio-v6.json', 'defesa-relatorio-v7.json', 'reacao-relatorio-v8.json']) assert.equal(ler(arquivo).sha256Simulacao, shaSim, 'Fontes seguem o motor atual');
  const origem = ler('reacao-relatorio-v8.json');
  assert.equal(origem.recuperacaoQuadro, recuperacaoQuadro);
  assert.equal(origem.stunMinimoMotor, stunMinimoMotor);
  assert.ok(origem.erroMaximoAncora < .001 && origem.erroRecuperacao < 1e-6, 'Reação respeita âncoras e recuperação');
  const dados = criarEstudoReacao(ler('guarda-v4.json'), ler('jab-v5.json'), ler('soco-forte-v6.json'), ler('defesa-v7.json'), ler('reacao-v8.json'), K);
  const bytes = exportarGlb(dados);
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K);
  assert.equal(doc.animations.length, 31);
  const caminho = 'public/modelos/estudos/pipoca-reacao-v8.glb';
  writeFileSync(resolve(raiz, caminho), bytes);
  const substituidos = ['parado', 'p1', 'p2', 'defesa', 'dano'];
  const relatorio = { aprovadoFinal: false, caminho, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    clips: 31, substituidos, impactoDesdeInicio: true, recuperacaoQuadro, stunMinimoMotor,
    preservados: dados.clips.filter(c => !substituidos.includes(c.nome)).map(c => c.nome),
    limites: ['Arte provisória e pesos rígidos.', 'Reação genérica; rosto, quedas, defesa baixa e demais 26 clips em revisão.'] };
  writeFileSync(resolve(pasta, 'integracao-v8.json'), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(JSON.stringify(relatorio));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) gerarEstudoReacao();
