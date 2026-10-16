// Atualizar ao gerar os GLBs jogáveis: prefixos SHA-256 azul e vermelho.
// A URL distinta também invalida cópias guardadas por proxies de publicação.
export const VERSAO_MODELOS = 'e587cf06f525-b785945e4355';
export function urlModeloAtual(caminho) {
  if (!caminho.startsWith('/modelos/estudos/pipoca-v5-')) return caminho;
  return `${caminho}${caminho.includes('?') ? '&' : '?'}modelo=${VERSAO_MODELOS}`;
}
