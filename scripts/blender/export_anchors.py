"""Project trusted prepared geometry without rendering or changing the saved scene.
Coordinates are top-left normalized image coordinates. Bounds are conservative
projected evaluated mesh boxes, not silhouettes, shading or occlusion proofs.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--request', required=True)
    a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    request = json.loads(Path(a.request).read_text())
    definition = request['definition']
    bpy.ops.wm.open_mainfile(filepath=request['scene'], load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    if scene.camera is None or scene.camera.data.type not in ('ORTHO', 'PERSP'):
        raise ValueError('A regular orthographic or perspective camera is required.')
    if scene.render.pixel_aspect_x != scene.render.pixel_aspect_y:
        raise ValueError('Non-square pixels are not supported by this anchor contract.')
    if abs(scene.render.fps / scene.render.fps_base - request['fps']) > 1e-9:
        raise ValueError('Saved scene FPS differs from the encoded asset.')
    width = round(scene.render.resolution_x * scene.render.resolution_percentage / 100)
    height = round(scene.render.resolution_y * scene.render.resolution_percentage / 100)
    if [width, height] != [request['width'], request['height']]:
        raise ValueError('Saved scene dimensions differ from the encoded asset.')
    start, end = definition['frames']
    if start + 1 < scene.frame_start or end > scene.frame_end:
        raise ValueError('Requested zero-based frames are outside the saved scene.')
    names = definition['subjects']
    if any(name not in scene.objects or scene.objects[name].type != 'MESH' or scene.objects[name].hide_render for name in names):
        raise ValueError('Subjects must name existing render-enabled mesh objects.')
    if any(a['object'] not in scene.objects for a in definition['anchors']):
        raise ValueError('An anchor object does not exist.')
    first = None
    max_drift = 0.0
    per_object = {}
    seen_points = 0
    anchors = None
    # Every frame in the declared half-open range is checked. No interpolation
    # or sampling claim substitutes for the held-range test.
    for frame in range(start, end):
        scene.frame_set(frame + 1)
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        camera = scene.camera.evaluated_get(graph)
        signature = []
        def project(point):
            v = world_to_camera_view(scene, camera, point)
            if not all(math.isfinite(n) for n in v) or v.z <= camera.data.clip_start or v.z >= camera.data.clip_end:
                raise ValueError('Subject geometry intersects the camera clipping range.')
            return [float(v.x), 1.0-float(v.y), float(v.z)]
        for name in names:
            obj = scene.objects[name].evaluated_get(graph)
            mesh = obj.to_mesh()
            try:
                if not len(mesh.vertices) or len(mesh.vertices) > 100000:
                    raise ValueError('Subject mesh needs 1–100000 evaluated vertices.')
                points = [project(obj.matrix_world @ vertex.co) for vertex in mesh.vertices]
                signature.extend(n for point in points for n in point)
                # Evaluated bounding-box corners are conservative for perspective
                # projection of geometry wholly in front of the near plane.
                corners = [project(obj.matrix_world @ Vector(corner)) for corner in obj.bound_box]
                box = [min(p[0] for p in corners), min(p[1] for p in corners), max(p[0] for p in corners), max(p[1] for p in corners)]
                signature.extend(n for corner in corners for n in corner)
                if min(box) < -1e-6 or max(box) > 1+1e-6:
                    raise ValueError('Subject bounds leave the encoded image; reframe before declaring copy zones.')
                if frame == start:
                    per_object[name] = box
                    seen_points += len(points)
            finally:
                obj.to_mesh_clear()
        projected_anchors = []
        for anchor in definition['anchors']:
            obj = scene.objects[anchor['object']].evaluated_get(graph)
            point = project(obj.matrix_world @ Vector(anchor['local']))
            if not (0 <= point[0] <= 1 and 0 <= point[1] <= 1):
                raise ValueError('Anchor leaves the encoded image.')
            projected_anchors.append({'id': anchor['id'], 'object': anchor['object'], 'local': anchor['local'], 'point': point[:2], 'depth': point[2], 'visibility': 'unassessed'})
            signature.extend(point)
        # Stable projected positions alone cannot establish a static 3D pose.
        signature.extend(v for row in camera.matrix_world for v in row)
        signature.extend([camera.data.lens, camera.data.ortho_scale, camera.data.shift_x, camera.data.shift_y, camera.data.clip_start, camera.data.clip_end])
        if first is None:
            first = signature
            anchors = projected_anchors
        else:
            if len(signature) != len(first):
                raise ValueError('Subject topology changes in the proposed static range.')
            max_drift = max(max_drift, max(abs(a-b) for a, b in zip(signature, first)))
            if max_drift > 1e-7:
                raise ValueError(f'Proposed static anchor range moves: frame {frame}, maximum coordinate drift {max_drift}')
    boxes = list(per_object.values())
    bounds = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
    padding = definition['padding']
    for zone in definition['copyZones']:
        x, y, w, h = zone['rect']
        if any(x < b[2]+padding and x+w > b[0]-padding and y < b[3]+padding and y+h > b[1]-padding for b in boxes):
            raise ValueError(f'Copy zone {zone["id"]} overlaps projected subject bounds and padding.')
    result = {'version': 1, 'coordinates': 'normalized-top-left', 'width': width, 'height': height,
              'frames': [start, end], 'fps': request['fps'], 'projection': scene.camera.data.type.lower(),
              'subjectBounds': bounds, 'objects': [{'name': name, 'bounds': bounds} for name, bounds in per_object.items()],
              'anchors': anchors, 'copyZones': definition['copyZones'], 'padding': padding,
              'checks': {'frames': end-start, 'evaluatedVerticesPerFrame': seen_points, 'maxCoordinateDrift': max_drift,
                         'tolerance': 1e-7, 'blenderVersion': bpy.app.version_string},
              'limits': ['Static prepared geometry only; no moving-label tracking', 'Conservative mesh bounds exclude shadows, blur and rendered transparency', 'Anchor visibility and occlusion are unassessed; inspect the encoded image', 'Copy zones test geometry separation, not text fit or readable contrast']}
    Path(request['result']).write_text(json.dumps(result, indent=2)+'\n')


if __name__ == '__main__':
    main()
