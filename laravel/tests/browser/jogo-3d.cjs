// Jogo real, somente 3D: Pipoca contra a máquina, falha de recurso e retomada.
//   node laravel/tests/browser/jogo-3d.cjs
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const temp = path.join(root, '.browser-check');
const saida = path.join(temp, 'jogo-3d');
fs.mkdirSync(saida, { recursive: true });
const banco = path.join(temp, 'jogo3d.sqlite');
fs.writeFileSync(banco, '');
const env = {
  ...process.env,
  APP_ENV: 'testing', APP_DEBUG: 'true',
  APP_KEY: 'base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
  APP_URL: 'http://127.0.0.1:8019', DB_URL: '',
  DB_CONNECTION: 'sqlite', DB_DATABASE: banco,
  SESSION_DRIVER: 'file', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file',
  KO_SENHA_AMIGOS: 'ko',
  KO_RELAY_HOST: '127.0.0.1', KO_RELAY_PORTA: '6019', KO_RELAY_URL: 'ws://127.0.0.1:6019',
};
const migracao = spawnSync('php', ['artisan', 'migrate', '--force'], {
  cwd: path.join(root, 'laravel'), env, encoding: 'utf8', windowsHide: true,
});
assert.equal(migracao.status, 0, migracao.error?.message || (migracao.stderr + migracao.stdout));
const servidor = spawn('php', [
  '-S', '127.0.0.1:8019',
  path.join(root, 'laravel/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php'),
], { cwd: path.join(root, 'public'), env, windowsHide: true });
servidor.stdout.resume();
servidor.stderr.resume();
const sleep = n => new Promise(r => setTimeout(r, n));
let browser;

(async () => {
  let respondeu = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(env.APP_URL)).ok) { respondeu = true; break; } } catch {}
    await sleep(100);
  }
  assert.ok(respondeu, 'Servidor Laravel iniciou');
  browser = await chromium.launch({
    executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }, serviceWorkers: 'block',
  });
  // Quem já havia escolhido 2D na versão antiga também deve entrar no 3D.
  await context.addInitScript(() => localStorage.setItem('ko-graficos', '2d'));
  const page = await context.newPage();
  const erros = [];
  let bloquearModelo = false, falhasModelo = 0;
  page.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Apenas o HTTP 500 que este teste provoca é esperado.
    if (m.location().url.includes('/pipoca-v5-azul.glb') && m.text().includes('500')) return;
    erros.push(m.text());
    console.log('CONSOLE', m.text().slice(0, 300));
  });
  await page.route('**/modelos/estudos/pipoca-v5-azul.glb*', async rota => {
    if (!bloquearModelo) return rota.continue();
    falhasModelo++;
    return rota.fulfill({ status: 500, contentType: 'text/plain', body: 'Falha de modelo simulada pelo teste' });
  });
  await page.goto(env.APP_URL);
  await page.locator('#senha-amigos').fill(env.KO_SENHA_AMIGOS);
  await page.getByRole('button', { name: 'Desbloquear arena' }).click();
  await page.locator('#apelido').fill('Teste3D');
  await page.locator('#pin').fill('0123');
  await page.getByRole('button', { name: 'Entrar e jogar' }).click();
  await page.getByRole('button', { name: 'Criar sala' }).waitFor();

  // Versus CPU: o 1º Pronto confirma a lutadora; o 2º, a da máquina (Pipoca vermelha).
  async function confirmar() {
    await page.locator('#pronto').click();
    if (await page.locator('.carta[data-id="pipoca"]').isVisible() && !(await page.evaluate(() => !!window.KOTeste?.luta()))) {
      await page.locator('.carta[data-id="pipoca"]').click();
      await page.locator('#pronto').click();
    }
  }
  async function escolherPipoca() {
    await page.goto(env.APP_URL + '/'); // Trocar só o hash não recarrega o jogo.
    await page.goto(env.APP_URL + '/jogar/cpu#teste');
    await page.locator('.carta[data-id="pipoca"]').waitFor();
    assert.deepEqual(await page.locator('.carta[data-id]').evaluateAll(cartas => cartas.map(c => c.dataset.id)), ['pipoca'], 'Somente Pipoca aparece na escolha');
    assert.equal(await page.locator('[data-acao="graficos"]').count(), 0, 'Escolha sem alternância para 2D');
    await page.evaluate(() => {
      window.__desenhos2d = 0;
      const desenhar = window.KOArte.desenhar;
      window.KOArte.desenhar = function (s, opc) {
        if (!opc?.somenteHud) window.__desenhos2d++;
        return desenhar.call(this, s, opc);
      };
    });
    await page.locator('.carta[data-id="pipoca"]').click();
  }

  async function conferirBloqueio(nome) {
    await page.locator('[data-acao="tentar-3d"]').waitFor({ state: 'visible', timeout: 180000 });
    assert.ok((await page.locator('.painel-graficos').innerText()).includes('3D'), 'Falha informa que o 3D não carregou');
    console.log('Diagnóstico de bloqueio:', await page.evaluate(() => window.KODiagnostico3D));
    const quadro = await page.evaluate(() => window.KOTeste.luta().s.f);
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.KOTeste.luta().s.f), quadro, 'Simulação não avança enquanto o 3D está indisponível');
    assert.equal(await page.evaluate(() => window.__desenhos2d), 0, 'Falha não desenha arena ou lutadores em 2D');
    await page.screenshot({ path: path.join(saida, nome + '.png') });
  }

  // Falha HTTP de verdade: a luta espera e permite uma nova tentativa.
  bloquearModelo = true;
  await escolherPipoca();
  await confirmar();
  await page.waitForFunction(() => !!window.KOTeste?.luta());
  await page.evaluate(() => {
    window.__partidaOriginal = window.KOTeste.luta();
    window.__estadoOriginal = window.__partidaOriginal.s;
  });
  await conferirBloqueio('falha-modelo');
  assert.ok(falhasModelo > 0, 'O GLB azul realmente respondeu HTTP 500');
  assert.deepEqual(await page.evaluate(() => window.KOTeste.luta().s.lutadores), ['pipoca', 'pipoca'], 'Máquina também usa Pipoca');

  bloquearModelo = false;
  await page.locator('[data-acao="tentar-3d"]').click();
  await page.waitForFunction(() => {
    const luta = window.KOTeste?.luta();
    return luta?.s.fase === 'luta' && !!luta.r3d && !luta.carregando3d;
  }, null, { timeout: 180000 });
  assert.ok(await page.evaluate(() => window.KOTeste.luta() === window.__partidaOriginal && window.KOTeste.luta().s === window.__estadoOriginal), 'Nova tentativa preserva a mesma luta e o mesmo estado');
  assert.ok(await page.evaluate(() => document.body.classList.contains('graficos-3d')), '3D ativo apesar da preferência antiga por 2D');
  assert.equal(await page.locator('.painel-graficos:visible').count(), 0, 'Painel sai após carregar');
  assert.equal(await page.evaluate(() => window.__desenhos2d), 0, 'Retomada continua sem renderizar a luta em 2D');
  const quadro3d = await page.evaluate(() => window.KOTeste.luta().s.f);
  await page.waitForFunction(f => window.KOTeste.luta().s.f > f, quadro3d, { timeout: 15000 });
  await page.screenshot({ path: path.join(saida, 'pipoca-3d-inicio.png') });

  // Os atalhos visíveis e as teclas atravessam o fluxo real de entrada.
  await page.evaluate(() => {
    window.__golpesPoderes = [];
    window.__passoPoderesOriginal = KOSim.passo;
    KOSim.passo = (s, entradas) => {
      const r = window.__passoPoderesOriginal(s, entradas);
      if (s.p[0].golpe) window.__golpesPoderes.push(s.p[0].golpe);
      return r;
    };
    window.KOTeste.luta().cpu = null;
  });
  for (const [acao, golpe, tecla] of [['EX', 'espEx', 'KeyE'], ['SUPER', 'sup', 'KeyO'], ['ULTRA', 'ultra', 'KeyH']]) {
    for (const teclado of [false, true]) {
      await page.evaluate(() => {
        const luta = window.KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
        s.fase = 'luta'; s.fT = 0; s.p[0].x = 60 * KOSim.U; s.p[1].x = 320 * KOSim.U;
        s.p[0].poder = KOSim.PODER_MAX; s.p[0].revanche = KOSim.ULTRA_MAX;
        Object.assign(luta.s, s); luta.r3d.limpar(); window.__golpesPoderes = [];
      });
      await page.waitForFunction(acao => document.querySelector(`[data-b="${acao}"]`).dataset.disponivel === 'true', acao);
      if (teclado) await page.keyboard.press(tecla);
      else await page.locator(`.atalhos-poderes [data-b="${acao}"]`).click();
      await page.waitForFunction(golpe => window.__golpesPoderes.includes(golpe), golpe, { timeout: 30000 });
    }
  }
  await page.screenshot({ path: path.join(saida, 'poderes-atalhos.png') });
  // Rasteira real no laço da partida: não forçar estados de queda/levantada.
  await page.evaluate(() => {
    const luta = window.KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
    s.fase = 'luta'; s.fT = 0; s.p[0].x = 150 * KOSim.U; s.p[1].x = 180 * KOSim.U;
    Object.assign(luta.s, s); luta.r3d.limpar(); window.__recuperacaoReal = [];
    let primeiro = true;
    KOSim.passo = estado => {
      const r = window.__passoPoderesOriginal(estado, [0, primeiro ? KOSim.B.D | KOSim.B.K : 0]);
      primeiro = false;
      const nome = estado.p[0].estado, vistos = window.__recuperacaoReal;
      if (vistos.at(-1) !== nome) vistos.push(nome);
      return r;
    };
  });
  await page.waitForFunction(() => {
    const vistos = window.__recuperacaoReal;
    return vistos.includes('caido') && vistos.includes('levantando') && vistos.at(-1) === 'parado';
  }, null, { timeout: 30000 });
  await page.screenshot({ path: path.join(saida, 'recuperacao-real-guarda.png') });
  console.log('Recuperação no jogo real:', await page.evaluate(() => window.__recuperacaoReal));
  await page.evaluate(() => {
    KOSim.passo = window.__passoPoderesOriginal;
    const luta = window.KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
    s.fase = 'luta'; s.fT = 0; Object.assign(luta.s, s);
    luta.cpu = KOCPU.criar(KOSim, 'medio'); luta.r3d.limpar();
  });
  console.log('EX, Super e Ultra: atalhos da tela e do teclado acionam os golpes corretos.');

  // Aproxima para verificar golpes reais; SwiftShader roda a poucos FPS.
  await page.evaluate(() => {
    const s = window.KOTeste.luta().s;
    s.p[0].x = 160 * 16; s.p[1].x = 186 * 16;
  });
  const inicio = Date.now();
  while (Date.now() - inicio < 90000 && !(await page.evaluate(() => window.KOTeste.luta().s.p.some(p => p.vida < 950)))) {
    for (const tecla of ['KeyJ', 'KeyK']) {
      await page.keyboard.down(tecla); await page.waitForTimeout(400);
      await page.keyboard.up(tecla); await page.waitForTimeout(400);
    }
  }
  const vidas = await page.evaluate(() => window.KOTeste.luta().s.p.map(p => p.vida));
  assert.ok(vidas.some(v => v < 950), 'Houve troca de golpes na luta 3D');
  await page.screenshot({ path: path.join(saida, 'pipoca-3d-golpes.png') });
  await page.locator('#pausa').click();
  assert.equal(await page.locator('.painel-pausa [data-acao="graficos"]').count(), 0, 'Pausa sem alternância para 2D');
  await page.locator('.painel-pausa [data-acao="voltar"]').click();
  console.log('Pipoca × Pipoca 3D, falha HTTP 500 e retomada:', { vidas, falhasModelo });

  // Exercita o listener real de perda de contexto sem perder o contexto do
  // SwiftShader de forma irreversível. A mesma luta deve poder carregar de novo.
  assert.equal(await page.evaluate(() => document.getElementById('tela-3d').dispatchEvent(new Event('webglcontextlost', { cancelable: true }))), false, 'Listener intercepta a perda do contexto 3D');
  await conferirBloqueio('contexto-3d-interrompido');
  assert.equal(await page.evaluate(() => window.KODiagnostico3D?.etapa), 'contexto WebGL', 'Diagnóstico identifica a perda de contexto');
  await page.locator('[data-acao="tentar-3d"]').click();
  await page.waitForFunction(() => {
    const luta = window.KOTeste?.luta();
    return !!luta?.r3d && !luta.carregando3d && !luta.erro3d;
  }, null, { timeout: 180000 });
  assert.ok(await page.evaluate(() => window.KOTeste.luta() === window.__partidaOriginal && window.KOTeste.luta().s === window.__estadoOriginal), 'Retomada do contexto preserva a mesma luta');
  assert.equal(await page.evaluate(() => window.KODiagnostico3D), null, 'Diagnóstico é limpo após a retomada');
  assert.equal(await page.evaluate(() => window.__desenhos2d), 0, 'Perda de contexto e retomada não desenham a versão 2D');
  const quadroRetomado = await page.evaluate(() => window.KOTeste.luta().s.f);
  await page.waitForFunction(f => window.KOTeste.luta().s.f > f, quadroRetomado, { timeout: 15000 });
  console.log('Perda de contexto sinalizada, bloqueio e retomada: OK');

  // HTML normal, mas o pacote não instala nenhum renderizador 3D.
  await page.route('**/js/ko-jogo-3d.js*', rota => rota.fulfill({ status: 200, contentType: 'text/javascript', body: '/* Pacote 3D ausente no teste. */' }));
  await escolherPipoca();
  assert.equal(await page.evaluate(() => typeof window.KO3D), 'undefined');
  await confirmar();
  await conferirBloqueio('pacote-3d-ausente');
  await page.unroute('**/js/ko-jogo-3d.js*');

  // Suporte recusado também bloqueia, em vez de iniciar a versão antiga.
  await escolherPipoca();
  await page.evaluate(() => { window.KO3D.disponivel = () => false; });
  await confirmar();
  await conferirBloqueio('3d-sem-suporte');
  assert.deepEqual(erros, [], 'Nenhum erro inesperado no navegador');
  console.log('OK: somente 3D; falhas visíveis, simulação bloqueada e nova tentativa funcional.');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  servidor.kill();
});
