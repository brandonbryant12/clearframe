"""Original vaulted arcade: perspective, plaster, and moving cast light."""
import math
import random
import bpy
import artkit as a


def arch(name, y, radius, spring, thickness, depth, material):
    """A watertight U-shaped vault assembled as a ring of quadrilateral sections."""
    inner = radius - thickness
    sections = [((-radius, 0), (-inner, 0))]
    for i in range(41):
        angle = math.pi - i / 40 * math.pi
        sections.append(((radius * math.cos(angle), spring + radius * math.sin(angle)),
                         (inner * math.cos(angle), spring + inner * math.sin(angle))))
    sections.append(((radius, 0), (inner, 0)))
    vertices, faces = [], []
    for outer, inside in sections:
        vertices.extend([(outer[0], y - depth / 2, outer[1]),
                         (inside[0], y - depth / 2, inside[1]),
                         (inside[0], y + depth / 2, inside[1]),
                         (outer[0], y + depth / 2, outer[1])])
    for i in range(len(sections) - 1):
        for side in range(4):
            j, k = i * 4 + side, i * 4 + (side + 1) % 4
            faces.append((j, k, k + 4, j + 4))
    faces.extend([(3, 2, 1, 0), tuple(range(len(vertices) - 4, len(vertices)))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    a.assign(obj, material)
    bevel = obj.modifiers.new('Worn plaster edge', 'BEVEL')
    bevel.width = 0.042
    bevel.segments = 3
    obj.modifiers.new('Plaster face normals', 'WEIGHTED_NORMAL')
    return obj


def build(config):
    c = config['colors']
    rng = random.Random(config['seed'])
    plaster = a.material('Dry mineral plaster', c['surface'], roughness=0.83, coat=0)
    floor = a.material('Chalk ground', c['bg'], roughness=0.91, coat=0)
    threshold = a.material('Pigmented threshold', c['accent2'], roughness=0.72, coat=0)
    a.box('Continuous ground', (180, 180, 0.10), (0, 0, -0.08), floor, bevel=0)
    # A rectangular promenade, not a circular display plinth.
    a.box('Promenade', (4.45, 9.1, 0.10), (0, 2.55, -0.015), plaster, bevel=0.045)
    phase_offset = rng.uniform(-0.18, 0.18)
    spacing = 1.47 + rng.uniform(-0.045, 0.045)
    for i in range(5):
        arch(f'Vault {i + 1}', i * spacing, 1.87, 1.46, 0.38, 0.34, plaster)
    a.box('Single colour threshold', (3.02, 0.09, 0.025), (0, spacing * 3.1, 0.058), threshold, bevel=0.008)

    scene = bpy.context.scene
    world = bpy.data.worlds.new('Arcade diffuse sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = a.linear_rgba(c['bg'])
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.24
    scene.world = world
    # One narrow source makes the geometry readable through long cast shadows.
    key = a.light('Raking afternoon light', (-6.8, -3.3, 6.4), (0, 2.2, 0), 2050, 0.75, (1.0, 0.91, 0.77))
    key.data.shape = 'RECTANGLE'
    key.data.size = 1.6
    key.data.size_y = 0.42
    a.light('Open sky fill', (1.5, 2.5, 9), (0, 2.5, 1.2), 160, 7, (0.82, 0.9, 1.0))

    data = bpy.data.cameras.new('Arcade perspective')
    camera = bpy.data.objects.new('Arcade perspective', data)
    bpy.context.collection.objects.link(camera)
    data.type = 'PERSP'
    data.sensor_fit = 'HORIZONTAL'
    data.lens = 49 if config['width'] >= config['height'] else 43
    scene.camera = camera
    target = (0, 2.45, 1.18)

    def update(phase, frame):
        phase %= 1.0
        wave = math.sin(phase * math.tau + phase_offset)
        camera.location = (7.25 + wave * 0.33, -11.25, 4.80 + math.cos(phase * math.tau) * 0.10)
        a.aim(camera, target)
        a.key(camera, frame, 'location', 'rotation_euler')
        key.location.x = -6.8 + wave * 1.1
        key.location.y = -3.3 + math.cos(phase * math.tau + phase_offset) * 0.65
        a.aim(key, (0, 2.2, 0))
        a.key(key, frame, 'location', 'rotation_euler')
    return update
