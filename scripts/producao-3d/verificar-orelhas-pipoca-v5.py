"""Confere os materiais do .blend salvo contra a demarcação original.

blender -b --python scripts/producao-3d/verificar-orelhas-pipoca-v5.py
A tolerância de borda cobre o traço vermelho e a suavização de um pixel.
O miolo de cada região deve estar inteiramente coral, e o verso fica creme.
"""
from pathlib import Path
import json
import hashlib
import math
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import pipoca_v5_figurino as FIG

OUT = ROOT / 'art/premium/modelos-3d/estudos-mixamo/meshy-pipoca-v2/identidade-v5'
WORKFILE = OUT / 'pipoca-identidade-v5.blend'


def main():
    bpy.ops.wm.open_mainfile(filepath=str(WORKFILE))
    obj = bpy.data.objects['Pipoca v5 | corpo']
    mesh = obj.data
    coral = next(i for i, mat in enumerate(mesh.materials) if 'orelha' in mat.name.lower())
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], [list(f.vertices) for f in mesh.polygons])
    mask = FIG._markup_mask(ROOT / FIG.EAR_MARKUP)
    edge = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0)
                    & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
    ys, xs = np.where(edge)
    kd = KDTree(len(xs))
    for i, (u, v) in enumerate(zip(xs, ys)):
        kd.insert((float(u), float(v), 0), i)
    kd.balance()
    (mu, mv), (ru, rv) = FIG.EAR_MARKUP_ANCHOR
    mpp = FIG.EAR_RENDER['ortho'] / FIG.EAR_RENDER['width']
    # 2 px plus its diagonal grid neighbour (sqrt 5 = 2.236 px, ~1.6 mm):
    # pixel distances on the grid jump from 2.0 straight to 2.236.
    tolerance = 2.25
    counts = {k: 0 for k in ('marcados', 'coral', 'falhasNoMiolo', 'foraDoContorno', 'coralNoVerso')}
    missing_max = extra_max = 0.0
    for v in range(mask.shape[0]):
        z = FIG.EAR_RENDER['z'] - ((v+.5-mv) / FIG.EAR_MARKUP_SCALE+rv-FIG.EAR_RENDER['height']/2)*mpp
        if z < .64:
            continue
        for u in range(mask.shape[1]):
            x = ((u+.5-mu)/FIG.EAR_MARKUP_SCALE+ru-FIG.EAR_RENDER['width']/2)*mpp
            hit, _, face, _ = tree.ray_cast(Vector((x, -1, z)), Vector((0, 1, 0)), 2)
            if hit is None:
                continue
            marked = bool(mask[v, u])
            painted = mesh.polygons[face].material_index == coral
            if marked or painted:
                distance = kd.find((float(u), float(v), 0))[2]
                if marked:
                    counts['marcados'] += 1
                    counts['coral'] += int(painted)
                    if not painted:
                        missing_max = max(missing_max, distance)
                        counts['falhasNoMiolo'] += int(distance > tolerance)
                elif painted:
                    extra_max = max(extra_max, distance)
                    counts['foraDoContorno'] += int(distance > tolerance)
                back, _, back_face, _ = tree.ray_cast(Vector((x, 1, z)), Vector((0, -1, 0)), 2)
                if back is not None and mesh.polygons[back_face].material_index == coral:
                    counts['coralNoVerso'] += 1
    # Oblique rays expose the folds hidden in the original front screenshot.
    # The markup describes the first visible front surface. Hidden surfaces
    # sharing its projection are not additional painted regions. Detached
    # fragments are checked separately as connected components below.
    counts['amostrasTresQuartos'] = counts['falhasTresQuartos'] = 0
    quarter_failures = []
    for side in (-1, 1):
        offset = Vector((side*.75, -1, 0))
        direction = (-offset).normalized()
        for z in np.arange(.64, .96, .002):
            for x in np.arange(-.2, .2, .002):
                p, _, face, _ = tree.ray_cast(Vector((x, 0, z))+offset, direction, 3)
                if p is None:
                    continue
                u = (p.x/mpp+FIG.EAR_RENDER['width']/2-ru)*FIG.EAR_MARKUP_SCALE+mu
                v = ((FIG.EAR_RENDER['z']-p.z)/mpp+FIG.EAR_RENDER['height']/2-rv)*FIG.EAR_MARKUP_SCALE+mv
                if not (0 <= u < mask.shape[1] and 0 <= v < mask.shape[0] and mask[int(v), int(u)]):
                    continue
                # Use the same bitmap pixel centres as the frontal check.
                # A subpixel orbit ray still belongs to its marked pixel.
                if kd.find((float(int(u)), float(int(v)), 0))[2] <= tolerance:
                    continue
                front = tree.ray_cast(Vector((p.x, -1, p.z)), Vector((0, 1, 0)), 2)[0]
                if front is None or abs(front.y-p.y) > .0001:
                    continue
                back = tree.ray_cast(Vector((p.x, 1, p.z)), Vector((0, -1, 0)), 2)[0]
                if back is not None and abs(back.y-p.y) < .0001:
                    continue
                counts['amostrasTresQuartos'] += 1
                counts['falhasTresQuartos'] += int(mesh.polygons[face].material_index != coral)
                if mesh.polygons[face].material_index != coral and len(quarter_failures) < 12:
                    quarter_failures.append({'p': list(p), 'u': u, 'v': v,
                                             'distanciaContinuaPx': kd.find((u-.5, v-.5, 0))[2],
                                             'distanciaPixelPx': kd.find((float(int(u)), float(int(v)), 0))[2]})
    # Side and oblique views (user: no paint outside the dark inner area of
    # the ear, checked from several angles). Every visible ear face is
    # classified by whether it faces the inside of the cup (FIG.ear_cup_facing,
    # mean over its vertices). Clear outer surfaces (back, top of the rolled
    # rim) must not be coral; clear inner walls hidden from the front (the
    # curled fold) must be coral. Faces near the crest (|cos| small) are the
    # border itself and are not judged.
    ids, facing = FIG.ear_cup_facing(mesh)
    counts['amostrasLaterais'] = counts['coralForaDaConcha'] = counts['cremeDentroDaConcha'] = 0
    side_failures = []
    centre = Vector((0, -.03, .79))
    views = [(Vector((math.sin(math.radians(a)), -math.cos(math.radians(a)), e)).normalized(), a, e)
             for a in (-90, -60, -45, 45, 60, 90) for e in (0, .35)]
    views.append((Vector((0, -.6, .8)).normalized(), 0, 'cima'))
    for view, angle, elevation in views:
        right = view.cross(Vector((0, 0, 1))).normalized() if abs(view.z) < .9 else Vector((1, 0, 0))
        up = right.cross(view).normalized()
        for a in np.arange(-.2, .2, .0025):
            for b in np.arange(-.17, .17, .0025):
                origin = centre+view*2+right*a+up*b
                p, _, face, _ = tree.ray_cast(origin, -view, 4)
                if p is None or p.z < .66 or abs(p.x) < .02:
                    continue
                cos = float(np.mean(facing[list(mesh.polygons[face].vertices)]))
                is_coral = mesh.polygons[face].material_index == coral
                counts['amostrasLaterais'] += 1
                bad = None
                front = tree.ray_cast(Vector((p.x, -1, p.z)), Vector((0, 1, 0)), 2)[0]
                u = (p.x/mpp+FIG.EAR_RENDER['width']/2-ru)*FIG.EAR_MARKUP_SCALE+mu
                v = ((FIG.EAR_RENDER['z']-p.z)/mpp+FIG.EAR_RENDER['height']/2-rv)*FIG.EAR_MARKUP_SCALE+mv
                # Marked, or on the drawn line itself (faces cut by the border
                # leave coral fragments along it; same band as the front check).
                marked_front = (front is not None and abs(front.y-p.y) < .001
                                and 0 <= u < mask.shape[1] and 0 <= v < mask.shape[0]
                                and (mask[int(v), int(u)] or kd.find((u-.5, v-.5, 0))[2] <= tolerance+1))
                # Marked and seen from the front: judged pixel by pixel against
                # the markup above (at the tip and base the C model is loose).
                if is_coral and cos < -.2 and not marked_front:
                    counts['coralForaDaConcha'] += 1
                    bad = 'coralForaDaConcha'
                elif not is_coral and cos > .3:
                    if front is not None and p.y-front.y > .008:
                        counts['cremeDentroDaConcha'] += 1
                        bad = 'cremeDentroDaConcha'
                if bad and len(side_failures) < 12:
                    side_failures.append({'tipo': bad, 'vista': [angle, elevation], 'p': [round(c, 4) for c in p],
                                          'cos': round(cos, 3)})
    from collections import defaultdict
    edge_faces = defaultdict(list)
    painted_faces = {f.index for f in mesh.polygons if f.material_index == coral}
    for i in painted_faces:
        for edge in mesh.polygons[i].edge_keys:
            edge_faces[tuple(sorted(edge))].append(i)
    seen, components = set(), 0
    for i in painted_faces:
        if i in seen:
            continue
        components += 1
        seen.add(i)
        queue = [i]
        while queue:
            face = mesh.polygons[queue.pop()]
            for edge in face.edge_keys:
                for neighbor in edge_faces[tuple(sorted(edge))]:
                    if neighbor not in seen:
                        seen.add(neighbor)
                        queue.append(neighbor)
    counts['conchasContinuas'] = components
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    open_edges = sum(e.is_boundary for e in bm.edges)
    bm.free()
    report = {
        'workfile': str(WORKFILE.relative_to(ROOT)),
        'sha256Blend': hashlib.sha256(WORKFILE.read_bytes()).hexdigest(),
        'marcacao': FIG.EAR_MARKUP,
        'sha256Marcacao': hashlib.sha256((ROOT/FIG.EAR_MARKUP).read_bytes()).hexdigest(),
        'amostragem': 'Um raio por pixel da marcação, na câmera original; primeiro material visível.',
        'toleranciaBordaPxMarcacao': tolerance,
        'suavizacao': 'Campo de distância contínuo; filtro binomial sigma 1 px, dentro do traço.',
        **counts,
        'falhasTresQuartosAmostras': quarter_failures,
        'falhasLateraisAmostras': side_failures,
        'maiorDesvioInteriorPx': round(missing_max, 3),
        'maiorDesvioExteriorPx': round(extra_max, 3),
        'arestasAbertas': open_edges,
        'aprovado': bool(counts['marcados'] and counts['amostrasTresQuartos'] and counts['amostrasLaterais']) and components == 2 and not (counts['falhasNoMiolo'] or counts['foraDoContorno'] or counts['coralNoVerso'] or counts['falhasTresQuartos'] or counts['coralForaDaConcha'] or counts['cremeDentroDaConcha'] or open_edges),
    }
    (OUT/'verificacao-orelhas.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print('PIPOCA_EARS_CHECK', json.dumps(report, ensure_ascii=False), flush=True)
    if not report['aprovado']:
        raise RuntimeError('Pintura das orelhas diverge da demarcação. Consulte verificacao-orelhas.json.')


if __name__ == '__main__':
    main()
