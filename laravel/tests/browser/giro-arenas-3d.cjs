// As seis arenas 3D com a luta Pipoca azul × vermelha: troca de arena sem
// erros e captura de cada uma.
//   node laravel/tests/browser/arenas-3d.cjs
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';
const saida = path.join(root, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/arenas');
const ARENAS = ["neve","floresta","feira"];

(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const bundle = await build({ entryPoints: [path.join(root, 'src/3d/laboratorio.js')], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true, logLevel: 'silent' });
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const erros = [];
    page.on('pageerror', erro => { erros.push(erro.message); console.log('PAGEERROR', erro.message); });
    page.on('console', m => { if (m.type() === 'error') { erros.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
    await page.route(`${origem}/**`, async rota => {
      const caminho = new URL(rota.request().url()).pathname;
      if (caminho.startsWith('/arenas/')) return rota.fulfill({ status: 200, body: fs.readFileSync(path.join(root, 'public', caminho)) });
      if (caminho.startsWith('/modelos/')) return rota.fulfill({ status: 200, contentType: 'model/gltf-binary', body: fs.readFileSync(path.join(root, 'public', caminho)) });
      if (caminho === '/laboratorio.js') return rota.fulfill({ contentType: 'text/javascript; charset=utf-8', body: bundle.outputFiles[0].text });
      for (const nome of ['ko-sim.js', 'ko-cpu.js']) if (caminho === '/' + nome) return rota.fulfill({ contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(path.join(root, 'public/js', nome)) });
      if (caminho === '/style.css') return rota.fulfill({ contentType: 'text/css', body: 'body{margin:0;color:white;background:#110d21}canvas{width:1280px;height:620px;display:block}' });
      return rota.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8">
        <link rel="stylesheet" href="/style.css"><script defer src="/ko-sim.js"></script><script defer src="/ko-cpu.js"></script><script defer src="/laboratorio.js"></script>
        <canvas id="arena-3d"></canvas><p id="estado-3d"></p>
        <select id="modo-luta"><option value="versus" selected>versus</option></select>
        <select id="nivel-maquina"><option value="medio" selected>m</option></select>
        <select id="arena">${ARENAS.map(a => `<option value="${a}">${a}</option>`).join('')}</select>
        <button type="button" id="iniciar-luta">Começar luta</button><p id="estado-modelos"></p>` });
    });
    await page.goto(origem);
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));
    await page.click('#iniciar-luta');
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('2 jogadores'), null, { timeout: 60000 });
    await page.evaluate(() => { const s = globalThis.__laboratorio3d.estado; s.p[0].x = 150 * 16; s.p[1].x = 234 * 16; });
    for (const nome of ARENAS) {
      await page.selectOption('#arena', nome);
      await page.waitForFunction(n => globalThis.__arenaPronta === n, nome, { timeout: 120000 });
      await page.waitForTimeout(3000);
      for (let k = 0; k < 8; k++) {
        await page.evaluate(([n, k]) => { const m = globalThis.__laboratorio3d.scene.meshes.find(x => x.name.startsWith(n + '-fundo')); m.rotation.y = k * Math.PI / 4; }, [nome, k]);
        await page.waitForTimeout(1500);
        await page.locator('canvas').screenshot({ path: path.join(saida, `giro-${nome}-${k}.png`) });
      }
      console.log('arena', nome, await page.evaluate(() => document.querySelector('#estado-3d').textContent.match(/(\d+) FPS/)?.[1]));
    }
    assert.deepEqual(erros, []);
    console.log('OK arenas');
  } finally { await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
