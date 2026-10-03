"""Export ending label anchors from the exact retained Blender scene.

No re-created camera formula: Blender projects the baked mesh and grid. The
native overlay is permitted only after these positions stop moving.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

parser = argparse.ArgumentParser()
parser.add_argument('--media', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
media = Path(args.media).resolve()
receipt = json.loads((media / 'receipt.json').read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert receipt['status'] == 'ready-for-review'
for name in ('scene.blend', 'clip.mp4'):
    assert sha(media / name) == receipt['outputs'][name]['sha256'], name
assert Path(bpy.data.filepath).resolve() == media / 'scene.blend'
scene = bpy.context.scene
camera = scene.camera
meta = json.loads(camera['clearframe_graph_flight'])
bars = sorted([o for o in scene.objects if o.name.startswith('Observation ')], key=lambda o: o['timeIndex'])
reading = next(p for p in receipt['config']['motion']['phases'] if p['id'] == 'reading')
first = reading['startFrame'] + 1  # Blender frames start at one.
last = receipt['config']['frames']

def project(point):
    p = world_to_camera_view(scene, camera, Vector(point))
    assert 0 < p.x < 1 and 0 < p.y < 1 and p.z > camera.data.clip_start
    return [p.x, 1 - p.y]

def anchors():
    observations = []
    for bar, value in zip(bars, meta['values']):
        corners = [bar.matrix_world @ Vector(p) for p in bar.bound_box]
        left, right = min(p.x for p in corners), max(p.x for p in corners)
        bottom, top = min(p.z for p in corners), max(p.z for p in corners)
        front = min(p.y for p in corners)
        assert abs(bottom) < 1e-5 and abs(top - value * meta['heightPerUnit']) < 1e-5
        observations.append({'index': bar['timeIndex'], 'value': value,
            'top': project(((left + right) / 2, front, top)),
            'base': project(((left + right) / 2, front, bottom)),
            'left': project((left, front, top)), 'right': project((right, front, top))})
    ticks = [{'value': value, 'point': project((-meta['layout']['spacing'] / 2, .054, value * meta['heightPerUnit']))} for value in meta['ticks']]
    return {'observations': observations, 'ticks': ticks}

scene.frame_set(first)
bpy.context.view_layer.update()
reference = anchors()
for frame in range(first, last + 1):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    assert anchors() == reference, ('ending anchors moved', frame)
report = {'version': 1, 'status': 'pass', 'coordinates': 'normalized-top-left',
    'width': receipt['config']['width'], 'height': receipt['config']['height'],
    'visibleFromSeconds': reading['startSeconds'], 'holdFramesChecked': last-first+1,
    'sourceClipSha256': sha(media/'clip.mp4'), 'sceneSha256': sha(media/'scene.blend'),
    'receiptSha256': sha(media/'receipt.json'), 'exporterSha256': sha(Path(__file__)), **reference}
(media/'ending-anchors.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'status': 'pass', 'anchors': len(bars), 'holdFramesChecked': report['holdFramesChecked']}))
