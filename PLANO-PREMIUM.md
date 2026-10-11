# K.O — plano de evolução premium

## Objetivo e escopo

Usar Street Fighter IV como referência de acabamento: personagens com volume,
animações expressivas, golpes com peso, direção de câmera, cenários detalhados e
áudio próprio. Preservar os personagens e a identidade familiar do K.O.

A direção proposta é 3D estilizado com luta em plano 2D, mantendo o acesso por PWA.
O padrão visual será validado numa demonstração jogável antes de produzir todo o
elenco. Comparação com a referência não é garantia de equivalência a uma produção
de grande estúdio: a entrega será avaliada pelos critérios abaixo.

Escopo inicial: Pipoca, Uivo e uma arena noturna. Os demais 14 lutadores permanecem
na versão atual enquanto a nova apresentação está em desenvolvimento.

## Estado de partida

Revisão de 11/10/2026: 40 testes PHP (191 verificações) e 41 testes JavaScript passaram. Fluxo de salas, reconexão, ranking, revanche, dois controles e 16 telas de vitória conferidos no Edge emulado. Laboratório 3D importa GLB animável e texturizado sob CSP real, recupera contexto WebGL e retoma eventos de bfcache. Evidência e limites em `art/premium/REVISAO-LABORATORIO-3D.md`. Folhas de Pipoca/Uivo prontas para referência de modelagem; modelos finais continuam pendentes. Os 16 lutadores atuais continuam jogáveis; Forja e Bórun ainda precisam de implementação e produção, para chegar ao elenco pretendido de 18.

- Motor determinístico em JavaScript, apresentação Canvas 2D e backend Laravel.
- Melhorias locais de PIN, controles, salas, reconexão, ranking e vozes sintetizadas.
- 31 testes PHP e 30 testes JavaScript passaram na revisão anterior.
- Teste em dois navegadores com tela mobile passou; aparelhos físicos ainda precisam
  ser validados. O cenário terminal do teste é preparado artificialmente para
  verificar ranking e revanche; não substitui partidas completas jogadas por pessoas.
- Render publicado ainda precisa receber e validar o deploy preparado.
- Os modelos 3D, rigs, animações e gravações finais ainda não existem.

## Etapa 1 — estabilizar a versão publicada

Entregar:
- Backup consistente do banco atual e preservação da APP_KEY.
- Publicação das correções já feitas, com migração aditiva do PIN.
- Relay supervisionado e `/ws` respondendo ao upgrade autenticado.
- Persistência de jogadores e ranking entre reinicializações e publicações.
- Registro de falhas de conexão, divergência de estado e resultado pendente,
  sem registrar PINs ou tokens.

Critério de conclusão:
- Dois aparelhos físicos, com jogadores diferentes, entram pelo código e por link.
- Partida completa, resultado único no ranking e três revanches consecutivas.
- Queda e retorno de conexão, recarga de página, saída e nova entrada têm
  comportamento definido e mensagens compreensíveis.
- Nenhuma falha crítica conhecida de entrada, partida ou preservação de dados.

Dependência: acesso ao deploy existente e ao armazenamento atual; nenhuma chave
ou banco de produção está disponível neste workspace.

## Etapa 2 — definir o padrão visual e os aparelhos-alvo

Entregar:
- Guia de arte: proporções, silhuetas, materiais, cores, contornos e iluminação.
- Conceitos de Pipoca e Uivo, vistas frontal/lateral/traseira, expressões e escala.
- Conceito da arena e composição da câmera durante a luta.
- Lista de animações e referência do peso de cada tipo de ataque.
- Relação de aparelhos físicos para testes: Android de entrada/intermediário,
  Android mais potente e iPhone, incluindo modelos e versões de navegador.

Critério de conclusão:
- Aprovação dos conceitos e de uma composição representativa de combate.
- Definição dos aparelhos mínimos suportados e dos limites iniciais de carga,
  memória e complexidade gráfica. Esses limites serão medidos na etapa seguinte.

Uma imagem conceitual aprovada define aparência; ainda não é um personagem 3D
animado nem uma prova de desempenho.

## Etapa 3 — provar a tecnologia 3D no celular

Entregar:
- Protótipo WebGL com câmera lateral, iluminação e arena simples.
- Dois personagens provisórios animados, lendo o estado do motor atual.
- Comparação prática dos renderizadores candidatos; Babylon.js é o candidato
  inicial, sujeito à avaliação e aprovação da nova dependência.
- Carregamento progressivo com progresso, recuperação de falha e descarte de recursos.
- Medição de tempo por quadro, memória, tamanho transferido e aquecimento.

Critério de conclusão:
- Alvo de 60 quadros/s nos aparelhos definidos como suportados, com medição de
  oscilações e quedas em uma sessão contínua de pelo menos 15 minutos.
- O visual nunca altera colisões, dano, comandos ou resultado da simulação.
- Pausar/retomar o app e perder/restaurar o contexto gráfico não causam tela preta
  permanente ou resultado incorreto.
- Fechar os limites reais de modelos, texturas, partículas e carga inicial.

A escolha final da tecnologia e as estimativas do restante do trabalho dependem
desse protótipo. Não migrar os 16 lutadores antes dessa validação.

## Etapa 4 — produzir os dois lutadores e a arena

Entregar:
- Modelos 3D de Pipoca e Uivo com topologia adequada a animação.
- Texturas, materiais, esqueletos e deformações revisados nas poses extremas.
- Animações de espera, movimento, corrida, pulo, agachar, defesa, socos, chutes,
  agarrões, especiais, Super, dano, queda, levantar, vitória e Golpe Final.
- Transições que respeitem os quadros ativos e a recuperação de cada golpe.
- Arena com profundidade, elementos animados, sombras e iluminação coerente.
- Arquivos-fonte dos assets e exportações prontas para o navegador.

Critério de conclusão:
- Os personagens são reconhecíveis em movimento e à distância.
- Sem pés deslizando involuntariamente, deformações quebradas ou ataques cuja
  apresentação contradiga o alcance e os quadros de acerto.
- Qualidade visual aprovada dentro dos limites de desempenho da etapa 3.

Esta etapa exige produção de arte 3D e animação. Código e imagens geradas não
substituem modelagem, rigging e revisão dos movimentos.

## Etapa 5 — impacto, efeitos, câmera e áudio

Entregar:
- Efeitos distintos de acerto, defesa, contra-ataque e quebra-combo.
- Rastros, poeira, energia, iluminação de impacto e tremor com intensidade controlada.
- Super e Golpe Final com apresentação própria para cada lutador.
- Câmera que valorize os momentos fortes preservando a leitura da luta.
- Gritos gravados ou produzidos como assets de áudio próprios, sons de golpes,
  ambiente, trilha e locução. As vozes sintetizadas atuais são provisórias.
- Mixagem com volumes separados para música, efeitos e vozes.
- Opções de reduzir flashes e tremor; limites para partículas e sons simultâneos.

Critério de conclusão:
- O jogador distingue acerto, defesa e erro de golpe sem depender do texto.
- Efeitos não escondem ataques importantes nem comprometem os 60 quadros/s.
- Áudio começa após interação, retoma depois de interrupções e não acumula falas.

## Etapa 6 — fechar a demonstração jogável

Entregar:
- Fluxo completo: PIN, menu, sala, escolha, luta, resultado e revanche.
- Interface com o mesmo padrão visual da arena e dos personagens.
- Controles revisados com multitoque, áreas seguras e adaptação ao tamanho da tela.
- CPU com comportamentos e dificuldades distintos, sem reações instantâneas injustas.
- Treino com indicação de comandos e explicação das mecânicas essenciais.

Critério de conclusão:
- Pessoas que não conhecem o projeto conseguem entrar e jogar sem instruções externas.
- Sessões repetidas nos aparelhos-alvo sem falhas críticas, perda de comandos,
  crescimento contínuo de memória ou perda de dados.
- Aprovação da experiência visual, sonora e de controle dos dois personagens.

Este é o primeiro marco de qualidade premium. Só então ampliar a produção.

## Etapa 7 — aperfeiçoar o online e a integridade das partidas

Entregar:
- Medição de latência, variação de atraso e pausas em Wi-Fi e dados móveis.
- Testes reproduzíveis com atraso, perda de conexão, mensagens inválidas e revanches.
- Avaliação de rollback se o lockstep não atingir a resposta esperada; a migração
  exige snapshots, reexecução determinística e tratamento dos efeitos previstos.
- Regras claras de abandono e resultados pendentes.
- Validação adicional de partidas se o ranking passar a ter caráter competitivo:
  a concordância atual de dois clientes não prova, sozinha, que uma luta ocorreu.

Critério de conclusão:
- Resultados não duplicam; divergências não geram um vencedor incorreto.
- Não há contaminação entre partidas ou resultados silenciosamente perdidos.
- Definir a faixa de rede suportada com base em medições, sem prometer ausência
  de atraso em qualquer conexão.

## Etapa 8 — ampliar o elenco em lotes

Entregar:
- Os demais 14 personagens em lotes pequenos, seguindo o padrão já aprovado.
- Animações, especiais, Super, áudio e Golpe Final próprios para cada um.
- Revisão de força, velocidade, alcance, recuperação e recursos defensivos.
- Testes automatizados dos confrontos e sessões humanas de balanceamento.

Critério de conclusão de cada lote:
- Mesma qualidade de acabamento dos dois personagens iniciais.
- Nenhuma regressão nos personagens já aprovados ou no desempenho do celular.
- Ausência de vantagem dominante conhecida sem resposta viável.

## Etapa 9 — preparar lançamento e manutenção

Entregar:
- Testes de instalação PWA, atualizações, cache antigo, orientação e interrupções.
- Verificação de backup e restauração com cópia do banco, sem afetar produção.
- Processo de publicação com retorno à versão anterior verificado.
- Monitoramento de falhas e identificação de versões do cliente e do servidor.
- Lista de problemas conhecidos e processo para corrigir regressões.

Critério de lançamento:
- Nenhuma falha crítica ou grave conhecida nos fluxos essenciais.
- Metas de desempenho cumpridas nos aparelhos suportados.
- Online, ranking, atualização e recuperação de dados validados.
- Aprovação de partidas completas jogadas em aparelhos físicos.

## Ordem de início e decisões pendentes

1. Concluir a estabilização no Render e o teste em dois celulares.
2. Aprovar os conceitos de Pipoca, Uivo e arena noturna.
3. Validar o protótipo 3D e escolher o renderizador.
4. Produzir a demonstração completa antes de estimar a expansão do elenco.

Para planejar prazo e custo com responsabilidade, ainda precisamos definir:
- Modelos dos celulares principais usados para jogar.
- Orçamento e disponibilidade de produção de arte 3D, animação e áudio.
- Acesso ao deploy atual e localização persistente do banco.

Não há prazo fechado nesta etapa. A estimativa de produção será construída após
o protótipo medir o esforço de um lutador completo e de uma arena.
