"""Rosto v4: olhos assentados, contorno macio e sorriso da escultura Meshy.

Opera apenas na cópia de trabalho. A malha original e a revisão v3 permanecem
intactas; os objetos de expressão continuam separados para a futura retopologia.
"""
import math

import bpy
from mathutils import Matrix, Vector

import pipoca_rosto_meshy as base


def smooth(a, b, value):
    return base._smoothstep((value-a)/(b-a))


def sculpt(source):
    removed = base._remove_old_brow(source)
    vertices = source.data.vertices
    neighbors = [[] for _ in vertices]
    for edge in source.data.edges:
        a, b = edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    edited = set()
    # Remove o relevo de pálpebra fechado da geração antes de assentar os olhos.
    for vertex in vertices:
        p = vertex.co
        if not .45 < p.z < .608:
            continue
        before = p.copy()
        if p.y < -.025 and -.050 < p.x < .140:
            r = math.hypot((p.x-.052)/.079, (p.z-.515)/.077)
            w = 1-smooth(.48, 1.10, r)
            backing = -.092 + .16*(p.x-.055) + .025*(p.z-.51)
            p.y = p.y*(1-w) + backing*w
        if p.x > .085 and -.045 < p.y < .100:
            r = math.hypot((p.y-.017)/.072, (p.z-.515)/.077)
            w = 1-smooth(.48, 1.10, r)
            backing = .139 - .12*(p.y-.015) + .025*(p.z-.51)
            p.x = p.x*(1-w) + backing*w
        if (p-before).length > 1e-8:
            edited.add(vertex.index)
    # Relaxa pontas e queixo sem apagar os cantos da boca e o focinho.
    for _ in range(12):
        coordinates = [v.co.copy() for v in vertices]
        for vertex in vertices:
            p = coordinates[vertex.index]
            if not .386 < p.z < .60 or not neighbors[vertex.index]:
                continue
            rel = p-base.FACE_ORIGIN
            lateral = abs(rel.dot(base.LATERAL))
            frontal = rel.dot(base.FORWARD)
            cheek = smooth(.075, .145, lateral)*(1-smooth(.07,.14,frontal))
            jaw = (1-smooth(.411,.435,p.z)) * smooth(.386,.400,p.z)
            eye = 0.0
            if p.y < -.035 and -.04 < p.x < .14:
                eye = (1-smooth(.5,1.15,math.hypot((p.x-.052)/.079,(p.z-.515)/.077)))*.6
            weight = max(cheek*.5, jaw*.34, eye*.3)
            if weight:
                mean = sum((coordinates[i] for i in neighbors[vertex.index]),Vector())/len(neighbors[vertex.index])
                vertex.co = p.lerp(mean,weight)
                edited.add(vertex.index)
    source.data.update()
    return {'oldBrowVerticesRemoved': removed, 'smoothedVertices': len(edited),
            'mouth': 'Native muzzle and smile volumes preserved; jaw surface relaxed.'}


def head_warp(point):
    """Base head enlargement (+10% x/y), but faded in over z .33-.40. The base
    ramp went 0->100% within one centimetre right under the mouth, pushing the
    muzzle 1.8 cm over the jaw and leaving a ledge and knob at the lower lip."""
    p = Vector(point)
    if p.z <= .33:
        return p
    influence = smooth(.33, .40, p.z)*(1-smooth(.625, .74, p.z))
    centre = Vector((.015, .045, .51))
    p.x = centre.x+(p.x-centre.x)*(1+.10*influence)
    p.y = centre.y+(p.y-centre.y)*(1+.10*influence)
    p.z = centre.z+(p.z-centre.z)*(1+.025*influence)
    return p


def enlarge_head(source, accessories):
    count = 0
    for vertex in source.data.vertices:
        if vertex.co.z > .33:
            vertex.co = head_warp(vertex.co)
            count += 1
    source.data.update()
    inverse = source.matrix_world.inverted()
    for accessory in accessories:
        to_source = inverse@accessory.matrix_world
        back = to_source.inverted()
        for vertex in accessory.data.vertices:
            vertex.co = back@head_warp(to_source@vertex.co)
        accessory.data.update()
    return count


def smooth_head(source):
    """Taubin pass over the skull (Meshy dents, crumpled cheek tufts, the
    nose-bridge crease) plus a stronger one on the serrated jaw underside."""
    import numpy as np
    mesh = source.data
    co = np.array([v.co[:] for v in mesh.vertices])
    edges = np.array(mesh.edge_keys)
    deg = np.bincount(edges.ravel(), minlength=len(co))[:, None].clip(1)
    z = co[:, 2]
    s = lambda a, b: np.clip((z-a)/(b-a), 0, 1)**2*(3-2*np.clip((z-a)/(b-a), 0, 1))
    head = (s(.36, .385)*(1-s(.60, .66)))[:, None]
    jaw = (s(.36, .38)*(1-s(.40, .418)))[:, None]
    # Cheek tufts: Meshy left them crumpled; keep the big points, drop chips.
    rel = co-np.array([.015, .045, .51])
    side = np.abs(rel@np.array(base.LATERAL[:]))
    front = rel@np.array(base.FORWARD[:])
    tuft = (np.clip((side-.06)/.025, 0, 1)*np.clip((.09-front)/.04, 0, 1)
            *s(.37, .40)*(1-s(.53, .56)))[:, None]
    for weight, passes in ((head, 10), (jaw, 24), (tuft, 30)):
        for _ in range(passes):
            for factor in (.5, -.53):
                avg = np.zeros_like(co)
                np.add.at(avg, edges[:, 0], co[edges[:, 1]])
                np.add.at(avg, edges[:, 1], co[edges[:, 0]])
                co += factor*weight*(avg/deg-co)
    mesh.vertices.foreach_set('co', co.ravel())
    mesh.update()
    # Meshy's own far-eye socket left a dent on the nose bridge, right at the
    # inner corner of the repositioned eye: fill it with plain Laplacian.
    probe = base.FACE_ORIGIN+base.LATERAL*.028+base.FORWARD*.30
    probe.z = .50
    dent = base._surface(source, probe, base.FORWARD, probe)
    d = np.linalg.norm(co-np.array(dent[:]), axis=1)
    fill = np.clip((.026-d)/.012, 0, 1)[:, None]
    for _ in range(30):
        avg = np.zeros_like(co)
        np.add.at(avg, edges[:, 0], co[edges[:, 1]])
        np.add.at(avg, edges[:, 1], co[edges[:, 0]])
        co += .5*fill*(avg/deg-co)
    mesh.vertices.foreach_set('co', co.ravel())
    mesh.update()
    return int((head[:, 0] > 0).sum())


def mouth_point(source):
    origin = base.FACE_ORIGIN+base.FORWARD*.30
    origin.z = .414
    return base._surface(source, origin, base.FORWARD, origin)


def close_mouth_slit(source):
    """Meshy carved a parted-lip slit on the near side (z ~.404-.414): its
    rounded lower lip showed through as a white knob under the drawn smile.
    Delete the faces hidden behind the muzzle front inside that slit and
    patch the opening; sculpt_chin then irons the area."""
    import bmesh
    from mathutils.bvhtree import BVHTree
    f, l, o = base.FORWARD, base.LATERAL, base.FACE_ORIGIN
    bm = bmesh.new()
    bm.from_mesh(source.data)
    layer = bm.faces.layers.int.new('pipoca_mouth_patch')
    tree = BVHTree.FromBMesh(bm)

    def region(c, pad=0.0):
        rel = c-o
        return (-.06-pad < rel.dot(l) < .04+pad and .394-pad < c.z < .432+pad
                and rel.dot(f) > .09)
    doomed = []
    for face in bm.faces:
        c = face.calc_center_median()
        if not region(c):
            continue
        hit = tree.ray_cast(c+f*.3, -f, .6)[0]
        if hit is not None and (hit-c).dot(f) > .003:
            doomed.append(face)
    removed = len(doomed)
    bmesh.ops.delete(bm, geom=doomed, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    rim = [e for e in bm.edges if e.is_boundary and all(region(v.co, .015) for v in e.verts)]
    filled = bmesh.ops.holes_fill(bm, edges=rim, sides=0)['faces']
    if not filled:
        filled = [g for g in bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False,
                                                     edges=rim, normal=f)['geom']
                  if isinstance(g, bmesh.types.BMFace)]
    for face in filled:
        face[layer] = 1
    rim_set = set(rim)
    for _ in range(2):
        patch = [x for x in bm.faces if x[layer]]
        inner = list({e for x in patch for e in x.edges if e not in rim_set})
        bmesh.ops.subdivide_edges(bm, edges=inner, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[x for x in bm.faces if x[layer] and len(x.verts) > 3])
    rim_verts = {v for e in rim for v in e.verts}
    free = {v for x in bm.faces if x[layer] for v in x.verts} - rim_verts
    for _ in range(60):
        for v in free:
            n = [e.other_vert(v).co for e in v.link_edges]
            v.co = sum(n, Vector())/len(n)
    # Small leftover openings at the slit corners.
    stray = [e for e in bm.edges if e.is_boundary and all(region(v.co, .03) for v in e.verts)]
    if stray:
        bmesh.ops.holes_fill(bm, edges=stray, sides=0)
    bm.to_mesh(source.data)
    source.data.update()
    bm.free()
    return {'strayEdgesFilled': len(stray), 'slitFacesRemoved': removed, 'rimEdges': len(rim), 'patchFaces': len(filled)}


def sculpt_chin(source):
    """Concept: the chin is a soft continuation of the muzzle. Meshy left a
    small lump under the lip; iron the whole chin area first, then add one
    broad rounded volume just below the muzzle's front-to-underside turn."""
    import numpy as np
    m = mouth_point(source)
    f, l = base.FORWARD, base.LATERAL
    mesh = source.data
    co = np.array([v.co[:] for v in mesh.vertices])
    edges = np.array(mesh.edge_keys)
    deg = np.bincount(edges.ravel(), minlength=len(co))[:, None].clip(1)
    # New mouth base sits at z~.383 (user markup); iron around it.
    centre = np.array((m+Vector((0, 0, -.031)))[:])
    rel = co-centre
    lat = rel@np.array(l[:])
    depth = rel@np.array(f[:])
    near = np.exp(-(lat/.036)**2-(rel[:, 2]/.020)**2)*np.clip((depth+.05)/.03, 0, 1)
    # Meshy's sculpted lower-lip ridge runs along the muzzle edge (z .395-.40,
    # ~4.7 mm proud); the drawn smile replaces it.
    z = co[:, 2]
    ridge = (np.exp(-(lat/.045)**4)*np.clip((z-.387)/.004, 0, 1)*np.clip((.409-z)/.004, 0, 1)
             *np.clip((depth+.03)/.02, 0, 1))
    # The near muzzle pad overhangs ~1.8 cm at its lower corner and catches
    # light as a lump; the far pad is smooth, so relax only this corner.
    # Measured pre head-enlarge, the knob sits ~2.6 cm behind the mouth point.
    corner = np.exp(-((lat+.022)/.016)**2-((z-.399)/.012)**2)*np.clip((depth+.06)/.02, 0, 1)
    weight = np.clip(np.maximum(np.maximum(near*1.6, ridge), corner*1.8), 0, 1)[:, None]
    for _ in range(70):
        avg = np.zeros_like(co)
        np.add.at(avg, edges[:, 0], co[edges[:, 1]])
        np.add.at(avg, edges[:, 1], co[edges[:, 0]])
        co += .5*weight*(avg/deg-co)
    rel = co-centre
    lat = rel@np.array(l[:])
    depth = rel@np.array(f[:])
    # Polish the muzzle front (terraces, the patched slit's dimple) with Taubin
    # so the mouth groove and highlights read cleanly.
    rel = co-centre
    lat = rel@np.array(l[:])
    depth = rel@np.array(f[:])
    polish = (np.exp(-(lat/.065)**2-((co[:, 2]-.410)/.028)**2)
              *np.clip((depth+.05)/.03, 0, 1))[:, None]
    for _ in range(30):
        for factor in (.5, -.53):
            avg = np.zeros_like(co)
            np.add.at(avg, edges[:, 0], co[edges[:, 1]])
            np.add.at(avg, edges[:, 1], co[edges[:, 0]])
            co += factor*polish*(avg/deg-co)
    # Meshy's lower face recedes ~5 cm from nose base to jaw edge, so the
    # mouth sank in. Bring the lower muzzle and chin forward to follow the
    # muzzle line: full at the jaw edge, fading to zero at the nose base,
    # front of the head only, soft lateral falloff.
    rel = co-np.array(m[:])
    lat = rel@np.array(l[:])
    depth = rel@np.array(f[:])
    zz = co[:, 2]
    rise = np.clip((.435-zz)/.055, 0, 1)
    rise = rise*rise*(3-2*rise)
    fall = np.clip((zz-.345)/.03, 0, 1)
    project = (rise*fall*np.exp(-(lat/.052)**2)*np.clip((depth+.09)/.05, 0, 1))[:, None]
    co += project*np.array(f[:])*.022
    # Rounded chin below the mouth base, reading from front, side and below.
    # Concept: about 1.5 cm of soft chin under the lower lip before the jaw.
    rel = co-(centre+np.array((0, 0, -.012)))
    lat = rel@np.array(l[:])
    depth = rel@np.array(f[:])
    # Wider and lower than before so it reads round in 3/4, not pointed.
    bump = (np.exp(-(lat/.046)**2-(rel[:, 2]/.020)**2)*np.clip((depth+.05)/.035, 0, 1))[:, None]
    co += bump*(np.array(f[:])*.009+np.array((0, 0, -.008)))
    # Melt the chin into the jaw: Taubin over the chin, keeps volume.
    chin = (np.exp(-(lat/.05)**2-(rel[:, 2]/.026)**2)*np.clip((depth+.06)/.04, 0, 1))[:, None]
    for _ in range(15):
        for factor in (.5, -.53):
            avg = np.zeros_like(co)
            np.add.at(avg, edges[:, 0], co[edges[:, 1]])
            np.add.at(avg, edges[:, 1], co[edges[:, 0]])
            co += factor*chin*(avg/deg-co)
    mesh.vertices.foreach_set('co', co.ravel())
    mesh.update()
    return {'mouth': [round(c, 4) for c in m], 'ironedVertices': int((weight > .01).sum())}


def add_blush(source, material):
    """Soft pink cheeks from the concept, mixed into the fur shader with two
    object-space spherical falloffs (no decal geometry to retopologise)."""
    tree = material.node_tree
    nodes, links = tree.nodes, tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    feed = shader.inputs['Base Color'].links[0].from_socket
    coords = nodes.new('ShaderNodeTexCoord')
    mask = None
    centres = []
    for side in (-1, 1):
        normal = Vector((0, -1, 0)) if side < 0 else Vector((1, 0, 0))
        p = base.FACE_ORIGIN+base.FORWARD*.108+base.LATERAL*(.078*side)
        p.z = .452
        centre = head_warp(base._surface(source, p, normal, p))
        centres.append([round(c, 4) for c in centre])
        dist = nodes.new('ShaderNodeVectorMath')
        dist.operation = 'DISTANCE'
        dist.inputs[1].default_value = centre
        links.new(coords.outputs['Object'], dist.inputs[0])
        ramp = nodes.new('ShaderNodeMapRange')
        ramp.interpolation_type = 'SMOOTHERSTEP'
        ramp.inputs['From Min'].default_value = .036
        ramp.inputs['From Max'].default_value = .004
        links.new(dist.outputs['Value'], ramp.inputs['Value'])
        if mask is None:
            mask = ramp.outputs['Result']
        else:
            both = nodes.new('ShaderNodeMath')
            both.operation = 'MAXIMUM'
            links.new(mask, both.inputs[0])
            links.new(ramp.outputs['Result'], both.inputs[1])
            mask = both.outputs['Value']
    strength = nodes.new('ShaderNodeMath')
    strength.operation = 'MULTIPLY'
    strength.inputs[1].default_value = .55
    links.new(mask, strength.inputs[0])
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.label = 'Concept cheek blush'
    # Mix exposes float/vector/colour sockets under the same names.
    colour = lambda sockets, name: next(x for x in sockets if x.name == name and x.type == 'RGBA')
    colour(mix.inputs, 'B').default_value = (.80, .22, .26, 1)  # linear rose
    links.new(strength.outputs['Value'], mix.inputs['Factor'])
    links.new(feed, colour(mix.inputs, 'A'))
    links.new(colour(mix.outputs, 'Result'), shader.inputs['Base Color'])
    return {'centres': centres, 'radius': .036, 'strength': .55}


def outline(theta, inner, width, height):
    sine, cosine = math.sin(theta),math.cos(theta)
    return Vector((width*cosine,0,height*sine*(.87 if sine>=0 else .92)-.0065*inner*cosine))


def eye(source,mats,collection,near):
    name = 'próximo' if near else 'oposto'
    inner = 1 if near else -1
    # Concept: both eyes equal and a little closer to the muzzle; the far eye
    # mirrors the near one about the face axis (it sat 1.7 cm further back).
    width,height = (.040,.0405)
    forward,lateral = .127,.064
    origin = base.FACE_ORIGIN+base.FORWARD*forward+base.LATERAL*(-lateral if near else lateral)
    origin.z = .499 if near else .501
    frame = Matrix.Translation(origin) @ Matrix.Rotation(0 if near else math.radians(90),4,'Z')
    matrix = source.matrix_world@frame
    inverse = frame.inverted()
    normal = frame.to_3x3()@Vector((0,-1,0))
    objects=[]

    def on_lens(x,z,offset=0):
        point=Vector((x,0,z))
        attached=inverse@base._surface(source,frame@point,normal,frame@point,.0005)
        r2=(x/width)**2+(z/height)**2
        attached.y-=.006*max(0,1-r2)**.7+offset
        return attached

    def disk(label,material,center=(0,0),radii=(width,height),iris=False,offset=0):
        n,rings=64,12
        x0,z0=center
        verts=[on_lens(x0,z0,offset)]
        faces=[]
        for j in range(1,rings+1):
            r=j/rings
            for k in range(n):
                theta=math.tau*k/n
                p=Vector((x0+radii[0]*math.cos(theta)*r,0,z0+radii[1]*math.sin(theta)*r)) if iris else outline(theta,inner,*radii)*r
                verts.append(on_lens(p.x,p.z,offset))
        for k in range(n):
            faces.append((0,1+k,1+(k+1)%n))
        for j in range(rings-1):
            start=1+j*n
            for k in range(n):
                a,b=start+k,start+(k+1)%n
                faces.append((a,a+n,b+n,b))
        obj=base._object('V4 '+label+' '+name,verts,faces,material,collection,matrix)
        uv=obj.data.uv_layers.new(name='UV olhos')
        for polygon in obj.data.polygons:
            for li in polygon.loop_indices:
                p=obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv.data[li].uv=((p.x-x0)/radii[0]*.5+.5,(p.z-z0)/radii[1]*.5+.5)
        objects.append(obj)

    disk('Esclera',mats['olho_branco'])
    iris=(.010*inner,-.0015)
    disk('Íris âmbar',mats['iris'],iris,(.019,.0265),True,.0008)
    disk('Pupila',mats['pupila'],(iris[0]+inner*.001,-.0015),(.0118,.0178),True,.0014)
    for upper in (True,False):
        points=[]
        for k in range(65):
            theta=math.pi*k/64+(0 if upper else math.pi)
            p=outline(theta,inner,width,height)
            points.append(on_lens(p.x,p.z,.0010))
        objects.append(base._tube('V4 '+('Delineado superior ' if upper else 'Pálpebra inferior ')+name,
                                 points,.0038 if upper else .0012,mats['sobrancelha'] if upper else mats['pelagem'],
                                 collection,matrix,flatten=.55,
                                 taper=lambda t:.2+.8*math.sin(math.pi*t)**.45))
    outer=-inner
    for k in range(4):
        theta=(math.pi-.16-k*.15) if near else (.16+k*.15)
        p=outline(theta,inner,width,height)
        start=on_lens(p.x,p.z,.0015)
        tip=start+Vector((outer*(.014-k*.0017),-.004,.010+k*.001))
        objects.append(base._tube('V4 Cílio %s %s'%(k+1,name),base._sample_curve([start,start.lerp(tip,.55)+Vector((0,-.002,0)),tip],6),
                                 .0025,mats['sobrancelha'],collection,matrix,
                                 taper=lambda t:max(.025,(1-t)**.8),flatten=.7))
    brow_scale=1
    brow=[(-inner*.043*brow_scale,0,.053),(-inner*.024*brow_scale,0,.063),
          (-inner*.007*brow_scale,0,.061),(inner*.015*brow_scale,0,.049),(inner*.030*brow_scale,0,.041)]
    points=[]
    for p in base._sample_curve(brow,12):
        p=inverse@base._surface(source,frame@p,normal,frame@p,.0015)
        points.append(p)
    objects.append(base._tube('V4 Sobrancelha '+name,points,.0073,
                             mats['sobrancelha'],collection,matrix,flatten=.24,
                             taper=lambda t:.08+.92*smooth(0,.65,t)))
    for i,(dx,dz,size) in enumerate([(-.004,.011,(.0033,.0016,.0045)),(.005,-.010,(.0013,.0008,.0017))]):
        p=on_lens(iris[0]+dx,iris[1]+dz,.0022)
        objects.append(base._ellipsoid('V4 Brilho %s %s'%(i,name),size,mats['olho_branco'],collection,matrix@Matrix.Translation(p)))
    return objects


EAR_FRONT_DEG = 25  # reference: both coral interiors read from the front
_EAR_SIDES = []


def _ear_indices(co, side):
    import numpy as np
    lateral = (co-np.array(base.FACE_ORIGIN[:]))@np.array(base.LATERAL[:])
    return np.where((co[:, 2] > .63) & (np.sign(lateral) == side))[0]


def orient_ears(source):
    """Meshy splayed both ears ~65-70 deg sideways. Turn each about its own
    long axis (pivot at the base) so the concave interior faces the camera
    like the concept sheet; the turn fades in over the ear root."""
    import numpy as np
    verts = source.data.vertices
    co = np.array([v.co[:] for v in verts])
    report = []
    _EAR_SIDES.clear()
    for side in (-1, 1):
        idx = _ear_indices(co, side)
        e = co[idx]
        c = e.mean(0)
        _, _, vt = np.linalg.svd(e-c, full_matrices=False)
        axis = Vector(vt[0]) if vt[0][2] > 0 else -Vector(vt[0])
        u, v, w = (e-c)@vt[0], (e-c)@vt[1], (e-c)@vt[2]
        curv = np.linalg.lstsq(np.c_[np.ones_like(u), u, v, u*u, u*v, v*v], w, rcond=None)[0][5]
        # The sheet curls toward its concave (interior) side.
        front = Vector(vt[2]) if curv > 0 else -Vector(vt[2])
        pivot = Vector(c)+axis*float(((e-c)@np.array(axis[:])).min())
        f = base.FORWARD-axis*base.FORWARD.dot(axis)
        n = front-axis*front.dot(axis)
        angle = n.angle(f)
        turn = max(0.0, angle-math.radians(EAR_FRONT_DEG))
        sign = 1 if axis.dot(n.cross(f)) > 0 else -1
        lateral_side = lambda p: (p-base.FACE_ORIGIN).dot(base.LATERAL)*side > 0
        for vertex in verts:
            p = vertex.co
            if p.z < .60 or not lateral_side(p):
                continue
            weight = smooth(.60, .70, p.z)
            vertex.co = pivot+Matrix.Rotation(sign*turn*weight, 3, axis)@(p-pivot)
        _EAR_SIDES.append((side, Matrix.Rotation(sign*turn, 3, axis)@front))
        report.append({'side': side, 'beforeDeg': round(math.degrees(angle), 1),
                       'afterDeg': round(math.degrees(angle-turn), 1)})
    source.data.update()
    return report


def ear_regions(mesh):
    """Coral interior fields on the ear surface itself (no overlay sheet):
    inset from the measured outline so a cream rim frames it, only on faces
    of the concave side. Returns [(front, field)] for cut_boundaries."""
    import numpy as np
    co = np.array([v.co[:] for v in mesh.vertices])
    # Normals smoothed along the sheet: folds and ridges average out, while
    # the two sides (joined only at the rim) keep opposite orientation.
    normals = np.array([v.normal[:] for v in mesh.vertices])
    edges = np.array([e for e in mesh.edge_keys if co[e[0], 2] > .6 and co[e[1], 2] > .6])
    deg = np.bincount(edges.ravel(), minlength=len(co))[:, None].clip(1)
    for _ in range(40):
        avg = np.zeros_like(normals)
        np.add.at(avg, edges[:, 0], normals[edges[:, 1]])
        np.add.at(avg, edges[:, 1], normals[edges[:, 0]])
        normals = np.where(deg > 0, .5*normals+.5*avg/deg, normals)
    regions = []
    for side, front in _EAR_SIDES:
        e = co[_ear_indices(co, side)]
        c = e.mean(0)
        _, _, vt = np.linalg.svd(e-c, full_matrices=False)
        a0 = vt[0] if vt[0][2] > 0 else -vt[0]
        a1 = vt[1]
        a2 = vt[2] if float(vt[2]@np.array(front[:])) > 0 else -vt[2]
        u, v = (e-c)@a0, (e-c)@a1
        bins = np.linspace(u.min(), u.max(), 25)
        mids, lo, hi = [], [], []
        for b0, b1 in zip(bins, bins[1:]):
            m = (u >= b0) & (u < b1)
            if m.sum() > 8:
                mids.append((b0+b1)/2); lo.append(v[m].min()); hi.append(v[m].max())
        mids, lo, hi = map(np.array, (mids, lo, hi))
        span = u.max()-u.min()
        start, end = u.min()+.10*span, u.max()-.045*span

        def field(p, c=c, a0=a0, a1=a1, mids=mids, lo=lo, hi=hi, start=start, end=end, span=span):
            q = np.array(p[:])-c
            pu, pv = float(q@a0), float(q@a1)
            centre = float(np.interp(pu, mids, (lo+hi)/2))
            half = float(np.interp(pu, mids, (hi-lo)/2))
            # Cream rim ~20% of the half width; coral tapers into tip and root.
            taper = smooth(start, start+.12*span, pu)*(1-smooth(end-.18*span, end, pu))
            return min(.80*half*(.35+.65*taper)-abs(pv-centre), pu-start, end-pu)
        def interior_side(face, a2=a2):
            return float(normals[list(face.vertices)].sum(0)@a2) > 0
        regions.append((side, front, field, interior_side))
    return regions


def is_ear_face(face, side):
    p = face.center
    return p.z > .63 and (p-base.FACE_ORIGIN).dot(base.LATERAL)*side > 0


MOUTH_BASE = .383  # just above the face's lower edge (z~.378 before head warp)


def mouth_curve(side, lift):
    """User markup on the front render: wide U wrapping the muzzle bottom,
    corners up at the cheeks near nose-base height, flat base above the chin."""
    b = MOUTH_BASE
    # Curvature ramps gradually (no corner where the base meets the rise).
    return [(.0, b), (.015, b+.001), (.028, b+.004), (.040, b+.010),
            (.051, b+.019), (.062, b+.030+lift*.3), (.072, b+.041+lift*.7),
            (.080, b+.050+lift)]


def carve_groove(source, curves, depth=.0015, width=.0035):
    """Press a shallow crease under the drawn line so it shades like the
    concept's mouth instead of reading as a painted stroke."""
    from mathutils.kdtree import KDTree
    pts = [p for c in curves for p in c]
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    moved = 0
    for v in source.data.vertices:
        _, _, d = kd.find(v.co)
        if d < 2.5*width:
            v.co -= v.normal*depth*math.exp(-(d/width)**2)
            moved += 1
    source.data.update()
    return moved


def snap_curve(tree, points, offset=0.0, passes=4):
    """Front-ray projection slides on the muzzle's side walls and kinks the
    line; settle it on the nearest skin with 3D smoothing in between."""
    pts = [tree.find_nearest(Vector(p))[0] for p in points]
    for _ in range(passes):
        pts = [pts[0]]+[(a+2*b+c)/4 for a, b, c in zip(pts, pts[1:], pts[2:])]+[pts[-1]]
        pts = [tree.find_nearest(p)[0] for p in pts]
    if offset:
        pts = [p+tree.find_nearest(p)[1]*offset for p in pts]
        # Final passes without re-snapping keep the stroke fluid over the
        # sculpt's micro terraces (drift stays under the offset).
        for _ in range(8):
            pts = [pts[0]]+[(a+2*b+c)/4 for a, b, c in zip(pts, pts[1:], pts[2:])]+[pts[-1]]
    return pts


def smile(source,mats,collection):
    from mathutils.bvhtree import BVHTree
    f,u=base.FORWARD,base.LATERAL
    mesh=source.data
    def skin():
        return BVHTree.FromPolygons([v.co for v in mesh.vertices],[list(p.vertices) for p in mesh.polygons])
    objects=[]
    center=base.FACE_ORIGIN
    def project(lateral, z, offset):
        p=center+u*lateral+f*.22
        p.z=z
        return base._surface(source,p,f,p,offset)
    # One continuous stroke corner to corner (two halves met in a V);
    # her left corner (+lateral) sits a touch higher: confident smirk.
    near=[(-lat,z) for lat,z in reversed(mouth_curve(-1,0))]
    far=[(lat,z) for lat,z in mouth_curve(1,.003)][1:]
    points=[project(lat,z,0) for lat,z in near+far]
    curves=[snap_curve(skin(),base._sample_curve(points,12))]
    top=center+f*.22; top.z=.432
    philtrum=[(0,.432+(MOUTH_BASE+.003-.432)*t/10) for t in range(11)]
    curves.append([project(0,z,0) for _,z in philtrum])
    # Wider, softer crease: shades like a closed-lip seam, no hard cut.
    groove=carve_groove(source,curves,depth=.002,width=.005)
    tree=skin()
    # Lip-weight stroke: full in the middle, tapering softly into the cheeks,
    # wider than deep like the concept's painted lip line.
    projected=snap_curve(tree,curves[0],.0012,2)
    objects.append(base._tube('V4 Sorriso',projected,.0026,mats['boca'],collection,
                             source.matrix_world,normal_hint=f,
                             taper=lambda t:.12+.88*math.sin(math.pi*t)**.55,flatten=.45))
    line=[project(0,z,.0006) for _,z in philtrum]
    objects.append(base._tube('V4 Filtro labial',line,.0011,mats['boca'],collection,
                             source.matrix_world,normal_hint=f,
                             taper=lambda t:.35+.65*math.sin(math.pi*t)**.5,flatten=.55))
    # Fuller pink lower lip under the flat base, as in the concept.
    lip=[project(-.022+.044*k/16,MOUTH_BASE-.0036+.0016*(abs(-.022+.044*k/16)/.022)**2,0)
         for k in range(17)]
    lip=snap_curve(tree,lip,.0008,2)
    objects.append(base._tube('V4 Lábio inferior',lip,.0023,mats['nariz'],collection,
                             source.matrix_world,normal_hint=f,
                             taper=lambda t:.15+.85*math.sin(math.pi*t)**.6,flatten=.5))
    objects[0]['pipoca_groove_vertices']=groove
    return objects


def refinar_rosto(source,mats,collection):
    diagnosis=sculpt(source)
    diagnosis['headSmoothedVertices']=smooth_head(source)
    diagnosis['mouthSlit']=close_mouth_slit(source)
    diagnosis['chin']=sculpt_chin(source)
    base._head_materials(source,mats)
    bpy.context.view_layer.update()
    diagnosis['ears']=orient_ears(source)
    objects=eye(source,mats,collection,True)+eye(source,mats,collection,False)
    sample=base.FACE_ORIGIN+base.FORWARD*.20
    sample.z=.442
    nose=base._surface(source,sample,base.FORWARD,sample,.0022)
    frame=base._basis(source,nose,math.pi/4)
    objects.append(base._ellipsoid('V4 Nariz rosa',(.019,.010,.011),mats['nariz'],collection,frame,nose=True))
    objects+=smile(source,mats,collection)
    diagnosis['blush']=add_blush(source,mats['pelagem'])
    diagnosis['enlargedHeadVertices']=enlarge_head(source,objects)
    diagnosis['changes']=['Almond eyes conform to the skull without floating eyelid plates.',
                          'Upper lashes, arched brows and amber irises follow the concept.',
                          'Ear inserts have an inset cream margin.',
                          'Smile follows the native muzzle; jaw and cheek tips softened.']
    return {'objects':[o.name for o in objects],'diagnostics':diagnosis}
