import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export function hashesFontes() {
  const caminhos = ['package.json', 'package-lock.json', 'scripts/build-3d.mjs', 'scripts/fontes-3d.mjs',
    ...readdirSync('src/3d').filter(f => /\.(js|mjs)$/.test(f)).sort().map(f => `src/3d/${f}`)];
  return Object.fromEntries(caminhos.map(p => [p, hash(readFileSync(p))]));
}
export function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
