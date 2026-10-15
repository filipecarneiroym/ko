// Registra o service worker (app instalável e tela "sem conexão").
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

// Feedback no primeiro toque; mantém o submit nativo e a validação do navegador.
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.enviando === 'sim') { e.preventDefault(); return; }
  form.dataset.enviando = 'sim';
  const botao = e.submitter || form.querySelector('button');
  if (botao) { botao.dataset.textoOriginal = botao.textContent; botao.textContent = 'Aguarde…'; botao.setAttribute('aria-busy', 'true'); }
});
addEventListener('pageshow', () => {
  document.querySelectorAll('form[data-enviando]').forEach((form) => {
    delete form.dataset.enviando;
    form.querySelectorAll('[aria-busy="true"]').forEach((botao) => {
      botao.textContent = botao.dataset.textoOriginal;
      botao.removeAttribute('aria-busy');
    });
  });
});

// Menus fora da arena usam o mesmo controle, sem iniciar um segundo leitor na luta.
if (!document.getElementById('ko-config') && window.KOControle) {
  const controleMenu = KOControle.criar({ carregar: (id) => {
    try { return JSON.parse(localStorage.getItem('ko-pad:' + id)); } catch (e) { return null; }
  } });
  function quadroMenu() {
    const estados = controleMenu.atualizar();
    KOControle.navegar(document.querySelector('[role="dialog"]') || document.body, estados[0]);
    requestAnimationFrame(quadroMenu);
  }
  requestAnimationFrame(quadroMenu);
}
