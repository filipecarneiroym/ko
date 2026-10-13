# Pipoca: produção 3D e movimentos

Estado em 13/10/2026: personagem em refinamento, sem aprovação artística final.
A referência principal é [Pipoca no elenco](../../elenco/pipoca-v1.png), com
[frente, perfil e costas](../referencias/pipoca-referencia-v1.png) como apoio.
A prioridade é concluir Pipoca antes de iniciar o acabamento dos demais.

O estudo Meshy v5 está em `meshy-pipoca-v2/identidade-v5/`. A pintura das
orelhas segue a [demarcação original](../referencias/marcacao-orelhas-pipoca.png),
com preenchimento contínuo e borda suavizada dentro do traço. O pipeline
salva o `.blend` com câmera frontal e gera sete vistas, incluindo o
[close final das orelhas](meshy-pipoca-v2/identidade-v5/orelhas-final.png).
`orelhas.png` preserva o render anterior usado para calibrar a demarcação.
O verificador independente lê o material visível do arquivo salvo e grava
`verificacao-orelhas.json`, com hashes e contagens de falhas, vazamentos,
pintura no verso e arestas abertas. Execute da raiz:
`blender -b --python-exit-code 1 --python scripts/producao-3d/verificar-orelhas-pipoca-v5.py`.

## Versão em revisão

`public/modelos/estudos/pipoca-direcao-visual-v13.glb` reúne corpo articulado,
rosto e orelhas próprios, top com alças, short com listras brancas em textura
incorporada, 20 ossos e 31 clips. O número de clips é exigência de integração;
a cobertura de produção e a aprovação visual são registradas separadamente.

| Conjunto | Fontes e revisão |
| --- | --- |
| Guarda, socos, defesa, dano e marcha | `guarda-v4.json`, `jab-v5.json`, `soco-forte-v6.json`, `defesa-v7.json`, `reacao-v8.json`, `andando-v9.json` |
| Chutes médios e alto | `chute-v11.json`, `chute-forte-v12.json`; verificação a cada ¼ de quadro nas duas orientações |
| Agachamento, defesa baixa, salto e pouso | `posturas-v14.json`; apoio no chão e salto sem duplicar a trajetória do motor |
| Soco baixo, rasteira, ataques aéreos, cenoura e Super | `tecnicas-v15.json`; contato nas janelas do motor e lançamento no quadro 10 |
| Corrida, recuo, quebra-combo, queda e levantamento | `estados-v16.json`; passada por distância e envelope do corpo acima do piso |
| Rolamento, agarrão, tontura, vitória, derrota e Final | `atuacao-v17.json`; clips integrados ao GLB e verificados em ambos os lados; ajuste do agarrão à distância real do oponente e transições contextuais ainda pendentes |

A guarda vem do arquivo Mixamo `art/premium/movimentos/Boxing.fbx`, baixado
pelo usuário. Os movimentos posteriores usam essa guarda e IK própria;
não precisam de outro download ou de Blender aberto para jogar.

O laboratório autenticado `/laboratorio/3d` oferece **Ver movimentos da Pipoca**.
O download é iniciado pelo botão e substitui apenas Pipoca. Falha, cancelamento
e timeout conservam os modelos anteriores. O jogo principal ainda usa seu
renderizador existente. Uivo conserva o blockout anterior.

## Movimento e efeitos

Os golpes seguem o relógio da simulação, inclusive pausa por impacto. O soco
forte recebe a transição do primeiro soco; a passagem para o chute alto suaviza
somente o tronco para preservar o pé de apoio. Entrar em defesa protege desde
o primeiro quadro. Andar usa deslocamento real para dirigir a passada;
parede e pausa por impacto congelam o ciclo.

`k1` dura 24 quadros e alterna pernas E/D nas janelas 6–8 e 12–14. Sua caixa
`[4,-30,30,12]` cobre frente de 4/24 a 34/24 e altura de 18/24 a 30/24 metros.
`k2` dura 28 quadros, usa a perna E na janela 7–10 e caixa `[2,-46,32,18]`.
Apoio e contato têm verificações próprias; isso não aprova a dobra da roupa.

A cenoura acompanha `s.proj`, inclusive após o clip de lançamento, retorno e
remoção. Impactos, bloqueios, poeira, entrada na toca e Chuva de Cenouras
usam geometria reutilizada e relógio da simulação. O Final só aparece na fase
real `final` com Pipoca vencedora. A preferência por movimento reduzido retira
expansão, giro e queda decorativos. Efeitos não criam dano ou colisões.

## Reprodução local

Executar da raiz do projeto:

```powershell
node scripts/producao-3d/produzir-tecnicas-pipoca.mjs
node scripts/producao-3d/produzir-estados-pipoca.mjs
node scripts/producao-3d/produzir-atuacao-pipoca.mjs
node scripts/producao-3d/gerar-estudo-visual.mjs
node scripts/producao-3d/verificar-pipoca.mjs
npm run build:3d
npm run verificar:build-3d
```

As fontes Blender anteriores permanecem editáveis. Para regenerar uma fonte,
usar o script `produzir-*-pipoca.py` correspondente com Blender em segundo
plano, `--threads 2` e apenas um processo de cada vez. `-- --sem-render` evita
renderização quando só a extração é necessária. O script
`produzir-posturas-pipoca.py` produz as quatro posturas v14. A conversão para
GLB respeita a hierarquia original e as matrizes de deformação; copiar apenas
quaternions de pose do Blender não reproduz essa transformação.

Capturas pelo importador e renderizador reais, sem abrir Blender:

```powershell
node scripts/producao-3d/renderizar-corpo-pipoca.cjs --visual --retrato
node scripts/producao-3d/renderizar-corpo-pipoca.cjs --visual --revisao
node scripts/producao-3d/renderizar-corpo-pipoca.cjs --visual
node scripts/producao-3d/renderizar-combate-pipoca.cjs
node scripts/producao-3d/gerar-revisao-pipoca.mjs
php scripts/producao-3d/gerar-previa-gif.php visual
```

Cada pasta de captura contém `quadros.json` com o SHA do GLB utilizado. Uma
captura só avalia o asset com esse SHA. O empacotador de GIF recusa capturas
desatualizadas. As montagens de movimentos ampliam gestos rápidos no tempo;
não representam um combo completo nem alteram a velocidade do jogo.

`revisao-pipoca.html` reúne as referências e capturas em uma galeria local,
abrindo no navegador sem Blender. O gerador recusa imagens de GLBs diferentes.
`verificar-pipoca.mjs` só grava a rodada conjunta se o GLB e suas fontes não
mudaram durante a execução; `verificacao-pipoca-v13.json` identifica seu escopo.

## Evidência e pendências

`integracao-v13.json` registra fontes, SHA da simulação, geometria, texturas
e orçamento do GLB. `importacao-chutes-v13.json`,
`importacao-posturas-v14.json` e `importacao-tecnicas-v15.json` medem apoio,
solas, contato e preservação do estado no importador; `importacao-atuacao-v17.json`
verifica também as atuações de rolamento, agarrão e encerramento. O mapa procedural
de pelagem acrescenta microrelevo ao material, mas não substitui fios/clumps
modelados nem equivale ao acabamento da ilustração. A auditoria geral registra
separadamente integração técnica e aprovação artística.

Os testes de figurino verificam alças, UV e fivela; os de corpo verificam
normais, pesos, conectividade e deformação somente nos movimentos indicados
pelo relatório. A ausência de erro de apoio não comprova ausência de
interseção na coxa ou no short. Esses volumes continuam em revisão nos chutes.

Rosto, pelagem, anatomia, tecido, expressões e transições ainda precisam de
acabamento e comparação visual com o banner. A versão atual não equivale ao
acabamento da ilustração nem ao de Street Fighter IV. A iluminação do
laboratório serve para essa revisão; ela não substitui a produção artística.
Os seis materiais atuais também excedem a meta inicial de quatro.

A validação em Edge no computador não mede desempenho em celulares físicos.
A troca do renderizador principal depende de revisão visual, movimentos,
carregamento, controles e desempenho. `modeloFinal` continua `null` no contrato.
