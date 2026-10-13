"""Appearance v4; Blender background --threads 2, optional -- --draft."""
from pathlib import Path
import sys, json, hashlib, importlib.util, math
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
DIR=ROOT/'art/premium/modelos-3d/estudos-mixamo'
SOURCE=DIR/'meshy-pipoca-refinamento-v1.blend'
V3=DIR/'meshy-pipoca-identidade-v3/pipoca-identidade-v3.blend'
REFERENCE=ROOT/'art/premium/elenco/pipoca-v1.png'
OUTPUT=DIR/'meshy-pipoca-identidade-v4'
DRAFT='--draft' in sys.argv
def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def taubin(mesh,passes=10,top=.37,weights=None):
    """Remove Meshy terracing below the head; lambda/mu pairs keep volume."""
    import numpy as np
    co=np.array([v.co[:] for v in mesh.vertices])
    edges=np.array(mesh.edge_keys)
    deg=np.bincount(edges.ravel(),minlength=len(co))[:,None].clip(1)
    # Fade to zero approaching the refined head and neck seam.
    w=(np.clip((top-co[:,2])/.04,0,1) if weights is None else np.asarray(weights))[:,None]
    for _ in range(passes):
        for factor in (.50,-.53):
            avg=np.zeros_like(co)
            np.add.at(avg,edges[:,0],co[edges[:,1]])
            np.add.at(avg,edges[:,1],co[edges[:,0]])
            co+=factor*w*(avg/deg-co)
    mesh.vertices.foreach_set('co',co.ravel())
    mesh.update()
    return int((w[:,0]>0).sum())
def remove_meshy_tails(obj):
    """Meshy glued three lumpy cotton balls on the back of the shorts; the
    reference has one tail. Fit the shorts surface y=f(x,z) from a ring of
    skin around the footprint, delete everything standing proud of it and
    rebuild the hole on that surface. add_tail() places the single tail."""
    import bmesh, numpy as np
    bm=bmesh.new(); bm.from_mesh(obj.data)
    bm.normal_update()
    foot=lambda p:-.17<p.x<.16 and -.18<p.z<.075
    near=lambda p:-.23<p.x<.22 and -.25<p.z<.12
    ring=[v.co.copy() for v in bm.verts if near(v.co) and not foot(v.co)
          and v.normal.y>.35 and v.co.y>0]
    A=np.array([[1,p.x,p.z,p.x*p.x,p.x*p.z,p.z*p.z,p.x**3,p.z**3] for p in ring])
    coef=np.linalg.lstsq(A,np.array([p.y for p in ring]),rcond=None)[0]
    fit=lambda x,z:float(coef@[1,x,z,x*x,x*z,z*z,x**3,z**3])
    def proud(f):
        c=f.calc_center_median()
        if not foot(c): return False
        rise=c.y-fit(c.x,c.z)
        # Ball undersides hug the fit but do not face backwards like the shorts.
        return (c.z>-.165 and rise>.008) or (rise>-.012 and f.normal.y<.25)
    doomed=[f for f in bm.faces if proud(f)]
    removed=len(doomed)
    bmesh.ops.delete(bm,geom=doomed,context='FACES_ONLY')
    # Drop slivers of ball surface left floating inside the footprint.
    seen=set()
    for f in list(bm.faces):
        if f in seen: continue
        comp=[f]; seen.add(f); i=0
        while i<len(comp):
            for e in comp[i].edges:
                for g in e.link_faces:
                    if g not in seen: seen.add(g); comp.append(g)
            i+=1
        if len(comp)<3000 and any(foot(g.calc_center_median()) for g in comp):
            bmesh.ops.delete(bm,geom=comp,context='FACES_ONLY'); removed+=len(comp)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    # Python element refs go stale across subdivision; a face layer survives
    # (created first: adding a layer reallocates faces).
    layer=bm.faces.layers.int.new('pipoca_hip_patch')
    rim=[e for e in bm.edges if e.is_boundary and all(near(v.co) and v.co.y>0 for v in e.verts)]
    # holes_fill rejects this rim; a constrained triangulation seen from
    # behind handles the concave outline.
    fill=bmesh.ops.triangle_fill(bm,use_beauty=True,use_dissolve=False,edges=rim,
                                 normal=Vector((0,1,0)))['geom']
    for g in fill:
        if isinstance(g,bmesh.types.BMFace): g[layer]=1
    rim_set=set(rim)
    patch_faces=lambda:[f for f in bm.faces if f[layer]]
    for _ in range(3):
        interior=list({e for f in patch_faces() for e in f.edges if e not in rim_set})
        bmesh.ops.subdivide_edges(bm,edges=interior,cuts=1,use_grid_fill=True)
        bmesh.ops.triangulate(bm,faces=[f for f in patch_faces() if len(f.verts)>3])
    rim_verts={v for e in rim for v in e.verts}
    patch_verts={v for f in patch_faces() for v in f.verts}
    free=[v for v in patch_verts if v not in rim_verts]
    for _ in range(80):
        for v in free:
            n=[e.other_vert(v).co for e in v.link_edges]
            v.co=sum(n,Vector())/len(n)
    for v in free:
        v.co.y=fit(v.co.x,v.co.z)
    bm.normal_update(); bm.to_mesh(obj.data); obj.data.update(); bm.free()
    folds_before=sum(1 for p in obj.data.polygons if foot(p.center) and p.normal.y<-.05)
    hip=resample_hip(obj,foot,near)
    # Second pass: the first one untangles, this one irons what it exposed.
    hip['secondPass']=resample_hip(obj,foot,near)['resampledVertices']
    return {'removedFaces':removed,'rimEdges':len(rim),'patchVertices':len(free),
            'hipFitSamples':len(ring),'foldsBefore':folds_before,**hip}
def resample_hip(obj,foot,near):
    """Patching left wrinkles and folds where the balls sat. Rebuild the back
    of the shorts as a height field seen from behind: sample the outermost
    surface on a 4 mm grid (inner folds ignored), blur it ~1.2 cm (wrinkles
    go, glute shape stays), untangle the region in the x/z plane and seat it
    on the blurred surface, fading out at the edges."""
    import numpy as np
    from mathutils.bvhtree import BVHTree
    mesh=obj.data
    tree=BVHTree.FromPolygons([v.co for v in mesh.vertices],[list(p.vertices) for p in mesh.polygons])
    step=.004
    xs=np.arange(-.25,.23+step,step); zs=np.arange(-.25,.11+step,step)
    raw=np.full((len(zs),len(xs)),np.nan)
    for j,z in enumerate(zs):
        for i,x in enumerate(xs):
            hit=tree.ray_cast(Vector((x,1.5,z)),Vector((0,-1,0)),2)[0]
            if hit is not None and hit.y>.0: raw[j,i]=hit.y
    def blur(a,sigma):
        r=int(3*sigma)+1; k=np.exp(-.5*(np.arange(-r,r+1)/sigma)**2)
        valid=~np.isnan(a); v=np.where(valid,a,0.0); m=valid.astype(float)
        for axis in (0,1):
            v=np.apply_along_axis(lambda t:np.convolve(t,k,'same'),axis,v)
            m=np.apply_along_axis(lambda t:np.convolve(t,k,'same'),axis,m)
        return np.where(m>1e-6,v/np.maximum(m,1e-6),np.nan)
    smooth=blur(raw,.012/step)
    def height(x,z):
        fi=(x-xs[0])/step; fj=(z-zs[0])/step
        i=int(np.clip(np.floor(fi),0,len(xs)-2)); j=int(np.clip(np.floor(fj),0,len(zs)-2))
        u=fi-i; t=fj-j
        c=smooth[j:j+2,i:i+2]
        if np.isnan(c).any(): return None
        return float((c[0,0]*(1-u)+c[0,1]*u)*(1-t)+(c[1,0]*(1-u)+c[1,1]*u)*t)
    def edge_weight(p):
        # 1 over the old ball footprint, fading 3 cm into the surroundings.
        dx=max(-.17-p.x,p.x-.16,0); dz=max(-.18-p.z,p.z-.075,0)
        d=(dx*dx+dz*dz)**.5
        w=max(0.0,1-d/.03); return w*w*(3-2*w)
    neighbours=[[] for _ in mesh.vertices]
    for a,b in mesh.edge_keys:
        neighbours[a].append(b); neighbours[b].append(a)
    region={}
    for v in mesh.vertices:
        p=v.co
        if not near(p) or p.y<=.05: continue
        h=height(p.x,p.z)
        w=edge_weight(p)
        # Only the outer back sheet: skip legs/inner surfaces well behind it.
        if h is None or w<=0 or p.y<h-.05: continue
        region[v.index]=w
    for _ in range(60):
        moved={}
        for i,w in region.items():
            n=neighbours[i]
            ax=sum(mesh.vertices[k].co.x for k in n)/len(n)
            az=sum(mesh.vertices[k].co.z for k in n)/len(n)
            moved[i]=(ax,az,w)
        for i,(ax,az,w) in moved.items():
            co=mesh.vertices[i].co
            co.x+= .5*w*(ax-co.x); co.z+= .5*w*(az-co.z)
    for i,w in region.items():
        co=mesh.vertices[i].co
        h=height(co.x,co.z)
        if h is not None: co.y+= (h-co.y)*w
    mesh.update()
    folds=repair_folds(obj,near,height)
    return {'resampledVertices':len(region),**folds}
def repair_folds(obj,near,height):
    """Folds left by the removed balls would show as holes in a single-sided
    game mesh. On the back sheet, delete faces that face forward sideways
    (downward glute undersides are legit) plus their 1-ring, fill the holes
    and seat the fill on the smooth hip surface."""
    import bmesh
    bm=bmesh.new(); bm.from_mesh(obj.data); bm.normal_update()
    def on_back(c):
        h=height(c.x,c.z)
        return near(c) and c.y>.05 and h is not None and c.y>h-.05
    bad={f for f in bm.faces if f.normal.y<-.25 and abs(f.normal.z)<.8
         and on_back(f.calc_center_median())}
    found=len(bad)
    if not bad:
        bm.free(); return {'foldFaces':0}
    bad|={g for f in list(bad) for v in f.verts for g in v.link_faces}
    bmesh.ops.delete(bm,geom=list(bad),context='FACES_ONLY')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    # Every open edge back there must close: a partial rim leaves a hole.
    rim=[e for e in bm.edges if e.is_boundary and all(near(v.co) and v.co.y>.02 for v in e.verts)]
    filled=bmesh.ops.holes_fill(bm,edges=rim,sides=0)['faces']
    filled=bmesh.ops.triangulate(bm,faces=filled)['faces']
    # holes_fill skips complex loops; close whatever is still open from behind.
    left_open=[e for e in bm.edges if e.is_boundary and all(near(v.co) and v.co.y>.02 for v in e.verts)]
    if left_open:
        extra=bmesh.ops.triangle_fill(bm,use_beauty=True,use_dissolve=False,edges=left_open,
                                      normal=Vector((0,1,0)))['geom']
        filled+= [g for g in extra if isinstance(g,bmesh.types.BMFace)]
    # Fill faces must face out like their neighbours or the game culls them.
    bmesh.ops.recalc_face_normals(bm,faces=[f for f in bm.faces if near(f.calc_center_median())
                                            and f.calc_center_median().y>.02])
    rim_verts={v for e in rim for v in e.verts}
    inner={v for f in bm.faces if f.is_valid and any(v in rim_verts for v in f.verts)
           for v in f.verts} - rim_verts
    for _ in range(20):
        for v in inner:
            n=[e.other_vert(v).co for e in v.link_edges]
            v.co=v.co.lerp(sum(n,Vector())/len(n),.5)
    for v in inner|rim_verts:
        h=height(v.co.x,v.co.z)
        if h is not None and v.co.y>h-.05: v.co.y=h
    bm.normal_update(); bm.to_mesh(obj.data); obj.data.update()
    left=sum(1 for f in bm.faces if f.normal.y<-.25 and abs(f.normal.z)<.8
             and on_back(f.calc_center_median()))
    bm.free()
    return {'foldFaces':found,'foldFacesLeft':left,'foldRimEdges':len(rim)}
def weld_fur(parts,collection):
    """split_surface cuts the fur into head/body/ears/feet at arbitrary
    heights; separate normals left a serrated shading seam under the jaw and
    at the ankles. Weld them back into one continuous skin."""
    import bmesh
    names=('Pipoca | corpo','Pipoca | cabeca','Pipoca | orelhas','Pipoca | pes')
    fur=[p for p in parts if p.name in names]
    bm=bmesh.new()
    for p in fur: bm.from_mesh(p.data)
    before=len(bm.verts)
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-6)
    mesh=bpy.data.meshes.new('Pipoca | pele continua surface')
    bm.to_mesh(mesh); bm.free()
    mesh.materials.append(fur[0].data.materials[0])
    for poly in mesh.polygons: poly.use_smooth=True
    skin=bpy.data.objects.new('Pipoca | pele',mesh)
    collection.objects.link(skin)
    for p in fur: bpy.data.objects.remove(p,do_unlink=True)
    return [p for p in parts if p not in fur]+[skin],{'welded':[n for n in names],'mergedVertices':before-len(mesh.vertices)}
TAIL=(.020,-.080,.065)  # x, z, radius: centred on the spine under the waistband
def add_tail(body_parts,collection,mats):
    """One cotton-puff tail as in the reference sheet, seated on the hip."""
    import bmesh
    from mathutils import noise
    from mathutils.bvhtree import BVHTree
    x,z,r=TAIL
    hit=None
    for part in body_parts:
        if part.type!='MESH': continue
        tree=BVHTree.FromPolygons([v.co for v in part.data.vertices],[list(p.vertices) for p in part.data.polygons])
        h=tree.ray_cast(Vector((x,2,z)),Vector((0,-1,0)))[0]
        if h is not None and (hit is None or h.y>hit.y): hit=h
    center=Vector((x,hit.y+.62*r,z))
    bm=bmesh.new()
    bmesh.ops.create_icosphere(bm,subdivisions=5,radius=r)
    for v in bm.verts:
        n=v.co.normalized()
        # Soft clustered tufts, flattened where the puff meets the hip.
        lumps=.10*noise.noise(n*3.2)+.05*noise.noise(n*7.5)+.025*noise.noise(n*16)
        v.co=n*r*(1+lumps)
        v.co.y*=.86
        v.co+=center
    mesh=bpy.data.meshes.new('Pipoca | cauda algodao')
    bm.to_mesh(mesh); bm.free()
    mesh.materials.append(mats['pelagem'])
    for p in mesh.polygons: p.use_smooth=True
    tail=bpy.data.objects.new('Pipoca | cauda',mesh)
    collection.objects.link(tail)
    return tail,{'center':[round(c,4) for c in center],'radius':r,'vertices':len(mesh.vertices)}
def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    preserved={str(p.relative_to(ROOT)):digest(p) for p in (SOURCE,V3,REFERENCE)}
    source_scripts=[HERE/name for name in (
        'concluir-aparencia-meshy-pipoca.py', 'refinar-identidade-meshy-pipoca.py',
        'pipoca_materiais.py', 'pipoca_rosto_meshy.py', 'pipoca_rosto_meshy_v4.py',
        'pipoca_figurino_meshy_v4.py', 'pipoca_superficie_meshy_v4.py')]
    production_sources={str(p.relative_to(ROOT)):digest(p) for p in source_scripts}
    spec=importlib.util.spec_from_file_location('pipoca_v3_helpers',HERE/'refinar-identidade-meshy-pipoca.py')
    base=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(base)
    base.OUTPUT=OUTPUT
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene=bpy.context.scene
    original=next(o for o in scene.objects if o.type=='MESH' and not o.hide_render)
    from pipoca_materiais import criar_materiais
    from pipoca_rosto_meshy_v4 import refinar_rosto
    from pipoca_figurino_meshy_v4 import assign_regions,cut_boundaries,outfit_details
    from pipoca_superficie_meshy_v4 import refinar_materiais
    mats=criar_materiais()
    mats['tecido_top']=mats['tecido'].copy()
    mats['tecido_top'].name='Pipoca v4 | top esportivo indigo'
    surface=refinar_materiais(mats)
    collection=bpy.data.collections.new('Pipoca | identidade visual v4')
    scene.collection.children.link(collection)
    for old in list(original.users_collection):
        old.objects.unlink(original)
    collection.objects.link(original)
    original.name='Pipoca | base Meshy editavel v4'
    tail=remove_meshy_tails(original)
    body=base.adjust_body(original)
    body['meshyTailsReplaced']=tail
    neck=0
    for v in original.data.vertices:
        p=v.co
        if .27<p.z<.395 and -.08<p.x<.11 and -.065<p.y<.125:
            w=math.sin(math.pi*(p.z-.27)/.125)**2
            p.x=.015+(p.x-.015)*(1-.13*w)
            p.y=.035+(p.y-.035)*(1-.10*w)
            neck+=1
    original.data.update()
    body['neckSoftenedVertices']=neck
    body['taubinSmoothedVertices']=taubin(original.data)
    assign_regions(original,mats)
    face=refinar_rosto(original,mats,collection)
    boundaries=cut_boundaries(original,mats)
    outfit=outfit_details(original,mats,collection)
    parts=base.split_surface(original,collection,mats)
    for part in parts:
        if part.name=='Pipoca | top':
            for slot in part.material_slots:
                if slot.material==mats['tecido']:
                    slot.material=mats['tecido_top']
    parts,body['weldedSkin']=weld_fur(parts,collection)
    tail_obj,body['tail']=add_tail(parts,collection,mats)

    # The spindle locks read as white scratches against the soft fur of the
    # concept; skipped until a groom pass with real hair cards.
    fur={'skipped':'spindle locks read as scratches; groom later with hair cards'}
    camera=base.studio(scene)
    if hasattr(scene,'eevee') and hasattr(scene.eevee,'taa_render_samples'):
        scene.eevee.taa_render_samples=32 if DRAFT else 64
    scene.render.resolution_x=900
    scene.render.resolution_y=1200
    scene.render.resolution_percentage=65 if DRAFT else 100
    scene['pipoca_visual_status']='Appearance v4; rendered inspection precedes retopology.'
    scene['pipoca_reference']=str(REFERENCE.relative_to(ROOT))
    for p in (REFERENCE,ROOT/'art/premium/modelos-3d/referencias/pipoca-referencia-v1.png'):
        bpy.data.images.load(str(p),check_existing=True).pack()
    bpy.context.preferences.filepaths.save_version=0
    bpy.context.preferences.filepaths.file_preview_type='NONE'
    bpy.context.preferences.filepaths.use_auto_save_temporary_files=False
    camera.location=(0,-5,0)
    base.point_at(camera,(0,0,0))
    camera.data.ortho_scale=2.22
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.shading.type='MATERIAL'
                space.shading.use_scene_world=True
                space.shading.use_scene_lights=True
                space.region_3d.view_perspective='CAMERA'
    workfile=OUTPUT/'pipoca-identidade-v4.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(workfile))
    views=[('frente',(0,-5,0),(0,0,0),2.22),
           ('tres-quartos',(2.2,-5,.1),(0,0,0),2.22),
           ('perfil',(5,0,0),(0,0,0),2.22),('costas',(0,5,0),(0,0,0),2.22),
           ('rosto',(.35,-5,.46),(0,-.03,.47),.95)]
    if DRAFT: views=[views[0],views[-1]]
    captures=[]
    def capture(name,location,target,scale):
        camera.location=location
        base.point_at(camera,target)
        camera.data.ortho_scale=scale
        path=OUTPUT/(name+'.png')
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        print('PIPOCA_V4_VIEW',name,flush=True)
        return {'view':name,'file':name+'.png','sha256':digest(path),
                'camera':{'location':list(location),'target':list(target),'orthoScale':scale},
                'resolution':[round(scene.render.resolution_x*scene.render.resolution_percentage/100),
                              round(scene.render.resolution_y*scene.render.resolution_percentage/100)]}
    for v in views: captures.append(capture(*v))
    orbit=[]
    if not DRAFT:
        (OUTPUT/'giro-360').mkdir(exist_ok=True)
        scene.render.resolution_x=600
        scene.render.resolution_y=800
        for i in range(16):
            a=math.tau*i/16
            entry=capture('giro-360/%03d'%i,(5*math.sin(a),-5*math.cos(a),.04),(0,0,0),2.22)
            entry['degrees']=360*i/16
            orbit.append(entry)
    for name,sha in preserved.items():
        if digest(ROOT/name)!=sha: raise RuntimeError('Source changed: '+name)
    for name,sha in production_sources.items():
        if digest(ROOT/name)!=sha: raise RuntimeError('Production script changed: '+name)
    report={'stage':'appearance refinement after original concept comparison','version':4,
      'date':'2026-10-12','draft':DRAFT,'artisticApprovalByUser':False,
      'productionReview':'pending rendered-view inspection','readyForRetopologyPlanning':False,
      'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':digest(SOURCE),
      'previousVersion':str(V3.relative_to(ROOT)),'preservedSources':preserved,
      'productionSources':production_sources,
      'reference':str(REFERENCE.relative_to(ROOT)),'referenceSha256':digest(REFERENCE),
      'workfile':str(workfile.relative_to(ROOT)),'workfileSha256':digest(workfile),
      'blender':bpy.app.version_string,'body':body,'face':face,'garmentBoundaries':boundaries,
      'outfit':outfit,'materials':surface,'fur':fur,'views':captures,'orbit360':orbit,
      'visibleObjects':[{'name':o.name,'type':o.type,'vertices':len(o.data.vertices) if o.type=='MESH' else None}
                        for o in collection.objects if not o.hide_render],
      'nextSteps':['Neutral A pose and deformable retopology.','UV layout and baking of authored materials.',
                   'Skeleton, weights and motion transfer from existing animation studies.'],
      'limitations':['This editable sculpt is not a final game GLB.',
                     'No neutral pose, rig or combat clips created for the Meshy copy.',
                     'Rear outfit details inferred from auxiliary concept sheet.',
                     'Mobile performance and deformation checks follow topology and integration.']}
    (OUTPUT/'revisao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('PIPOCA_V4_COMPLETE',str(workfile),flush=True)
if __name__=='__main__':
    main()
