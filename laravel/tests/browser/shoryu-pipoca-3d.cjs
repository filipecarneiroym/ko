// Shoryuken (dp) jogado pelo teclado na luta 3D, com capturas.
// Pipoca vermelha (jogadora) contra Pipoca azul.
//   node laravel/tests/browser/shoryu-pipoca-3d.cjs
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';
const saida = path.join(root, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/shoryu-teclado');

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
      if (caminho === '/modelos/estudos/pipoca-direcao-visual-v13.glb') return rota.fulfill({ status: 200, contentType: 'model/gltf-binary', body: fs.readFileSync(path.join(root, 'public/modelos/estudos/pipoca-v5-vermelha.glb')) });
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
    await aproximar();
    // Partida de verdade pelo motor: a entrada da Pipoca vermelha (jogadora) é injetada quadro a
    // quadro dentro do passo do KOSim, então a sequência entra inteira qualquer que seja o FPS.
    // A azul fica parada como adversária.
    const B = await page.evaluate(() => ({ R: KOSim.B.R, D: KOSim.B.D, P: KOSim.B.P }));
    await page.evaluate(({ R, D, P }) => {
      window.__roteiro = [[R, 2], [D, 2], [D | R, 2], [0, 4], [P, 1], [0, 60]];
      window.__quadroRoteiro = 0; window.__capturas = []; window.__eventosPartida = [];
      if (!window.__wrapPasso) {
        window.__wrapPasso = true;
        const passo = KOSim.passo;
        KOSim.passo = (estado, entradas) => {
          if (globalThis.__laboratorio3d.pausado) return;
          let bits = 0, i = window.__quadroRoteiro;
          for (const [b, n] of window.__roteiro) { if (i < n) { bits = b; break; } i -= n; }
          window.__quadroRoteiro++;
          const r = passo(estado, [bits, entradas[1]]);
          window.__eventosPartida.push(...estado.ev);
          const p0 = estado.p[0];
          if (p0.golpe === 'dp' && p0.estado === 'golpe' && [3, 6, 9, 12, 16, 20, 26].includes(p0.t) && !window.__capturou?.[p0.t]) {
            (window.__capturou = window.__capturou || {})[p0.t] = 1;
            window.__pedido = { t: p0.t, y: p0.y, x: p0.x, quadro: estado.f, p0: [p0.id, p0.lado, p0.estado, p0.golpe], p1: [estado.p[1].id, estado.p[1].lado, estado.p[1].estado, Math.round(estado.p[1].y)], ataques: window.__eventosPartida.filter(e => e.t === 'ataque' || e.t === 'acerto' || e.t === 'derrubado').map(e => [e.t, e.lado, e.golpe]) };
            globalThis.__laboratorio3d.pausado = true;
          }
          return r;
        };
      }
    }, B);
    // Captura a subida: pausa o motor em cada quadro-chave do dp e tira a foto.
    for (let k = 0; k < 8; k++) {
      await page.waitForFunction(() => globalThis.__laboratorio3d.pausado || window.__quadroRoteiro >= 80, null, { timeout: 180000 }).catch(() => {});
      const pedido = await page.evaluate(() => window.__pedido);
      if (!pedido) break;
      await page.waitForTimeout(300);
      await canvas.screenshot({ path: path.join(saida, 'dp-t' + String(pedido.t).padStart(2, '0') + '.png') });
      console.log('dp quadro', pedido.t, JSON.stringify({ p0: pedido.p0, p1: pedido.p1, ev: pedido.ataques }));
      await page.evaluate(() => { window.__pedido = null; globalThis.__laboratorio3d.pausado = false; });
    }
    await page.waitForFunction(() => window.__quadroRoteiro >= 80, null, { timeout: 180000 }).catch(() => {});
    const resumo = await page.evaluate(() => ({
      quadros: window.__quadroRoteiro,
      ataques: window.__eventosPartida.filter(e => e.t === 'ataque').map(e => e.golpe),
      estadoP0: globalThis.__laboratorio3d.estado.p[0].estado,
      yP0: globalThis.__laboratorio3d.estado.p[0].y,
    }));
    console.log('partida', JSON.stringify(resumo));
    assert.ok(resumo.ataques.includes('dp'), 'a partida deveria registrar o golpe dp');
    await page.evaluate(() => { globalThis.__laboratorio3d.pausado = true; });
    await canvas.screenshot({ path: path.join(saida, 'partida-fim.png') });
    console.log('ok: dp jogado numa partida pelo motor; capturas em', saida);
  } finally {
    await browser.close();
  }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
