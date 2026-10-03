"""An original keyed bridge insert descends into a real gap, then stays seated."""
import math
import artkit as a


def build(config):
    c = config['colors']
    shell = a.material('Ceramic sentence segments', c['surface'], roughness=0.35, coat=0.22)
    insert = a.material('Contrasting missing piece', c['accent'], metallic=0.22, roughness=0.27, coat=0.3)
    metal = a.material('Precision guide rails', c['accent2'], metallic=0.7, roughness=0.25)
    base = a.material('Paper stone base', c['bg'], roughness=0.65, coat=0)
    camera = a.studio(config, target=(0, 0, 1.0), scale=8.8 if config['width'] >= config['height'] else 10.3)
    camera.location = (6.0, -12.0, 7.8)
    a.aim(camera, (0, 0, 1.0))
    a.box('Bridge display base', (6.4, 3.3, 0.2), (0, 0, 0.12), base, bevel=0.15)
    for side in [-1, 1]:
        a.box('Left sentence segment' if side < 0 else 'Right sentence segment',
              (1.8, 1.44, 0.44), (side * 1.57, 0, 0.62), shell, bevel=0.08)
        a.box(f'Segment foot {side}', (1.46, 1.2, 0.18), (side * 1.57, 0, 0.31), metal, bevel=0.035)
    # The center slot is 1.34 wide; the insert is 1.28, with visible clearance.
    for y in [-0.52, 0.52]:
        a.box('Continuous keyed guide', (5.0, 0.1, 0.09), (0, y, 0.355), metal, bevel=0.02)
    root = a.empty('Missing bridge insert', (0, -1.05, 2.42))
    a.box('Missing piece', (1.28, 1.44, 0.44), (0, 0, 0), insert, bevel=0.07, parent=root)
    # Two shallow grooves in the visible top echo the rails without cutting text.
    for y in [-0.40, 0.40]:
        a.box('Inset glint', (0.96, 0.025, 0.012), (0, y, 0.222), metal, bevel=0.007, parent=root)

    def update(phase, frame):
        t = min(1.0, max(0.0, (phase - 0.06) / 0.42))
        reveal = t * t * (3 - 2 * t)
        root.location = (0, -1.05 * (1 - reveal), 0.62 + 1.8 * (1 - reveal))
        # Rotation stops before contact; the center stays inside the open slot.
        root.rotation_euler.z = -math.radians(10) * max(0.0, 1 - reveal * 2)
        a.key(root, frame, 'location', 'rotation_euler')
    return update
