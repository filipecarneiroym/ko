"""Arenas realistas: recursos Poly Haven (CC0) prontos para o jogo.

blender -b --python scripts/producao-3d/preparar-arena.py -- <arena>

- Objetos reduzidos (triângulos alvo), texturas a 512 px, GLB em public/arenas/<arena>.
  Na neve, a cor recebe neve por cima (assada).
- Fundo 360° (foto tonemapped, 4096x2048) e luz ambiente HDR 1k.
- Chão: cor, normal e rugosidade a 1k.
"""
from pathlib import Path
import json
import sys
import urllib.request

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

ARENAS = {
    'neve': dict(hdri='snowy_forest_path_01', chao='snow_02',
                 modelos={'boulder_01': 2500, 'tree_stump_01': 2500}, neve=True),
    'academia': dict(hdri='basement_boxing_ring', chao='rubber_tiles', modelos={}),
    'praia': dict(hdri='umhlanga_sunrise', chao='coast_sand_01', modelos={'boulder_01': 2500}),
    'telhado': dict(hdri='rooftop_night', chao='concrete_floor_02',
                    modelos={'exterior_aircon_unit': 4000, 'modular_airduct_circular_01': 3000}),
    'floresta': dict(hdri='forest_slope', chao='forest_leaves_02',
                     modelos={'tree_stump_02': 3000, 'rock_moss_set_01': 4000, 'fern_02': 3000}),
    'feira': dict(hdri='outdoor_umbrellas', chao='cobblestone_floor_04',
                  modelos={'wooden_crate_01': 1500, 'Barrel_01': 2000}),
}


def triangulos(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def reduzir(obj, alvo):
    # Repete: o Decimate de uma passada fica acima do alvo em malhas com
    # costuras de UV (a pedra parava em 26 mil).
    for _ in range(4):
        tris = triangulos(obj)
        if tris <= alvo * 1.1:
            break
        # Costuras de UV travam o colapso: solta-as de vez quando ele empaca.
        if _ >= 1:
            m = obj.modifiers.new('fundir', 'WELD')
            m.merge_threshold = .002
            with bpy.context.temp_override(object=obj, active_object=obj):
                bpy.ops.object.modifier_apply(modifier=m.name)
        m = obj.modifiers.new('reduzir', 'DECIMATE')
        m.ratio = max(.02, alvo / tris)
        m.use_collapse_triangulate = True
        with bpy.context.temp_override(object=obj, active_object=obj):
            bpy.ops.object.modifier_apply(modifier=m.name)
    return triangulos(obj)


def nevar(mat):
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        return
    entrada = bsdf.inputs['Base Color']
    origem = entrada.links[0].from_socket if entrada.is_linked else None
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    rampa = nt.nodes.new('ShaderNodeMapRange')
    rampa.inputs['From Min'].default_value = .4
    rampa.inputs['From Max'].default_value = .65
    nt.links.new(sep.outputs['Z'], rampa.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    a = next(s for s in mix.inputs if s.name == 'A' and s.type == 'RGBA')
    b = next(s for s in mix.inputs if s.name == 'B' and s.type == 'RGBA')
    b.default_value = (.92, .95, 1.0, 1)
    if origem:
        nt.links.new(origem, a)
    nt.links.new(rampa.outputs['Result'], mix.inputs['Factor'])
    nt.links.new(next(s for s in mix.outputs if s.type == 'RGBA'), entrada)
    # Assa a cor com neve numa textura nova (o glTF não leva nós).
    img = bpy.data.images.new(f'{mat.name}_neve', 512, 512)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex
    return tex


def preparar_modelo(fontes, saida, ident, alvo, neve):
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(fontes/ident/f'{ident}_1k.gltf'))
    malhas = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects:
        o.select_set(o in malhas)
    bpy.context.view_layer.objects.active = malhas[0]
    if len(malhas) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tris = reduzir(obj, alvo)
    if neve:
        texs = [nevar(m) for m in obj.data.materials]
        sc = bpy.context.scene
        sc.render.engine = 'CYCLES'
        sc.cycles.samples = 4
        bake = sc.render.bake
        bake.use_pass_direct = bake.use_pass_indirect = False
        bake.use_pass_color = True
        bake.margin = 8
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
        for m, tex in zip(obj.data.materials, texs):
            if tex:
                bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    for img in bpy.data.images:
        if img.size[0] > 512:
            img.scale(512, 512)
    destino = saida/f'{ident}.glb'
    bpy.ops.export_scene.gltf(filepath=str(destino), export_format='GLB', use_selection=True,
                              export_image_format='JPEG', export_jpeg_quality=80)
    return {'triangulos': tris, 'dimensoes_m': [round(v, 3) for v in obj.dimensions], 'bytes': destino.stat().st_size}


def main():
    arena = sys.argv[sys.argv.index('--') + 1]
    cfg = ARENAS[arena]
    fontes = ROOT/'art/premium/arenas'/arena/'fontes'
    saida = ROOT/'public/arenas'/arena
    saida.mkdir(parents=True, exist_ok=True)
    relatorio = {'modelos': {}}
    for ident, alvo in cfg['modelos'].items():
        relatorio['modelos'][ident] = preparar_modelo(fontes, saida, ident, alvo, cfg.get('neve', False))
        print('ARENA_MODELO', arena, ident, relatorio['modelos'][ident], flush=True)
    chao = cfg['chao']
    for mapa, nome in (('diff', 'chao_cor'), ('nor_gl', 'chao_normal'), ('rough', 'chao_rugosidade')):
        # Alguns pacotes usam 'diffuse' no lugar de 'diff'.
        src = next(p for p in (fontes/chao).glob(f'{chao}_{mapa}*_2k.jpg'))
        img = bpy.data.images.load(str(src))
        img.scale(1024, 1024)
        img.filepath_raw = str(saida/f'{nome}.jpg')
        img.file_format = 'JPEG'
        img.save()
    fundo = bpy.data.images.load(str(fontes/f"{cfg['hdri']}_fundo.jpg"))
    fundo.scale(4096, 2048)
    fundo.filepath_raw = str(saida/'fundo.jpg')
    fundo.file_format = 'JPEG'
    fundo.save()
    hdr = saida/'ambiente.hdr'
    urllib.request.urlretrieve(f"https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/{cfg['hdri']}_1k.hdr", hdr)
    relatorio['arquivos'] = {p.name: p.stat().st_size for p in saida.iterdir()}
    (ROOT/'art/premium/arenas'/arena/'relatorio.json').write_text(json.dumps(relatorio, indent=2) + '\n')
    print('ARENA_OK', arena, sum(relatorio['arquivos'].values()), flush=True)


if __name__ == '__main__':
    main()
