"""Materiais próprios para o refinamento visual da Pipoca no Blender.

Importar o módulo não altera a cena. ``criar_materiais()`` cria ou atualiza
somente seus materiais; objetos, imagens e arquivos permanecem intocados.
As cores de autoria estão em sRGB e são convertidas para os sockets lineares.
"""

import bpy


_PREFIXO = "Pipoca refinamento | "


def _linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def _rgba(srgb):
    return tuple(_linear(max(0.0, min(1.0, c))) for c in srgb) + (1.0,)


def _socket(shader, name, value):
    socket = shader.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def _material(label, srgb, roughness, *, coat=0.0, sheen=0.0, subsurface=0.0):
    name = _PREFIXO + label
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = _rgba(srgb)
    material.roughness = roughness
    material.metallic = 0.0
    material["pipoca_material_proprio"] = True
    material["pipoca_cor_srgb"] = list(srgb)
    nodes = material.node_tree.nodes
    nodes.clear()
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Pipoca PBR"
    shader.label = label
    shader.location = (420, 100)
    _socket(shader, "Base Color", _rgba(srgb))
    _socket(shader, "Roughness", roughness)
    _socket(shader, "Metallic", 0.0)
    _socket(shader, "IOR", 1.46)
    _socket(shader, "Specular IOR Level", 0.35)
    _socket(shader, "Coat Weight", coat)
    _socket(shader, "Coat Roughness", 0.20)
    _socket(shader, "Sheen Weight", sheen)
    _socket(shader, "Sheen Roughness", 0.65)
    _socket(shader, "Subsurface Weight", subsurface)
    _socket(shader, "Subsurface Radius", (1.0, 0.48, 0.25))
    _socket(shader, "Subsurface Scale", 0.006)
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (720, 100)
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material, shader


def _microtextura(material, shader, srgb, *, scale, strength, distance,
                  variation=0.025, stretch=(1.0, 1.0, 1.0)):
    """Grão fino sem deslocar a silhueta nem criar geometria de fios."""
    nodes, links = material.node_tree.nodes, material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    coordinates.location = (-800, 0)
    coordinates.label = "Coordenadas locais, sem projeção de imagem"
    stretched = nodes.new("ShaderNodeVectorMath")
    stretched.operation = "MULTIPLY"
    stretched.location = (-620, 0)
    stretched.inputs[1].default_value = stretch
    links.new(coordinates.outputs["Object"], stretched.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-420, 0)
    noise.label = "Microgrão discreto"
    noise.noise_dimensions = "3D"
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.62
    noise.inputs["Distortion"].default_value = 0.0
    links.new(stretched.outputs["Vector"], noise.inputs["Vector"])
    colors = nodes.new("ShaderNodeValToRGB")
    colors.location = (-160, 160)
    colors.label = "Variação mínima da cor própria"
    colors.color_ramp.elements[0].color = _rgba(tuple(c * (1.0 - variation) for c in srgb))
    colors.color_ramp.elements[1].color = _rgba(tuple(c * (1.0 + variation) for c in srgb))
    links.new(noise.outputs["Fac"], colors.inputs["Fac"])
    links.new(colors.outputs["Color"], shader.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.location = (160, -140)
    bump.label = "Relevo superficial suave"
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])


def _math(nodes, links, operation, first, second=None, location=(0, 0)):
    node = nodes.new("ShaderNodeMath")
    node.operation = operation
    node.location = location
    for socket, value in zip(node.inputs, (first, second)):
        if value is None:
            continue
        if isinstance(value, (float, int)):
            socket.default_value = value
        else:
            links.new(value, socket)
    return node.outputs[0]


def _iris():
    """Íris âmbar radial para esfera/patch frontal orientado para -Y.

    Generated X/Z normaliza o desenho em íris pequenas. A pupila deve ser
    uma peça própria; o centro da íris já recebe uma transição castanha.
    """
    base = (0.82, 0.43, 0.055)
    material, shader = _material("Íris âmbar", base, 0.26, coat=0.25)
    _socket(shader, "Coat Roughness", 0.12)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    coordinates.location = (-1250, 0)
    separate = nodes.new("ShaderNodeSeparateXYZ")
    separate.location = (-1070, 0)
    links.new(coordinates.outputs["Generated"], separate.inputs[0])
    x = _math(nodes, links, "SUBTRACT", separate.outputs["X"], 0.5, (-880, 100))
    z = _math(nodes, links, "SUBTRACT", separate.outputs["Z"], 0.5, (-880, -80))
    centered = nodes.new("ShaderNodeCombineXYZ")
    centered.location = (-680, 0)
    links.new(x, centered.inputs["X"])
    links.new(z, centered.inputs["Z"])
    length = nodes.new("ShaderNodeVectorMath")
    length.operation = "LENGTH"
    length.location = (-500, 140)
    links.new(centered.outputs["Vector"], length.inputs[0])
    radius = _math(nodes, links, "MULTIPLY", length.outputs["Value"], 2.0, (-300, 240))
    ring = nodes.new("ShaderNodeValToRGB")
    ring.location = (-70, 290)
    ring.label = "Âmbar dourado e anel limbar castanho"
    ramp = ring.color_ramp
    ramp.interpolation = "EASE"
    stops = [
        (0.0, (0.20, 0.075, 0.018)),
        (0.26, (0.55, 0.235, 0.025)),
        (0.48, (0.95, 0.57, 0.085)),
        (0.76, (0.88, 0.43, 0.025)),
        (0.89, (0.47, 0.18, 0.018)),
        (0.985, (0.115, 0.045, 0.012)),
    ]
    ramp.elements[0].position = stops[0][0]
    ramp.elements[0].color = _rgba(stops[0][1])
    ramp.elements[1].position = stops[-1][0]
    ramp.elements[1].color = _rgba(stops[-1][1])
    for position, color in stops[1:-1]:
        ramp.elements.new(position).color = _rgba(color)
    links.new(radius, ring.inputs["Fac"])

    # Coordenadas normalizadas repetem a mesma fibra ao longo de cada raio.
    # Usar uma direção circular evita a emenda visível de atan2/UV angular.
    radial_direction = nodes.new("ShaderNodeVectorMath")
    radial_direction.operation = "NORMALIZE"
    radial_direction.location = (-500, -200)
    links.new(centered.outputs["Vector"], radial_direction.inputs[0])
    grain = nodes.new("ShaderNodeTexNoise")
    grain.location = (-280, -200)
    grain.label = "Fibras radiais suaves"
    grain.inputs["Scale"].default_value = 42.0
    grain.inputs["Detail"].default_value = 2.5
    grain.inputs["Roughness"].default_value = 0.62
    links.new(radial_direction.outputs["Vector"], grain.inputs["Vector"])
    fibers = nodes.new("ShaderNodeValToRGB")
    fibers.location = (-60, -100)
    fibers.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1.0)
    fibers.color_ramp.elements[1].color = (1.0, 0.95, 0.82, 1.0)
    links.new(grain.outputs["Fac"], fibers.inputs["Fac"])
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MULTIPLY"
    mix.location = (200, 180)
    mix.inputs[0].default_value = 0.42
    links.new(ring.outputs["Color"], mix.inputs[1])
    links.new(fibers.outputs["Color"], mix.inputs[2])
    links.new(mix.outputs["Color"], shader.inputs["Base Color"])
    return material


def criar_materiais():
    """Retorna os 12 materiais sem atribuí-los a objetos nem salvar arquivos."""
    materials = {}
    textured = [
        # key, rótulo, sRGB, rugosidade, escala, força bump, distância, cor, alongamento, sheen, SSS, coat
        ("pelagem", "Pelagem creme quente", (0.945, 0.883, 0.804), 0.64,
         620.0, 0.13, 0.00045, 0.022, (1.0, 1.0, 0.32), 0.16, 0.035, 0.0),
        ("tecido", "Tecido índigo", (0.125, 0.105, 0.455), 0.43,
         900.0, 0.09, 0.00028, 0.027, (1.0, 1.0, 1.0), 0.25, 0.0, 0.04),
        ("couro", "Couro vermelho", (0.79, 0.035, 0.070), 0.28,
         480.0, 0.11, 0.00022, 0.025, (1.0, 1.0, 1.0), 0.0, 0.0, 0.22),
        ("faixas", "Faixas claras", (0.925, 0.902, 0.850), 0.65,
         1050.0, 0.10, 0.00024, 0.018, (1.0, 1.0, 1.0), 0.12, 0.0, 0.0),
        ("interior_orelha", "Interior das orelhas coral", (0.84, 0.425, 0.418), 0.57,
         680.0, 0.065, 0.00022, 0.025, (1.0, 1.0, 0.60), 0.05, 0.045, 0.0),
    ]
    for (key, label, color, roughness, scale, strength, distance, variation,
         stretch, sheen, subsurface, coat) in textured:
        material, shader = _material(label, color, roughness, coat=coat,
                                     sheen=sheen, subsurface=subsurface)
        _microtextura(material, shader, color, scale=scale, strength=strength,
                      distance=distance, variation=variation, stretch=stretch)
        materials[key] = material

    for key, label, color, roughness, coat in [
        ("olho_branco", "Esclera marfim", (0.975, 0.965, 0.94), 0.23, 0.32),
        ("pupila", "Pupila preta", (0.013, 0.009, 0.006), 0.17, 0.36),
        ("sobrancelha", "Sobrancelhas e cílios castanhos", (0.16, 0.095, 0.060), 0.62, 0.0),
        ("nariz", "Nariz rosa coral", (0.86, 0.345, 0.365), 0.35, 0.09),
        ("boca", "Linha da boca castanha", (0.235, 0.105, 0.085), 0.64, 0.0),
        ("unha", "Unhas vermelhas", (0.76, 0.105, 0.16), 0.29, 0.25),
    ]:
        material, _ = _material(label, color, roughness, coat=coat)
        materials[key] = material
    materials["iris"] = _iris()
    return materials


if __name__ == "__main__":
    materials = criar_materiais()
    assert len(materials) == 12
    assert all(material.use_nodes and material.node_tree.nodes.get("Pipoca PBR")
               for material in materials.values())
    repeated = criar_materiais()
    assert all(repeated[key] == materials[key] for key in materials)
    print("PIPOCA_MATERIAIS_OK", sorted(materials))
