const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../../public/js/ko-controle.js');
const pad = (index, mapping = 'standard') => ({ index, id: 'Mesmo controle', mapping, connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) });
test('analógico tem zona morta e combina direção com golpe', () => {
  const p = pad(0); p.axes = [0.2, -0.8]; p.buttons[2].pressed = true;
  assert.equal(C.ler(p, C.PADRAO).bits, C.BITS.U | C.BITS.P);
});
test('dois controles iguais mantêm jogadores e pulsos independentes após reconexão', () => {
  const a = pad(0), b = pad(1); let lista = [a, b];
  const c = C.criar({ obter: () => lista });
  a.buttons[2].pressed = true; b.buttons[0].pressed = true;
  let estados = c.atualizar();
  assert.equal(estados[0].pulso, C.BITS.P); assert.equal(estados[1].pulso, C.BITS.K);
  assert.equal(c.atualizar()[0].pulso, 0);
  lista = [b]; estados = c.atualizar();
  assert.equal(estados[0].conectado, false); assert.equal(estados[1].bits, C.BITS.K);
  lista = [a, b]; assert.equal(c.atualizar()[0].bits, C.BITS.P);
});
test('controle desconhecido permanece neutro até configurar todos os comandos', () => {
  const p = pad(0, ''); let salvo;
  p.buttons[0].pressed = true;
  const c = C.criar({ obter: () => [p], salvar: (_, mapa) => { salvo = mapa; } });
  assert.equal(c.atualizar()[0].mapeado, false); assert.equal(c.configurar(0), true);
  for (let i = 0; i < C.ACOES.length; i++) {
    p.buttons.forEach((b) => { b.pressed = false; }); c.atualizar();
    p.buttons[i].pressed = true; c.atualizar();
  }
  assert.equal(C.mapaValido(salvo), true); assert.equal(c.configuracao(), null);
  assert.equal(c.atualizar()[0].mapeado, true);
});
test('mapa salvo inválido não ativa comandos', () => {
  const p = pad(0, ''); p.buttons[0].pressed = true;
  const c = C.criar({ obter: () => [p], carregar: () => ({ L: [{ tipo: 'botao', indice: -1 }] }) });
  assert.equal(c.atualizar()[0].bits, 0);
});
