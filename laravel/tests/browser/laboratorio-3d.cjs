const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const { criarGlbDeTeste } = require('./fixtures/glb.cjs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    if (process.env.KO_DEBUG_3D === '1') page.on('console', async mensagem => {
      if (mensagem.type() !== 'error') return;
      for (const argumento of mensagem.args()) {
        console.error(await argumento.evaluate(valor => valor instanceof Error ? valor.stack : String(valor)));
      }
    });
    await page.setContent(`<canvas id="arena-3d" width="844" height="300"></canvas><p id="estado-3d"></p>
      ${['L', 'R', 'D', 'P', 'K', 'U', 'D_', 'S'].map(comando => `<button type="button" data-comando="${comando}">${comando}</button>`).join('')}
      <button type="button" id="reiniciar-3d">Reiniciar</button>
      <input type="file" accept=".glb" data-modelo="0"><input type="file" accept=".glb" data-modelo="1"><p id="estado-modelos"></p>`);
    await page.addScriptTag({ path: path.join(root, 'public/js/ko-sim.js') });
    await page.addScriptTag({ path: path.join(root, 'public/js/ko-controle.js') });
    // Observa somente a fronteira da simulação, sem expor o estado do renderizador.
    await page.evaluate(() => {
      const novo = KOSim.novo, passo = KOSim.passo;
      window.__padsTeste = [];
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => __padsTeste });
      window.__lab3d = { passos: 0, reinicios: 0, entradas: [], perdidos: 0, restaurados: 0 };
      KOSim.novo = (...args) => { __lab3d.reinicios++; return novo(...args); };
      KOSim.passo = (estado, entradas) => {
        __lab3d.passos++;
        __lab3d.entradas.push(entradas[0]);
        __lab3d.dupla = entradas.slice();
        if (__lab3d.entradas.length > 120) __lab3d.entradas.shift();
        const resultado = passo(estado, entradas);
        __lab3d.ultimo = { quadro: estado.f, fase: estado.fase, x: estado.p[0].x, y: estado.p[0].y, vida: estado.p.map(p => p.vida) };
        return resultado;
      };
      const canvas = document.querySelector('canvas');
      canvas.addEventListener('webglcontextlost', () => { __lab3d.perdidos++; });
      canvas.addEventListener('webglcontextrestored', () => { __lab3d.restaurados++; });
    });
    await page.addScriptTag({ path: path.join(root, 'public/js/ko-laboratorio-3d.js') });
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));

    await page.evaluate(() => { __lab3d.entradas.length = 0; });
    await page.keyboard.down('KeyD');
    await page.waitForFunction(() => __lab3d.entradas.some(e => e & KOSim.B.R));
    await page.keyboard.up('KeyD');
    await page.evaluate(() => { __lab3d.entradas.length = 0; });
    await page.waitForFunction(() => __lab3d.entradas.length >= 4);
    assert.equal(await page.evaluate(() => __lab3d.entradas.some(e => e & KOSim.B.R)), false, 'Soltar direção encerra movimento');

    await page.keyboard.down('KeyD');
    await page.locator('[data-modelo="0"]').focus();
    await page.keyboard.up('KeyD');
    await page.evaluate(() => { __lab3d.entradas.length = 0; });
    await page.waitForFunction(() => __lab3d.entradas.length >= 4);
    assert.equal(await page.evaluate(() => __lab3d.entradas.some(e => e & KOSim.B.R)), false, 'Soltar tecla depois de focar campo não mantém direção presa');

    await page.evaluate(() => {
      const pad = index => ({ index, id: 'Dois controles iguais', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) });
      const primeiro = pad(0), segundo = pad(1);
      primeiro.axes[0] = 1; segundo.buttons[2] = { pressed: true, value: 1 };
      __padsTeste = [primeiro, segundo];
    });
    await page.waitForFunction(() => (__lab3d.dupla[0] & KOSim.B.R) && (__lab3d.dupla[1] & KOSim.B.P));
    await page.evaluate(() => { __padsTeste = []; });
    await page.waitForFunction(() => __lab3d.dupla[0] === 0 && __lab3d.dupla[1] === 0);

    for (const comando of ['L', 'R', 'D', 'D_']) {
      await page.evaluate(() => { __lab3d.entradas.length = 0; });
      const botao = page.locator(`[data-comando="${comando}"]`);
      await botao.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', isPrimary: true });
      await page.waitForFunction(c => __lab3d.entradas.some(e => e & KOSim.B[c]), comando);
      await botao.dispatchEvent('pointercancel', { pointerId: 12, pointerType: 'touch', isPrimary: true });
      await page.evaluate(() => { __lab3d.entradas.length = 0; });
      await page.waitForFunction(() => __lab3d.entradas.length >= 4);
      assert.equal(await page.evaluate(c => __lab3d.entradas.some(e => e & KOSim.B[c]), comando), false, `${comando} não fica preso depois do cancelamento do toque`);
    }

    for (const comando of ['P', 'K', 'U']) {
      await page.evaluate(() => { __lab3d.entradas.length = 0; });
      const botao = page.locator(`[data-comando="${comando}"]`);
      await botao.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
      await botao.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
      await page.waitForFunction(c => __lab3d.entradas.some(e => e & KOSim.B[c]), comando);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(c => (__lab3d.entradas.at(-1) & KOSim.B[c]) !== 0, comando), false, `${comando} não fica preso depois do toque`);
    }

    await page.evaluate(() => { __lab3d.entradas.length = 0; });
    await page.locator('[data-comando="R"]').dispatchEvent('pointerdown', { pointerId: 20, pointerType: 'touch', isPrimary: true });
    await page.locator('[data-comando="P"]').dispatchEvent('pointerdown', { pointerId: 21, pointerType: 'touch', isPrimary: false });
    await page.waitForFunction(() => __lab3d.entradas.some(e => (e & KOSim.B.R) && (e & KOSim.B.P)));
    await page.locator('[data-comando="P"]').dispatchEvent('pointerup', { pointerId: 21, pointerType: 'touch', isPrimary: false });
    await page.waitForFunction(() => !(__lab3d.entradas.at(-1) & KOSim.B.P));
    assert.equal(await page.evaluate(() => Boolean(__lab3d.entradas.at(-1) & KOSim.B.R)), true, 'Soltar golpe preserva a direção mantida pelo outro dedo');
    await page.locator('[data-comando="R"]').dispatchEvent('pointercancel', { pointerId: 20, pointerType: 'touch', isPrimary: true });
    await page.waitForFunction(() => !(__lab3d.entradas.at(-1) & KOSim.B.R));

    // Botões nativos precisam funcionar também por teclado e ativação assistiva.
    await page.evaluate(() => { __lab3d.entradas.length = 0; });
    await page.locator('[data-comando="P"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => __lab3d.entradas.some(e => e & KOSim.B.P), null, { timeout: 2000 });
    await page.waitForFunction(() => !(__lab3d.entradas.at(-1) & KOSim.B.P));
    await page.evaluate(() => { __lab3d.entradas.length = 0; });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => __lab3d.entradas.some(e => e & KOSim.B.P), null, { timeout: 2000 });

    const reinicios = await page.evaluate(() => __lab3d.reinicios);
    await page.locator('#reiniciar-3d').click();
    await page.waitForFunction(n => __lab3d.reinicios === n + 1, reinicios);

    for (const lado of [0, 1]) {
      const passosAntes = await page.evaluate(() => __lab3d.passos);
      await page.locator(`[data-modelo="${lado}"]`).setInputFiles({ name: 'modelo-invalido.glb', mimeType: 'model/gltf-binary', buffer: Buffer.alloc(32) });
      await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('GLB 2.0 inválido'));
      await page.waitForFunction(n => __lab3d.passos > n + 4, passosAntes);
      assert.equal(await page.locator(`[data-modelo="${lado}"]`).inputValue(), '', 'Importação inválida permite escolher o arquivo novamente');
    }

    const { ESTADOS_VISUAIS } = await import(pathToFileURL(path.join(root, 'src/3d/estado-visual.mjs')).href);
    for (const lado of [0, 0, 1]) {
      const id = lado === 0 ? 'pipoca' : 'uivo';
      const nomes = await page.evaluate(({ id, estados }) => [...estados, ...Object.keys(KOSim.LUTADORES[id].golpes)], { id, estados: ESTADOS_VISUAIS });
      const passosAntes = await page.evaluate(() => __lab3d.passos);
      await page.evaluate(() => { document.querySelector('#estado-modelos').textContent = ''; });
      await page.locator(`[data-modelo="${lado}"]`).setInputFiles({ name: 'triangulo-teste.glb', mimeType: 'model/gltf-binary', buffer: criarGlbDeTeste(nomes) });
      await page.waitForFunction(() => {
        const texto = document.querySelector('#estado-modelos').textContent;
        return texto && !texto.startsWith('Validando');
      }, null, { timeout: 10000 });
      assert.match(await page.locator('#estado-modelos').textContent(), /modelo de teste carregado/, 'Fixture GLB animável deve ser carregada pelo Babylon');
      await page.waitForFunction(n => __lab3d.passos > n + 4, passosAntes);
      assert.equal(await page.locator(`[data-modelo="${lado}"]`).inputValue(), '', 'Modelo carregado permite substituição local');
    }

    // O evento real do WebGL reproduz interrupções do driver, comuns em celulares.
    await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2');
      window.__perdaWebGL = gl?.getExtension('WEBGL_lose_context');
      if (!__perdaWebGL) throw new Error('Edge de teste não oferece WEBGL_lose_context');
      __perdaWebGL.loseContext();
    });
    await page.waitForFunction(() => __lab3d.perdidos === 1);
    const passosPerdido = await page.evaluate(() => __lab3d.passos);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => __lab3d.passos), passosPerdido, 'Contexto perdido suspende a simulação');
    await page.evaluate(() => __perdaWebGL.restoreContext());
    await page.waitForFunction(() => __lab3d.restaurados === 1);
    await page.waitForFunction(n => __lab3d.passos > n, passosPerdido);
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));

    // Navegação com bfcache preserva a página e deve retomar uma única arena.
    await page.keyboard.down('KeyD');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    const passosOculto = await page.evaluate(() => __lab3d.passos);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => __lab3d.passos), passosOculto, 'Página preservada pausa a simulação');
    await page.evaluate(() => {
      __lab3d.entradas.length = 0;
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.waitForFunction(n => __lab3d.passos > n + 4, passosOculto, { timeout: 3000 });
    assert.equal(await page.evaluate(() => __lab3d.entradas.some(e => e & KOSim.B.R)), false, 'Retorno por bfcache limpa teclas antes de retomar');
    await page.keyboard.up('KeyD');

    await page.keyboard.down('KeyA');
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      __lab3d.entradas.length = 0;
    });
    await page.waitForFunction(() => __lab3d.entradas.length >= 4);
    assert.equal(await page.evaluate(() => __lab3d.entradas.some(e => e & KOSim.B.L)), false, 'Perder foco limpa movimento pendente');
    await page.keyboard.up('KeyA');

    await page.screenshot({ path: path.join(root, '.browser-check/laboratorio-3d.png') });
    const contexto = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2');
      return Boolean(gl && !gl.isContextLost());
    });
    assert.equal(contexto, true, 'Arena deve manter contexto WebGL ativo');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    const passosEncerrado = await page.evaluate(() => __lab3d.passos);
    const reiniciosEncerrado = await page.evaluate(() => __lab3d.reinicios);
    await page.locator('#reiniciar-3d').click();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => __lab3d.passos), passosEncerrado, 'Saída definitiva encerra o loop');
    assert.equal(await page.evaluate(() => __lab3d.reinicios), reiniciosEncerrado, 'Saída definitiva remove eventos dos comandos');
    assert.deepEqual(erros, []);
    console.log('PASS laboratório 3D: comandos por toque/teclado, reinício, GLB inválido e substituição real de GLB animável, perda/restauro WebGL, bfcache, encerramento e ausência de erros JS');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
