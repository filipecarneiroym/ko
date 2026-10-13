"""Refine the Meshy v1 work copy for an explicit visual review before rigging.

The v1 file, downloaded source and existing game assets are never overwritten.
Run with Blender in background; --inspect only renders the unmodified mesh.
"""
from pathlib import Path
import sys
import json
import hashlib
import math
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/premium/modelos-3d/estudos-mixamo/meshy-pipoca-refinamento-v1.blend'
REFERENCE = ROOT / 'art/premium/elenco/pipoca-v1.png'
OUTPUT = ROOT / 'art/premium/modelos-3d/estudos-mixamo/meshy-pipoca-identidade-v3'
INSPECT = '--inspect' in sys.argv


def smoothstep(a, b, value):
    t = max(0.0, min(1.0, (value - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def surface_tree(obj, predicate=None):
    coordinates = [v.co.copy() for v in obj.data.vertices]
    polygons = [list(p.vertices) for p in obj.data.polygons
                if predicate is None or predicate(p.center)]
    return BVHTree.FromPolygons(coordinates, polygons, all_triangles=False)


def ray_surface(tree, origin, direction, offset=.002):
    hit, normal, _, _ = tree.ray_cast(Vector(origin), Vector(direction).normalized(), 4)
    if hit is None:
        return None
    return hit + normal * offset


def curve(name, points, radius, material, collection, cyclic=False):
    if len(points) < 2:
        return None
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def ribbon(name, rows, material, collection):
    rows = [r for r in rows if len(r) == 2 and all(p is not None for p in r)]
    if len(rows) < 2:
        return None
    mesh = bpy.data.meshes.new(name)
    verts = [tuple(p) for r in rows for p in r]
    faces = [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(len(rows)-1)]
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def ellipsoid(name, location, scale, material, collection, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


FEET = [
    ('E', Vector((-.446, .155, -.810)), Vector((-.37, -.929, 0))),
    ('D', Vector((.468, -.162, -.811)), Vector((.24, -.971, 0))),
]
WRISTS = [
    ('E', Vector((-.222, -.118, .158)), Vector((.33, -.72, .61)).normalized()),
    ('D', Vector((.325, -.14, .185)), Vector((-.055, -.55, .835)).normalized()),
]


def shorts_hem(p):
    """Hem planes fitted to actual Meshy fold ridges, not to horizontal body bands."""
    if p.x > .035:
        return .717488*p.x-.510380*p.y-.409043-.006
    front=-.450361*p.x-.146739*p.y-.309715
    back=-.607710*p.x+.416237*p.y-.387130
    weight=smoothstep(.015,.12,p.y)
    return front*(1-weight)+back*weight-.006


def adjust_body(obj):
    changes = {'feetWidenedVertices': 0, 'neckAdjustedVertices': 0}
    for vertex in obj.data.vertices:
        p = vertex.co
        if p.z < -.77:
            _, ankle, forward = FEET[0 if p.x < 0 else 1]
            lateral = Vector((-forward.y, forward.x, 0))
            relative = p - ankle
            width = relative.dot(lateral)
            length = relative.dot(forward)
            weight = 1.0 - smoothstep(-.88, -.77, p.z)
            p += lateral * width * .12 * weight
            p += forward * max(length, 0) * .05 * weight
            changes['feetWidenedVertices'] += 1
        if .29 < p.z < .39 and abs(p.x-.015) < .085 and -.035 < p.y < .10:
            weight = smoothstep(.29, .335, p.z)
            p.x = .015 + (p.x-.015)*(1+.10*weight)
            p.y = .035 + (p.y-.035)*(1+.10*weight)
            changes['neckAdjustedVertices'] += 1
    obj.data.update()
    return changes


def assign_body_regions(obj, materials):
    names = list(materials)
    obj.data.materials.clear()
    for name in names:
        obj.data.materials.append(materials[name])
    indices = {name: i for i, name in enumerate(names)}
    regions = {}
    for face in obj.data.polygons:
        p = face.center
        name = 'pelagem'
        if p.z < .39:
            # Delimit actual outfit surfaces; the old image-projected colors are discarded.
            waist = -.055 + .18*(p.x-.035)
            hem = shorts_hem(p)
            tail = p.y > .225 and -.20 < p.z < .075
            if hem < p.z < waist and not tail:
                name = 'tecido'
            if waist-.029 < p.z < waist+.007 and not tail:
                name = 'faixas'
            x = p.x - .018
            if .025 < p.z < .30:
                if p.y < .025:
                    neckline = .164 + .128*min(1, (abs(x)/.136)**1.8)
                    torso_limit = .155 if p.z > .18 else .177
                    if abs(x) < torso_limit and p.z < neckline:
                        name = 'tecido'
                else:
                    if (p.z < .165 and abs(x) < .165) or (abs(x) < .055 and p.z < .30):
                        name = 'tecido'
            for _, wrist, axis in WRISTS:
                relative = p-wrist
                t = relative.dot(axis)
                radial = (relative-axis*t).length
                if -.018 < t < .50 and radial < .135:
                    name = 'faixas' if (-.013<t<.003 or .029<t<.043) else 'couro'
                    break
            if p.z < -.775:
                _, ankle, forward = FEET[0 if p.x < 0 else 1]
                q = (p-ankle).dot(forward)
                if p.z > -.884 or (q < .102 and p.z > -.942):
                    name = 'faixas'
        face.material_index = indices[name]
        face.use_smooth = True
        regions[name] = regions.get(name, 0) + 1
    obj.data.update()
    return regions


def cut_material_boundaries(obj, materials):
    """Cut crossing triangles at outfit contours instead of coloring whole triangles."""
    mesh = obj.data
    material_indices = {key: next(i for i,m in enumerate(mesh.materials) if m==mat) for key,mat in materials.items()}
    verts, faces, face_materials, output_uvs = [], [], [], []
    lookup = {}
    source_uv = mesh.uv_layers.active
    def clip(poly, field, inside):
        result = []
        if not poly:
            return result
        previous = poly[-1]
        fp = field(previous[0])
        previous_inside = fp >= 0 if inside else fp < 0
        for current in poly:
            fc = field(current[0])
            current_inside = fc >= 0 if inside else fc < 0
            if current_inside != previous_inside:
                t = fp/(fp-fc)
                result.append((previous[0].lerp(current[0],t),previous[1].lerp(current[1],t)))
            if current_inside:
                result.append(current)
            previous,fp,previous_inside = current,fc,current_inside
        return result
    def append(poly, material):
        if len(poly) < 3:
            return
        indices = []
        uv = []
        for co,tex in poly:
            key = tuple(round(v,8) for v in co)
            if key not in lookup:
                lookup[key] = len(verts)
                verts.append(tuple(co))
            indices.append(lookup[key])
            uv.append(tex)
        if len(set(indices)) < 3:
            return
        faces.append(indices)
        output_uvs.append(uv)
        face_materials.append(material)
    def glove(p,wrist,axis):
        relative = p-wrist
        t = relative.dot(axis)
        radial = (relative-axis*t).length
        return min(t+.018,.50-t,.125-radial)
    def cuff(p,wrist,axis):
        relative = p-wrist
        t = relative.dot(axis)
        radial = (relative-axis*t).length
        white_bands=max(min(t+.013,.003-t),min(t-.029,.043-t))
        return min(white_bands,.125-radial)
    def foot(p):
        _,ankle,forward = FEET[0 if p.x<0 else 1]
        q = (p-ankle).dot(forward)
        return min(-.775-p.z,max(p.z+.884,min(.102-q,p.z+.942)))
    def waistband(p):
        waist = -.055+.18*(p.x-.035)
        return min(p.z-(waist-.029),waist+.007-p.z,.225-p.y)
    def shorts(p):
        waist = -.055+.18*(p.x-.035)
        hem = shorts_hem(p)
        return min(waist-p.z,p.z-hem,.225-p.y)
    def top(p):
        x = p.x-.018
        front_weight = 1-smoothstep(.005,.075,p.y)
        neckline_front = .195+.102*min(1,(abs(x)/.136)**2.8)
        neckline_back = .165+.135*(1-smoothstep(.045,.075,abs(x)))
        neckline = neckline_front*front_weight+neckline_back*(1-front_weight)
        width = .174-.037*smoothstep(.15,.23,p.z)
        # Narrow shoulder straps preserve exposed upper arms.
        return min(p.z-.058,neckline-p.z,width-abs(x))
    fields = []
    for _,wrist,axis in WRISTS:
        fields.append(('faixas',lambda p,w=wrist,a=axis:cuff(p,w,a)))
        fields.append(('couro',lambda p,w=wrist,a=axis:glove(p,w,a)))
    fields += [('faixas',foot),('faixas',waistband),('tecido',shorts),('tecido',top)]
    for face in mesh.polygons:
        poly = [(mesh.vertices[vi].co.copy(),source_uv.data[li].uv.copy() if source_uv else Vector((0,0)))
                for vi,li in zip(face.vertices,face.loop_indices)]
        if face.center.z >= .39:
            append(poly,face.material_index)
            continue
        for name,field in fields:
            if not poly:
                break
            assigned = clip(poly,field,True)
            append(assigned,material_indices[name])
            poly = clip(poly,field,False)
        append(poly,material_indices['pelagem'])
    new = bpy.data.meshes.new('Pipoca | precisely delimited editable surfaces')
    new.from_pydata(verts,[],faces)
    for mat in mesh.materials:
        new.materials.append(mat)
    uv = new.uv_layers.new(name='SourceUV_editing_only')
    for face,material,coordinates in zip(new.polygons,face_materials,output_uvs):
        face.material_index = material
        face.use_smooth = True
        for li,tex in zip(face.loop_indices,coordinates):
            uv.data[li].uv = tex
    obj.data = new
    new.update()
    print('MATERIAL_CONTOURS_CUT',len(verts),len(faces),flush=True)


def outfit_details(obj, mats, collection):
    # Exclude the tail from radial clothing projections.
    tree = surface_tree(obj, lambda p: p.z < .39 and not (p.y > .225 and -.20 < p.z < .075))
    center = Vector((.035, .060, -.055))
    def waist_point(angle, dz):
        radial = Vector((math.cos(angle), math.sin(angle), .18*math.cos(angle)))
        middle = center + Vector((0, 0, dz))
        return ray_surface(tree, middle+radial*1.4, -radial, .003)
    waist_rows = [[waist_point(i*2*math.pi/96, z) for z in (-.026, .006)] for i in range(97)]
    ribbon('Pipoca | continuous white waistband', waist_rows, mats['faixas'], collection)
    for z in (-.027, .007):
        curve('Pipoca | waistband piping', [p for i in range(96) if (p:=waist_point(i*2*math.pi/96,z)) is not None], .0014, mats['faixas'], collection, True)

    # Twin stripes follow the curved shorts surface, rather than image projection.
    for side, angle in [('D', -.48), ('E', math.pi+.48)]:
        for stripe in (-1, 1):
            a = angle + stripe*.065
            rows = []
            for i in range(31):
                t = i/30
                z = -.060*(1-t) + (-.326 if side=='E' else -.265)*t
                middle = Vector((.035+.02*t, .060-.01*t, z))
                row = []
                for delta in (-.026, .026):
                    radial = Vector((math.cos(a+delta), math.sin(a+delta), 0))
                    p=ray_surface(tree, middle+radial*1.5, -radial, .0037)
                    if p is not None and p.z < shorts_hem(p)+.003:
                        p=None
                    row.append(p)
                rows.append(row)
            ribbon(f'Pipoca | {side} shorts stripe {stripe}', rows, mats['faixas'], collection)

    # A small cream label with a dark square outline, matching the source costume.
    front = ray_surface(tree, (.035,-1,-.065), (0,1,0), .006)
    if front is not None:
        label = ellipsoid('Pipoca | waistband square label', front, (.016,.003,.012), mats['faixas'], collection)
        points = [front+Vector((x,-.004,z)) for x,z in [(-.015,-.011),(.015,-.011),(.015,.011),(-.015,.011)]]
        curve('Pipoca | label indigo border', points, .0015, mats['tecido'], collection, True)

    for side, ankle, forward in FEET:
        lateral = Vector((-forward.y,forward.x,0))
        foot_tree = surface_tree(obj, lambda p: p.z < -.74 and (p.x < 0 if side=='E' else p.x > 0))
        def foot_top(q, width):
            p = ankle+forward*q+lateral*width
            return ray_surface(foot_tree, (p.x,p.y,-.73), (0,0,-1), .0024)
        for q in (-.005,.028,.060,.095):
            points = [p for i in range(41) if (p:=foot_top(q+.28*(i/40-.5)*.17,(i/40-.5)*.17)) is not None]
            curve(f'Pipoca | {side} instep bandage edge {q}', points, .0016, mats['faixas'], collection)
        points = [p for i in range(41) if (p:=foot_top(.103+.20*(i/40-.5)*.17,(i/40-.5)*.17)) is not None]
        curve(f'Pipoca | {side} red instep trim', points, .0032, mats['couro'], collection)
        points = []
        for i in range(64):
            radial = Vector((math.cos(i*math.tau/64),math.sin(i*math.tau/64),0))
            middle = Vector((ankle.x,ankle.y,-.783))
            p = ray_surface(foot_tree,middle+radial*.35,-radial,.003)
            if p is not None:
                points.append(p)
        curve(f'Pipoca | {side} red ankle trim', points,.0028,mats['couro'],collection,True)
        for number, width in enumerate((-.059,-.021,.019,.056),1):
            p = foot_top(.165-abs(width)*.30,width)
            if p is not None:
                nail = ellipsoid(f'Pipoca | {side} toenail {number}',p,(.009,.012,.0034),mats['unha'],collection,24,12)
                nail.rotation_euler.z = math.atan2(forward.y,forward.x)+math.pi/2


def split_surface(obj, collection, materials):
    """Preserve original loop UVs while organizing editable semantic surfaces."""
    mesh = obj.data
    groups = {}
    for face in mesh.polygons:
        material = mesh.materials[face.material_index]
        material_key = next((key for key,value in materials.items() if value==material),'surface')
        if material_key == 'tecido':
            name = 'top' if face.center.z > 0 else 'short'
        elif material_key == 'pelagem':
            name = ('orelhas' if face.center.z > .60 else 'cabeca' if face.center.z > .39
                    else 'pes' if face.center.z < -.775 else 'corpo')
        elif material_key == 'faixas':
            name = 'faixas-pes' if face.center.z < -.74 else 'punhos' if face.center.z > .08 else 'cos'
        elif material_key == 'couro':
            name = 'luvas'
        else:
            name = material_key
        groups.setdefault((name,face.material_index),[]).append(face)
    outputs = []
    for (group, material_index), faces in groups.items():
        vertex_map, coordinates, polygons, uvs = {}, [], [], []
        for face in faces:
            polygon = []
            face_uvs = []
            for vi, li in zip(face.vertices,face.loop_indices):
                if vi not in vertex_map:
                    vertex_map[vi] = len(coordinates)
                    coordinates.append(mesh.vertices[vi].co.copy())
                polygon.append(vertex_map[vi])
                if mesh.uv_layers.active:
                    face_uvs.append(mesh.uv_layers.active.data[li].uv.copy())
            polygons.append(polygon)
            uvs.append(face_uvs)
        part_mesh = bpy.data.meshes.new('Pipoca | '+group+' surface')
        part_mesh.from_pydata(coordinates,[],polygons)
        part_mesh.materials.append(mesh.materials[material_index])
        if mesh.uv_layers.active:
            layer = part_mesh.uv_layers.new(name='SourceUV_editing_only')
            for face, face_uvs in zip(part_mesh.polygons,uvs):
                for li, uv in zip(face.loop_indices,face_uvs):
                    layer.data[li].uv = uv
        for face in part_mesh.polygons:
            face.use_smooth = True
        part = bpy.data.objects.new('Pipoca | '+group,part_mesh)
        collection.objects.link(part)
        outputs.append(part)
    bpy.data.objects.remove(obj,do_unlink=True)
    return outputs


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def studio(scene):
    for obj in list(scene.objects):
        if obj.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(obj, do_unlink=True)
    world = bpy.data.worlds.new('Pipoca | neutral review studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.24, .27, .32, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .40
    scene.world = world
    for name, pos, energy, size, color in [
        ('Key', (-2.6, -3.5, 3.4), 350, 3.0, (1.0, .87, .75)),
        ('Fill', (2.4, -1.5, 1.4), 200, 3.0, (.78, .86, 1.0)),
        ('Rim', (1.5, 2.0, 2.6), 450, 2.2, (1.0, .88, .75)),
    ]:
        data = bpy.data.lights.new('Pipoca | ' + name, 'AREA')
        data.energy, data.size, data.color = energy, size, color
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        obj.location = pos
        point_at(obj, (0, 0, .0))
    camera_data = bpy.data.cameras.new('Pipoca | review camera')
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 2.22
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.render.image_settings.color_mode = 'RGBA'
    return camera


def render_views(scene, camera, prefix=''):
    entries = []
    views = [
        ('frente', (0, -5, 0), (0, 0, 0), 2.22),
        ('tres-quartos', (2.2, -5, .1), (0, 0, 0), 2.22),
        ('perfil', (5, 0, 0), (0, 0, 0), 2.22),
        ('costas', (0, 5, 0), (0, 0, 0), 2.22),
        ('rosto', (.35, -5, .46), (0, -.03, .47), .95),
    ]
    if '--quick' in sys.argv:
        views = [views[0], views[-1]]
        scene.render.resolution_percentage = 75
    for name, pos, target, scale in views:
        camera.location = pos
        point_at(camera, target)
        camera.data.ortho_scale = scale
        scene.render.filepath = str(OUTPUT / (prefix + name + '.png'))
        bpy.ops.render.render(write_still=True)
        entries.append({'view': name, 'file': prefix + name + '.png'})
    return entries


def render_orbit(scene,camera):
    folder=OUTPUT/'giro-360'
    folder.mkdir(parents=True,exist_ok=True)
    scene.render.resolution_x=720
    scene.render.resolution_y=960
    scene.render.resolution_percentage=100
    camera.data.ortho_scale=2.22
    count=8 if '--draft-360' in sys.argv else 24
    entries=[]
    for frame in range(count):
        angle=math.tau*frame/count
        camera.location=(5*math.sin(angle),-5*math.cos(angle),.04)
        point_at(camera,(0,0,0))
        path=folder/f'{frame:03d}.png'
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        entries.append({'degrees':round(360*frame/count,1),'file':str(path.relative_to(OUTPUT))})
        print('ORBIT_FRAME',frame+1,count,flush=True)
    return entries


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    original = next(o for o in scene.objects if o.type == 'MESH' and not o.hide_render)
    print('MESH_MATRIX', list(map(list, original.matrix_world)), flush=True)
    print('MESH_BOUNDS', [list(v) for v in original.bound_box], flush=True)
    camera = studio(scene)
    if INSPECT:
        clay = bpy.data.materials.new('Inspection | neutral clay')
        clay.use_nodes = True
        shader = clay.node_tree.nodes['Principled BSDF']
        shader.inputs['Base Color'].default_value = (.65, .58, .47, 1)
        shader.inputs['Roughness'].default_value = .80
        original.data.materials.clear()
        original.data.materials.append(clay)
        for face in original.data.polygons:
            face.material_index = 0
        render_views(scene, camera, 'antes-')
        return
    from pipoca_materiais import criar_materiais
    mats = criar_materiais()
    collection = bpy.data.collections.new('Pipoca | visual identity refinement v3')
    scene.collection.children.link(collection)
    for old in list(original.users_collection):
        old.objects.unlink(original)
    collection.objects.link(original)
    original.name = 'Pipoca | editable Meshy base'
    changes = adjust_body(original)
    regions = assign_body_regions(original, mats)
    face_report = {'pending': True}
    if '--body-only' not in sys.argv:
        from pipoca_rosto_meshy import refinar_rosto
        face_report = refinar_rosto(original, mats, collection)
    cut_material_boundaries(original,mats)
    outfit_details(original, mats, collection)
    parts = split_surface(original, collection, mats)
    reference = bpy.data.images.load(str(REFERENCE), check_existing=True)
    reference.pack()
    sheet_path = ROOT / 'art/premium/modelos-3d/referencias/pipoca-referencia-v1.png'
    bpy.data.images.load(str(sheet_path), check_existing=True).pack()
    scene['pipoca_visual_status'] = 'Review of appearance only; approval pending before retopology, rig and animation.'
    scene['pipoca_source_blend'] = str(SOURCE.relative_to(ROOT))
    scene['pipoca_reference'] = str(REFERENCE.relative_to(ROOT))
    camera.location = (0, -5, 0)
    point_at(camera, (0, 0, 0))
    workfile = OUTPUT / 'pipoca-identidade-v3.blend'
    if '--body-only' not in sys.argv:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.context.preferences.filepaths.file_preview_type = 'NONE'
        bpy.context.preferences.filepaths.use_auto_save_temporary_files = False
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type == 'VIEW_3D':
                    space = area.spaces.active
                    space.shading.type = 'MATERIAL'
                    space.shading.use_scene_world = True
                    space.shading.use_scene_lights = True
                    space.region_3d.view_perspective = 'CAMERA'
        bpy.ops.wm.save_as_mainfile(filepath=str(workfile))
    views = render_views(scene, camera, 'corpo-' if '--body-only' in sys.argv else '')
    orbit=render_orbit(scene,camera) if '--quick' not in sys.argv and '--body-only' not in sys.argv else []
    report = {
        'stage': 'visual identity review before rigging',
        'approved': False,
        'source': str(SOURCE.relative_to(ROOT)),
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'reference': str(REFERENCE.relative_to(ROOT)),
        'referenceSha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
        'workfile': str(workfile.relative_to(ROOT)),
        'blender': bpy.app.version_string,
        'bodyAdjustments': changes,
        'sourceSurfaceMaterialFaces': regions,
        'face': face_report,
        'visibleObjects': [{'name':o.name, 'type':o.type,
                            'vertices':len(o.data.vertices) if o.type=='MESH' else None}
                           for o in collection.objects],
        'views': views,
        'orbit360':orbit,
        'limitations': [
            'No artistic approval is implied by this file or its renders.',
            'The original combat stance is preserved; a neutral A pose and deformable retopology are not yet produced.',
            'The source UV layer is kept for editing. Procedural shading needs baking after final topology is approved.',
            'No rig, weights or combat clips have been created. Existing game assets remain unchanged.',
        ],
    }
    if '--body-only' not in sys.argv:
        report['workfileSha256'] = hashlib.sha256(workfile.read_bytes()).hexdigest()
        (OUTPUT / 'revisao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('PIPOCA_REFINEMENT '+json.dumps({'body':changes,'face':face_report,'views':views}), flush=True)


if __name__ == '__main__':
    main()
