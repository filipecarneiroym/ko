# Poderes da Lola — implementação de 14/10/2026

Implementação em teste, aguardando Filipe jogar. Inspiração: SF4 Mobile,
mantendo os poderes e a identidade próprios da Lola. Os números abaixo são
calibração inicial do K.O, não reprodução de frame data oficial da Capcom.

| Ação | Celular / controle | Teclado |
| --- | --- | --- |
| Hadouken | SP | I |
| Shoryuken | Frente + SP ou frente, baixo, diagonal + soco | D + I (olhando para a direita) |
| Furacão | Trás + SP ou baixo, diagonal para trás, trás + chute | A + I (olhando para a direita) |
| EX | SP + soco, com a direção do especial; ou botão EX | E, com a direção do especial |
| Super Toca | SP + chute; ou botão SUPER | O |
| Ultra | SP + Focus; ou botão ULTRA | H |
| Focus | Segurar F e soltar para atacar | Segurar L |
| Passo do Focus | Dois toques para frente/trás durante a carga ou após acertar/bloquear | Dois toques A/D |

SP comum não gasta barra nem vira Super automaticamente. EX custa 250/1000;
Super custa 1000/1000. Ultra usa uma reserva própria, alimentada pelo dano
recebido, disponível a partir de 500/1000, reiniciada a cada round. A força
do Ultra varia de 255 a 300 conforme a reserva usada.

Shoryuken e EX sobem pelo motor, têm janelas de invulnerabilidade e recuperação
após o pouso. Furacão normal/EX avança girando, suspenso baixo, com vários
contatos e proteção contra projéteis durante o giro. Hadouken EX lança duas
bolas. Ultra lança uma bola maior, com animação própria e abertura de câmera.

Focus tem três níveis: carga curta, carga de 24 passos e máxima de 60 passos.
Nível 2 causa colapso; nível 3 atravessa defesa. Absorve apenas um golpe;
o dano absorvido fica cinza e se recupera após uma pausa sem apanhar.
Um segundo golpe remove essa recuperação. Furacão e Ultra quebram armadura.
Cancelar um especial que encostou com Focus custa 500/1000. No ar, o
cancelamento interrompe a subida e inicia o passo, descendo pela gravidade,
sem mudar a posição instantaneamente.

Os GLBs jogáveis têm 38 clipes e 20 ossos. Estudos antigos mantêm a calibração
com que foram assados. Novos comandos usam os mesmos bits combinados dos
quatro botões, preservando o formato das entradas online. A máquina também
usa os novos golpes por comandos.

## Hadouken — referência de movimento e energia

Conferido no vídeo local `Downloads/videoplayback.mp4`, trecho de 5:52,9 a
5:53,4: as duas mãos recolhem juntas ao lado do quadril e empurram para a
frente. Especial, EX e Ultra usam um alvo comum do corpo para aproximar as
mãos, em vez de repetir deslocamentos relativos a ombros diferentes.
Conforme a correção de Filipe, ambos os cotovelos guiam as mãos pela frente
da barriga até o disparo, sem recolher um braço para trás do tronco.

O projétil usa oito fases de vapor azul/ciano, com bolsões claros, bordas
irregulares e cinco volumes que se dispersam para trás. Substitui o contorno
oval e os aros da primeira versão, conforme a referência enviada por Filipe.
Uma textura compartilhada atende todos os volumes; os quadros do motor
dirigem a animação, inclusive o congelamento no impacto. A carga acompanha
o centro das mãos antes do lançamento. Removidos
o fogo laranja desses três golpes e a rotação contínua da bola. O material
não soma branco à textura, preservando suas cores. Dano, colisão, velocidade
e quadros de lançamento permanecem definidos pelo motor.

## Verificações

- Testes do motor: comandos nas duas orientações, recursos insuficientes,
  custos, trajetórias, pouso, carga, colapso, armadura, vida cinza, passos,
  cancelamento, determinismo e hitstop.
- Testes dos GLBs reais: presença dos clipes, posições finitas, ausência de
  penetração da pele no piso, altura do lançamento e ausência de alterações
  na simulação pela renderização.
- Capturas dos poderes: `estudos-mixamo/pipoca-v5-jogo/poderes/`.

## Próximos passos, após Filipe jogar

1. Ajustar dano, alcance, invulnerabilidade, recuperação e gasto de barra
   pelos problemas observados em partidas.
2. Refinar poses, tintas e sons dos novos golpes conforme a avaliação visual.
3. Se o objetivo continuar sendo aproximar o repertório do Ryu: versão aérea
   do furacão, golpes únicos (como ataque que quebra guarda baixa) e dash
   comum em vez da corrida. A Lola ainda mantém pulo duplo e esquiva rolando.
4. Medir no celular físico o desempenho das arenas e dos efeitos. Testar
   dois controles e online quando o relay estiver configurado no Render.

Nenhum teste automatizado equivale à aprovação do usuário jogando.
