"""Render a consistent front/profile/back review of the editable Pipoca blockout."""
from pathlib import Path
import hashlib
import json
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
GLB_MODE = '--glb' in sys.argv
GLB_PATH = ROOT / 'public/modelos/estudos/pipoca-direcao-visual-v13.glb'
OUTPUT = ROOT / ('art/premium/modelos-3d/estudos-mixamo/turnaround-blender-v13'
                 if GLB_MODE else 'art/premium/modelos-3d/blockout/turnaround-blender-v1')
TARGET = Vector((0.0, 0.0, 1.5)) if GLB_MODE else Vector((0.0, 0.0, 1.607))
DISTANCE = 7.5
VIEWS = [
    ('frente', Vector((1.0, 0.0, 0.0))),
    ('perfil', Vector((0.0, -1.0, 0.0))),
    ('costas', Vector((-1.0, 0.0, 0.0))),
]


def render_turnaround():
    if GLB_MODE:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))

    scene = bpy.context.scene
    if GLB_MODE:
        if not any(obj.type == 'ARMATURE' for obj in scene.objects) or not any(obj.type == 'MESH' and obj.data.vertices for obj in scene.objects):
            raise RuntimeError('O GLB atual não contém personagem rigado e malha.')
        scene.render.engine = 'BLENDER_EEVEE'
        scene.world = bpy.data.worlds.new('PipocaStudioWorld')
        scene.world.color = (.62, .62, .62)
        luz = bpy.data.lights.new('PipocaStudioKey', 'AREA')
        luz.energy = 1700
        luz.shape = 'DISK'
        luz.size = 5
        objeto_luz = bpy.data.objects.new('PipocaStudioKey', luz)
        scene.collection.objects.link(objeto_luz)
        objeto_luz.location = (4, -4, 6)
        objeto_luz.rotation_euler = (Vector((0, 0, 1.5)) - objeto_luz.location).to_track_quat('-Z', 'Y').to_euler()
    elif bpy.data.objects.get('lutador') is None or bpy.data.objects.get('pipoca-malha') is None:
        raise RuntimeError('A cena carregada não contém o rig e a malha da Pipoca.')

    OUTPUT.mkdir(parents=True, exist_ok=True)
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.frame_set(1)
    registros = []

    for indice, (nome, direcao) in enumerate(VIEWS):
        camera = bpy.data.objects.get(f'QA_Camera_{nome.title()}')
        if camera is None:
            referencia = bpy.data.objects.get('QA_Camera_Frente')
            if referencia:
                camera = referencia.copy()
                camera.data = referencia.data.copy()
                camera.name = f'QA_Camera_{nome.title()}_Gerada'
                scene.collection.objects.link(camera)
            else:
                dados_camera = bpy.data.cameras.new(f'QA_Camera_{nome.title()}_Gerada')
                camera = bpy.data.objects.new(dados_camera.name, dados_camera)
                scene.collection.objects.link(camera)
        camera.data.type = 'ORTHO'
        camera.data.ortho_scale = 3.5
        camera.location = TARGET + direcao * DISTANCE
        camera.rotation_euler = (TARGET - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.camera = camera
        destino = OUTPUT / f'{indice:03d}-{nome}.png'
        scene.render.filepath = str(destino)
        bpy.ops.render.render(write_still=True)
        registros.append({'vista': nome, 'arquivo': destino.name})

    (OUTPUT / 'manifest.json').write_text(json.dumps({
        'fonte': str(GLB_PATH.relative_to(ROOT)) if GLB_MODE else 'art/premium/modelos-3d/blockout/pipoca-v1.blend',
        'referencia': 'art/premium/elenco/pipoca-v1.png',
        'sha256Fonte': hashlib.sha256(GLB_PATH.read_bytes()).hexdigest() if GLB_MODE else None,
        'blender': bpy.app.version_string,
        'resolucao': [scene.render.resolution_x, scene.render.resolution_y],
        'vistas': registros,
        'origemAlterada': False,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Turnaround Pipoca ({"GLB v13" if GLB_MODE else "blockout Blender"}): {len(registros)} vistas em {OUTPUT}')


render_turnaround()