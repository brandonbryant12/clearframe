"""Original illustrative conveyor route with deterministic spacing, not throughput."""
import math


def ease(phase, start, end):
    t = min(1.0, max(0.0, (phase - start) / (end - start)))
    return t * t * (3 - 2 * t)


def route(distance):
    # All tokens use one arclength coordinate. Separation cannot collapse due
    # to independent easing or a final convergence on the same endpoint.
    if distance < 0:
        return (-.7 + distance, .7)
    vertices = [(-.7, .7), (-.7, -1.25), (.9, -1.25), (.9, .7), (4.5, .7)]
    for left, right in zip(vertices, vertices[1:]):
        length = math.dist(left, right)
        if distance <= length:
            return tuple(a + (b - a) * distance / length for a, b in zip(left, right))
        distance -= length
    return vertices[-1]


def state(phase):
    approach = ease(phase, .10, .28)
    release = ease(phase, .48, .80)
    positions = []
    for i in range(4):
        if phase < .48:
            positions.append((-.7 - i * .85 - .6 * (1 - approach), .7))
        else:
            positions.append(route(9.1 * release - i * .85))
    return {'gate': ease(phase, .38, .48), 'approach': approach, 'release': release, 'positions': positions}


def build(config):
    import artkit as a
    import bpy
    c = config['colors']
    porcelain = a.material('Conveyor porcelain foundation', '#dddde1', roughness=.58, coat=.08)
    graphite = a.material('Graphite conveyor belts', c['ink'], roughness=.48, coat=.08)
    steel = a.material('Brushed conveyor guide', '#9ba2ac', metallic=.7, roughness=.32)
    orange = a.material('Amber gates', c['accent2'], metallic=.12, roughness=.30)
    token_mat = a.material('Blue ceramic packets', '#447eb4', roughness=.3, coat=.28)
    camera = a.studio(config, target=(.5, -.15, .6), scale=14.3 if config['width'] >= config['height'] else 12.0)
    camera.location = (-8, -12, 15.0)
    a.aim(camera, (.5, -.15, .6))
    a.box('Conveyor plinth', (10.1, 4.1, .24), (.5, -.1, .16), porcelain, bevel=.15)
    # Incoming and outgoing belts plus a U-shaped bypass below the fixed neck.
    for name, dims, location in [
        ('Incoming belt', (4.0, .80, .13), (-2.4, .7, .36)),
        ('Outgoing belt', (4.4, .80, .13), (2.8, .7, .36)),
        ('Narrow main connector', (1.2, .28, .13), (.1, .7, .36)),
        ('Bypass descent', (.80, 1.95, .13), (-.7, -.275, .36)),
        ('Bypass crossing', (1.6, .80, .13), (.1, -1.25, .36)),
        ('Bypass ascent', (.80, 1.95, .13), (.9, -.275, .36)),
    ]:
        a.box(name, dims, location, graphite, bevel=.05)
    # A conspicuously narrow main opening remains closed to these wider tokens.
    for y in [.7 - .39, .7 + .39]:
        a.box('Fixed narrow main neck', (.40, .50, .90), (.10, y, .85), orange, bevel=.035)
    a.box('Main neck overhead link', (.40, 1.35, .13), (.10, .7, 1.37), graphite, bevel=.03)
    for y in [-1.73, -.77]:
        a.box('Bypass gate guide', (.17, .13, 1.65), (.10, y, 1.265), steel, bevel=.018)
    gate = a.box('Alternate passage gate', (.14, .90, .52), (.10, -1.25, .73), orange, bevel=.025)
    a.box('Bypass gate crosshead', (.18, 1.06, .10), (.10, -1.25, 2.14), steel, bevel=.02)
    # Static edge stripes make the alternate path readable at phone size.
    for y in [.24, 1.16]:
        a.box('Incoming guide stripe', (3.15, .045, .006), (-2.3, y, .429), steel, bevel=.002)
        a.box('Outgoing guide stripe', (3.2, .045, .006), (3.02, y, .429), steel, bevel=.002)
    for x in [-1.16, 1.36]:
        a.box('Outer bypass guide stripe', (.045, 1.9, .006), (x, -.30, .429), steel, bevel=.002)
    a.box('Lower bypass guide stripe', (2.48, .045, .006), (.10, -1.71, .429), steel, bevel=.002)
    tokens = []
    for i in range(4):
        root = a.empty('Packet %d' % i)
        a.cylinder('Packet metal rim %d' % i, (0, 0, .50), .27, .12, steel, parent=root)
        a.cylinder('Packet ceramic face %d' % i, (0, 0, .58), .23, .10, token_mat, parent=root)
        tokens.append(root)
    a.fit_camera(camera, [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.name != 'Seamless stage'],
                 safe=(.08, .15 if config['width'] >= config['height'] else .20, .92, .76))
    def update(phase, frame):
        s = state(phase)
        gate.location.z = .73 + .82 * s['gate']
        a.key(gate, frame, 'location')
        for token, position in zip(tokens, s['positions']):
            token.location = (*position, 0)
            a.key(token, frame, 'location')
    return update
