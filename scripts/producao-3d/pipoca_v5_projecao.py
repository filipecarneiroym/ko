"""V5: projeta a folha de referência (frente, lado, costas) no Meshy v2.

O modelo v2 foi gerado a partir dessas três vistas, em pose neutra, olhando
para -Y e simétrico em X. Cada vértice recebe a cor da vista que o enxerga
de frente e sem oclusão; a calibração (px/m e centro) vem do ajuste de
silhuetas salvo em calibracao-vistas.json.
"""
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
SHEET = ROOT/'art/premium/modelos-3d/referencias/pipoca-referencia-v1.png'
CALIB = ROOT/'art/premium/modelos-3d/estudos-mixamo/meshy-pipoca-v2/calibracao-vistas.json'


def load_sheet():
    img = bpy.data.images.load(str(SHEET), check_existing=True)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    return px[::-1, :, :3]  # row 0 = top, as in the PNG


def views():
    cal = json.loads(CALIB.read_text())
    f, s, b = cal['front'], cal['side'], cal['back']
    return [
        # name, direction towards the camera, (vertex -> pixel)
        ('front', Vector((0, -1, 0)), lambda p: (f['cx']+f['scale']*p.x, f['cy']-f['scale']*p.z)),
        ('back', Vector((0, 1, 0)), lambda p: (b['cx']-b['scale']*p.x, b['cy']-b['scale']*p.z)),
        # The side view shows the right flank (camera at -X); the left flank
        # reuses it mirrored, the model being symmetric.
        ('right', Vector((-1, 0, 0)), lambda p: (s['cx']-s['scale']*p.y, s['cy']-s['scale']*p.z)),
        ('left', Vector((1, 0, 0)), lambda p: (s['cx']-s['scale']*p.y, s['cy']-s['scale']*p.z)),
    ]


def project(obj, power=3.0):
    """Per-vertex sRGB colour, view index and confidence."""
    mesh = obj.data
    sheet = load_sheet()
    H, W = sheet.shape[:2]
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices],
                                [list(p.vertices) for p in mesh.polygons])
    vs = views()
    n = len(mesh.vertices)
    colour = np.zeros((n, 3), np.float32)
    view = np.full(n, -1, np.int8)
    weight = np.zeros(n, np.float32)
    for i, v in enumerate(mesh.vertices):
        best = 0.0
        for k, (_, d, to_px) in enumerate(vs):
            facing = v.normal.dot(d)
            if facing <= .05:
                continue
            w = facing**power
            if w <= best:
                continue
            if tree.ray_cast(v.co+v.normal*.002+d*.001, d, 4)[0] is not None:
                continue  # hidden from this camera
            x, y = to_px(v.co)
            xi, yi = int(round(x)), int(round(y))
            if 0 <= xi < W and 0 <= yi < H:
                best = w
                colour[i] = sheet[yi, xi]
                view[i] = k
        weight[i] = best
    return colour, view, weight


LABELS = ('pelagem', 'interior_orelha', 'tecido', 'faixas', 'couro')
PREVIEW = ((.95, .84, .77), (.90, .52, .50), (.20, .18, .52), (.97, .97, .97), (.80, .10, .13))


def _hsv(rgb):
    r, g, b = rgb.T
    v = rgb.max(1)
    c = v-rgb.min(1)
    s = np.where(v > 0, c/np.maximum(v, 1e-6), 0)
    h = np.zeros_like(v)
    nz = c > 1e-6
    rm = nz & (v == r)
    gm = nz & (v == g) & ~rm
    bm = nz & ~rm & ~gm
    h[rm] = ((g-b)[rm]/c[rm]) % 6
    h[gm] = (b-r)[gm]/c[gm]+2
    h[bm] = (r-g)[bm]/c[bm]+4
    return h/6, s, v


def zones(co):
    """Where each garment may exist; keeps stray pixels from painting the
    wrong part (white highlights on fur, red on the nose, coral on cheeks)."""
    x, y, z = co.T
    ax = np.abs(x)
    head = z > .36
    ears = z > .62
    hands = (ax > .30) & (z > -.25) & (z < .12)
    waist = (z > -.06) & (z < .06) & (ax < .22) & ~hands
    legs = z < -.70
    shorts = (z > -.32) & (z < .03) & (ax < .26) & ~hands
    torso = (z > .10) & (z < .36) & (ax < .20)
    return {'interior_orelha': ears,
            'tecido': (shorts | torso) & ~head,
            'faixas': (hands | waist | shorts | legs) & ~head,
            'couro': (hands | legs) & ~head}


def classify(obj, colour, view):
    co = np.array([v.co[:] for v in obj.data.vertices])
    h, s, v = _hsv(colour)
    zone = zones(co)
    seen = view >= 0
    raw = np.zeros(len(co), np.int8)
    reddish = (h > .93) | (h < .05)
    raw[(h > .55) & (h < .78) & (s > .30) & zone['tecido']] = 2
    raw[reddish & (s > .58) & (v > .35) & zone['couro']] = 4
    raw[(s < .10) & (v > .62) & zone['faixas']] = 3
    raw[reddish & (s > .28) & (s < .70) & (v > .55) & zone['interior_orelha']] = 1
    raw[~seen] = -1
    return raw


def smooth_labels(obj, raw, iterations=6, min_island=40):
    """Diffuse one-hot labels over the mesh (fills unseen vertices, removes
    speckle), then dissolve islands smaller than min_island vertices."""
    mesh = obj.data
    n = len(mesh.vertices)
    edges = np.array(mesh.edge_keys)
    deg = np.bincount(edges.ravel(), minlength=n)[:, None].clip(1)
    prob = np.zeros((n, len(LABELS)), np.float32)
    known = raw >= 0
    prob[known, raw[known]] = 1
    for _ in range(iterations):
        acc = np.zeros_like(prob)
        np.add.at(acc, edges[:, 0], prob[edges[:, 1]])
        np.add.at(acc, edges[:, 1], prob[edges[:, 0]])
        prob = np.where(known[:, None], .5*prob+.5*acc/deg, acc/deg)
    label = prob.argmax(1).astype(np.int8)
    label[prob.max(1) == 0] = 0
    neighbours = [[] for _ in range(n)]
    for a, b in edges:
        neighbours[a].append(b)
        neighbours[b].append(a)
    for _ in range(3):
        seen = np.zeros(n, bool)
        for start in range(n):
            if seen[start]:
                continue
            comp, stack, seen[start] = [start], [start], True
            while stack:
                cur = stack.pop()
                for nb in neighbours[cur]:
                    if not seen[nb] and label[nb] == label[start]:
                        seen[nb] = True
                        stack.append(nb)
                        comp.append(nb)
            if len(comp) < min_island:
                border = [label[nb] for c in comp for nb in neighbours[c] if label[nb] != label[start]]
                if border:
                    label[comp] = np.bincount(border, minlength=len(LABELS)).argmax()
    return label, prob


def show_labels(obj, label):
    colour = np.array(PREVIEW, np.float32)[label]
    return show(obj, colour, 'regioes_v5')


def show(obj, colour, name='arte_projetada'):
    mesh = obj.data
    if name in mesh.color_attributes:
        mesh.color_attributes.remove(mesh.color_attributes[name])
    attr = mesh.color_attributes.new(name, 'BYTE_COLOR', 'POINT')
    rgba = np.concatenate([colour, np.ones((len(colour), 1), np.float32)], 1)
    attr.data.foreach_set('color_srgb', rgba.ravel())
    mat = bpy.data.materials.get('V5 | projeção da arte') or bpy.data.materials.new('V5 | projeção da arte')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    a = nodes.new('ShaderNodeVertexColor')
    a.layer_name = name
    e = nodes.new('ShaderNodeEmission')
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(a.outputs['Color'], e.inputs['Color'])
    links.new(e.outputs['Emission'], out.inputs['Surface'])
    mesh.materials.clear()
    mesh.materials.append(mat)
    return mat
