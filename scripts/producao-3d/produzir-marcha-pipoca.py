"""Marcha v9 por IK: ciclo no lugar, apoio compensando 1,3125 m de avanço.

Executar com Blender background e --threads 2; --sem-render omite a prévia.
A raiz mundial pertence ao motor. Nenhuma fonte v4–v8 é sobrescrita.
"""
from pathlib import Path
from math import floor, pi, sin
import hashlib
import json
import sys
import bpy
from mathutils import Matrix, Quaternion, Vector

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / 'art/premium/modelos-3d/estudos-mixamo'
DURACAO = 12
APOIO = 6
DISTANCIA_CICLO = 1.3125
EXCURSAO = DISTANCIA_CICLO / 4
ALTURA_BALANCO = .08
PASSO_AMOSTRA = .5
VELOCIDADE = DISTANCIA_CICLO / DURACAO
ORDEM = ['quadril', 'tronco', 'peito', 'cabeca', 'mandibula', 'orelha_E', 'orelha_D',
         'braco_E', 'antebraco_E', 'mao_E', 'coxa_E', 'canela_E', 'pe_E',
         'braco_D', 'antebraco_D', 'mao_D', 'coxa_D', 'canela_D', 'pe_D', 'cauda']

bpy.ops.wm.open_mainfile(filepath=str(SAIDA / 'pipoca-boxing-guarda-v4.blend'))
cena = bpy.context.scene
rig = bpy.data.objects['lutador']
rig.data.pose_position = 'POSE'
cena.frame_set(1)
bpy.context.view_layer.update()
base = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in rig.pose.bones}
rest = {b.name: b.bone.matrix_local.to_quaternion() for b in rig.pose.bones}
if set(ORDEM) != set(base):
    raise RuntimeError('Marcha requer o rig de 20 ossos da Pipoca.')
pes_base = {lado: rig.pose.bones[f'pe_{lado}'].head.copy() for lado in ['E', 'D']}
orientacoes_pes = {lado: rig.pose.bones[f'pe_{lado}'].matrix.to_quaternion().copy() for lado in ['E', 'D']}
# A guarda tem os pés escalonados. Centrar a trajetória em cada quadril evita
# somar a excursão da passada a esse escalonamento e ultrapassar a perna.
centros_x = {lado: rig.pose.bones[f'coxa_{lado}'].head.x for lado in ['E', 'D']}

malhas = [o for o in cena.objects if o.type == 'MESH' and any(
    m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
vertices_pes = {}
for objeto in malhas:
    for lado in ['E', 'D']:
        grupo = objeto.vertex_groups.get(f'pe_{lado}')
        if grupo:
            indices = [v.index for v in objeto.data.vertices if any(
                g.group == grupo.index and g.weight > .99 for g in v.groups)]
            if indices:
                vertices_pes[(objeto.name, lado)] = indices
if {lado for _, lado in vertices_pes} != {'E', 'D'}:
    raise RuntimeError('A validação da marcha requer vértices rígidos dos dois pés.')


def definir_quadro(q):
    cena.frame_set(int(q), subframe=q-int(q))


def restaurar():
    for nome, (rotacao, posicao) in base.items():
        osso = rig.pose.bones[nome]
        osso.rotation_quaternion = rotacao.copy()
        osso.location = posicao.copy()
    bpy.context.view_layer.update()


def orientar(nome, desejada):
    osso = rig.pose.bones[nome]
    osso.rotation_quaternion = (rest[nome].inverted() @ rest[osso.parent.name]
        @ osso.parent.matrix.to_quaternion().inverted() @ desejada)
    bpy.context.view_layer.update()


def trajetoria(q, lado):
    deslocamento_fase = 0 if lado == 'E' else DURACAO / 2
    fase = (q + deslocamento_fase) % DURACAO
    if fase <= APOIO:
        x = EXCURSAO - VELOCIDADE * fase
        altura = 0
        apoiado = True
    else:
        u = (fase - APOIO) / (DURACAO - APOIO)
        suave = u*u*(3-2*u)
        x = -EXCURSAO + 2*EXCURSAO*suave
        altura = ALTURA_BALANCO * sin(pi*u)**2
        apoiado = False
    alvo = pes_base[lado].copy()
    alvo.x = centros_x[lado] + x
    alvo.z += altura
    segmento = floor((q + deslocamento_fase) / DURACAO)
    return alvo, apoiado, segmento, altura


def resolver_perna(lado, alvo, q):
    coxa, canela, pe = [rig.pose.bones[f'{nome}_{lado}'] for nome in ['coxa', 'canela', 'pe']]
    quadril = coxa.head.copy()
    vetor = alvo - quadril
    d = vetor.length
    a = (canela.bone.head_local - coxa.bone.head_local).length
    b = (pe.bone.head_local - canela.bone.head_local).length
    if not abs(a-b)+1e-5 < d < a+b-1e-5:
        raise RuntimeError(f'Marcha fora do alcance da perna {lado} no quadro {q}: {d} / {a+b}.')
    eixo = vetor.normalized()
    pole = Vector((1, 0, 0))
    pole -= eixo * pole.dot(eixo)
    if pole.length < 1e-6:
        raise RuntimeError('Pole do joelho degenerado.')
    pole.normalize()
    u = (a*a-b*b+d*d)/(2*d)
    joelho = quadril + eixo*u + pole*max(0, a*a-u*u)**.5
    for osso, filho, direcao in [(coxa, canela, joelho-quadril), (canela, pe, alvo-joelho)]:
        direcao_rest = (filho.bone.head_local - osso.bone.head_local).normalized()
        orientar(osso.name, direcao_rest.rotation_difference(direcao.normalized()) @ rest[osso.name])
    # Sola sempre nivelada com a orientação mundial da guarda, inclusive no ar.
    orientar(pe.name, orientacoes_pes[lado])
    if (pe.head-alvo).length > 1e-5:
        raise RuntimeError(f'IK da perna {lado} não atingiu o alvo no quadro {q}.')


acao = bpy.data.actions.new('pipoca_marcha_ik_estudo_v9')
acao.use_fake_user = True
rig.animation_data.action = acao
amostras = [i*PASSO_AMOSTRA for i in range(int(DURACAO/PASSO_AMOSTRA)+1)]
anteriores = {}
for q in amostras:
    definir_quadro(q)
    restaurar()
    onda = sin(2*pi*q/DURACAO)
    # Luvas mantêm a guarda; movimentos secundários acompanham a passada.
    for nome, amplitude in [('braco_E', .018), ('braco_D', -.018),
                            ('antebraco_E', -.010), ('antebraco_D', .010)]:
        rig.pose.bones[nome].rotation_quaternion @= Quaternion(
            rest[nome].inverted() @ Vector((0, 1, 0)), amplitude*onda)
    for nome, amplitude, atraso in [('orelha_E', 2.5, .15), ('orelha_D', 2.0, -.10), ('cauda', 2.5, .25)]:
        eixo = Vector((0, 0, 1)) if nome == 'cauda' else Vector((0, 1, 0))
        rig.pose.bones[nome].rotation_quaternion @= Quaternion(
            rest[nome].inverted() @ eixo, amplitude*pi/180*sin(2*pi*q/DURACAO-atraso))
    bpy.context.view_layer.update()
    for lado in ['E', 'D']:
        resolver_perna(lado, trajetoria(q, lado)[0], q)
    for osso in rig.pose.bones:
        osso.rotation_quaternion.normalize()
        if osso.name in anteriores and anteriores[osso.name].dot(osso.rotation_quaternion) < 0:
            osso.rotation_quaternion.negate()
        anteriores[osso.name] = osso.rotation_quaternion.copy()
        osso.keyframe_insert(data_path='rotation_quaternion', frame=q, group=osso.name)
        osso.keyframe_insert(data_path='location', frame=q, group=osso.name)
for camada in acao.layers:
    for faixa in camada.strips:
        for bolsa in faixa.channelbags:
            for curva in bolsa.fcurves:
                for chave in curva.keyframe_points:
                    chave.interpolation = 'LINEAR'

# Verificar também entre as chaves de meio quadro. A raiz virtual serve só
# para medir apoio no mundo; o arquivo continua integralmente no lugar.
medidas = []
ancoras_mundo = {}
erro_max_apoio = 0
erro_max_altura = 0
erro_max_alvo = 0
erro_max_alvo_apoio = 0
erro_max_altura_apoio = 0
erro_max_orientacao = 0
for i in range(DURACAO*4+1):
    q = i*.25
    definir_quadro(q)
    bpy.context.view_layer.update()
    solas = {'E': float('inf'), 'D': float('inf')}
    deps = bpy.context.evaluated_depsgraph_get()
    for objeto in malhas:
        avaliado = objeto.evaluated_get(deps)
        malha = avaliado.to_mesh()
        try:
            if len(malha.vertices) != len(objeto.data.vertices):
                raise RuntimeError('Validação dos pés requer topologia preservada.')
            for lado in ['E', 'D']:
                indices = vertices_pes.get((objeto.name, lado), [])
                if indices:
                    solas[lado] = min(solas[lado], min((avaliado.matrix_world @ malha.vertices[n].co).z for n in indices))
        finally:
            avaliado.to_mesh_clear()
    registro = {'quadro': q, 'pes': {}}
    for lado in ['E', 'D']:
        alvo, apoiado, segmento, altura = trajetoria(q, lado)
        pe = rig.pose.bones[f'pe_{lado}']
        mundo = pe.head + Vector((q*VELOCIDADE, 0, 0))
        erro_alvo = (pe.head-alvo).length
        erro_max_alvo = max(erro_max_alvo, erro_alvo)
        erro_altura = abs(solas[lado]-altura)
        erro_max_altura = max(erro_max_altura, erro_altura)
        erro_orientacao = 1-abs(pe.matrix.to_quaternion().normalized().dot(orientacoes_pes[lado].normalized()))
        erro_max_orientacao = max(erro_max_orientacao, erro_orientacao)
        erro_apoio = 0
        if apoiado:
            chave = (lado, segmento)
            if chave not in ancoras_mundo:
                ancoras_mundo[chave] = mundo.copy()
            erro_apoio = (mundo-ancoras_mundo[chave]).length
            erro_max_apoio = max(erro_max_apoio, erro_apoio)
            erro_max_alvo_apoio = max(erro_max_alvo_apoio, erro_alvo)
            erro_max_altura_apoio = max(erro_max_altura_apoio, erro_altura)
        # Entre chaves, a curva de balanço é aproximada por quaternions lineares.
        # O apoio conserva 1 mm; no ar aceitar até 5 mm da trajetória ideal.
        limite = .001 if apoiado else .005
        if solas[lado] < -.001 or erro_altura > limite or erro_apoio > .001 or erro_alvo > limite:
            raise RuntimeError(f'Marcha fora da tolerância no quadro {q}, pé {lado}: sola={solas[lado]}, apoio={erro_apoio}, alvo={erro_alvo}, limite={limite}.')
        registro['pes'][lado] = {'apoio': apoiado, 'segmento': segmento, 'sola': solas[lado],
            'alturaEsperada': altura, 'pulsoPe': list(pe.head), 'mundoVirtual': list(mundo),
            'erroApoio': erro_apoio, 'erroAlvo': erro_alvo}
    medidas.append(registro)

rotacoes = {nome: [] for nome in ORDEM}
posicoes = {nome: [] for nome in ORDEM}
c = Matrix.Rotation(-pi/2, 4, 'X')
for q in amostras:
    definir_quadro(q)
    globais = {b.name: c @ b.matrix @ b.bone.matrix_local.inverted()
        @ Matrix.Translation(b.bone.head_local) @ c.inverted() for b in rig.pose.bones}
    for osso in rig.pose.bones:
        local = globais[osso.parent.name].inverted() @ globais[osso.name] if osso.parent else globais[osso.name]
        r = local.to_quaternion().normalized()
        anterior = rotacoes[osso.name][-4:]
        if anterior and sum(v*w for v, w in zip(anterior, [r.x, r.y, r.z, r.w])) < 0:
            r.negate()
        rotacoes[osso.name].extend([r.x, r.y, r.z, r.w])
        posicoes[osso.name].extend(local.to_translation())
canais = []
tempos = [q/60 for q in amostras]
for i, nome in enumerate(ORDEM):
    for tipo, valores, tamanho in [('rotation', rotacoes[nome], 4), ('translation', posicoes[nome], 3)]:
        inicio, fim = valores[:tamanho], valores[-tamanho:]
        sinal = -1 if tipo == 'rotation' and sum(a*b for a, b in zip(inicio, fim)) < 0 else 1
        if max(abs(a-sinal*b) for a, b in zip(inicio, fim)) > 1e-6:
            raise RuntimeError(f'Ciclo da marcha não fecha no osso {nome}.')
        if nome == 'quadril' and tipo == 'translation':
            for n in range(0, len(valores), 3):
                if abs(valores[n]) > 1e-5 or abs(valores[n+2]) > 1e-5:
                    raise RuntimeError('Marcha deslocou a raiz horizontalmente.')
        canais.append({'osso': i, 'tipo': tipo, 'tempos': tempos, 'valores': valores})
clip = {'nome': 'andando', 'duracaoQuadros': DURACAO, 'canais': canais}
(SAIDA/'andando-v9.json').write_text(json.dumps(clip, separators=(',', ':')), encoding='utf-8')
relatorio = {'versao': 9, 'aprovadoFinal': False, 'origem': 'Marcha autoral por IK sobre a guarda v4.',
    'sha256Simulacao': hashlib.sha256((RAIZ/'public/js/ko-sim.js').read_bytes()).hexdigest(),
    'duracaoQuadros': DURACAO, 'distanciaCiclo': DISTANCIA_CICLO, 'apoioQuadros': APOIO,
    'excursao': EXCURSAO, 'alturaBalanco': ALTURA_BALANCO, 'amostragemQuadros': PASSO_AMOSTRA,
    'centrosPeX': centros_x, 'raizHorizontalFixa': True,
    'validacao': {'amostrasPorPe': len(medidas), 'incluiQuartosDeQuadro': True,
        'erroMaximoApoioMundo': erro_max_apoio, 'erroMaximoAlturaSola': erro_max_altura,
        'erroMaximoAlvo': erro_max_alvo, 'erroMaximoAlvoApoio': erro_max_alvo_apoio,
        'erroMaximoAlturaSolaApoio': erro_max_altura_apoio,
        'erroMaximoOrientacaoQuaternion': erro_max_orientacao},
    'amostras': medidas,
    'limites': ['Arte provisória com pesos rígidos.', 'Corrida ainda usa o estudo anterior.',
        'A velocidade do pé muda entre apoio e balanço; suavidade visual ainda exige inspeção.',
        'Fase por distância requer integração visual; não há eventos de gameplay no clip.']}
(SAIDA/'marcha-relatorio-v9.json').write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding='utf-8')
cena.frame_start = 0
cena.frame_end = DURACAO
cena.render.fps = 60
definir_quadro(0)
cena['etapa'] = 'Marcha IK v9: apoio alternado e fase por distância; arte final pendente.'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SAIDA/'pipoca-marcha-v9.blend'), compress=True)
print('KO_MARCHA_V9 '+json.dumps({'duracao': DURACAO, 'distanciaCiclo': DISTANCIA_CICLO,
    'erroApoio': erro_max_apoio, 'erroSola': erro_max_altura}), flush=True)
if '--sem-render' not in sys.argv:
    cena.render.resolution_x = cena.render.resolution_y = 480
    cena.render.resolution_percentage = 100
    cena.eevee.taa_render_samples = 8
    cena.render.image_settings.file_format = 'PNG'
    pasta = SAIDA/'previa-marcha-v9'
    pasta.mkdir(exist_ok=True)
    for q in range(DURACAO+1):
        definir_quadro(q)
        cena.render.filepath = str(pasta/f'{q:03d}.png')
        bpy.ops.render.render(write_still=True)
