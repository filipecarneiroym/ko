"""Posturas autorais sobre a guarda v4; sem trajetória vertical da raiz.

Blender background, --threads 2. Agachar/defender/pousar mantêm as solas;
o pulo só recolhe os membros, pois a trajetória pertence ao KOSim.
"""
from pathlib import Path
from math import pi, sin
import hashlib
import json
import bpy
from mathutils import Matrix, Quaternion, Vector

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / 'art/premium/modelos-3d/estudos-mixamo'
bpy.ops.wm.open_mainfile(filepath=str(SAIDA / 'pipoca-boxing-guarda-v4.blend'))
cena = bpy.context.scene
rig = bpy.data.objects['lutador']
cena.frame_set(1)
bpy.context.view_layer.update()
ORDEM = ['quadril', 'tronco', 'peito', 'cabeca', 'mandibula', 'orelha_E', 'orelha_D',
         'braco_E', 'antebraco_E', 'mao_E', 'coxa_E', 'canela_E', 'pe_E',
         'braco_D', 'antebraco_D', 'mao_D', 'coxa_D', 'canela_D', 'pe_D', 'cauda']
base = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in rig.pose.bones}
rest = {b.name: b.bone.matrix_local.to_quaternion() for b in rig.pose.bones}
orientacoes = {b.name: b.matrix.to_quaternion().copy() for b in rig.pose.bones}
pes = {lado: rig.pose.bones[f'pe_{lado}'].head.copy() for lado in ['E', 'D']}
direcoes, polos = {}, {}
for lado in ['E', 'D']:
    coxa, canela, pe = [rig.pose.bones[f'{n}_{lado}'] for n in ['coxa', 'canela', 'pe']]
    eixo = (pe.head - coxa.head).normalized()
    dobra = canela.head - coxa.head
    polos[lado] = (dobra - eixo * dobra.dot(eixo)).normalized()
    direcoes[coxa.name] = (canela.head - coxa.head).normalized()
    direcoes[canela.name] = (pe.head - canela.head).normalized()


def suave(t):
    t = max(0., min(1., t))
    return t*t*(3-2*t)


def quadro(q):
    cena.frame_set(int(q), subframe=q-int(q))


def restaurar():
    for nome, (rot, pos) in base.items():
        b = rig.pose.bones[nome]
        b.rotation_quaternion = rot.copy()
        b.location = pos.copy()
    bpy.context.view_layer.update()


def orientar(nome, desejada):
    b = rig.pose.bones[nome]
    b.rotation_quaternion = rest[nome].inverted() @ rest[b.parent.name] @ b.parent.matrix.to_quaternion().inverted() @ desejada
    bpy.context.view_layer.update()


def perna(lado, alvo, peso):
    coxa, canela, pe = [rig.pose.bones[f'{n}_{lado}'] for n in ['coxa', 'canela', 'pe']]
    h = coxa.head.copy()
    eixo = (alvo-h).normalized()
    d = (alvo-h).length
    a = (canela.bone.head_local-coxa.bone.head_local).length
    b = (pe.bone.head_local-canela.bone.head_local).length
    if not abs(a-b)+1e-5 < d < a+b-1e-5:
        raise RuntimeError(f'Postura fora do alcance da perna {lado}: {d} / {a+b}')
    # O pé traseiro pode ficar atrás do quadril no agachamento. Projetar só
    # +X nesse eixo aponta a dobra para baixo e enterra o joelho no piso.
    # O componente vertical conduz a flexão para cima sem trocar de ramo
    # da solução de IK abruptamente durante o pouso ou o salto.
    polo = polos[lado].lerp(Vector((.55, 0, 1)).normalized(), suave(peso))
    polo -= eixo*polo.dot(eixo)
    polo.normalize()
    u = (a*a-b*b+d*d)/(2*d)
    joelho = h+eixo*u+polo*max(0, a*a-u*u)**.5
    for nome, direcao in [(coxa.name, joelho-h), (canela.name, alvo-joelho)]:
        orientar(nome, direcoes[nome].rotation_difference(direcao.normalized()) @ orientacoes[nome])
    orientar(pe.name, orientacoes[pe.name])


def proteger(lado, alvo):
    braco, antebraco, mao = [rig.pose.bones[f'{n}_{lado}'] for n in ['braco', 'antebraco', 'mao']]
    h = braco.head.copy()
    eixo = (alvo-h).normalized()
    d = (alvo-h).length
    a = (antebraco.bone.head_local-braco.bone.head_local).length
    b = (mao.bone.head_local-antebraco.bone.head_local).length
    if not abs(a-b)+1e-5 < d < a+b-1e-5:
        raise RuntimeError(f'Luva fora do alcance na defesa baixa: {d} / {a+b}')
    pole = Vector((-.05, .1 if lado == 'E' else -.1, -.5))
    pole -= eixo*pole.dot(eixo)
    pole.normalize()
    u = (a*a-b*b+d*d)/(2*d)
    cotovelo = h+eixo*u+pole*max(0, a*a-u*u)**.5
    for osso, filho, direcao in [(braco, antebraco, cotovelo-h), (antebraco, mao, alvo-cotovelo)]:
        direcao_rest = (filho.bone.head_local-osso.bone.head_local).normalized()
        orientar(osso.name, direcao_rest.rotation_difference(direcao.normalized()) @ rest[osso.name])
    orientar(mao.name, antebraco.matrix.to_quaternion() @ rest[antebraco.name].inverted() @ rest[mao.name])


def definir(nome, q):
    restaurar()
    onda = sin(2*pi*q/60)
    if nome in ['agachado', 'defesaBaixa']:
        flexao = 1.
    elif nome == 'pousando':
        flexao = .32*(1-suave(q/4))
    else:
        flexao = 0.
    quadril = rig.pose.bones['quadril']
    # Converter o deslocamento desejado para o referencial local do osso.
    quadril.location += rest['quadril'].inverted() @ Vector((-.08*flexao, 0, -.56*flexao))
    bpy.context.view_layer.update()
    tronco = rig.pose.bones['tronco']
    orientar('tronco', Quaternion((0, 1, 0), .22*flexao) @ tronco.matrix.to_quaternion())
    cabeca = rig.pose.bones['cabeca']
    orientar('cabeca', Quaternion((0, 1, 0), -.13*flexao) @ cabeca.matrix.to_quaternion())
    if nome == 'pulo':
        recolho = suave(q/8)*(1-suave((q-28)/16))
    else:
        recolho = 0.
    for lado in ['E', 'D']:
        alvo = pes[lado].copy()
        alvo.z += (.25 if lado == 'E' else .16)*recolho
        alvo.x -= (.10 if lado == 'E' else .06)*recolho
        perna(lado, alvo, max(flexao, recolho))
    if nome == 'defesaBaixa':
        h = rig.pose.bones['cabeca'].head.copy()
        proteger('E', h+Vector((.42, .24, -.15+.006*onda)))
        proteger('D', h+Vector((.40, -.24, -.17+.006*onda)))
    for n, amp in [('orelha_E', .035), ('orelha_D', .028), ('cauda', .035)]:
        atraso = -.09*recolho if nome == 'pulo' else amp*onda if nome != 'pousando' else -.045*flexao
        rig.pose.bones[n].rotation_quaternion @= Quaternion(rest[n].inverted() @ Vector((0, 1, 0)), atraso)
    bpy.context.view_layer.update()


def extrair(nome, duracao):
    tempos = [i*.5/60 for i in range(duracao*2+1)]
    rotacoes, posicoes = {n: [] for n in ORDEM}, {n: [] for n in ORDEM}
    conversao = Matrix.Rotation(-pi/2, 4, 'X')
    for i in range(duracao*2+1):
        quadro(i*.5)
        globais = {b.name: conversao @ b.matrix @ b.bone.matrix_local.inverted() @ Matrix.Translation(b.bone.head_local) @ conversao.inverted() for b in rig.pose.bones}
        for b in rig.pose.bones:
            local = globais[b.parent.name].inverted() @ globais[b.name] if b.parent else globais[b.name]
            r = local.to_quaternion().normalized()
            valores = [r.x, r.y, r.z, r.w]
            anterior = rotacoes[b.name][-4:]
            if anterior and sum(v*w for v, w in zip(anterior, valores)) < 0:
                valores = [-v for v in valores]
            rotacoes[b.name].extend(valores)
            posicoes[b.name].extend(local.to_translation())
    canais = []
    for i, n in enumerate(ORDEM):
        canais.append({'osso': i, 'tipo': 'rotation', 'tempos': tempos, 'valores': rotacoes[n]})
        canais.append({'osso': i, 'tipo': 'translation', 'tempos': tempos, 'valores': posicoes[n]})
    return {'nome': nome, 'duracaoQuadros': duracao, 'canais': canais}


clips, medidas = [], []
for nome, duracao in [('agachado', 60), ('defesaBaixa', 60), ('pulo', 44), ('pousando', 4)]:
    acao = bpy.data.actions.new('pipoca_'+nome+'_v14')
    acao.use_fake_user = True
    rig.animation_data.action = acao
    for i in range(duracao*2+1):
        q = i*.5
        quadro(q)
        definir(nome, q)
        for b in rig.pose.bones:
            b.rotation_quaternion.normalize()
            b.keyframe_insert(data_path='rotation_quaternion', frame=q, group=b.name)
            b.keyframe_insert(data_path='location', frame=q, group=b.name)
    for camada in acao.layers:
        for faixa in camada.strips:
            for bolsa in faixa.channelbags:
                for curva in bolsa.fcurves:
                    for chave in curva.keyframe_points:
                        chave.interpolation = 'LINEAR'
    erro_apoio = 0.
    altura_joelho = float('inf')
    for i in range(duracao*4+1):
        quadro(i*.25)
        bpy.context.view_layer.update()
        for lado in ['E', 'D']:
            altura_joelho = min(altura_joelho, rig.pose.bones[f'canela_{lado}'].head.z)
        if nome != 'pulo':
            for lado in ['E', 'D']:
                erro_apoio = max(erro_apoio, (rig.pose.bones[f'pe_{lado}'].head-pes[lado]).length)
    if erro_apoio > .001:
        raise RuntimeError(f'{nome} deslocou apoio: {erro_apoio}')
    if altura_joelho < .15:
        raise RuntimeError(f'{nome} conduziu o joelho ao piso: {altura_joelho}')
    clips.append(extrair(nome, duracao))
    medidas.append({'clip': nome, 'duracaoQuadros': duracao, 'erroMaximoAncoraEntreChaves': erro_apoio,
                    'alturaMinimaJoelho': altura_joelho})

fonte = {'versao': 14, 'aprovadoFinal': False, 'clips': clips}
(SAIDA/'posturas-v14.json').write_text(json.dumps(fonte, separators=(',', ':')), encoding='utf-8')
relatorio = {'versao': 14, 'aprovadoFinal': False, 'sha256Simulacao': hashlib.sha256((RAIZ/'public/js/ko-sim.js').read_bytes()).hexdigest(),
             'origem': 'Posturas autorais por IK sobre a guarda v4; sem movimento vertical de gameplay.',
             'amostras': medidas, 'limites': ['Exige revisão da malha atual, roupa e transições no importador real.']}
(SAIDA/'posturas-relatorio-v14.json').write_text(json.dumps(relatorio, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
cena.frame_start = 0
cena.frame_end = 44
cena.render.fps = 60
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SAIDA/'pipoca-posturas-v14.blend'), compress=True)
print('KO_POSTURAS_V14 '+json.dumps(medidas), flush=True)
