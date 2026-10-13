"""Pipoca v5 -> malha de jogo animável.

blender -b --python scripts/producao-3d/preparar-jogo-pipoca-v5.py [-- --sem-assar]

1. Corpo reduzido ao orçamento (simétrico); peças do rosto mantidas como
   geometria, reduzidas; unhas e etiqueta passam para a textura.
2. UV única com mais resolução na cabeça e nas orelhas.
3. Assado da v5 detalhada: cor (uniforme azul e vermelho), normal, rugosidade.
4. Esqueleto de 20 ossos (mesmos nomes de src/producao3d/rig.mjs) nas juntas
   medidas na v5; pesos automáticos no corpo, transferidos às peças do rosto.
5. Exporta malha.json + PNGs nos eixos do projeto: +Y para cima, frente +X,
   2,5 m da sola ao alto da cabeça (altura 60 px do motor / 24).
"""
from pathlib import Path
import hashlib
import json
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pipoca_v5_uv as UV
ROOT = HERE.parents[1]
SRC = ROOT/'art/premium/modelos-3d/estudos-mixamo/meshy-pipoca-v2/identidade-v5/pipoca-identidade-v5.blend'
OUT = ROOT/'art/premium/modelos-3d/estudos-mixamo/pipoca-v5-jogo'
ASSAR = '--sem-assar' not in sys.argv

CORPO_TRIS = 21000
# Limite do exportador: 2 MB por PNG. A normal guarda o relevo médio (os
# traços finos estão na cor), então 1024 basta; a cor fica em 2048.
TEX_COR, TEX_NORMAL, TEX_RUGOSIDADE = 2048, 1024, 1024
SOLA, TOPO_CABECA = -.951, .684          # z na v5: sola e alto do crânio
ESCALA = 2.5/(TOPO_CABECA-SOLA)
Y0 = -.01                                # pelve: frente/trás do centro do corpo

# Juntas medidas na v5 (Blender: z para cima, frente -y; +x = lado E da personagem).
JUNTAS = {'quadril': (0, -.01, -.05), 'tronco': (0, -.03, .10), 'peito': (0, -.03, .28),
          'cabeca': (0, -.005, .42), 'mandibula': (0, -.07, .47), 'cauda': (0, .11, .05)}
for lado, s in (('E', 1), ('D', -1)):
    JUNTAS |= {f'orelha_{lado}': (s*.05, -.06, .64),
               f'braco_{lado}': (s*.17, 0, .29), f'antebraco_{lado}': (s*.315, 0, .03),
               f'mao_{lado}': (s*.37, -.02, -.065), f'coxa_{lado}': (s*.11, -.02, -.07),
               f'canela_{lado}': (s*.168, .015, -.43), f'pe_{lado}': (s*.25, .055, -.79)}
# Mesma ordem e hierarquia de rig.mjs.
ORDEM = ['quadril', 'tronco', 'peito', 'cabeca', 'mandibula', 'orelha_E', 'orelha_D']
for lado in 'ED':
    ORDEM += [f'braco_{lado}', f'antebraco_{lado}', f'mao_{lado}', f'coxa_{lado}', f'canela_{lado}', f'pe_{lado}']
ORDEM.append('cauda')
PAI = {'quadril': None, 'tronco': 'quadril', 'peito': 'tronco', 'cabeca': 'peito', 'mandibula': 'cabeca',
       'orelha_E': 'cabeca', 'orelha_D': 'cabeca', 'cauda': 'quadril'}
for lado in 'ED':
    PAI |= {f'braco_{lado}': 'peito', f'antebraco_{lado}': f'braco_{lado}', f'mao_{lado}': f'antebraco_{lado}',
            f'coxa_{lado}': 'quadril', f'canela_{lado}': f'coxa_{lado}', f'pe_{lado}': f'canela_{lado}'}
# Pontas dos ossos sem filho direto (só orientam o osso no Blender).
PONTAS = {'cabeca': (0, -.05, .66), 'mandibula': (0, -.17, .44), 'cauda': (0, .19, .05)}
for lado, s in (('E', 1), ('D', -1)):
    PONTAS |= {f'orelha_{lado}': (s*.147, -.15, .948), f'mao_{lado}': (s*.43, -.03, -.16),
               f'pe_{lado}': (s*.25, -.18, -.90)}
FILHO = {'quadril': 'tronco', 'tronco': 'peito', 'peito': 'cabeca'}
for lado in 'ED':
    FILHO |= {f'braco_{lado}': f'antebraco_{lado}', f'antebraco_{lado}': f'mao_{lado}',
              f'coxa_{lado}': f'canela_{lado}', f'canela_{lado}': f'pe_{lado}'}

# Peças do rosto que ficam como geometria (fração de triângulos mantida).
GEOMETRIA = {'Esclera': .35, 'Íris': .3, 'Pupila': .3, 'Brilho': .08, 'Delineado': .6,
             'Pálpebra': .6, 'Sobrancelha': .7, 'Nariz': .12, 'Boca': .3, 'Filtro': .6, 'Lábio': .6}
FABRICS = ('Pipoca refinamento | Tecido índigo', 'Pipoca v5 | top esportivo índigo')
VERMELHO = ((.570, .022, .030, 1), (.610, .026, .034, 1))   # linear; sRGB ~ (.78,.16,.19)


def projeto(p):
    """Blender (v5) -> eixos do projeto, em metros de laboratório."""
    x, y, z = p
    return [-(y-Y0)*ESCALA, (z-SOLA)*ESCALA, -x*ESCALA]


def reduzir(obj, alvo_tris=None, fracao=None):
    tris = sum(len(p.vertices)-2 for p in obj.data.polygons)
    m = obj.modifiers.new('reduzir', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = min(1.0, alvo_tris/tris) if alvo_tris else fracao
    if abs(obj.matrix_world.translation.x) < 1e-6 and alvo_tris:
        m.use_symmetry, m.symmetry_axis = True, 'X'
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    for p in obj.data.polygons:
        p.use_smooth = True


def ativar(*objs):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def copiar(obj, nome):
    c = obj.copy()
    c.data = obj.data.copy()
    c.name = c.data.name = nome
    bpy.context.scene.collection.objects.link(c)
    with bpy.context.temp_override(object=c, active_object=c, selected_editable_objects=[c]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return c


def ilhas_uv(bm, uv):
    """Grupos de faces ligadas por arestas com a mesma UV dos dois lados."""
    vistos, grupos = set(), []
    for f in bm.faces:
        if f.index in vistos:
            continue
        grupo, fila = [], [f]
        vistos.add(f.index)
        while fila:
            g = fila.pop()
            grupo.append(g)
            for loop in g.loops:
                e = loop.edge
                for h in e.link_faces:
                    if h.index in vistos:
                        continue
                    a = [l for l in g.loops if l.edge == e][0]
                    b = [l for l in h.loops if l.edge == e][0]
                    pa = {a.vert.index: a[uv].uv.copy(), a.link_loop_next.vert.index: a.link_loop_next[uv].uv.copy()}
                    pb = {b.vert.index: b[uv].uv.copy(), b.link_loop_next.vert.index: b.link_loop_next[uv].uv.copy()}
                    if all((pa[k]-pb[k]).length < 1e-6 for k in pa):
                        vistos.add(h.index)
                        fila.append(h)
        grupos.append(grupo)
    return grupos


def desdobrar(obj):
    """Costuras planejadas (pipoca_v5_uv), mínimo estiramento, densidade
    igual, cabeça e rosto x2,2 (orelhas não: ocupavam o atlas), empacotar pelo contorno."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for tabela in (bm.verts, bm.edges, bm.faces):
        tabela.ensure_lookup_table()
    bm.normal_update()
    UV.marcar_costuras(bm, UV.partes_por_osso(obj, bm))
    bm.to_mesh(obj.data)
    bm.free()
    ativar(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.unwrap(method='MINIMUM_STRETCH', margin=.002)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode='OBJECT')
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    uv = bm.loops.layers.uv.active
    for grupo in ilhas_uv(bm, uv):
        if not .40 < np.mean([f.calc_center_median().z for f in grupo]) < .70:
            continue
        loops = [l for f in grupo for l in f.loops]
        c = sum((l[uv].uv for l in loops), Vector((0, 0)))/len(loops)
        for l in loops:
            l[uv].uv = c+(l[uv].uv-c)*2.2
    bm.to_mesh(obj.data)
    bm.free()
    ativar(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=.003, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def imagem(nome, tamanho, cor):
    img = bpy.data.images.new(nome, tamanho, tamanho, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB' if cor else 'Non-Color'
    return img


def assar(baixo, altos, tipo, img, filtro=None):
    mat = baixo.data.materials[0]
    no = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')
    no.image = img
    mat.node_tree.nodes.active = no
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 16
    b = sc.render.bake
    b.use_selected_to_active, b.cage_extrusion, b.max_ray_distance, b.margin = True, .006, .03, 12
    b.use_pass_direct = b.use_pass_indirect = False
    if filtro:
        b.use_pass_color = True
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in altos:
        o.hide_render = False
        o.select_set(True)
    baixo.select_set(True)
    bpy.context.view_layer.objects.active = baixo
    bpy.ops.object.bake(type=tipo, pass_filter=filtro or set(), use_selected_to_active=True,
                        cage_extrusion=.006, max_ray_distance=.03, margin=12, normal_space='TANGENT')


def salvar(img, caminho):
    """PNG RGB 8 bits, compressão máxima (sem perda: mesmos valores)."""
    s = bpy.context.scene.render.image_settings
    s.file_format, s.color_mode, s.color_depth, s.compression = 'PNG', 'RGB', '8', 100
    img.save_render(str(caminho), scene=bpy.context.scene)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SRC))
    corpo = bpy.data.objects['Pipoca v5 | corpo']
    pecas = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Pipoca identidade | V5')]
    altos = [corpo]+pecas
    for o in altos:
        o.hide_set(False)
        o.hide_render = False

    # 1. Malha de jogo.
    baixo = copiar(corpo, 'Pipoca v5 | jogo')
    baixo.data.materials.clear()
    reduzir(baixo, alvo_tris=CORPO_TRIS)
    rosto = []
    for o in pecas:
        chave = next((k for k in GEOMETRIA if k in o.name), None)
        if chave is None:
            continue           # unhas e etiqueta: só no assado
        c = copiar(o, 'jogo '+o.name.split('V5 ')[-1])
        c.data.materials.clear()
        reduzir(c, fracao=GEOMETRIA[chave])
        rosto.append(c)

    # 4a. Esqueleto (antes de unir: pesos automáticos só no corpo).
    arm_data = bpy.data.armatures.new('Pipoca v5 | esqueleto')
    arm = bpy.data.objects.new('Pipoca v5 | esqueleto', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    ativar(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    for nome in ORDEM:
        b = arm_data.edit_bones.new(nome)
        b.head = Vector(JUNTAS[nome])
        b.tail = Vector(JUNTAS[FILHO[nome]] if nome in FILHO else PONTAS[nome])
    for nome in ORDEM:
        if PAI[nome]:
            arm_data.edit_bones[nome].parent = arm_data.edit_bones[PAI[nome]]
    bpy.ops.object.mode_set(mode='OBJECT')
    ativar(arm, baixo)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    # 4b. Peças do rosto: pesos do corpo mais próximo (o calor dos ossos falha
    # em peças soltas sobre a pele).
    for c in rosto:
        for nome in ORDEM:
            c.vertex_groups.new(name=nome)
        m = c.modifiers.new('pesos', 'DATA_TRANSFER')
        m.object, m.use_vert_data = baixo, True
        m.data_types_verts = {'VGROUP_WEIGHTS'}
        m.vert_mapping = 'POLYINTERP_NEAREST'
        ativar(c)
        bpy.ops.object.modifier_apply(modifier=m.name)

    # Uma malha só: corpo + rosto.
    ativar(baixo, *rosto)
    bpy.ops.object.join()
    ativar(baixo)
    # Transições largas entre ossos: com o calor puro o joelho dobrado vincava
    # (beliscão atrás da junta).
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=.5, repeat=4)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)

    # 2. UV.
    desdobrar(baixo)

    # 3. Assado.
    mat = bpy.data.materials.new('assado')
    mat.use_nodes = True
    mat.node_tree.nodes.new('ShaderNodeTexImage')
    baixo.data.materials.append(mat)
    imagens = {}
    if ASSAR:
        imagens['cor_azul'] = imagem('cor_azul', TEX_COR, True)
        assar(baixo, altos, 'DIFFUSE', imagens['cor_azul'], {'COLOR'})
        imagens['normal'] = imagem('normal', TEX_NORMAL, False)
        assar(baixo, altos, 'NORMAL', imagens['normal'])
        imagens['rugosidade'] = imagem('rugosidade', TEX_RUGOSIDADE, False)
        assar(baixo, altos, 'ROUGHNESS', imagens['rugosidade'])
        for nome in FABRICS:
            ramp = next(n for n in bpy.data.materials[nome].node_tree.nodes if n.name == 'Color Ramp')
            for el, cor in zip(ramp.color_ramp.elements, VERMELHO):
                el.color = cor
        imagens['cor_vermelha'] = imagem('cor_vermelha', TEX_COR, True)
        assar(baixo, altos, 'DIFFUSE', imagens['cor_vermelha'], {'COLOR'})
        for nome, img in imagens.items():
            salvar(img, OUT/f'{nome}.png')

    # 5. Exportar.
    me = baixo.data
    me.calc_loop_triangles()
    uvl = me.uv_layers.active.data
    grupos = {g.index: g.name for g in baixo.vertex_groups}
    pesos_v = []
    for v in me.vertices:
        par = sorted(((g.weight, ORDEM.index(grupos[g.group])) for g in v.groups if g.weight > 1e-4), reverse=True)[:4]
        total = sum(w for w, _ in par) or 1
        par += [(0, 0)]*(4-len(par))
        pesos_v.append(([j for _, j in par], [w/total for w, _ in par]))
    chave, posicoes, normais, uvs, juntas, pesos, indices = {}, [], [], [], [], [], []
    for tri in me.loop_triangles:
        for li in tri.loops:
            vi = me.loops[li].vertex_index
            u, v = uvl[li].uv
            k = (vi, round(u, 6), round(v, 6))
            if k not in chave:
                chave[k] = len(chave)
                posicoes += projeto(me.vertices[vi].co)
                n = me.loops[li].normal
                normais += [-n.y, n.z, -n.x]
                uvs += [u, 1-v]                   # glTF: v para baixo
                juntas += pesos_v[vi][0]
                pesos += pesos_v[vi][1]
            indices.append(chave[k])
    ossos = [{'nome': n, 'pai': ORDEM.index(PAI[n]) if PAI[n] else None, 'mundo': projeto(JUNTAS[n])} for n in ORDEM]
    sem_peso = sum(1 for j, w in pesos_v if not any(w))
    dados = {'escala': ESCALA, 'origem': {'sola': SOLA, 'y0': Y0}, 'ossos': ossos,
             'posicoes': [round(x, 6) for x in posicoes], 'normais': [round(x, 5) for x in normais],
             'uvs': [round(x, 6) for x in uvs], 'juntas': juntas, 'pesos': [round(x, 5) for x in pesos],
             'indices': indices}
    texto = json.dumps(dados, separators=(',', ':'))
    (OUT/'malha.json').write_text(texto, encoding='utf8')
    relatorio = {'fonte': str(SRC.relative_to(ROOT)), 'sha256Fonte': hashlib.sha256(SRC.read_bytes()).hexdigest(),
                 'triangulos': len(indices)//3, 'vertices': len(posicoes)//3, 'ossos': len(ossos),
                 'verticesSemPeso': sem_peso, 'escala': ESCALA,
                 'texturas': {n: (img.size[0], img.size[1]) for n, img in imagens.items()},
                 'sha256Malha': hashlib.sha256(texto.encode()).hexdigest()}
    (OUT/'relatorio.json').write_text(json.dumps(relatorio, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pipoca-v5-jogo.blend'))
    print('PIPOCA_V5_JOGO', json.dumps(relatorio, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
