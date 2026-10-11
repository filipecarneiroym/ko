const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.setContent('<style>body{margin:0;background:#0b0614}canvas{width:960px;height:540px}</style><canvas></canvas>');
    for (const f of ['ko-sim.js', 'ko-arte.js']) await page.addScriptTag({ path: path.join(root, 'public/js', f) });
    for (const reduzido of [false, true]) {
      await page.emulateMedia({ reducedMotion: reduzido ? 'reduce' : 'no-preference' });
      const resultado = await page.evaluate(() => {
        const K = window.KOSim, A = window.KOArte;
        A.iniciar(document.querySelector('canvas')); A.cenario(Object.keys(A.CENARIOS)[0]); A.limparAvisos();
        const s = K.novo({ lutadores: ['pipoca', 'uivo'] }); s.fase = 'luta';
        const antes = JSON.stringify(s);
        for (let i = 0; i < 100; i++) A.eventos(s, [{ t: 'acerto', forte: i % 3, x: (170 + i % 30) * K.U, y: 40 * K.U }], ['A', 'B']);
        A.eventos(s, [{ t: 'defendeu', x: 240 * K.U, y: 40 * K.U }], ['A', 'B']);
        A.desenhar(s, { nomes: ['Pipoca', 'Uivo'] });
        window.estadoEfeito = s;
        return { intacto: antes === JSON.stringify(s), pixels: document.querySelector('canvas').toDataURL().length };
      });
      assert.equal(resultado.intacto, true, 'Efeitos não podem mudar a simulação');
      assert.ok(resultado.pixels > 1000);
      await page.screenshot({ path: path.join(root, '.browser-check', `impactos-${reduzido ? 'reduzido' : 'normal'}.png`) });
      await page.evaluate(() => { for (let i = 0; i < 50; i++) KOArte.desenhar(window.estadoEfeito, { nomes: ['Pipoca', 'Uivo'] }); KOArte.limparAvisos(); });
      console.log(`PASS efeitos ${reduzido ? 'reduzidos' : 'normais'}: rajada de eventos, renderização e simulação intacta`);
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
