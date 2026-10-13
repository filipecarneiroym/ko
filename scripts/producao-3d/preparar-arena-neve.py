"""Arena Neve: recursos Poly Haven (CC0) prontos para o jogo.

blender -b --python scripts/producao-3d/preparar-arena-neve.py

- Pinheiro, pedra e toco reduzidos e exportados em GLB (texturas 1k embutidas),
  com neve no topo (cor por altura/normal, sem textura extra).
- Fundo 360° (foto tonemapped) e luz ambiente (HDR 1k) para public/arenas/neve.
- Chão: textura de neve 2k reduzida para 1k (cor, normal, rugosidade).
"""
from pathlib import Path
import json
import shutil

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FONTES = ROOT/'art/premium/arenas/neve/fontes'
SAIDA = ROOT/'public/arenas/neve'
SAIDA.mkdir(parents=True, exist_ok=True)

MODELOS = {
    # id: (triângulos alvo, cobertura de neve 0..1)
    'fir_sapling': (14000, .65),
    'pine_sapling_small': (9000, .6),
    'boulder_01': (2500, .55),
    'tree_stump_01': (2500, .7),
}


def limpar():
    bpy.ops.wm.read_homefile(use_empty=True)


def reduzir(obj, alvo):
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris <= alvo:
        return tris
    m = obj.modifiers.new('reduzir', 'DECIMATE')
    m.ratio = alvo / tris
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier=m.name)
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def nevar(mat, cobertura):
    """Mistura branco de neve onde a normal aponta para cima."""
    if not mat or not mat.use_nodes:
        return
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
    rampa.inputs['From Min'].default_value = 1 - cobertura
    rampa.inputs['From Max'].default_value = 1 - cobertura + .25
    nt.links.new(sep.outputs['Z'], rampa.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    a = next(s for s in mix.inputs if s.name == 'A' and s.type == 'RGBA')
    b = next(s for s in mix.inputs if s.name == 'B' and s.type == 'RGBA')
    b.default_value = (.92, .95, 1.0, 1)
    if origem:
        nt.links.new(origem, a)
    else:
        a.default_value = entrada.default_value
    nt.links.new(rampa.outputs['Result'], mix.inputs['Factor'])
    nt.links.new(next(s for s in mix.outputs if s.type == 'RGBA'), entrada)


def assar_cor_neve(obj):
    """O glTF não leva nós: assa a cor com neve na textura base (1k)."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 4
    for mat in obj.data.materials:
        nt = mat.node_tree
        img = bpy.data.images.new(f'{mat.name}_neve', 1024, 1024)
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        nt.nodes.active = tex
    for o in sc.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj
    bake = sc.render.bake
    bake.use_pass_direct = bake.use_pass_indirect = False
    bake.use_pass_color = True
    bake.margin = 8
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    for mat in obj.data.materials:
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = nt.nodes.active
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])


def main():
    relatorio = {}
    for ident, (alvo, cobertura) in MODELOS.items():
        limpar()
        bpy.ops.import_scene.gltf(filepath=str(FONTES/ident/f'{ident}_1k.gltf'))
        malhas = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        for o in bpy.context.scene.objects:
            o.select_set(o in malhas)
        bpy.context.view_layer.objects.active = malhas[0]
        if len(malhas) > 1:
            bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        tris = reduzir(obj, alvo)
        for mat in obj.data.materials:
            nevar(mat, cobertura)
        assar_cor_neve(obj)
        destino = SAIDA/f'{ident}.glb'
        bpy.ops.export_scene.gltf(filepath=str(destino), export_format='GLB', use_selection=True,
                                  export_image_format='JPEG', export_jpeg_quality=82)
        dims = [round(v, 3) for v in obj.dimensions]
        relatorio[ident] = {'triangulos': tris, 'dimensoes_m': dims, 'bytes': destino.stat().st_size}
        print('ARENA_NEVE_MODELO', ident, relatorio[ident], flush=True)

    # Chão de neve: reduz para 1k.
    for mapa in ('diff', 'nor_gl', 'rough'):
        src = FONTES/'snow_02'/f'snow_02_{mapa}_2k.jpg'
        img = bpy.data.images.load(str(src))
        img.scale(1024, 1024)
        img.filepath_raw = str(SAIDA/f'neve_{mapa}.jpg')
        img.file_format = 'JPEG'
        img.save()
    # Fundo 360° (4096x2048) e luz ambiente HDR 1k.
    fundo = bpy.data.images.load(str(FONTES/'snowy_forest_path_01_fundo.jpg'))
    fundo.scale(4096, 2048)
    fundo.filepath_raw = str(SAIDA/'fundo.jpg')
    fundo.file_format = 'JPEG'
    fundo.save()
    shutil.copy(FONTES/'snowy_forest_path_01_2k.hdr', SAIDA/'ambiente.hdr')
    relatorio['arquivos'] = {p.name: p.stat().st_size for p in SAIDA.iterdir()}
    (ROOT/'art/premium/arenas/neve/relatorio.json').write_text(json.dumps(relatorio, indent=2) + '\n')
    print('ARENA_NEVE_OK', json.dumps(relatorio['arquivos']), flush=True)


if __name__ == '__main__':
    main()
