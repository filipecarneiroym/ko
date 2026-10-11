# Revisão do laboratório 3D — 11/10/2026

Babylon.js 9.30.0 e esbuild 0.28.2 instalados após autorização. Laboratório autenticado em `/laboratorio/3d`, com acesso privado também exigido. Bundle próprio, sem CDN e sem npm no servidor. Verificação por hash relaciona bundle minificado, fontes e dependências: `npm run verificar:build-3d`.

## Implementado e verificado

- Câmera lateral ortográfica ajustada ao tamanho da tela, piso e luz; manequins identificados como provisórios.
- Simulação existente a 60 quadros/s, com poses derivadas de `p.t`; encenações finais usam `s.fT`. A apresentação não calcula dano, colisões ou resultado.
- 21 estados visuais e dez golpes por personagem, com espera cíclica e ataque limitado ao último quadro. O hitstop mantém a pose; o relógio de renderização não avança o golpe.
- Importação local de GLB autocontido de até 24 MiB, com malha, esqueleto e clips nomeados. Rejeita recursos externos, extensões e clips de golpes curtos demais. Carregamento exclusivo, repetição de arquivo após erro e descarte do modelo anterior.
- Inicialização explícita de Bone corrige uma falha de ordem do bundle IIFE que ocorreu ao importar GLB com skin. O teste usa um GLB de diagnóstico com triângulo, osso e clips, não arte final.
- Texturas incorporadas decodificadas via blob. CSP permite `blob:` para imagens somente no laboratório; mantém scripts locais sem `unsafe-eval`.
- Comandos por teclado, botões nativos por Enter/Espaço, toque sustentado, multitoque e cancelamento. Direção, agachar, defesa, golpes e especial presentes. Dois controles com mapeamento padrão podem controlar os dois lados.
- Impactos de acerto/defesa em pool limitado a 12 elementos, respeitando movimento reduzido. Caixas do motor sobrepostas para revisão visual do alcance.
- Limpeza de entrada ao perder foco; pausa/retomada em eventos de bfcache; perda/restauro real de contexto WebGL; descarte e remoção de listeners ao sair definitivamente.
- Rolagem da página permite alcançar todos os controles no celular. Bundle, scripts e CSS usam versões na URL para atualizar o cache da PWA.

## Evidência local

`laravel/tests/browser/laboratorio-3d.cjs`: comandos, ausência de entradas presas, GLB inválido, troca de modelos animáveis, perda/restauro real de WebGL, eventos de bfcache e descarte. Eventos de bfcache são simulados no teste; não comprovam a política real de cache do Safari.

`laravel/tests/browser/laboratorio-http.cjs`: Laravel real, senha/PIN, CSP, shaders e GLB com PNG incorporado. Nenhuma violação de CSP, requisição HTTP de upload ou download durante importação. Prévia revisada em telas emuladas 844×390, 390×844 e 1920×1080, com canvas dentro da largura e rolagem vertical acessível.

`laravel/tests/js/visual-3d.test.js`: leitura sem alterar estado, pausa de impacto, taxa do clip, repetição, limite de ataque, relógio de final e contrato GLB. `npm run verificar:3d` confere artes, hashes, alturas e tempos dos 20 golpes; informa produção pendente quando `modeloFinal=null`.

## Ainda pendente

Resultado desta revisão: 40 testes PHP / 191 verificações, 41 testes JavaScript e os testes de navegador do laboratório e de salas passaram. A consulta às integrações disponíveis nesta sessão não encontrou um plugin específico de Blender, Meshy ou Tripo para executar a produção dos modelos. Isso não altera o estado de aceitação dos assets: modelos finais permanecem pendentes.

Os modelos 3D finais, rigs, texturas UV e animações autorais de Pipoca/Uivo não existem. Folhas de referência frontal/lateral/traseira estão em `modelos-3d/referencias/`; são apoio para modelagem. A prévia e o GLB de diagnóstico não representam a qualidade visual final solicitada.

Faltam produção e revisão dos modelos em movimento, animação dos projéteis/especiais/finais, arena final, áudio gravado e medição contínua em Android/iPhone/TV reais. Os aparelhos mínimos ainda precisam ser definidos pelo modelo e versão. Não houve publicação, validação de Docker nem substituição do renderizador de partidas. Não considerar equivalência a Street Fighter IV ou ausência de bugs demonstrada por estes testes.
