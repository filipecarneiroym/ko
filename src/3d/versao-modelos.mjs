// Atualizar ao gerar os GLBs jogáveis: prefixos SHA-256 azul e vermelho.
// A URL distinta também invalida cópias guardadas por proxies de publicação.
export const VERSAO_MODELOS = '238ea6b85c06-b5fc63516e1c';
export function urlModeloAtual(caminho) {
  if (!caminho.startsWith('/modelos/estudos/pipoca-v5-')) return caminho;
  return `${caminho}${caminho.includes('?') ? '&' : '?'}modelo=${VERSAO_MODELOS}`;
}
