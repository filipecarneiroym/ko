'use strict';

// Execute: node scripts/producao-3d/gerar-revisao-meshy-pipoca.cjs [--preliminar]
// Gera somente a galeria local; arquivos Blender e manifestos são apenas lidos.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const preliminary = process.argv.includes('--preliminar');
const study = path.join(root, 'art/premium/modelos-3d/estudos-mixamo');
const outputDir = path.join(study, 'meshy-pipoca-identidade-v4');
const outputFile = path.join(outputDir, 'comparacao.html');
const versions = ['v3', 'v4'].map(id => ({ id, dir: path.join(study, `meshy-pipoca-identidade-${id}`) }));
const warnings = [];
const hashes = new Map();
const records = new Map();
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fileExists = file => { try { return fs.statSync(file).isFile(); } catch { return false; } };
const displayPath = file => path.relative(root, file).replaceAll('\\', '/');
const relativeUrl = file => path.relative(outputDir, file).split(path.sep).map(encodeURIComponent).join('/');
const digest = file => {
  if (!fileExists(file)) return null;
  if (!hashes.has(file)) hashes.set(file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  return hashes.get(file);
};
function manifestPath(value, version, local = false) {
  if (typeof value !== 'string' || !value) return null;
  const normalized = value.replace(/[\\/]/g, path.sep);
  if (path.isAbsolute(normalized)) return path.resolve(normalized);
  const repoPath = path.resolve(root, normalized);
  const localPath = path.resolve(version.dir, normalized);
  if (local) return fileExists(localPath) || !fileExists(repoPath) ? localPath : repoPath;
  return !fileExists(repoPath) && fileExists(localPath) ? localPath : repoPath;
}
function addRecord(file, label, expected) {
  if (!file) return null;
  let record = records.get(file);
  if (!record) {
    record = { file, labels: [], expected: [], exists: fileExists(file), hash: digest(file), url: relativeUrl(file) };
    records.set(file, record);
  }
  if (!record.labels.includes(label)) record.labels.push(label);
  if (typeof expected === 'string' && /^[a-f0-9]{64}$/i.test(expected) && !record.expected.includes(expected)) record.expected.push(expected);
  return record;
}
for (const version of versions) {
  version.manifestFile = path.join(version.dir, 'revisao.json');
  version.manifest = {};
  if (fileExists(version.manifestFile)) {
    try { version.manifest = JSON.parse(fs.readFileSync(version.manifestFile, 'utf8').replace(/^\uFEFF/, '')); }
    catch (error) { warnings.push(`${version.id.toUpperCase()}: não foi possível ler revisao.json (${error.message}).`); }
    addRecord(version.manifestFile, `${version.id.toUpperCase()} · manifesto`);
  }
  for (const [key, label] of [['workfile', 'arquivo Blender'], ['source', 'fonte 3D'], ['reference', 'referência']]) {
    const fallback = key === 'workfile' ? path.join(version.dir, `pipoca-identidade-${version.id}.blend`) : null;
    addRecord(manifestPath(version.manifest[key], version) || fallback, `${version.id.toUpperCase()} · ${label}`, version.manifest[`${key}Sha256`]);
  }
  const preserved = version.manifest.preservedSources;
  const sources = Array.isArray(preserved) ? preserved : preserved && typeof preserved === 'object'
    ? Object.entries(preserved).map(([key, value]) => typeof value === 'string'
      ? /^[a-f0-9]{64}$/i.test(value) ? { file: key, sha256: value } : { label: key, file: value }
      : { label: key, ...value }) : [];
  for (const item of sources) {
    if (!item) continue;
    const value = typeof item === 'string' ? item : item.file || item.path || item.source;
    addRecord(manifestPath(value, version), `${version.id.toUpperCase()} · fonte preservada${item.label ? ` · ${item.label}` : ''}`, item.sha256 || item.sourceSha256);
  }
}

const viewTypes = [
  { id: 'frente', label: 'Frente', aliases: ['frente', 'front'], names: ['frente.png'] },
  { id: 'tres-quartos', label: '3 quartos', aliases: ['3quartos', 'tresquartos', '34', 'threequarters'], names: ['tres-quartos.png', '3quartos.png', '3-quartos.png'] },
  { id: 'perfil', label: 'Perfil', aliases: ['perfil', 'lado', 'side'], names: ['perfil.png'] },
  { id: 'costas', label: 'Costas', aliases: ['costas', 'back'], names: ['costas.png'] },
  { id: 'rosto', label: 'Rosto', aliases: ['rosto', 'face', 'detalherosto'], names: ['rosto.png'] },
];
function viewRecord(version, type) {
  const entry = (Array.isArray(version.manifest.views) ? version.manifest.views : []).find(item => type.aliases.includes(normalize(item.view || item.name || item.id)));
  const file = entry && manifestPath(entry.file || entry.path, version, true);
  const fallback = type.names.map(name => path.join(version.dir, name)).find(fileExists) || path.join(version.dir, type.names[0]);
  return addRecord(file || fallback, `${version.id.toUpperCase()} · ${type.label}`, entry?.sha256);
}
for (const version of versions) version.views = Object.fromEntries(viewTypes.map(type => [type.id, viewRecord(version, type)]));
const original = addRecord(path.join(root, 'art/premium/elenco/pipoca-v1.png'), 'Arte original');
const turnaround = addRecord(path.join(root, 'art/premium/modelos-3d/referencias/pipoca-referencia-v1.png'), 'Vistas de referência');

function getOrbit(version) {
  const orbit = Array.isArray(version.manifest.orbit360) ? version.manifest.orbit360 : [];
  let entries = orbit.map(item => typeof item === 'string' ? { file: item } : item).filter(item => item && (item.file || item.path));
  if (!entries.length) {
    for (const folder of ['giro-360', 'orbit360', 'giro360', '360']) {
      const dir = path.join(version.dir, folder);
      if (!fs.existsSync(dir)) continue;
      entries = fs.readdirSync(dir).filter(name => /\d+\.(png|jpe?g|webp)$/i.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(name => ({ file: `${folder}/${name}` }));
      if (entries.length) break;
    }
  }
  return entries.map((item, index) => {
    const record = addRecord(manifestPath(item.file || item.path, version, true), `${version.id.toUpperCase()} · giro ${String(index).padStart(3, '0')}`, item.sha256);
    return { url: record.url, exists: record.exists, degrees: Number.isFinite(item.degrees) ? item.degrees : index * 360 / entries.length, name: path.basename(record.file) };
  });
}
const orbitFrames = getOrbit(versions[1]);

function imageCard(record, title, className = '') {
  const visual = record.exists
    ? `<a class="image-link" href="${escape(record.url)}" target="_blank" rel="noopener"><img src="${escape(record.url)}" alt="${escape(title)}" loading="lazy"></a>`
    : `<div class="placeholder"><strong>Captura ainda não disponível</strong><span>${escape(path.basename(record.file))}</span><span>Gere as imagens e execute novamente o gerador.</span></div>`;
  return `<figure class="card ${className}"><figcaption><strong>${escape(title)}</strong><span>${record.exists ? 'Abrir imagem em tamanho original' : 'Aguardando arquivo'}</span></figcaption><div class="image-frame">${visual}</div></figure>`;
}
const translations = new Map([
  ['No artistic approval is implied by this file or its renders.', 'O manifesto e as capturas não representam aprovação artística.'],
  ['The original combat stance is preserved; a neutral A pose and deformable retopology are not yet produced.', 'A guarda original foi preservada. A pose A neutra e a retopologia para deformação ainda estão pendentes.'],
  ['The source UV layer is kept for editing. Procedural shading needs baking after final topology is approved.', 'As UVs de origem foram mantidas para edição. Os materiais procedurais precisam de baking após a definição da topologia.'],
  ['No rig, weights or combat clips have been created. Existing game assets remain unchanged.', 'Esta revisão não cria rig, pesos ou clipes de combate. Os arquivos atuais do jogo permanecem sem alteração.'],
  ['This editable sculpt is not a final game GLB.', 'Escultura editável para estudo no Blender. O arquivo GLB final do jogo ainda está pendente.'],
  ['No neutral pose, rig or combat clips created for the Meshy copy.', 'A cópia Meshy continua sem pose neutra, esqueleto (rig) ou animações de combate.'],
  ['Rear outfit details inferred from auxiliary concept sheet.', 'Os detalhes posteriores da roupa foram interpretados a partir da folha auxiliar de referência.'],
  ['Mobile performance and deformation checks follow topology and integration.', 'Os testes de desempenho no celular e de deformação dependem da topologia e da integração.'],
  ['Procedurais locais para estudo. Assar Base Color/Normal/Roughness apos retopologia e UV finais. Nao exportados automaticamente para glTF.', 'Materiais procedurais locais para estudo. Gerar mapas de cor, normais e rugosidade após a retopologia e as UVs finais; a exportação desses materiais para glTF ainda está pendente.'],
]);
const labels = new Map([
  ['materiais', 'Materiais'], ['pelagem', 'Pelagem'], ['tecido', 'Tecido do short'], ['couro', 'Couro'], ['tecido_top', 'Tecido do top'],
  ['acabamento', 'Acabamento'], ['roughness', 'Rugosidade'], ['bump_m', 'Relevo (m)'], ['subsurface', 'Dispersão sob a superfície'],
  ['alpha', 'Transparência'], ['nodes', 'Nós do material'], ['trama_mm', 'Trama (mm)'], ['coat', 'Camada de acabamento'], ['metallic', 'Metalização'],
  ['texturas_externas', 'Texturas externas'], ['top_separado', 'Top separado'], ['limites', 'Limites'],
]);
const portuguese = value => translations.get(value) || value;
function readable(value) {
  if (typeof value === 'string') return portuguese(value);
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(value);
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join(' · ');
  return Object.entries(value).map(([key, item]) => `${labels.get(key) || key}: ${readable(item)}`).join(' · ');
}
function materialSummary(manifest) {
  const data = manifest.materialSummary || manifest.materialsSummary || manifest.materials || manifest.surface?.materials;
  if (!data) return '<p class="muted">O resumo de materiais aparecerá após a geração do relatório V4.</p>';
  const entries = Array.isArray(data) ? data.map(item => readable(item)) : typeof data === 'object' ? Object.entries(data.materiais || data).map(([key, item]) => `${labels.get(key) || key}: ${readable(item)}`) : [readable(data)];
  if (data.materiais && data.limites) entries.push(`Limites dos materiais: ${readable(data.limites)}`);
  return `<ul>${entries.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`;
}
function limitSummary(manifest) {
  const data = manifest.limitations;
  const limits = Array.isArray(data) ? data : data && typeof data === 'object' ? Object.entries(data).map(([key, value]) => `${key}: ${readable(value)}`) : typeof data === 'string' ? [data] : [];
  if (!limits.length) return '<p class="muted">Consulte o manifesto após a geração das capturas. Esta galeria não registra decisões de aprovação.</p>';
  return `<ul>${limits.map(item => `<li>${escape(translations.get(item) || readable(item))}</li>`).join('')}</ul>`;
}
function hashRows() {
  return [...records.values()].map(record => {
    const status = !record.exists ? 'Arquivo ausente' : !record.expected.length ? 'Calculado nesta geração' : record.expected.every(hash => hash.toLowerCase() === record.hash) ? 'Confere com o manifesto' : 'Diverge do manifesto';
    const tone = !record.exists ? 'missing' : record.expected.some(hash => hash.toLowerCase() !== record.hash) ? 'mismatch' : '';
    return `<tr><td><strong>${escape(record.labels.join(' / '))}</strong><br>${record.exists ? `<a href="${escape(record.url)}">${escape(displayPath(record.file))}</a>` : `<span>${escape(displayPath(record.file))}</span>`}</td><td><code>${record.hash || '—'}</code>${record.expected.length ? `<small>Manifesto: ${record.expected.map(escape).join('<br>')}</small>` : ''}</td><td class="${tone}">${status}</td></tr>`;
  }).join('');
}
const generatedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Fortaleza' }).format(new Date());
const stage = versions[1].manifest.stage;
const stageText = new Map([
  ['visual identity review before rigging', 'Revisão da identidade visual antes do rig'],
  ['appearance refinement after original concept comparison', 'Refinamento da aparência após comparação com a arte original'],
]).get(stage) || (fileExists(versions[1].manifestFile) ? 'Revisão visual em andamento' : 'Aguardando relatório V4');
const panels = viewTypes.filter(type => type.id !== 'rosto').map((type, index) => `<div class="view-panel" id="panel-${type.id}" role="tabpanel" aria-labelledby="tab-${type.id}"${index ? ' hidden' : ''}><div class="pair">${versions.map(version => imageCard(version.views[type.id], `${version.id.toUpperCase()} · ${type.label}`)).join('')}</div></div>`).join('');
const initialFrame = orbitFrames.find(frame => frame.exists);
const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>Pipoca · comparação de identidade V3 e V4</title>
<style>
:root{color-scheme:dark;font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f3f1eb;background:#17191d;--muted:#bec4cb;--line:#434950;--panel:#22262c;--accent:#f0b886}*{box-sizing:border-box}body{margin:0}main{max-width:1540px;margin:auto;padding:30px 24px 70px}h1{font-size:clamp(1.8rem,3.5vw,3rem);line-height:1.15;margin:8px 0 14px}h2{font-size:1.45rem;margin:0 0 16px}h3{font-size:1.08rem;margin:0 0 12px}p{margin:0 0 14px}.muted,.intro,time{color:var(--muted)}.intro{max-width:850px}.eyebrow{color:var(--accent);font-size:.85rem;letter-spacing:.1em;text-transform:uppercase}a{color:#9bd5ff;text-underline-offset:3px}nav{display:flex;gap:20px;flex-wrap:wrap;margin:24px 0}section{margin-top:34px}.comparison{display:grid;grid-template-columns:minmax(220px,.85fr) minmax(0,2fr);gap:20px;align-items:start}.reference{position:sticky;top:16px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:0;min-width:0}figcaption{display:flex;flex-direction:column;padding:12px 15px;border-bottom:1px solid var(--line)}figcaption span{font-size:.8rem;color:var(--muted)}.image-frame{aspect-ratio:3/4;background:#363c42;display:flex;align-items:center;justify-content:center}.image-link{width:100%;height:100%;display:flex}.image-frame img{width:100%;height:100%;object-fit:contain;display:block}.reference .image-frame{aspect-ratio:2/3;background:#111216}.placeholder{padding:28px;text-align:center;color:var(--muted);display:flex;flex-direction:column;gap:12px;max-width:430px}.placeholder strong{color:#f3f1eb}.placeholder span{font-size:.9rem}.tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px}button{font:inherit;border:1px solid #67717c;background:#2b3038;color:#f3f1eb;border-radius:7px;padding:9px 15px;cursor:pointer}button:hover{background:#3a424c}button:disabled{opacity:.45;cursor:default}button[aria-selected=true]{border-color:var(--accent);background:#55402f}button:focus-visible,a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #9bd5ff;outline-offset:3px}[hidden]{display:none!important}.section-title{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.section-title p{color:var(--muted);font-size:.9rem}.face .image-frame{aspect-ratio:3/4}.turnaround .image-frame{aspect-ratio:16/9;background:#111216}.orbit-layout{display:grid;grid-template-columns:minmax(300px,650px) minmax(220px,1fr);gap:24px;align-items:start}.orbit-controls{padding:18px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.orbit-controls label,.orbit-controls output{display:block}.orbit-controls input{width:100%;accent-color:var(--accent);margin:15px 0}.orbit-frame{cursor:ew-resize;touch-action:pan-y}.orbit-frame img{user-select:none;-webkit-user-drag:none}.notes{display:grid;grid-template-columns:1fr 1fr;gap:24px;background:var(--panel);border:1px solid var(--line);padding:22px;border-radius:10px}ul{padding-left:22px;margin:0}li+li{margin-top:9px}details{border:1px solid var(--line);border-radius:10px;margin-top:30px;padding:18px}summary{cursor:pointer;font-weight:600}.table-wrap{overflow-x:auto;margin-top:18px}table{border-collapse:collapse;width:100%;font-size:.86rem}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid var(--line)}th{color:var(--muted)}td:first-child{min-width:250px;max-width:460px;overflow-wrap:anywhere}code{font:12px/1.6 ui-monospace,Consolas,monospace;overflow-wrap:anywhere}td:nth-child(2){min-width:260px;max-width:450px}small{display:block;color:var(--muted);font:11px/1.5 ui-monospace,Consolas,monospace;margin-top:5px;overflow-wrap:anywhere}.missing{color:#d7c79d}.mismatch{color:#ffb0a4}.warning{background:#46372b;padding:14px;border:1px solid #be8f55;border-radius:8px;margin:16px 0}footer{margin-top:25px;font-size:.85rem;color:var(--muted)}@media(max-width:950px){.comparison{grid-template-columns:1fr}.reference{position:static;max-width:390px;margin:auto;width:100%}.reference .image-frame{max-height:530px}.orbit-layout{grid-template-columns:1fr}.orbit-layout>.card{max-width:650px;width:100%;margin:auto}}@media(max-width:560px){main{padding:22px 12px 50px}.pair{gap:8px}figcaption{padding:10px;font-size:.9rem}.placeholder{padding:14px}.placeholder span{font-size:.8rem}.notes{grid-template-columns:1fr}.tabs button{padding:8px 12px}.orbit-controls{padding:14px}}
</style></head>
<body><main>
<header><span class="eyebrow">Estudo de identidade · Pipoca</span><h1>Comparação V3 e V4</h1><p class="intro">Arte original, capturas anteriores e novos ajustes para avaliar proporções, rosto, roupa e materiais. Abra qualquer imagem para ver os detalhes em tamanho original.</p><p class="muted">${escape(stageText)} · Gerada em <time>${escape(generatedAt)} (Fortaleza)</time></p></header>
<nav aria-label="Seções da galeria"><a href="#corpo">Corpo</a><a href="#rosto">Rosto</a><a href="#referencia">Turnaround</a><a href="#giro">Giro 360°</a><a href="#relatorio">Materiais e limites</a><a href="#identificacao">Arquivos e hashes</a></nav>
${warnings.map(warning => `<p class="warning">${escape(warning)}</p>`).join('')}
<section id="corpo"><h2>Silhueta e roupa</h2><div class="comparison"><aside class="reference">${imageCard(original, 'Arte original')}</aside><div><div class="tabs" role="tablist" aria-label="Ângulo das capturas">${viewTypes.filter(type => type.id !== 'rosto').map((type, index) => `<button type="button" id="tab-${type.id}" role="tab" aria-controls="panel-${type.id}" aria-selected="${index === 0}" tabindex="${index ? -1 : 0}">${type.label}</button>`).join('')}</div>${panels}</div></div></section>
<section id="rosto" class="face"><div class="section-title"><h2>Detalhe do rosto</h2><p>Olhos, sobrancelhas, focinho e interior das orelhas.</p></div><div class="pair">${versions.map(version => imageCard(version.views.rosto, `${version.id.toUpperCase()} · Rosto`)).join('')}</div></section>
<section id="referencia" class="turnaround"><h2>Turnaround de referência</h2>${imageCard(turnaround, 'Referência · frente, perfil, costas e rosto')}</section>
<section id="giro"><h2>V4 · Giro 360°</h2><div class="orbit-layout"><figure class="card"><figcaption><strong>Inspeção em volta do modelo</strong><span>Use o controle ou arraste a imagem.</span></figcaption><div class="image-frame orbit-frame" id="orbit-frame">${initialFrame ? `<a class="image-link" id="orbit-link" href="${escape(initialFrame.url)}" target="_blank" rel="noopener"><img id="orbit-image" src="${escape(initialFrame.url)}" alt="Pipoca V4 · giro 360°" draggable="false"></a>` : `<div class="placeholder" id="orbit-empty"><strong>Giro ainda não disponível</strong><span>As imagens numeradas serão carregadas após a próxima geração da galeria.</span></div><a class="image-link" id="orbit-link" hidden><img id="orbit-image" alt="Pipoca V4 · giro 360°" draggable="false"></a>`}</div></figure><div class="orbit-controls"><p>Inspecione o contorno, as alças, as faixas, o rosto e as transições entre materiais.</p><div class="buttons"><button type="button" id="orbit-prev" aria-label="Quadro anterior">← Anterior</button><button type="button" id="orbit-play">Reproduzir</button><button type="button" id="orbit-next" aria-label="Próximo quadro">Próximo →</button></div><label for="orbit-slider">Posição do giro</label><input id="orbit-slider" type="range" min="0" max="${Math.max(0, orbitFrames.length - 1)}" value="0" step="1"><output id="orbit-status" for="orbit-slider" aria-live="polite"></output><p class="muted">${orbitFrames.filter(frame => frame.exists).length} de ${orbitFrames.length} capturas disponíveis. A reprodução mostra imagens renderizadas do mesmo estudo.</p></div></div></section>
<section id="relatorio"><h2>Materiais e limites desta revisão</h2><div class="notes"><div><h3>Materiais V4</h3>${materialSummary(versions[1].manifest)}</div><div><h3>Limites registrados</h3>${limitSummary(versions[1].manifest)}</div></div></section>
<details id="identificacao"><summary>Identificação dos arquivos · SHA-256</summary><p class="muted">Hashes calculados dos arquivos presentes ao gerar esta página. Quando o manifesto fornece um hash, a tabela mostra a comparação. Execute novamente o gerador após alterar o .blend ou as capturas.</p><div class="table-wrap"><table><thead><tr><th scope="col">Arquivo</th><th scope="col">SHA-256 atual</th><th scope="col">Estado</th></tr></thead><tbody>${hashRows()}</tbody></table></div></details>
<footer>Galeria local: funciona sem conexão ou servidor. Esta página reúne evidências visuais e não representa aprovação artística.</footer>
</main>
<script>
(() => {
  'use strict';
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') target = tabs[(index + tabs.length - 1) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs[tabs.length - 1];
      if (target) { event.preventDefault(); selectTab(target); target.focus(); }
    });
  });
  const frames = ${JSON.stringify(orbitFrames).replace(/</g, '\\u003c')};
  const slider = document.getElementById('orbit-slider');
  const status = document.getElementById('orbit-status');
  const image = document.getElementById('orbit-image');
  const link = document.getElementById('orbit-link');
  const stage = document.getElementById('orbit-frame');
  const play = document.getElementById('orbit-play');
  const prev = document.getElementById('orbit-prev');
  const next = document.getElementById('orbit-next');
  let index = Math.max(0, frames.findIndex(frame => frame.exists));
  let timer = null;
  function stop() { if (timer) clearInterval(timer); timer = null; play.textContent = 'Reproduzir'; play.setAttribute('aria-pressed', 'false'); }
  function show(value) {
    if (!frames.length) { status.textContent = 'Aguardando imagens do giro.'; return; }
    index = ((Number(value) % frames.length) + frames.length) % frames.length;
    const frame = frames[index];
    slider.value = index;
    status.textContent = 'Quadro ' + (index + 1) + ' de ' + frames.length + ' · ' + Math.round(frame.degrees) + '°' + (frame.exists ? '' : ' · arquivo ausente');
    link.hidden = !frame.exists;
    let empty = document.getElementById('orbit-empty');
    if (!frame.exists && !empty) { empty = document.createElement('div'); empty.className = 'placeholder'; empty.id = 'orbit-empty'; stage.append(empty); }
    if (empty) { empty.hidden = frame.exists; empty.textContent = 'Captura ausente: ' + frame.name; }
    if (frame.exists) { image.src = frame.url; image.alt = 'Pipoca V4 · giro ' + Math.round(frame.degrees) + ' graus'; link.href = frame.url; }
    const following = frames[(index + 1) % frames.length];
    if (following.exists) { const preload = new Image(); preload.src = following.url; }
  }
  [prev, next, play, slider].forEach(control => { control.disabled = frames.filter(frame => frame.exists).length < 2; });
  prev.addEventListener('click', () => { stop(); show(index - 1); });
  next.addEventListener('click', () => { stop(); show(index + 1); });
  slider.addEventListener('input', () => { stop(); show(slider.value); });
  play.addEventListener('click', () => {
    if (timer) return stop();
    play.textContent = 'Pausar'; play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => show(index + 1), 160);
  });
  let drag = null;
  let dragged = false;
  stage.addEventListener('pointerdown', event => {
    if (frames.length < 2 || event.button !== 0) return;
    stop(); dragged = false; drag = { x: event.clientX, index };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (!drag) return;
    const delta = Math.round((event.clientX - drag.x) / 18);
    if (delta) { dragged = true; show(drag.index + delta); }
  });
  stage.addEventListener('pointerup', () => { drag = null; });
  stage.addEventListener('pointercancel', () => { drag = null; });
  link.addEventListener('click', event => { if (dragged) { event.preventDefault(); dragged = false; } });
  image.addEventListener('error', () => { stop(); status.textContent += ' · falha ao abrir imagem'; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  show(index);
})();
</script></body></html>
`;
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');
console.log(`Galeria: ${displayPath(outputFile)}`);
console.log(`Arquivos com hash atual: ${[...records.values()].filter(record => record.exists).length}; capturas do giro: ${orbitFrames.filter(frame => frame.exists).length}/${orbitFrames.length}.`);
if (warnings.length) console.warn(warnings.join('\n'));
