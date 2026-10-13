# Padrão de refinamento 3D (arte final → modelo)

Processo validado na Pipoca v5. Use o mesmo para cada personagem do elenco.
Referência de implementação: `scripts/producao-3d/concluir-aparencia-meshy-pipoca-v5.py`,
`pipoca_v5_projecao.py`, `pipoca_v5_figurino.py` e `pipoca_v5_rosto.py`.
Rodar: `blender -b --python scripts/producao-3d/concluir-aparencia-meshy-pipoca-v5.py -- --draft`.

## 1. Gerar a base certa (não corrigir uma base ruim)

- Gere no Meshy em **Image to 3D → Multi-view** a partir de **três vistas da
  arte final** (frente, lado, costas), na mesma pose, mesma escala e fundo neutro.
- **Pose neutra e simétrica, braços levemente abertos.** Pose de luta gera
  assimetria, membros fundidos ao corpo e defeitos que não se corrigem bem; e o
  rig dos golpes precisa da pose neutra.
- Recorte cada vista em PNG quadrado 1024², figura inteira centralizada
  (exemplo: `referencias/meshy-multiview-v2/`).
- Confira a malha recebida: uma peça só, sem arestas abertas, simetria em X
  (mediana < 5 mm), sem peças duplicadas (ex.: duas caudas).

## 2. Calibrar a arte sobre o modelo

- Ajuste a silhueta do modelo à silhueta de cada vista da folha
  (escala px/m e centro); meta ≥ 95 % de sobreposição na frente.
  Salve em `calibracao-vistas.json` (frente: `u = cx + s·x`; costas espelhada:
  `u = cx − s·x`; nas duas `v = cy − s·z`).
- Projete a folha nos vértices (vista mais frontal e não ocluída) e
  **meça na própria arte**: cores (sRGB) de pelo, tecido, couro, faixas e
  orelhas, e as alturas/limites de cada peça de roupa.
- A projeção serve para **medir**, não para pintar: na resolução da folha ela
  deixa bordas serrilhadas e manchas.
- **Medir faixas/listras pela projeção, nas duas vistas.** Lance raios da
  frente e de trás, amostre a arte no ponto atingido e faça um histograma da
  coordenada da peça (ex.: `y` do quadril, bins de 4 mm); a faixa é onde
  > 50 % das amostras são brancas. Foi assim que apareceram as **quatro**
  faixas do short da Pipoca (duas vistas de frente, duas de costas), que a
  vista frontal sozinha não mostrava.

## 3. Roupas e materiais como campos limpos

- Cada peça é um campo assinado em espaço do modelo (alturas, eixos dos
  membros, faixas), com as medidas tiradas da arte; os triângulos são
  **cortados no zero do campo**, então as bordas ficam lisas.
- **Corte só onde a região de fato entra na face.** O `cut()` primeiro testa
  se sobra algum pedaço dentro de *todas* as restrições; se não sobra, a face
  passa inteira. Cortar restrição por restrição e só depois descobrir que a
  face não pertence à região deixa emendas inúteis: rachaduras e anéis de
  sombreamento (era a falha abaixo da batata da perna e as marcas no braço).
  Mesmo assim, coloque as restrições espaciais (portões) primeiro.
- **Nada decidido por face inteira.** Todo limite visível tem de ser um campo
  contínuo cortado no zero. Testes por face (ex.: "face virada para a frente"
  ou "centro acima de z" na orelha) fazem a borda seguir a triangulação
  (serrilhado). Use a normal suavizada interpolada como campo e deixe os
  testes por face só como portão largo.
- **Bordas que se encontram têm de se emendar.** Ex.: o U do decote sobe até
  a borda de dentro da alça e a cava nasce na borda de fora dela; senão sobra
  um degrau onde as duas peças se encontram.
- **Malha fechada depois do corte** (`close_open_edges`): o corte deixa
  junções em T (vértice de um lado sobre uma aresta não dividida do outro).
  Divida a aresta nesse ponto e solde; depois remova faces degeneradas,
  arestas soltas e "barbatanas" (aresta com 3 faces), e preencha os laços
  restantes. Pipoca: 1489 → 0 arestas abertas. O `revisao.json` registra o
  antes e o depois; a meta é 0.
- Restrinja cada peça à sua parte do corpo, com limites medidos na malha:
  - cós só no tronco (`|x| < 0,215` na Pipoca), senão ele vaza para a parte
    interna do braço que encosta no quadril;
  - luva = cápsula do antebraço + esfera no punho grande o bastante para a
    frente do punho esculpido (0,175 m) e um limite em x que a afasta da coxa.
- **Bordas esculpidas são medidas na escultura, não estimadas por fórmula.**
  Receita única para cós, barra do short e contorno do rabo: raios em leque a
  partir do eixo da peça; em cada ângulo, o **maior degrau** do raio (cós:
  maior queda subindo; barra: maior subida; rabo: maior queda visto de trás).
  Depois, filtro de mediana entre vizinhos e interpolação periódica.
  Armadilhas encontradas:
  - descartar saltos impossíveis **antes** de escolher o maior (ex.: o raio
    entre as coxas atravessando para a outra perna, > 5 cm); senão o ângulo é
    perdido e a borda sobe (língua creme na parte interna da perna);
  - quando o maior degrau cai entre dois tufos (rabo), dê folga ao contorno
    só na parte de baixo (+1 cm, máximo entre vizinhos) e deixe a altura
    decidir: dentro do contorno, é rabo onde o ponto está > 6 mm acima de uma
    **membrana** que passa pelo pé do degrau.
- **Membrana (`mean_value` no figurino):** interpolação por coordenadas de
  valor médio sobre um polígono de borda medido. Serve para a superfície de
  base sob o rabo e para a lente dos olhos. Nunca ajuste quadrático em anel
  largo: ele pega focinho/laterais e extrapola centímetros.
- Detalhes do figurino que a arte mostra e precisam existir: barra em H da
  luva (faixa vertical ligando as duas brancas, na face frente-externa),
  alça vermelha oblíqua no pé (sobre o antepé e baixa no calcanhar), borda
  vermelha onde a faixa encontra os dedos, etiqueta do cós.
- Alças finas: caminhos guia assentados na pele, com largura medida no plano
  tangente.
- Cores dos materiais = cores medidas na arte. Revisão com luz suave e
  transformação de vista **Standard** (Filmic/AgX lavam tons pastel).

## 4. Rosto: os desenhos encaixam no relevo esculpido

Regra principal: **não alisar e redesenhar por cima; detectar o relevo e
encaixar o traço nele.**

- **Relevo em 3D, não pela vista de frente:** para cada vértice, a altura ao
  longo da normal sobre a média gaussiana (σ 6 mm) da vizinhança. A versão
  "altura vista de frente" serrilha em faces íngremes e mancha a lateral da
  cabeça.
- **Olho:** a abertura esculpida fica entre a crista da pálpebra superior e a
  borda da bochecha. O contorno amendoado segue essa abertura (posição,
  largura, inclinação). Esclera/íris/pupila assentam numa **membrana sobre a
  borda da amêndoa** (pele visível na borda, suavizada ao longo dela,
  interpolada por valor médio); a pele de dentro é empurrada 2,5 mm para
  trás. Meta: olho a 0–5 mm da pele. Medir sempre a distância
  olho↔pele; o ajuste quadrático antigo deixava 18–26 mm.
- **Delineado:** tubo na borda superior da amêndoa, afinando no canto
  externo. **Sem asa** quando a pele vira para o lado no canto (todas as asas
  testadas viraram gancho ou saíram do rosto no perfil). A crista esculpida
  fica preta só por baixo do tubo, sem passar da silhueta dele.
- **Sobrancelhas: peça desenhada sobre a barra esculpida.** A linha central
  vem da barra (limites inferior/superior = percentis 5/95 de z dos vértices
  com relevo > 1 mm, a cada 2 mm em x, lados espelhados, suavizados ao longo
  da sobrancelha); a **largura vem da arte** (Pipoca: 9 → 8 → 7 → 3 mm da
  ponta interna para a externa; a barra do Meshy tinha só 4–5 mm). A
  sobrancelha é uma casca fina (grade 48×7) assentada 1,2 mm sobre a pele:
  borda nítida, seja qual for a escultura embaixo. Por baixo, pintura marrom
  1 mm mais estreita, para que pontas da escultura que atravessem a casca
  também fiquem marrons. Pintar seguindo o relevo copiava as pontas de pelo
  esculpidas pelo Meshy (borda serrilhada).
- **Boca:** seguir o **fundo do vinco**: varredura em leque ao redor do
  focinho; em cada ângulo, o degrau do lábio superior e o **canto côncavo no
  pé do degrau** (maior curvatura). No centro o degrau é mais suave: nunca
  parar o traçado antes de passar pelo centro. Depois, subir pelo vale entre
  almofada do focinho e bochecha até o canto do sorriso. Filtro labial do
  nariz até o centro da boca; lábio rosado logo abaixo do centro.
- Nariz, blush e demais traços nas posições medidas na arte.

## 5. Conferir de todos os ângulos

- Frente, ¾, perfil, de baixo e costas, em close do rosto e corpo inteiro,
  sempre lado a lado com a arte (recorte e amplie a região da arte para
  comparar detalhe: luva, pés, faixas).
- Closes: renderize com a câmera da cena (ortográfica, alvo na peça). O
  `look` do MCP de perto corta a malha pelo plano próximo da câmera e mostra
  "buracos" falsos.
- Mancha chapada com borda nítida: primeiro veja em sombreamento sólido. Se
  some, é material (ex.: faixa vazando); se continua, é forma esculpida.
- Verifique buracos (arestas de borda), faces invertidas (o jogo desenha só um
  lado da face) e linhas de corte sobrando.
- Só depois disso: retopologia, rig e golpes.
