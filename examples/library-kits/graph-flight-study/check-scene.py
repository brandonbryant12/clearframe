"""Audit the reopened baked chart: data bounds, camera clearance and full ending."""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

parser=argparse.ArgumentParser()
parser.add_argument('--receipt',required=True)
parser.add_argument('--out',required=True)
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

report={'status':'running','framesChecked':0,'minimumCameraClearance':None,
        'maximumHeightError':0,'maximumPoseError':0,'endingBounds':None,'seekEqual':False,
        'sceneSha256':hashlib.sha256((receipt_path.parent/'scene.blend').read_bytes()).hexdigest(),
        'limits':'Baked-frame mesh bounds and full ending projection; continuous path proof is separate. No claim of unobscured intermediate views.'}
try:
    minimum=float('inf'); snapshots={}
    for index,phase in enumerate(receipt['config']['motion']['poseSamples']):
        scene.frame_set(index+1);bpy.context.view_layer.update()
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
    report.update(status='pass',minimumCameraClearance=minimum,seekEqual=True)
except Exception as error:
    report.update(status='failed',error=str(error));raise
finally:
    Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    Path(args.out).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
