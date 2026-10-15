# Auditoria de ritmo, controles e golpes — 14/10/2026

Resultado: o ritmo do motor foi corrigido em taxas baixas de desenho e a
entrada de defesa deixou de disparar recuo por um único toque. Isso não
certifica equivalência exata ao SF4 nem aprovação visual de Filipe.

## Referência enviada

Novo vídeo: 1059,271 s, 640×360, 30 quadros/s. Percorrida toda a duração
em 18 folhas de contato a um quadro por segundo. Trechos de movimento
revistos a 30 quadros/s. Não foi uma reprodução contínua com áudio.

- 0:00–1:18: introdução, menus, seleção e espera online.
- ~1:18–2:50: Guile × Ken; salto, ataques, defesa, recuperação e K.O.
- ~3:00–3:47: menus, escolha e carregamento de Akuma × Juri.
- ~3:48–6:59: Akuma × Juri; projéteis, ataques aéreos, defesa e Ultras.
- A partir de ~7:00, o próprio autor avisa sobre um defeito de brilho e
  filtro de edição. As lutas seguintes incluem Akuma, Guile, Ken e Ryu.
  Essa parte não define a luminosidade dos nossos efeitos.

Há pausas online e congelamentos de impacto. O vídeo de 30 FPS não permite
deduzir todos os tempos de entrada ou identificar quadros de regra a 60 Hz.
Não transplantar tabelas da versão de console para a versão mobile.

Salto inicial de Ken, na sequência de ~1:18,3–1:19,0: fase aérea aparente
de aproximadamente 0,57–0,63 s, com incerteza de quadros de saída e pouso.
A Lola toca o chão após 35 passos, 0,583 s, sem salto duplo nem contato.
Está nessa faixa; isso não mede a latência entre o botão e a imagem no aparelho.

## Correções confirmadas

O laço aceitava 250 ms de tempo por desenho, mas executava no máximo oito
passos. Em 30 segundos de teste do código real:

| Desenho | Antes: passos de luta | Depois: passos de luta |
| --- | ---: | ---: |
| 6 FPS | 1440 | 1799–1800 |
| 5 FPS | 1200 | 1799–1800 |
| 4 FPS | 960 | 1799–1800 |

O ajuste inicial para 15 passos cobria os 250 ms aceitos, mas a medição
real com SwiftShader ficou em 1,15 FPS e só 17,19 passos/s. Isso revelou
que também era necessário ampliar a janela de tempo. O ajuste final
aceita até 2 segundos e 120 passos por desenho; o relógio continua 60 Hz.
Os testes cobrem de 1 a 120 FPS, pausa/espera de rede e interrupção longa.
Não mudaram dano, velocidade, duração de golpe ou hitstop. Interrupções
acima de 2 s continuam limitadas para não reproduzir minutos de entradas
antigas. FPS tão baixo não representa fluidez aceitável: é preciso melhorar
a renderização e medir também com GPU no aparelho do usuário.
Trocar a visibilidade da aba também zera o saldo do relógio, para evitar
uma recuperação de tempo ao retornar à página.

Medição final alinhada aos mesmos quadros do laço real: 5,6836 s entre
amostras, 341 passos, **59,997 passos/s**, com apenas **0,880 FPS** de
desenho no SwiftShader. O passo de regra acompanhou o relógio apesar da
renderização lenta. Esse resultado não significa animação fluida.
Registro: [auditoria-ritmo-3d.json](auditoria-ritmo-3d.json).

Controle e direcional de toque tinham um atalho que transformava a ida
rápida à borda para trás em `RC`. Isso fazia um único comando recuar e
podia atrapalhar a defesa. Removido esse atalho nos dois meios de entrada.
O motor continua reconhecendo dois toques rápidos para trás.

O recuo existe no SF4 Volt mobile: o [relato de teste direto do iLounge](https://www.ilounge.com/index.php/articles/comments/iphone-ipad-gems-deathsmiles-ducati-challenge-hd-sonic-sega-racing-sfiv-vol)
descreve dois toques para frente ou para trás. Não é um manual da Capcom;
as páginas oficiais antigas consultadas não forneceram o manual mobile.
Essa confirmação atende à condição de Filipe para manter o recuo.

## Repertório e medidas da Lola

`node scripts/auditar-ritmo-lola.cjs` usa o leitor de controle real para
acionar os 17 golpes nas duas orientações. Verifica início, fim, pouso,
quantidade de projéteis e retorno à guarda. P2 e K2 são alcançados por
comandos de combo após contato, sem forçar o nome do golpe no estado.
Dados completos: [auditoria-ritmo-lola.json](auditoria-ritmo-lola.json).

| Golpe | Primeiro quadro ativo/disparo | Duração nominal |
| --- | ---: | ---: |
| P / P2 | 3 / 5 | 200 / 300 ms |
| K / K2 | 6 / 7 | 400 / 467 ms |
| Soco baixo / rasteira | 3 / 6 | 167 / 433 ms |
| Soco aéreo / chute aéreo | 4 / 5 | 333 / 367 ms |
| Hadouken / EX | 10 / 10 | 500 / 500 ms |
| Shoryuken / EX | 6 / 6 | 667 / 733 ms |
| Furacão / EX | 9 / 9 | 667 / 733 ms |
| Super / Ultra | 44 / 25 | 1033 / 1167 ms |
| Focus | q19; solta em q14 | 34 quadros da sequência; carga prolonga o tempo |

Esses tempos vêm das regras da Lola. Contato acrescenta hitstop; Super e
Ultra têm congelamento de abertura. Portanto não confundir duração
nominal com duração total filmada. Caminhada livre medida: 112,5 px/s
para frente, 90 px/s para trás; altura de regra da Lola: 60 px. Distância
em pixels de câmera do vídeo não pode ser comparada diretamente à arena.

Quatro verificações de guarda (alta/baixa × dois lados) bloquearam golpes
correspondentes sem perder vida. Três partidas completas CPU × CPU, com
semente fixa, terminaram: fácil 110,68 s, médio 113,40 s, difícil 80,45 s
de tempo simulado, incluindo aberturas e intervalos. Não são benchmarks
de FPS nem partidas contra uma pessoa. Há acertos, bloqueios, combos,
quedas, Super, Ultra e EX nos registros.

A página Laravel foi exercitada com Gamepad API alimentada por controle
virtual standard: P, K, F, SP, EX, Super, Ultra e defesa para trás. A
defesa bloqueou um soco sem passar por recuo. Recuperação real por
rasteira também chegou de `caido` a `levantando` e `parado`.
USB/Bluetooth físicos e a latência da tela precisam do teste de Filipe.

## Diferenças ainda presentes

O repertório é autoral e ainda inclui corrida sustentada, pulo duplo,
esquiva rolando com P+K e Super Toca. Não são equivalentes ao conjunto
padrão de movimentos do SF4 mostrado. A ordem sugerida para aproximar
mais é: validar ritmo/defesa no aparelho; substituir corrida por dash
frontal; decidir pulo duplo e rolamento; depois acertar tempos individuais
com gravações lado a lado, sem efeitos de rede e com os comandos visíveis.

Os 192 testes JS da execução ampla passaram. Depois do ajuste final,
os 21 testes de relógio, direção e leitor de controle também passaram,
além dos testes da partida real. As capturas e os testes de geometria cobrem
poses, apoios, extensão dos golpes e retorno à guarda. Nenhum desses
resultados equivale à aprovação visual do usuário.
