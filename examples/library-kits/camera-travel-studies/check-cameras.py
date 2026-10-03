"""Independent analytic reference, baked camera invariants and full subject bounds."""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('--receipt',required=True);p.add_argument('--out',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);rp=Path(a.receipt);r=json.loads(rp.read_text());scene=bpy.context.scene;camera=scene.camera
path=json.loads(camera['clearframe_camera_rig']);review=json.loads(camera['clearframe_camera_review']);base=path['pose'];assert path['version']==2
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def expected(phase):
    v=(phase-path['move'][0])/(path['move'][1]-path['move'][0]);v=0 if v<0 else 1 if v>1 else v
    if path['ease']=='smooth':v=3*v*v-2*v*v*v
    loc=list(base['location']);target=list(base['target'])
    if path['preset']=='orbit':
        radius=math.hypot(loc[0]-target[0],loc[1]-target[1]);angle=math.atan2(loc[1]-target[1],loc[0]-target[0])+math.radians(path['degrees'])*v
        loc[:2]=[target[0]+radius*math.cos(angle),target[1]+radius*math.sin(angle)]
    else:
        loc=[p+d*v for p,d in zip(loc,path['translation'])];target=[p+d*v for p,d in zip(target,path['translation'])]
    return loc,target

def matrix(o):return [v for row in o.matrix_world for v in row]
def snapshot():return matrix(camera)+[camera.data.lens,camera.data.ortho_scale,camera.data.shift_x,camera.data.shift_y,camera.data.dof.focus_distance,camera.data.dof.aperture_fstop]
def bounds(names):
    pts=[world_to_camera_view(scene,camera,scene.objects[n].matrix_world@Vector(c)) for n in names for c in scene.objects[n].bound_box]
    assert all(camera.data.clip_start<p.z<camera.data.clip_end for p in pts),'Depth clip'
    return [min(p.x for p in pts),min(p.y for p in pts),max(p.x for p in pts),max(p.y for p in pts)]
report={'status':'running','framesChecked':0,'maxPoseError':0,'maxStaticDrift':0,'seekEqual':False,'preset':path['preset'],'sceneSha256':sha(rp.parent/'scene.blend'),'receiptSha256':sha(rp),'samples':[],'limits':'Baked poses and subject bounds; not a general visibility or collision proof.'}
try:
    scene.frame_set(1);bpy.context.view_layer.update();static={o.name:matrix(o) for o in scene.objects if o!=camera};snapshots={};firstRotation=camera.rotation_euler.to_quaternion()
    for frame,phase in enumerate(r['config']['motion']['poseSamples'],1):
        scene.frame_set(frame);bpy.context.view_layer.update();loc,target=expected(phase);quat=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y')
        error=max(*(abs(x-y) for x,y in zip(camera.location,loc)),abs(1-abs(camera.rotation_euler.to_quaternion().dot(quat))))
        for field,key in [('lens','lens'),('ortho_scale','scale'),('shift_x','shift_x'),('shift_y','shift_y')]:error=max(error,abs(getattr(camera.data,field)-base[key]))
        for field,key in [('focus_distance','focus'),('aperture_fstop','fstop')]:error=max(error,abs(getattr(camera.data.dof,field)-base[key]))
        assert error<1e-4,(frame,'camera error',error);report['maxPoseError']=max(error,report['maxPoseError'])
        drift=max(abs(v-static[o.name][i]) for o in scene.objects if o!=camera for i,v in enumerate(matrix(o)));assert drift<1e-6,(frame,'geometry changed',drift);report['maxStaticDrift']=max(drift,report['maxStaticDrift'])
        if path['preset']=='truck':assert abs(1-abs(camera.rotation_euler.to_quaternion().dot(firstRotation)))<1e-6,'Truck panned'
        b=bounds(review['subjectNames']);s=review['safe'];assert b[0]>=s[0]-1e-5 and b[1]>=s[1]-1e-5 and b[2]<=s[2]+1e-5 and b[3]<=s[3]+1e-5,(frame,'subject bounds',b,s)
        marker='Central exposed shaft' if path['preset']=='orbit' else 'Rear amber junction';q=world_to_camera_view(scene,camera,scene.objects[marker].matrix_world.translation)
        sample={'frame':frame,'phase':phase,'bounds':b,'marker':[q.x,1-q.y],'markerDepth':q.z,'camera':list(camera.location),'target':target}
        if path['preset']=='truck':
            front=min(review['foregroundNames'],key=lambda n:abs(scene.objects[n].matrix_world.translation.x));point=world_to_camera_view(scene,camera,scene.objects[front].matrix_world.translation)
            sample['foreground']=[point.x,1-point.y];sample['foregroundDepth']=point.z
        report['samples'].append(sample);snapshots[frame]=snapshot();report['framesChecked']+=1
    for f in list(snapshots)[::-7]+list(snapshots):
        scene.frame_set(f);bpy.context.view_layer.update();assert snapshot()==snapshots[f],('seek mismatch',f)
    if path['preset']=='truck':
        first,last=report['samples'][0],report['samples'][-1]
        front=last['foreground'][0]-first['foreground'][0];rear=last['marker'][0]-first['marker'][0];ratio=front/rear;depthRatio=first['markerDepth']/first['foregroundDepth']
        assert front<rear<0 and ratio>1.03,('Missing depth parallax',front,rear)
        assert abs(ratio-depthRatio)<1e-5,('Perspective parallax ratio',ratio,depthRatio)
        report['parallax']={'foregroundDisplacement':front,'rearDisplacement':rear,'ratio':ratio,'depthRatio':depthRatio,'ratioError':abs(ratio-depthRatio)}
    report['seekEqual']=True;report['status']='pass'
except Exception as e:report['status']='failed';report['error']=str(e);raise
finally:Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='samples'}))
