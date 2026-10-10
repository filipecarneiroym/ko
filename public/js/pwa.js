// Registra o service worker (app instalável e tela "sem conexão").
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
