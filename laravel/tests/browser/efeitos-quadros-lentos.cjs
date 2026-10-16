// Reproduz vários passos de motor entre dois desenhos, como num celular lento.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium, webkit } = require(path.join(root, '.browser-check/node_modules/playwright'));
const { build } = require('esbuild');
(async () => {
  const bundle = await build({ stdin: { contents: "import './src/3d/jogo-3d.js'; import { EngineStore } from '@babylonjs/core/Engines/engineStore.js'; window.cenaTeste = () => EngineStore.Instances.at(-1).scenes[0];", resolveDir: root }, bundle: true, write: false, format: 'iife', minify: true });
  const safari = !!process.env.KO_WEBKIT;
  const browser = await (safari ? webkit.launch({ headless: true }) : chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }));
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block', hasTouch: true, isMobile: true,
      ...(safari ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : {}) });
    const erros = []; page.on('pageerror', e => erros.push(e.message));
    await page.route('http://teste.local/**', r => {
      const p = new URL(r.request().url()).pathname;
      if (p.startsWith('/arenas/') || p.startsWith('/modelos/')) return r.fulfill({ body: fs.readFileSync(path.join(root, 'public', p)) });
      if (p === '/3d.js') return r.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text });
      if (p === '/sim.js') return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'public/js/ko-sim.js')) });
      return r.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}canvas{width:844px;height:390px}</style><canvas id="c"></canvas><script src="/sim.js"></script><script src="/3d.js"></script>' });
    });
    await page.goto('http://teste.local/');
    await page.evaluate(async () => {
      const config = document.createElement('script'); config.id = 'ko-config'; config.type = 'application/json';
      config.textContent = JSON.stringify({ lutadores: { pipoca: { modelos3d: ['/modelos/estudos/pipoca-v5-azul.glb', '/modelos/estudos/pipoca-v5-vermelha.glb'] } } }); document.body.append(config);
      window.r3d = KO3D.criar(document.querySelector('canvas'), { cenario: 'academia', lutadores: ['pipoca', 'pipoca'] }); await r3d.pronto;
    });
    const impactos = await page.evaluate(() => {
      const s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta'; s.p[0].x = 150 * KOSim.U; s.p[1].x = 170 * KOSim.U;
      r3d.desenhar(s); let acertou = false;
      for (let q = 0; q < 30; q++) { KOSim.passo(s, [q === 0 ? KOSim.B.P : 0, 0]); acertou ||= s.ev.some(e => e.t === 'acerto'); r3d.eventos(s.ev, s); }
      const antes = JSON.stringify(s); r3d.desenhar(s); window.sTeste = s;
      return { acertou, preservado: antes === JSON.stringify(s), visiveis: cenaTeste().meshes.filter(m => /^sf4-estrela-\d+$/.test(m.name) && m.isEnabled() && m.visibility > 0).length };
    });
    assert.ok(impactos.acertou); assert.ok(impactos.visiveis > 0, 'impacto deve aparecer no primeiro desenho, mesmo após 30 passos acumulados');
    assert.ok(impactos.preservado, 'efeitos não mudam a simulação');
    await page.screenshot({ path: path.join(root, `.browser-check/efeitos-impacto${safari ? '-webkit' : ''}.png`) });
    await page.waitForTimeout(50);
    const tempo = await page.evaluate(() => { r3d.desenhar(sTeste); return { delta: cenaTeste().getEngine().getDeltaTime(), razao: cenaTeste().getAnimationRatio() }; });
    assert.ok(tempo.delta > 0 && tempo.razao > .06, 'laço real do jogo atualiza o relógio do Babylon para as partículas');
    const chamas = await page.evaluate(() => {
      r3d.limpar(); const s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta'; s.p[0].x = 80 * KOSim.U; s.p[1].x = 300 * KOSim.U;
      r3d.desenhar(s);
      for (let q = 0; q < 40; q++) { KOSim.passo(s, [q === 0 ? KOSim.B.R | KOSim.B.S : 0, 0]); r3d.eventos(s.ev, s); }
      r3d.desenhar(s);
      const aura = cenaTeste().particleSystems.find(p => p.name === 'golpe-aura-0');
      return { taxa: aura.emitRate, particulas: aura.getActiveCount() };
    });
    assert.ok(chamas.taxa > 0 && chamas.particulas > 0, 'chamas da subida devem aparecer mesmo quando a janela passa entre desenhos');
    await page.screenshot({ path: path.join(root, `.browser-check/efeitos-chamas${safari ? '-webkit' : ''}.png`) });
    const focus = await page.evaluate(() => {
      r3d.limpar(); const s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta';
      s.p[0].x = 80 * KOSim.U; s.p[1].x = 300 * KOSim.U; r3d.desenhar(s);
      for (let q = 0; q < 100; q++) { KOSim.passo(s, [KOSim.B.F, 0]); r3d.eventos(s.ev, s); }
      r3d.desenhar(s); return cenaTeste().particleSystems.find(p => p.name === 'golpe-aura-0').getActiveCount();
    });
    assert.ok(focus > 0, 'chamas do Focus máximo também sobrevivem à janela pulada');
    await page.screenshot({ path: path.join(root, `.browser-check/efeitos-focus${safari ? '-webkit' : ''}.png`) });
    const queda = await page.evaluate(() => {
      r3d.limpar(); const s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); s.fase = 'luta';
      s.p[0].estado = 'caido'; s.p[0].t = 0; r3d.desenhar(s);
      for (let q = 0; q < 40; q++) { KOSim.passo(s, [0, 0]); r3d.eventos(s.ev, s); }
      r3d.desenhar(s); const onda = cenaTeste().getMeshByName('sf4-onda-chao-0');
      return onda.isEnabled() && onda.visibility > 0;
    });
    assert.ok(queda, 'poeira da queda deve aparecer mesmo quando o contato passou entre desenhos');
    await page.evaluate(() => r3d.limpar());
    assert.equal(await page.evaluate(() => cenaTeste().particleSystems.find(p => p.name === 'golpe-aura-0').emitRate), 0, 'limpar encerra as chamas pendentes');
    assert.deepEqual(erros, []);
    console.log('OK: impactos e chamas visíveis após vários passos acumulados.', { impactos, chamas });
    await page.screenshot({ path: path.join(root, `.browser-check/efeitos-quadros-lentos${safari ? '-webkit' : ''}.png`) });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
