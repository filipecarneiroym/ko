# Controles e TV

Implementado localmente em 10/10/2026, ainda não publicado.

- `2 jogadores / TV`: dois controles ligados ao mesmo aparelho; esse aparelho executa o navegador e envia a imagem à TV. A TV não executa necessariamente o jogo.
- Cada jogador em seu celular: a sala online aceita toque ou o primeiro controle ativado nesse navegador.
- Pressione um botão em cada controle para associar jogador 1 e jogador 2. Dois dispositivos com o mesmo nome continuam independentes pelo índice do navegador.
- Controles com mapeamento padrão usam direcional/analógico, botão esquerdo para soco, inferior para chute/confirmar, superior para defesa, direito para especial e Start para menu.
- Controles sem mapeamento padrão podem ser configurados na seleção. A configuração é guardada neste navegador, quando o armazenamento está disponível.
- A seleção local confirma primeiro o lutador do jogador 1, depois o do jogador 2. Para começar, ambos os controles precisam estar conectados e mapeados.
- Desconectar um controle pausa a partida local. Reconectar não retoma automaticamente: confirme Voltar para a luta.
- As partidas locais não enviam resultados ao ranking.

## Evidência

Verificação adicional: navegação espacial na grade, menu de pausa operado por ambos os controles, navegação no painel de configuração e três dedos simultâneos no touchscreen (direção + soco + chute). A Gamepad API também está disponível nos menus fora da arena; digitar apelido, PIN e código ainda usa o teclado do aparelho.

34 testes JavaScript e 31 testes PHP (136 verificações) passaram. O teste de navegador confirmou login, sala online, golpe por toque, áudio, reconexão, ranking, revanche, dois controles simulados movendo lutadores diferentes e pausa/retomada na desconexão.

Os controles desse teste são simulados pela Gamepad API. Ainda é necessário validar iPhone físico, modelos dos controles, conexão com a TV e atraso de imagem. Não há garantia universal para controles genéricos nem para navegadores instalados diretamente na TV. A arte em `conceitos/` é referência visual; ainda não é um modelo 3D jogável.
