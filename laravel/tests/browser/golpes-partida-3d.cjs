// Passada de todos os golpes e da defesa numa partida real pelo motor, com capturas da defesa.
// Pipoca vermelha (jogadora) contra Pipoca azul.
//   node laravel/tests/browser/golpes-partida-3d.cjs
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';
const saida = path.join(root, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/golpes-partida');

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
    const K = await page.evaluate(() => ({ R: KOSim.B.R, L: KOSim.B.L, U: KOSim.B.U, D: KOSim.B.D, P: KOSim.B.P, K: KOSim.B.K, S: KOSim.B.S, F: KOSim.B.F }));
    // Entrada injetada quadro a quadro: r0 (jogador, lado 0) e r1 (adversário, lado 1).
    await page.evaluate(() => {
      window.__q = 0; window.__r0 = []; window.__r1 = []; window.__ev = []; window.__pausaDefesa = null;
      if (!window.__wrapGolpes) {
        window.__wrapGolpes = true;
        const passo = KOSim.passo;
        const roda = (r, q) => { let i = q; for (const [b, n] of r) { if (i < n) return b; i -= n; } return 0; };
        KOSim.passo = (estado, entradas) => {
          if (globalThis.__laboratorio3d.pausado) return;
          const q = window.__q++;
          const b0 = roda(window.__r0, q), b1 = roda(window.__r1, q);
          const r = passo(estado, [b0, b1]);
          window.__ev.push(...estado.ev);
          if (estado.ev.some(e => e.t === 'defendeu') && window.__pausaDefesa === null) {
            window.__pausaDefesa = { quadro: estado.f, p0: estado.p[0].estado, p1: estado.p[1].estado };
            globalThis.__laboratorio3d.pausado = true;
          }
          return r;
        };
      }
    });
    async function rodar(nome, r0, r1 = [], { posicao = [160, 186], espera = 4000, prepara = null } = {}) {
      await page.evaluate(({ r0, r1, posicao, prepara }) => {
        const s = globalThis.__laboratorio3d.estado;
        s.p[0].x = posicao[0] * 16; s.p[1].x = posicao[1] * 16;
        if (prepara) prepara(s);
        window.__q = 0; window.__r0 = r0; window.__r1 = r1; window.__ev = []; window.__pausaDefesa = null;
      }, { r0, r1, posicao, prepara: prepara ? prepara.toString() : null }).catch(() => {});
      const total = Math.max(r0.reduce((a, [, n]) => a + n, 0), r1.reduce((a, [, n]) => a + n, 0));
      await page.waitForFunction(t => window.__q >= t || globalThis.__laboratorio3d.pausado, total + 40, { timeout: 180000 }).catch(() => {});
      let captura = null;
      if (await page.evaluate(() => globalThis.__laboratorio3d.pausado)) {
        captura = await page.evaluate(() => window.__pausaDefesa);
        await page.waitForTimeout(300);
        await canvas.screenshot({ path: path.join(saida, 'defesa-' + nome + '.png') });
        await page.evaluate(() => { globalThis.__laboratorio3d.pausado = false; });
      }
      await page.waitForFunction(t => window.__q >= t, total + 40, { timeout: 180000 }).catch(() => {});
      const ev = await page.evaluate(() => window.__ev.map(e => [e.t, e.lado, e.golpe || null]));
      const ataques = ev.filter(e => e[0] === 'ataque').map(e => e[2]);
      const efeitos = [...new Set(ev.filter(e => ['acerto', 'defendeu', 'derrubou', 'super', 'especial', 'pulo', 'rolar', 'agarrao'].includes(e[0])).map(e => e[0]))];
      const resultado = { nome, ataques, efeitos, captura };
      console.log('GOLPE', JSON.stringify(resultado));
      resultados.push(resultado);
      await page.waitForTimeout(600);
      return resultado;
    }
    const resultados = [];
    const parado = 30;
    await rodar('p1', [[K.P, 1], [0, 30]]);
    await rodar('p2', [[K.P, 1], [0, 12], [K.P, 1], [0, 30]]);
    await rodar('cp', [[K.D | 0, 1], [K.D | K.P, 1], [0, 30]]);
    await rodar('ck', [[K.D, 1], [K.D | K.K, 1], [0, 30]]);
    await rodar('k1', [[K.K, 1], [0, 30]]);
    await rodar('k2', [[K.R, 1], [0, 1], [K.R, 1], [0, 6], [K.K, 1], [0, 30]]);
    await rodar('ap', [[K.U, 1], [0, 6], [K.P, 1], [0, 40]]);
    await rodar('ak', [[K.U, 1], [0, 6], [K.K, 1], [0, 40]]);
    await rodar('esp', [[K.S, 1], [0, 40]]);
    await rodar('foc', [[K.F, 1], [0, 40]]);
    await rodar('dp', [[K.R, 2], [K.D, 2], [K.D | K.R, 2], [0, 4], [K.P, 1], [0, 60]]);
    await rodar('cenoura-qcf', [[K.D, 2], [K.D | K.R, 2], [K.R, 2], [K.R | K.P, 1], [0, 60]]);
    await rodar('super', [[K.S, 1], [0, 80]], [], { prepara: s => { s.p[0].poder = 1000; } });
    // Defesa: o adversário ataca e a jogadora segura para trás (contrário à frente).
    await rodar('defesa-soco', [[K.L, 60]], [[0, 20], [K.P, 1], [0, 40]], { posicao: [160, 186] });
    await rodar('defesa-chute', [[K.L, 60]], [[0, 20], [K.K, 1], [0, 40]], { posicao: [160, 186] });
    console.log('RESUMO', JSON.stringify(resultados.map(r => [r.nome, r.ataques.join('+') || '-', r.efeitos.join('+') || '-'])));
    await browser.close();
  } catch (erro) { console.error(erro); process.exitCode = 1; await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
