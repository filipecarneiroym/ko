// Jogo de verdade com gráficos 3D: servidor Laravel, acesso, partida contra a
// máquina com a Pipoca (3D carrega, luta anda, golpes acertam) e reserva 2D
// quando o lutador não tem modelo 3D.
//   node laravel/tests/browser/jogo-3d.cjs
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const temp = path.join(root, '.browser-check');
const saida = path.join(root, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/jogo');
fs.mkdirSync(saida, { recursive: true });
const banco = path.join(temp, 'jogo3d.sqlite');
fs.writeFileSync(banco, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'true', APP_KEY: 'base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', APP_URL: 'http://127.0.0.1:8019', DB_URL: '', DB_CONNECTION: 'sqlite', DB_DATABASE: banco, SESSION_DRIVER: 'file', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file', KO_RELAY_HOST: '127.0.0.1', KO_RELAY_PORTA: '6019', KO_RELAY_URL: 'ws://127.0.0.1:6019' };
const migracao = spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: path.join(root, 'laravel'), env, encoding: 'utf8' });
assert.equal(migracao.status, 0, migracao.stderr + migracao.stdout);
const servidor = spawn('php', ['-S', '127.0.0.1:8019', path.join(root, 'laravel/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: path.join(root, 'public'), env, windowsHide: true });
servidor.stdout.resume(); servidor.stderr.resume();
const sleep = n => new Promise(r => setTimeout(r, n));
let browser;
(async () => {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(env.APP_URL)).ok) break; } catch {} await sleep(100); }
  browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = [];
  page.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', m => { if (m.type() === 'error') { erros.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
  await page.goto(env.APP_URL);
  await page.locator('#senha-amigos').fill('O.K');
  await page.getByRole('button', { name: 'Desbloquear arena' }).click();
  await page.locator('#apelido').fill('Teste3D');
  await page.locator('#pin').fill('0123');
  await page.getByRole('button', { name: 'Entrar e jogar' }).click();
  await page.getByRole('button', { name: 'Criar sala' }).waitFor();

  async function partida(lutador, nome) {
    await page.goto(env.APP_URL + '/'); // mesma URL com hash não recarregaria
    await page.goto(env.APP_URL + '/jogar/cpu#teste');
    await page.locator(`.carta[data-id="${lutador}"]`).click();
    await page.locator('#pronto').click();
    // Espera a luta começar (3D carregado quando houver).
    await page.waitForFunction(() => window.KOTeste?.luta()?.s?.fase === 'luta' && !window.KOTeste.luta().carregando3d, null, { timeout: 180000 });
    const em3d = await page.evaluate(() => document.body.classList.contains('graficos-3d') && !!window.KOTeste.luta().r3d);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(saida, `${nome}-inicio.png`) });
    // Aproxima (o renderizador por software do teste roda a poucos FPS) e ataca
    // até acertar.
    await page.evaluate(() => { const s = window.KOTeste.luta().s; s.p[0].x = 160 * 16; s.p[1].x = 186 * 16; });
    const inicio = Date.now();
    while (Date.now() - inicio < 90000 && !(await page.evaluate(() => window.KOTeste.luta().s.p.some(p => p.vida < 950)))) {
      for (const tecla of ['KeyJ', 'KeyK']) { await page.keyboard.down(tecla); await page.waitForTimeout(400); await page.keyboard.up(tecla); await page.waitForTimeout(400); }
    }
    await page.screenshot({ path: path.join(saida, `${nome}-golpes.png`) });
    console.log(nome, 'posições', await page.evaluate(() => window.KOTeste.luta().s.p.map(p => ({ x: Math.round(p.x / 16), face: p.face, vida: p.vida }))));
    await page.waitForTimeout(1500);
    const vidas = await page.evaluate(() => window.KOTeste.luta().s.p.map(p => p.vida));
    await page.screenshot({ path: path.join(saida, `${nome}-depois.png`) });
    return { em3d, vidas };
  }

  const pipoca = await partida('pipoca', 'pipoca-3d');
  console.log('Pipoca:', pipoca);
  assert.equal(pipoca.em3d, true, 'Pipoca × máquina usa gráficos 3D');
  assert.ok(pipoca.vidas.some(v => v < 950), 'Houve troca de golpes');
  const outro = await partida('uivo', 'uivo-2d');
  console.log('Uivo:', outro);
  assert.equal(outro.em3d, false, 'Sem modelo 3D: luta em 2D');
  assert.deepEqual(erros, []);
  console.log('OK jogo 3D');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); servidor.kill(); });
