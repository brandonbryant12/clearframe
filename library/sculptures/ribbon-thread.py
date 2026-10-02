"""Original ribbon sculpture with a deterministic closed route."""
import math
import random
import bpy
from mathutils import Vector
import artkit as a


def point(t):
    return Vector(((2.0 + 0.52 * math.cos(3 * t)) * math.cos(2 * t) * 0.68,
                   (2.0 + 0.52 * math.cos(3 * t)) * math.sin(2 * t) * 0.68,
                   0.68 * math.sin(3 * t)))


def build(config):
    c = config['colors']
    rng = random.Random(config['seed'])
    mat = a.material('Brushed ribbon', c['accent'], metallic=0.5, roughness=0.29, coat=0.3)
    edge = a.material('Ribbon edge', c['accent2'], metallic=0.25, roughness=0.3)
    marker_mat = a.material('Idea markers', c['ink'], metallic=0.15, roughness=0.25)
    a.studio(config, target=(0, 0, 1.8), scale=8.8)
    root = a.empty('Thread root', (0, 0, 1.85))
    root.rotation_euler = (0.48, 0.28, rng.uniform(-0.16, 0.16))
    verts, faces, rails = [], [], [[], []]
    count = 192
    twist = rng.uniform(-0.2, 0.2)
    for i in range(count):
        t = i / count * math.tau
        p = point(t)
        tangent = (point(t + 0.002) - point(t - 0.002)).normalized()
        normal = tangent.cross(Vector((0, 0, 1))).normalized()
        binormal = tangent.cross(normal).normalized()
        side = normal * math.cos(t + twist) + binormal * math.sin(t + twist)
        for sign, rail in zip((-1, 1), rails):
            v = p + side * sign * 0.26
            verts.append(tuple(v))
            rail.append(tuple(v))
    for i in range(count):
        j = (i + 1) % count
        faces.append((i * 2, j * 2, j * 2 + 1, i * 2 + 1))
    mesh = bpy.data.meshes.new('Continuous ribbon mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Continuous ribbon', mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    a.assign(obj, mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mod = obj.modifiers.new('Ribbon thickness', 'SOLIDIFY')
    mod.thickness = 0.035
    bevel = obj.modifiers.new('Polished edge', 'BEVEL')
    bevel.width = 0.018
    bevel.segments = 2
    for i, rail in enumerate(rails):
        a.curve(f'Glazed ribbon edge {i}', rail, 0.014, edge, closed=True, parent=root)
    markers = [a.sphere(f'Travelling idea {i}', (0, 0, 0), 0.08, marker_mat, parent=root) for i in range(3)]

    def update(phase, frame):
        root.rotation_euler.z = math.sin(phase * math.tau) * 0.28
        root.rotation_euler.x = 0.48 + math.sin(phase * math.tau) * 0.08
        a.key(root, frame, 'rotation_euler')
        for i, marker in enumerate(markers):
            marker.location = point((phase + i / 3) * math.tau)
            a.key(marker, frame, 'location')
    return update
