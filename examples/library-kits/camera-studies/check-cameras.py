"""Check baked camera frames, static geometry and projected subject bounds."""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser(); p.add_argument('--receipt',required=True); p.add_argument('--out',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); rp=Path(a.receipt); r=json.loads(rp.read_text())
sys.path.insert(0,str(rp.parent/'source')); import camera_rig as rig
scene=bpy.context.scene; camera=scene.camera; path=json.loads(camera['clearframe_camera_rig']); review=json.loads(camera['clearframe_camera_review'])
rig.validate(path)
def matrix(o): return [v for row in o.matrix_world for v in row]
def box(names):
    coords=[world_to_camera_view(scene,camera,o.matrix_world@Vector(c)) for o in [scene.objects[n] for n in names] for c in o.bound_box]
    assert all(camera.data.clip_start < c.z < camera.data.clip_end for c in coords),'Clipped subject depth'
    return [min(c.x for c in coords),min(c.y for c in coords),max(c.x for c in coords),max(c.y for c in coords)]
def inside(b,s): return b[0]>=s[0]-1e-5 and b[1]>=s[1]-1e-5 and b[2]<=s[2]+1e-5 and b[3]<=s[3]+1e-5
report={'version':1,'id':r['id'],'status':'running','clipSha256':r.get('outputs',{}).get('clip.mp4',{}).get('sha256'),'sourceHashes':r['sourceHashes'],'framesChecked':0,'maxPoseError':0,'maxStaticGeometryDrift':0,'seekEqual':False,'focusRois':{},'limits':'Projected bounds and baked pose checks do not prove rendered visibility or collision avoidance.'}
try:
    scene.frame_set(1); bpy.context.view_layer.update()
    static={o.name:matrix(o) for o in scene.objects if o!=camera}
    snapshots={}; firstOptics=None; firstHero=None
    for frame,phase in enumerate(r['config']['motion']['poseSamples'],1):
        scene.frame_set(frame); bpy.context.view_layer.update(); expected=rig.path_at(path,phase)
        quat=(Vector(expected['target'])-Vector(expected['location'])).to_track_quat('-Z','Y')
        error=max(max(abs(x-y) for x,y in zip(camera.location,expected['location'])),abs(1-abs(camera.rotation_euler.to_quaternion().dot(quat))),*(abs(rig.optics(camera)[k]-expected[k]) for k in rig.SCALARS))
        report['maxPoseError']=max(report['maxPoseError'],error); assert error<1e-4,(frame,'camera pose',error)
        drift=max(abs(v-static[o.name][i]) for o in scene.objects if o!=camera for i,v in enumerate(matrix(o)))
        report['maxStaticGeometryDrift']=max(report['maxStaticGeometryDrift'],drift); assert drift<1e-6,(frame,'moving geometry')
        hero=box(review['heroNames']); assert inside(hero,review['opening']['safe']),(frame,'hero framing',hero)
        if phase>=.74:
            names=[o.name for o in scene.objects if o.type in ('MESH','CURVE') and o.name!='Seamless stage']
            assert inside(box(names),review['ending']['safe']),(frame,'system framing',box(names))
        if frame==1: firstHero=hero; firstOptics=rig.optics(camera)
        if review['kind']=='rack-focus':
            assert all(abs(rig.optics(camera)[k]-firstOptics[k])<1e-6 for k in firstOptics if k!='focus'),'Non-focus optic moved'
            assert math.dist(camera.location,path['keys'][0]['location'])<1e-6,'Rack camera translated'
            if frame==1: report['focusRois']={k:box(v['subjectNames']) for k,v in review['focusPlanes'].items()}
        snapshots[frame]=matrix(camera)+list(rig.optics(camera).values())
        report['framesChecked']+=1
    order=list(range(1,len(snapshots)+1,7))[::-1]+list(range(1,len(snapshots)+1))
    for frame in order:
        scene.frame_set(frame); bpy.context.view_layer.update()
        assert snapshots[frame]==matrix(camera)+list(rig.optics(camera).values()),('seek mismatch',frame)
    report['seekEqual']=True
    if review['kind']!='rack-focus':
        start,end=path['keys'][0],path['keys'][-1]
        report['distanceRatio']=math.dist(end['location'],end['target'])/math.dist(start['location'],start['target'])
        lastHero=box(review['heroNames']); report['heroWidthRatio']=(firstHero[2]-firstHero[0])/(lastHero[2]-lastHero[0])
        assert report['distanceRatio']>2 and report['heroWidthRatio']>2,'Insufficient scale change'
        assert all(k['lens']==start['lens'] for k in path['keys']),'Zoom substituted for physical pullback'
    else: assert review['focusPlanes']['near']['depth']<review['focusPlanes']['far']['depth']
    report['status']='passed'
except Exception as e:
    report['status']='failed';report['error']=str(e);raise
finally:
    Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
