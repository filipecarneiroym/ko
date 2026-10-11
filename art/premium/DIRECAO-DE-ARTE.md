# Direção de arte — primeira luta premium

## Referências originais

- `conceitos/pipoca-uivo-arena-v1.png`: alvo de iluminação, materiais e composição.
- `conceitos/pipoca-turnaround-v1.png`: frente, lado e costas para produção da Pipoca.

As imagens são conceitos gerados, não modelos 3D nem imagens do jogo atual. Proporções e detalhes precisam ser normalizados na modelagem; uma imagem de referência não garante consistência geométrica.

## Identidade

Personagens animais expressivos, silhuetas claras, volumes esculpidos e materiais estilizados. Pipoca usa roupa esportiva azul e luvas vermelhas; Uivo usa roupa de luta índigo e faixas claras. Arena piloto: telhado brasileiro à noite, luz principal âmbar e recorte violeta. Manter o primeiro plano livre e contraste entre lutadores e cenário.

## Produção do primeiro lutador

1. Modelar corpo, roupa e acessórios com topologia adequada a deformações.
2. Construir esqueleto com controles para orelhas e cauda; conferir pés, joelhos, ombros e luvas em poses extremas.
3. Produzir guarda, caminhada, recuo, agachar, salto, aterrissagem, soco, chute, defesa, dano, queda, recuperação, especial, super e vitória.
4. Vincular cada animação aos quadros da simulação existente. A posição visual não altera colisões nem o resultado da partida.
5. Exportar o modelo com animações e materiais; validar carregamento, memória e desempenho em aparelhos físicos antes de repetir no elenco.

Usar tufos esculpidos e texturas para o pelo na primeira versão. Evitar depender de simulação de pelos, tecido ou efeitos caros para a identidade do personagem.

## Critérios da demonstração

- Os golpes devem ser distinguíveis pela preparação, contato e recuperação.
- Efeitos não podem encobrir o adversário ou ocultar projéteis importantes.
- Tremor de câmera, flashes e brilho precisam de opção de redução.
- Som de golpe começa junto ao evento correspondente; vozes não podem acumular falas.
- Interface deixa a área central da arena livre, respeita as bordas seguras e mostra foco ao usar controle.
- Medir tempo dos quadros e atraso dos comandos. A meta é 60 quadros por segundo; os iPhones suportados ainda precisam ser identificados e medidos.
- Revisar uma partida completa com Pipoca e Uivo antes de expandir a produção.

## Próximo marco técnico

Protótipo de renderização 3D separado do jogo publicado, com um personagem animado e a arena. A escolha do renderizador e novas dependências serão revisadas antes da instalação. Ainda faltam modelos, animações e áudio gravado; nenhuma equivalência com produção AAA foi demonstrada.
