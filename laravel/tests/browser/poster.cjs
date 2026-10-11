// Verificação visual opcional com o Playwright já instalado para testes locais.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'art/premium/elenco/manifesto.json'), 'utf8'));
    for (const [nome, width, height] of [['tv',1920,1080], ['mobile',844,390], ['vertical',390,844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(pathToFileURL(path.join(root, 'art/premium/elenco/poster.html')).href);
      await page.locator('.elenco-poster img').evaluateAll(async imgs => Promise.all(imgs.map(i => i.decode())));
      const imgs = await page.locator('.elenco-poster img').evaluateAll(imgs => imgs.map(i => ({id:i.dataset.lutador,src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0})));
      assert.equal(imgs.length,18);
      assert.equal(new Set(imgs.map(i=>i.id)).size,18);
      for (const item of manifest) {
        const img = imgs.find(i=>i.id===item.id);
        assert.ok(img && img.ok && img.src.endsWith(item.arte.replace('.png','.webp')), item.id);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      await page.screenshot({ path: path.join(root,'.browser-check',`poster-${nome}.png`) });
      await page.close();
      console.log(`PASS ${nome}: 18 personagens únicos, versões corretas e imagens carregadas`);
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
