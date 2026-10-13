import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raizPadrao = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const K = createRequire(import.meta.url)('../../public/js/ko-sim.js');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const PASTA = 'art/premium/modelos-3d/estudos-mixamo/';
const FONTES = ['guarda-v4.json', 'jab-v5.json', 'soco-forte-v6.json', 'defesa-v7.json', 'reacao-v8.json', 'andando-v9.json', 'chute-v11.json', 'chute-forte-v12.json', 'posturas-v14.json', 'tecnicas-v15.json', 'estados-v16.json', 'atuacao-v17.json'];
const RELATORIOS = ['importacao-chutes-v13.json', 'importacao-posturas-v14.json', 'importacao-tecnicas-v15.json', 'importacao-estados-v16.json', 'importacao-atuacao-v17.json', 'roupa-auditoria-chutes-v13.json'];

export function hashClipPipoca(clip) {
  return sha(JSON.stringify({ nome: clip.nome, duracaoQuadros: clip.duracaoQuadros,
    canais: clip.canais.map(c => ({ osso: c.osso, tipo: c.tipo, tempos: c.tempos.map(Math.fround), valores: c.valores.map(Math.fround) }))
      .sort((a, b) => a.osso - b.osso || a.tipo.localeCompare(b.tipo)) }));
}

export function extrairClipsPipoca(bytes, doc) {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  const view = new DataView(buffer), inicioBin = 20 + view.getUint32(12, true) + 8;
  const juntas = doc.skins[0].joints, componentes = { SCALAR: 1, VEC3: 3, VEC4: 4 };
  function ler(indice) {
    const a = doc.accessors[indice], b = doc.bufferViews[a.bufferView], n = componentes[a.type];
    if (a.componentType !== 5126 || !n) throw new Error('Auditoria requer canais FLOAT sem compressão.');
    const valores = [], stride = b.byteStride || n * 4;
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) valores.push(view.getFloat32(inicioBin + (b.byteOffset || 0) + (a.byteOffset || 0) + i * stride + c * 4, true));
    return valores;
  }
  return doc.animations.map(a => {
    const canais = a.channels.map(c => {
      const s = a.samplers[c.sampler], osso = juntas.indexOf(c.target.node);
      if (osso < 0 || s.interpolation !== 'LINEAR') throw new Error('Animação fora do contrato autoral de ossos/LINEAR.');
      return { osso, tipo: c.target.path, tempos: ler(s.input), valores: ler(s.output) };
    });
    return { nome: a.name, duracaoQuadros: a.extras?.duracaoQuadros || Math.round(Math.max(...canais.flatMap(c => c.tempos)) * 60), canais };
  });
}

export function auditarPipoca(bytes, { raiz = raizPadrao, modelo = 'public/modelos/estudos/pipoca-direcao-visual-v13.glb', simulador = K } = {}) {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  const doc = validarGlb(buffer, 'pipoca', simulador), sha256Glb = sha(new Uint8Array(buffer)), fontes = [], porNome = new Map();
  for (const nome of FONTES) {
    const caminho = PASTA + nome;
    if (!existsSync(resolve(raiz, caminho))) continue;
    const conteudo = readFileSync(resolve(raiz, caminho)), fonte = JSON.parse(conteudo), clips = fonte.clips || [fonte];
    fontes.push({ caminho, sha256: sha(conteudo), versao: fonte.versao || null, nomes: clips.map(c => c.nome), sha256Geometria: fonte.sha256Geometria || null });
    for (const clip of clips) porNome.set(clip.nome, { caminho, sha256Fonte: sha(conteudo), sha256Clip: hashClipPipoca(clip),
      integracaoPendente: nome === 'estados-v16.json' && !(doc.extras.estadosPipoca?.nomes || []).includes(clip.nome)
        || nome === 'atuacao-v17.json' && !(doc.extras.atuacaoPipoca?.nomes || []).includes(clip.nome) });
  }
  const evidencias = RELATORIOS.filter(nome => existsSync(resolve(raiz, PASTA + nome))).map(nome => {
    const caminho = PASTA + nome, conteudo = readFileSync(resolve(raiz, caminho)), r = JSON.parse(conteudo);
    const hashRelatado = r.sha256Glb || r.sha256 || null;
    const nomes = Object.keys(r.golpes || r.estados || {});
    for (const c of r.resultados || []) if (c.clip && !nomes.includes(c.clip)) nomes.push(c.clip);
    return { caminho, sha256Relatorio: sha(conteudo), sha256Glb: hashRelatado,
      atual: hashRelatado === sha256Glb, nomes, amostras: r.amostras || null, aprovadoFinal: false };
  });
  const declarados = new Set([...(doc.extras?.chutes?.revisados || []), ...(doc.extras?.posturas?.clips || []), ...(doc.extras?.tecnicasPipoca?.nomes || []), ...(doc.extras?.estadosPipoca?.nomes || []), ...(doc.extras?.atuacaoPipoca?.nomes || [])]);
  const clips = extrairClipsPipoca(bytes, doc).map(clip => {
    const fonte = porNome.get(clip.nome), hashAtual = hashClipPipoca(clip), integrada = fonte?.sha256Clip === hashAtual;
    const golpe = simulador.LUTADORES.pipoca.golpes[clip.nome];
    const tecnicas = evidencias.filter(e => e.nomes.includes(clip.nome));
    return { nome: clip.nome, duracaoQuadros: clip.duracaoQuadros,
      status: integrada ? 'fonte-autoral-integrada; revisão artística pendente' : fonte?.integracaoPendente ? 'estudo-genérico no GLB; fonte autoral disponível para integração' : fonte ? 'fonte-autoral-diverge-do-GLB' : 'estudo-genérico; produção autoral pendente',
      fonteIntegrada: integrada, declaradoNosExtras: declarados.has(clip.nome), aprovadoFinal: false,
      sha256ClipGlb: hashAtual, fonte: fonte || null,
      evidencias: tecnicas.map(e => ({ caminho: e.caminho, atual: e.atual, sha256Relatorio: e.sha256Relatorio })),
      verificacaoTecnicaAtual: tecnicas.some(e => e.atual),
      janelasAtivas: (golpe?.janelas || []).map(j => ({ de: j.de, ate: j.ate, caixa: j.caixa })),
      limites: ['caido', 'levantando'].includes(clip.nome) ? ['Envelope sem penetração não valida mão/joelho de apoio ou atuação da primeira metade da subida.'] : [] };
  });
  const integrados = clips.filter(c => c.fonteIntegrada).map(c => c.nome), genericos = clips.filter(c => !c.fonte || c.fonte.integracaoPendente).map(c => c.nome);
  const divergentes = clips.filter(c => c.fonte && !c.fonteIntegrada && !c.fonte.integracaoPendente).map(c => c.nome);
  return { personagem: 'pipoca', modelo, sha256Glb, sha256Simulacao: sha(readFileSync(resolve(raiz, 'public/js/ko-sim.js'))),
    aprovadoFinal: false, total: clips.length, fontesAutoraisIntegradas: integrados.length, estudosGenericos: genericos.length, estudosPendentes: clips.length - integrados.length,
    integrados, genericos, fontesDivergentes: divergentes, clips, fontes, evidencias,
    extras: { posturas: doc.extras.posturas || null, tecnicas: doc.extras.tecnicasPipoca || null, estados: doc.extras.estadosPipoca || null, atuacao: doc.extras.atuacaoPipoca || null },
    pendentesPersonagem: ['Revisão visual dos movimentos entre estados, nos dois lados e sob hitstop.', 'Expressões faciais, pelagem, tecido/costuras e deformações extremas.', 'Áudio de ações/impactos e acabamento dos estados de Final.', 'Apoios de mão/joelho e direção de atuação da queda e subida.', 'Desempenho medido em aparelhos físicos.', ...(doc.extras.atuacaoPipoca?.pendentes || [])],
    limites: ['Fonte com hash igual prova integração do movimento, sem aprovar o acabamento premium.', 'Evidência sem SHA do GLB atual permanece histórica; regenerar os verificadores após mudar a geometria.', 'A contagem vem de canais reais comparados às fontes; a presença de um nome no contrato não o aprova.'],
    reproducao: 'node scripts/producao-3d/auditar-pipoca.mjs --modelo ' + modelo + ' --relatorio art/premium/modelos-3d/auditoria-pipoca-v13.json' };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const argumento = (nome, padrao) => { const i = process.argv.indexOf(nome); return i >= 0 ? process.argv[i + 1] : padrao; };
  const modelo = argumento('--modelo', 'public/modelos/estudos/pipoca-direcao-visual-v13.glb');
  const destino = argumento('--relatorio', 'art/premium/modelos-3d/auditoria-pipoca-v13.json');
  const r = auditarPipoca(readFileSync(resolve(raizPadrao, modelo)), { modelo });
  writeFileSync(resolve(raizPadrao, destino), JSON.stringify(r, null, 2) + '\n');
  console.log(JSON.stringify({ modelo, sha256Glb: r.sha256Glb, relatorio: destino, total: r.total, integrados: r.integrados, genericos: r.genericos, fontesDivergentes: r.fontesDivergentes, evidenciasAtuais: r.evidencias.filter(e => e.atual).map(e => e.caminho), aprovadoFinal: false }));
}
