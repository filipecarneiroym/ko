const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
test('URLs dos modelos jogáveis correspondem ao conteúdo publicado', async () => {
  const { VERSAO_MODELOS, urlModeloAtual } = await import('../../../src/3d/versao-modelos.mjs');
  const versao = ['azul', 'vermelha'].map(cor => crypto.createHash('sha256')
    .update(fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`)))
    .digest('hex').slice(0, 12)).join('-');
  assert.equal(VERSAO_MODELOS, versao, 'atualizar versão após regenerar modelos');
  for (const cor of ['azul', 'vermelha']) {
    const caminho = `/modelos/estudos/pipoca-v5-${cor}.glb`;
    assert.equal(new URL(urlModeloAtual(caminho), 'https://ko.test').searchParams.get('modelo'), versao);
  }
  assert.equal(urlModeloAtual('blob:estudo'), 'blob:estudo');
  assert.equal(urlModeloAtual('/modelos/outro.glb'), '/modelos/outro.glb');
});
