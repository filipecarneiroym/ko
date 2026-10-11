# Auditoria de balanceamento

2160 partidas reproduzíveis: todos os 120 pares, dois lados, nove repetições com sementes fixas e níveis fácil, médio e difícil alternados. Cada lutador participou de 270 partidas. Nenhuma ficou incompleta. Dados em `triagem-equilibrio-ampliada.json`.

Volt venceu 67,0%; Maromba 63,3%; Fóssil 64,4%; Nix 23,0%; Vô Tião 30,4%; Truque 34,8%. A distribuição indica necessidade de revisão, mas o bot usa a mesma estratégia para estilos diferentes e não mede sozinho a força em mãos humanas. Não ajustar dano ou vida apenas para forçar 50% contra esse bot.

Próximas verificações: separar resultados por nível e lado; avaliar alcance, preparação, recuperação e vantagem de golpes defendidos; procurar repetições sem resposta; testar estratégias específicas de cada estilo; comparar antes/depois com as mesmas sementes e partidas humanas.

Separação por nível (90 partidas por lutador em cada nível):

| Lutador | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| Volt | 52,2% | 74,4% | 74,4% |
| Vô Tião | 38,9% | 36,7% | 15,6% |
| Nix | 5,6% | 22,2% | 41,1% |
| Kilo | 92,2% | 63,3% | 33,3% |
| Maromba | 83,3% | 65,6% | 41,1% |

A inversão de Kilo e Maromba entre os níveis confirma forte influência da estratégia. Volt mantém vantagem nos dois níveis mais altos, e Vô Tião cai muito contra defesa/combo mais frequentes. Esses são candidatos prioritários à análise de golpes. Nix precisa de estratégia de mobilidade própria antes de concluir que seus atributos estão fracos.

Forja e Bórun ainda não estão no motor e não integram esta auditoria. Seus atributos descritivos são propostas, sem multiplicadores de dano ou resistência aprovados.

Reprodução: `node laravel/tests/js/auditar-equilibrio.cjs art/premium/triagem-equilibrio-ampliada.json 9`.
