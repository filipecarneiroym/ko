"""Prepare a non-destructive Blender workfile for the downloaded Meshy Pipoca base."""
from pathlib import Path
import hashlib
import json
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path.home() / 'Downloads/Meshy_AI_Boxing_Bunny_1012051617_generate.glb'
OUTPUT_DIR = ROOT / 'art/premium/modelos-3d/estudos-mixamo'
WORKFILE = OUTPUT_DIR / 'meshy-pipoca-refinamento-v2.blend'
PREVIEW = OUTPUT_DIR / 'meshy-pipoca-refinamento-v2.png'
REPORT = OUTPUT_DIR / 'meshy-pipoca-refinamento-v2.json'
REFERENCE = ROOT / 'art/premium/elenco/pipoca-v1.png'


def material(name, color, roughness):
    item = bpy.data.materials.new(name)
    item.diffuse_color = (*color, 1)
    item.use_nodes = True
    shader = item.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    vertex_color = item.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex_color.layer_name = 'Pipoca_BlockoutColor'
    vertex_color.location = (-300, 120)
    item.node_tree.links.new(vertex_color.outputs['Color'], shader.inputs['Base Color'])
    return item


def smoothstep(start, end, value):
    if start == end:
        return 1.0 if value >= end else 0.0
    t = max(0.0, min(1.0, (value - start) / (end - start)))
    return t * t * (3.0 - 2.0 * t)


def interval_weight(value, low, high, feather):
    return smoothstep(low, low + feather, value) * (1.0 - smoothstep(high - feather, high, value))


def ellipsoid_weight(point, center, radii):
    distance = sum(((point[i] - center[i]) / radii[i]) ** 2 for i in range(3))
    return 1.0 - smoothstep(.72, 1.12, distance)


def blend_color(base, target, weight):
    return tuple(base[i] * (1.0 - weight) + target[i] * weight for i in range(3))


def assign_blockout_materials(obj):
    colors = {
        'fur': (.77, .71, .61),
        'indigo': (.055, .065, .31),
        'red': (.68, .018, .035),
        'coral': (.92, .27, .30),
        'amber': (.92, .36, .035),
    }
    if not REFERENCE.is_file():
        raise FileNotFoundError(f'Approved Pipoca reference not found: {REFERENCE}')
    image = bpy.data.images.load(str(REFERENCE), check_existing=False)
    palette = [material('Pipoca | soft spatial color study', colors['fur'], .72)]
    obj.data.materials.clear()
    obj.data.materials.append(palette[0])
    attribute = obj.data.color_attributes.get('Pipoca_BlockoutColor')
    if attribute:
        obj.data.color_attributes.remove(attribute)
    attribute = obj.data.color_attributes.new(name='Pipoca_BlockoutColor', type='FLOAT_COLOR', domain='CORNER')
    def smooth_array(start, end, values):
        t = np.clip((values - start) / (end - start), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    vertex_count = len(obj.data.vertices)
    coordinates = np.empty(vertex_count * 3, dtype=np.float32)
    obj.data.vertices.foreach_get('co', coordinates)
    coordinates = coordinates.reshape((-1, 3))
    x, y, z = coordinates.T
    color = np.tile(np.asarray(colors['fur'], dtype=np.float32), (vertex_count, 1))

    shorts = smooth_array(-.39, -.39 + .035, z) * (1.0 - smooth_array(.34, .46, np.abs(x)))
    shorts *= 1.0 - smooth_array(-.055 - .035, -.055, z)
    top = smooth_array(-.025, -.025 + .04, z) * (1.0 - smooth_array(.19, .285, np.abs(x)))
    top *= 1.0 - smooth_array(.34 - .04, .34, z)
    fabric = np.maximum(shorts, top)
    color = color * (1.0 - fabric[:, None]) + np.asarray(colors['indigo']) * fabric[:, None]

    def ellipsoid_array(center, radii):
        distance = np.sum(((coordinates - np.asarray(center)) / np.asarray(radii)) ** 2, axis=1)
        return 1.0 - smooth_array(.72, 1.12, distance)

    glove = np.maximum(ellipsoid_array((-.29, -.17, .23), (.145, .15, .12)),
                       ellipsoid_array((.29, -.17, .23), (.145, .15, .12)))
    color = color * (1.0 - glove[:, None]) + np.asarray(colors['red']) * glove[:, None]
    inner_ear = np.maximum(ellipsoid_array((-.115, -.035, .72), (.065, .055, .20)),
                           ellipsoid_array((.115, -.035, .72), (.065, .055, .20)))
    color = color * (1.0 - inner_ear[:, None]) + np.asarray(colors['coral']) * inner_ear[:, None]
    eye = np.maximum(ellipsoid_array((-.08, -.32, .39), (.047, .04, .032)),
                     ellipsoid_array((.08, -.32, .39), (.047, .04, .032)))
    color = color * (1.0 - eye[:, None]) + np.asarray(colors['amber']) * eye[:, None]
    nose = ellipsoid_array((0, -.345, .335), (.035, .03, .025))
    color = color * (1.0 - nose[:, None]) + np.asarray(colors['coral']) * nose[:, None]

    loop_vertices = np.empty(len(obj.data.loops), dtype=np.int32)
    obj.data.loops.foreach_get('vertex_index', loop_vertices)
    corner_colors = np.ones((len(loop_vertices), 4), dtype=np.float32)
    corner_colors[:, :3] = color[loop_vertices]
    attribute.data.foreach_set('color', corner_colors.ravel())
    counts = {
        'furCorners': int(np.count_nonzero(((fabric <= .5) & (glove <= .5) & (inner_ear <= .5) & (nose <= .5))[loop_vertices])),
        'fabricCorners': int(np.count_nonzero(fabric[loop_vertices] > .5)),
        'gloveCorners': int(np.count_nonzero(glove[loop_vertices] > .5)),
        'coralCorners': int(np.count_nonzero((inner_ear[loop_vertices] > .5) | (nose[loop_vertices] > .5))),
        'projectedCorners': 0,
    }

    for face in obj.data.polygons:
        face.use_smooth = True
        face.material_index = 0
    obj.data.update()
    if not obj.data.uv_layers:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=.012)
        bpy.ops.object.mode_set(mode='OBJECT')
        obj.select_set(False)
    image.pack()
    return palette, counts, image


def setup_camera_and_light(scene):
    target = Vector((0, 0, 0))
    camera_data = bpy.data.cameras.new('Pipoca review camera')
    camera = bpy.data.objects.new('Pipoca review camera', camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 2.65
    camera.location = target + Vector((0.0, -5.5, 0.0))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Z').to_euler()
    scene.camera = camera

    light_data = bpy.data.lights.new('Pipoca review key', 'AREA')
    light = bpy.data.objects.new('Pipoca review key', light_data)
    scene.collection.objects.link(light)
    light.location = (3.4, -4.0, 4.4)
    light_data.energy = 1250
    light_data.shape = 'DISK'
    light_data.size = 4.0
    light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Z').to_euler()


def prepare():
    if not SOURCE.is_file():
        raise FileNotFoundError(f'Meshy GLB not found: {SOURCE}')
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))

    imported = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.data.vertices]
    if len(imported) != 1:
        raise RuntimeError(f'Expected one imported character mesh; found {len(imported)}.')
    original = imported[0]
    original.name = 'SOURCE | Meshy GLB untouched'
    original.data.name = 'SOURCE | original triangulated mesh'
    source_collection = bpy.data.collections.new('00 | Original import - keep intact')
    bpy.context.scene.collection.children.link(source_collection)
    for collection in list(original.users_collection):
        collection.objects.unlink(original)
    source_collection.objects.link(original)
    original.hide_render = True
    original.hide_set(True)
    original['source_file'] = str(SOURCE)
    original['source_sha256'] = source_hash

    work_collection = bpy.data.collections.new('01 | Refinement work mesh')
    bpy.context.scene.collection.children.link(work_collection)
    work = original.copy()
    work.data = original.data.copy()
    work.name = 'Pipoca | Meshy work copy - spatial color study'
    work.data.name = 'Pipoca | editable UV-mapped mesh copy'
    work_collection.objects.link(work)
    work.hide_set(False)
    work.hide_render = False
    palette, material_counts, reference_image = assign_blockout_materials(work)
    work['refinement_status'] = 'Spatial color study only; face masks need manual review; not game ready.'
    work['source_sha256'] = source_hash

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('Pipoca neutral studio')
    scene.world.color = (.24, .24, .24)
    setup_camera_and_light(scene)
    scene.render.filepath = str(PREVIEW)

    report = {
        'source': str(SOURCE),
        'sourceSha256': source_hash,
        'reference': str(REFERENCE.relative_to(ROOT)),
        'referenceSha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
        'workfile': str(WORKFILE.relative_to(ROOT)),
        'preview': str(PREVIEW.relative_to(ROOT)),
        'mesh': {
            'vertices': len(work.data.vertices),
            'faces': len(work.data.polygons),
            'materials': [item.name for item in palette],
            'vertexColorContributionsPerLoop': material_counts,
            'uvLayers': len(work.data.uv_layers),
            'armatureModifiers': sum(mod.type == 'ARMATURE' for mod in work.modifiers),
        },
        'colorTransfer': 'No photo projection: the approved concept is packed in this .blend for manual comparison; the work mesh uses only soft spatial color regions.',
        'limitations': [
            'The source is one mostly connected triangle mesh; spatial color masks are only a blockout.',
            'Spatial color regions are approximate and require manual editing against the packed reference.',
            'The generated UVs are for editing, not a finished fur or fabric texture layout.',
            'No rig or weight groups are invented in this preparation step.',
            'The source collection remains intact and hidden; only the work copy receives edits.',
        ],
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORKFILE))
    print('REFINEMENT_PREPARED', json.dumps(report, ensure_ascii=False))


prepare()