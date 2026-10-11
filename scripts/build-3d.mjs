import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { hashesFontes, hash } from './fontes-3d.mjs';

await build({
  entryPoints: ['src/3d/laboratorio.js'],
  outfile: 'public/js/ko-laboratorio-3d.js',
  bundle: true,
  minify: !process.argv.includes('--debug'),
  sourcemap: false,
  format: 'iife',
  target: ['safari15', 'chrome100'],
  legalComments: 'eof',
});
writeFileSync('art/premium/modelos-3d/build.json', JSON.stringify({
  formato: 1,
  debug: process.argv.includes('--debug'),
  fontes: hashesFontes(),
  saida: { caminho: 'public/js/ko-laboratorio-3d.js', sha256: hash(readFileSync('public/js/ko-laboratorio-3d.js')) },
}, null, 2) + '\n');
