const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';

(async () => {
  // Compilação em memória mantém o bundle publicado sob responsabilidade do build normal.
  const bundle = await build({ entryPoints: [path.join(root, 'src/3d/laboratorio.js')], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true, logLevel: 'silent' });
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 600 }, serviceWorkers: 'block' });
    const erros = [], pedidos = [];
    let falharUivo = true, falharGuarda = true, segurarDownload = false, liberar;
    page.on('pageerror', erro => erros.push(erro.message));
    await page.route(`${origem}/**`, async rota => {
      const caminho = new URL(rota.request().url()).pathname;
      if (caminho.startsWith('/modelos/')) {
        pedidos.push(caminho);
        if (segurarDownload) await new Promise(resolve => { liberar = resolve; });
        try {
          if (caminho.includes('uivo') && falharUivo) return await rota.fulfill({ status: 404, body: 'Indisponível' });
          if (caminho.startsWith('/modelos/estudos/') && falharGuarda) return await rota.fulfill({ status: 404, body: 'Indisponível' });
          return await rota.fulfill({ status: 200, contentType: 'model/gltf-binary', body: fs.readFileSync(path.join(root, 'public', caminho)) });
        } catch { return; /* O cancelamento do fetch pode encerrar a rota antes da resposta. */ }
      }
      if (caminho === '/laboratorio.js') return rota.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text });
      if (caminho === '/ko-sim.js') return rota.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'public/js/ko-sim.js')) });
      if (caminho === '/fixture.js') return rota.fulfill({ contentType: 'text/javascript', body: `
        window.__passos = 0;
        KOSim.passo = () => { __passos++; };
        const agendar = window.setTimeout.bind(window);
        window.__limiteCurto = false;
        window.setTimeout = (fn, ms, ...args) => agendar(fn, ms === 30000 && __limiteCurto ? 100 : ms, ...args);
      ` });
      if (caminho === '/style.css') return rota.fulfill({ contentType: 'text/css', body: 'body{margin:0;color:white;background:#110d21}canvas{width:844px;height:390px;display:block}button{min-height:48px}' });
      return rota.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob: data:;" }, body: `<!doctype html>
        <link rel="stylesheet" href="/style.css"><script defer src="/ko-sim.js"></script><script defer src="/fixture.js"></script><script defer src="/laboratorio.js"></script>
        <canvas id="arena-3d"></canvas><p id="estado-3d"></p><details class="importar-modelo">
        <summary>Testes técnicos</summary><p>Modelos provisórios reprovados visualmente</p>
        <button type="button" id="testar-blockouts">Teste técnico de articulação</button>
        <button type="button" id="testar-guarda-pipoca">Ver movimentos da Pipoca</button>
        <input type="file" data-modelo="0"><input type="file" data-modelo="1"><p id="estado-modelos"></p></details>` });
    });
    await page.goto(origem);
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));
    assert.equal(pedidos.length, 0, 'Os estudos não são baixados ao abrir a prévia');
    await page.locator('summary').click();
    const canvas = page.locator('canvas'), botao = page.locator('#testar-blockouts');
    const manequins = await canvas.screenshot();
    await botao.click();
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('não está disponível'));
    assert.equal(await botao.isEnabled(), true, 'Falha recupera o botão para tentar novamente');
    assert.deepEqual(await canvas.screenshot(), manequins, 'Falha do segundo GLB conserva os dois manequins anteriores');

    falharUivo = false;
    await botao.click();
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('carregados para teste técnico'));
    // O estado de importação antecede a compilação assíncrona dos materiais PBR.
    await page.waitForTimeout(1000);
    const dupla = await canvas.screenshot();
    assert.notDeepEqual(dupla, manequins, 'A dupla real de estudos substitui os manequins após preparação completa');
    assert.match(await page.locator('#estado-modelos').textContent(), /reprovados visualmente/);
    await page.screenshot({ path: path.join(root, '.browser-check/blockouts-3d-tecnico.png') });

    falharUivo = true;
    await botao.click();
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('não está disponível'));
    assert.deepEqual(await canvas.screenshot(), dupla, 'Nova falha conserva a dupla já instalada');

    falharUivo = false; segurarDownload = true;
    await botao.click();
    await page.waitForFunction(() => document.querySelector('#testar-blockouts').disabled);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('ocultar a página'));
    assert.equal(await botao.isEnabled(), true, 'Ocultar a página interrompe o download e libera o botão');
    liberar?.(); segurarDownload = false;
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    segurarDownload = true;
    await page.evaluate(() => { __limiteCurto = true; });
    await botao.click();
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('demorou demais'));
    assert.equal(await botao.isEnabled(), true, 'Prazo de carregamento libera nova tentativa');
    liberar?.(); segurarDownload = false;
    await page.evaluate(() => { __limiteCurto = false; });
    await botao.click();
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('carregados para teste técnico'));
    await page.waitForTimeout(1000);
    const antesGuarda = await canvas.screenshot();
    const botaoGuarda = page.locator('#testar-guarda-pipoca');
    await botaoGuarda.click();
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('não está disponível'));
    assert.deepEqual(await canvas.screenshot(), antesGuarda, 'Falha da guarda conserva os modelos anteriores');
    assert.equal(await botaoGuarda.isEnabled(), true);
    falharGuarda = false;
    const uivoAntes = await page.screenshot({ clip: { x: 422, y: 0, width: 422, height: 390 } });
    await botaoGuarda.click();
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('Movimentos da Pipoca carregados'));
    await page.waitForTimeout(1000);
    assert.notDeepEqual(await canvas.screenshot(), antesGuarda, 'A nova guarda troca a apresentação da Pipoca');
    assert.deepEqual(await page.screenshot({ clip: { x: 422, y: 0, width: 422, height: 390 } }), uivoAntes, 'Carregar a guarda conserva Uivo');
    await page.screenshot({ path: path.join(root, '.browser-check/pipoca-movimentos-laboratorio.png') });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    assert.deepEqual(erros, [], 'Download, substituição, cancelamento e retry não geram erros JS sem tratamento');
    assert.ok(pedidos.every(url => ['/modelos/blockout/pipoca-v1.glb', '/modelos/blockout/uivo-v1.glb', '/modelos/estudos/pipoca-corpo-v10.glb'].includes(url)));
    console.log('PASS estudos 3D opt-in: dupla atômica, falha preserva modelos, aviso de reprovação visual, cancelamento, timeout e retry');
  } finally { await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
