// Inventário dos valores reais do motor, sem modificar o balanceamento.
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../public/js/ko-sim.js');
const linhas = ['# Inventário de combate', '', 'Valores atuais do motor. Velocidade usa unidades internas por quadro; dano de janelas é nominal, não garantia de dano total (depende de contato, defesa, combos e regras especiais). Projéteis podem acertar de forma distinta. Forja e Bórun ainda não integram o motor.', '', '| Lutador | Vida | Andar | Soco inicial: dano / preparação / duração | Especial | Super |', '| --- | --- | --- | --- | --- | --- |'];
function golpe(g) {
  const danos = (g.janelas || []).map(j => j.dano).join('+');
  const partes = [];
  if (danos) partes.push('janelas ' + danos);
  if (g.proj) partes.push('projétil ' + g.proj.dano);
  if (g.agarra) partes.push('agarrão ' + g.agarra.dano + ', alcance ' + g.agarra.alcance);
  if (g.forca) partes.push('força temporária');
  if (g.armadura) partes.push('armadura temporária');
  if (!partes.length) partes.push('efeito específico');
  return partes.join('; ') + ' · ' + g.dur + ' quadros';
}
for (const l of Object.values(K.LUTADORES)) {
  const p = l.golpes.p1;
  linhas.push(`| ${l.nome} | ${l.vida} | ${l.andar} | ${p.janelas.map(j=>j.dano).join('+')} / ${Math.min(...p.janelas.map(j=>j.de))} / ${p.dur} | ${golpe(l.golpes.esp)} | ${golpe(l.golpes.sup)} |`);
}
linhas.push('', 'Todos têm teto de poder de ' + K.PODER_MAX + '. A CPU altera decisões, não atributos. Consulte BALANCEAMENTO.md para os 2160 confrontos e limitações da auditoria.', '', 'Efeitos de acerto e defesa são apenas visuais. Sons e gritos são sintetizados, sem gravações comerciais. Cenários atuais: praia, telhado, floresta, feira, academia e neve, desenhados em Canvas; não são cenários 3D.', '', 'Próxima validação: comparar dano efetivo, recuperação após defesa, capacidade de interromper repetições e respostas por estilo, com jogadores humanos. Valores diferentes são parte da identidade; não comprovam equilíbrio por si só.', '');
fs.writeFileSync(path.join(__dirname, 'INVENTARIO-COMBATE.md'), linhas.join('\n'));
console.log('Inventário dos 16 lutadores atualizado a partir do motor.');
