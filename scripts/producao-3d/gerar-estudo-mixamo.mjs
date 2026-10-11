// Estudo local: substitui apenas a guarda da Pipoca, sem aprovar arte ou gameplay.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarRig } from '../../src/producao3d/rig.mjs';
import { criarPipoca } from '../../src/producao3d/pipoca.mjs';
import { criarAnimacoes } from '../../src/producao3d/animacoes.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';
import { exportarGlb } from './glb.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRADA = 'art/premium/modelos-3d/estudos-mixamo/guarda-v4.json';
const SAIDA = 'public/modelos/estudos/pipoca-guarda-v4.glb';
const RELATORIO = 'art/premium/modelos-3d/estudos-mixamo/integracao-v4.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exigir = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };

export function substituirGuarda(clips, guarda, ossos) {
  exigir(Array.isArray(clips) && clips.filter(c => c.nome === 'parado').length === 1,
    'A base precisa conter exatamente um clip parado.');
  exigir(new Set(clips.map(c => c.nome)).size === clips.length, 'A base contém nomes de clips duplicados.');
  exigir(guarda?.nome === 'parado', 'O estudo deve substituir exclusivamente o clip parado.');
  exigir(Number.isInteger(guarda.duracaoQuadros) && guarda.duracaoQuadros > 0,
    'A guarda precisa de duração inteira positiva em quadros de 60 Hz.');
  exigir(Array.isArray(ossos) && ossos.length > 0, 'Defina o rig original da Pipoca.');
  exigir(Array.isArray(guarda.canais) && guarda.canais.length > 0, 'A guarda precisa conter canais.');
  const alvos = new Set(), rotacoes = new Set();
  const quadril = ossos.findIndex(o => o.nome === 'quadril');
  exigir(quadril >= 0, 'O rig precisa conter o quadril.');
  for (const canal of guarda.canais) {
    exigir(Number.isInteger(canal.osso) && canal.osso >= 0 && canal.osso < ossos.length,
      'Canal da guarda aponta para um osso fora do rig.');
    exigir(['rotation', 'translation'].includes(canal.tipo), 'Canal da guarda precisa ser rotation ou translation.');
    const alvo = `${canal.osso}:${canal.tipo}`;
    exigir(!alvos.has(alvo), 'A guarda contém um canal repetido.'); alvos.add(alvo);
    if (canal.tipo === 'rotation') rotacoes.add(canal.osso);
    exigir(Array.isArray(canal.tempos) && canal.tempos.length >= 2, 'A guarda precisa de ao menos dois instantes por canal.');
    exigir(canal.tempos[0] === 0, 'Todos os canais da guarda precisam começar em zero.');
    exigir(Math.abs(canal.tempos.at(-1) - guarda.duracaoQuadros / 60) < 1e-7,
      'Todos os canais precisam terminar na duração declarada da guarda.');
    const tamanho = canal.tipo === 'rotation' ? 4 : 3;
    exigir(Array.isArray(canal.valores) && canal.valores.length === canal.tempos.length * tamanho,
      'A guarda contém valores incompletos.');
    for (let i = 0; i < canal.tempos.length; i++) {
      exigir(Number.isFinite(canal.tempos[i]) && (i === 0 || canal.tempos[i] > canal.tempos[i - 1]),
        'Os tempos da guarda precisam aumentar.');
      const valores = canal.valores.slice(i * tamanho, (i + 1) * tamanho);
      exigir(valores.every(v => typeof v === 'number' && Number.isFinite(v)), 'A guarda contém um valor não finito.');
      if (canal.tipo === 'rotation') exigir(Math.abs(Math.hypot(...valores) - 1) < 0.002,
        'A guarda contém quaternion não unitário.');
      if (canal.osso === quadril && canal.tipo === 'translation') {
        exigir(Math.abs(valores[0] - ossos[quadril].posicao[0]) < 1e-5
          && Math.abs(valores[2] - ossos[quadril].posicao[2]) < 1e-5,
        'A guarda precisa ficar no lugar; deslocamento horizontal pertence à simulação.');
      }
    }
  }
  exigir(rotacoes.size === ossos.length, 'A guarda precisa definir a rotação de todos os ossos.');
  exigir(alvos.has(`${quadril}:translation`), 'A guarda precisa definir a translação do quadril.');
  // Os outros clips conservam os mesmos objetos e valores da base.
  const copia = JSON.parse(JSON.stringify(guarda));
  return clips.map(clip => clip.nome === 'parado' ? copia : clip);
}

export function criarEstudoMixamo(guarda, simulador) {
  const ossos = criarRig();
  const malha = criarPipoca(ossos);
  const base = criarAnimacoes('pipoca', ossos, simulador);
  const clips = substituirGuarda(base, guarda, ossos);
  exigir(clips.length === 31, 'O estudo precisa preservar os 31 clips da Pipoca.');
  return {
    nome: 'pipoca', ...malha, ossos, clips,
    extras: {
      ...malha.extras, status: 'estudo-mixamo', aprovadoFinal: false,
      origemGuarda: ENTRADA,
      animacoes: 'Somente parado substituído por guarda Mixamo; demais clips preservados.',
      limites: 'Modelo provisório; identidade, junções, deformações e transições exigem revisão artística.',
    },
  };
}

export function gerarEstudoMixamo(raizProjeto = RAIZ) {
  const entrada = readFileSync(resolve(raizProjeto, ENTRADA));
  const guarda = JSON.parse(entrada.toString('utf8'));
  const simulador = createRequire(import.meta.url)(resolve(raizProjeto, 'public/js/ko-sim.js'));
  const dados = criarEstudoMixamo(guarda, simulador);
  const bytes = exportarGlb(dados);
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'pipoca', simulador);
  const preservados = dados.clips.filter(c => c.nome !== 'parado');
  const relatorio = {
    versao: 1, status: 'Estudo técnico de guarda; sem aprovação artística final.', aprovadoFinal: false,
    entrada: { caminho: ENTRADA, sha256: sha256(entrada) },
    modelo: { caminho: SAIDA, sha256: sha256(bytes), bytes: bytes.length,
      vertices: dados.primitivas.reduce((n, p) => n + p.posicoes.length / 3, 0),
      triangulos: dados.primitivas.reduce((n, p) => n + p.indices.length / 3, 0),
      ossos: dados.ossos.length, materiais: dados.materiais.length, clips: doc.animations.length },
    substituido: { nome: 'parado', duracaoQuadros: guarda.duracaoQuadros, fpsSimulacao: 60 },
    clipsPreservados: preservados.map(c => c.nome),
    sha256ClipsPreservados: sha256(JSON.stringify(preservados)),
    limites: [
      'Estudo optativo do laboratório; não substitui o renderizador principal.',
      'Malha e materiais provisórios preservados; acabamento visual ainda pendente.',
      'Os golpes conservam os tempos e movimentos anteriores; o estudo substitui somente a guarda.',
      'Transições para outros clips e desempenho em aparelhos físicos ainda exigem revisão.',
    ],
  };
  mkdirSync(dirname(resolve(raizProjeto, SAIDA)), { recursive: true });
  mkdirSync(dirname(resolve(raizProjeto, RELATORIO)), { recursive: true });
  writeFileSync(resolve(raizProjeto, SAIDA), bytes);
  writeFileSync(resolve(raizProjeto, RELATORIO), `${JSON.stringify(relatorio, null, 2)}\n`);
  return relatorio;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    exigir(process.argv.length === 2, 'Use node scripts/producao-3d/gerar-estudo-mixamo.mjs sem argumentos.');
    const relatorio = gerarEstudoMixamo();
    console.log(`Pipoca: guarda Mixamo integrada ao estudo, ${relatorio.modelo.clips} clips; ${relatorio.modelo.bytes} bytes. Arte final pendente.`);
    console.log(`GLB: ${relatorio.modelo.caminho}\nRelatório: ${RELATORIO}`);
  } catch (erro) { console.error(`ERRO: ${erro.message}`); process.exitCode = 1; }
}
