// Efeitos estilo Street Fighter IV na luta 3D: acerto, defesa, cenoura,
// Super e KO, com capturas de cada momento.
//   node laravel/tests/browser/efeitos-sf4-3d.cjs
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';
const saida = path.join(root, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/efeitos');

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
        <select id="modo-luta"><option value="cpu">cpu</option><option value="versus" selected>versus</option></select>
        <select id="nivel-maquina"><option value="medio" selected>m</option></select>
        <button type="button" id="iniciar-luta">Começar luta</button><p id="estado-modelos"></p>` });
    });
    await page.goto(origem);
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));
    await page.click('#iniciar-luta');
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('2 jogadores'), null, { timeout: 60000 });
    await page.waitForTimeout(8000);
    console.log('debug', await page.evaluate(() => [globalThis.__laboratorio3d.estado.fase, globalThis.__laboratorio3d.estado.f, document.querySelector('#estado-3d').textContent]), erros.slice(0, 5));
    await page.waitForFunction(() => globalThis.__laboratorio3d.estado.fase === 'luta', null, { timeout: 120000 });
    const canvas = page.locator('canvas');
    const aproximar = () => page.evaluate(() => { const s = globalThis.__laboratorio3d.estado; s.p[0].x = 160 * 16; s.p[1].x = 186 * 16; });
    // Marca quando o motor gera o evento; captura logo depois (efeito no ar).
    await page.evaluate(() => {
      window.__eventos = [];
      // A lista de eventos é zerada a cada passo: registrar no próprio passo.
      const passo = KOSim.passo;
      KOSim.passo = (estado, entradas) => {
        if (globalThis.__laboratorio3d.pausado) return;
        const r = passo(estado, entradas); window.__eventos.push(...estado.ev);
        // Congela 3 quadros depois do evento procurado (efeito perto do auge).
        if (window.__alvo && estado.ev.some(e => e.t === window.__alvo)) window.__congelarEm = 3;
        if (window.__congelarEm !== undefined && --window.__congelarEm <= 0) { globalThis.__laboratorio3d.pausado = true; window.__congelarEm = undefined; }
        return r;
      };
    });
    async function golpe(nome, tecla, tipo, { segurar = 260, antes, depois = 0 } = {}) {
      await page.evaluate(t => { window.__eventos = []; window.__alvo = t; }, tipo);
      if (antes) await antes();
      // Até 3 tentativas: no navegador de teste (sem GPU, ~4 FPS) a tecla
      // segura cai em quadros diferentes do motor a cada rodada.
      for (let tentativa = 0; ; tentativa++) {
        await page.keyboard.down(tecla); await page.waitForTimeout(segurar); await page.keyboard.up(tecla);
        try { await page.waitForFunction(t => window.__eventos.some(e => e.t === t), tipo, { timeout: 8000 }); break; }
        catch (erro) { if (tentativa >= 2) throw erro; if (antes) await antes(); }
      }
      await page.waitForFunction(() => globalThis.__laboratorio3d.pausado, null, { timeout: 8000 });
      await page.waitForTimeout(400);
      await canvas.screenshot({ path: path.join(saida, nome + '.png') });
      await page.evaluate(() => { window.__alvo = null; globalThis.__laboratorio3d.pausado = false; });
      await page.waitForTimeout(900);
    }
    await aproximar();
    await golpe('1-soco', 'KeyJ', 'acerto', { antes: aproximar });
    await aproximar();
    await golpe('2-chute', 'KeyK', 'acerto', { antes: aproximar });
    await aproximar();
    await page.keyboard.down('Comma');
    await golpe('3-defesa', 'KeyJ', 'defendeu', { antes: aproximar });
    await page.keyboard.up('Comma');
    await page.evaluate(() => { const s = globalThis.__laboratorio3d.estado; s.p[0].poder = 0; s.proj.length = 0; s.p[0].x = 100 * 16; s.p[1].x = 300 * 16; });
    await golpe('4-cenoura', 'KeyI', 'especial', { depois: 900 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = globalThis.__laboratorio3d.estado; s.p[0].poder = 1000; s.p[0].x = 160 * 16; s.p[1].x = 200 * 16; });
    await golpe('5-super', 'KeyI', 'super', { depois: 200 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const s = globalThis.__laboratorio3d.estado; s.p[1].vida = 1; });
    await aproximar();
    await golpe('6-ko', 'KeyJ', 'acerto', { depois: 300, antes: aproximar });
    await page.waitForTimeout(800);
    await canvas.screenshot({ path: path.join(saida, '7-ko-depois.png') });
    const fase = await page.evaluate(() => globalThis.__laboratorio3d.estado.fase);
    console.log('fase final', fase, 'erros', erros);
    assert.deepEqual(erros, []);
  } finally { await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
