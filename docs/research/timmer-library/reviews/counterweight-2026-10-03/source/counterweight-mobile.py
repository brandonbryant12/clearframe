"""Original articulated mobile; exact kinematics, no physics bake dependency."""
import math
import random
import json
import bpy
from mathutils import Vector
import artkit as a


def build(config):
    c = config['colors']
    rng = random.Random(config['seed'])
    metal = a.material('Warm brushed brass', c['accent2'], metallic=0.75, roughness=0.24)
    green = a.material('Ceramic counterweight', c['accent'], roughness=0.35, coat=0.18)
    pearl = a.material('Porcelain counterweight', c['ink'], roughness=0.38, coat=0.12)
    stone = a.material('Gallery stone', c['surface'], roughness=0.6, coat=0)
    camera = a.studio(config, target=(0, 0, 2.5), scale=10.2, dark=True)
    camera.location = (6, -14, 7)
    a.aim(camera, (0, 0, 2.45))
    a.cylinder('Gallery base', (0, 0, 0.16), 2.3, 0.32, stone)
    a.cylinder('Slender support', (0, 0.28, 2.14), 0.055, 3.95, metal)
    a.curve('Pivot bracket', [(0, 0.28, 4.08), (0, 0, 4.08)], 0.05, metal)
    a.sphere('Upper pivot', (0, 0, 4.08), 0.1, metal)
    rod_names = ['Upper beam', 'Left suspension', 'Lower suspension', 'Lower beam', 'Lower left wire', 'Lower right wire']
    rods = [a.cylinder(name, (0, 0, 0), 0.03 if 'beam' in name else 0.015, 1, metal) for name in rod_names]
    r_left = 0.53 + rng.uniform(-0.035, 0.035)
    weights = [a.cylinder('Large suspended ceramic disc', (0, 0, 0), r_left, 0.11, green),
               a.cylinder('Small suspended porcelain disc', (0, 0, 0), 0.34, 0.1, pearl),
               a.box('Suspended brass square', (0.56, 0.12, 0.56), (0, 0, 0), metal, bevel=0.045)]
    hubs = [a.sphere('Lower pivot', (0, 0, 0), 0.085, metal)]
    # Enclose every authored pose, including seeded disc radii, before fitting.
    # This box is framing scaffolding only; it is removed before rendering.
    # The native composition reserves the top and bottom for editable copy.
    subject_names = [o.name for o in bpy.context.scene.objects
                     if o.type in ('MESH', 'CURVE') and o.name != 'Seamless stage']
    envelope = a.box('Temporary mobile framing envelope', (5.3, 4.8, 4.6),
                     (0, 0, 2.3), stone, bevel=0)
    safe = (.40, .15, .94, .87) if config['width'] >= config['height'] else (.10, .20, .90, .69)
    a.fit_camera(camera, [envelope], safe=safe)
    framing = json.loads(camera['clearframe_framing'])
    framing['subjectNames'] = subject_names
    framing['envelope'] = {'min': [-2.65, -2.4, 0], 'max': [2.65, 2.4, 4.6]}
    framing['purpose'] = 'Conservative bounds for one complete qualitative cycle; verify all baked frames.'
    camera['clearframe_framing'] = json.dumps(framing)
    bpy.data.objects.remove(envelope, do_unlink=True)
    def place_rod(obj, start, end, frame):
        start, end = Vector(start), Vector(end)
        delta = end - start
        obj.location = (start + end) * 0.5
        obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
        obj.scale = (1, 1, delta.length)
        a.key(obj, frame, 'location', 'rotation_euler', 'scale')
    def offset(point, dx, angle):
        return Vector(point) + Vector((dx * math.cos(angle), 0, dx * math.sin(angle)))
    def down(point, distance):
        return Vector(point) + Vector((0, 0, -distance))
    def update(phase, frame):
        angle = 0.18 * math.sin(phase * math.tau)
        lower_angle = -0.24 * math.sin(phase * math.tau + 0.55)
        pivot = Vector((0, 0, 4.08))
        left, right = offset(pivot, -1.9, angle), offset(pivot, 1.4, angle)
        lower = down(right, 0.84)
        low_left, low_right = offset(lower, -0.84, lower_angle), offset(lower, 0.76, lower_angle)
        left_top, little_top, square_top = down(left, 1.0), down(low_left, 0.53), down(low_right, 0.9)
        pairs = [(left, right), (left, left_top), (right, lower), (low_left, low_right), (low_left, little_top), (low_right, square_top)]
        for obj, pair in zip(rods, pairs):
            place_rod(obj, *pair, frame)
        hubs[0].location = lower
        a.key(hubs[0], frame, 'location')
        for i, (obj, top, radius) in enumerate(zip(weights, [left_top, little_top, square_top], [r_left, 0.34, 0.28])):
            obj.location = down(top, radius)
            obj.rotation_euler = ((math.pi / 2 if i < 2 else 0), 0, 0.14 * math.sin(phase * math.tau + i))
            a.key(obj, frame, 'location', 'rotation_euler')
    return update
