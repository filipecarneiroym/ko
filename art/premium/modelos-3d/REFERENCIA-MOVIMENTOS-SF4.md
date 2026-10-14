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
- Pé do chute aéreo alinhado à altura da caixa de acerto.
- Chutes comuns e furacão normal têm rastro fino e translúcido, sem névoa
  de fogo cobrindo a perna. Os impactos continuam na camada de efeitos SF4.
- Revisão do K em 14/10: no trecho do Ryu do terceiro vídeo, por volta
  de 00:37, há uma extensão e recolhimento da mesma perna. O K comum da
  Lola agora acompanha essa referência: uma perna chuta, a outra sustenta
  o corpo, sem disparar automaticamente o chute da outra perna.
  A câmera fica em -Z: olhando para +X, usa D; olhando para -X, usa E,
  mantendo a perna que chuta voltada para a tela. A seleção é só visual.

O K mantém duração de 24 quadros e contato nos quadros 6–8, com dano 30.
Foi removido o segundo contato automático dos quadros 12–14 (dano 35),
junto com sua animação. A aprovação visual depende de Filipe jogar.

## P e F — revisão de 14/10

O soco básico P foi refeito na v5: extensão rápida nos quadros ativos 3–5,
cotovelo quase reto (99% do alcance anatômico), outra luva protegendo o
rosto, recolhimento e guarda no quadro 12. Antes, a extensão era de 87%.
A luva continua dentro da caixa do motor, sem aumentar o alcance da regra.
O segundo soco do combo, o soco baixo e o Focus já estendiam o braço;
os testes conferem extensão acima de 97% e recolhimento nos dois lados.
Socos e soltura do Focus usam rastro fino e translúcido, sem chama cobrindo
a luva. A posição do membro é atualizada antes do efeito, evitando linhas
atravessando a arena ao iniciar o golpe.

P inicia um único soco por toque; baixo + P soca agachada; no ar, P é soco
aéreo. Novo toque após contato pode emendar no segundo soco. Segurar P
não dispara sozinho os dois braços. F é Focus, com três níveis de carga,
soltura, absorção de um golpe e cancelamento em passo. As regras gerais
do Focus foram comparadas com o manual oficial da Capcom:
https://static.capcom.com/manuals/ssfiv/SSFIV_3DS_DMNL_EN.pdf
O manual é da edição 3DS; não determina números exatos da versão mobile.
Os tempos e danos continuam sendo a calibração própria do K.O.
O rosto da guarda herdada apontava cerca de 20° para baixo; durante o
segundo soco, o giro do corpo inclinava ainda mais o olhar. Guarda,
deslocamento, socos, chutes de chão, Hadouken e Focus agora mantêm o
focinho na direção do adversário, com leve elevação na guarda baixa.
Quedas, giros dos especiais e levantada preservam suas poses próprias.
Na levantada, a guarda é fechada no último quadro efetivamente mostrado
pelo motor (39), e a correção do piso mede também intervalos de 1/8 de
quadro para preservar o arco rápido sem afundar o modelo entre poses.

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

## Queda, levantada rápida e derrota — terceiro vídeo

Vídeo enviado em 14/10/2026, baixado para
`tmp/analise-video-completo/levantada-video.mp4` (903,117 segundos,
640 × 360). Referência detalhada do Ryu em aproximadamente **2:15,2–2:16,4**,
com quadros em `levantada-ryu-detalhe.jpg`: pernas recolhidas sobre o tronco,
mãos no chão junto da cabeça, impulso dos braços e recuperação em arco.

Conforme a correção de Filipe, as luvas apoiam por baixo das orelhas e o
movimento é rápido: recolhe nos quadros 3–5, empurra até o 7, passa pelo arco
no 10 e volta aos pés no 14. O clipe termina na guarda, mantendo os 40 passos
da regra de recuperação. A queda mantém seus 46 passos.

- Removida a definição duplicada de `caido` que substituía a queda de costas
  por uma pose agachada. Recuperação fica no clipe `levantando`.
- A emenda para a guarda só ajusta os últimos quadros. Antes ela substituía
  toda a ação a partir do quadro 4. Retirada também a mistura de seis quadros
  entre queda e levantada, pois os clipes já compartilham a pose de emenda.
- Apoios das mãos usam alvos fixos no piso. A malha é conferida contra o
  chão também entre os passos, durante a exportação.
- O contato da queda no quadro 8 gera uma onda clara rente ao chão e poeira
  baixa que se expande e some. O pouso da levantada no 14 tem um efeito menor.
  Esses efeitos seguem o relógio da pose e congelam junto com ela.
- Pose própria de derrota: corpo deitado, braços relaxados e pernas mais
  estendidas, ligeiramente assimétricas, sem ficar preso na postura de
  pernas recolhidas usada no impulso.
- No encerramento sem o Final, o estado do perdedor pode continuar como
  `tonto`. O 3D apresenta a derrota e usa o relógio da fase para concluir a
  queda. Depois do Final mantém a pose deitada sem reiniciar a animação.
  Essa apresentação não modifica o estado ou o resultado do motor.

Verificações: mãos junto da cabeça e próximas do piso, pernas recolhidas
antes do impulso, fase aérea do arco, emendas, relaxamento da derrota e pele
acima do piso nos dois modelos e orientações; capturas no navegador para
queda, apoio, arco, pouso e encerramento com e sem Final.
