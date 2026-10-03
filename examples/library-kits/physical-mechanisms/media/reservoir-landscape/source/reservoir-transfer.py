"""Original staged reservoir; analytic level planes, no fluid simulation or data."""


def ease(phase, start, end):
    t = min(1.0, max(0.0, (phase - start) / (end - start)))
    return t * t * (3 - 2 * t)


def state(phase):
    gate = ease(phase, .12, .25) * (1 - ease(phase, .68, .78))
    transfer = ease(phase, .28, .65)
    # Equal floor areas: total authored volume stays constant. These are
    # geometric consistency units, not money, measured liquid or a forecast.
    return {'gate': gate, 'transfer': transfer,
            'left': 1.36 - .54 * transfer, 'right': .28 + .54 * transfer}


def build(config):
    import artkit as a
    import bpy
    c = config['colors']
    shell = a.material('Porcelain reservoir base', '#dddde1', roughness=.55, coat=.08)
    metal = a.material('Graphite reservoir frame', c['ink'], metallic=.5, roughness=.3)
    amber = a.material('Amber isolating gate', c['accent2'], roughness=.28, coat=.25)
    glass = a.material('Clear illustrative chamber panels', '#b3d7e6', roughness=.3, coat=.3, opacity=.12)
    fluid = a.material('Blue analytic fill volumes', '#447eb4', roughness=.27, coat=.32)
    rim = a.material('Blue level edges', '#7bbed2', metallic=.15, roughness=.28)
    target = (0, 0, 2.4) if config['width'] >= config['height'] else (0, 0, 1.7)
    camera = a.studio(config, target=target, scale=14.7 if config['width'] >= config['height'] else 10.2)
    camera.location = (7.5, -12, 8.0)
    a.aim(camera, target)
    a.box('Reservoir foundation', (6.5, 3.0, .25), (0, 0, .16), shell, bevel=.10)
    # Two equal interiors: x length 2.6, y depth 2.0, floor z=.34.
    for x in [-1.40, 1.40]:
        a.box('Chamber floor', (2.7, 2.18, .12), (x, 0, .30), metal, bevel=.035)
        for y in [-1.06, 1.06]:
            a.box('Transparent front or back', (2.72, .075, 1.85), (x, y, 1.255), glass, bevel=.018)
            for z in [.39, 2.18]:
                a.box('Panel horizontal trim', (2.80, .09, .065), (x, y, z), metal, bevel=.015)
        outer_x = x + (-1.36 if x < 0 else 1.36)
        a.box('Transparent outer end', (.075, 2.16, 1.85), (outer_x, 0, 1.255), glass, bevel=.018)
        for y in [-1.06, 1.06]:
            a.box('Corner upright', (.075, .075, 1.85), (outer_x, y, 1.255), metal, bevel=.015)
    # Thin central sluice separates adjoining fill volumes; it is fully raised
    # before any level changes, and closes only after the levels equalize.
    for y in [-1.07, 1.07]:
        a.box('Gate guide', (.28, .18, 4.0), (0, y, 2.34), metal, bevel=.025)
    a.box('Gate yoke', (.30, 2.34, .16), (0, 0, 4.36), metal, bevel=.025)
    gate = a.box('Isolation gate', (.15, 2.04, 1.72), (0, 0, 1.20), amber, bevel=.015)
    spindle = a.cylinder('Connected gate stem', (0, 0, 3.21), .055, 2.30, metal)
    a.box('Fixed handwheel grip', (.75, .10, .10), (0, 0, 4.53), metal, bevel=.03)
    fills = []
    levels = []
    for label, x in [('Left', -1.40), ('Right', 1.40)]:
        fills.append(a.box(label + ' fill', (2.60, 2.00, 1), (x, 0, .84), fluid, bevel=0))
        # Horizontal level edge is a thin trim, not a separately scaled volume.
        levels.append(a.box(label + ' level edge', (2.60, .025, .018), (x, -1.002, 1), rim, bevel=0))
    # A level connection spans the central gate gap after opening. Its height
    # interpolates between the two levels; ends remain inside the fill solids.
    # Six narrow analytic strips avoid a floating stream or disappearing mass.
    bridge = [a.box('Channel fill strip %02d' % i, (.2 / 6, 2.0, 1), (-.1 + (i + .5) * .2 / 6, 0, .84), fluid, bevel=0) for i in range(6)]
    a.fit_camera(camera, [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.name != 'Seamless stage'],
                 safe=(.08, .15 if config['width'] >= config['height'] else .20, .92, .76))

    def update(phase, frame):
        s = state(phase)
        lift = 1.85 * s['gate']
        gate.location.z = 1.20 + lift
        # Stem lower end follows the gate; its top remains at the fixed yoke.
        spindle.location.z = 3.21 + lift * .5
        spindle.scale.z = (2.30 - lift) / 2.30
        a.key(gate, frame, 'location')
        a.key(spindle, frame, 'location', 'scale')
        for i, height in enumerate([s['left'], s['right']]):
            fills[i].scale.z = height
            fills[i].location.z = .34 + height / 2
            levels[i].location.z = .34 + height
            a.key(fills[i], frame, 'location', 'scale')
            a.key(levels[i], frame, 'location')
        for i, strip in enumerate(bridge):
            height = s['left'] + (s['right'] - s['left']) * (i + .5) / 6
            strip.scale.z = height
            strip.location.z = .34 + height / 2
            a.key(strip, frame, 'location', 'scale')
    return update
