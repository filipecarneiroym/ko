"""Pipoca v5: Meshy v2 (multivista, pose neutra) até a aparência da arte.

Blender: blender -b --python concluir-aparencia-meshy-pipoca-v5.py [-- --draft]
"""
from pathlib import Path
import sys, json, hashlib, math

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
DIR = ROOT/'art/premium/modelos-3d/estudos-mixamo/meshy-pipoca-v2'
SOURCE = DIR/'meshy-bunny-boxer-v2.glb'
REFERENCE = ROOT/'art/premium/modelos-3d/referencias/pipoca-referencia-v1.png'
OUTPUT = DIR/'identidade-v5'
DRAFT = '--draft' in sys.argv


def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def taubin(mesh, passes, weight=None):
    """Volume-preserving smoothing (lambda/mu); removes Meshy facets."""
    co = np.array([v.co[:] for v in mesh.vertices])
    edges = np.array(mesh.edge_keys)
    deg = np.bincount(edges.ravel(), minlength=len(co))[:, None].clip(1)
    w = np.ones((len(co), 1)) if weight is None else np.asarray(weight)[:, None]
    for _ in range(passes):
        for factor in (.5, -.53):
            acc = np.zeros_like(co)
            np.add.at(acc, edges[:, 0], co[edges[:, 1]])
            np.add.at(acc, edges[:, 1], co[edges[:, 0]])
            co += factor*w*(acc/deg-co)
    mesh.vertices.foreach_set('co', co.ravel())
    mesh.update()


def import_source():
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    obj.name = 'Pipoca v5 | corpo'
    obj.data.name = 'Pipoca v5 | corpo'
    return obj


def studio(scene):
    scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [
        e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else scene.render.engine
    world = bpy.data.worlds.new('Pipoca v5 | estúdio')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (.084, .094, .110, 1)
    bg.inputs['Strength'].default_value = .6
    scene.world = world
    # Soft studio light that keeps the art's peach-cream fur readable.
    for name, loc, energy, size in (('Key', (-2.6, -3.5, 3.0), 420, 4),
                                    ('Fill', (2.6, -2.2, 1.2), 190, 4),
                                    ('Rim', (1.6, 2.6, 2.4), 320, 2)):
        light = bpy.data.lights.new('Pipoca v5 | '+name, 'AREA')
        light.energy, light.size = energy, size
        o = bpy.data.objects.new(light.name, light)
        scene.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 0))-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.cameras.new('Pipoca v5 | câmera')
    cam.type = 'ORTHO'
    camera = bpy.data.objects.new(cam.name, cam)
    scene.collection.objects.link(camera)
    scene.camera = camera
    # Standard keeps material colours as authored (Filmic/AgX wash pastels out).
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.exposure = 0.0
    return camera


def main():
    import pipoca_v5_figurino as FIG
    import pipoca_v5_rosto as FACE
    from pipoca_materiais import criar_materiais
    from pipoca_superficie_meshy_v4 import refinar_materiais
    OUTPUT.mkdir(parents=True, exist_ok=True)
    obj = import_source()
    mesh = obj.data
    report = {'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': digest(SOURCE)}
    taubin(mesh, 6)
    mats = criar_materiais()
    mats['tecido_top'] = mats['tecido'].copy()
    mats['tecido_top'].name = 'Pipoca v5 | top esportivo índigo'
    report['materials'] = refinar_materiais(mats)
    FIG.recolour(mats)
    face_prep = FACE.prepare(obj)
    report['straps'] = FIG.build_straps(mesh)
    report['hems'] = FIG.build_hems(mesh)
    report['waist'] = FIG.build_waist(mesh)
    report['tail'] = FIG.build_tail(mesh)
    ear = FIG.ear_field(mesh, ROOT)
    order = ['pelagem', 'interior_orelha', 'tecido', 'tecido_top', 'faixas', 'couro', 'pupila', 'sobrancelha']
    body_mats = {k: mats[k] for k in order}
    report['contours'] = FIG.cut(obj, body_mats, FIG.regions(), ear,
                                 head_regions=[('pupila', FACE.lid_field), ('sobrancelha', FACE.brow_field)])
    collection = bpy.data.collections.new('Pipoca | identidade visual v5')
    bpy.context.scene.collection.children.link(collection)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    report['face'] = FACE.build(obj, mats, collection, face_prep)
    report['details'] = FACE.details(obj, mats, collection)
    scene = bpy.context.scene
    camera = studio(scene)
    if hasattr(scene, 'eevee') and hasattr(scene.eevee, 'taa_render_samples'):
        scene.eevee.taa_render_samples = 24 if DRAFT else 64
    scene.render.resolution_x, scene.render.resolution_y = 900, 1200
    scene.render.resolution_percentage = 70 if DRAFT else 100
    for p in (REFERENCE, ROOT/FIG.EAR_MARKUP):
        bpy.data.images.load(str(p), check_existing=True).pack()
    bpy.context.preferences.filepaths.save_version = 0
    workfile = OUTPUT/'pipoca-identidade-v5.blend'
    views = [('frente', (0, -5, 0), (0, 0, 0), 2.1), ('tres-quartos', (3.4, -3.7, .3), (0, 0, 0), 2.1),
             ('perfil', (-5, 0, 0), (0, 0, 0), 2.1), ('costas', (0, 5, 0), (0, 0, 0), 2.1),
             ('rosto', (0, -5, .52), (0, 0, .52), .62), ('rosto-34', (3, -4, .55), (0, -.05, .52), .62)]
    if DRAFT:
        views = [views[0], views[2], views[3], views[4]]
    _, loc, target, scale = views[0]
    camera.location = loc
    camera.rotation_euler = (Vector(target)-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    bpy.ops.wm.save_as_mainfile(filepath=str(workfile))
    shots = []
    for name, loc, target, scale in views:
        camera.location = loc
        camera.rotation_euler = (Vector(target)-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = scale
        path = OUTPUT/(name+'.png')
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        shots.append({'view': name, 'file': name+'.png', 'sha256': digest(path)})
        print('PIPOCA_V5_VIEW', name, flush=True)
    if not DRAFT:
        camera.location = (0, -5, FIG.EAR_RENDER['z'])
        camera.rotation_euler = (Vector((0, 0, FIG.EAR_RENDER['z']))-camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = FIG.EAR_RENDER['ortho']
        scene.render.resolution_x, scene.render.resolution_y = FIG.EAR_RENDER['width'], FIG.EAR_RENDER['height']
        path = OUTPUT/'orelhas-final.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        shots.append({'view': 'orelhas', 'file': path.name, 'sha256': digest(path)})
        print('PIPOCA_V5_VIEW orelhas', flush=True)
    report['ears'] = {'markup': FIG.EAR_MARKUP, 'markupSha256': digest(ROOT/FIG.EAR_MARKUP),
                      'edgeSmoothingMarkupPixels': 1, 'projection': 'frontal, campo contínuo bilinear'}
    report.update({'version': 5, 'draft': DRAFT, 'workfile': str(workfile.relative_to(ROOT)),
                   'reference': str(REFERENCE.relative_to(ROOT)), 'views': shots,
                   'blender': bpy.app.version_string})
    (OUTPUT/'revisao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str)+'\n',
                                       encoding='utf8')
    print('PIPOCA_V5_COMPLETE', workfile, flush=True)


if __name__ == '__main__':
    main()
