"""Socos autorais por IK sobre a guarda v4; --forte produz p2 sem alterar p1."""
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
contrato = json.loads((raiz/'art/premium/modelos-3d/contrato.json').read_text(encoding='utf-8'))
forte = '--forte' in sys.argv
nome_clip, versao, nome_arquivo, lado = ('p2',6,'soco-forte','D') if forte else ('p1',5,'jab','E')
golpe = next(l for l in contrato['lutadores'] if l['id']=='pipoca')['golpes'][nome_clip]
duracao = golpe['duracaoQuadros']
de, ate = golpe['janelasAtivas'][0]
if (duracao,de,ate)!=((18,5,7) if forte else (12,3,5)):
    raise RuntimeError('Revisar o soco para os novos tempos do motor.')
bpy.context.view_layer.update()
mao_inicial = rig.pose.bones[f'mao_{lado}'].head.copy()
ancoras = {lado:rig.pose.bones[f'pe_{lado}'].head.copy() for lado in ['E','D']}

def orientar(nome, desejada):
    b = rig.pose.bones[nome]
    b.rotation_quaternion = rest[nome].inverted() @ rest[b.parent.name] @ b.parent.matrix.to_quaternion().inverted() @ desejada
    bpy.context.view_layer.update()

def suave(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)

def extensao(q):
    preparo = 2 if forte else 1
    retorno = 15 if forte else 10
    if q<=preparo: return -.06*suave(q/preparo)
    if q<de: return -.06+1.06*suave((q-preparo)/(de-preparo))
    if q<=ate: return 1
    if q<retorno: return 1-suave((q-ate)/(retorno-ate))
    return 0

acao = bpy.data.actions.new(f'pipoca_{nome_arquivo.replace("-","_")}_estudo_v{versao}')
acao.use_fake_user=True
rig.animation_data.action=acao
medidas=[]
for q in range(duracao+1):
    cena.frame_set(q)
    for nome,(rot,pos) in base.items():
        b=rig.pose.bones[nome]
        b.rotation_quaternion=rot.copy();b.location=pos.copy()
    e=extensao(q)
    # Pequena inclinação vem do tronco; a raiz jogável não avança.
    tronco=rig.pose.bones['tronco']
    tronco.rotation_quaternion @= Quaternion(rest['tronco'].inverted() @ Vector((0,1,0)), (.22 if forte else .09)*e)
    bpy.context.view_layer.update()
    if forte:
        peito=rig.pose.bones['peito']
        orientar('peito',Quaternion((0,0,1),.85*e) @ peito.matrix.to_quaternion())
    bpy.context.view_layer.update()
    braco,antebraco,mao=[rig.pose.bones[f'{n}_{lado}'] for n in ['braco','antebraco','mao']]
    h=braco.head.copy()
    contato=Vector((1.06,-.18,42/24) if forte else (.96,.18,45/24))
    alvo=mao_inicial.lerp(contato,e)
    eixo=(alvo-h).normalized();d=(alvo-h).length
    a=(antebraco.bone.head_local-braco.bone.head_local).length
    b=(mao.bone.head_local-antebraco.bone.head_local).length
    if not abs(a-b)+1e-5<d<a+b-1e-5:
        raise RuntimeError(f'{nome_clip} fora do alcance no quadro {q}: {d:.4f}, limite {a+b:.4f}.')
    pole=Vector((-.05,-.10 if forte else .10,-.5));pole-=eixo*pole.dot(eixo);pole.normalize()
    u=(a*a-b*b+d*d)/(2*d)
    cotovelo=h+eixo*u+pole*max(0,a*a-u*u)**.5
    for nome,direcao in [(f'braco_{lado}',cotovelo-h),(f'antebraco_{lado}',alvo-cotovelo)]:
        osso=rig.pose.bones[nome]
        filho=antebraco if nome==f'braco_{lado}' else mao
        direcao_rest=(filho.bone.head_local-osso.bone.head_local).normalized()
        orientar(nome,direcao_rest.rotation_difference(direcao.normalized()) @ rest[nome])
    orientar(f'mao_{lado}',antebraco.matrix.to_quaternion() @ rest[f'antebraco_{lado}'].inverted() @ rest[f'mao_{lado}'])
    for nome in ['orelha_E','orelha_D']:
        o=rig.pose.bones[nome]
        o.rotation_quaternion @= Quaternion(rest[nome].inverted() @ Vector((0,1,0)), -4*pi/180*sin(pi*max(0,e)))
    bpy.context.view_layer.update()
    if (mao.head-alvo).length>.001:
        raise RuntimeError('Luva fora do alvo do soco.')
    for lado in ['E','D']:
        if (rig.pose.bones[f'pe_{lado}'].head-ancoras[lado]).length>.001:
            raise RuntimeError('Soco deslocou uma âncora do pé.')
    for osso in rig.pose.bones:
        osso.keyframe_insert(data_path='rotation_quaternion',frame=q,group=osso.name)
        osso.keyframe_insert(data_path='location',frame=q,group=osso.name)
    medidas.append({'quadro':q,'extensao':e,'pulso':list(mao.head)})

for camada in acao.layers:
    for faixa in camada.strips:
        for bolsa in faixa.channelbags:
            for curva in bolsa.fcurves:
                for chave in curva.keyframe_points:chave.interpolation='LINEAR'
rotacoes={n:[] for n in ordem};posicoes={n:[] for n in ordem}
c=Matrix.Rotation(-pi/2,4,'X')
for q in range(duracao+1):
    cena.frame_set(q)
    globais={b.name:c @ b.matrix @ b.bone.matrix_local.inverted() @ Matrix.Translation(b.bone.head_local) @ c.inverted() for b in rig.pose.bones}
    for b in rig.pose.bones:
        local=globais[b.parent.name].inverted() @ globais[b.name] if b.parent else globais[b.name]
        r=local.to_quaternion().normalized()
        anterior=rotacoes[b.name][-4:]
        if anterior and sum(v*w for v,w in zip(anterior,[r.x,r.y,r.z,r.w]))<0:r.negate()
        rotacoes[b.name].extend([r.x,r.y,r.z,r.w]);posicoes[b.name].extend(local.to_translation())
canais=[]
tempos=[q/60 for q in range(duracao+1)]
for i,nome in enumerate(ordem):
    canais.append({'osso':i,'tipo':'rotation','tempos':tempos,'valores':rotacoes[nome]})
    canais.append({'osso':i,'tipo':'translation','tempos':tempos,'valores':posicoes[nome]})
clip={'nome':nome_clip,'duracaoQuadros':duracao,'canais':canais}
(saida/f'{nome_arquivo}-v{versao}.json').write_text(json.dumps(clip,separators=(',',':')),encoding='utf-8')
relatorio={'versao':versao,'aprovadoFinal':False,'origem':'Soco animado por IK sobre a guarda Mixamo; não é outro clip baixado.',
    'sha256Simulacao':hashlib.sha256((raiz/'public/js/ko-sim.js').read_bytes()).hexdigest(),
    'duracaoQuadros':duracao,'janelaContato':[de,ate],'amostras':medidas,
    'limites':['Contato visual inicial; ainda exige revisar alcance com caixas na arena.',
        'Modelo provisório com pesos rígidos.', 'Demais golpes continuam estudos anteriores.']}
(saida/f'{nome_arquivo}-relatorio-v{versao}.json').write_text(json.dumps(relatorio,ensure_ascii=False,indent=2),encoding='utf-8')
cena.frame_start=0;cena.frame_end=duracao;cena.render.fps=60
cena.frame_set(0)
cena['etapa']=f'{nome_clip} v{versao}, contato {de}–{ate}; estudo técnico, arte final pendente.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(saida/f'pipoca-{nome_arquivo}-v{versao}.blend'),compress=True)
print(f'KO_SOCO_V{versao} '+json.dumps({'clip':nome_clip,'duracao':duracao,'contato':[de,ate]},ensure_ascii=False),flush=True)
if '--sem-render' not in sys.argv:
    cena.render.resolution_x=cena.render.resolution_y=480
    cena.render.resolution_percentage=100;cena.eevee.taa_render_samples=8
    pasta=saida/f'previa-{nome_arquivo}-v{versao}';pasta.mkdir(exist_ok=True)
    for q in range(duracao+1):
        cena.frame_set(q);cena.render.filepath=str(pasta/f'{q:03d}.png')
        bpy.ops.render.render(write_still=True)
