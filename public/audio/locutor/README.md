# Locutor do K.O

Seis chamadas produzidas para este projeto: Round um, dois, três e final,
Lutem e K.O. Voz masculina `pt-BR-AntonioNeural`, com altura reduzida em
22 Hz, equalização, compressão e reflexões curtas. Nenhuma gravação de jogo
comercial foi extraída; os impactos são sintetizados em `ko-audio.js`.

O navegador reproduz MP3s locais. Não usa `speechSynthesis` nem depende das
vozes instaladas no iPhone. Os seis arquivos somam aproximadamente 92 KB.
O módulo prepara os buffers uma vez; golpes não fazem requisições de rede.
As chamadas de Round terminam antes de 0,9 segundo para caber no intervalo
de um segundo que o motor já usa antes de anunciar Lutem.

Para gerar novamente, instale `edge-tts==7.3.1` e `imageio-ffmpeg==0.6.0`
em `.browser-check/audio-tools` e execute
`python scripts/audio/gerar-locutor.py --refazer`. Sem `--refazer`, reaproveita
as fontes temporárias já geradas. A geração exige internet; a reprodução no
jogo usa apenas os arquivos publicados. `producao.json` registra parâmetros,
SHA-256, duração e pico dos MP3s decodificados.

Fontes da ferramenta e da voz:

- [edge-tts, projeto original](https://github.com/rany2/edge-tts)
- [Microsoft: pt-BR-AntonioNeural, voz masculina](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)

Integração: `KOSom.criar(audioContext)` retorna `preparar()`, `evento(e)`,
`locutor(e)` e `pararVoz()`. `evento` cuida apenas de `acerto`/`defendeu`;
`locutor` aceita somente eventos `round`, `lutem` e `ko`. Chame `preparar()`
na entrada da seleção; mantenha o controle de som e o desbloqueio do contexto
no gesto do jogador. A pausa deve chamar `pararVoz()`.
