# Spec: K.O — jogo de luta 1x1 no celular

## Objetivo
O link abre uma arena privada: senha compartilhada `O.K`, validada no servidor antes do apelido e PIN. `KO_SENHA_AMIGOS` permite trocar a senha; a troca revoga desbloqueios anteriores. A saída da conta preserva o desbloqueio da arena na sessão atual. Fundo ilustrado de combate somente nos menus, sem interferir na arena jogável.

Dois amigos, cada um no seu celular deitado, lutam um contra o outro pelo navegador (PWA instalável).
Sucesso = criar sala, o amigo entra pelo código, os dois veem a mesma luta e o resultado fica salvo no ranking.

## Decisões (aprovadas)
- Nome: **K.O** · Entrada: **apelido + PIN de 4 dígitos** (o celular lembra; a mesma conta funciona em outros aparelhos) · Visual: **traço liso estilo desenho animado, em alta resolução** (começou em pixel art; trocado a pedido) · 16 lutadores originais com mecânicas inspiradas em SF2, MK3, KOF94 e KI.
- Pasta: `C:\Users\Windows\Desktop\Digital\K.O`, mesmo molde da YM: `deploy/`, `laravel/`, `public/`.

## Como funciona
1. Jogador digita apelido e PIN → cria o `jogador` ou entra na conta existente (cookie "lembrar"). Contas antigas cadastram o PIN na sessão original; o PIN é armazenado como hash.
2. **Criar sala** → código de 4 letras (`K7P2`). O amigo digita o código → entra.
3. Cada um escolhe o lutador; quando os dois confirmam, a luta começa nos dois aparelhos.
4. **Rede (lockstep):** os dois celulares rodam a mesma simulação (60 quadros/s, só números inteiros)
   e trocam apenas os botões apertados em cada quadro, via um **relay WebSocket próprio** (`php artisan ko:relay`), sem pacote extra.
   Atraso calculado pelo ping (3 a 12 quadros) esconde a latência; se o comando do outro não chegou, espera.
5. Fim da luta (melhor de 3 rounds, 99 s cada) → os dois enviam o resultado; o servidor grava
   quando os dois concordam e atualiza o ranking.

## Inspiração (mecânicas de gênero, nada copiado)
O que cada clássico traz para o K.O, com nome e visual próprios:
| De | Mecânica no K.O |
|---|---|
| Street Fighter II | Golpes especiais por comando (direção + ⚡), projéteis, pulo e agachar |
| Mortal Kombat 3 | Botão de defesa, corrida (toque duplo para frente), combos em sequência de botões, **Golpe Final** no fim da luta ("ACABA!") |
| KOF '94 | Esquiva rolando (👊+🦵 juntos), **barra de poder** que enche apanhando e batendo; cheia, o ⚡ vira **Super** |
| Killer Instinct | Contador de combo com locutor ("5 HITS — BRUTAL!"), **Quebra-Combo** (🛡️+⚡ no meio do combo do outro) |

## Lutadores (16 originais, cada um com um jeito de jogar)
| Lutador | Quem é | Estilo de jogo | Especial | Super |
|---|---|---|---|---|
| **Volt** | motoboy com luvas elétricas | equilibrado, bom para começar | faísca em linha reta | arrancada de moto atravessando a tela |
| **Kilo** | levantador de peso gigante | agarrador, lento e muito forte | agarrão com supino | gira a barra de anilhas e arremessa |
| **Nix** | patinadora com lâminas de gelo | o mais rápido, combos longos | deslize cortante pelo chão | pista de gelo: o outro escorrega |
| **Eco** | DJ com caixas de som nas costas | luta de longe | onda sonora que empurra | o grave estoura e atordoa |
| **Brasa** | ex-bombeira com escada e extintor | pressão de perto | nuvem de extintor que cega | escada girando como hélice |
| **Maré** | surfista com prancha | alcance longo | golpe de prancha girando | onda gigante cruza a tela |
| **Truque** | mágico de palco com cartola | confunde e engana | troca de lugar na fumaça | cartola gigante que prende o outro |
| **Maromba** | fisiculturista bronzeado | aguenta pancada e fica mais forte posando | pose de bíceps: aguenta 1 golpe sem recuar e ganha força | sequência de poses com flash que cega e ombrada final |
| **Ginga** | capoeirista | esquiva baixo e contra-ataca girando | rasteira giratória | sequência de aús e martelos no ritmo do berimbau |
| **Kira** | lutadora de kickboxing | combos rápidos de perto | joelhada voadora | chuva de chutes giratórios |
| **Pipoca** | coelha boxeadora | pula alto, pulo duplo | cenoura bumerangue | some na toca e salta por baixo do outro |
| **Uivo** | lobo lutador | investidas ferozes | uivo que atordoa | três investidas seguidas com as garras |
| **Toco** | lenhador barbudo com tronco | pesado, golpes de longo alcance | tora rolando pelo chão | grita "Madeiraaa!" e uma árvore cai na tela |
| **Vó Nena** | vovó com bolsa pesada e tricô | traiçoeira, prende o outro | novelo de lã que enrola o adversário | chuva de chineladas voadoras |
| **Vô Tião** | vovô com bengala e boné | lento, mas cheio de truques | bengala que puxa o outro pelo pescoço | dentadura voadora que morde várias vezes |
| **Fóssil** | cientista com braço robô de dinossauro | pesado, defesa forte | mordida mecânica | o braço vira cabeça de T-rex e esmaga |
Cada um tem seu Golpe Final próprio.
**Para a família toda:** sem sangue nem violência pesada. Os Golpes Finais são engraçados e
cartunescos (vira estátua de gelo, sai voando como foguete, fica tonto com passarinhos girando).

## Controles (tela deitada)
Direcional em cruz à esquerda; à direita 4 botões redondos em losango (estilo controle clássico): 👊 soco · 🦵 chute · 🛡️ defesa · ⚡ especial. Multitoque.
Combinações: 👊+🦵 esquiva · 🛡️+⚡ quebra-combo · frente-frente corrida.
No PC (para testar): WASD + J K L I.

## Banco (SQLite)
- `jogadores`: id, apelido (único), pin_hash (nulo para contas antigas), vitorias, derrotas, timestamps
- `salas`: id, codigo (único), host_id, convidado_id, lutador_host, lutador_convidado, status (`esperando|escolhendo|lutando|encerrada`), timestamps
- `partidas`: id, sala_id, vencedor_id, perdedor_id, rounds_vencedor, rounds_perdedor, resultado_host, resultado_convidado (json), timestamps

## Tecnologia

Atualização aprovada em 11/10/2026: laboratório 3D separado em `/laboratorio/3d`, com `@babylonjs/core`, `@babylonjs/loaders` e esbuild autorizados pelo usuário. Preparação local por `npm ci` e `npm run build:3d`; bundle servido pelo próprio projeto, sem npm no servidor. A simulação continua sendo `ko-sim.js`. Modelos finais de Pipoca e Uivo ainda pendentes; contrato e referências em `art/premium/modelos-3d/`. O laboratório não substitui as partidas atuais nem altera o ranking.
- Laravel 12, PHP 8.2+, SQLite — igual à YM. Tempo real por relay próprio (`ko:relay`), sem dependência nova.
- Front sem build: Blade + `public/js/ko-sim.js` (motor), `ko-arte.js` (desenho), `ko.js` (telas, controles, rede). Canvas 2D puro.
  Sem Phaser, sem Vite, sem npm no servidor.
- PWA: `site.webmanifest` (orientação paisagem, tela cheia), `sw.js`, `offline.html`.

## Comandos
```
cd laravel
composer setup              # instala, cria .env, chave, banco e migrations
php artisan serve           # site em http://localhost:8000
php artisan ko:relay        # tempo real (outro terminal)
php artisan test            # testes
```

## Estrutura
```
K.O/
  deploy/   atualizar.sh, backup-*.sh, ko-reverb.service, ko-backup.service/.timer
  laravel/  app/ (Models, Http/Controllers, Services), database/migrations, resources/views, tests/
  public/   index.php → ../laravel, js/ko.js, css/ko.css, sw.js, site.webmanifest
  SPEC.md
```

## Estilo de código
Igual à YM: nomes em português, model enxuto com `$fillable`/`casts()`, controller fino,
regra maior em `app/Services/`, comentário de uma linha dizendo o "porquê".

## Testes
PHPUnit, SQLite em memória, um teste de Feature por funcionalidade (entrar, sala, resultado, ranking).
A simulação da luta tem um teste em JS (`node`) que roda os dois lados com os mesmos comandos e confere
que terminam no mesmo estado (determinismo).

## Limites
- Sempre: rodar testes antes de entregar; validar apelido/código/resultado no servidor.
- Perguntar antes: mudar o banco depois de publicado; novos pacotes além do Reverb.
- Nunca: segredos no código; apagar dados do ranking em atualização.

## Critérios de pronto
- [ ] Abrir no celular, instalar na tela inicial, abre deitado e em tela cheia.
- [ ] Criar sala → código; outro celular entra pelo código; os dois escolhem lutador.
- [ ] Luta roda igual nos dois aparelhos (mesma vida, mesmo vencedor).
- [ ] Resultado salvo e ranking mostra vitórias/derrotas.
- [ ] `php artisan test` e o teste de determinismo passam.
- [ ] `deploy/atualizar.sh` no mesmo molde da YM (backup do banco, manutenção, volta sozinho se falhar).

## Situação (10/10/2026)
Leva 1 pronta: jogo completo com Pipoca e Uivo (online, CPU, treino, ranking, 6 cenários, PWA).
Leva 2 pronta: Maromba (pose que aguenta golpe e dá força; Super que cega; Golpe Final "Supino!") e Ginga (rasteira que passa por baixo; Super roda de aús; Golpe Final "Roda de Capoeira!").
Leva 3 pronta: Vó Nena (novelo que rola no chão e enrola; chuva de chineladas; Golpe Final "Hora do Tricô!") e Vô Tião (bengala-gancho que puxa; dentadura voadora que morde; Golpe Final "Dentadura Gigante!").
Leva 4 pronta: Kira (joelhada voadora; chuva de chutes giratórios; Golpe Final "Nocaute Técnico!") e Toco (tora rolando que derruba; árvore "Madeiraaa!"; Golpe Final "Estátua de Madeira!").
Leva 5 pronta: Nix (deslize rente ao chão; pista de gelo em que o outro escorrega; Golpe Final "Estátua de Gelo!") e Eco (onda sonora que empurra; grave que estoura e atordoa; Golpe Final "Som nas Alturas!").
Leva 6 pronta (elenco completo, 16 lutadores): Truque (troca na fumaça; cartola gigante; "Sumiu!"), Maré (prancha girando; onda gigante; "Tubo Perfeito!"), Volt (faísca; arrancada de moto; "Choque Total!"), Kilo (agarrão especial de longe; barra giratória; "Peso Pesado!"), Brasa (espuma do extintor; escada-hélice; "Banho de Espuma!") e Fóssil (defesa forte; mordida mecânica; T-rex; "Dino-Rugido!").

## Fora da primeira versão
Os 16 lutadores entraram em levas; todos prontos.
Rollback netcode (trocar o lockstep se o atraso no 4G incomodar), modo equipe 3x3 estilo KOF,
mais lutadores, modo local 2 jogadores no mesmo celular, recuperação de conta sem o navegador original.

## Revisão de confiabilidade e mobile

- PIN de exatamente 4 dígitos aprovado; migração aditiva sem apagar jogadores ou ranking.
- Analógico visual, áreas de toque ampliadas e feedback imediato nos formulários.
- Aviso de rotação apenas durante a luta; espera e seleção utilizáveis em pé.
- Docker para Render: Apache e relay supervisionados, `/ws` encaminhado na mesma porta pública.
- Mensagens vinculadas à partida, limites no reenvio, hash do estado completo e confirmação visível do ranking.
- Vozes originais sintetizadas: perfis próprios e frases para especial, Super e Golpe Final.
- Publicação e testes em aparelhos físicos continuam necessários; configuração Docker não foi executada neste ambiente Windows.
