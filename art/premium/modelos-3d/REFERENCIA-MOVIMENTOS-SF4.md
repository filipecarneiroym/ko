# Referência de movimentos para a Lola

Vídeo local: `Downloads/videoplayback.mp4`, aproximadamente 13 minutos.
Análise em 14/10/2026: toda a duração percorrida em quadros a cada segundo;
sequências de chutes e Hadouken revistas com intervalos menores. Isso permite
selecionar poses e transições; não mede o frame data original do SF4.

## Mapa do vídeo

| Trecho aproximado | Conteúdo | Uso na Lola |
| --- | --- | --- |
| 0:00–1:25 | Abertura cinematográfica | Referência de tinta e contraste; movimentos exagerados não definem os ataques jogáveis. |
| 1:25–2:50 | Menus, seleção e comandos | Organização dos poderes e apresentação dos personagens. |
| 2:50–5:00 | Evil Ryu × Cammy | Chute aéreo, rasteira, guarda baixa, queda e recuperação. |
| 5:00–8:40 | Evil Ryu × Ken | Principal referência de chutes, Hadouken, Shoryuken e retorno à guarda. |
| 8:40–11:55 | Evil Ryu × Rose | Defesa, distância, transições e diferença entre golpe comum e efeito especial. |
| 11:55–13:00 | Evil Ryu × C. Viper | Impactos, ataques de chão, quedas e recuperação. |

Os limites são aproximados: a amostragem serve como índice para voltar aos
trechos completos. Mapas locais em `tmp/analise-video-completo/minuto-*.jpg`.

## Melhores referências e ordem de trabalho

1. **Chutes comuns e aéreos**: preparação com joelho dobrado, extensão rápida,
   quadril acompanhando o golpe e recolhimento antes de apoiar. Referência
   detalhada de Ken em 5:53,9–5:54,9. O pé e a silhueta ficam legíveis;
   o clarão principal aparece no contato, sem fogo permanente na perna.
2. **Rasteira e guarda baixa**: baixar o centro do corpo, manter um apoio,
   varrer baixo e recuperar a guarda. Comparar com as rasteiras de Ryu nos
   confrontos com Cammy e Ken. Remover voltas extras aplicadas à raiz.
3. **Chute furacão**: distinguir o especial giratório do chute comum;
   conferir perna estendida, altura baixa e pouso. Depois avaliar a versão
   aérea, ainda ausente do repertório.
4. **Defesa e reações**: luvas protegendo o rosto, resposta curta ao impacto,
   guarda baixa legível e clarão azul breve ao defender.
5. **Quedas e recuperação**: trajetória do corpo, contato com o chão,
   recuperação e volta à guarda; evitar deslizar ou levantar sem apoio.
6. **Shoryuken, Super e Ultra**: comparar preparação, impulso, silhueta e
   recuperação; reservar os efeitos intensos e a câmera para esses ataques.
7. **Deslocamento e transições**: conferir marcha, recuo, dash e pouso nas
   ligações entre os golpes. Dash comum ainda difere da corrida da Lola.

## Aplicado nesta etapa

- Chute forte e rasteira usam o giro dos próprios clipes, sem uma volta
  completa extra antes do contato.
- Chute aéreo estende no quadro 5 e mantém a pose até o quadro 16,
  acompanhando a janela ativa já definida pelo motor.
- Pé do chute aéreo alinhado à altura da caixa de acerto; segundo chute
  comum com maior extensão da perna e menor torção do quadril.
- Chutes comuns e furacão normal têm rastro fino e translúcido, sem névoa
  de fogo cobrindo a perna. Os impactos continuam na camada de efeitos SF4.
- Mantidos os dois contatos do chute comum da Lola: são parte do repertório
  atual, não uma reprodução exata de um golpe específico do SF4.

Dano, velocidade, colisão, duração e comandos não foram alterados nesta
etapa. A aprovação visual depende de Filipe jogar.

## Segundo vídeo enviado por Filipe

Link direto do Googlevideo baixado para
`tmp/analise-video-completo/segundo-video.mp4`: 475,777 segundos,
640 × 288. Treino da Chun-Li contra outra Chun-Li, com repetições dos
golpes. Toda a duração foi percorrida em quadros a cada segundo.
Mapas locais: `segundo-minuto-00.jpg` a `segundo-minuto-07.jpg`.
O endereço assinado é temporário; o arquivo local preserva a referência.

- **Início do vídeo**: boa referência de chutes comuns, guarda, levantamento
  do joelho e rasteiras. O corpo transmite o esforço; a perna continua
  visível durante o ataque.
- **Parte intermediária**: ataques aéreos, combinações, projéteis e especiais.
  Serve para separar os efeitos dos golpes normais daqueles dos especiais.
- **Por volta de 6:00**: chutes laterais com extensão clara, recolhimento e
  volta à base; sequência detalhada em `chun-li-chute-detalhe.jpg`.
- **Parte final**: configurações de treino e repetição de situações aéreas,
  úteis para planejar futuras verificações de defesa e antiaéreo.

Para a Lola, usar a clareza das poses, os apoios e a recuperação desses
chutes como referência. Kikoken, Spinning Bird Kick e a sequência de pernas
da Chun-Li são golpes próprios dela; não foram acrescentados ao repertório
da Lola nesta etapa.
