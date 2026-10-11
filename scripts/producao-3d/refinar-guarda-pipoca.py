"""Refina a guarda v3, mede a pose final e exporta amostras para o GLB.

Executar em um novo Blender background com --threads 2. Preserva v1–v3.
--sem-render permite repetir somente validação e exportação.
"""
from pathlib import Path
from math import acos, pi, sin, cos
import hashlib
import json
import sys
import bpy
from mathutils import Matrix, Quaternion, Vector

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / 'art/premium/modelos-3d/estudos-mixamo'
FONTE = SAIDA / 'pipoca-boxing-guarda-v3.blend'
bpy.ops.wm.open_mainfile(filepath=str(FONTE))
cena = bpy.context.scene
rig = bpy.data.objects['lutador']
rig.data.pose_position = 'POSE'
inicio, fim = cena.frame_start, cena.frame_end
duracao = fim - inicio
fps = cena.render.fps / cena.render.fps_base
if fps != 60 or duracao != 104:
    raise RuntimeError('Este estudo espera 105 amostras a 60 FPS.')
ossos = list(rig.pose.bones)
rest = {b.name: b.bone.matrix_local.to_quaternion() for b in ossos}
nomes = [b.name for b in ossos]
# Ordem publicada por criarRig; não depender da ordem interna dos ossos no Blender.
ordem = ['quadril', 'tronco', 'peito', 'cabeca', 'mandibula', 'orelha_E', 'orelha_D',
         'braco_E', 'antebraco_E', 'mao_E', 'coxa_E', 'canela_E', 'pe_E',
         'braco_D', 'antebraco_D', 'mao_D', 'coxa_D', 'canela_D', 'pe_D', 'cauda']
if set(ordem) != set(nomes):
    raise RuntimeError('Rig incompatível com criarRig.')
malhas = [o for o in cena.objects if o.type == 'MESH' and any(
    m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
if not malhas:
    raise RuntimeError('Malha deformável ausente.')
solas = {}
for o in malhas:
    for lado in ['E', 'D']:
        grupo = o.vertex_groups.get(f'pe_{lado}')
        if grupo:
            indices = [v.index for v in o.data.vertices if any(g.group == grupo.index and g.weight > .99 for g in v.groups)]
            if indices:
                solas[(o.name, lado)] = indices
if {lado for _, lado in solas} != {'E', 'D'}:
    raise RuntimeError('Os dois pés precisam de vértices identificáveis.')

def angulo(a, b):
    return 2 * acos(min(1.0, max(0.0, abs(a.normalized().dot(b.normalized())))))

def orientar(nome, desejada):
    b = rig.pose.bones[nome]
    pai_pose = b.parent.matrix.to_quaternion() if b.parent else Quaternion()
    pai_rest = rest[b.parent.name] if b.parent else Quaternion()
    b.rotation_quaternion = rest[nome].inverted() @ pai_rest @ pai_pose.inverted() @ desejada
    bpy.context.view_layer.update()

def resolver_braco(lado):
    braco, antebraco, mao = [rig.pose.bones[f'{n}_{lado}'] for n in ['braco', 'antebraco', 'mao']]
    ombro = braco.head.copy()
    alvo = mao.head.copy()
    # Elevar a guarda sem aproximar a luva do focinho; manter o balanço do original.
    altura_queixo = rig.pose.bones['mandibula'].head.z
    alvo.z = max(alvo.z, altura_queixo - .18)
    alvo.x = max(alvo.x, .42)
    sinal = 1 if lado == 'E' else -1
    alvo.y = sinal * min(abs(alvo.y), .42)
    eixo = (alvo - ombro).normalized()
    d = (alvo - ombro).length
    a = (antebraco.bone.head_local - braco.bone.head_local).length
    b = (mao.bone.head_local - antebraco.bone.head_local).length
    if not abs(a - b) + 1e-5 < d < a + b - 1e-5:
        raise RuntimeError(f'Guarda fora do alcance do braço {lado}.')
    pole = Vector((-.05, sinal * .10, -.5))
    pole -= eixo * pole.dot(eixo)
    pole.normalize()
    u = (a*a - b*b + d*d) / (2*d)
    cotovelo = ombro + eixo*u + pole * max(0, a*a-u*u)**.5
    dir_a = (antebraco.bone.head_local - braco.bone.head_local).normalized()
    dir_b = (mao.bone.head_local - antebraco.bone.head_local).normalized()
    orientar(braco.name, dir_a.rotation_difference((cotovelo-ombro).normalized()) @ rest[braco.name])
    orientar(antebraco.name, dir_b.rotation_difference((alvo-cotovelo).normalized()) @ rest[antebraco.name])
    orientar(mao.name, antebraco.matrix.to_quaternion() @ rest[antebraco.name].inverted() @ rest[mao.name])
    if (mao.head-alvo).length > .001:
        raise RuntimeError('Erro no posicionamento da luva.')

poses = []
for f in range(inicio, fim+1):
    cena.frame_set(f)
    for lado in ['E', 'D']:
        resolver_braco(lado)
    fase = 2*pi*(f-inicio)/duracao
    for nome, atraso, amplitude in [('orelha_E', .08, 3.5), ('orelha_D', .12, 3), ('cauda', .16, 2.5)]:
        b = rig.pose.bones[nome]
        eixo_global = Vector((0, 1, 0)) if nome.startswith('orelha') else Vector((0, 0, 1))
        eixo_local = rest[nome].inverted() @ eixo_global
        b.rotation_quaternion = b.rotation_quaternion @ Quaternion(eixo_local, amplitude*pi/180*sin(fase-2*pi*atraso/(duracao/fps)))
    poses.append({b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in ossos})

erro_loop_original = max(angulo(poses[0][n][0], poses[-1][n][0]) for n in nomes)
erro_loop_pos_original = max((poses[0][n][1]-poses[-1][n][1]).length for n in nomes)
# Remover somente a deriva entre as extremidades; não refazer o balanço da guarda.
for i, pose in enumerate(poses):
    u = i/duracao
    for nome in nomes:
        q, t = pose[nome]
        q0, t0 = poses[0][nome]
        qfim, tfim = poses[-1][nome]
        correcao = Quaternion().slerp(qfim.inverted() @ q0, u)
        pose[nome] = (q @ correcao, t + (t0-tfim)*u)
# Fechar exatamente e manter sinais contínuos antes de gravar as curvas.
poses[-1] = {n: (poses[0][n][0].copy(), poses[0][n][1].copy()) for n in nomes}
for i in range(1, len(poses)):
    for nome in nomes:
        q, t = poses[i][nome]
        if poses[i-1][nome][0].dot(q) < 0:
            q.negate()
        poses[i][nome] = (q.normalized(), t)

acao = bpy.data.actions.new('pipoca_guarda_mixamo_v4')
acao.use_fake_user = True
rig.animation_data.action = acao
for i, pose in enumerate(poses):
    for nome, (q, t) in pose.items():
        b = rig.pose.bones[nome]
        b.rotation_mode = 'QUATERNION'
        b.rotation_quaternion, b.location = q, t
        b.keyframe_insert(data_path='rotation_quaternion', frame=inicio+i, group=nome)
        b.keyframe_insert(data_path='location', frame=inicio+i, group=nome)
for camada in acao.layers:
    for faixa in camada.strips:
        for bolsa in faixa.channelbags:
            for curva in bolsa.fcurves:
                for chave in curva.keyframe_points:
                    chave.interpolation = 'LINEAR'

amostras = []
cena.frame_set(inicio)
ancoras = {lado: rig.pose.bones[f'pe_{lado}'].head.copy() for lado in ['E','D']}
for meio in range(duracao*2+1):
    tempo = inicio + meio*.5
    cena.frame_set(int(tempo), subframe=tempo-int(tempo))
    bpy.context.view_layer.update()
    alturas = {'E': float('inf'), 'D': float('inf')}
    deps = bpy.context.evaluated_depsgraph_get()
    for o in malhas:
        avaliado = o.evaluated_get(deps)
        malha = avaliado.to_mesh()
        try:
            if len(malha.vertices) != len(o.data.vertices):
                raise RuntimeError('A validação por vértice requer topologia preservada.')
            for lado in ['E','D']:
                indices = solas.get((o.name, lado), [])
                if indices:
                    alturas[lado] = min(alturas[lado], min((avaliado.matrix_world @ malha.vertices[i].co).z for i in indices))
        finally:
            avaliado.to_mesh_clear()
    erros = {lado: (rig.pose.bones[f'pe_{lado}'].head - ancoras[lado]).length for lado in ['E','D']}
    if max(abs(h) for h in alturas.values()) > .001 or max(erros.values()) > .001:
        raise RuntimeError(f'Contato final fora de 1 mm no quadro {tempo}: {alturas}, {erros}')
    amostras.append({'quadro': tempo, 'solas': alturas, 'ancoras': erros})

# Converter matrizes de deformação à hierarquia original dos nós GLB.
c = Matrix.Rotation(-pi/2, 4, 'X')
canais = []
tempos = [i/fps for i in range(duracao+1)]
rotacoes = {n: [] for n in nomes}
translacoes = {n: [] for n in nomes}
for i in range(duracao+1):
    cena.frame_set(inicio+i)
    globais = {}
    for b in ossos:
        deformacao = b.matrix @ b.bone.matrix_local.inverted()
        globais[b.name] = c @ deformacao @ Matrix.Translation(b.bone.head_local) @ c.inverted()
    for b in ossos:
        local = globais[b.parent.name].inverted() @ globais[b.name] if b.parent else globais[b.name]
        q = local.to_quaternion().normalized()
        anterior = rotacoes[b.name][-4:]
        if anterior and sum(a*v for a,v in zip(anterior, [q.x,q.y,q.z,q.w])) < 0:
            q.negate()
        rotacoes[b.name].extend([q.x,q.y,q.z,q.w])
        translacoes[b.name].extend(local.to_translation())
for indice, nome in enumerate(ordem):
    canais.append({'osso': indice, 'tipo': 'rotation', 'tempos': tempos, 'valores': rotacoes[nome]})
    canais.append({'osso': indice, 'tipo': 'translation', 'tempos': tempos, 'valores': translacoes[nome]})
clip = {'nome': 'parado', 'duracaoQuadros': duracao, 'canais': canais}
(SAIDA/'guarda-v4.json').write_text(json.dumps(clip, ensure_ascii=False, separators=(',',':')), encoding='utf-8')

erro_loop = max(angulo(poses[0][n][0], poses[-1][n][0]) for n in nomes)
velocidades = []
for n in nomes:
    # Diferença entre incrementos angulares nos dois lados da emenda; ainda precisa de inspeção em vídeo.
    v_inicio = angulo(poses[0][n][0], poses[1][n][0])*fps
    v_fim = angulo(poses[-2][n][0], poses[-1][n][0])*fps
    velocidades.append(abs(v_inicio-v_fim))
relatorio = {'versao':4, 'aprovadoFinal':False, 'origem':'Boxing.fbx/Mixamo baixado pelo usuário',
    'sha256Fbx': hashlib.sha256((RAIZ/'art/premium/movimentos/Boxing.fbx').read_bytes()).hexdigest(),
    'quadros':[inicio,fim], 'duracaoQuadros':duracao, 'fps':fps,
    'guardas':['luvas elevadas próximas do queixo', 'cotovelos aproximados do tronco', 'pés ancorados'],
    'secundario':{'orelhasGraus':[3.5,3], 'caudaGraus':2.5, 'apenasVisual':True},
    'validacao':{'amostrasPorPe':len(amostras), 'incluiMeiosQuadros':True,
        'erroMaximoSola':max(abs(h) for a in amostras for h in a['solas'].values()),
        'erroMaximoAncora':max(h for a in amostras for h in a['ancoras'].values()),
        'erroLoopAntesRadianos':erro_loop_original, 'erroLoopAntesPosicao':erro_loop_pos_original,
        'erroLoopDepoisRadianos':erro_loop, 'diferencaMaximaVelocidadeEscalarLoopRadS':max(velocidades)},
    'limites':['Modelo continua blockout com pesos rígidos e junções separadas.',
        'Apoio fixo específico da guarda; não é captura de passos.',
        'Demais 30 clips continuam estudos procedurais.', 'Sem comprovação de desempenho em celular físico.']}
(SAIDA/'boxe-v4.json').write_text(json.dumps(relatorio,ensure_ascii=False,indent=2),encoding='utf-8')
cena.frame_set(inicio)
cena['etapa'] = 'Guarda Mixamo v4: IK, orelhas/cauda e ciclo; estudo não aprovado como arte final.'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SAIDA/'pipoca-boxing-guarda-v4.blend'),compress=True)
print('KO_GUARDA_V4 ' + json.dumps(relatorio,ensure_ascii=False), flush=True)
if '--sem-render' not in sys.argv:
    cena.render.resolution_x = cena.render.resolution_y = 480
    cena.render.resolution_percentage = 100
    cena.eevee.taa_render_samples = 8
    pasta = SAIDA/'previa-v4'
    pasta.mkdir(exist_ok=True)
    for indice in range(16):
        tempo = inicio + indice*duracao/16
        cena.frame_set(int(tempo),subframe=tempo-int(tempo))
        cena.render.image_settings.file_format = 'PNG'
        cena.render.filepath = str(pasta/f'{indice:03d}.png')
        bpy.ops.render.render(write_still=True)
        print(f'KO_PREVIA {indice+1}/16',flush=True)
