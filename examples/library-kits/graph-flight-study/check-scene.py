"""Audit the reopened baked chart: data bounds, camera clearance and full ending."""
import argparse, hashlib, json, math, sys
from collections import defaultdict
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

parser=argparse.ArgumentParser()
parser.add_argument('--receipt',required=True)
parser.add_argument('--out',required=True)
parser.add_argument('--require-wall-only',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
receipt_path=Path(args.receipt)
receipt=json.loads(receipt_path.read_text())
sys.path.insert(0,str(receipt_path.parent/'source'))
import camera_rig
scene=bpy.context.scene
camera=scene.camera
meta=json.loads(camera['clearframe_graph_flight'])
path=json.loads(camera['clearframe_camera_rig'])
assert path['version']==3
objects=[o for o in scene.objects if o.type=='MESH' and o.name!='Seamless stage']
bars=sorted([o for o in objects if o.name.startswith('Observation ')],key=lambda o:o['timeIndex'])
assert len(bars)==len(meta['values'])==path['count']

def corners(obj):
    return [obj.matrix_world@Vector(c) for c in obj.bound_box]

def box(obj):
    pts=corners(obj)
    return [[min(p[i] for p in pts),max(p[i] for p in pts)] for i in range(3)]

def snapshot():
    return [v for obj in [camera,*objects] for row in obj.matrix_world for v in row]+[camera.data.lens]

def stage_geometry():
    stage=scene.objects['Seamless stage']
    assert not stage.modifiers and not stage.animation_data
    vertices=[stage.matrix_world@v.co for v in stage.data.vertices]
    tolerance=1e-6*max(1.,camera.data.clip_end,max(v.length for v in vertices))
    edges=defaultdict(list);planes=[]
    interior=Vector((meta['layout']['center'],0,max(v.z for v in vertices)/2))
    for face in stage.data.polygons:
        ids=list(face.vertices);origin=vertices[ids[0]]
        normal=(vertices[ids[1]]-origin).cross(vertices[ids[2]]-origin)
        assert normal.length>1e-7,('degenerate backdrop face',face.index)
        normal.normalize()
        assert max(abs(normal.dot(vertices[i]-origin)) for i in ids)<tolerance,('nonplanar backdrop face',face.index)
        assert normal.dot(interior-origin)>tolerance,('outward backdrop face',face.index)
        assert min(normal.dot(v-origin) for v in vertices)>-tolerance,('nonconvex backdrop',face.index)
        planes.append((normal,normal.dot(origin)))
        for a,b in zip(ids,ids[1:]+ids[:1]):edges[tuple(sorted((a,b)))].append((face.index,a,b))
    adjacent=defaultdict(set)
    for edge,uses in edges.items():
        assert len(uses)==2,('open backdrop edge',edge,len(uses))
        a,b=uses
        assert a[1]==b[2] and a[2]==b[1],('inconsistent backdrop winding',edge)
        adjacent[a[0]].add(b[0]);adjacent[b[0]].add(a[0])
    visited=set();pending=[0]
    while pending:
        f=pending.pop()
        if f in visited:continue
        visited.add(f);pending.extend(adjacent[f]-visited)
    assert len(visited)==len(planes),'disconnected backdrop shell'
    return stage,vertices,planes,tolerance


def cap_in_frustum(camera_inverse, slopes, tolerance):
    # Clip the entire virtual disk where the rounded ceiling begins, including
    # vertices behind the camera. An empty intersection means the dome stays
    # out of this deliberately expanded screen rectangle.
    radius=meta['layout']['stageRadius']+14
    height=meta['layout']['stageHeight']
    polygon=[camera_inverse@Vector((meta['layout']['center']+radius*math.cos(math.tau*j/128),radius*math.sin(math.tau*j/128),height)) for j in range(128)]
    left,right,bottom,top=slopes
    dx=(right-left)*.005;dy=(top-bottom)*.005
    left-=dx;right+=dx;bottom-=dy;top+=dy
    tests=[lambda p:-p.z-camera.data.clip_start,lambda p:camera.data.clip_end+p.z,
           lambda p:p.x+left*p.z,lambda p:-p.x-right*p.z,
           lambda p:p.y+bottom*p.z,lambda p:-p.y-top*p.z]
    for test in tests:
        if not polygon:return False
        result=[];previous=polygon[-1];before=test(previous)+tolerance
        for current in polygon:
            after=test(current)+tolerance
            if (before>=0)!=(after>=0):result.append(previous+(current-previous)*(before/(before-after)))
            if after>=0:result.append(current)
            previous=current;before=after
        polygon=result
    return bool(polygon)


report={'status':'running','framesChecked':0,'minimumCameraClearance':None,
        'maximumHeightError':0,'maximumPoseError':0,'endingBounds':None,'seekEqual':False,
        'backdropRayChecks':0,'minimumBackdropNearMargin':None,'maximumBackdropDistanceBound':0,
        'maximumBackdropRayDistance':0,'ceilingVisibleFrames':0,
        'checkerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'sceneSha256':hashlib.sha256((receipt_path.parent/'scene.blend').read_bytes()).hexdigest(),
        'limits':'Baked-frame mesh bounds, closed-convex backdrop near/far containment and stage-only ray probes. All-screen coverage at sampled raster poses requires motion blur off; continuous-time path proof and picture quality are separate. No claim of unobscured intermediate chart views.'}
try:
    minimum=float('inf'); snapshots={}
    assert not getattr(scene.render,'use_motion_blur',False),'motion blur needs shutter-subframe coverage'
    stage,stage_vertices,stage_planes,stage_tolerance=stage_geometry()
    assert camera.data.type=='PERSP' and not camera.data.dof.use_dof,'coverage assumes pinhole perspective'
    stage_inverse=stage.matrix_world.inverted()
    axis=Vector(((min(v.x for v in stage_vertices)+max(v.x for v in stage_vertices))/2,
                 (min(v.y for v in stage_vertices)+max(v.y for v in stage_vertices))/2,0))
    stage_radius=max(math.hypot(v.x-axis.x,v.y-axis.y) for v in stage_vertices)
    stage_bottom=min(v.z for v in stage_vertices);stage_top=max(v.z for v in stage_vertices)
    assert sum(abs(v.z-meta['layout']['stageHeight'])<stage_tolerance for v in stage_vertices)==128,'missing declared dome spring ring'
    minimum_near=float('inf')
    report['backdropMesh']={'vertices':len(stage_vertices),'faces':len(stage_planes),'closedConnectedConvex':True,'worldTolerance':stage_tolerance}
    for index,phase in enumerate(receipt['config']['motion']['poseSamples']):
        scene.frame_set(index+1);bpy.context.view_layer.update()
        # The camera and whole near-plane rectangle are strictly inside a
        # closed convex shell; all shell vertices lie before far. Therefore
        # every screen ray exits the shell between the clipping planes.
        view=camera.data.view_frame(scene=scene)
        slopes=(min(v.x/-v.z for v in view),max(v.x/-v.z for v in view),min(v.y/-v.z for v in view),max(v.y/-v.z for v in view))
        camera_inverse=camera.matrix_world.inverted()
        near=[camera.matrix_world@(v*(camera.data.clip_start/-v.z)) for v in view]
        near_margin=min(normal.dot(point)-constant for point in [camera.location,*near] for normal,constant in stage_planes)
        minimum_near=min(minimum_near,near_margin)
        assert near_margin>stage_tolerance,(index,'near plane exits backdrop',near_margin)
        radial=math.hypot(camera.location.x-axis.x,camera.location.y-axis.y)
        bound=math.hypot(radial+stage_radius,max(abs(stage_top-camera.location.z),abs(stage_bottom-camera.location.z)))
        report['maximumBackdropDistanceBound']=max(report['maximumBackdropDistanceBound'],bound)
        assert bound<camera.data.clip_end-1,(index,'backdrop exceeds far clip',bound)
        if cap_in_frustum(camera_inverse,slopes,stage_tolerance):
            report['ceilingVisibleFrames']+=1
            assert not args.require_wall_only,(index,'ceiling enters expanded picture')
        evaluated_stage=stage.evaluated_get(bpy.context.evaluated_depsgraph_get())
        origin=stage_inverse@camera.location
        for ix in range(5):
            for iy in range(5):
                local=Vector((slopes[0]+(slopes[1]-slopes[0])*ix/4,slopes[2]+(slopes[3]-slopes[2])*iy/4,-1))
                world=camera.matrix_world.to_3x3()@local
                direction=(stage_inverse.to_3x3()@world).normalized()
                hit,point,normal,face=evaluated_stage.ray_cast(origin,direction,distance=camera.data.clip_end)
                assert hit,(index,ix,iy,'uncovered backdrop ray')
                world_hit=stage.matrix_world@point
                distance=(world_hit-camera.location).length
                depth=-(camera_inverse@world_hit).z
                assert camera.data.clip_start+stage_tolerance<depth<camera.data.clip_end-stage_tolerance
                report['maximumBackdropRayDistance']=max(report['maximumBackdropRayDistance'],distance)
                report['backdropRayChecks']+=1
        pose=camera_rig.path_at(path,phase)
        rotation=(Vector(pose['target'])-Vector(pose['location'])).to_track_quat('-Z','Y')
        pose_error=max(*(abs(a-b) for a,b in zip(camera.location,pose['location'])),
                       abs(camera.data.lens-pose['lens']),
                       abs(1-abs(camera.rotation_euler.to_quaternion().dot(rotation))))
        report['maximumPoseError']=max(report['maximumPoseError'],pose_error)
        assert pose_error<1e-4,(index,'baked pose mismatch',pose_error)
        assert camera.data.sensor_fit=='HORIZONTAL' and abs(camera.data.sensor_width-36)<1e-6
        for obj in objects:
            bounds=box(obj)
            distance=math.sqrt(sum(max(lo-value,0,value-hi)**2 for value,(lo,hi) in zip(camera.location,bounds)))
            minimum=min(minimum,distance)
            assert distance>=path['clearance']-1e-5,(index,obj.name,'camera collision',distance)
        for i,(bar,value) in enumerate(zip(bars,meta['values'])):
            bounds=box(bar)
            assert abs(bounds[0][0]-(i*path['spacing']-path['bar_width']/2))<1e-5
            assert abs(bounds[0][1]-(i*path['spacing']+path['bar_width']/2))<1e-5
            assert abs(bounds[2][0])<1e-5,(index,bar.name,'nonzero baseline')
            assert -1e-6<=bounds[2][1]<=value*meta['heightPerUnit']+1e-5
            if phase>=path['phases'][1]:
                error=abs(bounds[2][1]-value*meta['heightPerUnit'])
                report['maximumHeightError']=max(report['maximumHeightError'],error)
                assert error<1e-5,(index,bar.name,'final value',error)
        if phase>=path['phases'][2]:
            points=[world_to_camera_view(scene,camera,p) for obj in objects for p in corners(obj)]
            assert all(camera.data.clip_start<p.z<camera.data.clip_end for p in points)
            b=[min(p.x for p in points),min(p.y for p in points),max(p.x for p in points),max(p.y for p in points)]
            assert b[0]>=path['margin']-.002 and b[1]>=path['margin']-.002 and b[2]<=1-path['margin']+.002 and b[3]<=1-path['margin']+.002,('incomplete ending',b)
            report['endingBounds']=b
        snapshots[index+1]=snapshot();report['framesChecked']+=1
    for frame in list(snapshots)[::-7]+list(snapshots):
        scene.frame_set(frame);bpy.context.view_layer.update()
        assert snapshot()==snapshots[frame],('seek mismatch',frame)
    report.update(status='pass',minimumCameraClearance=minimum,minimumBackdropNearMargin=minimum_near,seekEqual=True)
except Exception as error:
    report.update(status='failed',error=str(error));raise
finally:
    Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    Path(args.out).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
