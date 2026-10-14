// Caminhada real no laboratório, avanço/recuo e parada, com GLBs de jogo.
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';
const saida = path.join(root, 'tmp/analise-passada/previa');

(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await page.route(`${origem}/**`, async rota => {
      const caminho = new URL(rota.request().url()).pathname;
      if (caminho.startsWith('/arenas/') || caminho.startsWith('/modelos/'))
        return rota.fulfill({ status: 200, body: fs.readFileSync(path.join(root, 'public', caminho)) });
      if (caminho === '/laboratorio.js') return rota.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'public/js/ko-laboratorio-3d.js')) });
      for (const nome of ['ko-sim.js', 'ko-cpu.js']) if (caminho === '/' + nome)
        return rota.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'public/js', nome)) });
      return rota.fulfill({ contentType: 'text/html', body: `<!doctype html><style>body{margin:0;background:#110d21;color:white}canvas{width:1280px;height:620px;display:block}</style>
        <script defer src="/ko-sim.js"></script><script defer src="/ko-cpu.js"></script><script defer src="/laboratorio.js"></script>
        <canvas id="arena-3d"></canvas><p id="estado-3d"></p>
        <select id="modo-luta"><option value="versus">versus</option></select><select id="nivel-maquina"><option value="medio">m</option></select>
        <button id="iniciar-luta">Começar luta</button><p id="estado-modelos"></p>` });
    });
    await page.goto(origem);
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));
    await page.click('#iniciar-luta');
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('2 jogadores'), null, { timeout: 90000 });
    await page.evaluate(() => {
      const lab = globalThis.__laboratorio3d;
      lab.pausado = true;
      const novo = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
      novo.fase = 'luta'; novo.fT = 0;
      Object.assign(lab.estado, novo);
    });
    async function capturar(nome, bits, quadros) {
      const dados = await page.evaluate(({ bits, quadros }) => {
        const s = globalThis.__laboratorio3d.estado;
        for (let i = 0; i < quadros; i++) KOSim.passo(s, [bits, 0]);
        return { x: s.p[0].x, vx: s.p[0].vx, estado: s.p[0].estado, f: s.f };
      }, { bits, quadros });
      await page.waitForTimeout(500);
      await page.locator('canvas').screenshot({ path: path.join(saida, `${nome}.png`) });
      return dados;
    }
    const B = await page.evaluate(() => KOSim.B);
    await capturar('0-guarda', 0, 1);
    for (let i = 1; i <= 4; i++) await capturar(`${i}-avanco`, B.R, 6);
    const parada = await capturar('5-parada', 0, 1);
    const depois = await capturar('6-parada-mantida', 0, 12);
    assert.equal(parada.vx, 0); assert.equal(depois.x, parada.x);
    for (let i = 1; i <= 4; i++) await capturar(`${i + 6}-recuo`, B.L, 6);
    assert.deepEqual(erros, []);
    console.log('OK passada no navegador: avanço, parada imediata e recuo. Capturas:', saida);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
