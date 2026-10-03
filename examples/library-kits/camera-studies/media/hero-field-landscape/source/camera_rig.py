"""Deterministic, frame-baked camera paths; pure sampling works without Blender.

Positions, targets and focus distances are authored world units, never measured
data. Phase is the recipe's canonical pose clock, not elapsed or calendar time.
"""
import copy
import json
import math


SCALARS = {'lens': (1, 300), 'scale': (.01, 10000), 'shift_x': (-2, 2),
           'shift_y': (-2, 2), 'focus': (.01, 10000), 'fstop': (.1, 64)}
POSE_FIELDS = ('location', 'target', *SCALARS)


def number(value, low, high, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'{label} must be finite and between {low} and {high}.')


def _minimum_norm(start, end):
    delta = [b - a for a, b in zip(start, end)]
    denominator = sum(x*x for x in delta)
    t = max(0, min(1, -sum(a*d for a, d in zip(start, delta))/denominator)) if denominator else 0
    return math.sqrt(sum((a + t*d)**2 for a, d in zip(start, delta)))


def validate(path):
    if not isinstance(path, dict) or set(path) != {'version', 'clock', 'projection', 'dof', 'keys'}:
        raise ValueError('Camera path fields must be version, clock, projection, dof and keys.')
    if type(path['version']) is not int or path['version'] != 1 or path['clock'] != 'qualitative-pose' or path['projection'] not in ('perspective', 'orthographic') or not isinstance(path['dof'], bool):
        raise ValueError('Unsupported camera path contract.')
    keys = path['keys']
    if not isinstance(keys, list) or not 2 <= len(keys) <= 32:
        raise ValueError('A camera path needs 2–32 complete poses.')
    for i, key in enumerate(keys):
        if not isinstance(key, dict) or set(key) != set(POSE_FIELDS) | {'phase', 'ease'}:
            raise ValueError('Each camera key must contain a complete pose, phase and ease.')
        number(key['phase'], 0, 1, 'phase')
        if key['ease'] not in ('linear', 'smooth') or i and key['phase'] <= keys[i-1]['phase']:
            raise ValueError('Camera keys must have increasing phases and a supported incoming ease.')
        for name in ('location', 'target'):
            if not isinstance(key[name], (list, tuple)) or len(key[name]) != 3:
                raise ValueError(f'{name} must be a three-dimensional point.')
            for v in key[name]:
                number(v, -10000, 10000, name)
        for name, limits in SCALARS.items():
            number(key[name], *limits, name)
    if keys[0]['phase'] != 0 or keys[-1]['phase'] != 1:
        raise ValueError('Camera paths must cover phase zero through one.')
    # Interpolating camera and target must never pass through one another or a
    # vertical look direction where the Z-up roll becomes ambiguous.
    for a, b in zip(keys, keys[1:]):
        directions = [[t-p for p, t in zip(k['location'], k['target'])] for k in (a, b)]
        if _minimum_norm(*directions) < .001 or _minimum_norm(*(d[:2] for d in directions)) < .001:
            raise ValueError('Camera look direction crosses its target or the vertical roll pole.')
    return path


def path_at(path, phase):
    validate(path)
    number(phase, 0, 1, 'sample phase')
    keys = path['keys']
    for a, b in zip(keys, keys[1:]):
        if phase <= b['phase']:
            t = (phase - a['phase']) / (b['phase'] - a['phase'])
            if b['ease'] == 'smooth':
                t = t*t*(3-2*t)
            return {name: [x+(y-x)*t for x, y in zip(a[name], b[name])] if name in ('location', 'target')
                    else a[name]+(b[name]-a[name])*t for name in POSE_FIELDS}
    raise ValueError('Uncovered camera phase.')


def make_path(start, end, move=(.16, .74), projection='perspective', dof=False):
    """A held start, bounded move and held end. Repeated poses are real holds."""
    if not isinstance(move, (list, tuple)) or len(move) != 2:
        raise ValueError('Camera move must have a start and end phase.')
    number(move[0], 0, 1, 'move start')
    number(move[1], 0, 1, 'move end')
    if not 0 < move[0] < move[1] < 1:
        raise ValueError('A camera move needs nonempty start and end holds.')
    keys = [{**copy.deepcopy(pose), 'phase': phase, 'ease': ease}
            for pose, phase, ease in [(start, 0, 'linear'), (start, move[0], 'linear'),
                                      (end, move[1], 'smooth'), (end, 1, 'linear')]]
    return validate({'version': 1, 'clock': 'qualitative-pose', 'projection': projection, 'dof': dof, 'keys': keys})


def camera_pose(camera, target):
    """Capture an endpoint after explicitly authoring/fitting its framing."""
    return {'location': list(camera.location), 'target': list(target), 'lens': camera.data.lens,
            'scale': camera.data.ortho_scale, 'shift_x': camera.data.shift_x, 'shift_y': camera.data.shift_y,
            'focus': camera.data.dof.focus_distance, 'fstop': camera.data.dof.aperture_fstop}


def bind(camera, path):
    """Return a recipe update callback that bakes transforms and camera optics."""
    from mathutils import Vector
    path = copy.deepcopy(validate(path))
    camera.data.type = 'PERSP' if path['projection'] == 'perspective' else 'ORTHO'
    camera.data.dof.use_dof = path['dof']
    camera.data.dof.focus_object = None
    camera['clearframe_camera_rig'] = json.dumps(path)
    def update(phase, frame):
        pose = path_at(path, phase)
        camera.location = pose['location']
        camera.rotation_euler = (Vector(pose['target']) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        for field, key in [('lens', 'lens'), ('ortho_scale', 'scale'), ('shift_x', 'shift_x'), ('shift_y', 'shift_y')]:
            setattr(camera.data, field, pose[key])
            camera.data.keyframe_insert(data_path=field, frame=frame)
        for field, key in [('focus_distance', 'focus'), ('aperture_fstop', 'fstop')]:
            setattr(camera.data.dof, field, pose[key])
            camera.data.dof.keyframe_insert(data_path=field, frame=frame)
        for field in ('location', 'rotation_euler'):
            camera.keyframe_insert(data_path=field, frame=frame)
    return update


def optics(camera):
    """Values excluded by a world-matrix-only hold check."""
    d = camera.data
    return {'lens': d.lens, 'scale': d.ortho_scale, 'shift_x': d.shift_x, 'shift_y': d.shift_y,
            'focus': d.dof.focus_distance, 'fstop': d.dof.aperture_fstop, 'dof': float(d.dof.use_dof),
            'clip_start': d.clip_start, 'clip_end': d.clip_end,
            'sensor_width': d.sensor_width, 'sensor_height': d.sensor_height,
            'sensor_fit': float(['AUTO', 'HORIZONTAL', 'VERTICAL'].index(d.sensor_fit)),
            'projection': float(['PERSP', 'ORTHO', 'PANO'].index(d.type))}


def fit_perspective(camera, objects, target, safe=(.08, .15, .92, .70)):
    """Fit one perspective endpoint, preserving direction/lens and using lens shift.

    This is a framing solver, not collision avoidance or animated visibility
    proof. Supply the intended subject at this endpoint and verify the path.
    """
    import bpy
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    if camera.data.type != 'PERSP' or len(safe) != 4 or not (0 <= safe[0] < safe[2] <= 1 and 0 <= safe[1] < safe[3] <= 1):
        raise ValueError('Perspective fitting needs a valid safe rectangle.')
    objects = list(objects)
    if not objects or any(obj.type != 'MESH' for obj in objects):
        raise ValueError('Perspective fitting needs nonempty mesh subject geometry.')
    target = Vector(target)
    direction = (camera.location-target).normalized()
    if direction.length < .99:
        raise ValueError('Perspective camera cannot occupy its target.')
    scene = bpy.context.scene
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    desired = ((safe[0]+safe[2])*.5, (safe[1]+safe[3])*.5)
    def projected():
        bpy.context.view_layer.update()
        values = [world_to_camera_view(scene, camera, p) for p in points]
        if min(p.z for p in values) <= camera.data.clip_start:
            return None
        return (min(p.x for p in values), min(p.y for p in values), max(p.x for p in values), max(p.y for p in values))
    for _ in range(24):
        bounds = projected()
        if bounds is None:
            camera.location = target+(camera.location-target)*1.5
            continue
        # Measure the shift derivative through Blender's own camera projection;
        # avoid hand-assuming sensor fit or portrait aspect conventions.
        for axis, field in enumerate(('shift_x', 'shift_y')):
            center = (bounds[axis]+bounds[axis+2])*.5
            old = getattr(camera.data, field)
            setattr(camera.data, field, old+.01)
            moved = projected()
            derivative = ((moved[axis]+moved[axis+2])*.5-center)/.01
            if abs(derivative) < 1e-8:
                raise ValueError('Camera shift projection is degenerate.')
            setattr(camera.data, field, old+(desired[axis]-center)/derivative)
            bounds = projected()
        ratio = max((bounds[2]-bounds[0])/(safe[2]-safe[0]), (bounds[3]-bounds[1])/(safe[3]-safe[1]))
        if .965 <= ratio <= .995:
            break
        camera.location = target+(camera.location-target)*max(.5, ratio/.98)
    bounds = projected()
    if bounds is None or bounds[0] < safe[0]-1e-5 or bounds[1] < safe[1]-1e-5 or bounds[2] > safe[2]+1e-5 or bounds[3] > safe[3]+1e-5:
        raise ValueError('Perspective endpoint fit did not converge inside the safe rectangle.')
    return {'safe': list(safe), 'bounds': list(bounds), 'subjectNames': [o.name for o in objects]}
