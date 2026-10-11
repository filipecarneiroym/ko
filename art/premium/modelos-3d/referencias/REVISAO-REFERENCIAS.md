# Referências para modelagem: Pipoca e Uivo

Status: referências preliminares revisadas visualmente. Não são modelos 3D, não contêm rig, malha, textura UV ou animações, e não autorizam substituir o renderizador publicado por imagens estáticas.

Geradas com a ferramenta integrada `image_gen`, uma chamada para cada personagem. Os prompts completos estão em `pipoca-referencia-v1.prompt.txt` e `uivo-referencia-v1.prompt.txt`. Os conceitos originais permanecem intactos e continuam sendo a autoridade de identidade.

## Pipoca

- Origem vigente conferida no manifesto: `art/premium/elenco/pipoca-v1.png`.
- Folha: `pipoca-referencia-v1.png`.
- Frente, perfil e costas completos, sem cortes nas orelhas ou pés; escala e linha do chão visualmente alinhadas.
- Preserva coelha branca adulta, olhos âmbar, sobrancelhas/cílios escuros, nariz rosa, top e short azul índigo com faixas brancas, luvas vermelhas, faixas nos pés e cauda curta branca.
- A pose neutra permite ler braços, luvas, cintura e pernas sem sobreposição grave.
- A construção traseira do top e do short foi inferida pela geração, porque o conceito original mostra apenas a frente em três quartos. Ainda precisa de aprovação artística antes de virar geometria definitiva.
- Contagem, separação e forma dos dedos dos pés precisam de definição explícita na modelagem. Não tratar os detalhes de anatomia gerados como topologia válida.
- Conferir proporção exata das orelhas, formato do focinho e volume dos olhos contra o conceito original durante a modelagem; a folha serve de apoio, não substitui essa comparação.

## Uivo

- Origem vigente conferida no manifesto: `art/premium/elenco/uivo-v1.png`.
- Folha: `uivo-referencia-v1.png`.
- Frente, perfil e costas completos, com cauda inteira e sem cortes nas orelhas, mãos ou pés.
- Preserva lobo cinza, focinho/peito claros, olhos âmbar, sobrancelhas angulosas, nariz preto, gi índigo sem mangas, faixa escura na cintura, calça folgada com marcas claras, bandagens nas mãos e garras escuras.
- Perfil e costas tornam visível a inserção da cauda; não foi adicionado acessório ou arma.
- A traseira do gi e a implantação da cauda foram inferidas, pois não aparecem integralmente no conceito original. Confirmar folga do tecido e passagem da cauda antes da malha final.
- As mãos e garras precisam de revisão anatômica e rig de dedos; a pose gerada não demonstra deformação correta.
- A marca clara da calça foi preservada visualmente como desgaste. Deve ser desenhada numa textura controlada, sem depender da geração reproduzi-la com precisão em todas as vistas.

## Pendências comuns antes de aprovação para o jogo

Estas folhas não comprovam silhueta correta durante golpes, deformações de joelho/cotovelo, colisões de roupa, movimento das orelhas/cauda, animação facial, custo de renderização ou desempenho em Android, iPhone e TV. É necessário produzir e revisar as malhas, materiais, rig e animações em movimento, usando o conceito vigente como comparação. Nenhuma destas duas folhas foi vinculada ao jogo nem substituiu os lutadores atuais.
