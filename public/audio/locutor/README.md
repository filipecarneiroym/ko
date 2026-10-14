# Locutor do K.O

Chamadas produzidas para este projeto no estilo anunciador de arena (como no
Street Fighter IV): Round um, dois, três e final, Lutem, K.O., Perfeito, Tempo,
Empate e "<Lutador> venceu!" (vitoria-<id>.mp3, baixado só no fim da luta).
Voz masculina `pt-BR-AntonioNeural`, mais grave (-34 Hz) e lenta, com graves
realçados, compressão e eco de estádio. Nenhuma gravação de jogo
comercial foi extraída; os impactos são sintetizados em `ko-audio.js`.

O navegador reproduz MP3s locais. Não usa `speechSynthesis` nem depende das
vozes instaladas no iPhone. As nove chamadas fixas somam cerca de 160 KB; cada anúncio de vencedor, ~32 KB.
O módulo prepara os buffers uma vez; golpes não fazem requisições de rede.
As chamadas de Round terminam antes de 0,9 segundo para caber no intervalo
de um segundo que o motor já usa antes de anunciar Lutem.

Para gerar novamente (Python 3.12 gerenciado pelo uv):
`uv run --managed-python --python 3.12 --no-project --with edge-tts==7.3.1 --with imageio-ffmpeg==0.6.0 python scripts/audio/gerar-locutor.py --refazer`. Sem `--refazer`, reaproveita
as fontes temporárias já geradas. A geração exige internet; a reprodução no
jogo usa apenas os arquivos publicados. `producao.json` registra parâmetros,
SHA-256, duração e pico dos MP3s decodificados.

Fontes da ferramenta e da voz:

- [edge-tts, projeto original](https://github.com/rany2/edge-tts)
- [Microsoft: pt-BR-AntonioNeural, voz masculina](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)

Integração: `KOSom.criar(audioContext)` retorna `preparar()`, `evento(e)`,
`locutor(e)` e `pararVoz()`. `evento` cuida apenas de `acerto`/`defendeu`;
`locutor` aceita `round`, `lutem`, `ko`, `perfeito`, `tempo` e `vitoria` (com `lutador`: id de quem venceu; `vencedor < 0` = empate). A fala anterior esmaece em 80 ms. Chame `preparar()`
na entrada da seleção; mantenha o controle de som e o desbloqueio do contexto
no gesto do jogador. A pausa deve chamar `pararVoz()`.
