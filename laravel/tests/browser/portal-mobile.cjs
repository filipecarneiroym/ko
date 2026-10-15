// Fluxos reais de entrada, menu e seleção nas duas orientações, sem iniciar a luta.
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const saida = path.join(root, '.browser-check/portal'); fs.mkdirSync(saida, { recursive: true });
const banco = path.join(saida, 'portal.sqlite'); fs.writeFileSync(banco, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'true', APP_KEY: 'base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', APP_URL: 'http://127.0.0.1:8024', DB_URL: '', DB_CONNECTION: 'sqlite', DB_DATABASE: banco, SESSION_DRIVER: 'file', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file' };
const migracao = spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: path.join(root, 'laravel'), env, encoding: 'utf8', windowsHide: true });
assert.equal(migracao.status, 0, migracao.stdout + migracao.stderr);
const server = spawn('php', ['-S', '127.0.0.1:8024', path.join(root, 'laravel/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: path.join(root, 'public'), env, windowsHide: true });
server.stdout.resume(); server.stderr.resume();
let browser;
const tamanhos = [[320, 568], [390, 844], [430, 932], [568, 320], [844, 390], [915, 412], [1280, 800]];
async function conferir(page, tela, width, height) {
  await page.evaluate(async () => { await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const medidas = await page.evaluate(() => ({ largura: document.documentElement.scrollWidth, tela: innerWidth }));
  assert.ok(medidas.largura <= medidas.tela + 1, `${tela} ${width}x${height}: sem rolagem horizontal`);
  const botoes = await page.locator('a, button, input:not([type=hidden]), summary').evaluateAll(ns => ns.filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden').map(n => { const r = n.getBoundingClientRect(); return { nome: n.textContent.trim() || n.id, x: r.x, direita: r.right, h: r.height }; }));
  for (const b of botoes) {
    assert.ok(b.x >= -1 && b.direita <= width + 1, `${tela}: ${b.nome} dentro da largura`);
    assert.ok(b.h >= 43, `${tela}: ${b.nome} tem alvo de toque de 44px (${b.h})`);
  }
  await page.screenshot({ path: path.join(saida, `${tela}-${width}x${height}.png`), fullPage: true });
}
(async () => {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(env.APP_URL)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const context = await browser.newContext({ isMobile: true, hasTouch: true });
  const page = await context.newPage(), erros = [];
  page.on('pageerror', e => erros.push(e.message));
  for (const [width, height] of tamanhos) {
    await page.setViewportSize({ width, height }); await page.goto(env.APP_URL);
    assert.equal(await page.locator('#senha-amigos, .elenco-poster').count(), 0);
    await conferir(page, 'entrada', width, height);
  }
  await page.locator('#apelido').fill('FilipeLayout'); await page.locator('#pin').fill('0123');
  await page.getByRole('button', { name: 'Entrar e jogar' }).click(); await page.locator('.modos-jogo').waitFor();
  for (const [width, height] of tamanhos) {
    await page.setViewportSize({ width, height }); await page.goto(env.APP_URL);
    await conferir(page, 'menu', width, height);
    await page.locator('.online-opcoes summary').focus();
    await page.evaluate(() => KOControle.navegar(document.body, { pulso: 0, confirmarClicado: true }));
    assert.ok(await page.getByRole('button', { name: 'Criar sala' }).isVisible());
    await conferir(page, 'menu-online', width, height);
    await page.goto(env.APP_URL + '/jogar/cpu'); await page.locator('.carta[data-id="pipoca"]').waitFor();
    assert.equal(await page.locator('.carta[data-id]').count(), 1);
    assert.equal(await page.locator('#pronto').isEnabled(), true, 'Lola selecionada inicialmente');
    await conferir(page, 'selecao', width, height);
    const r = await page.locator('#pronto').boundingBox(); assert.ok(r.y >= 0 && r.y + r.height <= height, 'confirmar visível sem rolagem');
    await page.locator('#ajustar-controles').click(); await page.locator('[data-fechar]').click();
    await page.locator('.voltar-menu').click(); await page.locator('.modos-jogo').waitFor();
  }
  await page.goto(env.APP_URL + '/?sala=AB12'); assert.equal(await page.locator('#codigo').inputValue(), 'AB12');
  assert.ok(await page.locator('#codigo').isVisible());
  await page.getByRole('button', { name: 'Sair da conta' }).click(); await page.locator('#apelido').waitFor();
  assert.equal(erros.length, 0, erros.join('\n'));
  console.log('OK: entrada pública, login, convite, menu, seleção, controles e saída; sete telas, retrato/paisagem, sem cortes laterais.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });
