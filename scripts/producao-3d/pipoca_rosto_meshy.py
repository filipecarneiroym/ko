"""Rosto para a revisão de identidade da cópia Meshy da Pipoca.

As coordenadas são locais ao Meshy v1, cuja cabeça olha para +X/-Y.
Não salva arquivos, não cria rig e não altera vértices abaixo de Z=.39.
Olhos são lentes rasas com borda de pele, não esferas pousadas no rosto.
"""
import math

import bpy
import bmesh
from mathutils import Matrix, Vector


PREFIX = "Pipoca identidade | "
FORWARD = Vector((2 ** -.5, -(2 ** -.5), 0))
LATERAL = Vector((2 ** -.5, 2 ** -.5, 0))
FACE_ORIGIN = Vector((.015, .04, 0))
EYE_WIDTH = .0355
EYE_HEIGHT = .0415
EYE_DEPTH = .006


def _smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def _material_slot(obj, material):
    for index, item in enumerate(obj.data.materials):
        if item == material:
            return index
    obj.data.materials.append(material)
    return len(obj.data.materials) - 1


def _object(name, vertices, faces, material, collection, matrix):
    mesh = bpy.data.meshes.new(PREFIX + name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    result = bpy.data.objects.new(PREFIX + name, mesh)
    collection.objects.link(result)
    result.matrix_world = matrix
    result["pipoca_revisao_visual"] = True
    result["pipoca_etapa"] = "identidade na guarda original; aprovação necessária antes de rig"
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return result


def _basis(source, origin, angle=0.0):
    return source.matrix_world @ Matrix.Translation(Vector(origin)) @ Matrix.Rotation(angle, 4, 'Z')


def _sample_curve(points, steps=12):
    """Interpolação Catmull-Rom para contornos contínuos e extremidades finas."""
    points = [Vector(point) for point in points]
    output = []
    for i in range(len(points) - 1):
        p0, p1 = points[max(0, i - 1)], points[i]
        p2, p3 = points[i + 1], points[min(len(points) - 1, i + 2)]
        for k in range(steps):
            t = k / steps
            output.append((p1 * 2 + (p2 - p0) * t +
                           (p0 * 2 - p1 * 5 + p2 * 4 - p3) * t * t +
                           (-p0 + p1 * 3 - p2 * 3 + p3) * t * t * t) * .5)
    output.append(points[-1])
    return output


def _tube(name, points, radius, material, collection, matrix,
          *, taper=None, normal_hint=(0, -1, 0), flatten=1.0, sides=8):
    points = [Vector(point) for point in points]
    vertices, faces = [], []
    hint = Vector(normal_hint)
    for i, point in enumerate(points):
        tangent = points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]
        tangent.normalize()
        along = tangent.cross(hint)
        if along.length < .001:
            along = tangent.cross(Vector((1, 0, 0)))
        along.normalize()
        depth = tangent.cross(along).normalized()
        factor = taper(i / max(1, len(points) - 1)) if taper else 1.0
        for k in range(sides):
            angle = math.tau * k / sides
            vertices.append(point + radius * factor *
                            (along * math.cos(angle) + depth * math.sin(angle) * flatten))
        if i:
            for k in range(sides):
                a, b = (i - 1) * sides + k, (i - 1) * sides + (k + 1) % sides
                faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(range(sides - 1, -1, -1)),
                  tuple((len(points) - 1) * sides + k for k in range(sides))])
    return _object(name, vertices, faces, material, collection, matrix)


def _ellipsoid(name, scale, material, collection, matrix, *, nose=False):
    vertices, faces = [], []
    segments, rings = 40, 24
    for j in range(rings + 1):
        phi = math.pi * j / rings
        for i in range(segments):
            theta = math.tau * i / segments
            x, y, z = math.sin(phi) * math.cos(theta), math.sin(phi) * math.sin(theta), math.cos(phi)
            if nose:
                # Triângulo macio: topo largo e ponta inferior curta.
                x *= .74 + .26 * z
            vertices.append((x * scale[0], y * scale[1], z * scale[2]))
    for j in range(rings):
        for i in range(segments):
            a, b = j * segments + i, j * segments + (i + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    return _object(name, vertices, faces, material, collection, matrix)


def _outline(theta, inner, width=EYE_WIDTH, height=EYE_HEIGHT):
    sine, cosine = math.sin(theta), math.cos(theta)
    return Vector((width * cosine, 0,
                   height * sine * (.94 if sine >= 0 else 1.0) - .0045 * inner * cosine))


def _lens_y(x, z, width=EYE_WIDTH, height=EYE_HEIGHT):
    radius2 = (x / width) ** 2 + (z / height) ** 2
    return -EYE_DEPTH * math.sqrt(max(.005, 1.0 - radius2))


def _disk(name, material, collection, matrix, *, inner=1, iris=False,
          offset=(0, 0), radii=(EYE_WIDTH, EYE_HEIGHT), front_offset=0.0,
          lens_radii=(EYE_WIDTH, EYE_HEIGHT)):
    vertices, faces = [], []
    segments, rings = 64, 10
    ox, oz = offset
    vertices.append((ox, _lens_y(ox, oz, *lens_radii) - front_offset, oz))
    for j in range(1, rings + 1):
        r = j / rings
        for i in range(segments):
            theta = math.tau * i / segments
            if iris:
                x, z = ox + radii[0] * math.cos(theta) * r, oz + radii[1] * math.sin(theta) * r
            else:
                point = _outline(theta, inner, radii[0], radii[1]) * r
                x, z = point.x, point.z
            vertices.append((x, _lens_y(x, z, radii[0], radii[1]) - front_offset if not iris
                             else _lens_y(x, z, *lens_radii) - front_offset, z))
    for i in range(segments):
        faces.append((0, 1 + i, 1 + (i + 1) % segments))
    for j in range(rings - 1):
        start = 1 + j * segments
        for i in range(segments):
            a, b = start + i, start + (i + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    result = _object(name, vertices, faces, material, collection, matrix)
    uv = result.data.uv_layers.new(name="UV olhos")
    for polygon in result.data.polygons:
        for loop_index in polygon.loop_indices:
            point = result.data.vertices[result.data.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = ((point.x - ox) / radii[0] * .5 + .5,
                                      (point.z - oz) / radii[1] * .5 + .5)
    return result


def _surface(source, origin, normal, fallback, offset=0.0):
    """Projeta no crânio atual, em espaço local, antes de criar acessórios."""
    normal = Vector(normal).normalized()
    hit, point, hit_normal, _ = source.ray_cast(Vector(origin) + normal * .30, -normal, distance=.60)
    return point + hit_normal * offset if hit else Vector(fallback)


def _eye(source, materials, collection, side):
    near = side < 0
    label = "próximo" if near else "oposto"
    origin = Vector((.055, -.0995, .499)) if near else Vector((.144, .014, .501))
    angle, inner = (0.0, 1) if near else (math.radians(85), -1)
    width, height = (EYE_WIDTH, EYE_HEIGHT) if near else (.024, .0395)
    lens_radii = (width, height)
    frame = Matrix.Translation(origin) @ Matrix.Rotation(angle, 4, 'Z')
    matrix = source.matrix_world @ frame
    inverse = frame.inverted()
    normal = frame.to_3x3() @ Vector((0, -1, 0))
    objects = []
    objects.append(_disk("Esclera " + label, materials["olho_branco"], collection, matrix,
                         inner=inner, radii=lens_radii, lens_radii=lens_radii))

    # A borda creme liga a lente ao crânio e impede aparência de globo flutuante.
    vertices, faces = [], []
    segments, rings = 64, 4
    for j in range(rings):
        blend = j / (rings - 1)
        for k in range(segments):
            theta = math.tau * k / segments
            p = _outline(theta, inner, width, height)
            inner_point = Vector((p.x, _lens_y(p.x, p.z, width, height) + .0005, p.z))
            # Transição mínima inferior/lateral; a parte superior tem delineado
            # assentado diretamente no crânio, sem aro branco levantado.
            expansion = .001 if math.sin(theta) >= 0 else .003
            outer_point = _outline(theta, inner, width + expansion, height + expansion)
            start = frame @ outer_point
            attached = inverse @ _surface(source, start, normal, start + normal * -.008, .0007)
            vertices.append(inner_point.lerp(attached, _smoothstep(blend)))
            if j:
                a, b = (j - 1) * segments + k, (j - 1) * segments + (k + 1) % segments
                faces.append((a, a + segments, b + segments, b))
    objects.append(_object("Pálpebras creme " + label, vertices, faces, materials["pelagem"], collection, matrix))

    iris_center = ((.0105 if near else .006) * inner, -.001)
    iris_radii = (.0165, .0285) if near else (.0138, .0275)
    objects.append(_disk("Íris âmbar " + label, materials["iris"], collection, matrix,
                         iris=True, offset=iris_center, radii=iris_radii,
                         lens_radii=lens_radii, front_offset=.0006))
    objects.append(_disk("Pupila " + label, materials["pupila"], collection, matrix,
                         iris=True, offset=(iris_center[0] + .0015 * inner, -.001),
                         radii=(.0095 if near else .008, .0205),
                         lens_radii=lens_radii, front_offset=.0011))

    # Contorno fino; parte superior mais marcada como na imagem principal.
    for upper in [True, False]:
        points = []
        for k in range(49):
            theta = math.pi * k / 48 + (0 if upper else math.pi)
            p = _outline(theta, inner, width, height)
            p.y = _lens_y(p.x, p.z, width, height) - .0008
            points.append(p)
        objects.append(_tube(("Delineado superior " if upper else "Delineado inferior ") + label,
                             points, .0034 if upper else .00085, materials["sobrancelha"],
                             collection, matrix, flatten=.58,
                             taper=lambda t: .45 + .55 * math.sin(math.pi * t) ** .45))
    outer = -inner
    for lash in range(3):
        theta = (math.pi - .13 - lash * .20) if inner > 0 else (.13 + lash * .20)
        base = _outline(theta, inner, width, height)
        base.y = _lens_y(base.x, base.z, width, height) - .0015
        tip = base + Vector((outer * (.012 - lash * .0015), -.002, .009 + lash * .002))
        points = _sample_curve([base, base.lerp(tip, .6) + Vector((0, -.001, -.001)), tip], 6)
        objects.append(_tube("Cílio %d %s" % (lash + 1, label), points, .0022,
                             materials["sobrancelha"], collection, matrix,
                             taper=lambda t: max(.06, (1 - t) ** .8), flatten=.7))

    # Sobrancelhas arqueadas, com a ponta interna baixa para expressão confiante.
    brow_scale = 1 if near else .73
    brow = [(-inner * .042 * brow_scale, 0, .057),
            (-inner * .023 * brow_scale, 0, .069),
            (-inner * .006 * brow_scale, 0, .066),
            (inner * .012 * brow_scale, 0, .054),
            (inner * .028 * brow_scale, 0, .046)]
    attached_brow = []
    for p in _sample_curve(brow, 10):
        world_point = frame @ p
        p = inverse @ _surface(source, world_point, normal, world_point, .002)
        attached_brow.append(p)
    objects.append(_tube("Sobrancelha " + label, attached_brow, .0073 if near else .006,
                         materials["sobrancelha"], collection, matrix, flatten=.30,
                         taper=lambda t: .12 + .88 * _smoothstep(t / .58)))

    for index, (dx, dz, scale) in enumerate([(-.003, .010, (.0032, .0018, .0048)),
                                           (.005, -.010, (.0014, .0008, .0018))]):
        x, z = iris_center[0] + dx, iris_center[1] + dz
        gleam_matrix = matrix @ Matrix.Translation(Vector((x, _lens_y(x, z, width, height) - .0018, z)))
        objects.append(_ellipsoid("Brilho %d %s" % (index + 1, label), scale,
                                  materials["olho_branco"], collection, gleam_matrix))
    return objects


def _remove_old_brow(source):
    bm = bmesh.new()
    bm.from_mesh(source.data)
    remaining, remove = set(bm.verts), []
    while remaining:
        first = remaining.pop()
        component, stack = [first], [first]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in remaining:
                    remaining.remove(other)
                    component.append(other)
                    stack.append(other)
        if len(component) < 500 and all(vertex.co.z > .39 for vertex in component):
            remove.extend(component)
    count = len(remove)
    if remove:
        bmesh.ops.delete(bm, geom=remove, context='VERTS')
        bm.to_mesh(source.data)
        source.data.update()
    bm.free()
    return count


def _sculpt(source):
    """Suaviza relevo fechado dos olhos sem refazer corpo, orelhas ou UVs."""
    vertices = source.data.vertices
    edits, maximum = 0, 0.0
    for vertex in vertices:
        p = vertex.co
        # Boca, cantos e focinho já existem na escultura Meshy. Essa região
        # permanece íntegra; apenas a transformação afim posterior a amplia.
        if p.z <= .462 or p.z >= .593:
            continue
        original = p.copy()
        if p.y < -.055 and -.015 < p.x < .126:
            r = math.sqrt(((p.x - .055) / .062) ** 2 + ((p.z - .505) / .058) ** 2)
            influence = 1 - _smoothstep((r - .62) / .58)
            if influence > 0:
                backing = -.099 + .10 * (p.x - .055)
                p.y += (backing - p.y) * influence * .96
        if p.x > .105 and -.042 < p.y < .078:
            r = math.sqrt(((p.y - .015) / .060) ** 2 + ((p.z - .505) / .058) ** 2)
            influence = 1 - _smoothstep((r - .62) / .58)
            if influence > 0:
                backing = .144 - .10 * (p.y - .015)
                p.x += (backing - p.x) * influence * .96
        distance = (p - original).length
        if distance > 1e-8:
            edits += 1
            maximum = max(maximum, distance)
    # Os tufos Meshy parecem pontas rígidas; reduzimos a quina mantendo o volume
    # geral da bochecha e sem tocar o pescoço ou a origem das orelhas.
    neighbors = [[] for _ in vertices]
    for edge in source.data.edges:
        a, b = edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    softened = set()
    for _ in range(5):
        coordinates = [v.co.copy() for v in vertices]
        for vertex in vertices:
            p = coordinates[vertex.index]
            relative = p - FACE_ORIGIN
            if not .462 < p.z < .565 or relative.dot(FORWARD) > .078:
                continue
            lateral = abs(relative.dot(LATERAL))
            influence = _smoothstep((lateral - .095) / .050)
            if not influence or not neighbors[vertex.index]:
                continue
            mean = sum((coordinates[i] for i in neighbors[vertex.index]), Vector()) / len(neighbors[vertex.index])
            vertex.co = p.lerp(mean, .42 * influence)
            softened.add(vertex.index)
    source.data.update()
    return {"vertices_ajustados": edits, "deslocamento_maximo": round(maximum, 6),
            "vertices_tufos_suavizados": len(softened),
            "estrategia": "crânio e orelhas Meshy preservados; órbitas suavizadas; tufos superiores arredondados; boca/focinho nativos intactos"}


def _head_materials(source, materials):
    cream = _material_slot(source, materials["pelagem"])
    for polygon in source.data.polygons:
        p = polygon.center
        if p.z <= .39:
            continue
        polygon.material_index = cream
        polygon.use_smooth = True
    return 0


def _ear_patch(source, material, collection, near=True):
    """Lâmina coral única, com contorno suave, projetada na concavidade real.

    A segunda lâmina olha para -X, no lado interno distante. A face externa
    da orelha oposta continua creme no ângulo de guarda original.
    """
    if near:
        sections = [(.651, -.041, -.040), (.680, -.132, -.034),
                    (.720, -.165, -.039), (.760, -.184, -.054),
                    (.800, -.196, -.074), (.840, -.204, -.099),
                    (.880, -.209, -.133), (.910, -.212, -.169),
                    (.928, -.211, -.210)]
        normal = Vector((0, -1, 0))
    else:
        # Margem larga na borda voltada à câmera; a concavidade está no verso
        # lateral da orelha, não na superfície creme observada de frente.
        sections = [(.704, .179, .180), (.742, .154, .239),
                    (.780, .158, .260), (.820, .181, .271),
                    (.860, .209, .280), (.900, .248, .284),
                    (.927, .277, .278)]
        normal = Vector((-1, 0, 0))
    curves = _sample_curve(sections, 10)
    columns = 24
    vertices, faces = [], []
    for j, section in enumerate(curves):
        z, left, right = section
        for k in range(columns + 1):
            t = k / columns
            value = left * (1 - t) + right * t
            point = Vector((value, 0, z)) if near else Vector((.025, value, z))
            attached = _surface(source, point, normal, point, .00075)
            vertices.append(attached)
            if j and k < columns:
                a, b = (j - 1) * (columns + 1) + k, (j - 1) * (columns + 1) + k + 1
                # Próxima: X cruz Z = -Y. Oposta: Y cruz Z = +X, inverter.
                face = (a, b, b + columns + 1, a + columns + 1)
                faces.append(face if near else tuple(reversed(face)))
    name = "Interior coral contínuo orelha " + ("próxima" if near else "oposta face interna")
    return _object(name, vertices, faces, material, collection, source.matrix_world)


def _head_warp(point):
    p = Vector(point)
    if p.z <= .39:
        return p
    # A boca inteira (.402-.45) recebe a mesma transformação afim. A transição
    # inferior termina em .400, sem deformação diferencial das curvas nativas.
    influence = _smoothstep((p.z - .39) / .010) * (1 - _smoothstep((p.z - .625) / .115))
    center = Vector((.015, .045, .51))
    p.x = center.x + (p.x - center.x) * (1 + .10 * influence)
    p.y = center.y + (p.y - center.y) * (1 + .10 * influence)
    p.z = center.z + (p.z - center.z) * (1 + .025 * influence)
    return p


def _enlarge_head(source, accessories):
    """Aplica a mesma deformação suave ao crânio e às peças assentadas nele."""
    count = 0
    for vertex in source.data.vertices:
        if vertex.co.z > .39:
            vertex.co = _head_warp(vertex.co)
            count += 1
    source.data.update()
    source_inverse = source.matrix_world.inverted()
    for accessory in accessories:
        local_to_source = source_inverse @ accessory.matrix_world
        source_to_local = local_to_source.inverted()
        for vertex in accessory.data.vertices:
            vertex.co = source_to_local @ _head_warp(local_to_source @ vertex.co)
        accessory.data.update()
    return count


def refinar_rosto(obj, materiais, collection):
    """Altera a cópia de trabalho e retorna nomes de objetos + diagnóstico JSON.

    O objeto de entrada continua sendo o crânio/corpo; nenhuma fonte é salva.
    Os acessórios são Mesh, têm materiais próprios e seguem matrix_world.
    """
    required = {"pelagem", "interior_orelha", "olho_branco", "iris", "pupila",
                "sobrancelha", "nariz", "boca"}
    missing = required - materiais.keys()
    if missing:
        raise ValueError("Materiais de rosto ausentes: " + ", ".join(sorted(missing)))
    removed = _remove_old_brow(obj)
    diagnosis = _sculpt(obj)
    diagnosis["vertices_sobrancelha_antiga_removidos"] = removed
    diagnosis["faces_interior_orelhas"] = _head_materials(obj, materiais)
    bpy.context.view_layer.update()
    objects = [_ear_patch(obj, materiais["interior_orelha"], collection, True),
               _ear_patch(obj, materiais["interior_orelha"], collection, False)]
    objects += _eye(obj, materiais, collection, -1) + _eye(obj, materiais, collection, 1)

    # Nariz triangular rosado acompanha a superfície do focinho nativo.
    sample = FACE_ORIGIN + FORWARD * .20
    sample.z = .442
    nose_point = _surface(obj, sample, FORWARD, sample, .003)
    nose_frame = _basis(obj, nose_point, math.pi / 4)
    objects.append(_ellipsoid("Nariz rosa", (.020, .0105, .012), materiais["nariz"],
                              collection, nose_frame, nose=True))
    for side in [-1, 1]:
        nostril = [(.010 * side, -.009, .001), (.013 * side, -.0085, -.001),
                   (.009 * side, -.010, -.003)]
        objects.append(_tube("Narina " + str(side), _sample_curve(nostril, 6), .0011,
                             materiais["boca"], collection, nose_frame,
                             taper=lambda t: .3 + .7 * math.sin(math.pi * t), flatten=.65))

    diagnosis["vertices_ampliacao_cabeca"] = _enlarge_head(obj, objects)
    diagnosis.update({"orientacao_cabeca": "+X/-Y, aproximadamente 45 graus; guarda original preservada",
                      "olhos": "ovais verticais assentados; convexidade .006; transição creme mínima sem aro superior",
                      "ampliacao_cabeca": "10% horizontal com transição no pescoço e base das orelhas; 2,5% vertical",
                      "interior_orelhas": "lâminas contínuas projetadas, margem creme; superfície externa oposta creme",
                      "expressao": "sobrancelhas arqueadas, delineado e três cílios por olho; sorriso nativo Meshy preservado",
                      "boca": "geometria nativa preservada até Z=.462; nenhuma linha ou sorriso novo; ampliação afim constante na boca",
                      "objetos_criados": len(objects), "cranio_substituido": False,
                      "topologia": "estudo visual; retopologia e deformação ainda pendentes",
                      "limite_inferior_edicao_z": .39})
    return {"objects": [item.name for item in objects], "diagnostics": diagnosis}
