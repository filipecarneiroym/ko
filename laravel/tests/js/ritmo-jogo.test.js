const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// Executa o laço real, com apenas desenho e periféricos substituídos.
const fonte = fs.readFileSync(path.resolve(__dirname, '../../../public/js/ko.js'), 'utf8');
const quadro = fonte.slice(fonte.indexOf('  function quadro(agora)'), fonte.indexOf('  requestAnimationFrame(quadro);\n\n  // Um quadro'));
function relogio() {
  const c = { PASSO_MS: 1000 / 60, requestAnimationFrame() {}, atualizarPads() {},
    nomes: [], meuLado: 0, document: { querySelectorAll: () => [] },
    A: { desenhar() {} }, avancar() { if (c.bloqueado) return false; c.luta.s.f++; return true; },
    luta: { sobra: 0, ultimo: 0, parado: 0, aviso: '', s: { fase: 'luta', f: 0, p: [{}] }, r3d: { desenhar() {} } },
  };
  vm.createContext(c); vm.runInContext(quadro, c); return c;
}
for (const fps of [120, 60, 30, 15, 10, 6, 5, 4, 3, 2, 1]) test(`laço mantém 60 passos/s com desenho a ${fps} FPS`, () => {
  const c = relogio();
  for (let i = 1; i <= fps * 30; i++) c.quadro(i * 1000 / fps);
  assert.ok(Math.abs(c.luta.s.f - 1800) <= 1, `${c.luta.s.f} passos em 30 s`);
  assert.ok(c.luta.sobra < c.PASSO_MS + .001, 'não acumula atraso');
});
test('pausa ou espera de rede não acumula segundos para acelerar depois', () => {
  const c = relogio(); c.bloqueado = true;
  for (let i = 1; i <= 100; i++) c.quadro(i * 100);
  assert.equal(c.luta.s.f, 0);
  c.bloqueado = false; c.quadro(10016.67);
  assert.ok(c.luta.s.f <= 3);
});
test('interrupção longa tem recuperação limitada, sem executar minutos de entradas antigas', () => {
  const c = relogio(); c.quadro(60000);
  assert.ok(c.luta.s.f <= 120);
});
test('troca de visibilidade zera a dívida sem avançar a luta', () => {
  let evento;
  const c = { luta: { ultimo: 10, sobra: 1900, s: { f: 40 } }, performance: { now: () => 5000 },
    document: { addEventListener: (_, callback) => { evento = callback; } } };
  vm.createContext(c);
  const listener = fonte.match(/document\.addEventListener\('visibilitychange', \(\) => \{\r?\n[\s\S]*?\n  \}\);/)[0];
  vm.runInContext(listener, c); evento();
  assert.equal(c.luta.ultimo, 5000); assert.equal(c.luta.sobra, 0); assert.equal(c.luta.s.f, 40);
});
