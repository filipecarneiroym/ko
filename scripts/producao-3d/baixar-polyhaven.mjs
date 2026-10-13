// Baixa recursos do Poly Haven (CC0, domínio público) para as fontes de uma
// arena 3D e registra autoria/licença em fontes.json.
//   node scripts/producao-3d/baixar-polyhaven.mjs <arena> hdri:<id> textura:<id> modelo:<id> ...
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [arena, ...pedidos] = process.argv.slice(2);
if (!arena || !pedidos.length) throw new Error('Uso: baixar-polyhaven.mjs <arena> hdri:<id> textura:<id> modelo:<id>');
const pasta = resolve(raiz, 'art/premium/arenas', arena, 'fontes');
mkdirSync(pasta, { recursive: true });
const json = async url => (await fetch(url)).json();
async function baixar(url, destino) {
  if (existsSync(destino)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  console.log('ok', destino.replace(raiz, ''));
}
const registro = existsSync(resolve(pasta, 'fontes.json')) ? JSON.parse(readFileSync(resolve(pasta, 'fontes.json'))) : {};
for (const pedido of pedidos) {
  const [tipo, id] = pedido.split(':');
  const info = await json(`https://api.polyhaven.com/info/${id}`), arquivos = await json(`https://api.polyhaven.com/files/${id}`);
  if (tipo === 'hdri') {
    await baixar(arquivos.hdri['2k'].hdr.url, resolve(pasta, `${id}_2k.hdr`));
    await baixar(arquivos.tonemapped.url, resolve(pasta, `${id}_fundo.jpg`));
  } else if (tipo === 'textura') {
    for (const mapa of ['Diffuse', 'nor_gl', 'Rough', 'Displacement', 'AO']) {
      const url = arquivos[mapa]?.['2k']?.jpg?.url;
      if (url) await baixar(url, resolve(pasta, id, url.split('/').pop()));
    }
  } else if (tipo === 'modelo') {
    const g = arquivos.gltf['1k'].gltf;
    await baixar(g.url, resolve(pasta, id, g.url.split('/').pop()));
    for (const [nome, f] of Object.entries(g.include || {})) await baixar(f.url, resolve(pasta, id, nome));
  } else throw new Error(`Tipo desconhecido: ${tipo}`);
  registro[id] = { tipo, nome: info.name, autores: Object.keys(info.authors || {}), licenca: 'CC0 1.0 (Poly Haven)', pagina: `https://polyhaven.com/a/${id}` };
}
writeFileSync(resolve(pasta, 'fontes.json'), JSON.stringify(registro, null, 2) + '\n');
