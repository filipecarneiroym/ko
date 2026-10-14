import { ESTADOS_VISUAIS } from './estado-visual.mjs';

export const LIMITE_GLB = 24 * 1024 * 1024;
export const GOLPES_OPCIONAIS = ['dp'];
export function validarGlb(buffer, id, simulador) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 || buffer.byteLength > LIMITE_GLB) throw new Error('Use um GLB de até 24 MB.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('Arquivo GLB 2.0 inválido.');
  const tamanhoJson = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || tamanhoJson > buffer.byteLength - 20) throw new Error('Cabeçalho GLB inválido.');
  let doc;
  try { doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, tamanhoJson))); }
  catch { throw new Error('Descrição do GLB inválida.'); }
  if (doc.asset?.version !== '2.0' || !doc.skins?.length || !doc.meshes?.length) throw new Error('O modelo precisa de malha e esqueleto glTF 2.0.');
  // O laboratório recebe arquivos completos, sem downloads externos ou decodificadores por CDN.
  if ([...(doc.buffers || []), ...(doc.images || [])].some(r => r.uri !== undefined)) throw new Error('Incorpore buffers e texturas no próprio GLB.');
  if (doc.extensionsRequired?.length || doc.extensionsUsed?.length) throw new Error('Exporte o GLB sem extensões nesta primeira etapa.');
  const golpes = simulador.LUTADORES[id]?.golpes;
  if (!golpes) throw new Error('Lutador desconhecido.');
  // Golpes novos podem faltar em arquivos de estudo antigos; os modelos de jogo da v5 trazem todos.
  const obrigatorios = [...ESTADOS_VISUAIS, ...Object.keys(golpes).filter(n => !GOLPES_OPCIONAIS.includes(n))];
  const nomes = (doc.animations || []).map(a => a.name);
  if (new Set(nomes).size !== nomes.length) throw new Error('As animações precisam de nomes únicos.');
  const faltantes = obrigatorios.filter(n => !nomes.includes(n));
  if (faltantes.length) throw new Error(`Animações ausentes: ${faltantes.join(', ')}.`);
  return doc;
}
