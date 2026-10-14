// Executar da raiz: node laravel/tests/browser/mobile.cjs
// Ferramenta opcional: npm install --prefix .browser-check --no-package-lock playwright
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const temp = path.join(root, '.browser-check');
const banco = path.join(temp, 'mobile.sqlite');
fs.mkdirSync(temp, { recursive: true });
fs.writeFileSync(banco, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'true', APP_KEY: 'base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', APP_URL: 'http://127.0.0.1:8017', DB_URL: '', DB_CONNECTION: 'sqlite', DB_DATABASE: banco, SESSION_DRIVER: 'file', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file', KO_RELAY_HOST: '127.0.0.1', KO_RELAY_PORTA: '6017', KO_RELAY_URL: 'ws://127.0.0.1:6017' };
const migration = spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: path.join(root, 'laravel'), env, encoding: 'utf8' });
assert.equal(migration.status, 0, migration.stderr + migration.stdout);
const processos = [
  spawn('php', ['-S', '127.0.0.1:8017', path.join(root, 'laravel/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: path.join(root, 'public'), env, windowsHide: true }),
  spawn('php', ['artisan', 'ko:relay'], { cwd: path.join(root, 'laravel'), env, windowsHide: true }),
];
for (const p of processos) { p.stdout.resume(); p.stderr.resume(); }
const sleep = (n) => new Promise((r) => setTimeout(r, n));
let browser;
(async () => {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(env.APP_URL)).ok) break; } catch {} await sleep(100); }
  browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const options = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const contextos = await Promise.all([browser.newContext(options), browser.newContext(options)]);
  const paginas = await Promise.all(contextos.map((c) => c.newPage()));
  const erros = [];
  paginas.forEach((p) => { p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && m.text().includes('K.O:')) erros.push(m.text()); }); });
  const apelidos = ['TesteTouchA', 'TesteTouchB'];
  for (let i = 0; i < 2; i++) {
    await paginas[i].goto(env.APP_URL);
    assert.equal(await paginas[i].getByRole('dialog').isVisible(), true);
    if (i === 0) {
      await paginas[i].locator('#senha-amigos').fill('o.k');
      await paginas[i].getByRole('button', { name: 'Desbloquear arena' }).tap();
      await paginas[i].getByText('Senha incorreta.', { exact: false }).waitFor();
      await paginas[i].screenshot({ path: path.join(temp, 'acesso-amigos-mobile.png') });
    }
    await paginas[i].locator('#senha-amigos').fill('O.K');
    await paginas[i].getByRole('button', { name: 'Desbloquear arena' }).tap();
    await paginas[i].locator('#apelido').fill(apelidos[i]);
    await paginas[i].locator('#pin').fill('0123');
    await paginas[i].getByRole('button', { name: 'Entrar e jogar' }).tap();
    await paginas[i].getByRole('button', { name: 'Criar sala' }).waitFor();
  }
  const [host, convidado] = paginas;
  await host.locator('.elenco-poster img').evaluateAll(async imgs => Promise.all(imgs.map(i => i.decode())));
  const fundo = await host.locator('.elenco-poster img').evaluateAll(imgs => imgs.map(i => ({ id: i.dataset.lutador, x: i.getBoundingClientRect().x, y: i.getBoundingClientRect().y })));
  assert.equal(fundo.length, 18);
  assert.equal(new Set(fundo.map(i => i.id)).size, 18);
  assert.ok(new Set(fundo.map(i => Math.round(i.x))).size >= 6, 'CSP não pode empilhar personagens');
  assert.ok(new Set(fundo.map(i => Math.round(i.y))).size >= 3);
  await host.screenshot({ path: path.join(temp, 'menu-batalha-mobile.png') });
  await host.getByRole('button', { name: 'Criar sala' }).tap();
  await host.waitForURL('**/sala/*');
  const codigo = new URL(host.url()).pathname.split('/').pop();
  await host.goto(host.url() + '?teste=1#teste');
  await host.setViewportSize({ width: 390, height: 844 });
  assert.equal(await host.locator('.gire').isVisible(), false);
  assert.equal(await host.getByRole('link', { name: 'Voltar', exact: true }).isVisible(), true);
  await host.setViewportSize({ width: 844, height: 390 });
  await convidado.locator('#codigo').fill(codigo.toLowerCase());
  await convidado.getByRole('button', { name: 'Entrar', exact: true }).tap();
  await convidado.waitForURL('**/sala/*');
  await convidado.goto(convidado.url() + '?teste=1#teste');
  for (const p of paginas) await p.locator('.carta[data-id="pipoca"]').waitFor();
  await host.locator('.carta[data-id="pipoca"]').tap();
  await convidado.locator('.carta[data-id="uivo"]').tap();
  await host.locator('#pronto').tap();
  await convidado.locator('#pronto').tap();
  for (const p of paginas) await p.waitForFunction(() => window.KOTeste?.luta()?.s.fase === 'luta');
  console.log('PASS: login e sala em dois navegadores mobile, toques únicos e início da luta');
  const dir = await host.locator('#direcional').boundingBox();
  const x = dir.x + dir.width * 0.8, y = dir.y + dir.height / 2;
  const cdp = await contextos[0].newCDPSession(host);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(200);
  await host.screenshot({ path: path.join(temp, 'analogico-mobile.png') });
  assert.notEqual(await host.locator('#direcional').evaluate((el) => getComputedStyle(el.querySelector('.analogico')).transform), 'matrix(1, 0, 0, 1, 0, 0)');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await host.locator('#direcional').getAttribute('data-dir'), '');
  await host.evaluate(() => {
    window.gritosTeste = [];
    const original = KOVoz.grito;
    KOVoz.grito = (...args) => { window.gritosTeste.push(args[1]); return original(...args); };
  });
  const soco = await host.locator('.b-soco').boundingBox();
  await host.touchscreen.tap(soco.x + soco.width / 2, soco.y + soco.height / 2);
  await host.waitForFunction(() => window.gritosTeste.includes('pipoca'));
  console.log('PASS: toque de soco aciona o grito próprio do lutador no motor de áudio real');
  const chute = await host.locator('.b-chute').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x, y, id: 1 },
    { x: soco.x + soco.width / 2, y: soco.y + soco.height / 2, id: 2 },
    { x: chute.x + chute.width / 2, y: chute.y + chute.height / 2, id: 3 },
  ] });
  assert.equal(await host.locator('.b.apertado').count(), 2);
  assert.equal(await host.locator('.b-soco').evaluate((el) => getComputedStyle(el).transform), 'none');
  assert.match(await host.locator('#direcional').getAttribute('data-dir'), /d/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await host.locator('.b.apertado').count(), 0);
  console.log('PASS: três dedos simultâneos, movimento + dois golpes sem deslocar os botões');
  await host.locator('#pausa').tap();
  await host.getByRole('button', { name: 'Voltar para a luta' }).tap();
  console.log('PASS: analógico acompanha o dedo, solta ao levantar e menu responde a um toque');
  await host.evaluate(() => KOTeste.rede().ws.close());
  await host.waitForFunction(() => KOTeste.rede().aberto && KOTeste.rede().outroAqui);
  const antes = await host.evaluate(() => KOTeste.luta().s.f);
  await host.waitForFunction((f) => KOTeste.luta().s.f > f + 60, antes);
  assert.equal(await host.evaluate(() => !!KOTeste.luta().dessincronizou), false);
  console.log('PASS: queda de WebSocket e reconexão retomam a luta sem divergência');
  const antesInvalida = await host.evaluate(() => KOTeste.luta().s.f);
  await convidado.evaluate(() => {
    const ws = KOTeste.rede().ws, n = KOTeste.luta().numero;
    ws.send(JSON.stringify({ t: 'reenvia', n, de: 'inválido' }));
    ws.send(JSON.stringify({ t: 'i', n: n + 1, f: KOTeste.luta().s.f, b: 255 }));
  });
  await host.waitForFunction((f) => KOTeste.luta().s.f > f + 30, antesInvalida);
  console.log('PASS: mensagem malformada e comando de outra partida são ignorados');
  // Mesmo cenário terminal nos dois clientes permite conferir persistência e revanche sem esperar 99s.
  for (const p of paginas) await p.evaluate(() => { KOTeste.luta().pausado = true; });
  const f = Math.max(...await Promise.all(paginas.map((p) => p.evaluate(() => KOTeste.luta().s.f)))) + 20;
  for (const p of paginas) await p.evaluate((f) => {
    const l = KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'uivo'] });
    s.f = f; s.fase = 'luta'; s.rounds = [1, 0]; s.p[1].vida = 0;
    l.s = s; l.hashes = {}; l.entradas = [[], []]; l.minhas = [];
    for (let n = f; n < f + l.atraso; n++) { l.entradas[0][n] = l.entradas[1][n] = l.minhas[n] = 0; }
    l.recebidoAte = f + l.atraso - 1;
  }, f);
  for (const p of paginas) await p.evaluate(() => { KOTeste.luta().pausado = false; });
  for (const p of paginas) await p.waitForFunction(() => KOTeste.luta()?.resultadoSalvo === true, null, { timeout: 25000 });
  const vencedor = host.locator('[data-vencedor="pipoca"]');
  await vencedor.waitFor();
  await vencedor.evaluate(i => i.decode());
  assert.match(await vencedor.getAttribute('src'), /pipoca-v1\.webp$/);
  await host.screenshot({ path: path.join(temp, 'vitoria-mobile.png') });
  await host.getByRole('button', { name: 'Revanche', exact: true }).tap();
  await convidado.getByRole('button', { name: /Aceitar revanche|Revanche/ }).tap();
  for (const p of paginas) await p.locator('#pronto').waitFor();
  console.log('PASS: resultado confirmado no ranking e revanche volta à seleção');
  await host.screenshot({ path: path.join(temp, 'selecao-mobile.png') });
  await host.goto(env.APP_URL);
  await host.getByRole('button', { name: 'Sair da conta' }).tap();
  await host.locator('#apelido').fill(apelidos[1]);
  await host.locator('#pin').fill('0123');
  await host.getByRole('button', { name: 'Entrar e jogar' }).tap();
  await host.getByRole('button', { name: 'Criar sala' }).waitFor();
  assert.match(await host.locator('.ola').textContent(), /TesteTouchB/);
  console.log('PASS: apelido e PIN acessam a mesma conta em outro navegador');
  await host.addInitScript(() => {
    window.padsTeste = [0, 1].map((index) => ({ index, id: 'Controle teste', connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }));
    Object.defineProperty(navigator, 'getGamepads', { value: () => window.padsTeste });
  });
  await host.goto(env.APP_URL + '/jogar/versus#teste');
  await host.evaluate(() => { padsTeste.forEach((p) => { p.buttons[2].pressed = true; }); });
  await sleep(100);
  await host.evaluate(() => { padsTeste.forEach((p) => { p.buttons[2].pressed = false; }); });
  await host.locator('.carta[data-id="pipoca"]').tap(); await host.locator('#pronto').tap();
  await host.locator('.carta[data-id="uivo"]').tap(); await host.locator('#pronto').tap();
  await host.waitForFunction(() => KOTeste.luta()?.s.fase === 'luta');
  const posicoes = await host.evaluate(() => KOTeste.luta().s.p.map((p) => p.x));
  await host.evaluate(() => { padsTeste[0].axes[0] = -1; padsTeste[1].axes[0] = 1; });
  await sleep(200);
  const depois = await host.evaluate(() => KOTeste.luta().s.p.map((p) => p.x));
  assert.ok(depois[0] < posicoes[0]); assert.ok(depois[1] > posicoes[1]);
  await host.evaluate(() => { padsTeste[1].connected = false; });
  await host.locator('.painel-pausa').waitFor();
  assert.equal(await host.evaluate(() => KOTeste.luta().pausado), true);
  await host.evaluate(() => { padsTeste[1].connected = true; padsTeste.forEach((p) => { p.axes[0] = 0; }); });
  await sleep(100);
  assert.equal(await host.evaluate(() => KOTeste.luta().pausado), true);
  await host.getByRole('button', { name: 'Voltar para a luta' }).tap();
  assert.equal(await host.evaluate(() => KOTeste.luta().pausado), false);
  console.log('PASS: dois controles independentes, pausa na desconexão e retomada manual');
  async function pressionar(indice, botao) {
    await host.evaluate(([i, b]) => { padsTeste[i].buttons[b].pressed = true; }, [indice, botao]);
    await sleep(80);
    await host.evaluate(([i, b]) => { padsTeste[i].buttons[b].pressed = false; }, [indice, botao]);
    await sleep(80);
  }
  await pressionar(1, 9);
  await host.locator('.painel-pausa').waitFor();
  await pressionar(0, 9);
  assert.equal(await host.locator('.painel-pausa').count(), 0);
  // Troca de lutadores precisa reiniciar a seleção dos dois jogadores.
  await host.goto(env.APP_URL + '/jogar/versus?controles=1#teste');
  await pressionar(0, 2); await pressionar(1, 2);
  await pressionar(0, 15);
  assert.equal(await host.evaluate(() => document.activeElement.dataset.id), 'pipoca');
  await pressionar(0, 0);
  assert.equal(await host.locator('#pronto').isDisabled(), false);
  // A navegação espacial segue a linha da grade, sem saltar direto para o rodapé.
  await pressionar(0, 15);
  assert.notEqual(await host.evaluate(() => document.activeElement.dataset.id), undefined);
  await host.locator('#ajustar-controles').tap();
  await pressionar(0, 15);
  assert.equal(await host.locator('.painel-controle button:focus').count(), 1);
  await host.locator('[data-fechar]').tap();
  await host.locator('.carta[data-id="pipoca"]').tap(); await host.locator('#pronto').tap();
  assert.match(await host.locator('#pronto').textContent(), /2P/);
  await host.locator('.carta[data-id="uivo"]').tap(); await host.locator('#pronto').tap();
  await host.waitForFunction(() => KOTeste.luta()?.s.fase === 'luta');
  console.log('PASS: menu aceita ambos os controles, foco na grade e configuração navegável');
  for (const nivel of ['facil', 'medio', 'dificil']) {
    await host.goto(env.APP_URL + '/jogar/cpu?nivel=' + nivel + '#teste');
    await host.locator('[data-nivel="' + nivel + '"]').tap();
    assert.equal(await host.locator('[data-nivel="' + nivel + '"]').getAttribute('aria-pressed'), 'true');
    await host.locator('.carta[data-id="pipoca"]').tap(); await host.locator('#pronto').tap();
    await host.locator('.carta[data-id="pipoca"]').tap(); await host.locator('#pronto').tap(); // lutadora da máquina
    await host.waitForFunction(() => KOTeste.luta()?.s.fase === 'luta');
    assert.equal(await host.evaluate(() => KOTeste.luta().dificuldade), nivel);
    assert.equal(await host.evaluate(() => typeof KOTeste.luta().cpu), 'function');
  }
  console.log('PASS: fácil, médio e difícil selecionam e iniciam partidas contra CPU');
  // Matriz visual controlada: cenários e vencedores, sem simular partidas completas extras.
  const cenarios = await host.evaluate(() => Object.keys(KOArte.CENARIOS));
  await host.evaluate(() => { KOTeste.luta().pausado = true; });
  for (const cenario of cenarios) {
    await host.evaluate(c => { KOArte.cenario(c); }, cenario);
    if (cenario === 'academia') await sleep(300);
    await host.screenshot({ path: path.join(temp, 'arena-' + cenario + '.png') });
  }
  const elenco = JSON.parse(fs.readFileSync(path.join(root, 'art/premium/elenco/manifesto.json'), 'utf8')).filter(p => p.status === 'conceito do lutador existente');
  for (const personagem of elenco) {
    await host.evaluate(id => {
      const l = KOTeste.luta(), s = KOSim.novo({ lutadores: [id, 'uivo'] });
      s.fase = 'fim'; s.vencedor = 0; s.rounds = [2, 0];
      l.s = s; l.fimEm = 0; l.pausado = false;
    }, personagem.id);
    const arte = host.locator('[data-vencedor="' + personagem.id + '"]');
    await arte.waitFor(); await arte.evaluate(i => i.decode());
    assert.ok((await arte.getAttribute('src')).endsWith(personagem.arte.replace('.png', '.webp')));
    const caixa = await arte.boundingBox();
    assert.ok(caixa.x >= 0 && caixa.y >= 0 && caixa.x + caixa.width <= 845 && caixa.y + caixa.height <= 391, personagem.id + ': imagem fora da tela');
    await host.screenshot({ path: path.join(temp, 'vencedor-' + personagem.id + '.png') });
  }
  console.log('PASS: seis cenários renderizados e 16 vencedores com versões atuais dentro da tela');
  assert.deepEqual(erros, []);
  console.log('PASS: nenhum erro JavaScript ou divergência de simulação');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  processos.forEach((p) => p.kill());
});
