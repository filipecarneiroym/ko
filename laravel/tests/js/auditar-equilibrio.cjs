// Diagnóstico reproduzível, não certificação de balanceamento humano.
// node laravel/tests/js/auditar-equilibrio.cjs [arquivo.json]
const fs = require('node:fs');
const K = require('../../../public/js/ko-sim.js');
const CPU = require('../../../public/js/ko-cpu.js');
const ids = Object.keys(K.LUTADORES);
const totais = Object.fromEntries(ids.map((id) => [id, { partidas: 0, vitorias: 0, derrotas: 0, empates: 0, incompletas: 0 }]));
const partidas = [];
const repeticoes = Number(process.argv[3] || 1);
if (!Number.isInteger(repeticoes) || repeticoes < 1 || repeticoes > 100) throw new Error('Repetições: inteiro entre 1 e 100');
function rng(semente) { let x = semente >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
  for (let repeticao = 0; repeticao < repeticoes; repeticao++) for (let troca = 0; troca < 2; troca++) {
    const lutadores = troca ? [ids[b], ids[a]] : [ids[a], ids[b]], s = K.novo({ lutadores });
    const nivel = ['facil', 'medio', 'dificil'][repeticao % 3];
    const bots = [CPU.criar(K, nivel, rng(1701 + a * 37 + b + repeticao * 997)), CPU.criar(K, nivel, rng(2609 + a * 37 + b + repeticao * 997))];
    let quadros = 0;
    while (s.fase !== 'fim' && quadros < 16000) { K.passo(s, [bots[0](s, 0), bots[1](s, 1)]); quadros++; }
    const completa = s.fase === 'fim', vencedor = completa && s.vencedor >= 0 ? lutadores[s.vencedor] : null;
    partidas.push({ lutadores, nivel, repeticao, quadros, completa, vencedor, rounds: s.rounds });
    for (const id of lutadores) {
      const t = totais[id]; t.partidas++;
      if (!completa) t.incompletas++;
      else if (!vencedor) t.empates++;
      else if (id === vencedor) t.vitorias++;
      else t.derrotas++;
    }
  }
  if (partidas.length % 40 === 0) process.stderr.write(partidas.length + ' confrontos simulados\n');
}
const relatorio = { metodo: 'Todos os pares, lados invertidos, sementes fixas e níveis de CPU alternados por repetição, até 16000 quadros. Dependente da estratégia do bot; não comprova equilíbrio humano.', repeticoes, total: partidas.length, totais, partidas };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(relatorio, null, 2) + '\n');
console.log(JSON.stringify({ total: partidas.length, totais }, null, 2));
