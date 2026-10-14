// Converte a luz de cada arena (fontes/ambiente.hdr) em ambiente.env: cubo já
// pré-filtrado em PNG RGBD, o formato que o Babylon recomenda para celular.
// O HDR em ponto flutuante chega preto em aparelhos sem filtragem linear de
// float (iPhone), e a lutadora fica escura.
//   node scripts/producao-3d/gerar-env-arenas.cjs
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
// Fonte: art/premium/arenas/<arena>/fontes/ambiente.hdr (preparar-arena.py).
const fonte = a => path.join(root, 'art/premium/arenas', a, 'fontes/ambiente.hdr');
const arenas = fs.readdirSync(path.join(root, 'public/arenas')).filter(a => fs.existsSync(fonte(a)));

(async () => {
  const entrada = `
    import { Engine } from '@babylonjs/core/Engines/engine.js';
    import { Scene } from '@babylonjs/core/scene.js';
    import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture.js';
    import { CreateEnvTextureAsync } from '@babylonjs/core/Misc/environmentTextureTools.js';
    window.converter = async (url) => {
      const engine = new Engine(document.querySelector('canvas'), false, { preserveDrawingBuffer: true });
      const scene = new Scene(engine);
      const hdr = new HDRCubeTexture(url, scene, 256, false, true, false, true);
      await new Promise((ok, falha) => { const t = setTimeout(() => falha(new Error('tempo')), 120000); hdr.onLoadObservable.addOnce(() => { clearTimeout(t); ok(); }); });
      while (!hdr.isReady()) await new Promise(r => setTimeout(r, 100));
      const dados = await CreateEnvTextureAsync(hdr, { imageType: 'image/png' });
      const bytes = new Uint8Array(dados); let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      engine.dispose();
      return btoa(s);
    };`;
  const pacote = await build({ stdin: { contents: entrada, resolveDir: root }, bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent' });
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.route('http://env.local/**', rota => {
      const caminho = new URL(rota.request().url()).pathname;
      if (caminho === '/') return rota.fulfill({ contentType: 'text/html', body: '<canvas width="64" height="64"></canvas>' });
      if (caminho === '/c.js') return rota.fulfill({ contentType: 'text/javascript', body: pacote.outputFiles[0].text });
      return rota.fulfill({ body: fs.readFileSync(fonte(caminho.split('/')[1])) });
    });
    await page.goto('http://env.local/');
    await page.addScriptTag({ url: '/c.js' });
    for (const arena of arenas) {
      const base64 = await page.evaluate(u => window.converter(u), `/${arena}/ambiente.hdr`);
      const destino = path.join(root, 'public/arenas', arena, 'ambiente.env');
      fs.writeFileSync(destino, Buffer.from(base64, 'base64'));
      console.log(arena, Math.round(fs.statSync(destino).size / 1024), 'KB');
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
