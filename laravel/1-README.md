# K.O — jogo de luta 1x1 no celular

Dois jogadores, cada um no seu celular deitado, lutam pelo navegador. O jogo é um app instalável (PWA):
abre em tela cheia e deitado, sem loja de aplicativos.

- **Online:** um cria a sala e passa o código de 4 letras; o outro entra pelo código.
- **Contra o computador** e **Treino** (boneco que não cai) rodam só no celular.
- **Ranking:** cada luta online conta quando os dois celulares concordam com o resultado.

Mecânicas inspiradas nos clássicos (nada copiado): especiais e projéteis (Street Fighter II), botão de
defesa, corrida, combos em sequência e Golpe Final (Mortal Kombat 3), esquiva e barra de poder com Super
(KOF '94), contador de combo com locutor e quebra-combo (Killer Instinct). Tudo para a família: os Golpes
Finais são engraçados, sem sangue.

## Estrutura (mesmo molde da YM)

```
K.O/
  deploy/    atualizar.sh, backup-offsite.sh, ko-relay.service, ko-backup.*, nginx-ko.conf
  laravel/   o sistema (Laravel 12 + SQLite)
  public/    o que o navegador acessa (index.php aponta para ../laravel)
  SPEC.md    o que é o jogo e o que falta
```

Dentro de `laravel/`:

| Onde | O quê |
|---|---|
| `app/Models` | `Jogador` (apelido, vitórias, derrotas), `Sala` (código, host, convidado), `Partida` (cada luta) |
| `app/Services/PartidaService.php` | grava o resultado; o ranking só muda quando os dois relatos batem |
| `app/Console/Commands/Relay.php` | `php artisan ko:relay`: servidor WebSocket que liga os dois celulares |
| `config/ko.php` | elenco (quem está pronto / "em breve"), cenários e endereço do relay |
| `routes/web.php` | entrar, salas, resultado, ranking, treino e CPU |
| `resources/views` | telas (Blade) |
| `tests/` | testes PHP (Feature) e do motor da luta (`tests/js`) |

Em `public/js/`:

| Arquivo | O quê |
|---|---|
| `ko-sim.js` | motor da luta. Só números inteiros: com os mesmos botões, chega no mesmo resultado nos dois celulares |
| `ko-arte.js` | desenho dos lutadores, cenários, placar e efeitos |
| `ko.js` | telas, controles de toque, rede, computador, som e locutor |

## Rodar no computador

Precisa de PHP 8.2+ (com `pdo_sqlite`) e Composer.

```
cd laravel
composer setup              # instala, cria .env, chave e banco
php artisan serve           # jogo em http://localhost:8000
php artisan ko:relay        # em outro terminal: tempo real das salas online
```

Teclado no PC: **A/D** andar, **W** pular, **S** agachar, **J** soco, **K** chute, **L** defesa, **I** especial.
Para testar online sozinho, abra duas janelas (uma anônima) com apelidos diferentes.

## Testes

```
cd laravel
php artisan test            # entrar, salas, resultado/ranking e o relay de verdade
node --test tests/js/       # motor da luta: determinismo, combos, Super, quebra-combo, rounds
```

## Como funciona a rede (lockstep)

A luta roda nos dois celulares ao mesmo tempo. Eles trocam só os botões de cada quadro (60 por segundo)
pelo relay. Cada botão vale para um quadro um pouco à frente (o atraso é calculado pelo ping, de 3 a 12
quadros); se o botão do outro ainda não chegou, a luta espera. A cada 2 segundos os dois comparam uma
"impressão digital" da luta; se divergir, avisa e o resultado não vai para o ranking.

## Novo lutador

1. `public/js/ko-sim.js` → em `LUTADORES`: vida, velocidade e os golpes (caixas de acerto, quadros, especial e Super).
2. `public/js/ko-arte.js` → em `ARTE`: o desenho e as poses do especial; em `FINAIS`: o Golpe Final.
3. `laravel/config/ko.php` → `'pronto' => true` no lutador.
4. `public/js/ko.js` → em `STATUS`: força, velocidade, alcance e a frase da tela de escolha.
