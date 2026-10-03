"""Bounded control-flow counterexamples using fake Blender data; no Blender/render.

This tests range traversal and rejection, not Blender projection correctness.
"""
import importlib.util
import json
import pathlib
import sys
import tempfile
import types

sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parents[5]
state = {'frame': 1, 'mode': 'static', 'visited': []}

class Vec(tuple):
    x = property(lambda s: s[0])
    y = property(lambda s: s[1])
    z = property(lambda s: s[2])

class Matrix:
    def __init__(self, camera=False): self.camera = camera
    def __matmul__(self, p):
        shift = .01 if state['mode'] == 'middle-moves' and state['frame'] == 2 else 0
        z = .01 if state['mode'] == 'near-plane' else p[2]
        return Vec((p[0]+shift, p[1], z))
    def __iter__(self):
        shift = .01 if self.camera and state['mode'] == 'camera-moves' and state['frame'] == 2 else 0
        return iter([[1,0,0,shift],[0,1,0,0],[0,0,1,0],[0,0,0,1]])

corners = [(x,y,z) for x in [.4,.6] for y in [.35,.55] for z in [9,10]]
class Subject:
    type = 'MESH'
    hide_render = False
    matrix_world = Matrix()
    bound_box = corners
    def evaluated_get(self, graph): return self
    def to_mesh(self):
        points = corners + [(.5,.5,9)] if state['mode'] == 'topology' and state['frame'] == 2 else corners
        return types.SimpleNamespace(vertices=[types.SimpleNamespace(co=p) for p in points])
    def to_mesh_clear(self): pass

camera = types.SimpleNamespace(data=types.SimpleNamespace(type='ORTHO',clip_start=.1,clip_end=100,lens=50,ortho_scale=5,shift_x=0,shift_y=0),matrix_world=Matrix(True))
camera.evaluated_get = lambda graph: camera
render = types.SimpleNamespace(pixel_aspect_x=1,pixel_aspect_y=1,fps=24,fps_base=1,resolution_x=100,resolution_y=100,resolution_percentage=100)
scene = types.SimpleNamespace(camera=camera,render=render,frame_start=1,frame_end=3,objects={'Subject':Subject()})
def frame_set(n):
    state['frame'] = n
    state['visited'].append(n)
scene.frame_set = frame_set
bpy = types.SimpleNamespace(ops=types.SimpleNamespace(wm=types.SimpleNamespace(open_mainfile=lambda **kwargs:None)),context=types.SimpleNamespace(scene=scene,view_layer=types.SimpleNamespace(update=lambda:None),evaluated_depsgraph_get=lambda:None),app=types.SimpleNamespace(version_string='fake-control-fixture'))
sys.modules['bpy']=bpy
sys.modules['mathutils']=types.SimpleNamespace(Vector=Vec)
sys.modules['bpy_extras']=types.ModuleType('bpy_extras')
sys.modules['bpy_extras.object_utils']=types.SimpleNamespace(world_to_camera_view=lambda s,c,p:Vec(p))
spec=importlib.util.spec_from_file_location('reviewed_exporter',ROOT/'scripts/blender/export_anchors.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
base={'version':1,'frames':[0,3],'subjects':['Subject'],'anchors':[{'id':'tip','object':'Subject','local':[.47,.43,9]}],'copyZones':[{'id':'heading','rect':[.05,.01,.9,.1]}],'padding':.02}
checks=[]
with tempfile.TemporaryDirectory(prefix='cf-anchor-control-review-') as temp:
    temp=pathlib.Path(temp)
    def run(name,mode='static',mutate=None,error=None,visited=None):
        d=json.loads(json.dumps(base))
        if mutate: mutate(d)
        state.update(mode=mode,frame=1,visited=[])
        request={'scene':'unused-fake-scene.blend','definition':d,'result':str(temp/'result.json'),'width':100,'height':100,'fps':24}
        (temp/'request.json').write_text(json.dumps(request))
        sys.argv=['review','--','--request',str(temp/'request.json')]
        try:
            module.main()
            assert error is None, (name,'accepted invalid state')
            result=json.loads((temp/'result.json').read_text())
            assert result['frames']==d['frames']
            assert result['checks']['frames']==d['frames'][1]-d['frames'][0]
            assert result['anchors'][0]['visibility']=='unassessed'
            assert all(abs(a-b)<1e-12 for a,b in zip(result['anchors'][0]['point'],[.47,.57]))
            assert all(abs(a-b)<1e-12 for a,b in zip(result['subjectBounds'],[.4,.45,.6,.65]))
        except ValueError as e:
            assert error and error in str(e), (name,str(e))
        if visited is not None: assert state['visited']==visited,(name,state['visited'])
        checks.append({'name':name,'passed':True})
    run('All three half-open source frames map to Blender frames 1,2,3',visited=[1,2,3])
    run('Nonzero half-open subrange visits exactly Blender frames 2,3',mutate=lambda d:d.update(frames=[1,3]),visited=[2,3])
    run('A one-frame hold checks its one source frame',mutate=lambda d:d.update(frames=[2,3]),visited=[3])
    run('Moving middle frame fails even when endpoints would agree',mode='middle-moves',error='moves',visited=[1,2])
    run('Intermediate evaluated vertex-count change fails',mode='topology',error='topology',visited=[1,2])
    run('Camera movement fails even when fake projection is held',mode='camera-moves',error='moves',visited=[1,2])
    run('Geometry before camera near plane fails',mode='near-plane',error='clipping')
    run('Range outside saved scene fails before traversal',mutate=lambda d:d.update(frames=[0,4]),error='outside',visited=[])
    run('Copy zone overlapping mesh fails',mutate=lambda d:d['copyZones'][0].update(rect=[.45,.45,.1,.1]),error='overlaps')
    run('Separated zone violating padding fails',mutate=lambda d:d['copyZones'][0].update(rect=[.1,.45,.295,.1]),error='overlaps')
    run('Zone separated beyond padding succeeds',mutate=lambda d:d['copyZones'][0].update(rect=[.1,.45,.27,.1]))
    render.pixel_aspect_x=2
    run('Nonsquare source pixels reject',error='Non-square')
    render.pixel_aspect_x=1
    render.fps=30
    run('Source FPS mismatch rejects',error='FPS')
    render.fps=24
    render.resolution_x=200
    run('Source dimension mismatch rejects',error='dimensions')
    render.resolution_x=100
report={'scope':'Fake Blender control-flow fixtures, including vertex-count changes; not face/edge connectivity, material animation, Blender projection, actual saved-scene replay, occlusion or rendered appearance evidence','checks':checks,'passed':len(checks)}
pathlib.Path(__file__).with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
