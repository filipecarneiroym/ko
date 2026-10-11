"""Chutes autorais por IK sobre a guarda v4; --forte produz k2 sem alterar k1.

k1: dois chutes médios (perna E na janela 1, perna D na janela 2) contra a caixa
    [4,-30,30,12] do motor (0,75 m a 1,25 m de altura, ~1,42 m à frente).
k2: um chute alto que lança (perna E), caixa [2,-46,32,18] (1,17 m a 1,92 m).

O impulso vem do quadril (translado dentro da raiz, nunca a raiz jogável) e a
perna de apoio é resolvida por IK de volta à âncora, como na marcha.
"""
from pathlib import Path
from math import pi, sin, sqrt
import hashlib
import json
import sys
import bpy
from mathutils import Matrix, Quaternion, Vector

raiz = Path(__file__).resolve().parents[2]
saida = raiz / 'art/premium/modelos-3d/estudos-mixamo'
bpy.ops.wm.open_mainfile(filepath=str(saida / 'pipoca-boxing-guarda-v4.blend'))
cena = bpy.context.scene
rig = bpy.data.objects['lutador']
cena.frame_set(1)
base = {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in rig.pose.bones}
rest = {b.name: b.bone.matrix_local.to_quaternion() for b in rig.pose.bones}
ordem = ['quadril', 'tronco', 'peito', 'cabeca', 'mandibula', 'orelha_E', 'orelha_D',
         'braco_E', 'antebraco_E', 'mao_E', 'coxa_E', 'canela_E', 'pe_E',
         'braco_D', 'antebraco_D', 'mao_D', 'coxa_D', 'canela_D', 'pe_D', 'cauda']
contrato = json.loads((raiz / 'art/premium/modelos-3d/contrato.json').read_text(encoding='utf-8'))
forte = '--forte' in sys.argv
nome_clip, versao, nome_arquivo = ('k2', 12, 'chute-forte') if forte else ('k1', 11, 'chute')
golpe = next(l for l in contrato['lutadores'] if l['id'] == 'pipoca')['golpes'][nome_clip]
duracao = golpe['duracaoQuadros']
janelas = [list(j) for j in golpe['janelasAtivas']]
if (duracao, janelas) != ((28, [[7, 10]]) if forte else (24, [[6, 8], [12, 14]])):
    raise RuntimeError('Revisar o chute para os novos tempos do motor.')
bpy.context.view_layer.update()
ancoras = {lado: rig.pose.bones[f'pe_{lado}'].head.copy() for lado in ['E', 'D']}
# Orientação mundial dos pés na guarda: o apoio mantém a sola nivelada como na
# marcha v9 (molde validado), e o chute gira do repouso até o alvo pela diagonal
# local medida no importador (dedo_mundo_rest).
orientacoes_pes = {lado: rig.pose.bones[f'pe_{lado}'].matrix.to_quaternion().copy() for lado in ['E', 'D']}
# Direção local do dedo do pé medida no importador real (probe-pes2): o pé
# estende numa diagonal do frame do osso (não num eixo puro nem no tail).
# (x, y, z) no frame Blender, após conversão glTF -> Blender.
dedo_local = {'E': Vector((0.9677, 0.2059, 0.1456)), 'D': Vector((0.9489, 0.2808, 0.1437))}
dedo_mundo_rest = {lado: (orientacoes_pes[lado].to_matrix() @ dedo_local[lado]).normalized() for lado in ['E', 'D']}
coxaE, canelaE, peE = (rig.pose.bones[n] for n in ['coxa_E', 'canela_E', 'pe_E'])
L = (canelaE.bone.head_local - coxaE.bone.head_local).length + (peE.bone.head_local - canelaE.bone.head_local).length

def orientar(nome, desejada):
    b = rig.pose.bones[nome]
    b.rotation_quaternion = rest[nome].inverted() @ rest[b.parent.name] @ b.parent.matrix.to_quaternion().inverted() @ desejada
    bpy.context.view_layer.update()

def suave(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)

def resolver(lado, alvo, polo):
    # IK de dois segmentos (coxa/canela) levando o cabeçote do pé a `alvo`.
    coxa, canela, pe = (rig.pose.bones[f'{n}_{lado}'] for n in ['coxa', 'canela', 'pe'])
    h = coxa.head.copy()
    eixo = (alvo - h).normalized(); d = (alvo - h).length
    a = (canela.bone.head_local - coxa.bone.head_local).length
    b = (pe.bone.head_local - canela.bone.head_local).length
    if not abs(a - b) + 1e-5 < d < a + b - 1e-5:
        raise RuntimeError(f'{nome_clip} fora do alcance no quadro {cena.frame_current}: {d:.4f}, limite {a + b:.4f}. '
                           f'h={tuple(round(v,3) for v in h)} alvo={tuple(round(v,3) for v in alvo)} '
                           f'ancora={tuple(round(v,3) for v in ancoras.get(lado, Vector()))}')
    p = polo - eixo * polo.dot(eixo)
    if p.length < 1e-6:
        p = Vector((0, 0, 1))
    p.normalize()
    u = (a * a - b * b + d * d) / (2 * d)
    joelho = h + eixo * u + p * max(0.0, a * a - u * u) ** .5
    for nome, direcao in [(f'coxa_{lado}', joelho - h), (f'canela_{lado}', alvo - joelho)]:
        osso = rig.pose.bones[nome]
        filho = canela if nome.startswith('coxa') else pe
        direcao_rest = (filho.bone.head_local - osso.bone.head_local).normalized()
        orientar(nome, direcao_rest.rotation_difference(direcao.normalized()) @ rest[nome])

def perfil(q, de, ate, preparo, stick, retorno):
    # Sem recolho negativo: a perna de apoio nunca descola do chão.
    rs = de - preparo
    if q <= rs:
        return 0.0
    if q < de:
        return suave((q - rs) / preparo)
    if q <= ate + stick:
        return 1.0
    if q < ate + stick + retorno:
        return 1.0 - suave((q - ate - stick) / retorno)
    return 0.0

def definir_quadro(q):
    cena.frame_set(int(q), subframe=q-int(q))
    bpy.context.view_layer.update()

# Janela, lado que chuta, preparo, stick, retorno e alcance do tornozelo (x, z) no contato.
janelas_perfil = ([(7, 10, 'E', 3, 2, 7, (.90, 1.38))] if forte
                  else [(6, 8, 'E', 2, 0, 2, (.96, .90)), (12, 14, 'D', 2, 0, 2, (.90, .90))])
empuxo_max = 0.14 if forte else 0.13
inclinacao = 0.11 if forte else 0.06
yaw_max = 0.25
pitch_pe = -.10 if forte else .14
polo_chute = {'E': Vector((0.0, .55, -.30)), 'D': Vector((0.0, -.55, -.30))}
polo_apoio = {'E': Vector((.15, .18, -.60)), 'D': Vector((.15, -.18, -.60))}

acao = bpy.data.actions.new(f'pipoca_{nome_arquivo.replace("-", "_")}_estudo_v{versao}')
acao.use_fake_user = True
rig.animation_data.action = acao
medidas = []
amostras = [i * .5 for i in range(duracao * 2 + 1)]
for q in amostras:
    definir_quadro(q)
    for nome, (rot, pos) in base.items():
        b = rig.pose.bones[nome]
        b.rotation_quaternion = rot.copy(); b.location = pos.copy()
    e = 0.0; chute = None; de_ativo = None
    for (de, ate, lado, preparo, stick, retorno, _alcance) in janelas_perfil:
        v = perfil(q, de, ate, preparo, stick, retorno)
        if v > e:
            e, chute, de_ativo = v, lado, de
    empuxo = empuxo_max * e
    yaw = (yaw_max if chute == 'D' else -yaw_max) * e
    if empuxo or yaw:
        quadril = rig.pose.bones['quadril']
        quadril.location.x = base['quadril'][1].x + empuxo
        if yaw:
            quadril.rotation_quaternion @= Quaternion(rest['quadril'].inverted() @ Vector((0, 0, 1)), yaw)
    tronco = rig.pose.bones['tronco']
    tronco.rotation_quaternion @= Quaternion(rest['tronco'].inverted() @ Vector((0, 1, 0)), -inclinacao * e)
    bpy.context.view_layer.update()
    for nome in ['orelha_E', 'orelha_D']:
        o = rig.pose.bones[nome]
        o.rotation_quaternion @= Quaternion(rest[nome].inverted() @ Vector((0, 1, 0)), -4 * pi / 180 * sin(pi * e))
    bpy.context.view_layer.update()
    alvo = None
    if e > 0 and chute:
        apoio = 'D' if chute == 'E' else 'E'
        resolver(apoio, ancoras[apoio], polo_apoio[apoio])
        # Apoio com a sola nivelada na orientação mundial da guarda (molde v9).
        orientar(f'pe_{apoio}', orientacoes_pes[apoio])
        coxa = rig.pose.bones[f'coxa_{chute}']
        h = coxa.head.copy()
        alcance = next(a for (_de, _ate, _, __, ___, ____, a) in janelas_perfil if _de == de_ativo)
        pe_inicial = ancoras[chute]
        contato = Vector((alcance[0], h.y, alcance[1]))
        alvo = pe_inicial.lerp(contato, e)
        resolver(chute, alvo, polo_chute[chute])
        # Chute: da diagonal local do dedo medida no importador, gira o pé do
        # repouso (rotação mínima) até o dedo apontar (1, 0, pitch) no mundo.
        desejado = Vector((1.0, 0.0, pitch_pe)).normalized()
        orientar(f'pe_{chute}', dedo_mundo_rest[chute].rotation_difference(desejado) @ orientacoes_pes[chute])
    for lado in ['E', 'D']:
        pe = rig.pose.bones[f'pe_{lado}']
        esperado = (alvo if (e > 0 and chute and lado == chute) else ancoras[lado])
        if (pe.head - esperado).length > .001:
            raise RuntimeError('Pé fora do alvo ou da âncora no chute.')
    for osso in rig.pose.bones:
        osso.rotation_quaternion.normalize()
        osso.keyframe_insert(data_path='rotation_quaternion', frame=q, group=osso.name)
        osso.keyframe_insert(data_path='location', frame=q, group=osso.name)
    medidas.append({'quadro': q, 'extensao': e, 'chute': chute or 'guarda',
                    'pes': {lado: list(rig.pose.bones[f'pe_{lado}'].head) for lado in ['E', 'D']}})

for camada in acao.layers:
    for faixa in camada.strips:
        for bolsa in faixa.channelbags:
            for curva in bolsa.fcurves:
                for chave in curva.keyframe_points:
                    chave.interpolation = 'LINEAR'
rotacoes = {n: [] for n in ordem}; posicoes = {n: [] for n in ordem}
c = Matrix.Rotation(-pi / 2, 4, 'X')
for q in amostras:
    definir_quadro(q)
    globais = {b.name: c @ b.matrix @ b.bone.matrix_local.inverted() @ Matrix.Translation(b.bone.head_local) @ c.inverted() for b in rig.pose.bones}
    for b in rig.pose.bones:
        local = globais[b.parent.name].inverted() @ globais[b.name] if b.parent else globais[b.name]
        r = local.to_quaternion().normalized()
        anterior = rotacoes[b.name][-4:]
        if anterior and sum(v * w for v, w in zip(anterior, [r.x, r.y, r.z, r.w])) < 0:
            r.negate()
        rotacoes[b.name].extend([r.x, r.y, r.z, r.w]); posicoes[b.name].extend(local.to_translation())
canais = []
tempos = [q / 60 for q in amostras]
for i, nome in enumerate(ordem):
    canais.append({'osso': i, 'tipo': 'rotation', 'tempos': tempos, 'valores': rotacoes[nome]})
    canais.append({'osso': i, 'tipo': 'translation', 'tempos': tempos, 'valores': posicoes[nome]})
clip = {'nome': nome_clip, 'duracaoQuadros': duracao, 'canais': canais}
(saida / f'{nome_arquivo}-v{versao}.json').write_text(json.dumps(clip, separators=(',', ':')), encoding='utf-8')
relatorio = {'versao': versao, 'aprovadoFinal': False,
    'origem': 'Chute animado por IK sobre a guarda Mixamo, com impulso do quadril dentro da raiz; não é outro clip baixado.',
    'sha256Simulacao': hashlib.sha256((raiz / 'public/js/ko-sim.js').read_bytes()).hexdigest(),
    'duracaoQuadros': duracao, 'janelaContato': janelas, 'comprimentoPerna': round(L, 4),
    'amostras': medidas,
    'limites': ['Contato visual inicial; ainda exige revisar alcance com caixas na arena.',
        'Perna de apoio e recuperação exigem inspeção visual.', 'Demais golpes continuam estudos anteriores.']}
(saida / f'{nome_arquivo}-relatorio-v{versao}.json').write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding='utf-8')
cena.frame_start = 0; cena.frame_end = duracao; cena.render.fps = 60
cena.frame_set(0)
cena['etapa'] = f'{nome_clip} v{versao}, contato {janelas}; estudo técnico, arte final pendente.'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(saida / f'pipoca-{nome_arquivo}-v{versao}.blend'), compress=True)
print(f'KO_CHUTE_V{versao} ' + json.dumps({'clip': nome_clip, 'duracao': duracao, 'contato': janelas, 'perna': L}, ensure_ascii=False), flush=True)
if '--sem-render' not in sys.argv:
    cena.render.resolution_x = cena.render.resolution_y = 480
    cena.render.resolution_percentage = 100; cena.eevee.taa_render_samples = 8
    pasta = saida / f'previa-{nome_arquivo}-v{versao}'; pasta.mkdir(exist_ok=True)
    for q in range(duracao + 1):
        cena.frame_set(q); cena.render.filepath = str(pasta / f'{q:03d}.png')
        bpy.ops.render.render(write_still=True)