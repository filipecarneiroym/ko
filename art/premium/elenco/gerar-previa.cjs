// Gera apenas HTML de composição; não redesenha nem altera os pixels das artes.
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '../../..');
const parcial = fs.readFileSync(path.join(base, 'laravel/resources/views/partials/fundo-elenco.blade.php'), 'utf8')
  .replace(/\{\{--[\s\S]*?--\}\}/g, '').replaceAll('src="/img/', 'src="../../../public/img/');
const pagina = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>K.O — composição do elenco</title>
<link rel="stylesheet" href="../../../public/css/ko.css">
<style>.fundo-elenco{z-index:0;background-image:url('../../../public/img/cenario-poster-v1.webp')}.fundo-elenco::after{background:linear-gradient(0deg,#0b0614aa,transparent 40%)}.assinatura{position:fixed;bottom:1%;left:0;right:0;margin:0;text-align:center;color:#ffd23f;font:900 clamp(32px,5vw,80px) system-ui;text-shadow:3px 4px #9e2222;pointer-events:none}</style>
${parcial}<h1 class="assinatura">K.O</h1></html>`;
fs.writeFileSync(path.join(__dirname, 'poster.html'), pagina);
console.log('Prévia atualizada a partir da composição usada pelo menu.');
