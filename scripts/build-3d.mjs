import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { hashesFontes, hash } from './fontes-3d.mjs';

// Laboratório e jogo: mesmos módulos 3D, dois pacotes.
for (const [entrada, saida] of [['src/3d/laboratorio.js', 'public/js/ko-laboratorio-3d.js'], ['src/3d/jogo-3d.js', 'public/js/ko-jogo-3d.js']]) {
  await build({
    entryPoints: [entrada],
    outfile: saida,
    bundle: true,
    minify: !process.argv.includes('--debug'),
    sourcemap: false,
    format: 'iife',
    target: ['safari15', 'chrome100'],
    legalComments: 'eof',
  });
}
writeFileSync('art/premium/modelos-3d/build.json', JSON.stringify({
  formato: 1,
  debug: process.argv.includes('--debug'),
  fontes: hashesFontes(),
  saida: { caminho: 'public/js/ko-laboratorio-3d.js', sha256: hash(readFileSync('public/js/ko-laboratorio-3d.js')) },
}, null, 2) + '\n');
