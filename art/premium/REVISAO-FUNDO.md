# Revisão do fundo coletivo

Rascunho gerado: REPROVADO. Arquivo: `conceitos/elenco-batalha-rascunho-v1.png`. Não aplicar ao menu.

Composição atual: implementada com 18 artes individuais nas versões do manifesto, convertidas para WebP sem redesenho. Cenário vazio independente em `public/img/cenario-poster-v1.webp`. O menu usa `partials/fundo-elenco.blade.php`; prévia em `elenco/poster.html`. Três fileiras no formato horizontal e seis no vertical. O fundo fica fora das páginas de luta, é decorativo e não intercepta toques.

Verificação no Edge local: 18 IDs únicos, imagens carregadas e versões corretas em 1920×1080, 844×390 e 390×844. Revisão visual realizada nos screenshots. A política CSP bloqueou o primeiro posicionamento por estilos inline; corrigido com seletores no CSS externo, sem relaxar a política. O teste mobile da página real verifica seis posições horizontais e três verticais para impedir regressão por empilhamento.

Pendentes: avaliação estética pelo usuário e desempenho em Safari/iPhone, Chrome/Android e hardware de TV reais. As 18 artes públicas somam aproximadamente 4 MB; memória de imagens decodificadas e carregamento inicial ainda precisam ser medidos nos aparelhos. Não confundir prévia no navegador com validação nesses dispositivos.

O rascunho reinterpretou identidades. Não é possível concluir que usou exatamente os rostos atuais apenas porque os nomes aparecem no prompt. A ferramenta aceitou somente cinco referências; os outros treze personagens foram descritos em texto. Essa abordagem não preservou o elenco.

Diferenças observadas comparando o rascunho com as artes individuais atuais:

| Personagem | Divergência |
| --- | --- |
| Eco | Skate inventado, boné e rosto diferentes; perde a identidade do DJ com mochila de caixas |
| Nix | Cabelo azul e fones; deveria ter cabelo branco, cachecol rosa e patins de gelo |
| Ginga | Dreadlocks e camisa; original tem afro curto, faixa verde/amarela e torso descoberto |
| Vó Nena | Cabelo e vestido alterados; preservar coque, vestido lilás de bolinhas e pérolas |
| Vô Tião | Barba longa e roupa xadrez inventadas; original tem bigode branco, boné verde, camisa clara e colete marrom |
| Kira | Roupa preta de ninja; original tem top vermelho, short preto, luvas azuis e caneleiras brancas |
| Toco | Gorro vermelho; referência atual usa gorro verde com pompom claro |
| Volt | Roupa amarela e rosto pouco verificável; referência tem jaqueta laranja, capacete amarelo com viseira aberta e mochila vermelha |
| Kilo | Regata preta/vermelha, anilhas e expressão alteradas; referência usa regata azul e rosto arredondado de expressão calma |
| Maré | Tatuagem e prancha azul inventadas; referência usa prancha laranja com faixa branca |
| Brasa | Uniforme vermelho e capacete ausente; referência usa proteção bege com faixas refletivas e capacete vermelho |
| Truque | Barba/cavanhaque e rosto divergentes; versão atual tem bigode fino, queixo pontudo e nenhum cavanhaque |
| Fóssil | Óculos e expressão reinterpretados; preservar rosto idoso alongado e óculos retangulares da v2 |

Pipoca, Uivo, Maromba, Forja e Bórun estão reconhecíveis, mas isso não constitui aprovação de todos os detalhes. Forja e Bórun são conceitos existentes ainda não jogáveis, não personagens anônimos adicionais.

Fonte de versões: `elenco/manifesto.json`. Maromba v3; Eco, Volt, Kilo, Maré, Toco, Truque e Fóssil v2; demais v1. Arquivos antigos são histórico e não devem entrar em novas composições.

Para preservar a identidade exatamente, a próxima composição deve reutilizar as artes atuais como camadas, sem redesenhar rostos, roupas ou acessórios. Gerar cenário separadamente. Mudanças de pose exigem nova revisão individual antes de compor o grupo. Conferir 18 identidades únicas, acessórios, proporções, sobreposições e leitura do menu em celular e TV antes de exportar.

Controle dos arquivos: `node art/premium/elenco/verificar-artes.cjs`. O registro SHA-256 detecta substituição ou troca de versão; não avalia semelhança visual nem garante ausência total de erros.
# Revisão dos recortes — 11/10/2026

Fóssil e Kilo passaram para `fossil-v3.png` e `kilo-v3.png`, com WebP correspondente no menu e na vitória. Edição por image_gen removeu fundo e névoa residuais mantendo rostos, poses e equipamentos atuais. Todos os cantos das 18 artes agora têm alfa totalmente transparente. Recortes conferidos sobre branco e quadriculado no navegador; Kilo tem menos iluminação roxa de contorno. Prompts e comparação registrados em `conceitos/REVISAO-RECORTES-CANDIDATOS.md`. O verificador de artes registra também o hash do WebP público, além do PNG fonte.

