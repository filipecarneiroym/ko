# Pipoca jogável em 3D — plano

Objetivo: jogar uma partida completa **Pipoca × Pipoca (máquina, roupa
vermelha)** em uma arena 3D, com o motor `ko-sim.js`, os controles e a IA
`KOCPU` atuais. Depois da validação do usuário, os demais personagens entram
um por um seguindo [PADRAO-REFINAMENTO-3D.md](PADRAO-REFINAMENTO-3D.md).

Regras fixas: a animação nunca altera dano, colisão, tempo ou resultado; o
estado da simulação manda (posição, face, estado, quadro, hitstop). Nada é
"aprovado" sem o usuário jogar.

## Fase 1 — Pipoca v5 pronta para animar
- Esqueleto de 20 ossos com os **mesmos nomes** de `rig.mjs`, mas com as
  juntas medidas na anatomia da v5 (quadril, joelhos, tornozelos, ombros,
  cotovelos, punhos, pescoço, mandíbula, orelhas, cauda).
- Eixos do projeto: +Y para cima, frente em +X, escala do laboratório
  (corpo de 2,5 m), pés no piso, centro entre os pés na origem.
- Malha de jogo: v5 reduzida para o orçamento (alvo 25 mil triângulos,
  teto 40 mil) preservando as bordas das peças e os traços do rosto.
- Texturas assadas da v5 (cor, normal da malha detalhada, rugosidade),
  até 2048 px, no máximo 4 materiais. O tecido do uniforme em material
  próprio para trocar a cor (azul do jogador, vermelho da máquina).
- Pesos de pele (até 4 ossos por vértice) conferidos nas poses extremas:
  ombro, cotovelo, quadril, joelho, orelhas, cauda; sem atravessar roupa.

## Fase 2 — Os 31 movimentos na v5
- Reaproveitar as fontes atuais (guarda Mixamo, socos, chutes, posturas,
  técnicas, estados, atuação): rotações preservadas, comprimentos de osso
  da v5; o IK recalcula contatos para o corpo novo.
- Regenerar envelopes de piso e conferir cada golpe nas janelas do motor,
  nos dois lados, com as caixas de colisão visíveis.
- Revisão visual golpe a golpe (frente, perfil, câmera de luta).

## Fase 3 — Variante vermelha e efeitos
- Pipoca da máquina: top e short vermelhos com listras brancas.
- Cenoura bumerangue, Super da toca, Chuva de Cenouras, impactos, defesa,
  poeira: efeitos separados da malha, no relógio da simulação.

## Fase 4 — Arenas 3D (mapas de luta)
- Todas as arenas do jogo passam a ser 3D: academia, feira, floresta, neve,
  praia e telhado (`CENARIOS` em `ko-arte.js`), com a mesma identidade.
- Primeira arena com acabamento máximo para validar o padrão (luz assada,
  chão com sombra de contato, fundo com profundidade, animação ambiente leve,
  leitura clara dos lutadores e do HUD); as outras cinco seguem o padrão
  aprovado, uma por vez.
- Orçamento de desempenho para celular medido junto com os dois lutadores.

## Fase 5 — Partida jogável
- Renderizador 3D como **opção** no jogo (o 2D continua funcionando),
  Pipoca × Pipoca vermelha contra `KOCPU`, câmera de luta, HUD, som.
- **Máquina nos três níveis** já existentes em `public/js/ko-cpu.js`
  (`KOCPU.PERFIS`): **Fácil** (reação 22 quadros, defesa 20 %, sem combo),
  **Médio** (12 quadros, defesa 50 %, combo 35 %) e **Difícil** (6 quadros,
  defesa 75 %, combo 65 %). Os três têm de funcionar no 3D, escolhidos no
  menu como hoje; o 3D não muda a IA.
- **Multiplayer no 3D também:** 1×1 versus (dois controles/toque no mesmo
  aparelho) e online, Pipoca de roupa azul × Pipoca de roupa vermelha. Em
  confronto espelho, o jogador 1 usa a azul e o jogador 2 a vermelha; no
  online cada aparelho mostra as mesmas cores para os mesmos lados.
- Comparar hash da simulação com e sem 3D (o 3D não pode mudar a luta).
- Teste do usuário → ajustes → aprovação → próximo personagem.
