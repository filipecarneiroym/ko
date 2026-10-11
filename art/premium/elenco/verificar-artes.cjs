// Confere os arquivos atuais sem alterar imagens. Não substitui revisão visual.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const elenco = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifesto.json'), 'utf8'));
const galeria = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const ids = new Set();
const raiz = path.resolve(__dirname, '../../..');
const parcial = fs.readFileSync(path.join(raiz, 'laravel/resources/views/partials/fundo-elenco.blade.php'), 'utf8');
const fontes = [...parcial.matchAll(/src="\/img\/elenco\/([^"]+)"/g)].map(m => m[1]);
const config = fs.readFileSync(path.join(raiz, 'laravel/config/ko.php'), 'utf8');
const artesVitoria = new Map([...config.matchAll(/'([^']+)' => \['nome' => '[^']+', 'pronto' => true, 'arte' => '([^']+)'\]/g)].map(m => [m[1], m[2]]));
if (fontes.length !== 18 || new Set(fontes).size !== 18) throw new Error('Composição incompleta ou duplicada');
const registros = elenco.map((p) => {
  if (ids.has(p.id)) throw new Error('ID duplicado: ' + p.id);
  ids.add(p.id);
  if (path.basename(p.arte) !== p.arte) throw new Error('Nome de arquivo inválido');
  const dados = fs.readFileSync(path.join(__dirname, p.arte));
  if (!galeria.includes('src="' + p.arte + '"')) throw new Error('Galeria divergente: ' + p.id);
  const webp = p.arte.replace(/\.png$/, '.webp');
  if (!fontes.includes(webp)) throw new Error('Composição usa versão incorreta: ' + p.id);
  if (p.status === 'conceito do lutador existente' && artesVitoria.get(p.id) !== webp) throw new Error('Arte da vitória incorreta: ' + p.id);
  const destinoWebp = path.join(raiz, 'public/img/elenco', webp);
  if (!fs.existsSync(destinoWebp)) throw new Error('Arte pública ausente: ' + webp);
  return { id: p.id, arte: p.arte, sha256: crypto.createHash('sha256').update(dados).digest('hex'),
    webp, sha256Webp: crypto.createHash('sha256').update(fs.readFileSync(destinoWebp)).digest('hex') };
});
if (registros.length !== 18) throw new Error('Elenco incompleto');
const destino = path.join(__dirname, 'arquivos-atuais.sha256.json');
if (process.argv.includes('--registrar')) fs.writeFileSync(destino, JSON.stringify(registros, null, 2) + '\n');
else {
  const anteriores = JSON.parse(fs.readFileSync(destino, 'utf8'));
  if (JSON.stringify(anteriores) !== JSON.stringify(registros)) throw new Error('Arte ou versão alterada desde o registro; revisar antes de atualizar');
}
console.log('18 artes presentes, IDs únicos, versões da galeria corretas e arquivos conferidos.');
