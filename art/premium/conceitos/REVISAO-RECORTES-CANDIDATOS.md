# Recortes candidatos: Fóssil e Kilo

Status: candidatos aprovados na verificação de transparência e na inspeção visual de identidade. Não foram promovidos ao manifesto nem aos arquivos públicos por esta tarefa. Os conceitos vigentes `fossil-v2.png` e `kilo-v2.png` continuam intactos.

Ferramenta: `image_gen` integrada, uma chamada por personagem, `transparent_background: true`, com os conceitos vigentes como referências locais. Prompts completos em `fossil-recorte-candidato-v1.prompt.txt` e `kilo-recorte-candidato-v1.prompt.txt`.

## Resultados medidos

Alfa no PHP GD: 127 significa completamente transparente; 0 significa opaco. Amostragem em grade de 4 pixels, 98.304 amostras por arquivo de 1024 × 1536.

| Arquivo | Cantos superior esquerdo, superior direito, inferior esquerdo, inferior direito | Amostras totalmente transparentes |
| --- | --- | --- |
| `../elenco/fossil-v2.png` | 15, 32, 21, 127 | 1,55% |
| `fossil-recorte-candidato-v1.png` | 127, 127, 127, 127 | 56,43% |
| `../elenco/kilo-v2.png` | 24, 15, 123, 120 | 5,98% |
| `kilo-recorte-candidato-v1.png` | 127, 127, 127, 127 | 54,61% |

A composição no navegador Edge confirmou a remoção do fundo sobre branco e quadriculado, inclusive os espaços entre as pernas e o contorno externo. A comparação local está em `.browser-check/recortes-alpha.png`, gerada pela página de inspeção `.browser-check/recortes-alpha.html`. O script `.browser-check/auditar-recorte-candidato.php` lê os canais de alfa sem editar a imagem.

A prévia da ferramenta de imagem e a visualização direta por `view_image` exibiram o RGB residual do gradiente, mesmo quando o canal alfa do PNG estava correto. A conclusão foi tomada pela composição real no navegador e leitura do canal alfa, não pela aparência dessas prévias.

## Identidade e limites

- Fóssil: mantém o rosto idoso vigente, nariz alongado, óculos retangulares, cabelo branco, sobrancelhas brancas, jaleco, camisa verde, calça e botas marrons, braço robótico de dinossauro e pose. Não houve retorno a um rosto antigo.
- Kilo: mantém o rosto maduro calvo vigente, barba preta com centro grisalho, porte corporal, regata azul, short preto, cinto, bandagens, tênis e pose. Não houve retorno a um rosto antigo.
- Kilo apresenta redução da iluminação roxa de contorno. A geração não é uma operação de recorte com garantia de preservação pixel a pixel; detalhes de textura e iluminação mudaram. Conferir essa diferença antes da promoção.
- Não há cortes nas mãos, pés ou equipamento nas imagens candidatas. A revisão em fundos claros não mostrou uma placa de fundo ou halo amplo como nos arquivos anteriores.
- Aprovação aqui se refere à transparência e identidade visual geral. Não substitui a revisão final das telas de seleção, vencedor e fundo do elenco nas resoluções suportadas.
