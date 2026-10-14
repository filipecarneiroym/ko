const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { criarGlbDeTeste } = require('./fixtures/glb.cjs');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const temp = path.join(root, '.browser-check');
const banco = path.join(temp, 'laboratorio-http.sqlite');
const origem = 'http://127.0.0.1:8027';
const env = {
  ...process.env, APP_ENV: 'testing', APP_DEBUG: 'true',
  APP_KEY: 'base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
  APP_URL: origem, DB_URL: '', DB_CONNECTION: 'sqlite', DB_DATABASE: banco,
  SESSION_DRIVER: 'file', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file',
  KO_RELAY_URL: 'ws://127.0.0.1:6027', KO_SENHA_AMIGOS: 'ko',
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let servidor, browser;

(async () => {
  fs.mkdirSync(temp, { recursive: true }); fs.writeFileSync(banco, '');
  const migracao = spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: path.join(root, 'laravel'), env, encoding: 'utf8', windowsHide: true });
  assert.equal(migracao.status, 0, migracao.stderr + migracao.stdout);
  servidor = spawn('php', ['-S', '127.0.0.1:8027', path.join(root, 'laravel/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: path.join(root, 'public'), env, windowsHide: true });
  let logServidor = '';
  for (const fluxo of [servidor.stdout, servidor.stderr]) fluxo.on('data', dados => { logServidor = (logServidor + dados.toString()).slice(-4000); });
  let pronto = false;
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    if (servidor.exitCode !== null) throw new Error(logServidor || 'Servidor HTTP encerrado');
    try { if ((await fetch(origem)).ok) { pronto = true; break; } } catch {}
    await sleep(100);
  }
  assert.equal(pronto, true, 'Servidor Laravel deve iniciar na porta de teste');
  browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const contexto = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await contexto.newPage();
  const erros = [], externos = [], requisicoesImportacao = [];
  let importando = false;
  page.on('pageerror', erro => erros.push(erro.message));
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== origem) externos.push(url);
    if (importando && /^https?:/.test(url)) requisicoesImportacao.push({ metodo: request.method(), url });
  });
  await page.addInitScript(() => {
    window.__violacoesCsp = [];
    document.addEventListener('securitypolicyviolation', e => __violacoesCsp.push({ diretiva: e.effectiveDirective, recurso: e.blockedURI }));
  });

  await page.goto(origem);
  await page.locator('#senha-amigos').fill('ko');
  await page.getByRole('button', { name: 'Desbloquear arena' }).tap();
  await page.locator('#apelido').fill('TesteLabHTTP');
  await page.locator('#pin').fill('0123');
  await page.getByRole('button', { name: 'Entrar e jogar' }).tap();
  await page.getByRole('button', { name: 'Criar sala' }).waitFor();
  const resposta = await page.goto(origem + '/laboratorio/3d');
  assert.equal(resposta.status(), 200);
  const csp = resposta.headers()['content-security-policy'];
  assert.match(csp, /script-src 'self';/);
  assert.equal(csp.includes('unsafe-eval'), false, 'Shaders e carregador funcionam sem liberar eval');
  await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));
  assert.equal(await page.evaluate(() => typeof KOControle.criar), 'function', 'Laboratório carrega controles reais pelo layout');
  await page.locator('#exibir-caixas').check();
  assert.equal(await page.locator('#exibir-caixas').isChecked(), true);
  await page.evaluate(() => {
    const passo = KOSim.passo;
    window.__passosHttp = 0;
    KOSim.passo = (...args) => { __passosHttp++; return passo(...args); };
  });

  const { ESTADOS_VISUAIS } = await import(pathToFileURL(path.join(root, 'src/3d/estado-visual.mjs')).href);
  const nomes = await page.evaluate(estados => [...estados, ...Object.keys(KOSim.LUTADORES.pipoca.golpes)], ESTADOS_VISUAIS);
  await page.locator('.importar-modelo summary').tap();
  importando = true;
  await page.locator('[data-modelo="0"]').setInputFiles({ name: 'triangulo-texturizado.glb', mimeType: 'model/gltf-binary', buffer: criarGlbDeTeste(nomes, { textura: true }) });
  await page.waitForFunction(() => {
    const texto = document.querySelector('#estado-modelos').textContent;
    return texto && !texto.startsWith('Validando') && !texto.startsWith('Nenhum modelo');
  }, null, { timeout: 10000 });
  const aviso = await page.locator('#estado-modelos').textContent();
  const violacoes = await page.evaluate(() => __violacoesCsp);
  console.log(JSON.stringify({ csp, aviso, violacoes }));
  assert.match(aviso, /modelo de teste carregado/, 'PNG incorporado no GLB deve carregar sob a CSP real');
  const passos = await page.evaluate(() => __passosHttp);
  await page.waitForFunction(n => __passosHttp > n + 10, passos);
  await page.locator('[data-comando="P"]').tap();
  for (const [nome, width, height] of [['mobile', 844, 390], ['portrait', 390, 844], ['tv', 1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await sleep(650);
    const medidas = await page.evaluate(() => {
      const caixa = document.querySelector('canvas').getBoundingClientRect();
      return {
        documento: document.documentElement.scrollWidth, altura: document.body.scrollHeight,
        viewport: innerWidth, alturaViewport: innerHeight, rolagem: getComputedStyle(document.body).overflowY,
        canvas: { x: caixa.x, largura: caixa.width, altura: caixa.height },
        fps: Number(document.querySelector('#estado-3d').textContent.match(/(\d+) FPS/)?.[1]),
      };
    });
    assert.ok(medidas.documento <= medidas.viewport + 1, `${nome}: laboratório sem rolagem horizontal`);
    assert.ok(medidas.canvas.x >= 0 && medidas.canvas.x + medidas.canvas.largura <= medidas.viewport + 1, `${nome}: canvas dentro da largura da tela`);
    assert.ok(medidas.canvas.altura > 0 && Number.isFinite(medidas.fps) && medidas.fps > 0, `${nome}: renderização com dimensões e FPS válidos`);
    assert.ok(medidas.altura <= medidas.alturaViewport || medidas.rolagem !== 'hidden', `${nome}: comandos abaixo da arena acessíveis pela rolagem`);
    await page.screenshot({ path: path.join(temp, `laboratorio-http-${nome}.png`), fullPage: true });
  }
  assert.deepEqual(await page.evaluate(() => __violacoesCsp), [], 'Documento HTTP não deve bloquear texturas, scripts ou estilos');
  assert.deepEqual(externos, [], 'Modelo incorporado não solicita recursos de outros sites');
  assert.deepEqual(requisicoesImportacao, [], 'Importação local não envia o arquivo nem solicita recursos HTTP');
  assert.deepEqual(erros, []);
  console.log('PASS laboratório HTTP autenticado: CSP real, shaders, controles, caixas e GLB com PNG incorporado sem downloads externos');
})().catch(erro => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  servidor?.kill();
});
