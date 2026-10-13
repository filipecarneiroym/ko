# K.O — guia para agentes (Codex, Claude)

**Responda sempre em português do Brasil.** O usuário (Filipe) valida tudo
jogando; nada é "aprovado" sem ele testar. Qualidade visual máxima é requisito.

## O que é
Jogo de luta 1×1 no navegador. Laravel (`laravel/`) serve as páginas; o jogo
é JS puro em `public/js/`:
- `ko-sim.js` — motor determinístico a 60 passos/s (regras, dano, colisão).
  **O 3D nunca muda regra, tempo ou resultado.**
- `ko-cpu.js` — máquina (`KOCPU.PERFIS`: fácil, médio, difícil).
- `ko.js` — telas, controles, salas online, laço da luta.
- `ko-arte.js` — desenho 2D (arte, placar/HUD, avisos).
- `ko-jogo-3d.js` e `ko-laboratorio-3d.js` — **gerados** a partir de
  `src/3d/` com `npm run build:3d` (Babylon.js 9.30 + esbuild). Nunca edite os
  gerados; edite `src/3d/` e recompile.

## Gráficos 3D (estado em 2026-10-13)
- Só a **Pipoca** tem modelo 3D: `public/modelos/estudos/pipoca-v5-azul.glb`
  (jogador / lado 0) e `pipoca-v5-vermelha.glb` (máquina / lado 1).
- `src/3d/jogo-3d.js` expõe `window.KO3D = { disponivel(ids), criar(canvas, { cenario, lutadores }) }`.
  `ko.js` (`prepararGraficos`) cria o 3D no `#tela-3d`; o canvas 2D `#tela`
  fica por cima só com o placar (`A.desenhar(s, { somenteHud: true })`).
  Se o lutador não tem modelo ou o 3D falha, a luta segue em 2D.
- Contra a máquina com 3D ligado, o adversário é o espelho (Pipoca vermelha).
- Botão "Gráficos: 3D/2D" na escolha e na pausa (`localStorage['ko-graficos']`).
- Arenas realistas (`src/3d/arena-realista.js`, tabela `CONFIG`): fotos 360°
  e HDR CC0 do Poly Haven em `public/arenas/<arena>/`, chão PBR, partículas
  (neve, chuva, folhas, areia, poeira). Reserva desenhada em `arenas.js`.
  Preparação: `scripts/producao-3d/baixar-polyhaven.mjs` + `preparar-arena.py` (Blender).
- Câmera estilo SF4 em `src/3d/camera-luta.js` (compartilhada com o laboratório).
- Efeitos estilo Street Fighter IV em `src/3d/efeitos-sf4.js`: tinta
  translúcida que entra rápido e some em curva; manchas grandes (Super, K.O.,
  quebra) **atrás** da lutadora (z > 0) para não escondê-la; **sem nome do
  golpe escrito** (como no SF4). No jogo os letreiros 3D ficam desligados
  (`letreiros: false`), o K.O. vem do placar 2D. O impacto nasce no **ponto de
  contato** (`contato()`: interseção de `KOSim.caixaHit` com `KOSim.corpo`;
  no evento `acerto` o `lado` é de quem bate, no `defendeu` de quem defende).
- CSP (`laravel/app/Http/Middleware/SecurityHeaders.php`): `img-src blob:`
  liberado só nas rotas de luta e no laboratório (texturas do GLB).

## Pipoca: produção do modelo
Padrão completo em `art/premium/modelos-3d/PADRAO-REFINAMENTO-3D.md` (vale para
todos os próximos personagens) e plano em `art/premium/modelos-3d/PLANO-PIPOCA-JOGAVEL.md`.
Contrato: 31 clipes, 20 ossos (`src/producao3d/rig.mjs`), +Y para cima, frente
+X, corpo de 2,5 m = 60 px (24 px/m). Pipeline: Blender 5.2
(`preparar-jogo-pipoca-v5.py`) → `scripts/producao-3d/gerar-pipoca-v5.mjs`
(retarget + golpes em `src/producao3d/pipoca-v5*.mjs`) → GLB.

## Testes (Windows, Edge em modo swiftshader: 1–12 FPS, é normal ser lento)
Playwright fica em `.browser-check/node_modules`. Rodar da raiz:
- `node laravel/tests/browser/jogo-3d.cjs` — jogo real (servidor PHP 8019,
  sqlite): Pipoca × Pipoca 3D contra a máquina troca golpes; Uivo cai no 2D.
  Capturas em `art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo/jogo/`.
- `node laravel/tests/browser/efeitos-sf4-3d.cjs` — soco, chute, defesa,
  cenoura, Super, K.O. (capturas em `.../pipoca-v5-jogo/efeitos/`).
- `node laravel/tests/browser/luta-pipoca-3d.cjs`, `arenas-3d.cjs`, `giro-arenas-3d.cjs`.
- PHP: `cd laravel && php artisan test`.
Testes com página simulada (`page.route`) precisam servir `/modelos/` **e**
`/arenas/`, senão a cena sai preta.

Armadilhas já vistas: `node -e` com template string perde `${}` no shell — use
um arquivo .cjs; `page.goto` para a mesma URL só mudando hash não recarrega;
`ctx.filter = blur` em cada pincelada trava o carregamento — desfoque uma vez só.

## Próximos passos (ordem pedida pelo usuário)
1. **Usuário testar** Pipoca × Pipoca 3D (máquina fácil/médio/difícil, versus
   1×1 local com dois controles, online na sala). Ajustar o que ele apontar.
2. **Final (Chuva de Cenouras) em 3D** — hoje, no modo 3D, o Final 2D fica
   oculto (`somenteHud`). Fazer a versão 3D com os efeitos SF4.
3. **Celular:** reduzir peso das arenas (3–8 MB cada, 32 MB no total; pedra
   da neve ~24 mil triângulos) e dos pacotes JS (~3,3 MB cada); medir FPS.
4. **Telas** de acesso, login, sala e botões de voltar: revisar e melhorar.
5. **Limpeza** do que não é mais usado (estudos v3/v4/v13, GLBs antigos,
   scripts substituídos, renders de rascunho, `ko.zip`/`ko-mobile-pin-render.zip`
   se não forem do deploy). Conferir com grep antes de apagar e rodar os testes.
   **Manter as fotos/artes de todos os outros personagens** (entram depois,
   um por vez, seguindo o padrão de refinamento).
6. Depois da aprovação da Pipoca: próximo personagem em 3D.
