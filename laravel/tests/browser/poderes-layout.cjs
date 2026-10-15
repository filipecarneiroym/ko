// Usa os controles reais da view e o CSS publicado, sem carregar o 3D.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const css = fs.readFileSync(path.join(root, 'public/css/ko.css'), 'utf8');
    const view = fs.readFileSync(path.join(root, 'laravel/resources/views/jogo.blade.php'), 'utf8');
    const controles = view.slice(view.indexOf('<div id="controles"'), view.indexOf('<div id="painel"'))
      .replace(' hidden', '').replace(/\{\{--[\s\S]*?--\}\}/g, '');
    const page = await browser.newPage();
    const tamanhos = [[480, 240], [568, 320], [667, 375], [844, 390], [915, 412], [1280, 720]];
    for (const [width, height] of tamanhos) for (const modo of ['', 'com-controle', 'versus-local']) {
      await page.setViewportSize({ width, height });
      await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body class="corpo-jogo em-luta ${modo}"><div class="jogo">${controles}</div></body>`);
      const botoes = await page.locator('[data-b], #pausa').evaluateAll(ns => ns.filter(n => n.getClientRects().length).map(n => {
        const r = n.getBoundingClientRect();
        return { nome: n.dataset.b || n.textContent.trim(), combo: n.querySelector('small')?.textContent, x: r.x, y: r.y, w: r.width, h: r.height, cor: getComputedStyle(n).color, textoCabe: n.scrollWidth <= n.clientWidth };
      }));
      for (const b of botoes) {
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height, `${width}x${height}: ${b.nome} dentro da tela`);
        assert.ok(b.w >= 44 && b.h >= 44, `${b.nome}: alvo de toque de pelo menos 44px`);
      }
      const poderes = botoes.filter(b => ['EX', 'SUPER', 'ULTRA'].includes(b.nome));
      assert.equal(poderes.length, 3);
      const pausa = botoes.find(b => b.nome === '❚❚');
      assert.ok(Math.abs((poderes[0].x + poderes[2].x + poderes[2].w) / 2 - width / 2) < 1, 'atalhos centralizados na arena');
      assert.ok(poderes.every(p => p.y + p.h + 10 <= pausa.y), 'atalhos acima da pausa com espaço livre');
      for (const p of poderes) {
        assert.equal(p.combo, { EX: 'SP + P', SUPER: 'SP + K', ULTRA: 'SP + F' }[p.nome]);
        assert.ok(p.textoCabe && p.cor !== 'rgb(0, 0, 0)', `${p.nome}: texto legível e inteiro`);
        for (const b of botoes.filter(b => b !== p)) assert.ok(p.x + p.w <= b.x || b.x + b.w <= p.x || p.y + p.h <= b.y || b.y + b.h <= p.y, `${p.nome} não sobrepõe ${b.nome}`);
      }
      if (width === 568) await page.screenshot({ path: path.join(root, '.browser-check/poderes-568x320.png') });
    }
    console.log('OK EX/SUPER/ULTRA: seis tamanhos, dentro da tela, texto completo, sem sobrepor os golpes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
