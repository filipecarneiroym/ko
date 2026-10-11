"""Reação v8: impacto imediato, pés fixos e guarda recuperada antes de 8 quadros."""
from pathlib import Path
from math import pi
import hashlib
import json
import re
import sys
import bpy
from mathutils import Matrix, Quaternion, Vector

raiz = Path(__file__).resolve().parents[2]
saida = raiz/'art/premium/modelos-3d/estudos-mixamo'
fonte_motor = (raiz/'public/js/ko-sim.js').read_bytes()
limite = re.search(r'v\.stun\s*=\s*Math\.max\((\d+),\s*golpe\.hs', fonte_motor.decode('utf-8'))
if not limite or int(limite.group(1)) != 8:
    raise RuntimeError('Revise a recuperação visual: o limite de hitstun do motor mudou.')
duracao = 12
recuperacao = 7
bpy.ops.wm.open_mainfile(filepath=str(saida/'pipoca-boxing-guarda-v4.blend'))
cena = bpy.context.scene
rig = bpy.data.objects['lutador']
rig.data.pose_position = 'POSE'
cena.frame_set(1)
base = {b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in rig.pose.bones}
rest = {b.name:b.bone.matrix_local.to_quaternion() for b in rig.pose.bones}
ordem = ['quadril','tronco','peito','cabeca','mandibula','orelha_E','orelha_D',
         'braco_E','antebraco_E','mao_E','coxa_E','canela_E','pe_E',
         'braco_D','antebraco_D','mao_D','coxa_D','canela_D','pe_D','cauda']
bpy.context.view_layer.update()
ancoras = {lado:rig.pose.bones[f'pe_{lado}'].head.copy() for lado in ['E','D']}
cabeca_inicial = rig.pose.bones['cabeca'].head.copy()
peito_inicial = rig.pose.bones['peito'].head.copy()

def aplicar_base():
    for nome,(rot,pos) in base.items():
        osso = rig.pose.bones[nome]
        osso.rotation_quaternion = rot.copy()
        osso.location = pos.copy()
    bpy.context.view_layer.update()

def orientar(nome,desejada):
    osso = rig.pose.bones[nome]
    osso.rotation_quaternion = rest[nome].inverted() @ rest[osso.parent.name] @ osso.parent.matrix.to_quaternion().inverted() @ desejada
    bpy.context.view_layer.update()

def suave(t):
    t = max(0,min(1,t))
    return t*t*(3-2*t)

def impacto(q):
    # O golpe já foi confirmado quando o estado dano começa: não antecipar o impacto.
    return .72+.28*suave(q) if q <= 1 else 1-suave((q-1)/(recuperacao-1))

def atraso_orelhas(q):
    return .4+.6*suave(q/2) if q <= 2 else 1-suave((q-2)/(recuperacao-2))

acao = bpy.data.actions.new('pipoca_reacao_estudo_v8')
acao.use_fake_user = True
rig.animation_data.action = acao
medidas = []
for q in range(duracao+1):
    cena.frame_set(q)
    aplicar_base()
    e = impacto(q)
    if e > 0:
        # A simulação desloca a personagem; a malha apenas absorve o golpe sobre os pés.
        for nome,angulo in [('tronco',-.19),('peito',-.055),('cabeca',-.12)]:
            orientar(nome,Quaternion((0,1,0),angulo*e) @ rig.pose.bones[nome].matrix.to_quaternion())
        orientar('peito',Quaternion((0,0,1),.045*e) @ rig.pose.bones['peito'].matrix.to_quaternion())
        for nome,angulo in [('orelha_E',-.16),('orelha_D',-.13)]:
            rig.pose.bones[nome].rotation_quaternion @= Quaternion(rest[nome].inverted() @ Vector((0,1,0)),angulo*atraso_orelhas(q))
        rig.pose.bones['cauda'].rotation_quaternion @= Quaternion(rest['cauda'].inverted() @ Vector((0,1,0)),.04*e)
    bpy.context.view_layer.update()
    medidas.append({'quadro':q,'impacto':e,'recuoCabeca':cabeca_inicial.x-rig.pose.bones['cabeca'].head.x,
                    'recuoPeito':peito_inicial.x-rig.pose.bones['peito'].head.x})
    for osso in rig.pose.bones:
        osso.keyframe_insert(data_path='rotation_quaternion',frame=q,group=osso.name)
        osso.keyframe_insert(data_path='location',frame=q,group=osso.name)
for camada in acao.layers:
    for faixa in camada.strips:
        for bolsa in faixa.channelbags:
            for curva in bolsa.fcurves:
                for chave in curva.keyframe_points:
                    chave.interpolation = 'LINEAR'

erro_ancora = 0
erro_recuperacao = 0
for meio in range(duracao*2+1):
    q = meio*.5
    cena.frame_set(int(q),subframe=q-int(q))
    for lado in ['E','D']:
        erro_ancora = max(erro_ancora,(rig.pose.bones[f'pe_{lado}'].head-ancoras[lado]).length)
    if q >= recuperacao:
        for nome,(rot,pos) in base.items():
            osso = rig.pose.bones[nome]
            erro_recuperacao = max(erro_recuperacao,(osso.location-pos).length,
                                  abs(1-abs(osso.rotation_quaternion.normalized().dot(rot.normalized()))))
if erro_ancora > .001:
    raise RuntimeError('Reação deslocou os pés.')
if erro_recuperacao > 1e-6:
    raise RuntimeError('A reação não recuperou a guarda completa antes do menor hitstun.')
if medidas[0]['recuoCabeca'] < .08 or max(m['recuoCabeca'] for m in medidas) < .12:
    raise RuntimeError('O impacto não recua a cabeça de modo legível.')

rotacoes = {n:[] for n in ordem}
posicoes = {n:[] for n in ordem}
c = Matrix.Rotation(-pi/2,4,'X')
for q in range(duracao+1):
    cena.frame_set(q)
    globais = {b.name:c @ b.matrix @ b.bone.matrix_local.inverted() @ Matrix.Translation(b.bone.head_local) @ c.inverted() for b in rig.pose.bones}
    for osso in rig.pose.bones:
        local = globais[osso.parent.name].inverted() @ globais[osso.name] if osso.parent else globais[osso.name]
        r = local.to_quaternion().normalized()
        anterior = rotacoes[osso.name][-4:]
        if anterior and sum(v*w for v,w in zip(anterior,[r.x,r.y,r.z,r.w])) < 0:
            r.negate()
        rotacoes[osso.name].extend([r.x,r.y,r.z,r.w])
        posicoes[osso.name].extend(local.to_translation())
canais = []
tempos = [q/60 for q in range(duracao+1)]
for i,nome in enumerate(ordem):
    canais.append({'osso':i,'tipo':'rotation','tempos':tempos,'valores':rotacoes[nome]})
    canais.append({'osso':i,'tipo':'translation','tempos':tempos,'valores':posicoes[nome]})
clip = {'nome':'dano','duracaoQuadros':duracao,'canais':canais}
(saida/'reacao-v8.json').write_text(json.dumps(clip,separators=(',',':')),encoding='utf-8')
relatorio = {'versao':8,'aprovadoFinal':False,'origem':'Reação autoral ao impacto baseada na guarda v4.',
    'sha256Simulacao':hashlib.sha256(fonte_motor).hexdigest(),'duracaoQuadros':duracao,
    'impactoDesdeInicio':True,'picoQuadro':1,'recuperacaoQuadro':recuperacao,'stunMinimoMotor':8,
    'erroMaximoAncora':erro_ancora,'erroRecuperacao':erro_recuperacao,'amostras':medidas,
    'limites':['Arte provisória com pesos rígidos.','Reação genérica a golpes; direção e intensidade não variam por acerto.','Quedas, defesa baixa e rosto continuam pendentes.']}
(saida/'reacao-relatorio-v8.json').write_text(json.dumps(relatorio,ensure_ascii=False,indent=2),encoding='utf-8')
cena.frame_start = 0
cena.frame_end = duracao
cena.render.fps = 60
cena.frame_set(0)
cena['etapa'] = 'Reação v8 com impacto imediato e recuperação no quadro 7; arte final pendente.'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(saida/'pipoca-reacao-v8.blend'),compress=True)
print('KO_REACAO_V8 '+json.dumps({'duracao':duracao,'recuperacao':recuperacao,'erroAncora':erro_ancora,
                                'recuoMaximoCabeca':max(m['recuoCabeca'] for m in medidas)}),flush=True)
if '--sem-render' not in sys.argv:
    cena.render.resolution_x = cena.render.resolution_y = 480
    cena.render.resolution_percentage = 100
    cena.eevee.taa_render_samples = 8
    pasta = saida/'previa-reacao-v8'
    pasta.mkdir(exist_ok=True)
    for q in range(duracao+1):
        cena.frame_set(q)
        cena.render.filepath = str(pasta/f'{q:03d}.png')
        bpy.ops.render.render(write_still=True)
