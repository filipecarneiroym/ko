"""Defesa alta v7: ciclo sempre protegido e prévia de saída para a guarda."""
from pathlib import Path
from math import pi, sin
import hashlib
import json
import sys
import bpy
from mathutils import Matrix, Quaternion, Vector

raiz = Path(__file__).resolve().parents[2]
saida = raiz/'art/premium/modelos-3d/estudos-mixamo'
bpy.ops.wm.open_mainfile(filepath=str(saida/'pipoca-boxing-guarda-v4.blend'))
cena = bpy.context.scene
rig = bpy.data.objects['lutador']
cena.frame_set(1)
base = {b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in rig.pose.bones}
rest = {b.name:b.bone.matrix_local.to_quaternion() for b in rig.pose.bones}
ordem = ['quadril','tronco','peito','cabeca','mandibula','orelha_E','orelha_D',
         'braco_E','antebraco_E','mao_E','coxa_E','canela_E','pe_E',
         'braco_D','antebraco_D','mao_D','coxa_D','canela_D','pe_D','cauda']
bpy.context.view_layer.update()
ancoras = {lado:rig.pose.bones[f'pe_{lado}'].head.copy() for lado in ['E','D']}

def aplicar(pose):
    for nome,(rot,pos) in pose.items():
        osso=rig.pose.bones[nome]
        osso.rotation_quaternion=rot.copy()
        osso.location=pos.copy()
    bpy.context.view_layer.update()

def orientar(nome,desejada):
    osso=rig.pose.bones[nome]
    osso.rotation_quaternion=rest[nome].inverted() @ rest[osso.parent.name] @ osso.parent.matrix.to_quaternion().inverted() @ desejada
    bpy.context.view_layer.update()

def proteger(lado,alvo):
    braco,antebraco,mao=[rig.pose.bones[f'{n}_{lado}'] for n in ['braco','antebraco','mao']]
    ombro=braco.head.copy()
    eixo=(alvo-ombro).normalized()
    d=(alvo-ombro).length
    a=(antebraco.bone.head_local-braco.bone.head_local).length
    b=(mao.bone.head_local-antebraco.bone.head_local).length
    if not abs(a-b)+1e-5<d<a+b-1e-5:
        raise RuntimeError(f'Defesa fora do alcance do braço {lado}.')
    pole=Vector((-.05,.1 if lado=='E' else -.1,-.5))
    pole-=eixo*pole.dot(eixo)
    pole.normalize()
    u=(a*a-b*b+d*d)/(2*d)
    cotovelo=ombro+eixo*u+pole*max(0,a*a-u*u)**.5
    for osso,filho,direcao in [(braco,antebraco,cotovelo-ombro),(antebraco,mao,alvo-cotovelo)]:
        direcao_rest=(filho.bone.head_local-osso.bone.head_local).normalized()
        orientar(osso.name,direcao_rest.rotation_difference(direcao.normalized()) @ rest[osso.name])
    orientar(mao.name,antebraco.matrix.to_quaternion() @ rest[antebraco.name].inverted() @ rest[mao.name])
    if (mao.head-alvo).length>.001:
        raise RuntimeError('Luva fora da posição de proteção.')

acao=bpy.data.actions.new('pipoca_defesa_alta_estudo_v7')
acao.use_fake_user=True
rig.animation_data.action=acao
medidas=[]
for q in range(61):
    cena.frame_set(q)
    aplicar(base)
    onda=sin(2*pi*q/60)
    peito=rig.pose.bones['peito']
    orientar('peito',Quaternion((0,1,0),.008*onda) @ peito.matrix.to_quaternion())
    cabeca=rig.pose.bones['cabeca']
    orientar('cabeca',Quaternion((0,1,0),.10+.008*onda) @ cabeca.matrix.to_quaternion())
    proteger('E',Vector((.42,.24,2.00+.008*onda)))
    proteger('D',Vector((.40,-.24,1.98+.008*onda)))
    for nome,amplitude in [('orelha_E',1.5),('orelha_D',1.2),('cauda',1.5)]:
        rig.pose.bones[nome].rotation_quaternion @= Quaternion(rest[nome].inverted() @ Vector((0,1,0)),amplitude*pi/180*onda)
    for osso in rig.pose.bones:
        osso.keyframe_insert(data_path='rotation_quaternion',frame=q,group=osso.name)
        osso.keyframe_insert(data_path='location',frame=q,group=osso.name)
    medidas.append({'quadro':q,'pulsos':{lado:list(rig.pose.bones[f'mao_{lado}'].head) for lado in ['E','D']}})
for camada in acao.layers:
    for faixa in camada.strips:
        for bolsa in faixa.channelbags:
            for curva in bolsa.fcurves:
                for chave in curva.keyframe_points:chave.interpolation='LINEAR'

erro_ancora=0
for meio in range(121):
    q=meio*.5
    cena.frame_set(int(q),subframe=q-int(q))
    for lado in ['E','D']:
        erro_ancora=max(erro_ancora,(rig.pose.bones[f'pe_{lado}'].head-ancoras[lado]).length)
if erro_ancora>.001:
    raise RuntimeError('Defesa deslocou os pés.')

rotacoes={n:[] for n in ordem}
posicoes={n:[] for n in ordem}
c=Matrix.Rotation(-pi/2,4,'X')
for q in range(61):
    cena.frame_set(q)
    globais={b.name:c @ b.matrix @ b.bone.matrix_local.inverted() @ Matrix.Translation(b.bone.head_local) @ c.inverted() for b in rig.pose.bones}
    for osso in rig.pose.bones:
        local=globais[osso.parent.name].inverted() @ globais[osso.name] if osso.parent else globais[osso.name]
        r=local.to_quaternion().normalized()
        anterior=rotacoes[osso.name][-4:]
        if anterior and sum(v*w for v,w in zip(anterior,[r.x,r.y,r.z,r.w]))<0:r.negate()
        rotacoes[osso.name].extend([r.x,r.y,r.z,r.w])
        posicoes[osso.name].extend(local.to_translation())
canais=[]
tempos=[q/60 for q in range(61)]
for i,nome in enumerate(ordem):
    canais.append({'osso':i,'tipo':'rotation','tempos':tempos,'valores':rotacoes[nome]})
    canais.append({'osso':i,'tipo':'translation','tempos':tempos,'valores':posicoes[nome]})
clip={'nome':'defesa','duracaoQuadros':60,'canais':canais}
(saida/'defesa-v7.json').write_text(json.dumps(clip,separators=(',',':')),encoding='utf-8')
relatorio={'versao':7,'aprovadoFinal':False,'origem':'Defesa alta autoral por IK, baseada na guarda v4.',
    'sha256Simulacao':hashlib.sha256((raiz/'public/js/ko-sim.js').read_bytes()).hexdigest(),
    'duracaoQuadros':60,'protegidaDesdeInicio':True,'erroMaximoAncora':erro_ancora,
    'amostras':medidas,'limites':['Arte provisória com pesos rígidos.','Defesa baixa e reação ao impacto continuam pendentes.']}
(saida/'defesa-relatorio-v7.json').write_text(json.dumps(relatorio,ensure_ascii=False,indent=2),encoding='utf-8')
cena.frame_start=0
cena.frame_end=60
cena.render.fps=60
cena.frame_set(0)
cena['etapa']='Defesa alta v7, ciclo sempre protegido; arte final pendente.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(saida/'pipoca-defesa-v7.blend'),compress=True)
print('KO_DEFESA_V7 '+json.dumps({'duracao':60,'erroAncora':erro_ancora}),flush=True)

if '--sem-render' not in sys.argv:
    cena.render.resolution_x=cena.render.resolution_y=480
    cena.render.resolution_percentage=100
    cena.eevee.taa_render_samples=8
    pasta=saida/'previa-defesa-v7'
    pasta.mkdir(exist_ok=True)
    # Guarda, defesa em ciclo e saída ampliada para leitura; o clip do jogo é só defesa.
    cena.frame_set(0)
    protegida={b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in rig.pose.bones}
    rig.animation_data.action=None
    aplicar(base)
    cena.render.filepath=str(pasta/'000.png')
    bpy.ops.render.render(write_still=True)
    rig.animation_data.action=acao
    for i,q in enumerate(range(0,60,5),1):
        cena.frame_set(q)
        cena.render.filepath=str(pasta/f'{i:03d}.png')
        bpy.ops.render.render(write_still=True)
    rig.animation_data.action=None
    for q in range(1,5):
        t=q/4
        peso=t*t*(3-2*t)
        aplicar({n:(protegida[n][0].slerp(base[n][0],peso),protegida[n][1].lerp(base[n][1],peso)) for n in ordem})
        cena.render.filepath=str(pasta/f'{12+q:03d}.png')
        bpy.ops.render.render(write_still=True)
    rig.animation_data.action=acao
    cena.frame_set(0)
