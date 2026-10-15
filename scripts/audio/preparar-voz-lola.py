"""Prepara gritos humanos femininos CC0 para a Lola (FFmpeg no PATH).

Fonte: Female RPG Voice Starter Pack, Cici Fyre / cicifyre, Type 2.
Uso: python scripts/audio/preparar-voz-lola.py --fontes <pasta Type 2>
"""
import argparse
import array
import hashlib
import json
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--fontes', type=Path, required=True)
args = parser.parse_args()
destino = RAIZ / 'public/audio/lola'
destino.mkdir(parents=True, exist_ok=True)
registros = {}
for grupo, origem in [('ataque', 'attack'), ('dano', 'damaged'), ('salto', 'jump')]:
    for i in range(1, 4):
        nome = f'{grupo}-{i}'
        saida = destino / f'{nome}.mp3'
        filtros = ','.join([
            'silenceremove=start_periods=1:start_duration=0.005:start_threshold=-46dB',
            'areverse', 'silenceremove=start_periods=1:start_duration=0.01:start_threshold=-46dB', 'areverse',
            'highpass=f=100', 'lowpass=f=11000',
            'equalizer=f=2600:t=q:w=1:g=2',
            'acompressor=threshold=0.16:ratio=2.5:attack=3:release=45:makeup=1.15',
            'loudnorm=I=-18:TP=-3:LRA=7', 'alimiter=limit=0.7:level=false',
            'afade=t=in:d=0.004',
        ])
        subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
            '-i', str(args.fontes / f'{origem}{i}.wav'), '-af', filtros,
            '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', str(saida)], check=True)
        pcm = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
            '-i', str(saida), '-ar', '48000', '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        valores = array.array('f', pcm)
        pico = max(map(abs, valores))
        assert .01 < pico < .9, (nome, pico)
        registros[nome] = {'arquivo': saida.name, 'fonte': f'Type 2/{origem}{i}.wav',
            'duracao': round(len(valores) / 48000, 4), 'pico': round(pico, 5),
            'bytes': saida.stat().st_size, 'sha256': hashlib.sha256(saida.read_bytes()).hexdigest()}
(destino / 'producao.json').write_text(json.dumps({'autora': 'Cici Fyre (cicifyre)', 'licenca': 'CC0-1.0',
    'origem': 'https://opengameart.org/content/female-rpg-voice-starter-pack',
    'observacao': 'Gravações humanas licenciadas; não são áudios extraídos do SF4.',
    'gritos': registros}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps(registros, ensure_ascii=False))
