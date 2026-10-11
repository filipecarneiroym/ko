# Produção dos primeiros lutadores 3D

O primeiro par é Pipoca e Uivo. Este diretório contém o contrato de produção, não modelos prontos. A busca no repositório em 11/10/2026 não encontrou arquivos GLB, glTF, Blender, FBX, OBJ, DAE, STL, USD ou USDZ de lutadores. Os manequins em `src/3d/laboratorio.js` são geometria de teste e não atendem à identidade visual solicitada.

`contrato.json` registra as referências atuais, seus hashes, nomes de animação e tempos reais do motor. As duas referências foram abertas e comparadas visualmente antes desta especificação. A arte atual é a fonte de identidade; desenhos antigos de `ko-arte.js` servem somente para consultar regras e encenação existentes. A menção anterior a Canvas 2D em `SPEC.md` não revoga a aprovação posterior de Babylon.js descrita em `PROPOSTA-RENDERIZADOR.md`.

## Identidade que deve permanecer

| Lutadora/lutador | Referência atual | Características obrigatórias |
| --- | --- | --- |
| Pipoca | `../elenco/pipoca-v1.png` | Coelha branca/creme atlética, grandes orelhas rosadas, olhos âmbar, nariz rosa, luvas vermelhas de boxe, top e short azul-violeta com listras brancas, faixas claras nos pés, cauda curta. |
| Uivo | `../elenco/uivo-v1.png` | Lobo musculoso cinza, focinho e peito claros, focinho alongado, olhos âmbar, sobrancelhas escuras, quimono índigo sem mangas e gasto, faixa na cintura, faixas claras nas mãos, patas com garras e cauda grande. |

As folhas auxiliares [Pipoca](referencias/pipoca-referencia-v1.png) e [Uivo](referencias/uivo-referencia-v1.png) apresentam frente, perfil e costas para iniciar a modelagem. A [revisão das referências](referencias/REVISAO-REFERENCIAS.md) registra detalhes inferidos e pendências. Elas não substituem os conceitos atuais nem contêm malhas, rig ou animações.

A referência original de cada personagem é uma única imagem e não define com certeza costas, costuras ocultas ou anatomia sob a roupa. As vistas adicionais são propostas visuais; esses pontos precisam de revisão consistente, sem inventar acessórios ou trocar a espécie. Iluminação laranja/roxa na referência não deve virar uma faixa permanente pintada na pelagem. Pelagem deve ser resolvida com geometria de silhueta e mapas, evitando milhares de fios ou camadas transparentes como requisito móvel inicial.

Pipoca tem leitura de boxe ágil e movimentos elásticos. Uivo tem guarda mais ampla, ataques de garras e investidas pesadas. Não reaproveitar o mesmo rosto, cabeça ou silhueta com uma cor diferente. Ambas as orientações da arena precisam mostrar o mesmo personagem coerente, incluindo costas e cauda.

## Entrega do ativo

Entregar arquivo de trabalho editável, GLB autocontido, texturas originais e registro de autoria/licenças. O GLB deve conter malhas tridimensionais, esqueleto, materiais e todos os clips listados no contrato. Uma imagem colocada em um plano ou uma pose estática não atende à entrega. Não há URL ou nome de modelo final publicado neste contrato: `modeloFinal` permanece `null` até existir um arquivo validado.

O laboratório atual permite selecionar um GLB no computador ou celular pelo campo de arquivo de cada lutador. A leitura e a importação ocorrem no navegador, sem envio ao servidor. O limite técnico atual é 24 MiB por arquivo (`24 * 1024 * 1024` bytes), independente da meta de produção de 8 MiB. A importação recusa qualquer `uri` em buffers ou imagens, inclusive URI de dados, e qualquer item em `extensionsUsed` ou `extensionsRequired`. Portanto, buffers e texturas devem estar incorporados no bloco binário, sem extensões nesta primeira etapa. Isso não publica nem cadastra automaticamente o arquivo selecionado como modelo final do projeto.

O projeto adotará pés no piso, centro entre os pés na origem, +Y para cima, frente do personagem em +X e um metro por unidade. glTF usa coordenadas de mão direita, +Y vertical, unidades em metros e frente convencional +Z; a orientação +X é uma decisão deste projeto e deve ser aplicada ao ativo antes da exportação. O importador de Babylon faz a conversão para a cena. Não adicionar outra conversão por tentativa nem espelhar o esqueleto com escala negativa. Conferir a orientação com uma pose de guarda e os dois valores de `p.face`. [Especificação oficial glTF 2.0, coordenadas](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units).

A escala visual inicial é `KOSim.LUTADORES[id].altura / 24`: 2,5 metros para o corpo de Pipoca e 2,75 para Uivo. Isso é uma convenção de enquadramento do laboratório, não uma mudança de atributos. Orelhas e caudas são partes visuais e não ampliam automaticamente a área atingível. Conferir cabeça, tronco, pés e golpes com a sobreposição das caixas do motor; um ataque que parece tocar longe da caixa real é motivo para revisar a pose.

Animações devem ocorrer no lugar: a raiz do modelo não pode deslocar a posição jogável. `p.x`, `p.y`, `p.face`, `p.sumido` e o estado da simulação comandam posicionamento, orientação e visibilidade. Ossos de quadril e membros podem animar dentro dessa raiz. O salto e as investidas não podem somar movimento do GLB ao movimento já calculado pelo motor. Pontos nomeados de mão, pé, peito e boca facilitam efeitos, mas nunca criam colisões.

Usar inicialmente materiais PBR metallic-roughness com texturas PNG/JPEG incorporadas; nenhuma URI em buffers/imagens, decodificador remoto ou extensão usada/obrigatória. Mapas de base, normal e materiais devem ser preparados de acordo com seu espaço de cor. Exportar malhas trianguladas, normais e UVs válidas, pesos normalizados e no máximo quatro influências por vértice. Roupas não podem atravessar o corpo nas poses de maior flexão. Ossos auxiliares são permitidos dentro do orçamento; não é necessário que os dois personagens compartilhem um esqueleto.

## Animações e relógio da luta

Os nomes de clip são exatamente os nomes de estado. Quando `p.estado === 'golpe'`, o clip é `p.golpe`. O GLB tem de fornecer nomes únicos, embora o formato glTF permita nomes duplicados. `contrato.json` enumera os 31 nomes obrigatórios. Todos devem ser inspecionados visualmente; apenas contar nomes não valida a qualidade da animação.

| Estado ou grupo | Como apresentar |
| --- | --- |
| `parado`, `andando`, `corrida` | Guarda, deslocamento e corrida em ciclos. Diferenciar avanço e recuo pela velocidade relativa a `p.face`, preservando a guarda voltada ao adversário. |
| `agachado`, `defesa`, `defesaBaixa` | Posturas sustentadas distintas; reação de bloqueio pode ser camada visual sincronizada por `defendeu`. |
| `pulo`, `pousando` | Pose de salto segue o estado real e pode reiniciar no pulo duplo de Pipoca. A aterrissagem dura quatro quadros. Não fixar a trajetória vertical no clip. |
| `dano`, `caido`, `levantando` | Reação segue `stun`/posição; queda de 46 quadros e levantamento de 16, quando esses estados ocorrem. Manter pose final no chão em vez de repetir a queda. |
| `rolando`, `recuo`, `quebra` | 24 quadros, 18 quadros e pelo menos 16 quadros no chão, respectivamente. Deslocamento vem da simulação. |
| `agarrando`, `agarrado` | Agarrão de 30 quadros com arremesso no quadro 10. A vítima pode ser solta antes; não manter o clip por relógio próprio. |
| `tonto`, `vitoria`, `derrotado` | Estados finais claramente distintos. Tontura usa ciclo; vitória e derrota mantêm a última pose. Vitória deve permitir a tela de resultado sem cobrir controles. |
| `final`, `vitimaFinal` | Encenação de 200 quadros por `s.fT`; a vítima reage ao final do atacante, que pode ser outro personagem do elenco. |
| `p1`, `p2`, `k1`, `k2`, `cp`, `ck`, `ap`, `ak`, `esp`, `sup` | Clips específicos por lutador, com preparação, contato e recuperação nos quadros do contrato. |

Um quadro da simulação dura 1/60 s. Os tempos de keyframe de glTF são em segundos; exportar poses de contato correspondentes ao quadro dividido por 60. A animação não deve disparar dano, projétil, movimento, resultado nem efeito que altere a regra. O motor pode cancelar um golpe, trocar de estado ou pousar antes do fim do clip. O adaptador deve selecionar a pose do estado corrente, interromper o clip anterior e congelar quando o relógio do estado congelar em `hitstop`. Transições não podem esconder o contato ou atrasar a resposta do golpe. [Especificação oficial glTF 2.0, animações](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations).

Os tempos de golpes foram copiados do motor atual, com hash em `contrato.json`. Se o balanceamento mudar, atualizar essa referência a partir do motor; nunca modificar as regras para caber em uma animação já produzida. Os intervalos ativos são inclusivos. `dur` limita o estado de ataque; ele não garante que a última pose será exibida antes da transição. Cenas `final` usam a fase; não confundir com o Super.

Pipoca lança a cenoura no quadro 10 de `esp`. O projétil vai e volta independentemente do fim do clip, com trajetória de `s.proj`. Seu `sup` oculta o modelo nos quadros 8–42 e acerta nos quadros 44–50. Uivo usa `esp` com área ativa nos quadros 12–18 e `sup` com três contatos nos intervalos 6–12, 20–26 e 34–42. As investidas do Super são calculadas pelo motor e não precisam de root motion.

As encenações atuais de referência são **Chuva de Cenouras!** para Pipoca e **Uivo à Lua!** para Uivo (`FINAIS` em `ko-arte.js`). Devem permanecer cômicas e sem sangue. Ondas, lua e cenouras são efeitos separados do modelo; a execução visual não pode mudar o resultado já calculado.

## Orçamento inicial e validação

O contrato propõe 25 mil triângulos por lutador, teto inicial de 40 mil, até 80 ossos, quatro materiais, texturas de até 2048 e GLB de até 8 MiB. A memória inicial de texturas decodificadas é 48 MiB por lutador. Com dois lutadores, a meta inicial é até 16 draw calls para eles, considerando passes extras, além do cenário e efeitos. Esses valores são hipóteses de produção para medir, não limites oficiais de iPhone/Android nem evidência de 60 FPS. Reduzir quando a medição real exigir.

Para revisão visual, apresentar os dois personagens juntos no laboratório, em câmera de luta, contra fundo claro e escuro, nos dois lados, com caixas de colisão visíveis e ocultas. Inspecionar rosto, patas, pelagem, faixas, roupa e silhueta em guarda, agachamento, salto, extensão máxima dos golpes, queda e vitória. As orelhas de Pipoca e a cauda de Uivo precisam permanecer dentro do enquadramento durante os movimentos previstos; verificar também HUD e áreas ocupadas pelo toque.

A etapa técnica exige validação do GLB, importação autocontida sem pedidos externos, nomes de animação únicos, durações compatíveis, recursos liberados ao sair, tratamento de falha e perda de contexto, e comparação do estado/hash da simulação antes e depois de renderizar. GLB aprovado pelo validador ainda precisa de inspeção visual. O [validador oficial de Khronos](https://github.khronos.org/glTF-Validator/) pode ser usado para o arquivo final.

A revisão de desempenho deve medir partida completa com os dois modelos, efeitos mais intensos e áudio, em iPhone e Android físicos definidos pelo usuário, registrando navegador, aparelho, resolução, temperatura inicial, duração, FPS/tempo de quadro e interrupções. Repetir após alguns minutos para observar aquecimento. Uma captura de Edge no computador não comprova desempenho móvel. TV requer ensaio no navegador real ou no computador ligado por HDMI com os dois controles.

Somente depois de identidade, animações, colisões percebidas, carregamento e testes físicos aprovados, avaliar trocar o renderizador principal. O jogo publicado e o laboratório permanecem etapas separadas. As marcações de aceitação no JSON começam como `false` para evitar tratar esta especificação como entrega concluída.

## Conferência reproduzível

Executar da raiz do projeto: `node scripts/verificar-modelos-3d.mjs`. O comando confere manifesto, hashes das artes e da simulação, estados do adaptador, nomes de clip, alturas e tempos de golpe. Se `modeloFinal` estiver `null`, imprime **PENDENTE** para o personagem; contrato consistente não significa modelo pronto. O modo `node scripts/verificar-modelos-3d.mjs --exigir-pronto` retorna código 2 enquanto modelos ou revisões estiverem pendentes. Erros de integridade retornam código 1; o comando não altera arquivos, imagens ou a simulação.
