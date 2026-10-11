"""Inspeção somente leitura do rig da Pipoca e do movimento Mixamo."""
from pathlib import Path
import bpy

raiz = Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(raiz / 'art/premium/modelos-3d/blockout/pipoca-v1.blend'))
print('PIPOCA_RIG', [(o.name, [(b.name, tuple(b.head_local), tuple(b.tail_local)) for b in o.data.bones]) for o in bpy.data.objects if o.type == 'ARMATURE'])
bpy.ops.import_scene.fbx(filepath=str(raiz / 'art/premium/movimentos/Boxing.fbx'))
print('RIGS', [(o.name, [b.name for b in o.data.bones]) for o in bpy.data.objects if o.type == 'ARMATURE'])
print('ACOES', [(a.name, tuple(a.frame_range)) for a in bpy.data.actions])
