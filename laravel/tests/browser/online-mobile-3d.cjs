// Dois navegadores independentes com a Lola publicada: sala, luta, reconexão e resultado.
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const saida = path.join(root, '.browser-check/online-mobile-3d'); fs.mkdirSync(saida, { recursive: true });
const banco = path.join(saida, 'online.sqlite'); fs.writeFileSync(banco, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'true', APP_KEY: 'base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', APP_URL: 'http://127.0.0.1:8026', DB_URL: '', DB_CONNECTION: 'sqlite', DB_DATABASE: banco, SESSION_DRIVER: 'file', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file', KO_RELAY_HOST: '127.0.0.1', KO_RELAY_PORTA: '6026', KO_RELAY_URL: 'ws://127.0.0.1:6026' };
const m = spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: path.join(root, 'laravel'), env, encoding: 'utf8', windowsHide: true });
assert.equal(m.status, 0, m.stdout + m.stderr);
const processos = [
  spawn('php', ['-S', '127.0.0.1:8026', path.join(root, 'laravel/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: path.join(root, 'public'), env, windowsHide: true }),
  spawn('php', ['artisan', 'ko:relay'], { cwd: path.join(root, 'laravel'), env, windowsHide: true }),
];
for (const p of processos) { p.stdout.resume(); p.stderr.resume(); }
let browser;
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(env.APP_URL)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const contextos = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' })));
  const paginas = await Promise.all(contextos.map(c => c.newPage())), [host, convidado] = paginas;
  const erros = [];
  for (const p of paginas) { p.setDefaultTimeout(60000); p.setDefaultNavigationTimeout(90000); p.on('pageerror', e => erros.push(e.message)); }
  for (let i = 0; i < 2; i++) {
    await paginas[i].goto(env.APP_URL); await paginas[i].locator('#apelido').fill('RevisaoOnline' + i);
    await paginas[i].locator('#pin').fill('0123'); await paginas[i].getByRole('button', { name: 'Entrar e jogar' }).click();
    await paginas[i].locator('.modos-jogo').waitFor();
  }
  await host.locator('.online-opcoes summary').click(); await host.getByRole('button', { name: 'Criar sala' }).click();
  await host.waitForURL('**/sala/*'); const codigo = new URL(host.url()).pathname.split('/').pop();
  await host.goto(env.APP_URL + '/sala/' + codigo + '?revisao=1#teste');
  await convidado.goto(env.APP_URL + '/?sala=' + codigo);
  assert.equal(await convidado.locator('#codigo').inputValue(), codigo);
  await convidado.getByRole('button', { name: 'Entrar', exact: true }).click();
  await convidado.waitForURL('**/sala/*'); await convidado.goto(env.APP_URL + '/sala/' + codigo + '?revisao=1#teste');
  for (const p of paginas) {
    await p.locator('.carta[data-id="pipoca"]').waitFor();
    assert.equal(await p.locator('.carta[data-id]').count(), 1);
    await p.locator('#pronto').click();
  }
  for (const p of paginas) await p.waitForFunction(() => KOTeste.luta()?.s.fase === 'luta' && !!KOTeste.luta().r3d && !KOTeste.luta().carregando3d, null, { timeout: 240000 });
  console.log('OK: dois logins, convite, escolha da Lola e luta online 3D.');
  await host.waitForFunction(() => KOTeste.luta().s.f > 180, null, { timeout: 180000 });
  for (const p of paginas) assert.equal(await p.evaluate(() => !!KOTeste.luta().dessincronizou), false);
  await host.evaluate(() => { window.__socketAnterior = KOTeste.rede().ws; window.__socketAnterior.close(); });
  await host.waitForFunction(() => KOTeste.rede().ws !== window.__socketAnterior && KOTeste.rede().aberto && KOTeste.rede().outroAqui, null, { timeout: 60000 });
  const antes = await host.evaluate(() => KOTeste.luta().s.f);
  await host.waitForFunction(f => KOTeste.luta().s.f > f + 12, antes, { timeout: 60000 });
  for (const p of paginas) assert.equal(await p.evaluate(() => !!KOTeste.luta().dessincronizou), false);
  console.log('OK: reconexão retoma o avanço sem divergência.');
  // Cenário terminal igual nos dois clientes: testa persistência e revanche.
  // Os encerramentos naturais por golpe/tempo são cobertos separadamente.
  for (const p of paginas) await p.evaluate(() => { KOTeste.luta().pausado = true; });
  const quadro = Math.max(...await Promise.all(paginas.map(p => p.evaluate(() => KOTeste.luta().s.f)))) + 40;
  for (const p of paginas) await p.evaluate(f => {
    const l = KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'] });
    Object.assign(s, { f, fase: 'acaba', fT: 10000, vencedor: 0, vencedorRound: 0, rounds: [2, 0] });
    s.p[1].vida = 0; s.p[1].estado = 'tonto';
    l.s = s; l.hashes = {}; l.entradas = [[], []]; l.minhas = []; l.sobra = 0;
    for (let n = f; n < f + l.atraso; n++) l.entradas[0][n] = l.entradas[1][n] = l.minhas[n] = 0;
    l.recebidoAte = f + l.atraso - 1;
  }, quadro);
  for (const p of paginas) await p.evaluate(() => { KOTeste.luta().pausado = false; });
  for (const p of paginas) await p.waitForFunction(() => KOTeste.luta()?.resultadoSalvo === true, null, { timeout: 60000 });
  await host.screenshot({ path: path.join(saida, 'resultado-online.png') });
  await host.getByRole('button', { name: 'Revanche', exact: true }).click();
  await convidado.getByRole('button', { name: /Aceitar revanche|Revanche/ }).click();
  for (const p of paginas) await p.locator('.carta[data-id="pipoca"]').waitFor();
  assert.deepEqual(erros, []);
  console.log('OK: resultado confirmado pelos dois jogadores e revanche volta à seleção.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); processos.forEach(p => p.kill()); });
