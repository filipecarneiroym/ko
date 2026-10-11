"""Transfere o estudo Boxing do Mixamo para uma cópia do rig da Pipoca.

Executar com Blender --background --python-exit-code 1 --python este-arquivo.
Mantém os arquivos originais; o resultado exige revisão artística.
"""
from pathlib import Path
from math import pi
import json
import bpy
from mathutils import Quaternion, Vector

raiz = Path(__file__).resolve().parents[2]
saida = raiz / 'art/premium/modelos-3d/estudos-mixamo'
saida.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(raiz / 'art/premium/modelos-3d/blockout/pipoca-v1.blend'))
destino = bpy.data.objects['lutador']
destino.data.pose_position = 'POSE'
anteriores = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(raiz / 'art/premium/movimentos/Boxing.fbx'))
importados = set(bpy.data.objects) - anteriores
origem = next(o for o in importados if o.type == 'ARMATURE')
acao_origem = origem.animation_data.action
inicio, fim = [round(v) for v in acao_origem.frame_range]
cena = bpy.context.scene
# O importador FBX ajusta fps ao arquivo; não reinterpretar sua duração.
fps = cena.render.fps / cena.render.fps_base
giro = Quaternion(Vector((0, 0, 1)), pi / 2)
mapa = {'quadril': 'Hips', 'tronco': 'Spine', 'peito': 'Spine2', 'cabeca': 'Head'}
segmentos = {}
for lado, ingles in [('E', 'Left'), ('D', 'Right')]:
    for nome, osso, ponta in [
        ('braco', 'Arm', 'ForeArm'), ('antebraco', 'ForeArm', 'Hand'),
        ('coxa', 'UpLeg', 'Leg'), ('canela', 'Leg', 'Foot'),
        ('pe', 'Foot', 'ToeBase'),
    ]:
        chave = f'{nome}_{lado}'
        mapa[chave] = ingles + osso
        segmentos[chave] = (ingles + osso, ingles + ponta)
    # As luvas não compartilham os eixos locais das mãos humanas do Mixamo.
    # A orientação herdada do antebraço mantém o punho alinhado à manga.

def fonte(nome):
    return origem.pose.bones['mixamorig:' + nome]

def ponto_fonte(nome):
    return origem.matrix_world @ fonte(nome).head

def orientacao_fonte(nome, repouso=False):
    b = fonte(nome)
    matriz = b.bone.matrix_local if repouso else b.matrix
    return (origem.matrix_world @ matriz).to_quaternion()

destino.animation_data_clear()
destino.animation_data_create()
acao = bpy.data.actions.new('pipoca_mixamo_boxing_estudo')
acao.use_fake_user = True
destino.animation_data.action = acao
repouso = {b.name: b.matrix_local.to_quaternion() for b in destino.data.bones}
direcoes = {}
for nome in segmentos:
    b = destino.data.bones[nome]
    filho = next(iter(b.children), None)
    direcoes[nome] = ((filho.head_local - b.head_local) if filho else Vector((1, 0, 0))).normalized()
altura_fonte = (origem.matrix_world @ fonte('Hips').bone.head_local).z
escala = destino.data.bones['quadril'].head_local.z / altura_fonte
cena.frame_set(inicio)
quadril_inicial = ponto_fonte('Hips').copy()
malhas = [o for o in anteriores if o.type == 'MESH' and any(
    modificador.type == 'ARMATURE' and modificador.object == destino
    for modificador in o.modifiers)]
if not malhas:
    raise RuntimeError('Não foi encontrada a malha vinculada à Pipoca.')
apoios = []
ancoras = {}
erros_pes = []

def orientar(nome, rotacao):
    b = destino.pose.bones[nome]
    pai_pose = b.parent.matrix.to_quaternion() if b.parent else Quaternion()
    pai_rest = repouso[b.parent.name] if b.parent else Quaternion()
    b.rotation_quaternion = repouso[nome].inverted() @ pai_rest @ pai_pose.inverted() @ rotacao
    bpy.context.view_layer.update()

def apoiar_perna(lado, alvo):
    coxa = destino.pose.bones[f'coxa_{lado}']
    canela = destino.pose.bones[f'canela_{lado}']
    pe = destino.pose.bones[f'pe_{lado}']
    h = coxa.head.copy()
    joelho_anterior = canela.head.copy()
    vetor = alvo - h
    distancia = vetor.length
    eixo = vetor.normalized()
    comprimento_a = (canela.bone.head_local - coxa.bone.head_local).length
    comprimento_b = (pe.bone.head_local - canela.bone.head_local).length
    if not abs(comprimento_a - comprimento_b) + 1e-5 < distancia < comprimento_a + comprimento_b - 1e-5:
        raise RuntimeError(f'Âncora do pé {lado} fora do alcance no quadro {cena.frame_current}.')
    pole = joelho_anterior - h
    pole -= eixo * pole.dot(eixo)
    if pole.length < 1e-5:
        pole = Vector((1, 0, 0))
        pole -= eixo * pole.dot(eixo)
    pole.normalize()
    avanco = (comprimento_a ** 2 - comprimento_b ** 2 + distancia ** 2) / (2 * distancia)
    altura = max(0, comprimento_a ** 2 - avanco ** 2) ** .5
    joelho = h + eixo * avanco + pole * altura
    orientar(coxa.name, direcoes[coxa.name].rotation_difference((joelho - h).normalized()) @ repouso[coxa.name])
    orientar(canela.name, direcoes[canela.name].rotation_difference((alvo - joelho).normalized()) @ repouso[canela.name])
    # O pé mantém a orientação do primeiro quadro e acompanha a posição resolvida por IK.
    orientar(pe.name, ancoras[lado]['rotacao'])
    erro = (pe.head - alvo).length
    if erro > .001:
        raise RuntimeError(f'Erro IK no pé {lado}: {erro}')
    erros_pes.append(erro)
    for b in [coxa, canela, pe]:
        b.keyframe_insert(data_path='rotation_quaternion', frame=cena.frame_current, group=b.name)

def altura_minima():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    menor = float('inf')
    for objeto in malhas:
        avaliado = objeto.evaluated_get(depsgraph)
        malha = avaliado.to_mesh()
        try:
            menor = min(menor, min((avaliado.matrix_world @ v.co).z for v in malha.vertices))
        finally:
            avaliado.to_mesh_clear()
    return menor

for quadro in range(inicio, fim + 1):
    cena.frame_set(quadro)
    desejadas = {}
    for b in destino.pose.bones:
        nome = b.name
        if nome in segmentos:
            a, ponta = segmentos[nome]
            direcao = giro @ (ponto_fonte(ponta) - ponto_fonte(a)).normalized()
            if nome.startswith('pe_'):
                # Neste estudo de guarda, conservar a sola horizontal.
                # O vetor Foot -> ToeBase inclinado deixava a coelha na ponta dos dedos.
                direcao.z = 0
                if direcao.length < 1e-6:
                    direcao = Vector((1, 0, 0))
                direcao.normalize()
            desejada = direcoes[nome].rotation_difference(direcao) @ repouso[nome]
        elif nome in mapa:
            src = mapa[nome]
            delta = orientacao_fonte(src) @ orientacao_fonte(src, True).inverted()
            if nome == 'cabeca':
                # A cabeça grande e o focinho precisam de menos inclinação que o humano.
                delta = Quaternion().slerp(delta, .45)
            desejada = giro @ delta @ giro.inverted() @ repouso[nome]
        else:
            desejada = (desejadas[b.parent.name] @ repouso[b.parent.name].inverted() @ repouso[nome]) if b.parent else repouso[nome]
        desejadas[nome] = desejada
        pai_pose = desejadas[b.parent.name] if b.parent else Quaternion()
        pai_rest = repouso[b.parent.name] if b.parent else Quaternion()
        b.rotation_mode = 'QUATERNION'
        b.rotation_quaternion = repouso[nome].inverted() @ pai_rest @ pai_pose.inverted() @ desejada
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
        if nome == 'quadril':
            # A simulação controla deslocamento horizontal; conservar só o balanço vertical.
            deslocamento = Vector((0, 0, (ponto_fonte('Hips').z - quadril_inicial.z) * escala))
            b.location = repouso[nome].inverted() @ deslocamento
        b.keyframe_insert(data_path='rotation_quaternion', frame=quadro, group=nome)
        b.keyframe_insert(data_path='location', frame=quadro, group=nome)

    # Corrigir a altura pelo limite da malha deformada, não pelo pivô do tornozelo.
    # Isso garante contato vertical de ao menos um pé; não resolve deslizamento lateral.
    bpy.context.view_layer.update()
    menor = altura_minima()
    quadril = destino.pose.bones['quadril']
    correcao_local = destino.matrix_world.to_3x3().inverted() @ Vector((0, 0, -menor))
    quadril.location += repouso['quadril'].inverted() @ correcao_local
    quadril.keyframe_insert(data_path='location', frame=quadro, group='quadril')
    bpy.context.view_layer.update()
    residual = altura_minima()
    if abs(residual) > .001:
        raise RuntimeError(f'Apoio fora da tolerância no quadro {quadro}: {residual}')
    apoios.append({'quadro': quadro, 'correcao_vertical': -menor, 'erro_solo': residual})
    for lado in ['E', 'D']:
        pe = destino.pose.bones[f'pe_{lado}']
        if lado not in ancoras:
            alvo = pe.head.copy()
            alvo.z = pe.bone.head_local.z
            ancoras[lado] = {'posicao': alvo, 'rotacao': pe.matrix.to_quaternion().copy()}
        apoiar_perna(lado, ancoras[lado]['posicao'])

for objeto in importados:
    bpy.data.objects.remove(objeto, do_unlink=True)
cena.frame_start, cena.frame_end = inicio, fim
cena['movimento_origem'] = 'art/premium/movimentos/Boxing.fbx'
cena['etapa'] = 'Estudo de guarda fixa com pés ancorados por IK analítica; revisão artística pendente.'
if 'QA_Chao' in bpy.data.objects:
    bpy.data.objects['QA_Chao'].location.z = -.002
cena.frame_set(inicio)
bpy.ops.object.select_all(action='DESELECT')
destino.select_set(True)
bpy.context.view_layer.objects.active = destino
bpy.context.preferences.filepaths.save_version = 0
blend = saida / 'pipoca-boxing-guarda-v3.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
cena.render.resolution_x = cena.render.resolution_y = 640
cena.render.resolution_percentage = 100
cena.eevee.taa_render_samples = 16
for quadro in [inicio, (inicio + fim) // 2, fim]:
    cena.frame_set(quadro)
    cena.render.filepath = str(saida / f'pipoca-boxing-v3-{quadro:03d}.png')
    bpy.ops.render.render(write_still=True)
relatorio = {'arquivo': str(blend), 'acao': acao.name, 'quadros': [inicio, fim], 'fps': fps,
             'duracao_segundos': (fim - inicio) / fps, 'aprovadoFinal': False,
             'ajustes_guarda': {'luvas': 'orientação herdada dos antebraços', 'cabeca': '45% da rotação global do movimento humano'},
             'ik': {'variante': 'guarda fixa; ambos os pés ancorados durante todo o estudo',
                    'amostras_verificadas': len(erros_pes), 'erro_maximo_ancora': max(erros_pes)},
             'apoio': {'quadros_verificados': len(apoios), 'erro_maximo_solo': max(abs(a['erro_solo']) for a in apoios),
                       'correcao_minima': min(a['correcao_vertical'] for a in apoios),
                       'correcao_maxima': max(a['correcao_vertical'] for a in apoios)},
             'limites': ['Guarda fixa criada a partir do Mixamo; passos originais são substituídos por pés ancorados.', 'Solas horizontais específicas para este estudo, não para saltos ou chutes.', 'Sem sincronização aos golpes do motor.', 'Orelhas e cauda acompanham os pais; sem animação secundária própria.']}
(saida / 'boxe-v3.json').write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding='utf-8')
print('KO_MIXAMO ' + json.dumps(relatorio, ensure_ascii=False))
