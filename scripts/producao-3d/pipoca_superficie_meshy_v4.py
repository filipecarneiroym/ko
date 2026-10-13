"""Bounded procedural finish and solid short fur locks for Pipoca (Blender 4.x).

Import is side-effect free. These APIs never open/save/render or change source
mesh coordinates. No hair system, alpha shell, image texture, or coloured light
is built into the materials. Source-local dimensions are metres.
"""
from bisect import bisect_left
import math
import random
import bpy
from mathutils import Vector

_TAG = "pipoca_superficie_v4"


def _linear(value):
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def _rgba(color):
    return tuple(_linear(max(0, min(1, v))) for v in color) + (1.0,)


def _socket(shader, name, value, fallback=None):
    socket = shader.inputs.get(name)
    if socket is None and fallback:
        socket = shader.inputs.get(fallback)
    if socket is not None:
        socket.default_value = value


def _math(nodes, links, operation, a, b=None):
    node = nodes.new("ShaderNodeMath")
    node.operation = operation
    for socket, value in zip(node.inputs, (a, b)):
        if value is None:
            continue
        if isinstance(value, (int, float)):
            socket.default_value = value
        else:
            links.new(value, socket)
    return node.outputs[0]


def _noise(nodes, links, vector, scale, stretch=(1, 1, 1), detail=2):
    multiply = nodes.new("ShaderNodeVectorMath")
    multiply.operation = "MULTIPLY"
    multiply.inputs[1].default_value = stretch
    links.new(vector, multiply.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "3D"
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    noise.inputs["Roughness"].default_value = .65
    links.new(multiply.outputs["Vector"], noise.inputs["Vector"])
    return noise.outputs["Fac"]


def _ramp(nodes, links, signal, low, high):
    node = nodes.new("ShaderNodeValToRGB")
    node.color_ramp.elements[0].color = (low, low, low, 1)
    node.color_ramp.elements[1].color = (high, high, high, 1)
    links.new(signal, node.inputs["Fac"])
    return node.outputs["Color"]


def _colour(nodes, links, shader, signal, base, variation):
    # Restrained luminance variation only: never paint the rim light.
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.label = "Natural fibre luminance; no coloured light baked in"
    ramp.color_ramp.elements[0].color = _rgba(tuple(v * (1 - variation) for v in base))
    ramp.color_ramp.elements[1].color = _rgba(tuple(v * (1 + variation) for v in base))
    links.new(signal, ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])


def _bump(nodes, links, shader, signal, strength, distance):
    node = nodes.new("ShaderNodeBump")
    node.label = "Submillimetre fibre relief; no displacement"
    node.inputs["Strength"].default_value = strength
    node.inputs["Distance"].default_value = distance
    links.new(signal, node.inputs["Height"])
    links.new(node.outputs["Normal"], shader.inputs["Normal"])


def _tangent(nodes, links, shader, direction=(0, 0, 1)):
    """Project a local comb direction onto the surface without UVs."""
    geometry = nodes.new("ShaderNodeNewGeometry")
    local = nodes.new("ShaderNodeVectorTransform")
    local.vector_type = "NORMAL"
    local.convert_from, local.convert_to = "WORLD", "OBJECT"
    links.new(geometry.outputs["Normal"], local.inputs["Vector"])
    dot = nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    links.new(local.outputs["Vector"], dot.inputs[0])
    dot.inputs[1].default_value = direction
    projection = nodes.new("ShaderNodeVectorMath")
    projection.operation = "SCALE"
    links.new(local.outputs["Vector"], projection.inputs[0])
    links.new(dot.outputs["Value"], projection.inputs["Scale"])
    subtract = nodes.new("ShaderNodeVectorMath")
    subtract.operation = "SUBTRACT"
    subtract.inputs[0].default_value = direction
    links.new(projection.outputs["Vector"], subtract.inputs[1])
    world = nodes.new("ShaderNodeVectorTransform")
    world.vector_type = "VECTOR"
    world.convert_from, world.convert_to = "OBJECT", "WORLD"
    links.new(subtract.outputs["Vector"], world.inputs["Vector"])
    if shader.inputs.get("Tangent") is not None:
        links.new(world.outputs["Vector"], shader.inputs["Tangent"])


def _prepare(material, color, roughness):
    material.use_nodes = True
    material.diffuse_color = _rgba(color)
    material.roughness, material.metallic = roughness, 0
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Pipoca PBR"
    shader.label = "Pipoca v4 independent surface finish"
    shader.location = (800, 0)
    for name, value in [("Base Color", _rgba(color)), ("Roughness", roughness),
                        ("Metallic", 0), ("IOR", 1.45),
                        ("Specular IOR Level", .30), ("Coat Weight", 0)]:
        _socket(shader, name, value)
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (1080, 0)
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    coords = nodes.new("ShaderNodeTexCoord")
    coords.label = "Source-local metres; bake to UV after retopology"
    coords.location = (-1000, 0)
    return nodes, links, shader, coords.outputs["Object"]


def _fur(material):
    base = (.940, .865, .770)  # warmer peach-cream of the concept sheet
    nodes, links, shader, coords = _prepare(material, base, .73)
    for name, value in [("Specular IOR Level", .22), ("Sheen Weight", .32),
                        ("Sheen Roughness", .72), ("Subsurface Weight", .012),
                        ("Subsurface Radius", (1, .48, .25)),
                        ("Subsurface Scale", .003)]:
        _socket(shader, name, value)
    _socket(shader, "Anisotropic IOR Level", .24, "Anisotropic")
    _tangent(nodes, links, shader)
    fibres = _noise(nodes, links, coords, 430, (2.2, 2.2, .16), detail=1.5)
    fibres.node.label = "Short directional underfur approximately 1 mm wide"
    finer = _noise(nodes, links, coords, 950, (1.6, 1.6, .22), detail=1)
    relief = _math(nodes, links, "ADD", _math(nodes, links, "MULTIPLY", fibres, .78),
                   _math(nodes, links, "MULTIPLY", finer, .22))
    _bump(nodes, links, shader, relief, .30, .00095)
    _colour(nodes, links, shader, fibres, base, .018)
    links.new(_ramp(nodes, links, fibres, .66, .79), shader.inputs["Roughness"])
    return {"acabamento": "pelagem curta direcional creme e brilho difuso",
            "roughness": [.66, .79], "bump_m": .00095,
            "subsurface": .012, "alpha": False, "nodes": len(nodes)}


def _cloth(material, top=False):
    base = (.125, .105, .455)
    nodes, links, shader, coords = _prepare(material, base, .49 if top else .34)
    _socket(shader, "Specular IOR Level", .29 if top else .35)
    _socket(shader, "Sheen Weight", .20 if top else .24)
    _socket(shader, "Sheen Roughness", .68 if top else .48)
    _socket(shader, "Anisotropic IOR Level", .14 if top else .38, "Anisotropic")
    _tangent(nodes, links, shader, (1, 0, .10))
    xyz = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coords, xyz.inputs[0])
    warp = _math(nodes, links, "SINE",
                 _math(nodes, links, "MULTIPLY", xyz.outputs["X"], math.tau / .00085))
    weft = _math(nodes, links, "SINE",
                 _math(nodes, links, "MULTIPLY", xyz.outputs["Z"], math.tau / .00085))
    weave = _math(nodes, links, "ADD", _math(nodes, links, "MULTIPLY", warp, weft), 1)
    weave = _math(nodes, links, "MULTIPLY", weave, .5)
    weave.node.label = "Crossed warp and weft at 0.85 mm pitch"
    grain = _noise(nodes, links, coords, 95, detail=1)
    _bump(nodes, links, shader, weave, .16 if top else .12, .00020 if top else .00013)
    _colour(nodes, links, shader, grain, base, .016)
    low, high = (.45, .54) if top else (.30, .39)
    links.new(_ramp(nodes, links, grain, low, high), shader.inputs["Roughness"])
    return {"acabamento": "indigo fosco com trama" if top else "indigo acetinado com trama",
            "roughness": [low, high], "trama_mm": .85, "alpha": False, "nodes": len(nodes)}


def _leather(material):
    base = (.76, .032, .060)
    nodes, links, shader, coords = _prepare(material, base, .43)
    _socket(shader, "Specular IOR Level", .30)
    _socket(shader, "Coat Weight", .035)
    _socket(shader, "Coat Roughness", .38)
    grain = _noise(nodes, links, coords, 370, detail=2)
    pores = _noise(nodes, links, coords, 1050, detail=1)
    relief = _math(nodes, links, "ADD", _math(nodes, links, "MULTIPLY", grain, .75),
                   _math(nodes, links, "MULTIPLY", pores, .25))
    _bump(nodes, links, shader, relief, .26, .00050)
    _colour(nodes, links, shader, grain, base, .025)
    links.new(_ramp(nodes, links, grain, .37, .48), shader.inputs["Roughness"])
    return {"acabamento": "couro vermelho granulado com reflexo amplo e contido",
            "roughness": [.37, .48], "coat": .035, "metallic": 0,
            "alpha": False, "nodes": len(nodes)}


def refinar_materiais(mats):
    """Refine only supplied materials and return a JSON-serializable report.

    Keys: pelagem, couro, tecido (shorts), tecido_top (optional separate top).
    Aliases top, short, tecido_short supported. Caller supplies the separate top
    material; this API creates no materials and assigns none to objects.
    """
    top_ids = {mat.as_pointer() for key, mat in mats.items() if key in {"tecido_top", "top"}}
    short_ids = {mat.as_pointer() for key, mat in mats.items() if key in {"tecido", "tecido_short", "short"}}
    if top_ids & short_ids:
        raise ValueError("Top and shorts need separate supplied material datablocks")
    report, processed = {}, {}
    for key, material in mats.items():
        if key == "pelagem":
            kind, callback = "fur", _fur
        elif key == "couro":
            kind, callback = "leather", _leather
        elif key in {"tecido_top", "top"}:
            kind, callback = "top", lambda mat: _cloth(mat, top=True)
        elif key in {"tecido", "tecido_short", "short"}:
            kind, callback = "short", _cloth
        else:
            continue
        identity = material.as_pointer()
        if identity in processed:
            if processed[identity] != kind:
                raise ValueError("Materials of different surface types must be separate")
            continue
        report[key] = callback(material)
        material[_TAG] = True
        color = (.940, .865, .770) if kind == "fur" else (
                 (.76, .032, .060) if kind == "leather" else (.125, .105, .455))
        material["pipoca_cor_srgb"] = list(color)
        processed[identity] = kind
    return {"materiais": report, "texturas_externas": 0,
            "top_separado": any(key in report for key in ("tecido_top", "top")),
            "limites": "Procedurais locais para estudo. Assar Base Color/Normal/Roughness "
            "apos retopologia e UV finais. Nao exportados automaticamente para glTF."}



_FACE = Vector((.015, .045, .51))
_FORWARD = Vector((1, -1, 0)).normalized()
_SIDE = Vector((1, 1, 0)).normalized()


def _zone(point, name):
    if name == "bochechas":
        relative = point - _FACE
        return (.451 < point.z < .545 and abs(relative.dot(_SIDE)) > .072
                and relative.dot(_FORWARD) < .067)
    if name == "cauda":
        return point.y > .225 and -.205 < point.z < .085
    if name == "antebracos":
        return abs(point.x) > .205 and -.012 < point.z < .165 and point.y < .15
    return False


def _triangles(obj, material, zone):
    """Area-weighted samples from actual skin triangles in source-local space."""
    triangles, cumulative, area_sum = [], [], 0.0
    mesh = obj.data
    mesh.calc_loop_triangles()
    for triangle in mesh.loop_triangles:
        polygon = mesh.polygons[triangle.polygon_index]
        if (polygon.material_index >= len(mesh.materials)
                or mesh.materials[polygon.material_index] != material):
            continue
        a, b, c = (mesh.vertices[i].co.copy() for i in triangle.vertices)
        if not _zone((a + b + c) / 3, zone):
            continue
        cross = (b - a).cross(c - a)
        area = cross.length / 2
        if area < 1e-12:
            continue
        normal = cross.normalized()
        if zone == "bochechas" and abs(normal.dot(_SIDE)) < .26:
            continue
        area_sum += area
        triangles.append((a, b, c, normal))
        cumulative.append(area_sum)
    return triangles, cumulative, area_sum


def _lock(vertices, faces, root, normal, direction, length, width, randomizer):
    """Curved solid spindle: hidden root and a low, softly tapered tip."""
    tangent = direction - normal * direction.dot(normal)
    if tangent.length < .001:
        tangent = normal.cross(Vector((1, .1, .2)))
    tangent.normalize()
    across = normal.cross(tangent).normalized()
    offset = len(vertices)
    bulge = length * randomizer.uniform(.16, .22)
    for t, radius in ((0, .72), (.34, 1), (.73, .54)):
        center = (root + tangent * (length * t)
                  + normal * (-.00045 + bulge * math.sin(t * math.pi * .8)))
        for i in range(5):
            angle = math.tau * i / 5
            vertices.append(tuple(center + across * (width * radius * math.cos(angle))
                                  + normal * (width * radius * .35 * math.sin(angle))))
    vertices.append(tuple(root + tangent * length + normal * bulge * .50))
    faces.append(tuple(offset + i for i in reversed(range(5))))
    for ring in range(2):
        for i in range(5):
            a, b = offset + ring * 5 + i, offset + ring * 5 + (i + 1) % 5
            faces.append((a, b, b + 5, a + 5))
    for i in range(5):
        faces.append((offset + 10 + i, offset + 10 + (i + 1) % 5, offset + 15))


def adicionar_pelagem(parts, mats, collection):
    """Add restrained fur locks and return JSON including created object names.

    parts is a sequence of meshes or a mapping of names to meshes. Roots are
    sampled from supplied fur polygons. No source polygons are changed. Created
    meshes retain source matrix_world. Keep original Meshy local coordinates.
    """
    material = mats.get("pelagem")
    if material is None:
        raise ValueError("adicionar_pelagem needs the supplied pelagem material")
    if isinstance(parts, dict):
        parts = list(parts.values())
    parts = [obj for obj in parts if obj.type == "MESH" and not obj.get(_TAG)]
    created, zones, total_vertices, total_triangles = [], {}, 0, 0
    budgets = {"bochechas": 104, "cauda": 72, "antebracos": 48}
    for zone, budget in budgets.items():
        sources = []
        for obj in parts:
            triangles, cumulative, area = _triangles(obj, material, zone)
            if triangles:
                sources.append((obj, triangles, cumulative, area))
        combined_area = sum(source[3] for source in sources)
        made = 0
        for source_index, (obj, triangles, cumulative, area) in enumerate(sources):
            count = max(1, round(budget * area / combined_area))
            randomizer = random.Random(41703 + list(budgets).index(zone) * 131 + source_index)
            vertices, faces = [], []
            for index in range(count):
                selected = bisect_left(cumulative, randomizer.random() * area)
                a, b, c, normal = triangles[min(selected, len(triangles) - 1)]
                s, t = math.sqrt(randomizer.random()), randomizer.random()
                root = a * (1 - s) + b * (s * (1 - t)) + c * (s * t)
                if zone == "bochechas":
                    sign = 1 if (root - _FACE).dot(_SIDE) > 0 else -1
                    direction = _SIDE * sign * .8 + Vector((0, 0, -.38))
                    length = randomizer.uniform(.008, .014)
                elif zone == "cauda":
                    direction = root - Vector((0, .275, -.075)) + Vector((0, .025, .025))
                    length = randomizer.uniform(.010, .017)
                else:
                    direction = Vector((-.18 if root.x < 0 else .15, .05, -.85))
                    length = randomizer.uniform(.007, .011)
                _lock(vertices, faces, root, normal, direction, length,
                      randomizer.uniform(.00125, .00205), randomizer)
            mesh = bpy.data.meshes.new("Pipoca v4 | short fur locks " + zone)
            mesh.from_pydata(vertices, [], faces)
            mesh.materials.append(material)
            for polygon in mesh.polygons:
                polygon.use_smooth = True
            mesh.update()
            fur = bpy.data.objects.new("Pipoca v4 | pelagem " + zone, mesh)
            collection.objects.link(fur)
            fur.matrix_world = obj.matrix_world.copy()
            fur[_TAG] = True
            fur["pipoca_fur_source"] = obj.name
            fur["pipoca_fur_zone"] = zone
            fur["pipoca_preparar_deformacao"] = True
            created.append(fur.name)
            total_vertices += len(vertices)
            total_triangles += sum(len(face) - 2 for face in faces)
            made += count
        zones[zone] = made
    return {"objects": created, "mechas_por_regiao": zones,
            "vertices": total_vertices, "triangulos": total_triangles,
            "sementes_deterministicas": True, "alpha": False,
            "estrategia": "Mechas solidas curtas e curvas aderentes a pele; raiz oculta; sem alpha.",
            "limites": "Estudo visual. Transferir pesos ou incorporar contorno na malha final "
            "antes de animar. Nao executar duas vezes na mesma colecao sem remover mechas anteriores."}

