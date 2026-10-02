"""Original ceramic reveal sculpture, authored for ClearFrame."""
import math
import random
import bpy
from mathutils import Vector
import artkit as a


def build(config):
    colors = config['colors']
    rng = random.Random(config['seed'])
    ceramic = a.material('Porcelain shell', colors['surface'], roughness=0.38, coat=0.18)
    rim = a.material('Glazed edge', colors['accent2'], roughness=0.34, coat=0.22)
    satin = a.material('Inner discovery', colors['accent'], metallic=0.25, roughness=0.3)
    a.studio(config, target=(0, 0, 1.4), scale=8.4)
    a.cylinder('Low plinth', (0, 0, 0.13), 1.65, 0.26, ceramic)
    a.ring('Glazed plinth rim', 1.47, 0.035, rim, location=(0, 0, 0.29))
    core = a.sphere('Unlabelled hero object', (0, 0, 1.46), 0.71, satin)
    petal_groups = []
    for i in range(6):
        angle = i * math.tau / 6 + rng.uniform(-0.018, 0.018)
        root = a.empty(f'Petal hinge {i + 1}', (math.cos(angle), math.sin(angle), 0.38))
        root.rotation_euler.z = angle
        pin = a.cylinder(f'Visible ceramic hinge {i + 1}', tuple(root.location), 0.095, 0.34, rim)
        pin.rotation_euler = (math.pi / 2, 0, angle)
        # A thick curved shell, narrowing toward its tip, in local X/Z.
        verts, faces = [], []
        rows, cols = 22, 8
        for j in range(rows + 1):
            t = j / rows
            radius = 0.96 - 0.48 * t + 0.36 * math.sin(math.pi * t)
            z = t * 2.08
            width = 0.49 * math.sin(math.pi * (0.06 + 0.89 * t)) + 0.07
            for k in range(cols + 1):
                across = (k / cols - 0.5) * 2
                verts.append((radius - 1.0 - 0.13 * across * across, across * width, z))
        for j in range(rows):
            for k in range(cols):
                v = j * (cols + 1) + k
                faces.append((v, v + 1, v + cols + 2, v + cols + 1))
        mesh = bpy.data.meshes.new(f'Ceramic shell {i + 1}')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(f'Ceramic petal {i + 1}', mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = root
        a.assign(obj, ceramic if i % 3 else rim)
        for poly in mesh.polygons:
            poly.use_smooth = True
        solid = obj.modifiers.new('Ceramic thickness', 'SOLIDIFY')
        solid.thickness = 0.075
        bevel = obj.modifiers.new('Soft lip', 'BEVEL')
        bevel.width = 0.038
        bevel.segments = 3
        petal_groups.append((root, angle))

    def update(phase, frame):
        opened = a.smooth_open(phase)
        for i, (obj, angle) in enumerate(petal_groups):
            delayed = max(0.0, min(1.0, (opened - (i % 3) * 0.06) / (1 - (i % 3) * 0.06)))
            obj.rotation_euler = (0, math.radians(58) * delayed, angle)
            a.key(obj, frame, 'rotation_euler')
        core.location.z = 1.46 + opened * 0.25
        core.rotation_euler.z = phase * math.tau
        a.key(core, frame, 'location', 'rotation_euler')
    return update
