"""Inspect actual baked geometry, not the source state helper. Run in Blender."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

p = argparse.ArgumentParser()
p.add_argument('--receipt', required=True)
p.add_argument('--out', required=True)
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
receipt_path = Path(args.receipt)
r = json.loads(receipt_path.read_text())
scene = bpy.context.scene
framing = json.loads(scene.camera['clearframe_framing'])
safe = framing['safe']
objects = [scene.objects[name] for name in framing['subjectNames']]
report = {'version': 1, 'id': r['id'], 'status': 'running', 'framesChecked': 0,
          'clipSha256': r['outputs']['clip.mp4']['sha256'], 'sourceHashes': r['sourceHashes'],
          'safe': safe, 'projectedBounds': [1, 1, 0, 0], 'minimumPacketSeparation': None,
          'maxVolumeDrift': 0, 'maxFloorDrift': 0, 'endpointIncluded': True,
          'limitations': 'Baked geometric invariants and projected bounding boxes only; no physics or exhaustive rendered occlusion test.'}
assert hashlib.sha256((receipt_path.parent / 'clip.mp4').read_bytes()).hexdigest() == report['clipSha256']
try:
    first_volume = None
    previous_levels = None
    for frame in range(1, r['config']['frames'] + 2):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        coords = [world_to_camera_view(scene, scene.camera, obj.matrix_world @ Vector(corner)) for obj in objects for corner in obj.bound_box]
        assert all(c.z > 0 for c in coords), 'A subject lies behind the camera'
        box = [min(c.x for c in coords), min(c.y for c in coords), max(c.x for c in coords), max(c.y for c in coords)]
        assert box[0] >= safe[0] - 1e-5 and box[1] >= safe[1] - 1e-5 and box[2] <= safe[2] + 1e-5 and box[3] <= safe[3] + 1e-5, (frame, box, safe)
        report['projectedBounds'] = [min(report['projectedBounds'][i], box[i]) if i < 2 else max(report['projectedBounds'][i], box[i]) for i in range(4)]
        if r['id'] == 'reservoir-transfer':
            fills = [scene.objects[name] for name in ['Left fill', 'Right fill']] + [scene.objects['Channel fill strip %02d' % i] for i in range(6)]
            volume = sum(math.prod(obj.dimensions) for obj in fills)
            if first_volume is None:
                first_volume = volume
            report['maxVolumeDrift'] = max(report['maxVolumeDrift'], abs(volume - first_volume))
            assert abs(volume - first_volume) < 2e-5, (frame, 'volume', volume, first_volume)
            for obj in fills:
                floor = obj.location.z - obj.dimensions.z / 2
                report['maxFloorDrift'] = max(report['maxFloorDrift'], abs(floor - .34))
                assert abs(floor - .34) < 1e-5 and obj.dimensions.z > 0, (frame, 'floor')
            levels = [scene.objects[name].dimensions.z for name in ['Left fill', 'Right fill']]
            gate = scene.objects['Isolation gate']
            if previous_levels and max(abs(a - b) for a, b in zip(levels, previous_levels)) > 1e-5:
                assert gate.location.z - gate.dimensions.z / 2 > .34 + max(levels), (frame, 'transfer before clear gate')
            if r['config']['motion']['poseSamples'][frame - 1] >= .68:
                assert abs(levels[0] - levels[1]) < 1e-5, 'Gate closes before equalization'
            rod = scene.objects['Connected gate stem']
            assert abs((rod.location.z - rod.dimensions.z / 2) - (gate.location.z + gate.dimensions.z / 2)) < 1e-5, 'Disconnected stem'
            assert abs(rod.location.z + rod.dimensions.z / 2 - 4.36) < 1e-5, 'Stem leaves fixed yoke'
            previous_levels = levels
        elif r['id'] == 'conveyor-bypass':
            points = [scene.objects['Packet %d' % i].location for i in range(4)]
            separation = min(math.dist(a, b) for i, a in enumerate(points) for b in points[i + 1:])
            report['minimumPacketSeparation'] = min(report['minimumPacketSeparation'] or separation, separation)
            assert separation > .54, (frame, 'overlapping packets', separation)
            obstacles = [obj for obj in objects if obj.name.startswith('Fixed narrow main neck') or obj.name.startswith('Bypass gate guide')]
            for point in points:
                for obj in obstacles:
                    dx = max(abs(point.x - obj.location.x) - obj.dimensions.x / 2, 0)
                    dy = max(abs(point.y - obj.location.y) - obj.dimensions.y / 2, 0)
                    assert math.hypot(dx, dy) >= .27, (frame, 'packet intersects a guide', obj.name)
                if abs(point.x - .10) < .34 and abs(point.y + 1.25) < .27:
                    gate = scene.objects['Alternate passage gate']
                    assert gate.location.z - gate.dimensions.z / 2 > .63, (frame, 'closed bypass collision')
            if frame == 1:
                assert all(point.x < 0 and abs(point.y - .7) < 1e-5 for point in points)
            if frame == r['config']['frames'] + 1:
                assert all(point.x > 1.7 and abs(point.y - .7) < 1e-5 for point in points)
        else:
            raise ValueError('Unknown mechanism')
        report['framesChecked'] += 1
    report['status'] = 'passed'
except Exception as error:
    report['status'] = 'failed'
    report['error'] = str(error)
    raise
finally:
    Path(args.out).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
