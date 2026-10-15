# Queda, salto e chute da Lola — 15/10/2026

Revisão visual dos trechos de recuperação do Ryu e dos chutes já extraídos
dos vídeos enviados por Filipe. Alterações exclusivamente visuais: motor,
trajetórias, alcance, dano e tempos de regra permanecem iguais.

- **Salto:** o clipe esperava q44 para abrir as pernas, mas o salto real
  toca o chão em aproximadamente 35 passos. Agora recolhe entre q12–20,
  abre em q27 e prepara o pouso em q33. A rotação começa depois do preparo,
  chega à meia volta no ápice e termina antes de tocar o chão. Pulo parado
  continua sem mortal; frente e trás giram em sentidos opostos.
- **Queda:** braços recolhem durante a descida e relaxam no contato. Há
  uma pequena reação ao impacto e assentamento progressivo. O contato
  continua no quadro do efeito existente, sem deslocar a poeira no tempo.
- **Levantada:** mais poses entre o apoio das luvas e a fase aérea;
  quadril sobe em arco e o tronco abre antes do pouso. Luvas continuam
  junto à cabeça na preparação, e a animação termina exatamente na guarda.
- **Chute K:** giro máximo do quadril aumentado de 1,15 para 1,55 rad
  (aproximadamente 66° → 89°), com pivô correspondente da sola. Na
  orientação em que a perna D chuta, ela antes chegava a apenas 87% da
  extensão. A transferência de peso corrigida permite 99,99% nos dois
  lados, sem hiperextensão; recolhe antes de retornar à guarda.

O pé de apoio permanece no mesmo ponto durante o K; a perna voltada à
câmera continua sendo a que chuta. Não foi adicionada uma volta de 360°.
O centro do corpo baixa ligeiramente durante a transferência de peso,
para a perna de apoio continuar alcançando o piso. O K usa poses a cada
quarto de quadro para manter o apoio também durante a interpolação.
Testes verificam todas as janelas ativas, extensão, giro real do quadril
e retorno, nas duas roupas e orientações. Os socos também foram conferidos
para detectar interferência no rig e no olhar.

O teste da recuperação encontrou penetração de 5,56 mm entre chaves no
primeiro ajuste. A amostragem visual da levantada foi aumentada de oito
para dezesseis subdivisões, medindo todos os vértices. No resultado final,
a pior penetração entre chaves ficou em cerca de 1,95 mm, dentro da
tolerância de 5 mm do teste; nas chaves inteiras ficou praticamente zero.
Não se afirma ausência matemática de penetração em qualquer instante.

O salto foi exercitado com entradas reais do motor: frente, trás e parado,
dos dois lados, nas duas cores. Todos os vértices da malha foram medidos
durante cada sequência; a menor altura foi positiva, cerca de 0,138 mm.
O renderizador preservou o estado da simulação em cada amostra.

Capturas no navegador: sete momentos de salto, quatro momentos da queda
real causada por rasteira, impacto, pouso da levantada e K nas duas faces.
O efeito de chão permaneceu sincronizado. As capturas estão em
`estudos-mixamo/pipoca-v5-jogo/poderes/`.

Os GLBs continuam com 39 clipes, 20 ossos e 28.346 triângulos. Cada arquivo
cresceu cerca de 334 KB devido à precisão da levantada e do K, ficando em
aproximadamente 7,1 MB. URLs dos modelos atualizadas com os novos hashes.

A aprovação visual depende de Filipe testar a versão publicada.
