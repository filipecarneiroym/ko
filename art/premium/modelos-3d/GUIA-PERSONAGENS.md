# Produção de um personagem completo

A Pipoca é a personagem piloto. A orientação atual é terminar sua aparência,
movimentos, efeitos e apresentação de combate antes de iniciar o próximo modelo.
O objetivo de acabamento continua em [PLANO-PREMIUM.md](../../../PLANO-PREMIUM.md).
Os parâmetros de identidade e os critérios comuns estão em
[direcao-visual.json](direcao-visual.json).

Compartilhar o contrato técnico não significa repetir a anatomia. Uivo precisa de
focinho, patas, cauda, musculatura, guarda e ataques próprios. O mesmo vale para
cada integrante do elenco. Não reutilizar o rosto ou a silhueta de Pipoca com
outra cor. Referência original, folha de vistas e atributos do motor compõem a
ficha de cada personagem; registrar o que é visível e o que foi inferido.

Para levar a arte final ao modelo 3D (base multivista em pose neutra,
calibração, roupas por campos, traços do rosto encaixados no relevo), siga
[PADRAO-REFINAMENTO-3D.md](PADRAO-REFINAMENTO-3D.md).

## Ficha da Pipoca

| Área | Resultado necessário para encerrar |
| --- | --- |
| Identidade | Coelha atlética creme, orelhas rosadas longas, olhos âmbar, focinho curto, expressão confiante e cauda curta reconhecíveis na câmera de luta. |
| Roupa | Top com alças, short índigo com faixas brancas, luvas vermelhas e faixas claras. Costuras e materiais coerentes com a arte; nenhuma penetração nas poses extremas. |
| Locomoção | Guarda, avanço, recuo, corrida, agachamento, salto duplo e pouso. Pés apoiados sem escorregar involuntariamente; trajetória vertical determinada pelo motor. |
| Combate | Dois socos, dois chutes, ataques baixos e aéreos, defesa alta/baixa, esquiva, recuo, quebra-combo e agarrão. Contato legível em cada janela inclusiva do motor. |
| Reações | Dano, queda, levantar, agarrada, tontura, vitória e derrota. A última pose se mantém nos estados terminais. |
| Assinatura | Cenoura bumerangue, Super da toca e Chuva de Cenouras. Efeitos separados da malha, sincronizados à simulação. |
| Som | Golpes, defesa, passos, salto, cenoura, toca, vozes e Final com identidade própria e volumes equilibrados. Vozes sintetizadas atuais são provisórias. |
| Integração | Partida completa com controles, HUD, efeitos e áudio; sem alteração das regras, do resultado ou dos comandos. |
| Desempenho | Recursos limitados e liberados ao sair; meta de 60 FPS conferida em celulares físicos, inclusive após aquecimento. |

## Revisão prática

1. Comparar frente, perfil, costas e três quartos com as duas referências,
   mantendo câmera e luz constantes. Conferir também na distância real da luta.
2. Revisar todos os 31 estados/ataques e suas transições. Medir apoio, alcance,
   continuidade e roupa entre chaves, além dos quadros inteiros.
3. Testar acerto, defesa e erro de cada ataque; interromper e cancelar golpes,
   pousar no meio de um ataque aéreo e inverter os lados.
4. Conferir que a cenoura continua após `esp`, que a toca respeita `sumido` e
   que Super e Final usam seus relógios distintos.
5. Jogar uma partida completa e revisar enquadramento, orelhas, efeitos, som,
   leitura de contato, pausa/retomada e recursos no fim da sessão.

O registro de revisão deve vincular imagens e relatórios ao SHA-256 do GLB.
Reexportar a malha invalida a prévia anterior. Um teste técnico verde confirma
somente aquilo que ele mede; contar 31 clips não aprova 31 animações.

O estudo atual continua no laboratório. Pelagem, acabamento de tecido,
expressões, parte das animações e áudio próprio ainda exigem produção e revisão.
O personagem e a migração do jogo principal não estão aprovados como finais.
