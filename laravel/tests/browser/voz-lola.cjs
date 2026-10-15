// Decodificação e mixagem reais das vozes humanas da Lola, sem saída de som.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage(), erros = [], pedidos = [];
    page.on('pageerror', e => erros.push(e.message));
    await page.route('http://voz-lola.test/**', async rota => {
      const nome = new URL(rota.request().url()).pathname;
      if (nome === '/') return rota.fulfill({ contentType: 'text/html', body: '<title>Voz Lola</title>' });
      pedidos.push(nome);
      return rota.fulfill({ contentType: nome.endsWith('.mp3') ? 'audio/mpeg' : 'text/javascript', body: fs.readFileSync(path.join(root, 'public', nome)) });
    });
    await page.goto('http://voz-lola.test/');
    await page.addScriptTag({ url: '/js/ko-audio.js' }); await page.addScriptTag({ url: '/js/ko-voz.js' });
    const resultados = await page.evaluate(async () => {
      const saida = [];
      for (const taxa of [44100, 48000]) {
        const contexto = new OfflineAudioContext(2, taxa, taxa);
        let fontes = 0, osciladores = 0;
        const ctx = new Proxy(contexto, { get(alvo, chave) {
          if (chave === 'state') return 'running';
          if (chave === 'createBufferSource') return () => {
            const fonte = alvo.createBufferSource(), start = fonte.start.bind(fonte);
            fonte.start = (...args) => { fontes++; return start(...args); }; return fonte;
          };
          if (chave === 'createOscillator') return () => { osciladores++; return alvo.createOscillator(); };
          const valor = Reflect.get(alvo, chave, alvo); return typeof valor === 'function' ? valor.bind(alvo) : valor;
        } });
        const som = KOSom.criar(ctx);
        await KOVoz.preparar(ctx, som.saida); await KOVoz.preparar(ctx, som.saida);
        for (const t of ['ex', 'ataque', 'especial']) KOVoz.grito(ctx, 'pipoca', true, 0, { t, golpe: 'espEx', lado: 0, quadro: 1 });
        const umaVoz = fontes;
        KOVoz.grito(ctx, 'pipoca', true, 0, { t: 'focusSolto', golpe: 'foc', lado: 1, quadro: 1 });
        const duasVozes = fontes;
        for (let i = 0; i < 30; i++) som.evento({ t: i % 3 ? 'acerto' : 'defendeu', forte: i % 3 });
        const buffer = await contexto.startRendering();
        let pico = 0, energia = 0;
        for (const valor of buffer.getChannelData(0)) { pico = Math.max(pico, Math.abs(valor)); energia += valor * valor; }
        saida.push({ taxa, umaVoz, duasVozes, osciladores, pico, energia });
      }
      return saida;
    });
    for (const r of resultados) {
      assert.equal(r.umaVoz, 1, 'EX não repete a voz pelos três eventos'); assert.equal(r.duasVozes, 2, 'os dois lados têm voz');
      assert.equal(r.osciladores, 0, 'Lola usa gravações humanas, sem beep');
      assert.ok(r.pico > .01 && r.pico < .94 && r.energia > 1, 'mixer com margem, sem clipping');
    }
    assert.equal(pedidos.filter(p => p.endsWith('.mp3')).length, 18, '9 arquivos por contexto, nenhum download repetido durante golpes');
    assert.deepEqual(erros, []); console.log(JSON.stringify({ ok: true, resultados }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
