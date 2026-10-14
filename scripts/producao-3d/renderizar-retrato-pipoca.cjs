// Retrato da seleção gerado do mesmo GLB usado na luta.
// node scripts/producao-3d/renderizar-retrato-pipoca.cjs [azul|vermelha]
// azul: jogador 1 (pipoca-3d-retrato.png); vermelha: lado 2 (pipoca-3d-retrato-vermelha.png).
const { build } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const origem = 'http://127.0.0.1:8049';
const cor = process.argv[2] === 'vermelha' ? 'vermelha' : 'azul';
const destino = path.join(root, 'public/personagens', cor === 'azul' ? 'pipoca-3d-retrato.png' : 'pipoca-3d-retrato-vermelha.png');

(async () => {
  const bundle = await build({
    stdin: { resolveDir: root, loader: 'js', contents: `
      import { Engine } from '@babylonjs/core/Engines/engine.js';
      import { Scene } from '@babylonjs/core/scene.js';
      import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
      import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
      import { Color4 } from '@babylonjs/core/Maths/math.color.js';
      import { carregarModelo } from './src/3d/modelo-glb.js';
      import { criarApresentacao } from './src/3d/apresentacao.js';
      const engine = new Engine(document.querySelector('canvas'), true, { preserveDrawingBuffer: true, alpha: true });
      const scene = new Scene(engine); scene.useRightHandedSystem = true;
      const camera = new ArcRotateCamera('retrato', -.16, Math.PI / 2, 6, Vector3.Zero(), scene);
      camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
      const apresentacao = criarApresentacao(scene);
      scene.clearColor = new Color4(0, 0, 0, 0);
      scene.getMeshByName('piso').setEnabled(false);
      scene.getMeshByName('limite-arena').setEnabled(false);
      (async () => {
        const modelo = await carregarModelo(await (await fetch('/modelos/estudos/pipoca-v5-${cor}.glb')).arrayBuffer(), 'pipoca', KOSim, scene);
        apresentacao.prepararModelo(modelo);
        modelo.atualizar({ x: 0, y: 0, face: 1, visivel: true, clip: 'parado', quadro: 0, ciclico: true });
        await scene.whenReadyAsync();
        scene.render();
        const topo = Math.max(...modelo.malhas.map(m => m.getBoundingInfo().boundingBox.maximumWorld.y));
        const ombro = scene.getTransformNodeByName('braco_E').getAbsolutePosition().y;
        const base = ombro - .17, altura = topo + .08 - base;
        camera.setTarget(new Vector3(0, (base + topo + .08) / 2, 0));
        camera.orthoTop = altura / 2; camera.orthoBottom = -altura / 2;
        camera.orthoLeft = -altura * .4; camera.orthoRight = altura * .4;
        scene.render();
        window.retratoPronto = { topo, ombro, altura };
      })().catch(e => { window.erroRetrato = e.message; });
    ` },
    bundle: true, write: false, format: 'iife', minify: true,
  });
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 800 }, serviceWorkers: 'block' });
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    await page.route(origem + '/**', rota => {
      const url = new URL(rota.request().url());
      if (url.pathname === '/retrato.js') return rota.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text });
      if (url.pathname === '/ko-sim.js') return rota.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'public/js/ko-sim.js')) });
      if (url.pathname.startsWith('/modelos/')) return rota.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync(path.join(root, 'public', url.pathname)) });
      return rota.fulfill({ contentType: 'text/html', body: '<!doctype html><style>body{margin:0}canvas{display:block;width:640px;height:800px}</style><script defer src="/ko-sim.js"></script><script defer src="/retrato.js"></script><canvas width="640" height="800"></canvas>' });
    });
    await page.goto(origem);
    await page.waitForFunction(() => window.retratoPronto || window.erroRetrato, null, { timeout: 120000 });
    const estado = await page.evaluate(() => ({ resultado: window.retratoPronto, erro: window.erroRetrato }));
    if (estado.erro || erros.length) throw new Error(estado.erro || erros.join('\n'));
    const png = await page.locator('canvas').evaluate(cv => cv.toDataURL('image/png').split(',')[1]);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(png, 'base64'));
    console.log(JSON.stringify({ arquivo: path.relative(root, destino), ...estado.resultado }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
