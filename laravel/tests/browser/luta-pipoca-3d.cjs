// Luta 3D Pipoca azul × Pipoca vermelha no laboratório: arena carregada, os
// dois modelos v5, máquina jogando, golpes do jogador e capturas da cena.
//   node laravel/tests/browser/luta-pipoca-3d.cjs
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';
const saida = path.join(root, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/luta');

(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const bundle = await build({ entryPoints: [path.join(root, 'src/3d/laboratorio.js')], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true, logLevel: 'silent' });
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const erros = [];
    page.on('pageerror', erro => erros.push(erro.message));
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await page.route(`${origem}/**`, async rota => {
      const caminho = new URL(rota.request().url()).pathname;
      if (caminho.startsWith('/modelos/')) return rota.fulfill({ status: 200, contentType: 'model/gltf-binary', body: fs.readFileSync(path.join(root, 'public', caminho)) });
      if (caminho === '/laboratorio.js') return rota.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text });
      for (const nome of ['ko-sim.js', 'ko-cpu.js']) if (caminho === '/' + nome) return rota.fulfill({ contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(path.join(root, 'public/js', nome)) });
      if (caminho === '/style.css') return rota.fulfill({ contentType: 'text/css', body: 'body{margin:0;color:white;background:#110d21}canvas{width:1280px;height:620px;display:block}' });
      return rota.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <link rel="stylesheet" href="/style.css"><script defer src="/ko-sim.js"></script><script defer src="/ko-cpu.js"></script><script defer src="/laboratorio.js"></script>
        <canvas id="arena-3d"></canvas><p id="estado-3d"></p>
        <select id="modo-luta"><option value="cpu">cpu</option><option value="versus">versus</option></select>
        <select id="nivel-maquina"><option value="facil">f</option><option value="medio" selected>m</option><option value="dificil">d</option></select>
        <button type="button" id="iniciar-luta">Começar luta</button><p id="estado-modelos"></p>` });
    });
    await page.goto(origem);
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));
    const canvas = page.locator('canvas');
    await canvas.screenshot({ path: path.join(saida, '0-arena.png') });
    await page.click('#iniciar-luta');
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('máquina'), null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('luta'), null, { timeout: 30000 });
    await canvas.screenshot({ path: path.join(saida, '1-inicio.png') });
    // Jogador avança e ataca; a máquina responde sozinha.
    const vidaInicial = await page.evaluate(() => document.querySelector('#estado-3d').textContent);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await page.keyboard.up('KeyD');
    const golpes = [['KeyJ', '2-soco'], ['KeyK', '3-chute'], ['KeyJ', '4-soco'], ['KeyK', '5-chute']];
    for (const [tecla, nome] of golpes) {
      await page.keyboard.press(tecla); await page.waitForTimeout(110);
      await canvas.screenshot({ path: path.join(saida, `${nome}.png`) });
      await page.waitForTimeout(350);
    }
    await page.keyboard.down('KeyS'); await page.keyboard.press('KeyK'); await page.waitForTimeout(120);
    await canvas.screenshot({ path: path.join(saida, '6-rasteira.png') });
    await page.keyboard.up('KeyS');
    await page.waitForTimeout(4000);
    await canvas.screenshot({ path: path.join(saida, '7-depois.png') });
    const status = await page.evaluate(() => document.querySelector('#estado-3d').textContent);
    console.log('inicio:', vidaInicial); console.log('depois:', status);
    assert.deepEqual(erros, [], 'Sem erros na página');
    assert.match(status, /máquina Médio/);
    const vidas = status.match(/vida (\d+) \/ (\d+)/).slice(1).map(Number);
    assert.ok(vidas[0] < 950 || vidas[1] < 950, 'Houve troca de golpes');
    console.log('OK luta 3D', vidas);
  } finally { await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
