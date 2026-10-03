"""Bounded pure-Python independent camera review; no Blender or render process."""
import copy,hashlib,importlib.util,json,math,pathlib,subprocess,types
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[4]
SOURCE=ROOT/'scripts/blender/camera_rig.py'
spec=importlib.util.spec_from_file_location('reviewed_rig',SOURCE);rig=importlib.util.module_from_spec(spec);spec.loader.exec_module(rig)
BASE='2a11fc79a6dfde57ce23fa545d28a601ddfc2622'
oldbytes=subprocess.check_output(['git','show',BASE+':scripts/blender/camera_rig.py'],cwd=ROOT);old=types.ModuleType('baseline_camera');exec(compile(oldbytes,'baseline_camera.py','exec'),old.__dict__)
checks=cases=negative=compatibility=0
FIELDS=('location','target','lens','scale','shift_x','shift_y','focus','fstop')
def verify(ok):
 global checks
 assert ok
 checks+=1
def close(a,b):verify(math.isclose(a,b,rel_tol=2e-12,abs_tol=2e-10))
poses=[{'location':[3.,-8.,5.],'target':[1.,2.,1.],'lens':50.,'scale':10.,'shift_x':0.,'shift_y':.1,'focus':11.,'fstop':4.},{'location':[-7.,3.,-5.],'target':[2.,-1.,1.],'lens':300.,'scale':.01,'shift_x':-2.,'shift_y':2.,'focus':.01,'fstop':64.},{'location':[.0011,0.,10.],'target':[0.,0.,0.],'lens':1.,'scale':10000.,'shift_x':1.,'shift_y':-1.,'focus':10000.,'fstop':.1}]
phases=[i/200 for i in range(201)]
for pose in poses:
 for projection in ['perspective','orthographic']:
  for ease in ['linear','smooth']:
   for move in [(.16,.74),(.1,.9)]:
    paths=[rig.make_orbit(pose,a,move,projection,False,ease) for a in [-170,-68,-.01,.01,68,170]]+[rig.make_truck(pose,d,move,projection,True,ease) for d in [[.001,0,0],[-.001,0,0],[2.7,0,0],[-2.,3.,4.],[0,0,-7.],[2.,-4.,1.]]]
    for p in paths:
     cases+=1;frozen=copy.deepcopy(p);original=copy.deepcopy(pose);start=rig.path_at(p,0);end=rig.path_at(p,1);samples={}
     for phase in sorted(set(phases+[move[0],move[1],math.nextafter(move[0],0),math.nextafter(move[1],1)])):
      got=rig.path_at(p,phase);samples[phase]=got;verify(set(got)==set(FIELDS));verify(p==frozen and pose==original)
      u=0 if phase<=move[0] else 1 if phase>=move[1] else (phase-move[0])/(move[1]-move[0]);progress=u if ease=='linear' else u*u*(3-2*u)
      for field in FIELDS[2:]:verify(got[field]==pose[field])
      if phase<=move[0]:verify(got==start)
      if phase>=move[1]:verify(got==end)
      for axis in ['location','target']:
       for v in got[axis]:verify(math.isfinite(v) and -10000<=v<=10000)
      close(math.dist(got['location'],got['target']),math.dist(pose['location'],pose['target']))
      if p['preset']=='orbit':
       verify(got['target']==pose['target']);verify(got['location'][2]==pose['location'][2]);dx=pose['location'][0]-pose['target'][0];dy=pose['location'][1]-pose['target'][1];radius=math.hypot(dx,dy);theta=math.atan2(dy,dx)+math.pi*p['degrees']/180*progress
       close(got['location'][0],pose['target'][0]+radius*math.cos(theta));close(got['location'][1],pose['target'][1]+radius*math.sin(theta));close(math.hypot(got['location'][0]-pose['target'][0],got['location'][1]-pose['target'][1]),radius)
      else:
       for j in range(3):
        close(got['location'][j]-pose['location'][j],p['translation'][j]*progress);close(got['target'][j]-pose['target'][j],p['translation'][j]*progress);close(got['target'][j]-got['location'][j],pose['target'][j]-pose['location'][j])
     roundtrip=json.loads(json.dumps(p));verify(all(rig.path_at(roundtrip,t)==samples[t] for t in reversed(list(samples)[::7])));verify(p==frozen)
     mutated=rig.path_at(p,.5);mutated['location'][0]+=123;verify(p==frozen)
# Old version-1 code is executed only as a pure baseline; no bpy dependencies.
for pose in poses:
 end=copy.deepcopy(pose);end['location']=[v+2 for v in end['location']];end['target']=[v+2 for v in end['target']];end['lens']=60.;end['shift_y']=-.5
 for projection in ['perspective','orthographic']:
  for move in [(.16,.74),(.01,.99)]:
   a=rig.make_path(pose,end,move,projection,True);b=old.make_path(pose,end,move,projection,True);verify(a==b)
   for t in phases:verify(rig.path_at(a,t)==old.path_at(b,t));compatibility+=1
# Domain and schema counterexamples; all must reject before Blender interaction.
def reject(fn):
 global negative
 try:fn()
 except (ValueError,TypeError,KeyError):negative+=1
 else:raise AssertionError('invalid path accepted')
p=poses[0]
for angle in [0,.009,-.009,170.001,-170.001,math.inf,math.nan,True,'68',None]:reject(lambda angle=angle:rig.make_orbit(p,angle))
for delta in [[0,0,0],[.0009,0,0],[1,2],[1,2,3,4],[1,False,0],[1,math.nan,0],[10001,0,0],['1',0,0],None]:reject(lambda delta=delta:rig.make_truck(p,delta))
for move in [(0,.7),(.1,1),(.8,.2),(.3,.3),(-.1,.5),(.1,math.nan),(True,.8),(.1,),None]:reject(lambda move=move:rig.make_orbit(p,60,move=move))
for field,value in [('version',True),('version',3),('clock','elapsed'),('projection','PANO'),('dof',1),('ease','cubic'),('preset','dolly'),('extra',1)]:
 q=rig.make_orbit(p,60);q[field]=value;reject(lambda q=q:rig.validate(q))
for field,value in [('extra',1),('phase',.3),('ease','bogus'),('lens',True),('lens',0),('location',[0,0,0]),('target',[3.,-8.,5.]),('focus',0),('shift_x',2.1),('scale',math.inf)]:
 q=copy.deepcopy(p);q[field]=value
 if field=='location':q['target']=[0,0,1]
 reject(lambda q=q:rig.make_orbit(q,60))
for t in [-.1,1.1,math.nan,True,'0.5']:reject(lambda t=t:rig.path_at(rig.make_truck(p,[1,0,0]),t))
q=copy.deepcopy(p);q['target']=[9999,0,0];q['location']=[9998,1,2];reject(lambda:rig.make_orbit(q,10))
reject(lambda:rig.make_truck(p,[10000,0,0]))
report={'status':'pass','pathCases':cases,'assertions':checks,'negativeCases':negative,'version1ExactSampleComparisons':compatibility,'baselineCommit':BASE,'baselineSourceSha256':hashlib.sha256(oldbytes).hexdigest(),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'tolerance':{'relative':2e-12,'absoluteWorldUnits':2e-10},'scope':'Pure path formulas, constraints, holds, serialization, mutation isolation and exact v1 baseline comparison; no Blender transforms or encoded pixels'}
(HERE/'model-check.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
