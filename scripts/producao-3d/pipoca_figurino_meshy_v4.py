"""Tailored outfit fields for the Meshy v1 work copy. Import is inert."""

import math
from collections import Counter, defaultdict
import bpy
from mathutils import Vector

_BASE = None
_BASE_OUTFIT = None
WRISTS = (
    ('E', Vector((-.222, -.118, .158)), Vector((.33, -.72, .61)).normalized()),
    ('D', Vector((.325, -.14, .185)), Vector((-.055, -.55, .835)).normalized()),
)
CUFF_BANDS = ((-.013, .003), (.029, .043))


def smoothstep(a, b, value):
    t = max(0.0, min(1.0, (value-a)/(b-a)))
    return t*t*(3.0-2.0*t)


def configure(base_module):
    """Replace only in-memory outfit functions; keep output control in caller."""
    global _BASE, _BASE_OUTFIT
    if _BASE is None:
        _BASE_OUTFIT = base_module.outfit_details
    _BASE = base_module
    base_module.assign_body_regions = assign_regions
    base_module.cut_material_boundaries = cut_boundaries
    base_module.outfit_details = outfit_details
    return base_module


def _base():
    global _BASE, _BASE_OUTFIT
    if _BASE is None:
        import importlib.util
        from pathlib import Path
        path=Path(__file__).with_name('refinar-identidade-meshy-pipoca.py')
        spec=importlib.util.spec_from_file_location('pipoca_v4_outfit_base',path)
        _BASE=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_BASE)
        _BASE_OUTFIT=_BASE.outfit_details
    return _BASE


def _torso_center(z):
    # Breast center X=-.03 moves to +.018 at the raised shoulders.
    return -.030 + .30*(z-.14)


def _top_width(z):
    return .137 - .031*smoothstep(.15, .235, z)


NECK_X = -.009  # neck axis measured at z=.32 on the Meshy copy
STRAP_RADIUS = .019
# Reference sheet: straps rise from the cups, cross the shoulder beside the
# neck and meet between the shoulder blades (racerback Y). Guides are snapped
# to the deformed torso at build time, so the strap follows the real surface.
STRAP_GUIDES = ((.072, -.075, .225), (.078, -.045, .272), (.082, .035, .312),
                (.070, .095, .270), (.036, .108, .215), (.0, .112, .178),
                (.0, .112, .130))
_STRAPS = []


def _top_upper(p):
    """Cups: U neckline and armhole in front, low racerback panel behind."""
    x = abs(p.x-_torso_center(p.z))
    front = min(.190+.185*min(1.0, (x/.108)**2), .262-2.4*max(0.0, x-.090))-p.z
    # Rounded underarm corner where the back panel meets the side seam.
    back = (.140+.065*(1.0-smoothstep(.020, .100, abs(p.x-NECK_X)))
            -1.5*max(0.0, x-.110)-p.z)
    w = smoothstep(-.005, .040, p.y)
    return front*(1.0-w)+back*w


def build_straps(obj):
    """Snap both strap paths onto the current torso surface."""
    from mathutils.bvhtree import BVHTree
    mesh = obj.data
    faces = [list(f.vertices) for f in mesh.polygons
             if .05 < f.center.z < .36 and abs(f.center.y) < .2]
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], faces)
    _STRAPS.clear()
    for side in (-1, 1):
        # Front anchors follow the cup centre so strap and scoop meet on
        # both sides; shoulder and back anchors follow the neck axis.
        path = [tree.find_nearest(Vector(
                    ((_torso_center(z) if y < 0 else NECK_X)+side*x, y, z)))[0]
                for x, y, z in STRAP_GUIDES]
        for _ in range(4):
            dense = [path[0]]
            for a, b in zip(path, path[1:]):
                dense += [tree.find_nearest((a+b)/2)[0], b]
            path = dense
        # Nearest-point snapping zigzags a few mm on the bumpy sculpt;
        # Laplacian passes keep the strap edges straight like sewn fabric.
        for _ in range(12):
            path = [path[0]]+[(a+2*b+c)/4 for a, b, c in
                              zip(path, path[1:], path[2:])]+[path[-1]]
        # Meshy terracing makes face normals jump; a smooth frame keeps the
        # strap width independent of those micro steps.
        normals = [tree.find_nearest(p)[1] for p in path]
        for _ in range(24):
            normals = [normals[0]]+[(a+2*b+c).normalized() for a, b, c in
                                    zip(normals, normals[1:], normals[2:])]+[normals[-1]]
        segments = [(a, b-a, max((b-a).length_squared, 1e-12), na, nb)
                    for a, b, na, nb in zip(path, path[1:], normals, normals[1:])]
        # Early-out margin exceeds the longest edge (.04) so edges crossing
        # the strap boundary always interpolate exact field values.
        pad = STRAP_RADIUS+.05
        lo = Vector([min(p[i] for p in path)-pad for i in range(3)])
        hi = Vector([max(p[i] for p in path)+pad for i in range(3)])
        _STRAPS.append((segments, lo, hi))
    return {'strapRadius':STRAP_RADIUS, 'strapLengths':[
        round(sum(math.sqrt(s[2]) for s in strap[0]), 4) for strap in _STRAPS]}


def _strap(index):
    def field(p):
        segments, lo, hi = _STRAPS[index]
        if any(p[i] < lo[i] or p[i] > hi[i] for i in range(3)):
            return -.05
        best, lateral, depth = None, STRAP_RADIUS, 0.0
        for a, ab, l2, na, nb in segments:
            t = max(0.0, min(1.0, (p-a).dot(ab)/l2))
            d = p-(a+ab*t)
            if best is None or d.length_squared < best:
                # Width is measured in the skin's tangent plane, so depth
                # changes on the curved shoulder do not step the edge.
                best = d.length_squared
                n = na.lerp(nb, t).normalized()
                depth = d.dot(n)
                lateral = (d-n*depth).length
        # Depth guard keeps neck and arm skin behind the strap untouched.
        return min(STRAP_RADIUS-lateral, .03-abs(depth))
    return field


def _top_body(p):
    x = p.x-_torso_center(p.z)
    return min(p.z-.058, _top_width(p.z)-abs(x), _top_upper(p),
               p.y+.160, .160-p.y)


def _top(p):
    return max(_top_body(p), _strap(0)(p), _strap(1)(p))


def _wrist_coordinates(p, wrist, axis):
    q = p-wrist
    t = q.dot(axis)
    return t, (q-axis*t).length


def _own_side(p, side):
    return -.035-p.x if side == 'E' else p.x-.220


def _glove(p, side, wrist, axis):
    t, radial = _wrist_coordinates(p, wrist, axis)
    radius = .073 + .052*smoothstep(.045, .145, t)
    return min(t+.019, .375-t, radius-radial, _own_side(p, side), -.042-p.y)


def _cuff_band(p, side, wrist, axis, low, high):
    t, radial = _wrist_coordinates(p, wrist, axis)
    return min(t-low, high-t, .074-radial, _own_side(p, side), -.042-p.y)


def _foot(p):
    _, ankle, forward = _base().FEET[0 if p.x < 0 else 1]
    q = (p-ankle).dot(forward)
    return min(-.775-p.z, max(p.z+.884, min(.102-q, p.z+.942)))


# The Meshy tail balls are replaced by a separate tail object, so the old
# y>.225 tail carve-out would paint the rebuilt glutes as fur; .30 only
# guards against stray geometry.
def _waistband(p):
    waist = -.055+.18*(p.x-.035)
    return min(p.z-(waist-.029), waist+.007-p.z, .300-p.y)


def _shorts(p):
    waist = -.055+.18*(p.x-.035)
    return min(waist-p.z, p.z-_base().shorts_hem(p), .300-p.y)


def _fields():
    _base()
    fields = []
    for side, wrist, axis in WRISTS:
        for low, high in CUFF_BANDS:
            fields.append(('faixas', lambda p,s=side,w=wrist,a=axis,l=low,h=high:
                           _cuff_band(p,s,w,a,l,h)))
        fields.append(('couro', lambda p,s=side,w=wrist,a=axis:_glove(p,s,w,a)))
    fields.extend((('faixas', _foot), ('faixas', _waistband),
                   ('tecido', _shorts), ('tecido', _top)))
    return fields


_GLOVE_FACES = {'E': set(), 'D': set()}
_CURRENT_FACE = [-1]


def build_gloves(mesh):
    """The fist and thumb bulge past any cylinder, and Meshy fused the left
    glove into the chest. Split by geodesic competition over the faces:
    glove seeds along the fist core, body seeds on everything clearly body;
    each face joins the nearer seed set across the surface."""
    import heapq
    edge_faces = defaultdict(list)
    for face in mesh.polygons:
        for key in face.edge_keys:
            edge_faces[key].append(face.index)
    centres = [f.center.copy() for f in mesh.polygons]
    report = {}
    for side, wrist, axis in WRISTS:
        coords = [_wrist_coordinates(c, wrist, axis) for c in centres]
        owner, dist, heap = {}, {}, []
        for i, (t, radial) in enumerate(coords):
            c = centres[i]
            if .03 < t and radial < .085:
                label = 1
            elif t < -.03 or radial > .26:
                label = 0
            else:
                continue
            owner[i], dist[i] = label, 0.0
            heapq.heappush(heap, (0.0, i))
        while heap:
            d, i = heapq.heappop(heap)
            if d > dist[i]:
                continue
            for key in mesh.polygons[i].edge_keys:
                for j in edge_faces[key]:
                    nd = d+(centres[j]-centres[i]).length
                    if nd < dist.get(j, 1e9):
                        dist[j], owner[j] = nd, owner[i]
                        heapq.heappush(heap, (nd, j))
        found = {i for i, label in owner.items() if label == 1 and coords[i][0] > -.025}
        _GLOVE_FACES[side] = found
        report[side] = len(found)
    return report


def _cut_regions():
    # Clip intersecting slabs one plane at a time. Interpolating min(low,high)
    # across a whole triangle shifts band edges and misses fully crossed bands.
    regions=[]
    for side,wrist,axis in WRISTS:
        for low,high in CUFF_BANDS:
            regions.append(('faixas',[
                lambda p,w=wrist,a=axis,l=low:(p-w).dot(a)-l,
                lambda p,w=wrist,a=axis,h=high:h-(p-w).dot(a),
                lambda p,w=wrist,a=axis:.074-_wrist_coordinates(p,w,a)[1],
                lambda p,s=side:_own_side(p,s),
                lambda p:-.042-p.y]))
        # The fist and thumb bulge past any cylinder; the glove is the face
        # set flooded from the wrist ring (build_gloves), cut at the wrist plane.
        regions.append(('couro',[
            lambda p,w=wrist,a=axis:(p-w).dot(a)+.019,
            lambda p,s=side:1.0 if _CURRENT_FACE[0] in _GLOVE_FACES[s] else -1.0]))
    regions.extend((('faixas',[_foot]),
                    ('faixas',[lambda p:p.z-(-.055+.18*(p.x-.035)-.029),
                               lambda p:-.055+.18*(p.x-.035)+.007-p.z,
                               lambda p:.300-p.y]),
                    ('tecido',[lambda p:-.055+.18*(p.x-.035)-p.z,
                               lambda p:p.z-_base().shorts_hem(p),
                               lambda p:.300-p.y]),
                    # Each side is a separate clipping constraint. A single
                    # min field can be negative at both ends of an edge that
                    # crosses a narrow strap, losing the whole garment strip.
                    ('tecido',[lambda p:p.z-.058,
                               lambda p:_top_width(p.z)-(p.x-_torso_center(p.z)),
                               lambda p:_top_width(p.z)+(p.x-_torso_center(p.z)),
                               _top_upper,
                               lambda p:p.y+.160,
                               lambda p:.160-p.y]),
                    # Straps are union regions; mesh edges (p95 .017) stay
                    # below the strap width, so one distance field is safe.
                    ('tecido',[_strap(0)]),
                    ('tecido',[_strap(1)])))
    return regions


def assign_regions(obj, mats):
    build_straps(obj)
    obj.data.materials.clear()
    for material in mats.values():
        obj.data.materials.append(material)
    indices = {key:i for i,key in enumerate(mats)}
    fields = _fields()
    counts = Counter()
    for face in obj.data.polygons:
        name = 'pelagem'
        if face.center.z < .39:
            name = next((key for key,field in fields if field(face.center) >= 0), name)
        face.material_index = indices[name]
        face.use_smooth = True
        counts[name] += 1
    obj.data.update()
    return dict(counts)


def cut_boundaries(obj, mats):
    """Cut signed-field crossings, preserving UVs and shared mesh vertices."""
    mesh = obj.data
    indices = {key:next(i for i,m in enumerate(mesh.materials) if m==mat)
               for key,mat in mats.items()}
    source_uv = mesh.uv_layers.active
    coordinates, polygons, materials, texcoords = [], [], [], []
    lookup = {}
    gloves = build_gloves(mesh)
    regions = _cut_regions()
    from pipoca_rosto_meshy_v4 import ear_regions, is_ear_face
    ears = ear_regions(mesh)

    def clip(poly, field, positive):
        result = []
        if not poly:
            return result
        previous = poly[-1]
        fp = field(previous[0])
        previous_inside = fp >= 0 if positive else fp < 0
        for current in poly:
            fc = field(current[0])
            current_inside = fc >= 0 if positive else fc < 0
            if current_inside != previous_inside:
                t = max(0.0, min(1.0, fp/(fp-fc)))
                result.append((previous[0].lerp(current[0], t),
                               previous[1].lerp(current[1], t)))
            if current_inside:
                result.append(current)
            previous, fp, previous_inside = current, fc, current_inside
        return result

    def append(poly, mat):
        if len(poly) < 3:
            return
        ids, uvs = [], []
        for point, uv in poly:
            key = tuple(round(v, 6) for v in point)
            if key not in lookup:
                lookup[key] = len(coordinates)
                coordinates.append(tuple(point))
            vi = lookup[key]
            if not ids or vi != ids[-1]:
                ids.append(vi)
                uvs.append(uv)
        if len(ids)>1 and ids[0]==ids[-1]:
            ids.pop()
            uvs.pop()
        if len(set(ids)) < 3:
            return
        area = Vector((0,0,0))
        origin = Vector(coordinates[ids[0]])
        for i in range(1,len(ids)-1):
            area += (Vector(coordinates[ids[i]])-origin).cross(
                Vector(coordinates[ids[i+1]])-origin)
        if area.length_squared < 1e-20:
            return
        polygons.append(ids)
        texcoords.append(uvs)
        materials.append(mat)

    for face in mesh.polygons:
        _CURRENT_FACE[0] = face.index
        poly = [(mesh.vertices[vi].co.copy(),
                 source_uv.data[li].uv.copy() if source_uv else Vector((0,0)))
                for vi,li in zip(face.vertices,face.loop_indices)]
        if face.center.z >= .39 and any(face.index in g for g in _GLOVE_FACES.values()):
            # The raised right fist reaches head height.
            append(poly, indices['couro'])
            continue
        if face.center.z >= .39:
            # Ear interiors are cut on the ear surface itself, concave side only.
            ear = next(((front, field, interior) for side, front, field, interior in ears
                        if is_ear_face(face, side)), None)
            if ear and ear[2](face):
                append(clip(poly, ear[1], True), indices['interior_orelha'])
                append(clip(poly, ear[1], False), face.material_index)
            else:
                append(poly, face.material_index)
            continue
        pending = [poly]
        for name, constraints in regions:
            leftovers = []
            for fragment in pending:
                inside = fragment
                for constraint in constraints:
                    outside = clip(inside,constraint,False)
                    if len(outside)>=3:
                        leftovers.append(outside)
                    inside = clip(inside,constraint,True)
                    if len(inside)<3:
                        break
                append(inside,indices[name])
            pending = leftovers
            if not pending:
                break
        for fragment in pending:
            append(fragment,indices['pelagem'])

    output = bpy.data.meshes.new('Pipoca | v4 tailored editable outfit contours')
    output.from_pydata(coordinates, [], polygons)
    for mat in mesh.materials:
        output.materials.append(mat)
    uv_layer = output.uv_layers.new(name='SourceUV_editing_only')
    for face,mat,uvs in zip(output.polygons, materials, texcoords):
        face.material_index = mat
        face.use_smooth = True
        for li,uv in zip(face.loop_indices,uvs):
            uv_layer.data[li].uv = uv
    output.update()
    obj.data = output
    report = {'vertices':len(output.vertices), 'faces':len(output.polygons),
              'wristBands':'independent oblique planes',
              'top':'U scoop front, low back panel, surface-snapped racerback straps',
              'gloveFaces':gloves}
    obj['pipoca_v4_outfit'] = str(report)
    print('PIPOCA_V4_OUTFIT_CONTOURS', report, flush=True)
    return report


def _contour_chains(obj, first, second, predicate):
    """Return ordered material-boundary chains instead of centroid masks."""
    mesh = obj.data
    uses = defaultdict(list)
    for face in mesh.polygons:
        for edge in face.edge_keys:
            uses[edge].append(face)
    edges = set()
    for edge,faces in uses.items():
        if len(faces) != 2:
            continue
        mats = {mesh.materials[f.material_index] for f in faces}
        if first in mats and second in mats and all(predicate(f.center) for f in faces):
            edges.add(tuple(edge))
    graph = defaultdict(set)
    for a,b in edges:
        graph[a].add(b)
        graph[b].add(a)
    chains=[]
    while edges:
        candidates = [v for v in graph if len(graph[v])==1]
        start = candidates[0] if candidates else next(iter(edges))[0]
        chain, current, closed = [start], start, False
        while graph[current]:
            nxt=next(iter(graph[current]))
            graph[current].remove(nxt)
            graph[nxt].remove(current)
            edges.discard(tuple(sorted((current,nxt))))
            if nxt==start:
                closed=True
                break
            chain.append(nxt)
            current=nxt
        if len(chain)>3:
            chains.append(([mesh.vertices[i].co+mesh.vertices[i].normal*.0014
                            for i in chain],closed))
        for vi in chain:
            if vi in graph and not graph[vi]:
                del graph[vi]
    return chains


def _seam_material(mats):
    name = 'Pipoca refinamento | Indigo garment stitching v4'
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = mats['tecido'].copy()
        mat.name = name
        for node in mat.node_tree.nodes:
            if node.type == 'VALTORGB':
                for stop in node.color_ramp.elements:
                    c = stop.color
                    stop.color = (c[0]*1.40, c[1]*1.40, c[2]*1.27, c[3])
        mat.diffuse_color = tuple(c*1.2 for c in mat.diffuse_color[:3])+(1,)
    return mat


def _feet(obj, mats, collection):
    """Concept feet: white wraps with a red ankle band and a red strap across
    the instep near the toes. The base pass cast its bandage edges from
    above, so they snagged the shin and hung as vertical wires; rebuild them
    as arcs cast radially around the foot instead."""
    base = _base()
    for o in list(collection.objects):
        if any(k in o.name for k in ('instep bandage edge', 'red instep trim', 'red ankle trim')):
            bpy.data.objects.remove(o, do_unlink=True)
    up = Vector((0, 0, 1))
    made = 0
    for side, ankle, forward in base.FEET:
        lateral = Vector((-forward.y, forward.x, 0))
        own = lambda p, s=side: p.x < 0 if s == 'E' else p.x > 0
        tree = base.surface_tree(obj, lambda p: p.z < -.70 and own(p))
        # Below the ankle only, so casts from above cannot snag the shin.
        foot = base.surface_tree(obj, lambda p: p.z < -.80 and own(p))

        def arc(q, z, start, end, steps, offset, across=up, surface=foot):
            middle = ankle+forward*q
            middle.z = z
            points = []
            for i in range(steps+1):
                a = start+(end-start)*i/steps
                d = lateral*math.cos(a)+across*math.sin(a)
                p = base.ray_surface(surface, middle+d*.35, -d, offset)
                if p is not None:
                    points.append(p)
            return points

        band = arc(0, -.783, 0, math.tau, 64, .0030, forward, tree)
        base.curve(f'Pipoca | {side} red ankle band', band, .0042, mats['couro'], collection, True)
        for q in (.030, .065, .100):
            edge = arc(q, -.905, math.radians(12), math.radians(168), 28, .0018)
            base.curve(f'Pipoca | {side} wrap edge {q}', edge, .0013, mats['faixas'], collection)
        strap = arc(.115, -.905, math.radians(8), math.radians(172), 32, .0030)
        base.curve(f'Pipoca | {side} red instep strap', strap, .0036, mats['couro'], collection)
        made += 5
    return {'footDetails': made}


def outfit_details(obj, mats, collection):
    base = _base()
    # Keep measured shorts stripes, waist label and foot accessories.
    _BASE_OUTFIT(obj,mats,collection)
    feet = _feet(obj, mats, collection)
    stitch = _seam_material(mats)
    top_chains = _contour_chains(obj,mats['tecido'],mats['pelagem'],
                                lambda p:.045<p.z<.34)
    for i,(points,closed) in enumerate(top_chains):
        base.curve(f'Pipoca | v4 top neckline armholes and hem seam {i}',
                   points,.0012,stitch,collection,closed)
    cuffs = _contour_chains(obj,mats['faixas'],mats['couro'],
                            lambda p:.09<p.z<.31)
    for i,(points,closed) in enumerate(cuffs):
        base.curve(f'Pipoca | v4 fitted glove cuff seam {i}',
                   points,.0009,mats['couro'],collection,closed)
    tree = base.surface_tree(obj,lambda p:-.14<p.z<-.02 and p.y<.300)
    center=Vector((.035,.060,-.055))
    for i in range(96):
        angle=math.tau*i/96
        radial=Vector((math.cos(angle),math.sin(angle),.18*math.cos(angle)))
        points=[]
        for j in range(5):
            middle=center+Vector((0,0,-.023+.026*j/4))
            hit=base.ray_surface(tree,middle+radial*.65,-radial,.0044)
            if hit is not None:
                points.append(hit)
        base.curve(f'Pipoca | v4 waistband rib {i:02d}',points,.00040,
                   mats['faixas'],collection)
    report = {'topSeamChains':len(top_chains),'cuffSeamChains':len(cuffs),**feet,
              'waistbandRibs':96}
    print('PIPOCA_V4_OUTFIT_DETAILS',report,flush=True)
    return report
