// Galeria local de revisão: usa somente capturas do mesmo GLB, sem serviços externos.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = resolve(raiz, 'art/premium/modelos-3d/estudos-mixamo');
const modelo = 'public/modelos/estudos/pipoca-direcao-visual-v13.glb';
const sha = createHash('sha256').update(readFileSync(resolve(raiz, modelo))).digest('hex');
const escapar = texto => String(texto).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const ler = nome => {
  const manifesto = JSON.parse(readFileSync(resolve(pasta, nome, 'quadros.json')));
  assert.equal(manifesto.sha256Glb, sha, `Capturas desatualizadas: ${nome}. Regenere antes de montar a revisão.`);
  return manifesto.quadros;
};
const retratos = ler('retrato-visual-v13'), poses = ler('revisao-visual-v13'), combate = ler('previa-combate-v13');
const nomes = { parado:'Guarda', p1:'Soco rápido', p2:'Soco forte', k1:'Chutes médios', k2:'Chute alto',
  defesa:'Defesa alta', dano:'Reação', agachado:'Agachamento', defesaBaixa:'Defesa baixa', pulo:'Salto',
  pousando:'Pouso', andando:'Passada', cp:'Soco baixo', ck:'Rasteira', ap:'Soco aéreo', ak:'Chute aéreo',
  esp:'Cenoura', sup:'Super', corrida:'Corrida', recuo:'Recuo', quebra:'Quebra-combo', caido:'Queda',
  levantando:'Levantamento', rolando:'Rolamento', agarrando:'Agarrão', agarrado:'Reação ao agarrão',
  tonto:'Tontura', vitoria:'Vitória', derrotado:'Derrota', final:'Chuva de Cenouras', vitimaFinal:'Reação ao Final' };
const vistas = { 'tres-quartos':'Três quartos', frontal:'Frente', perfil:'Perfil', frente:'Frente', costas:'Costas', 'frente-invertida':'Lado oposto' };
function figura(pasta, arquivo, legenda) {
  assert.match(arquivo, /^\d{3}\.png$/);
  assert.ok(existsSync(resolve(raiz,'art/premium/modelos-3d/estudos-mixamo',pasta,arquivo)),`Captura ausente: ${pasta}/${arquivo}`);
  return `<figure><a href="${pasta}/${arquivo}"><img loading="lazy" src="${pasta}/${arquivo}" alt="${escapar(legenda)}"></a><figcaption>${escapar(legenda)}</figcaption></figure>`;
}
const retratosHtml = retratos.map((q,i) => figura('retrato-visual-v13', String(i).padStart(3,'0')+'.png', vistas[q.vista] || q.vista)).join('');
const posesHtml = poses.map((q,i) => figura('revisao-visual-v13', String(i).padStart(3,'0')+'.png', `${nomes[q.clip] || q.clip} · quadro ${q.quadro} · ${vistas[q.vista] || q.vista}`)).join('');
const combateHtml = combate.map(q => figura('previa-combate-v13', q.arquivo, `${nomes[q.cenario] || ({cenoura:'Cenoura',super:'Super da toca',baixo:'Ataques baixos',aereo:'Ataque aéreo'})[q.cenario] || q.cenario} · quadro ${q.quadro}`)).join('');
const html = `<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>Pipoca — revisão do personagem</title>
<style>
:root{font:16px/1.55 system-ui,sans-serif;color:#f2e9df;background:#10101a}*{box-sizing:border-box}
body{margin:0}main{max-width:1320px;margin:auto;padding:32px 24px 64px}h1{font-size:clamp(2rem,5vw,3.8rem);line-height:1.1;margin:12px 0}h2{margin-top:48px;font-size:1.6rem}
p{max-width:780px;color:#c8bfce}a{color:#e9c690;text-underline-offset:4px}nav{display:flex;gap:24px;flex-wrap:wrap;margin:24px 0 32px}figure{margin:0;background:#1c1b2a;border:1px solid #353044;border-radius:14px;overflow:hidden}
img{display:block;width:100%;height:auto}figcaption{padding:12px 16px;font-size:.9rem;color:#d3cadc}.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px}.combate{grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))}
.selo{display:inline-block;border:1px solid #9b7845;border-radius:30px;padding:5px 14px;color:#e9c690;font-size:.82rem;letter-spacing:.06em}.comparacao{display:grid;grid-template-columns:minmax(180px,1fr) minmax(280px,2fr);gap:24px}.referencia img{max-height:720px;object-fit:contain;background:#08080c}.referencia{align-self:start}.retratos{align-content:start}
details{margin-top:32px;color:#afa6bb;overflow-wrap:anywhere}summary{cursor:pointer}code{font-size:.8rem}@media(max-width:680px){main{padding:24px 16px}.comparacao{grid-template-columns:1fr}.referencia img{max-height:540px}.combate{grid-template-columns:1fr}}
</style><main>
<span class="selo">PERSONAGEM EM REFINAMENTO</span><h1>Pipoca</h1>
<p>Comparação com a arte de referência e capturas reais do personagem no renderizador do jogo. O acabamento de pelagem, anatomia, tecido e expressões continua em produção.</p>
<nav aria-label="Revisão"><a href="#aparencia">Aparência</a><a href="#movimentos">Movimentos</a><a href="#combate">Combate e efeitos</a></nav>
<section id="aparencia"><h2>Aparência</h2><div class="comparacao">
<figure class="referencia"><a href="../../elenco/pipoca-v1.png"><img src="../../elenco/pipoca-v1.png" alt="Arte original da Pipoca com pelagem creme, luvas vermelhas e roupa índigo"></a><figcaption>Arte de referência</figcaption></figure>
<div class="grade retratos">${retratosHtml}</div></div></section>
<section id="movimentos"><h2>Movimentos e poses extremas</h2><p>Frente, costas e lado oposto. Abrir uma imagem mostra a captura em seu tamanho original. Cada pose precisa preservar a silhueta, o contato e a roupa.</p><div class="grade">${posesHtml}</div></section>
<section id="combate"><h2>Combate e efeitos</h2><p>Sequências calculadas pelo motor: cenoura, Super, ataques baixos, ataque aéreo e Final. Uivo ainda usa o modelo provisório anterior.</p><div class="grade combate">${combateHtml}</div></section>
<details><summary>Identificação da revisão</summary><p>Todas as capturas correspondem ao mesmo GLB.</p><code>SHA-256: ${sha}</code><p><a href="../../../../${modelo}">Arquivo 3D desta revisão</a> · <a href="integracao-v13.json">Relatório técnico</a> · <a href="../GUIA-PERSONAGENS.md">Critérios dos personagens</a></p></details>
</main></html>`;
writeFileSync(resolve(pasta,'revisao-pipoca.html'), html);
console.log(JSON.stringify({arquivo:'art/premium/modelos-3d/estudos-mixamo/revisao-pipoca.html',sha256Glb:sha,capturas:retratos.length+poses.length+combate.length}));
