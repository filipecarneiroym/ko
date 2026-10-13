// Uma rodada usa um único GLB e só publica os relatórios se suas fontes continuam iguais.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verificarChutes } from './verificar-chutes-pipoca.mjs';
import { verificarPosturas } from './verificar-posturas-pipoca.mjs';
import { verificarTecnicasPipoca } from './verificar-tecnicas-pipoca.mjs';
import { verificarEstadosPipoca } from './verificar-estados-pipoca.mjs';
import { verificarAtuacaoPipoca } from './verificar-atuacao-pipoca.mjs';
import { auditarPipoca } from './auditar-pipoca.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const modelo = 'public/modelos/estudos/pipoca-direcao-visual-v13.glb';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = readFileSync(resolve(raiz, modelo)), sha256Glb = sha(bytes);
const integracao = JSON.parse(readFileSync(resolve(pasta, 'integracao-v13.json')));
assert.equal(integracao.sha256, sha256Glb, 'Reexporte o modelo: o relatório de integração está desatualizado.');
function conferirFontes() {
  assert.equal(sha(readFileSync(resolve(raiz, modelo))), sha256Glb, 'O modelo mudou durante a rodada; execute novamente após concluir a exportação.');
  for (const fonte of integracao.fontesDiretas) assert.equal(sha(readFileSync(resolve(raiz, fonte.caminho))), fonte.sha256, `Reexporte o modelo: fonte alterada ${fonte.caminho}`);
  assert.equal(sha(readFileSync(resolve(raiz, 'public/js/ko-sim.js'))), integracao.sha256Simulacao, 'O motor mudou desde a exportação.');
}
conferirFontes();
const resultados = [];
for (const [nome, verificar, arquivo] of [
  ['chutes', verificarChutes, 'importacao-chutes-v13.json'],
  ['posturas', verificarPosturas, 'importacao-posturas-v14.json'],
  ['tecnicas', verificarTecnicasPipoca, 'importacao-tecnicas-v15.json'],
  ['estados', verificarEstadosPipoca, 'importacao-estados-v16.json'],
  ['atuacao', verificarAtuacaoPipoca, 'importacao-atuacao-v17.json'],
]) {
  const relatorio = await verificar(bytes);
  assert.equal(relatorio.sha256Glb, sha256Glb, `Verificador ${nome} precisa identificar o GLB avaliado.`);
  resultados.push({ nome, arquivo, relatorio });
  console.log(`OK ${nome}: ${relatorio.amostras} poses.`);
}
conferirFontes();
for (const { arquivo, relatorio } of resultados) writeFileSync(resolve(pasta, arquivo), JSON.stringify({ caminho: modelo, ...relatorio }, null, 2)+'\n');
const auditoria = auditarPipoca(bytes);
assert.deepEqual(auditoria.fontesDivergentes, [], 'Há fontes autorais diferentes dos clips exportados.');
writeFileSync(resolve(raiz, 'art/premium/modelos-3d/auditoria-pipoca-v13.json'), JSON.stringify(auditoria, null, 2)+'\n');
writeFileSync(resolve(pasta, 'verificacao-pipoca-v13.json'), JSON.stringify({
  aprovadoFinal: false, modelo, sha256Glb, sha256Simulacao: integracao.sha256Simulacao,
  fontesConferidas: integracao.fontesDiretas,
  verificacoes: resultados.map(({ nome, arquivo, relatorio }) => ({ nome, arquivo, sha256Glb, amostras: relatorio.amostras })),
  fontesAutoraisIntegradas: auditoria.fontesAutoraisIntegradas, estudosPendentes: auditoria.estudosPendentes,
  limites: ['Rodada de apoio, piso e contato; não aprova acabamento, roupa ou atuação.',
    'Guarda, socos, defesa, reação e marcha têm testes próprios adicionais.',
    'Revisão em GPU e desempenho em aparelhos físicos são etapas separadas.'],
}, null, 2)+'\n');
console.log(JSON.stringify({ sha256Glb, verificacoes: resultados.length, fontesAutoraisIntegradas: auditoria.fontesAutoraisIntegradas, aprovadoFinal: false }));
