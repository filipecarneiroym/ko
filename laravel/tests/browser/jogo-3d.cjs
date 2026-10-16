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
  await context.addInitScript(() => {
    addEventListener('pointerup', e => { if (window.__omitirPointerUp) e.stopImmediatePropagation(); }, true);
    window.__leiturasPad = 0;
    window.__pad = { index: 0, id: 'Controle virtual de teste', mapping: 'standard', connected: false,
      axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => {
      window.__leiturasPad++; return window.__pad.connected ? [window.__pad] : [];
    } });
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90000); // SwiftShader: recarregar o pacote 3D compete com a renderização.
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
  await page.locator('#apelido').fill('Teste3D');
  await page.locator('#pin').fill('0123');
  await page.getByRole('button', { name: 'Entrar e jogar' }).click();
  await page.locator('.modos-jogo').waitFor();

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
  // Toques reais do navegador: fora da alavanca, arrasto capturado e dois dedos.
  const toqueCDP = await context.newCDPSession(page);
  await toqueCDP.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await page.evaluate(() => {
    const luta = KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
    s.fase = 'luta'; s.p[0].x = 60 * KOSim.U; s.p[1].x = 320 * KOSim.U;
    Object.assign(luta.s, s); luta.cpu = null; window.__toquesReais = [];
    window.__passoAntesToque = KOSim.passo;
    KOSim.passo = (s, entradas) => {
      const r = window.__passoAntesToque(s, entradas);
      window.__toquesReais.push({ bits: entradas[0], estado: s.p[0].estado, golpe: s.p[0].golpe });
      return r;
    };
  });
  const tocar = (type, touchPoints) => toqueCDP.send('Input.dispatchTouchEvent', { type, touchPoints });
  await tocar('touchStart', [{ x: 10, y: 10, id: 1 }]);
  await page.waitForTimeout(1800);
  assert.ok(await page.evaluate(() => __toquesReais.length > 0 && __toquesReais.every(t => t.bits === 0)), 'toque longe da alavanca não move nem pula');
  await tocar('touchEnd', []);
  const area = await page.locator('#direcional').boundingBox();
  const dedo = { x: area.x + area.width * .9, y: area.y + area.height / 2, id: 1 };
  await tocar('touchStart', [dedo]);
  await page.waitForFunction(() => __toquesReais.some(t => t.bits & KOSim.B.R));
  const k = await page.locator('.botoes [data-b="K"]').boundingBox();
  await tocar('touchStart', [dedo, { x: k.x + k.width / 2, y: k.y + k.height / 2, id: 2 }]);
  await page.waitForFunction(() => __toquesReais.some(t => t.golpe === 'k1'));
  await tocar('touchMove', [{ ...dedo, x: 400 }, { x: k.x + k.width / 2, y: k.y + k.height / 2, id: 2 }]);
  await page.evaluate(() => { window.__omitirPointerUp = true; });
  await tocar('touchEnd', [{ ...dedo, x: 400 }]);
  await page.evaluate(() => { window.__omitirPointerUp = false; });
  await page.waitForFunction(() => (__toquesReais.at(-1).bits & KOSim.B.K) && !(__toquesReais.at(-1).bits & KOSim.B.R));
  await tocar('touchEnd', []);
  await page.waitForTimeout(1800);
  assert.equal(await page.evaluate(() => __toquesReais.at(-1).bits), 0, 'soltar os dois dedos limpa todas as entradas');
  assert.ok(await page.evaluate(() => { const l = KOTeste.luta().s.p[0]; return l.vx === 0 && l.estado === 'parado'; }), 'a personagem realmente para depois de soltar');
  assert.ok(await page.evaluate(() => !__toquesReais.some(t => t.golpe === 'k2')), 'um toque no K andando não alterna para chute alto');
  await tocar('touchStart', [dedo]);
  await page.waitForFunction(() => __toquesReais.at(-1).bits & KOSim.B.R);
  await tocar('touchCancel', []);
  await page.waitForFunction(() => __toquesReais.at(-1).bits === 0);
  assert.equal(await page.locator('#direcional').getAttribute('data-dir'), '', 'cancelar gesto não prende a direção');
  await page.evaluate(() => { KOSim.passo = window.__passoAntesToque; });
  await toqueCDP.detach();
  console.log('Toque real: área da alavanca, direção + K, arrasto e soltura: OK.');
  if (process.env.KO_APENAS_TOQUE) return;
  if (process.env.KO_MEDIR_RITMO) {
    const medidas = await page.evaluate(async () => {
      const luta = window.KOTeste.luta(); luta.cpu = null;
      let primeiro = null, ultimo = null, desenhos = 0; const desenhar = luta.r3d.desenhar;
      luta.r3d.desenhar = function (s) {
        desenhos++; ultimo = { agora: luta.ultimo, f: s.f }; primeiro ||= ultimo;
        return desenhar.call(this, s);
      };
      await new Promise(resolve => setTimeout(resolve, 6000));
      luta.r3d.desenhar = desenhar;
      const segundos = (ultimo.agora - primeiro.agora) / 1000, passos = ultimo.f - primeiro.f;
      return { segundos, desenhos, fps: (desenhos - 1) / segundos, passos,
        passosPorSegundo: passos / segundos, visibilidade: document.visibilityState };
    });
    fs.writeFileSync(path.join(temp, 'ritmo-3d.json'), JSON.stringify(medidas, null, 2));
    console.log('Medição real de ritmo 3D (SwiftShader):', medidas);
    assert.ok(medidas.passosPorSegundo > 58 && medidas.passosPorSegundo < 62, 'simulação real acompanha 60 Hz com desenho lento');
    if (process.env.KO_MEDIR_RITMO !== 'completo') return;
  }

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

  // Gamepad API real da página, alimentada por controle virtual standard.
  await page.evaluate(() => {
    window.__pad.connected = true; window.KOTeste.luta().cpu = null;
    window.__golpesPad = []; window.__estadosPad = []; window.__bloqueiosPad = 0;
    KOSim.passo = (s, entradas) => {
      const r = window.__passoPoderesOriginal(s, entradas);
      window.__estadosPad.push(s.p[0].estado);
      if (s.p[0].golpe) window.__golpesPad.push(s.p[0].golpe);
      window.__bloqueiosPad += s.ev.filter(e => e.t === 'defendeu' && e.lado === 0).length;
      return r;
    };
  });
  async function soltarPad() {
    const n = await page.evaluate(() => {
      window.__pad.buttons.forEach(b => { b.pressed = false; b.value = 0; }); return window.__leiturasPad;
    });
    await page.waitForFunction(n => window.__leiturasPad > n, n);
  }
  for (const [golpe, botoes] of [['p1', [2]], ['k1', [0]], ['foc', [1]], ['esp', [3]], ['espEx', [3, 2]], ['sup', [3, 0]], ['ultra', [3, 1]]]) {
    await soltarPad();
    await page.evaluate(botoes => {
      const luta = window.KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
      s.fase = 'luta'; s.fT = 0; s.p[0].poder = KOSim.PODER_MAX; s.p[0].revanche = KOSim.ULTRA_MAX;
      Object.assign(luta.s, s); luta.r3d.limpar(); window.__golpesPad = [];
      for (const i of botoes) window.__pad.buttons[i].pressed = true;
    }, botoes);
    await page.waitForFunction(g => window.__golpesPad.includes(g), golpe, { timeout: 15000 });
  }
  await soltarPad();
  await page.evaluate(() => {
    const luta = window.KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
    s.fase = 'luta'; s.fT = 0; s.p[0].x = 150 * KOSim.U; s.p[1].x = 180 * KOSim.U;
    Object.assign(luta.s, s); luta.r3d.limpar(); window.__estadosPad = []; window.__bloqueiosPad = 0;
    window.__pad.buttons[14].pressed = true;
    let q = 0; luta.cpu = () => ++q === 3 ? KOSim.B.P : 0;
  });
  await page.waitForFunction(() => window.__bloqueiosPad > 0, null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__estadosPad.includes('recuo')), false, 'segurar para trás não causa backdash antes da defesa');
  await soltarPad();
  await page.evaluate(() => {
    window.__pad.connected = false; KOSim.passo = window.__passoPoderesOriginal;
    const luta = window.KOTeste.luta(), s = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true });
    s.fase = 'luta'; s.fT = 0; Object.assign(luta.s, s); luta.r3d.limpar();
    luta.cpu = KOCPU.criar(KOSim, 'medio');
  });
  console.log('Gamepad: P, K, F, SP, EX, Super, Ultra e defesa para trás: OK.');

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
