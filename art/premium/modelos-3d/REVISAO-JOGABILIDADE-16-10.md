# Revisão de direcional, chutes e recuperação — 16/10/2026

Relato de Filipe: direção presa ao soltar, chutes alternando pernas e recuperação/derrota com braços para baixo.

## Correções

- O toque começa na área da alavanca, com tolerância de 12 px; arrastar para fora continua capturado. Botões ocultos não recebem comandos por posição.
- A soltura é observada também no capturador global. A associação entre Touch.identifier e PointerEvent.pointerId permite soltar a direção por `touchend` mesmo sem `pointerup`, mantendo outro dedo no K. `touchend` sem dedos e `touchcancel` limpam os toques; resize, rotação, ocultação da página e perda de foco limpam os controles. Pulsos rápidos de golpes continuam preservados.
- O chute alto, usado durante a corrida e no combo P/P/K, também tem variante por câmera. K parado e K alto usam a perna voltada à tela, mantendo a outra como apoio. O motor, dano e janelas permanecem iguais.
- Caída, começo da levantada e derrota compartilham a pose com luvas junto da cabeça. No impulso, o quadril sobe e o peito permanece inclinado para trás antes do pouso e da guarda.
- GLBs das duas cores: 45 clipes e 20 ossos, com nova versão de URL pelo hash para invalidar o cache dos modelos.

## Referências e verificação

Vídeos locais: `tmp/analise-video-completo/levantada-video.mp4` (detalhe da recuperação de Ryu) e `segundo-video.mp4` (sequência de chutes de Chun-Li). Quadros consultados: `levantada-ryu-detalhe.jpg` e `chun-li-chute-detalhe.jpg`.

O teste da partida real usa eventos de toque do navegador via CDP: toque fora da alavanca, direção com K, arrasto externo, soltura da direção mantendo K e omitindo pointerup, soltura de ambos e cancelamento do gesto. Verifica que a personagem para, não só a aparência do botão. Também verifica todos os botões pelo controle, defesa e a sequência real caído → levantando → parado.

Testes geométricos verificam contato dos pés com as caixas ativas, perna voltada à câmera, apoio do chute alto, luvas junto da cabeça, inclinação do peito no arco, emendas e pele acima do piso. A auditoria do motor executa 34 comandos, defesa alta/baixa dos dois lados e partidas completas em três dificuldades. As capturas incluem chutes, queda, recuperação, derrota, vapor do projétil, EX e Focus.

Os testes automatizados verificam esses casos; a aprovação visual e o comportamento no aparelho de Filipe dependem de ele testar a publicação.

Resultado final: 202 testes JavaScript passaram; partida real e regressão isolada de soltura passaram; 15 capturas de movimentos/efeitos e a recaptura do arco final passaram; pacotes 3D conferidos contra as fontes.
