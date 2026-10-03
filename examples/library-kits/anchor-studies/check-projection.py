"""Independent camera-matrix check of the retained anchor projections.
Run in Blender with auto-execution disabled. Does not invoke exporter functions.
"""
import json
import hashlib
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
reports=[]
for name in ['reservoir-landscape','reservoir-vertical','conveyor-landscape','conveyor-vertical']:
    asset=ROOT.parent/'physical-mechanisms'/'media'/name
    manifest=json.loads((ROOT/'anchors'/f'{name}.json').read_text())
    definition=json.loads((ROOT/'definitions'/f'{name}.json').read_text())
    assert sha(asset/'scene.blend')==manifest['source']['scene']['sha256']
    bpy.ops.wm.open_mainfile(filepath=str(asset/'scene.blend'), load_ui=False, use_scripts=False)
    scene=bpy.context.scene
    maximum=0
    tested=0
    for frame in range(*manifest['frames']):
        scene.frame_set(frame+1)
        bpy.context.view_layer.update()
        graph=bpy.context.evaluated_depsgraph_get()
        camera=scene.camera.evaluated_get(graph)
        projection=camera.calc_matrix_camera(graph, x=manifest['width'], y=manifest['height'], scale_x=1.0, scale_y=1.0)
        view=camera.matrix_world.inverted()
        for source in definition['anchors']:
            obj=scene.objects[source['object']].evaluated_get(graph)
            world=obj.matrix_world @ Vector(source['local'])
            clip=projection @ view @ Vector((*world,1.0))
            expected=[(clip.x/clip.w+1)/2,(1-clip.y/clip.w)/2]
            anchor=next(a for a in manifest['anchors'] if a['id']==source['id'])
            error=max(abs(a-b) for a,b in zip(expected,anchor['point']))
            assert error<2e-6,(name,frame,source['id'],error)
            maximum=max(maximum,error)
            tested+=1
    reports.append({'name':name,'frames':manifest['frames'][1]-manifest['frames'][0],'anchorChecks':tested,'maxNormalizedError':maximum,'tolerance':2e-6,'manifestSha256':sha(ROOT/'anchors'/f'{name}.json'),'sceneSha256':sha(asset/'scene.blend')})
(ROOT/'evidence').mkdir(exist_ok=True)
(ROOT/'evidence'/'projection-checks.json').write_text(json.dumps({'status':'pass','method':'Saved camera projection matrix times inverse camera world transform times object/local point; independently compared to exporter coordinates. No rendered visibility claim.','blenderVersion':bpy.app.version_string,'scriptSha256':sha(Path(__file__)),'variants':reports},indent=2)+'\n')
print(json.dumps({'projectionAnchorChecks':sum(r['anchorChecks'] for r in reports),'maximumNormalizedError':max(r['maxNormalizedError'] for r in reports)}))
