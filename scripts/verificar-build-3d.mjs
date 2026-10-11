import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { hashesFontes, hash } from './fontes-3d.mjs';
try {
  const registro = JSON.parse(readFileSync('art/premium/modelos-3d/build.json', 'utf8'));
  assert.equal(registro.debug, false, 'O build atual é de diagnóstico.');
  assert.deepEqual(registro.fontes, hashesFontes(), 'Código mudou depois do último build.');
  assert.equal(registro.saida.caminho, 'public/js/ko-laboratorio-3d.js');
  assert.equal(registro.saida.sha256, hash(readFileSync(registro.saida.caminho)), 'Bundle diferente do registrado.');
  console.log('OK: bundle 3D minificado corresponde às fontes e dependências atuais.');
} catch (erro) {
  console.error(`Build 3D desatualizado: ${erro.message} Execute npm run build:3d.`);
  process.exitCode = 1;
}
