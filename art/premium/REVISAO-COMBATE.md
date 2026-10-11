# Revisão visual e sonora da luta

## Implementado nesta revisão

- Acertos com núcleo em estrela, anel e faíscas; defesa com anel azul distinto. Intensidade acompanha o evento do motor, sem aumentar dano.
- Efeitos com duração curta; camada de impactos limitada a 20, partículas a 256 por quadro (96 com movimento reduzido), anéis a 36. Esses limites não são uma medição de desempenho em aparelhos físicos.
- Preferência de movimento reduzido elimina tremor de câmera e clarão de tela. Clarão normal limitado a 22% de opacidade.
- Timbres sintetizados próprios para especiais e Super dos 16 lutadores. Gritos continuam em ko-voz.js. Fontes de áudio desconectadas ao terminar.
- Tela de vitória com arte atual, nome, placar, frase original e ações de revanche. Sem copiar logotipos, frases, vozes ou recursos de outra franquia.
- Academia com cenário ilustrado de tijolos e iluminação quente/fria. Carregado uma vez e desenhado em fundo pré-renderizado; academia em Canvas é usada enquanto a imagem carrega ou se falhar. Os outros cinco cenários continuam em Canvas.

## Poderes e equilíbrio

INVENTARIO-COMBATE.md registra vida, movimento, preparação e dano nominal diretamente do motor. Inclui agarrão especial de Kilo e efeitos temporários de Maromba. Efeitos de defesa não mudam imunidades ou hitboxes. O teto de poder é igual para todos; os kits têm características diferentes.

BALANCEAMENTO.md contém as 2160 partidas automatizadas, diferenças encontradas e limitações. Não declarar balanceamento encerrado: Volt e Vô Tião precisam de revisão prioritária; estratégias do bot influenciam muito Kilo, Maromba e Nix. Alterações futuras devem comparar as mesmas sementes e incluir adversários humanos.

Forja e Bórun permanecem conceitos, sem poder jogável ou sons de combate implementados. As artes de menu e vitória não substituem os modelos/animações jogáveis; o jogo continua usando personagens desenhados em Canvas.

## Conferência

Testes PHP: 38 testes, 182 verificações. Fluxo de navegador cobre dois jogadores, reconexão, resultado, revanche, PIN, multitoque, dois gamepads e CPU em três níveis. Teste de efeitos exercita rajada de eventos e confirma simulação intacta com e sem movimento reduzido. A matriz de cenários/vencedores gera screenshots em .browser-check para revisão; não equivale a testar 16 partidas humanas.

Pendências: desempenho e áudio em Safari/iPhone, Chrome/Android e TV real; revisão humana de balanceamento; produção de animações e cenários da etapa 3D.
