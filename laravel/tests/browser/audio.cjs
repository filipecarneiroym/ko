// Decodificação real dos MP3s e margem dos impactos no mixer Web Audio.
// node laravel/tests/browser/audio.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.browser-check/node_modules/playwright'));
const producao = JSON.parse(fs.readFileSync(path.join(root, 'public/audio/locutor/producao.json'), 'utf8'));
for (const [nome, chamada] of Object.entries(producao.chamadas)) {
  if (nome.startsWith('round-')) assert(chamada.duracao < .9, 'Round termina antes da chamada Lutem');
  assert(chamada.pico < .99, 'MP3 decodificado conserva margem');
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.KO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    const erros = [], pedidos = [];
    page.on('pageerror', erro => erros.push(erro.message));
    await page.route('http://ko-audio.test/**', async rota => {
      const url = new URL(rota.request().url());
      if (url.pathname === '/') return rota.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Áudio K.O</title>' });
      const arquivo = path.join(root, 'public', url.pathname);
      pedidos.push(url.pathname);
      return rota.fulfill({ contentType: url.pathname.endsWith('.mp3') ? 'audio/mpeg' : 'text/javascript', body: fs.readFileSync(arquivo) });
    });
    await page.goto('http://ko-audio.test/');
    await page.addScriptTag({ url: '/js/ko-audio.js' });
    const resultados = await page.evaluate(async () => {
      async function renderizar(taxa, quantidade, fala) {
        const contexto = new OfflineAudioContext(2, taxa * 3, taxa);
        // O contexto offline aceita agendar antes de renderizar. O proxy
        // expõe o mesmo estado de um contexto real desbloqueado por gesto.
        const ctx = new Proxy(contexto, { get(alvo, chave) {
          if (chave === 'state') return 'running';
          const valor = Reflect.get(alvo, chave, alvo);
          return typeof valor === 'function' ? valor.bind(alvo) : valor;
        } });
        const som = KOSom.criar(ctx);
        await som.preparar();
        for (let i = 0; i < quantidade; i++) som.evento({ t: i % 4 ? 'acerto' : 'defendeu', forte: i % 3 });
        const aceitou = som.locutor(fala);
        const buffer = await contexto.startRendering();
        let pico = 0, energia = 0;
        for (const valor of buffer.getChannelData(0)) { pico = Math.max(pico, Math.abs(valor)); energia += valor * valor; }
        return { taxa, pico, energia, aceitou };
      }
      const saida = [];
      for (const taxa of [44100, 48000]) saida.push(await renderizar(taxa, 30, { t: 'ko' }));
      saida.push(await renderizar(48000, 0, { t: 'round', n: 1 }));
      saida.push(await renderizar(48000, 0, { t: 'perfeito' }));
      saida.push(await renderizar(48000, 0, { t: 'vitoria', vencedor: 0, lutador: 'pipoca' }));
      saida.push(await renderizar(48000, 0, { t: 'acerto' }));
      return saida;
    });
    for (const resultado of resultados.slice(0, 5)) {
      assert(resultado.pico > .01 && resultado.pico <= .94, 'Mixer audível, com margem abaixo de clipping');
      assert(resultado.energia > 1, 'Áudio realmente renderizado');
      assert.equal(resultado.aceitou, true);
    }
    assert.equal(resultados[5].aceitou, false, 'Golpe não recebe fala do locutor');
    assert.equal(resultados[5].energia, 0, 'Evento sem fala permanece sem voz');
    assert.deepEqual(erros, [], 'Sem erros no navegador');
    // 6 instâncias × 9 chamadas fixas + 1 anúncio de vencedor baixado sob demanda.
    assert.equal(pedidos.filter(url => url.endsWith('.mp3')).length, 6 * 9 + 1, 'Chamadas fixas preparadas; vencedor sob demanda; golpes não baixam áudio');
    console.log(JSON.stringify({ ok: true, resultados }, null, 2));
  } finally { await browser.close(); }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
