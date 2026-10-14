"""Gera as chamadas originais do locutor (estilo anunciador de arena, como no
Street Fighter IV: grave, lento e com eco de estádio), prontas para uso offline.

Dependências: edge-tts==7.3.1, imageio-ffmpeg==0.6.0.
Instalação isolada, na raiz:
  python -m pip install --target .browser-check/audio-tools edge-tts==7.3.1 imageio-ffmpeg==0.6.0
Execução: python scripts/audio/gerar-locutor.py
"""
import array
import asyncio
import hashlib
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / f'.browser-check/audio-tools-{sys.version_info.major}{sys.version_info.minor}'))
sys.path.insert(1, str(RAIZ / '.browser-check/audio-tools'))
import edge_tts
import imageio_ffmpeg

VOZ = 'pt-BR-AntonioNeural'
CHAMADAS = {
    'round-1': 'Round um!',
    'round-2': 'Round dois!',
    'round-3': 'Round três!',
    'round-final': 'Round final!',
    'lutem': 'Lutem!',
    'ko': 'Ká! Ô!',
    'perfeito': 'Perfeito!',
    'tempo': 'Tempo!',
    'empate': 'Empate!',
}
# Anúncio do vencedor pelo nome do lutador (arquivo vitoria-<id>.mp3).
LUTADORES = {
    'pipoca': 'Lola', 'uivo': 'Uivo', 'maromba': 'Maromba', 'ginga': 'Ginga',
    'vo-nena': 'Vó Nena', 'vo-tiao': 'Vô Tião', 'kira': 'Kira', 'toco': 'Toco',
    'nix': 'Nix', 'eco': 'Eco', 'volt': 'Volt', 'kilo': 'Kilo', 'brasa': 'Brasa',
    'mare': 'Maré', 'truque': 'Truque', 'fossil': 'Fóssil',
}
CHAMADAS.update({f'vitoria-{i}': f'{nome}... venceu!' for i, nome in LUTADORES.items()})
RATE, PITCH = '-6%', '-34Hz'
FILTROS = ','.join([
    'silenceremove=start_periods=1:start_duration=0.015:start_threshold=-42dB',
    'areverse',
    'silenceremove=start_periods=1:start_duration=0.015:start_threshold=-48dB',
    'areverse',
    'highpass=f=65', 'lowpass=f=10000',
    'equalizer=f=110:t=q:w=0.9:g=4.5',
    'equalizer=f=2400:t=q:w=1:g=2',
    'acompressor=threshold=0.18:ratio=3:attack=4:release=65:makeup=1.6',
    'apad=pad_dur=0.35', 'aecho=0.8:0.6:48|97|173:0.3|0.2|0.11',
    'loudnorm=I=-14:TP=-2:LRA=7',
    'alimiter=limit=0.84:level=false',
])


async def main():
    destino = RAIZ / 'public/audio/locutor'
    temporarios = RAIZ / '.browser-check/locutor-fontes'
    destino.mkdir(parents=True, exist_ok=True)
    temporarios.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    registros = {}
    for nome, texto in CHAMADAS.items():
        bruto = temporarios / f'{nome}.mp3'
        saida = destino / f'{nome}.mp3'
        if '--refazer' in sys.argv or not bruto.exists() or bruto.stat().st_size < 1000:
            gerador = edge_tts.Communicate(texto, VOZ, rate='+8%' if nome.startswith('round-') else RATE, pitch=PITCH, volume='+0%')
            await asyncio.wait_for(gerador.save(str(bruto)), timeout=90)
        # O motor anuncia Lutem um segundo após Round. A chamada inteira,
        # incluindo reverberação, termina antes disso sem alterar a simulação.
        # Rounds: eco curto e um pouco mais rápido (o motor diz Lutem 1 s depois).
        filtros = (FILTROS.replace('apad=pad_dur=0.35', 'apad=pad_dur=0.08').replace('48|97|173:0.3|0.2|0.11', '48|97:0.26|0.14') + ',atempo=1.22') if nome.startswith('round-') else FILTROS
        subprocess.run([ffmpeg, '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
                        '-i', str(bruto), '-af', filtros, '-ar', '48000', '-ac', '1',
                        '-codec:a', 'libmp3lame', '-b:a', '128k', str(saida)], check=True)
        pcm = subprocess.run([ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error',
                              '-i', str(saida), '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'],
                             check=True, capture_output=True).stdout
        amostras = array.array('f', pcm)
        pico = max(abs(v) for v in amostras)
        if pico >= .99:
            raise RuntimeError(f'{nome}: pico excessivo ({pico})')
        registros[nome] = {'texto': texto, 'arquivo': f'{nome}.mp3',
                           'tempo': 1.22 if nome.startswith('round-') else 1,
                           'duracao': round(len(amostras) / 48000, 3),
                           'pico': round(pico, 5), 'bytes': saida.stat().st_size,
                           'sha256': hashlib.sha256(saida.read_bytes()).hexdigest()}
        print(f'{nome}: {registros[nome]["duracao"]} s, {registros[nome]["bytes"]} bytes', flush=True)
    (destino / 'producao.json').write_text(json.dumps({
        'voz': VOZ, 'rate': RATE, 'pitch': PITCH, 'filtros_ffmpeg': FILTROS,
        'edge_tts': '7.3.1', 'imageio_ffmpeg': '0.6.0', 'chamadas': registros,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
