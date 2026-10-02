"""Original machined assembly; no simulation cache or external models."""
import math
import random
import artkit as a


def build(config):
    c = config['colors']
    rng = random.Random(config['seed'])
    shell = a.material('Dark ceramic alloy', c['surface'], metallic=0.6, roughness=0.26)
    edge = a.material('Anodized edge', c['accent'], metallic=0.55, roughness=0.2)
    coremat = a.material('Circuit cartridge', c['accent2'], metallic=0.45, roughness=0.25)
    white = a.material('Pearl connector', c['ink'], metallic=0.45, roughness=0.28)
    a.studio(config, target=(0, 0, 2.25), scale=10.1, dark=True)
    a.cylinder('Circular stage', (0, 0, 0.1), 2.0, 0.2, shell)
    a.ring('Stage indicator', 1.88, 0.024, edge, location=(0, 0, 0.22))
    root = a.empty('Assembly root', (0, 0, 2.2))
    base_angle = 0.16 + rng.uniform(-0.10, 0.10)
    root.rotation_euler.z = base_angle
    core = a.box('Central keyed cartridge', (0.6, 0.62, 1.22), (0, 0, 0), coremat, bevel=0.07, parent=root)
    for i in range(7):
        a.box(f'Cooling lamella {i}', (1.14, 1.1, 0.07), (0, 0, (i - 3) * 0.17), edge, bevel=0.025, parent=root)
    for sign in (-1, 1):
        a.box(f'Cartridge cap {sign}', (0.98, 0.96, 0.16), (0, 0, sign * 0.72), white, bevel=0.035, parent=root)
        # A projecting key aligns each cap with its opposing panel socket.
        a.box(f'Index tab {sign}', (0.28, 0.3, 0.27), (0.25, 0, sign * 0.9), coremat, bevel=0.025, parent=root)
    panels = []
    for axis in range(3):
        for sign in (-1, 1):
            direction = [0, 0, 0]
            direction[axis] = sign
            dimensions = [1.95, 1.95, 1.95]
            dimensions[axis] = 0.13
            obj = a.box(f'Panel {axis} {sign}', dimensions, [v * 1.07 for v in direction], shell, bevel=0.055, parent=root)
            # Small inlaid squares read as fabrication, never as labels or data.
            for k in (-1, 1):
                pos = [v * 1.155 for v in direction]
                pos[(axis + 1) % 3] = k * 0.67
                dims = [0.19, 0.19, 0.19]
                dims[axis] = 0.018
                inset = a.box(f'Inlay {axis} {sign} {k}', dims, pos, edge, bevel=0.012, parent=root)
                panels.append((inset, direction, list(inset.location)))
            panels.append((obj, direction, list(obj.location)))
            # Paired raised rails form a readable socket around the axial key.
            for side in (-1, 1):
                dims = [0.38, 0.38, 0.38]
                dims[axis] = 0.065
                dims[(axis + 1) % 3] = 0.065
                pos = [v * 0.985 for v in direction]
                pos[(axis + 1) % 3] = side * 0.22
                socket = a.box(f'Socket rail {axis} {sign} {side}', dims, pos, white, bevel=0.012, parent=root)
                panels.append((socket, direction, list(socket.location)))
            a.curve(f'Core connector {axis} {sign}', [(v * 0.68 for v in direction), (v * 1.03 for v in direction)], 0.035, white, parent=root)

    def update(phase, frame):
        opened = a.smooth_open(phase)
        for obj, direction, base in panels:
            axis = next(i for i, v in enumerate(direction) if v)
            delayed = max(0.0, min(1.0, (opened - axis * 0.1) / (1 - axis * 0.1)))
            obj.location = [base[i] + direction[i] * delayed * 0.82 for i in range(3)]
            a.key(obj, frame, 'location')
        root.rotation_euler.z = base_angle + math.sin(phase * math.tau) * 0.06
        a.key(root, frame, 'rotation_euler')
    return update
