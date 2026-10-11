# Pipoca: movimentos de luta e corpo articulado

Estado em 11/10/2026: estudo animável no laboratório, sem aprovação artística
final. Origem da guarda: `art/premium/movimentos/Boxing.fbx`, baixado pelo usuário
no Mixamo. Socos, defesa, reação e marcha foram produzidos sobre essa guarda,
sem exigir novos downloads.

## Artefatos atuais

- `pipoca-boxing-guarda-v4.blend`: guarda em ciclo, ação `pipoca_guarda_mixamo_v4`,
  quadros 1–105 a 60 fps; orelhas e cauda com oscilação visual discreta.
- `pipoca-jab-v5.blend`: jab `p1`, quadros 0–12, contato nos quadros 3–5.
- `pipoca-soco-forte-v6.blend`: soco `p2` com o braço oposto e giro do peito,
  quadros 0–18, contato nos quadros 5–7; retorno completo à guarda no quadro 15.
- `pipoca-defesa-v7.blend`: defesa alta em ciclo de 60 quadros, protegida desde
  o início, com respiração e orelhas discretas.
- `pipoca-reacao-v8.blend`: impacto imediato, pico no quadro 1 e retorno
  completo à guarda no quadro 7, antes do hitstun mínimo de 8.
- `pipoca-marcha-v9.blend`: passada por IK, ciclo de 12 quadros, chaves a cada
  meio quadro, apoio alternado de 6 quadros e balanço de até 8 cm.
- `pipoca-chute-v11.blend`: chutes médios `k1`, 24 quadros, golpe de perna E
  nos quadros 6–8 e de perna D nos quadros 12–14; caixa de alcance
  `[4,-30,30,12]` (frente 1,2167–1,5167, altura 0,75–1,25).
- `pipoca-chute-forte-v12.blend`: chute alto `k2`, 28 quadros, golpe na perna E
  nos quadros 7–10; caixa de alcance `[2,-46,32,18]`
  (altura 1,1667–1,9167).
- `pipoca-guarda-v4.gif`: prévia da guarda; `pipoca-jab-v5-lento.gif`: jab a um
  terço da velocidade, com pausa de leitura; `pipoca-soco-forte-v6-lento.gif`
  mostra o soco forte isolado à mesma velocidade. As prévias lentas não mudam o jogo.
- `pipoca-defesa-v7.gif`, `pipoca-reacao-v8-lento.gif` e
  `pipoca-marcha-v9-lento.gif`: novas prévias; `pipoca-movimentos-v9.gif` reúne
  guarda, socos, defesa, reação e duas voltas da passada. A saída da defesa e
  os gestos rápidos estão ampliados no tempo para leitura; a marcha é mostrada
  no lugar. A montagem não representa um combo completo no jogo.
- `pipoca-chutes-v11-lento.gif` (k1, 25 quadros) e
  `pipoca-chute-forte-v12-lento.gif` (k2, 29 quadros): prévias lentas
  dos dois chutes isolados.
- `public/modelos/estudos/pipoca-marcha-v9.glb`: etapa anterior com 31 clips,
  20 ossos e 6 materiais; revisa `parado`, `p1`, `p2`, `defesa`, `dano` e
  `andando`. Os outros 25 clips conservam os dados anteriores.
- `public/modelos/estudos/pipoca-corpo-v10.glb`: conserva os 31 clips, os 20
  ossos e as matrizes de repouso de v9; substitui a superfície do tronco,
  braços e pernas por anéis conectados com pesos graduais entre ossos.
  Cabeça, orelhas, luvas, pés e cauda mantêm os triângulos anteriores.
  `integracao-v10.json` registra tamanho, geometria, pesos mistos e hashes.
- `public/modelos/estudos/pipoca-chutes-v12.glb`: mantém os 31 clips, os 20
  ossos, a roupa e o corpo de v10 (mesmo tamanho de 1.535.468 bytes, hash
  `5196333a…`); substitui os canais de `k1` e `k2`. Revisa os dois chutes como
  entrada e saída em todas as variações de estado e lado. O apoio da perna
  oposta ficou em 4,6e-7 m (k1) e 2,6e-7 m (k2), bem abaixo da tolerância de
  1 mm. `integracao-v12.json` e `importacao-v12.json` registram a integração.
- `pipoca-corpo-v10-movimentos.gif`: 102 capturas do GLB v10 pelo importador
  real do laboratório em navegador oculto. Inclui guarda, socos, defesa,
  reação e deslocamento. Gestos rápidos são ampliados no tempo para leitura;
  a câmera acompanha a raiz na passada. É uma montagem de estudos.

O laboratório autenticado `/laboratorio/3d` oferece **Ver movimentos da
Pipoca**, carregando o corpo v10. Use Soco em sequência para emendar `p1` em `p2` após encostar no
adversário; segure Defesa para proteger; avance/recue com os controles.
O download acontece somente ao clicar; a troca afeta apenas Pipoca.
Falha, cancelamento e timeout conservam os modelos anteriores. Partidas,
ranking e renderizador principal não foram migrados. Versões v1–v3 permanecem
para comparação; abrir Blender é opcional para a revisão do usuário.

## Reproduzir

Na raiz, com apenas um processo Blender de cada vez:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/refinar-guarda-pipoca.py
node scripts/producao-3d/gerar-estudo-mixamo.mjs
php scripts/producao-3d/gerar-previa-gif.php
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/produzir-jab-pipoca.py
node scripts/producao-3d/gerar-estudo-jab.mjs
php scripts/producao-3d/gerar-previa-gif.php jab
node scripts/producao-3d/verificar-estudo-mixamo.mjs --jab
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/produzir-jab-pipoca.py -- --forte
node scripts/producao-3d/gerar-estudo-socos.mjs
php scripts/producao-3d/gerar-previa-gif.php forte
node scripts/producao-3d/verificar-estudo-mixamo.mjs --socos
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/produzir-defesa-pipoca.py
node scripts/producao-3d/gerar-estudo-defesa.mjs
php scripts/producao-3d/gerar-previa-gif.php defesa
node scripts/producao-3d/verificar-defesa-pipoca.mjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/produzir-reacao-pipoca.py
node scripts/producao-3d/gerar-estudo-reacao.mjs
php scripts/producao-3d/gerar-previa-gif.php reacao
node scripts/producao-3d/verificar-reacao-pipoca.mjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/produzir-marcha-pipoca.py
node scripts/producao-3d/gerar-estudo-marcha.mjs
php scripts/producao-3d/gerar-previa-gif.php marcha
php scripts/producao-3d/gerar-previa-gif.php vida
node scripts/producao-3d/gerar-estudo-corpo.mjs
node scripts/producao-3d/renderizar-corpo-pipoca.cjs
php scripts/producao-3d/gerar-previa-gif.php corpo
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/produzir-chute-pipoca.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python scripts/producao-3d/produzir-chute-pipoca.py -- --forte
node scripts/producao-3d/gerar-estudo-chutes.mjs
php scripts/producao-3d/gerar-previa-gif.php chutes
php scripts/producao-3d/gerar-previa-gif.php chute-forte
node scripts/producao-3d/verificar-chutes-pipoca.mjs
npm run build:3d
npm run verificar:build-3d
```

`-- --sem-render` nos scripts Blender evita renderizar imagens ao repetir apenas
extração/validação. A base v3 é preparada por `aplicar-boxe-pipoca.py`, que mantém
o rig e o modelo originais preservados. Blender→GLB usa matrizes de deformação,
hierarquia original e conversão Z-up→Y-up, não cópia direta dos quaternions de
pose do Blender. Na cena Babylon de mão esquerda, uma raiz visual fixa compensa
a conversão AUTO do GLB para manter a frente +X do projeto nos dois lados.

## Evidência e limites

`boxe-v4.json` mede as duas solas e âncoras após IK e animação secundária,
em 209 instantes por pé, incluindo meios quadros. Erros máximos de aproximadamente
0,35 mm na altura da sola e 0,38 mm na âncora; tolerância 1 mm. Extremidades do
ciclo têm poses coincidentes. Diferença de velocidade angular escalar na emenda
é registrada, não aprovada como continuidade perfeita de movimento.

`importacao-v6.json` verifica o importador real, 416 poses da guarda, frente +X
nos dois lados, matrizes finitas, liberação de recursos e estado da simulação
preservado. A verificação usa NullEngine, sem GPU. Os dois socos são amostrados
a cada meio quadro, nas duas orientações, com pés estáveis abaixo de 1 mm.
A luva do jab alcança aproximadamente
1,173 unidades, contra limite frontal de 1,25 da caixa do motor (diferença de
aproximadamente 1,86 pixel), e sobrepõe a altura da caixa durante o contato.
A luva do soco forte alcança 1,297 unidades, contra 1,417 da caixa (diferença
de 2,88 pixels); também sobrepõe a altura de 1,5–2,0 durante os quadros 5–7.

O motor pode cancelar `p1` ainda estendido e iniciar `p2` no quadro 1. O
importador suaviza especificamente essa troca para Pipoca: conserva a pose
local exibida e interpola até o quadro 4, pelo relógio da simulação. O contato
do quadro 5 já usa exatamente o clip do soco forte. Hitstop congela o movimento;
raiz, posição e lado continuam diretamente comandados pela simulação.
`transicao-socos.test.js` cobre o cancelamento real, repetição de quadros sem
acúmulo, chegada tardia e igualdade dos vértices da luva no contato. As poses
completas de início/fim dos dois clips também são comparadas com a guarda.

`importacao-v7.json` verifica cobertura das luvas, pés e sola em 242 poses da
defesa, nos dois lados e incluindo meios quadros. O motor reinicia `p.t` ao
segurar Defesa; o renderizador usa `estado.fT`, que avança e congela em hitstop.
Entrar em defesa aplica proteção inteira imediatamente; sair para parado
suaviza a pose até o quadro 4. O teste usa bloqueio real no primeiro passo.

`importacao-v8.json` confere 50 poses da reação nas duas orientações:
recuo da cabeça de 11,4 cm no início e 15,8 cm no pico; guarda completa no
quadro 7. Inclui hitstop real, repetição de renderizações, pés/solas e
preservação do estado. A reação ainda é genérica quanto a direção e intensidade.

A marcha publica `extras.marcha.distanciaCiclo = 1.3125`. O importador avança
sua fase pela distância horizontal real da raiz, assinada por `face`, em vez
de um relógio de render. Recuar inverte a passada de forma contínua; posição
imóvel em parede ou hitstop congela a fase. Trocar de estado, orientação ou
teleportar reinicia a referência. GLBs anteriores, sem esse metadado, mantêm
o comportamento existente. A trajetória é centrada em cada quadril para
respeitar o alcance das pernas. `marcha-relatorio-v9.json` registra apoio,
solas e interpolação entre chaves; o balanço aceita até 5 mm de diferença da
curva ideal, mantendo apoio e penetração abaixo de 1 mm.

`importacao-v12.json` verifica os chutes pelo importador real do laboratório:
apoio do k1 mede 4,6e-7 m e do k2 2,6e-7 m (tolerância 1 mm); alcance do k1 é
de 1,339 u no primeiro golpe e 1,271 u no segundo (caixa de frente
1,2167–1,5167), alternando E→D; o k2 alcança 1,250 u dentro da altura
1,1667–1,9167. A guarda retorna nas pontas de cada chute e o estado da
simulação é preservado após carregar o modelo. Os chutes são produzidos por
IK sobre a guarda Mixamo v4, com a perna de apoio ancorada e a orientação
mundial do pé guiada por `orientar()`, chaves a cada meio quadro.

Testes direcionados de exportação, relógios, defesa, reação e transições;
`blockouts-3d.cjs` cobre troca optativa, falhas, cancelamento, timeout e
preservação do Uivo. `modelos-blockout.cjs` conferiu os dois GLBs anteriores,
31 clips e direção de frente, após a correção do importador.
`laboratorio-3d.cjs` validou controles, importação, perda/restauro WebGL,
bfcache e descarte após as alterações.

`corpo-pipoca.test.js` confere a superfície fechada de um loft, orientação dos
triângulos, normais e pesos normalizados; compara todos os triângulos das
partes preservadas e os dados binários das 31 animações e matrizes inverse
bind com v9. A roupa tem duas superfícies conectadas: top e short; o short
une cintura, entreperna e pernas, com aberturas apenas na cintura e barras.
O volume de pele escondido no quadril foi recolhido após detectar penetração
na frente do tecido nas capturas. Isso verifica integridade técnica, sem aprovar o acabamento
artístico. `previa-corpo-v10/quadros.json` identifica por SHA-256 o GLB usado
nas capturas; o empacotador recusa imagens desatualizadas após alterar o modelo.

Nas renderizações v4 e v9, o driver Intel `ig11icd64.dll` falhou ao encerrar
o processo após salvar todos os artefatos. A extração/validação sem render
terminou com saída 0; outras renderizações também terminaram com saída 0.
As capturas v10 usam o navegador, sem abrir Blender. Isso não demonstra
estabilidade em aparelhos físicos.

O corpo v10 tem pesos graduais em cintura, cotovelos e joelhos; rosto, luvas,
pés, orelhas e cauda ainda usam os volumes anteriores. Ombros e quadril
permanecem unidos por sobreposição; pele linear pode achatar dobras fechadas.
Junções, roupa, pelagem, rosto e deformações precisam de produção artística. A passada tem
apoio alternado próprio; corrida permanece com o estudo anterior. Entrada e
saída da marcha ainda exigem revisão visual. Os demais 25 clips
e suas transições ainda exigem revisão; não estão todos aprovados por terem
nomes e durações válidos. Não houve publicação ou teste em celular físico.
