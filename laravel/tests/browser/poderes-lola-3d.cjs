const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8039';
const saida = path.join(root, 'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/poderes');
(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await page.route(`${origem}/**`, async rota => {
      const caminho = new URL(rota.request().url()).pathname;
      if (caminho.startsWith('/arenas/') || caminho.startsWith('/modelos/'))
        return rota.fulfill({ body: fs.readFileSync(path.join(root, 'public', caminho)) });
      const nome = caminho === '/laboratorio.js' ? 'ko-laboratorio-3d.js' : caminho.slice(1);
      if (['ko-sim.js', 'ko-cpu.js', 'ko-laboratorio-3d.js'].includes(nome))
        return rota.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'public/js', nome)) });
      return rota.fulfill({ contentType: 'text/html', body: `<!doctype html><style>body{margin:0;background:#110d21;color:white}canvas{width:1280px;height:620px;display:block}</style>
        <script defer src="/ko-sim.js"></script><script defer src="/ko-cpu.js"></script><script defer src="/laboratorio.js"></script>
        <canvas id="arena-3d"></canvas><p id="estado-3d"></p>
        <select id="modo-luta"><option value="versus">versus</option></select><select id="nivel-maquina"><option value="medio">m</option></select>
        <button id="iniciar-luta">Começar luta</button><p id="estado-modelos"></p>` });
    });
    await page.goto(origem);
    await page.waitForFunction(() => document.querySelector('#estado-3d').textContent.includes('FPS'));
    await page.click('#iniciar-luta');
    await page.waitForFunction(() => document.querySelector('#estado-modelos').textContent.includes('2 jogadores'), null, { timeout: 90000 });
    await page.waitForFunction(() => globalThis.__laboratorio3d.scene.isReady(), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => new Set(globalThis.__laboratorio3d.scene.meshes
      .filter(m => m.name.startsWith('golpe-bola-')).map(m => m.material.emissiveTexture)).size), 1,
      'projéteis compartilham uma textura pronta, sem clones dinâmicos vazios');
    const casos = [
      ['salto-frente-inicio', 'pulo', 4], ['salto-frente-apice', 'pulo', 17],
      ['salto-frente-abre', 'pulo', 28], ['salto-frente-pouso', 'pulo', 33],
      ['salto-frente-invertido', 'pulo', 17, -1], ['salto-tras-apice', 'pulo', 17], ['salto-parado-apice', 'pulo', 17],
      ['queda-real-no-chao', 'caido', 20], ['queda-real-maos', 'levantando', 5],
      ['queda-real-arco', 'levantando', 10], ['queda-real-guarda', 'parado', 3],
      ['queda-contato', 'caido', 8], ['queda-deitada', 'caido', 30],
      ['queda-impacto', 'caido', 11],
      ['levantar-recolhe', 'levantando', 3], ['levantar-maos', 'levantando', 5],
      ['levantar-arco', 'levantando', 10], ['levantar-pouso', 'levantando', 14],
      ['derrota-final', 'derrotado', 60], ['derrota-invertida', 'derrotado', 60, -1],
      ['fim-partida', 'derrotado', 80], ['fim-apos-final', 'derrotado', 0],
      ['chute-k-contato', 'k1', 6], ['chute-k-recolhe', 'k1', 12],
      ['chute-k-guarda', 'k1', 20], ['chute-k-invertido', 'k1', 6, -1],
      ['soco-p-contato', 'p1', 3], ['soco-p-recolhe', 'p1', 8], ['soco-p-invertido', 'p1', 3, -1],
      ['soco-combo-contato', 'p2', 5], ['soco-baixo-contato', 'cp', 3],
      ['focus-solta', 'foc', 19], ['focus-solta-invertido', 'foc', 19, -1],
      ['focus-curto', 'foc', 12], ['focus-nivel2', 'foc', 24],
      ['focus-maximo', 'foc', 60], ['focus-maximo-invertido', 'foc', 60, -1], ['focus-fim-clarao', 'foc', 60],
      ['chute-alto-preparo', 'k2', 4], ['chute-alto-contato', 'k2', 7],
      ['rasteira-preparo', 'ck', 4], ['rasteira-contato', 'ck', 6],
      ['chute-aereo-inicio', 'ak', 5], ['chute-aereo-fim', 'ak', 16],
      ['chute-alto-invertido', 'k2', 7, -1], ['rasteira-invertida', 'ck', 6, -1],
      ['hadouken-preparo', 'esp', 5], ['hadouken-quadril', 'esp', 7],
      ['hadouken-disparo', 'esp', 10], ['hadouken-viagem', 'esp', 16],
      ['hadouken-vapor', 'esp', 24],
      ['hadouken-invertido', 'esp', 16, -1],
      ['hadouken-preparo-invertido', 'esp', 7, -1],
      ['shoryuken-subida', 'dp', 8], ['shoryuken-apice', 'dp', 16],
      ['furacao', 'tatsu', 12], ['furacao-volta', 'tatsu', 22],
      ['hadouken-ex', 'espEx', 16], ['shoryuken-ex', 'dpEx', 12], ['furacao-ex', 'tatsuEx', 21],
      ['super-toca', 'sup', 46], ['ultra-carga', 'ultra', 18], ['ultra-projetil', 'ultra', 25], ['focus-carga', 'foc', 30],
    ];
    for (const [nome, golpe, quadro, face = 1] of casos) {
      if (process.env.KO_CAPTURAS && !process.env.KO_CAPTURAS.split(',').includes(nome)) continue;
      if (process.env.KO_HADOUKEN && !['esp', 'espEx', 'ultra'].includes(golpe)) continue;
      if (process.env.KO_CHUTES && !['k1', 'k2', 'ck', 'ak', 'tatsu', 'tatsuEx'].includes(golpe)) continue;
      if (process.env.KO_CHUTE_AEREO && golpe !== 'ak') continue;
      const resultado = await page.evaluate(async ({ nome, golpe, quadro, face }) => {
        const lab = globalThis.__laboratorio3d; lab.pausado = true;
        const novo = KOSim.novo({ lutadores: ['pipoca', 'pipoca'], treino: true }); novo.fase = 'luta'; novo.fT = 0;
        novo.p[0].x = (face > 0 ? 80 : 300) * KOSim.U; novo.p[1].x = (face > 0 ? 300 : 80) * KOSim.U;
        novo.p[0].face = face; novo.p[1].face = -face;
        novo.p[0].poder = KOSim.PODER_MAX; novo.p[0].revanche = KOSim.ULTRA_MAX;
        Object.assign(lab.estado, novo);
        const B = KOSim.B;
        const comandos = { p1: B.P, cp: B.D | B.P, k1: B.K, ck: B.D | B.K, esp: B.S, dp: B.R | B.S, tatsu: B.L | B.S, espEx: B.S | B.P, dpEx: B.R | B.S | B.P,
          tatsuEx: B.L | B.S | B.P, sup: B.S | B.K, ultra: B.S | B.F, foc: B.F };
        if (nome.startsWith('salto-')) {
          const frente = face > 0 ? B.R : B.L, tras = face > 0 ? B.L : B.R;
          KOSim.passo(lab.estado, [B.U | (nome.includes('parado') ? 0 : nome.includes('tras') ? tras : frente), 0]);
          for (let q = 1; q < quadro; q++) KOSim.passo(lab.estado, [0, 0]);
        } else if (nome.startsWith('queda-real-')) {
          lab.estado.p[0].x = 150 * KOSim.U; lab.estado.p[1].x = 180 * KOSim.U;
          KOSim.passo(lab.estado, [0, B.D | B.K]);
          let passos = 0, caiu = false;
          while (passos++ < 220) {
            const l = lab.estado.p[0]; caiu ||= l.estado === 'caido';
            if (caiu && l.estado === golpe && l.t >= quadro) break;
            KOSim.passo(lab.estado, [0, 0]);
          }
          if (!caiu || passos >= 220) throw new Error('queda real não completou caído → levantando → guarda');
        } else if (['caido', 'levantando', 'derrotado'].includes(golpe)) {
          Object.assign(lab.estado.p[0], { estado: golpe, golpe: null, t: quadro });
        } else if (['p2', 'k2', 'ak'].includes(golpe)) {
          // Inspeção do clipe inteiro, sem a queda interromper o chute aéreo.
          Object.assign(lab.estado.p[0], { estado: 'golpe', golpe, t: quadro, y: golpe === 'ak' ? 48 * KOSim.U : 0 });
        } else KOSim.passo(lab.estado, [comandos[golpe], 0]);
        let guarda = 0;
        while ((golpe === 'foc' ? lab.estado.p[0].focoCarga < quadro : lab.estado.p[0].t < quadro) && guarda++ < 180)
          KOSim.passo(lab.estado, [golpe === 'foc' ? B.F : 0, 0]);
        if (nome.startsWith('focus-solta')) {
          KOSim.passo(lab.estado, [0, 0]);
          while (lab.estado.p[0].t < 19) KOSim.passo(lab.estado, [0, 0]);
        }
        if (nome === 'focus-fim-clarao') while (lab.estado.p[0].t < 21) KOSim.passo(lab.estado, [0, 0]);
        if (nome.startsWith('fim-')) {
          Object.assign(lab.estado, { fase: 'fim', vencedor: 1, fT: quadro, finalFeito: nome === 'fim-apos-final' ? 1 : 0 });
          Object.assign(lab.estado.p[0], { estado: nome === 'fim-partida' ? 'tonto' : 'derrotado', t: 0 });
        }
        await new Promise(resolve => lab.scene.onAfterRenderObservable.addOnce(() => resolve()));
        return { golpe: lab.estado.p[0].golpe, estado: lab.estado.p[0].estado, altura: lab.estado.p[0].y, proj: lab.estado.proj.length };
      }, { nome, golpe, quadro, face });
      if (nome.startsWith('salto-')) assert.equal(resultado.estado, 'pulo');
      else if (nome.startsWith('queda-real-')) assert.equal(resultado.estado, golpe, 'recuperação real, sem forçar estado');
      else if (nome === 'fim-partida') assert.equal(resultado.estado, 'tonto', 'fim visual não muda o estado do motor');
      else if (['caido', 'levantando', 'derrotado'].includes(golpe)) assert.equal(resultado.estado, golpe);
      else assert.equal(resultado.golpe, golpe);
      if (golpe.startsWith('dp')) assert.ok(resultado.altura > 0);
      if (golpe === 'espEx') assert.equal(resultado.proj, 2);
      await page.waitForTimeout(500);
      if (nome.startsWith('focus-')) {
        const corpo = await page.evaluate(() => globalThis.__laboratorio3d.scene.meshes
          .filter(m => m.getTotalVertices() > 10000 && m.renderOverlay)
          .map(m => ({ alfa: m.overlayAlpha, cor: m.overlayColor.asArray() })));
        const pisca = ['focus-nivel2', 'focus-maximo', 'focus-maximo-invertido'].includes(nome);
        assert.equal(corpo.length > 0, pisca, 'clarão branco somente nas passagens de carga');
        if (pisca) { assert.ok(corpo[0].alfa > .85); assert.deepEqual(corpo[0].cor, [1, 1, 1]); }
      }
      if (['queda-impacto', 'queda-deitada', 'levantar-pouso', 'fim-partida', 'fim-apos-final'].includes(nome)) {
        const piso = await page.evaluate(() => {
          const scene = globalThis.__laboratorio3d.scene, onda = scene.getMeshByName('sf4-onda-chao-0');
          return { ativo: onda.isEnabled(), y: onda.position.y,
            poeira: scene.meshes.filter(m => m.name.startsWith('sf4-poeira-chao-0-') && m.isEnabled()).length };
        });
        const vivo = ['queda-impacto', 'levantar-pouso'].includes(nome);
        assert.equal(piso.ativo, vivo, 'onda sincronizada com contato e pouso; depois some');
        assert.equal(piso.poeira, vivo ? 5 : 0);
        if (vivo) assert.ok(piso.y > 0 && piso.y < .05, 'onda rente ao piso');
      }
      if (['p1', 'p2', 'cp', 'ap', 'foc', 'k1', 'k2', 'ck', 'ak', 'tatsu'].includes(golpe)) {
        const efeitos = await page.evaluate(() => {
          const scene = globalThis.__laboratorio3d.scene;
          return { particulas: scene.getParticleSystemById('golpe-nevoa-0').emitRate,
            ativo: scene.getMeshByName('golpe-rastro-0').isEnabled(), largura: scene.getMeshByName('golpe-rastro-0').diameter };
        });
        assert.equal(efeitos.particulas, 0, 'golpes comuns sem névoa de fogo cobrindo o membro');
        assert.ok(!efeitos.ativo || efeitos.largura <= .08, 'rastro discreto de movimento');
        if (['p1', 'p2', 'cp', 'foc'].includes(golpe)) {
          const extensao = await page.evaluate(() => {
            const rastro = globalThis.__laboratorio3d.scene.getMeshByName('golpe-rastro-0');
            const xs = rastro.getVerticesData('position').filter((_, i) => i % 3 === 0);
            return rastro.isEnabled() ? Math.max(...xs) - Math.min(...xs) : 0;
          });
          assert.ok(extensao < 1.5, 'rastro da luva não atravessa a arena');
        }
      }
      if (['esp', 'espEx', 'ultra'].includes(golpe)) {
        const visual = await page.evaluate(() => {
          const scene = globalThis.__laboratorio3d.scene;
          const bolas = scene.meshes.filter(m => m.name.startsWith('golpe-bola-') && m.isEnabled());
          return { carga: scene.getMeshByName('hadouken-carga-0').isEnabled(),
            brancoSomado: bolas.some(m => m.material.emissiveColor.asArray().some(c => c > 0)),
            rotacoes: bolas.map(m => m.rotation.z) };
        });
        assert.equal(visual.carga, quadro < (golpe === 'ultra' ? 25 : 10), 'carga só antes do disparo');
        assert.equal(visual.brancoSomado, false, 'preservar azul da textura sem saturar tudo em branco');
        for (const rotacao of visual.rotacoes) assert.equal(rotacao, face > 0 ? 0 : Math.PI, 'rastro aponta para trás');
      }
      await page.locator('canvas').screenshot({ path: path.join(saida, `${nome}.png`) });
      if (nome === 'hadouken-viagem' || nome === 'hadouken-invertido') {
        const vapor = await page.evaluate(async () => {
          const lab = globalThis.__laboratorio3d, bola = lab.scene.getMeshByName('golpe-bola-0');
          const nuvens = lab.scene.meshes.filter(m => m.name.startsWith('hadouken-fumaca-0-') && m.isEnabled());
          const uvAntes = Array.from(bola.getVerticesData('uv'));
          const atras = nuvens.every(m => (bola.position.x - m.position.x) * Math.sign(lab.estado.proj[0].vx) > 0);
          KOSim.passo(lab.estado, [0, 0]); KOSim.passo(lab.estado, [0, 0]);
          const estado = JSON.stringify(lab.estado);
          await new Promise(resolve => lab.scene.onAfterRenderObservable.addOnce(() => resolve()));
          const uvDepois = Array.from(bola.getVerticesData('uv'));
          await new Promise(resolve => lab.scene.onAfterRenderObservable.addOnce(() => resolve()));
          return { quantidade: nuvens.length, atras, uvAntes, uvDepois,
            congelado: JSON.stringify(uvDepois) === JSON.stringify(Array.from(bola.getVerticesData('uv'))),
            estadoPreservado: JSON.stringify(lab.estado) === estado };
        });
        assert.ok(vapor.quantidade >= 3 && vapor.quantidade <= 5, 'rastro formado por volumes de vapor conforme a idade do disparo');
        assert.ok(vapor.atras, 'fumaça fica atrás do projétil nas duas direções');
        assert.notDeepEqual(vapor.uvDepois, vapor.uvAntes, 'contorno do vapor muda durante o voo');
        assert.ok(vapor.congelado && vapor.estadoPreservado, 'efeito congelado sem avançar o motor');
      }
      if (golpe === 'espEx') assert.equal(await page.evaluate(() => globalThis.__laboratorio3d.scene.meshes.filter(m => m.name.startsWith('golpe-bola-') && m.isEnabled()).length), 2);
      console.log('OK', nome, JSON.stringify(resultado));
    }
    assert.deepEqual(erros, []);
    console.log('OK poderes 3D, sem erros. Capturas:', saida);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
