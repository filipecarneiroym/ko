# Proposta do protótipo 3D

## Escolha aprovada

Babylon.js autorizado pelo usuário em 11/10/2026. Instalados `@babylonjs/core` e `@babylonjs/loaders` 9.30.0, com lockfile. esbuild também autorizado, somente para preparação local: `npm ci` e `npm run build:3d`. O arquivo produzido em `public/js/ko-laboratorio-3d.js` acompanha o deploy; o servidor não executa npm.

Laboratório autenticado em `/laboratorio/3d`, separado das partidas. A geometria é provisória e identificada na tela; os modelos GLB finais e suas animações ainda não existem. Não considerar este laboratório uma entrega visual dos personagens.

Babylon.js, com `@babylonjs/core` e `@babylonjs/loaders`, em um protótipo separado. A autorização exigida por `SPEC.md` foi recebida antes da instalação.

O projeto oferece renderização WebGL/WebGPU, recursos de animação e carregamento de modelos. Avaliar o protótipo primeiro com WebGL; não tornar WebGPU um requisito para jogar. Three.js também oferece renderização WebGL e carregamento glTF, mas a proposta prioriza uma engine com recursos de jogo integrados. Esta é uma escolha de implementação, não uma conclusão de desempenho no iPhone.

Fontes oficiais consultadas:
- https://www.babylonjs.com/specifications/
- https://threejs.org/docs/pages/WebGLRenderer.html
- https://threejs.org/docs/pages/GLTFLoader.html

## Escopo revisável

1. Selecionar e fixar versões compatíveis dos dois pacotes; gerar os arquivos localmente e servir pelo próprio projeto.
2. Criar uma página de laboratório autenticada, independente da página atual de partidas.
3. Inicializar câmera lateral, piso, iluminação e indicadores de desempenho.
4. Usar geometria provisória somente para validar escala, câmera e iluminação. Identificar explicitamente a arte provisória.
5. Carregar personagens GLB quando existirem, com estados de animação guiados pelo estado da simulação.
6. Tratar falha de carregamento, perda do contexto gráfico, saída da página e liberação dos recursos.
7. Medir em iPhones físicos antes de trocar o renderizador do jogo principal.

## Limites

Não instalar engine de física, não mudar as regras de colisão, não alterar o banco nem a rede nesta etapa. O protótipo não será publicado automaticamente. A engine não produz os modelos, animações ou vozes gravadas que ainda precisam ser criados.
