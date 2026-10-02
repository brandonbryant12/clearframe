"""Original cut-paper landform: layered contours, a cut face, and tactile depth."""
import math
import random
import bpy
import artkit as a


def tint(first, second, amount):
    channels = [round(int(first[i:i + 2], 16) * (1 - amount) + int(second[i:i + 2], 16) * amount) for i in (1, 3, 5)]
    return '#' + ''.join(f'{v:02x}' for v in channels)


def terrace(name, outline, z, height, material):
    count = len(outline)
    vertices = [(x, y, z) for x, y in outline] + [(x, y, z + height) for x, y in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces.extend((i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    a.assign(obj, material)
    edge = obj.modifiers.new('Pressed laminate edge', 'BEVEL')
    edge.width = 0.025
    edge.segments = 2
    obj.modifiers.new('Laminate face normals', 'WEIGHTED_NORMAL')
    return obj


def build(config):
    c = config['colors']
    rng = random.Random(config['seed'])
    phase_a, phase_b = rng.uniform(-0.2, 0.2), rng.uniform(-0.3, 0.3)
    floor = a.material('Warm studio paper', c['bg'], roughness=0.9, coat=0)
    a.box('Paper floor', (180, 180, 0.12), (0, 0, -0.15), floor, bevel=0)
    carrier = a.material('Section carrier', c['surface'], roughness=0.84, coat=0)
    base = a.box('Wide sample slab', (6.9, 4.65, 0.14), (0.18, 0.12, -0.015), carrier, bevel=0.07)
    base.rotation_euler.z = -0.10
    # A single cut exposes all tiers. The outline is an invented silhouette, not
    # a map; the ridge bends and shifts as it rises instead of repeating circles.
    layers = 9
    upper_cap = a.empty('Upper layers lift as one')
    cut_angle, opening = -0.69, 0.34
    for level in range(layers):
        t = level / (layers - 1)
        width, depth = 3.08 - t * 1.68, 1.93 - t * 1.03
        center_x, center_y = -0.23 + t * 0.57, 0.13 + t * 0.20
        outline = []
        for i in range(121):
            angle = cut_angle + opening + i / 120 * (math.tau - opening * 2)
            ripple = 1 + 0.11 * math.sin(angle * 3 + phase_a) + 0.045 * math.sin(angle * 5 + phase_b)
            # The western shoulder stays broad; the northern side develops a saddle.
            saddle = 1 - 0.15 * t * max(0, math.sin(angle + 0.25)) ** 4
            x = center_x + math.cos(angle) * width * ripple
            y = center_y + math.sin(angle) * depth * ripple * saddle
            outline.append((x, y))
        outline.append((-0.56 + t * 0.33, -0.12 + t * 0.10))
        color = tint(c['surface'], c['accent'], 0.18 + t * 0.66)
        if level == 5:
            color = tint(c['accent2'], c['surface'], 0.30)
        mat = a.material(f'Pigmented paper layer {level + 1}', color, roughness=0.80, coat=0)
        layer = terrace(f'Contour layer {level + 1}', outline, 0.055 + level * 0.16, 0.16, mat)
        if level >= 6:
            layer.parent = upper_cap

    scene = bpy.context.scene
    world = bpy.data.worlds.new('Landform warm diffuse sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = a.linear_rgba(c['bg'])
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.4
    scene.world = world
    a.light('Large paper softbox', (-3.0, -5.0, 8.5), (0, 0, 0.6), 1300, 4.7, (1.0, 0.91, 0.83))
    rake = a.light('Cut-face edge light', (5.0, -1.5, 5.0), (0.2, -0.2, 0.7), 700, 2.2, (1.0, 0.78, 0.55))
    a.light('Cool open fill', (-4, 4, 5), (0, 0, 0.5), 450, 5, (0.74, 0.86, 1.0))
    data = bpy.data.cameras.new('Section perspective')
    camera = bpy.data.objects.new('Section perspective', data)
    bpy.context.collection.objects.link(camera)
    data.type = 'PERSP'
    data.sensor_fit = 'HORIZONTAL'
    data.lens = 52 if config['width'] >= config['height'] else 46
    scene.camera = camera

    def update(phase, frame):
        phase %= 1.0
        opened = a.smooth_open(phase)
        upper_cap.location = (-0.36 * opened, 0.16 * opened, 0.58 * opened)
        a.key(upper_cap, frame, 'location')
        angle = -0.96 + math.sin(phase * math.tau + phase_a) * 0.12
        camera.location = (math.cos(angle) * 11.7, math.sin(angle) * 11.7, 8.1)
        a.aim(camera, (0.0, 0.0, 0.55))
        a.key(camera, frame, 'location', 'rotation_euler')
        rake.location.y = -1.5 + math.cos(phase * math.tau + phase_b) * 0.42
        a.aim(rake, (0.2, -0.2, 0.7))
        a.key(rake, frame, 'location', 'rotation_euler')
    return update
