"""Rosto v5 do Meshy v2: traços da arte como geometria nítida.

As posições vêm da vista frontal da folha de referência (calibração em
calibracao-vistas.json; centro do rosto na arte em px 321.3, escala
502.1 px/m). Tudo é projetado na pele ao longo de -Y e assentado sobre ela.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import pipoca_rosto_meshy as base
import pipoca_v5_figurino as FIG

FRONT = Vector((0, -1, 0))

# --- Medidas da arte (x, z em metros; lado +1 = esquerda da personagem) ----
# Fitted on the sculpt's relief map: the opening between the upper-lid
# ridge and the cheek (see mapa de relevo), outer corner clearly higher.
EYE = dict(cx=.0790, cz=.5300, w=.074, h=.048, tilt=.30, upper=.80, lower=.78,
           iris_du=-.004, iris_dv=-.001, iris=(.0155, .0175), pupil=(.0082, .0115))
BROW = ((.028, .569), (.045, .580), (.066, .588), (.084, .587), (.098, .578))  # on the brow bars
NOSE = dict(cz=.4855, w=.046, h=.024)
MOUTH = ((0, .4704), (.010, .4630), (.019, .4595), (.034, .4630), (.048, .4710), (.0607, .4804))
PHILTRUM = (.4735, .4704)
LIP = dict(half=.018, top=.4605, bottom=.4560)
BLUSH = dict(x=.090, z=.505, radius=.032, strength=.5)
LINER_RADIUS = .0042
_LINER_PAINT_SEGMENTS = None


def _tree(mesh):
    return BVHTree.FromPolygons([v.co for v in mesh.vertices],
                                [list(p.vertices) for p in mesh.polygons])


MUZZLE_AXIS = Vector((0, -.05, 0))
MOUTH_FAN = []
MOUTH_DROP = .0035     # lower the line into the lip (user markup)
MOUTH_EXTEND = .010    # corners run on along the muzzle rim


def mouth_crease(mesh):
    """Trace the sculpted mouth on the right half (x >= 0) in 3D.

    1. Fan of rays around the muzzle: per angle, the lower edge of the
       upper-lip overhang (largest outward step in height), tracked from the
       centre while the step stays deep (>4 mm).
    2. Then up the valley between muzzle pad and cheek (most concave angle
       per height) while it stays deeper than 3.5 mm: the smile corner."""
    tree = _tree(mesh)

    def radial(phi, z):
        d = Vector((math.sin(phi), -math.cos(phi), 0))
        c = Vector((MUZZLE_AXIS.x, MUZZLE_AXIS.y, z))
        hit = tree.ray_cast(c+d*.5, -d, .6)[0]
        return (hit, (hit-c).dot(d)) if hit is not None else (None, np.nan)

    zs = np.arange(.44, .53, .001)
    pts, prev, phi = [], .452, 0.0
    while phi <= math.radians(44):
        rad = np.array([radial(phi, z)[1] for z in zs])
        step = np.full(len(zs), np.nan)
        step[1:-1] = rad[2:]-rad[:-2]
        step[(zs < prev-.004) | (zs > prev+.025)] = np.nan
        i = int(np.nanargmax(step))
        # The step is softer at the centre (~3 mm); only stop once it fades
        # on the sides, never before the centre has been traced.
        if step[i] < (.0025 if phi < math.radians(16) else .004):
            break
        prev = float(zs[i])
        # The visible deep line is the concave corner at the foot of the step
        # (largest second derivative just below it), not the step's middle.
        lo = max(1, i-8)
        curv = rad[lo-1:i]-2*rad[lo:i+1]+rad[lo+1:i+2]
        j = lo+int(np.nanargmax(curv)) if not np.all(np.isnan(curv)) else i
        hit, _ = radial(phi, float(zs[j]))
        pts.append(hit)
        phi += math.radians(2)
    MOUTH_FAN[:] = list(pts)   # the U under the muzzle, without the cheek hook
    phis = np.radians(np.arange(15, 60, .5))
    z, last = prev+.002, math.degrees(phi)
    while z < .52:
        r = np.array([radial(p, z)[1] for p in phis])
        k = 12
        conc = np.full(len(r), np.nan)
        conc[k:-k] = r[k:-k]-(r[:-2*k]+r[2*k:])/2
        conc[np.abs(np.degrees(phis)-last) > 5] = np.nan
        if np.all(np.isnan(conc)):
            break
        i = int(np.nanargmin(conc))
        if conc[i] > -.0035:
            break
        last = float(np.degrees(phis[i]))
        pts.append(radial(phis[i], z)[0])
        z += .002
    return pts


def prepare(obj):
    """Iron Meshy's sculpted lids, lashes and mouth so the drawn features sit
    on a clean surface (Taubin over each feature area, volume kept)."""
    mesh = obj.data
    co = np.array([v.co[:] for v in mesh.vertices])
    edges = np.array(mesh.edge_keys)
    deg = np.bincount(edges.ravel(), minlength=len(co))[:, None].clip(1)
    x, y, z = co.T
    front = np.clip((-.02-y)/.04, 0, 1)
    eyes = np.zeros(len(co))
    for s in (-1, 1):
        d = ((x-s*EYE['cx'])/(EYE['w']*.5))**2+((z-EYE['cz']-EYE['tilt']*(x*s-EYE['cx']))/(EYE['h']*.42))**2
        eyes = np.maximum(eyes, np.clip((1.0-d)/.3, 0, 1))  # inside the opening only
    mouth = np.clip(1.3-((x/.075)**2+((z-.467)/.028)**2), 0, 1)
    brows = np.zeros(len(co))
    for s in (-1, 1):
        d = ((x-s*.064)/.05)**2+((z-.59)/.018)**2
        brows = np.maximum(brows, np.clip(1.4-d, 0, 1))
    crease = mouth_crease(mesh)  # before ironing; the mouth itself is kept
    # Lash spikes on top of the lid ridge read as cream lumps above the liner:
    # iron a band from the eye's upper arc up ~1.4 cm and past the outer corner.
    lash = np.zeros(len(co))
    for s in (-1, 1):
        u = x*s-EYE['cx']
        hw = EYE['w']/2
        cu = np.clip(u, -hw, hw)
        top = EYE['h']/2*EYE['upper']*np.sqrt(np.clip(1-(cu/hw)**2, 0, 1))+EYE['tilt']*cu
        dv = z-EYE['cz']-top
        # Past ~80% toward the outer corner the paint thins out: iron from
        # right above the liner there, so no spike tip peeks out.
        start = np.where(u > hw*.78, .001, .009)
        band = np.clip((dv-start)/.003, 0, 1)*np.clip((.026-dv)/.004, 0, 1)
        span = np.clip((u+hw*.9)/.01, 0, 1)*np.clip((hw+.022-u)/.008, 0, 1)
        lash = np.maximum(lash, band*span*(np.sign(x) == s))
    # Brow bars and mouth are kept: the drawn features sit on them.
    weight = (eyes*front)[:, None]
    for _ in range(30):
        for factor in (.5, -.53):
            acc = np.zeros_like(co)
            np.add.at(acc, edges[:, 0], co[edges[:, 1]])
            np.add.at(acc, edges[:, 1], co[edges[:, 0]])
            co += factor*weight*(acc/deg-co)
    # Lid ridge under the black paint: Taubin removes the sculpt's bumps
    # (user markup) while keeping the ridge's volume.
    ridge = np.zeros(len(co))
    for s in (-1, 1):
        u = x*s-EYE['cx']
        hw = EYE['w']/2
        cu = np.clip(u, -hw, hw)
        top = EYE['h']/2*EYE['upper']*np.sqrt(np.clip(1-(cu/hw)**2, 0, 1))+EYE['tilt']*cu
        dv = z-EYE['cz']-top
        rb = np.clip((dv+.003)/.003, 0, 1)*np.clip((.014-dv)/.003, 0, 1)
        sp = np.clip((u+hw*.95)/.008, 0, 1)*np.clip((hw+.006-u)/.006, 0, 1)
        ridge = np.maximum(ridge, rb*sp*(np.sign(x) == s))
    rw = (ridge*front)[:, None]
    for _ in range(90):
        for factor in (.5, -.53):
            acc = np.zeros_like(co)
            np.add.at(acc, edges[:, 0], co[edges[:, 1]])
            np.add.at(acc, edges[:, 1], co[edges[:, 0]])
            co += factor*rw*(acc/deg-co)
    # Brow bars: Taubin over the bar so its sculpted crest is clean and the
    # painted edge reads as a straight line from every angle.
    path = base._sample_curve(BROW, 12)
    px = np.array([p[0] for p in path]); pz = np.array([p[1] for p in path])
    bw = np.zeros(len(co))
    for s in (-1, 1):
        sel = (np.sign(x) == s) & (z > .54) & (z < .64)
        idx = np.where(sel)[0]
        d = np.min(np.hypot(np.abs(x[idx])[:, None]-px[None], z[idx][:, None]-pz[None]), 1)
        bw[idx] = np.clip((.016-d)/.005, 0, 1)
    bwt = (bw*front)[:, None]
    for _ in range(60):
        for factor in (.5, -.53):
            acc = np.zeros_like(co)
            np.add.at(acc, edges[:, 0], co[edges[:, 1]])
            np.add.at(acc, edges[:, 1], co[edges[:, 0]])
            co += factor*bwt*(acc/deg-co)
    # Finish the crest in depth only: preserve the brow's arc and footprint.
    # Keep each bar's weighted mean depth so smoothing does not flatten its
    # overall volume or make one side shallower than the other.
    old_y = co[:, 1].copy()
    for _ in range(100):
        for factor in (.5, -.53):
            acc_y = np.zeros(len(co))
            np.add.at(acc_y, edges[:, 0], co[edges[:, 1], 1])
            np.add.at(acc_y, edges[:, 1], co[edges[:, 0], 1])
            co[:, 1] += factor*bwt[:, 0]*(acc_y/deg[:, 0]-co[:, 1])
    for s in (-1, 1):
        sel = np.sign(co[:, 0]) == s
        w = bwt[sel, 0]
        denom = float(w@w)
        if denom > 0:
            co[sel, 1] += w*float(w@(old_y[sel]-co[sel, 1]))/denom
    # Top of the lid ridge: plain Laplacian flattens the lash bumps there.
    top_ridge = np.zeros(len(co))
    for s in (-1, 1):
        u = x*s-EYE['cx']
        hw = EYE['w']/2
        cu = np.clip(u, -hw, hw)
        top = EYE['h']/2*EYE['upper']*np.sqrt(np.clip(1-(cu/hw)**2, 0, 1))+EYE['tilt']*cu
        dv = z-EYE['cz']-top
        tb = np.clip((dv-.004)/.003, 0, 1)*np.clip((.016-dv)/.003, 0, 1)
        sp = np.clip((u+hw*.9)/.008, 0, 1)*np.clip((hw+.006-u)/.006, 0, 1)
        top_ridge = np.maximum(top_ridge, tb*sp*(np.sign(x) == s))
    tw = (top_ridge*front)[:, None]
    for _ in range(40):
        acc = np.zeros_like(co)
        np.add.at(acc, edges[:, 0], co[edges[:, 1]])
        np.add.at(acc, edges[:, 1], co[edges[:, 0]])
        co += .5*tw*(acc/deg-co)
    # Lash spikes: plain Laplacian (shrinking) so the protrusions flatten.
    lw = (lash*front)[:, None]
    for _ in range(60):
        acc = np.zeros_like(co)
        np.add.at(acc, edges[:, 0], co[edges[:, 1]])
        np.add.at(acc, edges[:, 1], co[edges[:, 0]])
        co += .5*lw*(acc/deg-co)
    # Each eye sits on a membrane spanning the sculpted opening: the visible
    # skin depth on the almond rim, interpolated inside (mean-value coords).
    # Outside the almond the eye parts follow the skin itself. A quadratic
    # fit on a wide ring caught the muzzle and the head's sides and floated
    # the eyes ~25 mm off the face. Skin inside is pushed behind the membrane
    # so the sculpted lids never poke through the drawn eye.
    tree = BVHTree.FromPolygons([Vector(p) for p in co], [list(p.vertices) for p in mesh.polygons])
    fits = {}
    for s in (-1, 1):
        fits[s] = depth = EyeDepth(tree, s)
        ex, ez = s*EYE['cx'], EYE['cz']
        d = ((x-ex)/(EYE['w']*.5))**2+((z-ez)/(EYE['h']*.5))**2
        for i in np.where((d < 1.6) & (y < -.02) & (np.sign(x) == s))[0]:
            if depth.inside(x[i], z[i]):
                co[i, 1] = max(co[i, 1], depth(x[i], z[i])+.0025*min(1.0, max(0.0, 1-d[i])/.25))
    mesh.vertices.foreach_set('co', co.ravel())
    mesh.update()
    # Paint follows the finished bar, after the sculpt coordinates are written.
    build_brow_relief(mesh)
    return {'ironedVertices': int((weight > .02).sum()), 'eyeLens': fits, 'mouthCrease': crease}


class EyeDepth:
    """Depth (world y) for the eye parts at (x, z): a membrane over the almond
    spanning the visible skin on its rim; outside the almond, the skin."""

    def __init__(self, tree, side):
        self.tree = tree
        rim = [_almond(t, side) for t in np.linspace(0, math.tau, 96, endpoint=False)]
        self.bx = np.array([side*(EYE['cx']+u) for u, _ in rim])
        self.bz = np.array([EYE['cz']+v for _, v in rim])
        by = np.array([self.skin(a, b) for a, b in zip(self.bx, self.bz)])
        # Smooth along the rim: the sculpt's lash bumps made the liner wavy.
        self.by = np.convolve(np.r_[by[-4:], by, by[:4]], np.ones(9)/9, 'valid')

    def skin(self, x, z):
        hit = self.tree.ray_cast(Vector((x, -1, z)), Vector((0, 1, 0)), 2)[0]
        if hit is None:
            hit = self.tree.find_nearest(Vector((x, -.08, z)))[0]
        return hit.y

    def _membrane(self, x, z):
        return FIG.mean_value(self.bx, self.bz, self.by, x, z)

    def inside(self, x, z):
        return self._membrane(x, z) is not None

    def __call__(self, x, z):
        y = self._membrane(x, z)
        return self.skin(x, z) if y is None else y


class Surface:
    def __init__(self, mesh):
        self.tree = _tree(mesh)

    def at(self, x, z, offset=0.0):
        hit, n, _, _ = self.tree.ray_cast(Vector((x, -1, z)), Vector((0, 1, 0)), 2)
        if hit is None:  # grazing the silhouette: settle on the nearest skin
            hit, n, _, _ = self.tree.find_nearest(Vector((x, -.08, z)))
        return hit+n*offset, n

    def onto(self, p, offset):
        loc, n, _, _ = self.tree.find_nearest(p)
        return loc+n*offset


def _mesh(name, verts, faces, material, collection):
    return base._object(name, verts, faces, material, collection, Matrix.Identity(4))


def _tube(name, points, radius, material, collection, **kw):
    return base._tube(name, points, radius, material, collection, Matrix.Identity(4), **kw)


def _almond(theta, side):
    """Eye outline in eye-local (u outward, v up) metres."""
    w, h = EYE['w']/2, EYE['h']/2
    s, c = math.sin(theta), math.cos(theta)
    u = w*c
    v = h*s*(EYE['upper'] if s >= 0 else EYE['lower'])
    # Outer corner (u>0) lifted, inner corner dropped: the sculpt's cat eye.
    v += EYE['tilt']*u
    return u, v


def _upper_liner_path():
    """One eye-local curve for the raised liner and its underlying paint."""
    # No wing: past the corner the skin turns sideways and every wing tried
    # (ray along -Y, nearest skin) hooked or ran off the face in profile.
    # The liner tapers at the corner instead.
    return [_almond(t, 1) for t in np.linspace(math.pi, 0, 40)]


def _liner_taper(t):
    return .3+.7*math.sin(math.pi*min(1.0, t*1.05))**.4   # thin at the outer corner


def _eye(surf, side, mats, collection, fit=None):
    cx, cz = side*EYE['cx'], EYE['cz']
    out = []
    to_world = lambda u, v: (cx+side*u, cz+v)

    def lens(u, v, lift):
        x, z = to_world(u, v)
        if fit is None:
            return surf.at(x, z, 0.0008+lift)[0]
        return Vector((x, fit(x, z)-lift, z))

    def disk(label, material, centre, radii, clip, lift, rings=12, segs=64):
        verts, faces = [], []
        cu, cv = centre
        verts.append(lens(cu, cv, lift+.0012))
        for j in range(1, rings+1):
            r = j/rings
            for k in range(segs):
                t = math.tau*k/segs
                u, v = cu+radii[0]*r*math.cos(t), cv+radii[1]*r*math.sin(t)
                if clip:
                    # Keep inside the almond: shrink towards the centre.
                    for _ in range(12):
                        if _inside(u, v):
                            break
                        u, v = cu+(u-cu)*.9, cv+(v-cv)*.9
                dome = .0012*max(0.0, 1-r*r)
                verts.append(lens(u, v, lift+dome))
        for k in range(segs):
            faces.append((0, 1+k, 1+(k+1) % segs))
        for j in range(rings-1):
            a0 = 1+j*segs
            for k in range(segs):
                a, b = a0+k, a0+(k+1) % segs
                faces.append((a, a+segs, b+segs, b))
        return _mesh('V5 '+label, verts, faces, material, collection)

    # Almond outline as a polar table (angle -> squared radius) for clipping.
    table = sorted((math.atan2(v, u), u*u+v*v) for u, v in
                   (_almond(a, side) for a in np.linspace(0, math.tau, 360, endpoint=False)))
    angles = np.array([t for t, _ in table])
    radii = np.array([r for _, r in table])

    def _inside(u, v):
        r2 = float(np.interp(math.atan2(v, u), angles, radii, period=math.tau))
        return u*u+v*v <= r2*.94

    name = 'esquerdo' if side > 0 else 'direito'
    # Sclera: almond filled by rings scaled to the outline.
    verts, faces, segs, rings = [], [], 72, 10
    verts.append(lens(0, 0, .0024))
    for j in range(1, rings+1):
        r = j/rings
        for k in range(segs):
            u, v = _almond(math.tau*k/segs, side)
            verts.append(lens(u*r, v*r, .0014*(1-r*r)+.0010))
    for k in range(segs):
        faces.append((0, 1+k, 1+(k+1) % segs))
    for j in range(rings-1):
        a0 = 1+j*segs
        for k in range(segs):
            a, b = a0+k, a0+(k+1) % segs
            faces.append((a, a+segs, b+segs, b))
    out.append(_mesh('V5 Esclera '+name, verts, faces, mats['olho_branco'], collection))
    iu, iv = EYE['iris_du'], EYE['iris_dv']
    out.append(disk('Íris âmbar '+name, mats['iris'], (iu, iv), EYE['iris'], True, .0022))
    out.append(disk('Pupila '+name, mats['pupila'], (iu+.001, iv), EYE['pupil'], True, .0029))
    # Upper liner with the outer wing, thick like the concept.
    upper = _upper_liner_path()
    pts = [lens(u, v, .0026) for u, v in upper]
    out.append(_tube('V5 Delineado '+name, pts, LINER_RADIUS, mats['pupila'], collection,
                     normal_hint=FRONT, flatten=.5,
                     taper=_liner_taper))
    lower = [_almond(t, side) for t in np.linspace(math.pi*1.12, math.pi*1.95, 24)]
    out.append(_tube('V5 Pálpebra inferior '+name, [lens(u, v, .0016) for u, v in lower], .0010,
                     mats['sobrancelha'], collection, normal_hint=FRONT, flatten=.6,
                     taper=lambda t: .2+.8*math.sin(math.pi*t)**.6))
    # Lashes: the sculpted lash spikes are painted black by lid_field().
    for i, (du, dv, size) in enumerate(((-.0055, .0075, (.0042, .0018, .0050)),
                                        (.0055, -.0075, (.0016, .0010, .0019)))):
        p = lens(iu+du, iv+dv, .0040)
        out.append(base._ellipsoid('V5 Brilho %d %s' % (i, name), size, mats['olho_branco'],
                                   collection, Matrix.Translation(p)))
    return out


def build(obj, mats, collection, prep=None):
    surf = Surface(obj.data)
    objects = []
    for side in (-1, 1):
        fit = (prep or {}).get('eyeLens', {}).get(side)
        objects += _eye(surf, side, mats, collection, fit)
    nose, n = surf.at(0, NOSE['cz'], .0035)
    frame = Matrix.Translation(nose) @ Matrix.Rotation(0, 4, 'Z')
    objects.append(base._ellipsoid('V5 Nariz rosa', (NOSE['w']/2, .0105, NOSE['h']/2),
                                   mats['nariz'], collection, frame, nose=True))
    # User markup: one wide smooth U along the deep crease under the muzzle,
    # ends only lifting slightly, no hook up the cheeks, no wobble. Fit an
    # even polynomial z(x) to the traced crease, then lay it on the skin
    # with its depth smoothed so sculpt micro-bumps do not shake the line.
    fan = MOUTH_FAN
    if len(fan) >= 4:
        # The traced crease itself (3D, so it stays in the fold from every
        # angle), mirrored for perfect symmetry, then smoothed hard along the
        # line and seated just in front of the skin.
        right = [Vector((abs(p.x), p.y, p.z)) for p in fan]
        # User markup: a touch lower in the middle (lip on the line) and wider,
        # the ends running on along the muzzle's lower rim, lifting gently.
        X = max(p.x for p in right) or 1
        right = [p+Vector((0, 0, -MOUTH_DROP*(1-.6*(p.x/X)**2))) for p in right]
        d = (right[-1]-right[-2]).normalized()
        for k in (1, 2, 3):
            right.append(surf.tree.find_nearest(right[-1]+d*MOUTH_EXTEND/3)[0])
        left = [Vector((-p.x, p.y, p.z)) for p in reversed(right[1:])]
        pts = base._sample_curve(left+[Vector((0, right[0].y, right[0].z))]+right[1:], 6)
        for _ in range(90):
            pts = [pts[0]]+[(a+2*b+c)/4 for a, b, c in zip(pts, pts[1:], pts[2:])]+[pts[-1]]
        nrm = [surf.tree.find_nearest(p)[1] for p in pts]
        for _ in range(20):
            nrm = [nrm[0]]+[(a+2*b+c).normalized() for a, b, c in zip(nrm, nrm[1:], nrm[2:])]+[nrm[-1]]
        seated = [surf.tree.find_nearest(p)[0] for p in pts]
        off = [(q-p).dot(n) for p, q, n in zip(pts, seated, nrm)]
        k = np.ones(21)/21
        off = np.convolve(np.pad(off, 10, mode='edge'), k, 'valid')
        pts = [p+n*(float(o)+.0014) for p, n, o in zip(pts, nrm, off)]
        mouth = [(0.0, min(p.z for p in pts if abs(p.x) < .004))]
    else:
        mouth = list(MOUTH)
        curve = [(-x, z) for x, z in reversed(mouth)]+list(mouth[1:])
        pts = [surf.at(x, z, .0012)[0] for x, z in base._sample_curve(curve, 8)]
    objects.append(_tube('V5 Boca', pts, .0029, mats['boca'], collection, normal_hint=FRONT,
                         flatten=.5, taper=lambda t: .15+.85*math.sin(math.pi*t)**.45))
    # Philtrum: from the nose's lower tip straight down to the mouth's centre.
    centre = min(pts, key=lambda p: abs(p.x))
    nose_low, _ = surf.at(0, NOSE['cz']-NOSE['h']*.45, 0)
    ph = []
    for t in range(11):
        q = nose_low.lerp(centre, t/10)
        ph.append(surf.at(0.0, q.z, 0)[0]+Vector((0, -.0010, 0)))
    objects.append(_tube('V5 Filtro labial', ph, .0013, mats['boca'], collection, normal_hint=FRONT,
                         flatten=.5, taper=lambda t: .5+.5*math.sin(math.pi*t)))
    # Pink lower lip just under the centre of the smile, following its curve.
    lip = []
    for x in np.linspace(-LIP['half'], LIP['half'], 21):
        z = mouth[0][1]-.0028+.0010*(abs(x)/LIP['half'])**2
        lip.append(surf.at(float(x), z, 0)[0])
    ly = np.array([p.y for p in lip])
    ly = np.minimum(np.convolve(np.pad(ly, 3, mode='edge'), np.ones(7)/7, 'valid'), ly)-.0014
    lip = [Vector((p.x, float(y), p.z)) for p, y in zip(lip, ly)]
    objects.append(_tube('V5 Lábio inferior', lip, .0024, mats['nariz'], collection, normal_hint=FRONT,
                         flatten=.55, taper=lambda t: .2+.8*math.sin(math.pi*t)**.6))
    for side in (-1, 1):
        objects.append(brow_decal(surf, side, mats['sobrancelha'], collection))
    blush = _blush(mats['pelagem'], surf)
    return {'objects': len(objects), 'blush': blush}


_BROW_PATH = None
_BROW_RELIEF = {}


def build_brow_relief(mesh):
    """Relief of each vertex in 3D: its height along the normal over the
    Gaussian mean (6 mm) of its neighbourhood. A front-view height map
    jagged the paint on the bar's steep top shelf and smeared it where the
    bar wraps onto the side of the head; the 3D relief follows the bar from
    every angle."""
    co = np.array([v.co[:] for v in mesh.vertices])
    nr = np.array([v.normal[:] for v in mesh.vertices])
    kd = KDTree(len(co))
    for i, p in enumerate(co):
        kd.insert(p, i)
    kd.balance()
    x, y, z = co.T
    sig = .006
    relief = np.zeros(len(co))
    for i in np.where((y < -.03) & (z > .53) & (z < .65) & (np.abs(x) < .15))[0]:
        near = kd.find_range(co[i], 3*sig)
        idx = np.array([n[1] for n in near])
        w = np.exp(-.5*(np.array([n[2] for n in near])/sig)**2)
        relief[i] = (co[i]-(w[:, None]*co[idx]).sum(0)/w.sum())@nr[i]
    # The bar's crest carries Meshy's sculpted hair spikes: following the
    # relief contour gave a ragged top edge. Take the bar's lower/upper
    # bounds per 2 mm along x (both sides mirrored) and smooth them along the
    # brow, as a drawn brow has clean edges.
    path = base._sample_curve(BROW, 12)
    px = np.array([q[0] for q in path])
    pz = np.array([q[1] for q in path])
    ax = np.abs(x)
    near = np.full(len(co), 1.0)
    cand = np.where((relief > .001) & (y < -.03) & (z > .545) & (z < .63))[0]
    near[cand] = np.min(np.hypot(ax[cand][:, None]-px[None], z[cand][:, None]-pz[None]), 1)
    bar = np.where(near < .014)[0]
    xs = np.arange(.015, .125, .002)
    cols = []
    for x0 in xs:
        zz = z[bar][np.abs(ax[bar]-x0) < .001]
        if len(zz) >= 4:
            cols.append((x0, np.percentile(zz, 5), np.percentile(zz, 95)))
    cols = np.array(cols)
    k = np.ones(7)/7
    lo = np.convolve(np.pad(cols[:, 1], 3, mode='edge'), k, 'valid')
    hi = np.convolve(np.pad(cols[:, 2], 3, mode='edge'), k, 'valid')
    _BROW_RELIEF.update(kd=kd, relief=relief, cx=cols[:, 0], lo=lo, hi=hi)


BROW_HALF = ((0, .0045), (.3, .0040), (.7, .0035), (1, .0015))   # art, inner -> outer


def brow_shape(x):
    """(centre z, half width, distance to the nearer tip) at |x|: centre on
    the sculpted bar (smoothed bounds), width measured on the art (the bar
    is only 4-5 mm wide mid-brow, the art ~7 mm)."""
    R = _BROW_RELIEF
    x0, x1 = float(R['cx'][0]), float(R['cx'][-1])
    mid = float(np.interp(x, R['cx'], (R['lo']+R['hi'])/2))
    t = (x-x0)/(x1-x0)
    half = float(np.interp(t, *zip(*BROW_HALF)))
    ends = min(x-x0, x1-x)
    return mid, half*min(1.0, max(0.0, ends)/.004)**.5, ends


def brow_decal(surf, side, material, collection):
    """The brow drawn as a thin smooth shell 1.2 mm over the bar: its edge is
    crisp whatever the sculpt does underneath (Meshy's hair spikes on the bar
    made painted edges ragged)."""
    R = _BROW_RELIEF
    xs = np.linspace(float(R['cx'][0]), float(R['cx'][-1]), 48)
    rows = 7
    verts, faces = [], []
    for x in xs:
        mid, half, _ = brow_shape(float(x))
        half = max(half, .0002)
        for k in range(rows):
            z = mid+half*(2*k/(rows-1)-1)
            verts.append(surf.at(side*float(x), z, .0012)[0])
    for i in range(len(xs)-1):
        for k in range(rows-1):
            a = i*rows+k
            f = (a, a+1, a+rows+1, a+rows)
            faces.append(f[::-1] if side > 0 else f)   # normals face the viewer (-Y)
    return _mesh('V5 Sobrancelha '+('esquerda' if side > 0 else 'direita'), verts, faces, material, collection)


def brow_field(p):
    """Brown paint on the bar, just inside the drawn brow (brow_shape), so
    any sculpt spike poking through the shell is brown too."""
    global _BROW_PATH
    if p.y > -.03 or not .545 < p.z < .63 or not _BROW_RELIEF:
        return -1.0
    if _BROW_PATH is None:
        _BROW_PATH = base._sample_curve(BROW, 12)
    x, z = abs(p.x), p.z
    if x < .015 or min(math.hypot(x-a[0], z-a[1]) for a in _BROW_PATH) > .014:
        return -1.0
    R = _BROW_RELIEF
    mid, half, ends = brow_shape(x)
    half -= .001   # paint sits just inside the drawn brow (brow_decal)
    # Outer tip only (where the bar wraps round the head): stay on the bar
    # itself (Gaussian 2.5 mm relief), not on the side of the head behind it.
    # Elsewhere this gate raggedised the lower edge.
    slack = max(0.0, .09-x)*.5     # continuous: no gate inside x < ~.08
    if slack > .005:
        return min(half-abs(z-mid), ends)
    near = R['kd'].find_range(p, .0075)
    w = np.exp(-.5*(np.array([n[2] for n in near])/.0025)**2)
    on_bar = float(w@R['relief'][[n[1] for n in near]]/w.sum())+.0005+slack
    return min(half-abs(z-mid), ends, on_bar)


def lid_field(p):
    """Black base inset beneath the raised liner, following its curve/taper.

    The visible upper edge belongs to the shiny contour. A separate tall
    painted band used to protrude above it, producing a second ragged line.
    """
    global _LINER_PAINT_SEGMENTS
    if p.y > -.03 or not .49 < p.z < .60:
        return -1.0
    side = 1 if p.x > 0 else -1
    u = p.x*side-EYE['cx']
    v = p.z-EYE['cz']
    hw = EYE['w']/2
    # Only over the eye: past the corner the sculpt's lash spikes paint as
    # ragged black patches (user markup); the smooth liner tube draws the wing.
    if u < -hw*.96 or u > hw*.90:
        return -1.0
    if _LINER_PAINT_SEGMENTS is None:
        path = _upper_liner_path()
        # Leave a margin inside the tube's silhouette, including its tapered
        # ends. Sampling uses the same point index as base._tube(), not u.
        radii = [LINER_RADIUS*.72*_liner_taper(i/(len(path)-1)) for i in range(len(path))]
        _LINER_PAINT_SEGMENTS = [(a, b, ra, rb) for a, b, ra, rb in
                                zip(path, path[1:], radii, radii[1:])]
    field = -1.0
    for (ax, az), (bx, bz), ra, rb in _LINER_PAINT_SEGMENTS:
        margin = max(ra, rb)
        if not min(ax, bx)-margin <= u <= max(ax, bx)+margin:
            continue
        dx, dz = bx-ax, bz-az
        t = max(0.0, min(1.0, ((u-ax)*dx+(v-az)*dz)/(dx*dx+dz*dz)))
        radius = ra+(rb-ra)*t
        field = max(field, radius-math.hypot(u-ax-t*dx, v-az-t*dz))
    return field


def _blush(material, surf):
    tree = material.node_tree
    nodes, links = tree.nodes, tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    feed = shader.inputs['Base Color'].links[0].from_socket
    coords = nodes.new('ShaderNodeTexCoord')
    mask = None
    centres = []
    for side in (-1, 1):
        c, _ = surf.at(side*BLUSH['x'], BLUSH['z'])
        centres.append([round(v, 4) for v in c])
        dist = nodes.new('ShaderNodeVectorMath')
        dist.operation = 'DISTANCE'
        dist.inputs[1].default_value = c
        links.new(coords.outputs['Object'], dist.inputs[0])
        ramp = nodes.new('ShaderNodeMapRange')
        ramp.interpolation_type = 'SMOOTHERSTEP'
        ramp.inputs['From Min'].default_value = BLUSH['radius']
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
    strength.inputs[1].default_value = BLUSH['strength']
    links.new(mask, strength.inputs[0])
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    colour = lambda sockets, name: next(x for x in sockets if x.name == name and x.type == 'RGBA')
    colour(mix.inputs, 'B').default_value = (.80, .26, .28, 1)
    links.new(strength.outputs['Value'], mix.inputs['Factor'])
    links.new(feed, colour(mix.inputs, 'A'))
    links.new(colour(mix.outputs, 'Result'), shader.inputs['Base Color'])
    return {'centres': centres}


def details(obj, mats, collection):
    """Waistband label and painted toenails, as in the concept."""
    surf = Surface(obj.data)
    out = {}
    label, n = surf.at(0, .027, .0018)
    frame = Matrix.Translation(label)
    base._ellipsoid('V5 Etiqueta do cós', (.012, .0016, .009), mats['faixas'], collection, frame)
    border = [label+Vector((x, -.0022, z)) for x, z in ((-.011, -.008), (.011, -.008), (.011, .008), (-.011, .008))]
    base._tube('V5 Borda da etiqueta', border+[border[0]], .0010, mats['tecido'], collection,
               Matrix.Identity(4), normal_hint=FRONT)
    nails = 0
    for side in (-1, 1):
        for dx in (-.034, -.012, .011, .033):
            x = side*.262+dx
            hit, nrm, _, _ = surf.tree.ray_cast(Vector((x, -1, -.905)), Vector((0, 1, 0)), 2)
            if hit is None or hit.y > -.09:
                continue
            m = Matrix.Translation(hit+nrm*.0003) @ nrm.to_track_quat('Y', 'Z').to_matrix().to_4x4()
            base._ellipsoid('V5 Unha %+d %.3f' % (side, dx), (.0052, .0011, .0042), mats['couro'], collection, m)
            nails += 1
    out['toenails'] = nails
    return out
