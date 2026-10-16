# Revisão geral da Lola — 16/10/2026

## Correções

- Encerramento natural: a interface para a simulação em `fim`, com `fT=0`. O renderizador usava esse zero para a derrota e podia mostrar a pose inicial do clipe. Agora apresenta a derrotada já assentada e anima a comemoração com um relógio exclusivamente visual. Não altera o resultado nem avança a física.
- Focus: um toque duplo durante a pausa de impacto era lido e apagado antes de o motor voltar a executar ações. Agora fica pendente até a retomada, respeitando a direção do comando mais recente.
- Controle externo: o botão usado para voltar da pausa podia iniciar um chute. A retomada exige soltar os botões antes de aceitar novos comandos. A sobreposição da pausa também cobre os atalhos EX/SUPER/ULTRA.
- Chute alto K2: giro do quadril ampliado de aproximadamente 31° para 63–68°, com pivô do pé de apoio, preparação e recolhimento. A pelve e a orientação do pé foram ajustadas para conservar o apoio no chão e evitar torção inversa do tornozelo. Mantém a perna voltada à câmera nas duas orientações. Tempos, alcance de colisão e dano permanecem os mesmos.

## Comparação com as referências

Referências locais em `tmp/analise-video-completo/` e `tmp/analise-sexto-video/`, provenientes dos vídeos enviados pelo usuário:

- `levantada-ryu-detalhe.jpg`: sequência de mãos próximas à cabeça, recolhimento das pernas, impulso em arco e retorno ao apoio. Conferida com a recuperação real após rasteira, além das poses isoladas.
- `chun-li-chute-detalhe.jpg`: preparação, extensão, giro do corpo e apoio em uma perna. Usada para revisar a coordenação corporal do K2; os múltiplos chutes do especial da Chun-Li não foram tratados como o K normal.
- `efeitos-focus-ryu.jpg`: clarão da carga do Focus. As chamas azuis da Lola são uma adaptação solicitada pelo usuário, não uma reprodução literal desse clarão.
- `subida-ken.jpg` e `chute-ken-corpo.jpg`: subida com o punho alto, fogo do especial e poses aéreas. Conferidas com soco aéreo, subida EX e capturas dos efeitos.

A revisão verifica correspondência de poses e sequência, comandos e estabilidade. Não constitui medição quadro a quadro de todos os movimentos do SF4 nem comprovação de FPS em um aparelho físico. O jogo mantém movimentos e poderes próprios.

## Validação

- Suíte JavaScript completa: **210 testes passaram**, nenhum falhou.
- PHP: **43 testes, 201 verificações**, todos passaram.
- Regressões de encerramento: 36 caminhos reais do motor, dos dois lados, com e sem Final, por ataques diferentes e por tempo.
- Focus: quatro casos de cancelamento durante impacto, frente/trás e ambos os lados.
- Auditoria determinística: 34 sequências de comandos, quatro situações de defesa e três partidas completas, uma por dificuldade da CPU.
- Geometria importada: contatos e apoios dos golpes, saltos, quedas e animações finais; o pé de apoio do K2 permanece ancorado ao longo do clipe.
- Edge, jogo real: toque com dois dedos e soltura, queda e recuperação, comandos de poderes, pausa pelo controle, encerramento natural e recuperação de falha gráfica.
- Entrada e seleção: sete tamanhos, vertical e horizontal, sem corte lateral. EX/SUPER/ULTRA: seis tamanhos, textos completos e sem sobreposição dos golpes.
- Voz: decodificação e mistura em 44,1 e 48 kHz, sem voz sintética por oscilador.
- Online **local**, duas sessões: login, convite, seleção, luta 3D sincronizada, reconexão, confirmação do resultado e revanche.

## Próxima validação

Filipe precisa jogar a versão publicada para aprovar o resultado visual e a sensação dos controles no celular. O Render atual não inclui o relay WebSocket; o teste online local não comprova funcionamento online na publicação. A configuração de produção do relay continua pendente conforme o guia do projeto.
