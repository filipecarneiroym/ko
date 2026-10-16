// Atualizar ao gerar os GLBs jogáveis: prefixos SHA-256 azul e vermelho.
// A URL distinta também invalida cópias guardadas por proxies de publicação.
export const VERSAO_MODELOS = '13aad37a3eb1-b1f0a6bbb60b';
export function urlModeloAtual(caminho) {
  if (!caminho.startsWith('/modelos/estudos/pipoca-v5-')) return caminho;
  return `${caminho}${caminho.includes('?') ? '&' : '?'}modelo=${VERSAO_MODELOS}`;
}
