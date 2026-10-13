"""Figurino v5 do Meshy v2 (pose neutra, olhando para -Y, simétrico em X).

Cada peça é um campo assinado em espaço do modelo; as medidas vieram da
projeção da folha de referência (pipoca_v5_projecao) sobre esta malha.
Os triângulos são cortados exatamente no zero de cada campo, então as bordas
das peças ficam lisas em vez de seguir a triangulação.
"""
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def smoothstep(a, b, value):
    t = max(0.0, min(1.0, (value-a)/(b-a)))
    return t*t*(3.0-2.0*t)


# --- Medidas (metros, espaço do modelo) ---------------------------------
ELBOWS = {-1: Vector((-.30, .01, .10)), 1: Vector((.30, .01, .10))}
FOREARM = {s: Vector((.471*s, -.145, -.87)).normalized() for s in (-1, 1)}
# Distance along the forearm from the elbow: red, white, red, white, glove.
CUFF_START, CUFF_WHITE = .102, ((.114, .140), (.163, .188))
TOP_HEM_FRONT, TOP_HEM_BACK = .148, .142
WAIST_DEPTH = .044          # white waistband height
# y bands, outer hip: two stripes seen from the front and two from behind,
# measured by projecting the art's front and back views onto the mesh
# (white > 50 % of samples per 4 mm bin).
SIDE_STRIPES = ((-.108, -.094), (-.074, -.058), (.005, .019), (.040, .056))
FOOT_BAND = (-.735, -.712)  # red band crowning the ankle wrap
FOOT_WRAP_TOP = -.735
TOES_Y = -.100              # toes (fur, painted nails) in front of this
# Red stirrup strap: an oblique ring over the forefoot (top, just behind the
# toes) and low round the heel, as in the art's front and back views.
STRAP_FRONT, STRAP_HEEL = Vector((0, -.085, -.868)), Vector((0, .09, -.92))
STRAP_HALF = .0055
TOE_TRIM = .008             # red edge where the wrap meets the toes


def forearm(p, side):
    q = p-ELBOWS[side]
    t = q.dot(FOREARM[side])
    return t, (q-FOREARM[side]*t).length


SHOULDERS = {-1: Vector((-.19, .0, .30)), 1: Vector((.19, .0, .30))}
HANDS = {-1: Vector((-.43, -.03, -.14)), 1: Vector((.43, -.03, -.14))}


def _segment(p, a, b):
    ab = b-a
    t = max(0.0, min(1.0, (p-a).dot(ab)/ab.length_squared))
    return (p-(a+ab*t)).length


def off_arms(p):
    """Positive away from both arms (upper arm and forearm capsules)."""
    d = min(min(_segment(p, SHOULDERS[s], ELBOWS[s]), _segment(p, ELBOWS[s], HANDS[s]))
            for s in (-1, 1))
    return d-.075


def on_forearm(p, side):
    """Positive on this side's forearm and whole fist (thumb included), not
    on the thigh beside it: forearm capsule plus a sphere around the fist.
    The fist reaches 15 cm from HANDS at the front; the x limit keeps the
    sphere off the thigh."""
    return max(.09-_segment(p, ELBOWS[side], HANDS[side]),
               min(.175-(p-HANDS[side]).length, p.x*side-.285))


def cuff_bar(p, side):
    """Signed half-width of the white bar joining the cuff's two white bands
    (the art's H strap), on the front-outer face of the forearm."""
    axis = FOREARM[side]
    q = p-ELBOWS[side]
    perp = q-axis*q.dot(axis)
    face = Vector((side, -1, 0))
    face = (face-axis*face.dot(axis)).normalized()
    if perp.dot(face) <= 0:
        return -1.0
    return .006-abs(perp.dot(axis.cross(face).normalized()))


def foot_strap(p):
    """Signed half-width of the oblique strap ring round the foot."""
    d = STRAP_HEEL-STRAP_FRONT
    n = Vector((0, -d.z, d.y)).normalized()
    return STRAP_HALF-abs(n.dot(p-STRAP_FRONT))


def own_arm(p, side):
    return p.x*side-.20


def front_weight(p):
    """0 on the chest/belly side, 1 on the back (torso mid-plane y~-.05)."""
    return smoothstep(-.075, -.025, p.y)


def mean_value(bx, bz, by, x, z):
    """Mean-value interpolation of by over the closed polygon (bx, bz) at
    (x, z); None outside it (winding angle below pi)."""
    dx, dz = bx-x, bz-z
    dx2, dz2 = np.roll(dx, -1), np.roll(dz, -1)
    a = np.arctan2(dx*dz2-dz*dx2, dx*dx2+dz*dz2)
    if abs(a.sum()) < math.pi:
        return None
    r = np.hypot(dx, dz)
    if r.min() < 1e-7:
        return float(by[r.argmin()])
    t = np.tan(a/2)
    w = (np.roll(t, 1)+t)/r
    return float(w@by/w.sum())


TAIL_CENTRE = (0.0, .045)   # (x, z) of the cotton tail seen from behind
_TAIL = {}


def build_tail(mesh):
    """Tail outline seen from behind: rays fanning from its centre; per angle
    the foot of the step down from the tail to the body (largest drop, then
    the concave corner). The base under the tail is a membrane over that rim.
    A sphere left indigo on the tail's lower lobes (user markup)."""
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], [list(f.vertices) for f in mesh.polygons])
    rs = np.arange(0, .14, .001)
    cx, cz = TAIL_CENTRE
    rim = []
    for deg in range(0, 360, 5):
        a = math.radians(deg)
        h = []
        for r in rs:
            hit = tree.ray_cast(Vector((cx+r*math.cos(a), 1, cz+r*math.sin(a))), Vector((0, -1, 0)), 2)[0]
            h.append(hit.y if hit else np.nan)
        h = np.array(h)
        st = np.full(len(h), np.nan)
        st[2:-2] = h[4:]-h[:-4]
        i = int(np.nanargmin(st))
        seg = h[i:i+25]
        j = i+1+int(np.nanargmax(seg[:-2]-2*seg[1:-1]+seg[2:]))
        rim.append((a, rs[j]))
    a, r = (np.array(c) for c in zip(*rim))
    # Generous rim below: some lobes reach past the step found between tufts
    # (the height test keeps the body inside the rim indigo). On top the
    # drop is deep and exact, and slack would reach the waistband lip.
    r = np.where(np.sin(a) < .3, np.maximum.reduce([np.roll(r, -1), r, np.roll(r, 1)])+.010, r)
    bx, bz = cx+r*np.cos(a), cz+r*np.sin(a)
    y = np.array([tree.ray_cast(Vector((u, 1, v)), Vector((0, -1, 0)), 2)[0].y for u, v in zip(bx, bz)])
    _TAIL.update(bx=bx, bz=bz, by=y)
    return {'rim_m': [round(float(r.min()), 3), round(float(r.max()), 3)]}


def tail_field(p):
    """Positive on the tail: inside its rim (seen from behind) and standing
    more than 6 mm proud of the base under it."""
    if not _TAIL or p.y < .055 or abs(p.x) > .13 or not -.07 < p.z < .17:
        return -1.0
    base = mean_value(_TAIL['bx'], _TAIL['bz'], _TAIL['by'], p.x, p.z)
    if base is None:
        return -1.0
    return p.y-base-.006


_WAIST = {}


def build_waist(mesh):
    """Top edge of the sculpted waistband per angle around the torso axis:
    the largest inward step of the radius going up (the band's lip). It is
    at ~.056 on the belly and climbs to ~.10 on the sides and back; a curve
    in x alone left the white below the band there (user markup)."""
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], [list(f.vertices) for f in mesh.polygons])
    zs = np.arange(.02, .14, .002)
    angles, tops = [], []
    for deg in range(0, 360, 10):
        th = math.radians(deg)
        d = Vector((math.cos(th), math.sin(th), 0))
        r = []
        for z in zs:
            hit = tree.ray_cast(Vector((0, 0, z)), d, .4)[0]
            r.append(hit.dot(d) if hit else np.nan)
        r = np.array(r)
        st = np.full(len(r), np.nan)
        st[2:-2] = r[4:]-r[:-4]
        st[(st > -.006) | (st < -.035)] = np.nan   # deeper drops: tail top
        if np.all(np.isnan(st)):
            continue
        angles.append(th)
        tops.append(float(zs[int(np.nanargmin(st))]))
    angles, tops = np.array(angles), np.array(tops)
    keep = np.array([abs(tops[i]-np.median(tops[[(i+k) % len(tops) for k in (-2, -1, 1, 2)]])) < .012
                     for i in range(len(tops))])
    _WAIST.update(angles=angles[keep], tops=tops[keep])
    return {'angles': int(keep.sum()), 'top': [round(float(tops.min()), 3), round(float(tops.max()), 3)]}


def waist_bottom(p):
    if len(_WAIST.get('angles', ())) < 12:
        return .005+1.4*p.x*p.x
    th = math.atan2(p.y, p.x) % math.tau
    return float(np.interp(th, _WAIST['angles'], _WAIST['tops'], period=math.tau))-WAIST_DEPTH


_HEMS = {}


def build_hems(mesh):
    """Sculpted shorts hem per leg: rays from the leg axis outwards; per
    angle the hem is the largest outward step of the radius going up (the
    cuff sits proud of the thigh). Angles facing the crotch (no clean step)
    are interpolated from their neighbours."""
    co = np.array([v.co[:] for v in mesh.vertices])
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], [list(f.vertices) for f in mesh.polygons])
    zs = np.arange(-.32, -.10, .002)
    report = {}
    for side in (-1, 1):
        m = (np.sign(co[:, 0]) == side) & (np.abs(co[:, 2]+.24) < .006) & (np.abs(co[:, 0]) < .3)
        axis = co[m].mean(0)
        angles, hems, thigh = [], [], []
        for deg in range(0, 360, 10):
            th = math.radians(deg)
            d = Vector((math.cos(th), math.sin(th), 0))
            r = []
            for z in zs:
                hit = tree.ray_cast(Vector((axis[0], axis[1], z)), d, .4)[0]
                r.append((hit-Vector((axis[0], axis[1], z))).dot(d) if hit else np.nan)
            r = np.array(r)
            st = np.full(len(r), np.nan)
            st[2:-2] = r[4:]-r[:-4]
            # Facing the crotch the ray jumps to the other thigh (> 5 cm):
            # drop those jumps before picking, or the whole angle was lost and
            # the inner hem rode up (cream tongue on the inner shorts leg).
            st[st > .05] = np.nan
            if np.all(np.isnan(st)):
                continue
            i = int(np.nanargmax(st))
            if .004 < st[i] and r[i] < .16:
                angles.append(th)
                hems.append(float(zs[i])-.003)  # concave corner under the cuff
                below = r[max(0, i-8):max(1, i-3)]
                thigh.append(float(np.nanmedian(below)) if np.any(~np.isnan(below)) else np.nan)
        angles, hems, thigh = np.array(angles), np.array(hems), np.array(thigh)
        # Drop angles that caught the glute fold or crotch: far from the
        # median of their neighbours (the real hem changes slowly).
        keep = np.ones(len(hems), bool)
        for i in range(len(hems)):
            near = hems[[(i+k) % len(hems) for k in (-2, -1, 1, 2)]]
            keep[i] = abs(hems[i]-np.median(near)) < .012
        _HEMS[side] = (Vector((axis[0], axis[1], 0)), angles[keep], hems[keep], thigh[keep])
        report[side] = int(keep.sum())
    return report


def shorts_hem(p):
    side = 1 if p.x > 0 else -1
    if side not in _HEMS or len(_HEMS[side][1]) < 6:
        return -.24+.27*min(abs(p.x), .26)
    axis, angles, hems, _ = _HEMS[side]
    th = math.atan2(p.y-axis.y, p.x-axis.x) % math.tau
    return float(np.interp(th, angles, hems, period=math.tau))


def cuff(p):
    """Positive on the sculpted cuff that overhangs the thigh: up to 2.5 cm
    below the hem corner, wherever the surface stands proud of the thigh.
    The border then runs in the fold between cuff and thigh, out of sight."""
    side = 1 if p.x > 0 else -1
    if side not in _HEMS or len(_HEMS[side][1]) < 6:
        return -1.0
    axis, angles, hems, thigh = _HEMS[side]
    th = math.atan2(p.y-axis.y, p.x-axis.x) % math.tau
    gap = np.min(np.abs((angles-th+math.pi) % math.tau-math.pi))
    if gap > math.radians(12):
        return -1.0   # inner thigh: no measured cuff, keep the plain hem
    ok = ~np.isnan(thigh)
    r0 = float(np.interp(th, angles[ok], thigh[ok], period=math.tau))
    h = float(np.interp(th, angles, hems, period=math.tau))
    r = math.hypot(p.x-axis.x, p.y-axis.y)
    return min(r-(r0+.0045), p.z-(h-.025))


# Strap at the cup: centre x .072 (z .315) -> .082 (z .345), half width .0165.
NECK_BOTTOM, STRAP_INNER, STRAP_OUTER = .26, .0555, .0985


def top_front_edge(p):
    ax = abs(p.x)
    # Scoop neckline rising into the strap's inner edge, as in the art; the
    # old U ended at x .085 below the strap and left a step at the strap.
    if ax < STRAP_INNER:
        return NECK_BOTTOM+.05*(ax/STRAP_INNER)**2
    # Under the strap (hidden): climb to z .345, then run level to the strap's
    # outer edge. Past .085 the cup edge used to stand above the strap and
    # left a step at the armhole.
    if ax < .075:
        return .31+.035*(ax-STRAP_INNER)/(.075-STRAP_INNER)
    if ax < STRAP_OUTER:
        return .345
    # Armhole: one smooth concave curve from the strap's outer edge down to
    # the underarm. The concept's top covers the side up to the armpit.
    t = min(1.0, (ax-STRAP_OUTER)/(.155-STRAP_OUTER))
    return .345-.06*math.sin(t*math.pi/2)**.8


def top_back_width(p):
    return .125-.095*smoothstep(.19, .30, p.z)


def top_panel(p):
    w = front_weight(p)
    front = min(p.z-TOP_HEM_FRONT, top_front_edge(p)-p.z, .155-abs(p.x))
    back = min(p.z-TOP_HEM_BACK, top_back_width(p)-abs(p.x), .30-p.z)
    return front*(1-w)+back*w


# Racerback straps: guides from the cup over the shoulder to the back Y,
# snapped to the skin at build time (see build_straps).
STRAP_GUIDES = ((.072, -.13, .315), (.082, -.09, .345), (.088, -.02, .365),
                (.075, .045, .335), (.045, .065, .300), (.0, .07, .265))
STRAP_RADIUS = .0165
_STRAPS = []


def build_straps(mesh):
    faces = [list(f.vertices) for f in mesh.polygons if .12 < f.center.z < .42 and abs(f.center.x) < .22]
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], faces)
    _STRAPS.clear()
    for side in (-1, 1):
        path = [tree.find_nearest(Vector((side*x, y, z)))[0] for x, y, z in STRAP_GUIDES]
        for _ in range(4):
            dense = [path[0]]
            for a, b in zip(path, path[1:]):
                dense += [tree.find_nearest((a+b)/2)[0], b]
            path = dense
        for _ in range(12):
            path = [path[0]]+[(a+2*b+c)/4 for a, b, c in zip(path, path[1:], path[2:])]+[path[-1]]
        normals = [tree.find_nearest(p)[1] for p in path]
        for _ in range(24):
            normals = [normals[0]]+[(a+2*b+c).normalized() for a, b, c in
                                    zip(normals, normals[1:], normals[2:])]+[normals[-1]]
        segs = [(a, b-a, max((b-a).length_squared, 1e-12), na, nb)
                for a, b, na, nb in zip(path, path[1:], normals, normals[1:])]
        pad = STRAP_RADIUS+.05
        lo = Vector([min(p[i] for p in path)-pad for i in range(3)])
        hi = Vector([max(p[i] for p in path)+pad for i in range(3)])
        _STRAPS.append((segs, lo, hi))
    return [round(sum(math.sqrt(s[2]) for s in st[0]), 3) for st in _STRAPS]


def strap(index):
    def field(p):
        segs, lo, hi = _STRAPS[index]
        if any(p[i] < lo[i] or p[i] > hi[i] for i in range(3)):
            return -.05
        best, lateral, depth = None, STRAP_RADIUS, 0.0
        for a, ab, l2, na, nb in segs:
            t = max(0.0, min(1.0, (p-a).dot(ab)/l2))
            d = p-(a+ab*t)
            if best is None or d.length_squared < best:
                best = d.length_squared
                n = na.lerp(nb, t).normalized()
                depth = d.dot(n)
                lateral = (d-n*depth).length
        return min(STRAP_RADIUS-lateral, .03-abs(depth))
    return field


def ear_side_x(p):
    return p.x


# --- Regiões em ordem de prioridade ---------------------------------------
def regions():
    out = [('pelagem', [tail_field])]   # cotton tail, all fur
    for side in (-1, 1):
        for low, high in CUFF_WHITE:
            out.append(('faixas', [
                lambda p, s=side, l=low: forearm(p, s)[0]-l,
                lambda p, s=side, h=high: h-forearm(p, s)[0],
                lambda p, s=side: .2-forearm(p, s)[1],
                lambda p, s=side: own_arm(p, s),
                lambda p, s=side: on_forearm(p, s)]))
        out.append(('faixas', [
            lambda p, s=side: forearm(p, s)[0]-CUFF_WHITE[0][1],
            lambda p, s=side: CUFF_WHITE[1][0]-forearm(p, s)[0],
            lambda p, s=side: .2-forearm(p, s)[1],
            lambda p, s=side: own_arm(p, s),
            lambda p, s=side: cuff_bar(p, s)]))
        out.append(('couro', [
            lambda p, s=side: forearm(p, s)[0]-CUFF_START,
            lambda p, s=side: .25-forearm(p, s)[1],
            lambda p, s=side: own_arm(p, s),
            lambda p, s=side: on_forearm(p, s)]))
    feet = lambda p: -.66-p.z
    out += [
        ('couro', [feet, lambda p: p.z-FOOT_BAND[0], lambda p: FOOT_BAND[1]-p.z]),
        ('couro', [feet, lambda p: FOOT_WRAP_TOP-p.z, foot_strap]),
        ('couro', [feet, lambda p: FOOT_WRAP_TOP-p.z, lambda p: p.y-TOES_Y,
                   lambda p: TOES_Y+TOE_TRIM-p.y]),
        ('faixas', [feet, lambda p: FOOT_WRAP_TOP-p.z, lambda p: p.y-TOES_Y]),
        # Spatial gates first: a face outside them is not sliced at all
        # (slices on the arms showed as shading notches).
        # The torso is at most ~.20 wide at band height; past that it is the
        # inner arm resting on the hip (band leaked there).
        ('faixas', [lambda p: .215-abs(p.x), off_arms,
                    lambda p: p.z-waist_bottom(p), lambda p: waist_bottom(p)+WAIST_DEPTH-p.z]),
    ]
    shorts = [lambda p: .26-abs(p.x), off_arms,
              lambda p: waist_bottom(p)-p.z, lambda p: p.z-shorts_hem(p)]
    for low, high in SIDE_STRIPES:
        out.append(('faixas', shorts+[lambda p, l=low: p.y-l, lambda p, h=high: h-p.y,
                                      lambda p: abs(p.x)-.15]))
    out.append(('tecido', shorts))
    out.append(('tecido', [lambda p: .26-abs(p.x), off_arms, lambda p: waist_bottom(p)-p.z, cuff]))
    out.append(('tecido_top', [lambda p: p.z-.10, top_panel]))
    out.append(('tecido_top', [strap(0)]))
    out.append(('tecido_top', [strap(1)]))
    return out


def _dissolve_islands(bm, keys):
    """Small disconnected patches of a garment (where a field grazes a
    neighbouring limb) become fur."""
    limits = {'tecido': 150, 'tecido_top': 150, 'faixas': 40, 'couro': 40}
    fur = keys.index('pelagem')
    seen, removed = set(), 0
    for f in bm.faces:
        if f.index in seen or keys[f.material_index] not in limits:
            continue
        comp, stack = [f], [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            for e in cur.edges:
                for g in e.link_faces:
                    if g.index not in seen and g.material_index == f.material_index:
                        seen.add(g.index)
                        comp.append(g)
                        stack.append(g)
        if len(comp) < limits[keys[f.material_index]]:
            for g in comp:
                g.material_index = fur
            removed += 1
    return removed


def cut(obj, mats, region_list, ear=None, head_regions=()):
    """Clip every polygon against each region's constraints (one plane at a
    time, as in v4) and rebuild the mesh with exact material borders."""
    mesh = obj.data
    keys = list(mats)
    index = {k: i for i, k in enumerate(keys)}
    coords, polys, mat_ids, lookup = [], [], [], {}

    def clip(poly, field, positive):
        out = []
        if not poly:
            return out
        prev = poly[-1]
        fp = field(prev)
        pin = fp >= 0 if positive else fp < 0
        for cur in poly:
            fc = field(cur)
            cin = fc >= 0 if positive else fc < 0
            if cin != pin:
                # Same edge, same point from both neighbouring faces (watertight).
                a, b, fa, fb = (prev, cur, fp, fc) if tuple(prev) < tuple(cur) else (cur, prev, fc, fp)
                t = max(0.0, min(1.0, fa/(fa-fb)))
                out.append(a.lerp(b, t))
            if cin:
                out.append(cur)
            prev, fp, pin = cur, fc, cin
        return out

    def append(poly, mat):
        if len(poly) < 3:
            return
        ids = []
        for p in poly:
            key = (round(p.x, 6), round(p.y, 6), round(p.z, 6))
            if key not in lookup:
                lookup[key] = len(coords)
                coords.append(p.copy())
            vi = lookup[key]
            if not ids or ids[-1] != vi:
                ids.append(vi)
        if len(ids) > 1 and ids[0] == ids[-1]:
            ids.pop()
        if len(set(ids)) < 3:
            return
        area = Vector()
        o = coords[ids[0]]
        for i in range(1, len(ids)-1):
            area += (coords[ids[i]]-o).cross(coords[ids[i+1]]-o)
        if area.length_squared < 1e-20:
            return
        polys.append(ids)
        mat_ids.append(mat)

    for face in mesh.polygons:
        poly = [mesh.vertices[v].co.copy() for v in face.vertices]
        pending = [poly]
        if face.center.z > .405:  # head: straps reach z .37 over the shoulders
            for key, field in head_regions:
                left = []
                for frag in pending:
                    append(clip(frag, field, True), index[key])
                    rest = clip(frag, field, False)
                    if len(rest) >= 3:
                        left.append(rest)
                pending = left
            if ear is not None and ear[1](face) and pending:
                frag = pending[0] if len(pending) == 1 else poly
                append(clip(frag, ear[0], True), index['interior_orelha'])
                pending = [clip(frag, ear[0], False)]
            for frag in pending:
                append(frag, index['pelagem'])
            continue
        for key, constraints in region_list:
            left = []
            for frag in pending:
                # Only slice a fragment the region really reaches: slicing by
                # a constraint and then failing a later one left needless
                # seams (cracks and shading rings on the calves and arms).
                inside = frag
                for c in constraints:
                    inside = clip(inside, c, True)
                    if len(inside) < 3:
                        break
                if len(inside) < 3:
                    left.append(frag)
                    continue
                inside = frag
                for c in constraints:
                    outside = clip(inside, c, False)
                    if len(outside) >= 3:
                        left.append(outside)
                    inside = clip(inside, c, True)
                append(inside, index[key])
            pending = left
            if not pending:
                break
        for frag in pending:
            append(frag, index['pelagem'])

    new = bpy.data.meshes.new(mesh.name+' | v5 contornos')
    new.from_pydata([tuple(c) for c in coords], [], polys)
    for k in keys:
        new.materials.append(mats[k])
    for f, m in zip(new.polygons, mat_ids):
        f.material_index = m
        f.use_smooth = True
    new.update()
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(new)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-5)
    report = {'openEdgesBefore': sum(e.is_boundary for e in bm.edges)}
    close_open_edges(bm)
    report['openEdgesAfter'] = sum(e.is_boundary for e in bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    islands = _dissolve_islands(bm, keys)
    bm.to_mesh(new)
    bm.free()
    old = obj.data
    obj.data = new
    bpy.data.meshes.remove(old)
    return {**report, 'islandsDissolved': islands, 'vertices': len(new.vertices), 'faces': len(new.polygons),
            'perMaterial': {k: int(np.sum(np.array(mat_ids) == i)) for k, i in index.items()}}


def close_open_edges(bm, passes=6):
    """Make the skin watertight (the game draws one side of each face).

    Clipping leaves T-junctions along region borders: a vertex on one side
    lying on an unsplit edge of the other. Snapping it onto the edge was not
    enough (the slit stayed open); split that edge at the vertex, weld, then
    drop degenerate faces and fill any tiny loop left."""
    import bmesh
    from mathutils.kdtree import KDTree
    for _ in range(passes):
        open_edges = [e for e in bm.edges if e.is_boundary]
        if not open_edges:
            break
        kd = KDTree(len(open_edges))
        for i, e in enumerate(open_edges):
            kd.insert((e.verts[0].co+e.verts[1].co)/2, i)
        kd.balance()
        todo = {}
        for v in {v for e in open_edges for v in e.verts}:
            best = None
            for _, i, _ in kd.find_range(v.co, .008):
                e = open_edges[i]
                if v in e.verts:
                    continue
                a, b = e.verts[0].co, e.verts[1].co
                ab = b-a
                l2 = ab.length_squared
                if l2 < 1e-14:
                    continue
                t = (v.co-a).dot(ab)/l2
                if not 1e-3 < t < 1-1e-3:
                    continue
                d = (v.co-(a+ab*t)).length
                if d < 4e-4 and (best is None or d < best[0]):
                    best = (d, e, t, v)
            if best and best[1] not in todo:
                todo[best[1]] = best
        if not todo:
            break
        for e, (_, _, t, v) in todo.items():
            if e.is_valid:
                bmesh.utils.edge_split(e, e.verts[0], t)[1].co = v.co.copy()
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=5e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges)
    loose = [e for e in bm.edges if not e.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='EDGES')
    # Sliver fins: an edge shared by 3 faces. Drop the smallest face there.
    fins = {min(e.link_faces, key=lambda f: f.calc_area()) for e in bm.edges if len(e.link_faces) > 2}
    if fins:
        bmesh.ops.delete(bm, geom=list(fins), context='FACES_ONLY')
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=5e-5)
    open_edges = [e for e in bm.edges if e.is_boundary]
    if open_edges:
        bmesh.ops.holes_fill(bm, edges=open_edges, sides=64)


# --- Orelhas ---------------------------------------------------------------
# Below the petal's own lower tip (~.64): at .66 it sliced the tip flat.
EAR_BASE_Z = .63


def ear_field(mesh):
    """Coral interior on each ear: inset from the measured outline (cream
    rim ~20% of the half width), on the front (concave) face only."""
    co = np.array([v.co[:] for v in mesh.vertices])
    normals = np.array([v.normal[:] for v in mesh.vertices])
    sel = co[:, 2] > .64
    edges = np.array([e for e in mesh.edge_keys if sel[e[0]] and sel[e[1]]])
    deg = np.bincount(edges.ravel(), minlength=len(co))[:, None].clip(1)
    for _ in range(40):  # sheet-smoothed normals: folds average out
        acc = np.zeros_like(normals)
        np.add.at(acc, edges[:, 0], normals[edges[:, 1]])
        np.add.at(acc, edges[:, 1], normals[edges[:, 0]])
        normals = .5*normals+.5*acc/deg
    fields = {}
    for side in (-1, 1):
        idx = np.where(sel & (np.sign(co[:, 0]) == side))[0]
        e = co[idx]
        c = e.mean(0)
        _, _, vt = np.linalg.svd(e-c, full_matrices=False)
        a0 = vt[0] if vt[0][2] > 0 else -vt[0]
        a1 = vt[1]
        a2 = vt[2] if vt[2][1] < 0 else -vt[2]   # towards the camera (-Y)
        u, v = (e-c)@a0, (e-c)@a1
        bins = np.linspace(u.min(), u.max(), 26)
        mids, lo, hi = [], [], []
        for b0, b1 in zip(bins, bins[1:]):
            m = (u >= b0) & (u < b1)
            if m.sum() > 8:
                mids.append((b0+b1)/2)
                lo.append(v[m].min())
                hi.append(v[m].max())
        mids, lo, hi = map(np.array, (mids, lo, hi))
        span = u.max()-u.min()
        umin = float(u.min())
        medial = -1.0 if float(a1[0])*side > 0 else 1.0   # +a1 or -a1 points to the head

        def field(p, c=c, a0=a0, a1=a1, mids=mids, lo=lo, hi=hi, span=span, umin=umin, medial=medial):
            # User markup: a petal pointed at both ends, widest a little above
            # the middle, its lower point drawn toward the head side.
            q = np.array(p[:])-c
            pu, pv = float(q@a0), float(q@a1)
            f = (pu-umin)/span
            if f <= .10 or f >= .965:
                return -1.0
            centre = float(np.interp(pu, mids, (lo+hi)/2))
            half = float(np.interp(pu, mids, (hi-lo)/2))
            shape = math.sin(math.pi*(f-.10)/.865)**.85
            shape *= 1-.25*smoothstep(.55, .95, f)        # finer upper point
            centre += medial*half*.30*(1-smoothstep(.25, .65, f))
            return .68*half*shape-abs(pv-centre)
        fields[side] = (field, a2)

    # Front face and height as continuous fields too: deciding them per face
    # left the coral edge following the triangles (ragged ear base).
    from mathutils.kdtree import KDTree
    ids = np.where(sel)[0]
    kd = KDTree(len(ids))
    for k, i in enumerate(ids):
        kd.insert(co[i], k)
    kd.balance()

    def which(p):
        field, a2 = fields[1 if p.x > 0 else -1]
        near = kd.find_n(p, 4)
        w = np.array([1/max(d, 1e-5) for _, _, d in near])
        n = (w[:, None]*normals[ids[[k for _, k, _ in near]]]).sum(0)/w.sum()
        return min(field(p), .02*float(n@a2), p.z-EAR_BASE_Z)

    def interior(face):
        return face.center.z > EAR_BASE_Z-.01
    return which, interior


# --- Cores medidas na arte (sRGB) ------------------------------------------
ART_COLOURS = {
    'pelagem': (.955, .855, .785),
    'interior_orelha': (.925, .560, .535),
    'tecido': (.180, .150, .560),
    'tecido_top': (.180, .150, .560),
    'faixas': (.955, .950, .945),
    'couro': (.840, .130, .150),
}


def recolour(mats):
    """Set the measured art colours on the refined shaders (base colour or
    the fibre colour ramp feeding it), keeping each material's variation."""
    def lin(c):
        return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4
    for key, srgb in ART_COLOURS.items():
        mat = mats.get(key)
        if mat is None or not mat.use_nodes:
            continue
        target = [lin(c) for c in srgb]
        shader = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if shader is None:
            continue
        sock = shader.inputs['Base Color']
        if sock.links:
            node = sock.links[0].from_node
            ramps = [node] if node.type == 'VALTORGB' else [
                n for n in mat.node_tree.nodes if n.type == 'VALTORGB'
                and any(l.to_socket == sock for o in n.outputs for l in o.links)]
            for ramp in ramps:
                els = ramp.color_ramp.elements
                lum = [sum(e.color[:3])/3 for e in els]
                mid = sum(lum)/len(lum) or 1
                for e, l in zip(els, lum):
                    k = l/mid
                    e.color = (target[0]*k, target[1]*k, target[2]*k, 1)
        else:
            sock.default_value = (*target, 1)
        mat.diffuse_color = (*target, 1)
        mat['pipoca_cor_arte_srgb'] = list(srgb)
