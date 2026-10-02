"""Three original answer tiles; one rises once, then holds its selection."""
import math
import artkit as a


def build(config):
    c = config['colors']
    ceramic = a.material('Answer porcelain', c['surface'], roughness=0.3, coat=0.3)
    trim = a.material('Glazed tile edges', c['accent2'], metallic=0.25, roughness=0.3)
    base = a.material('Quiet answer desk', c['bg'], roughness=0.65, coat=0)
    foot = a.material('Recess lining', c['muted'], roughness=0.6, coat=0)
    camera = a.studio(config, target=(0, 0, 0.8), scale=9.2)
    camera.location = (5.0, -11.0, 8.6)
    a.aim(camera, (0, 0, 0.7))
    a.box('Single answer desk', (6.4, 3.05, 0.2), (0, 0, 0.11), base, bevel=0.16)
    tiles = []
    for index in range(3):
        x = (index - 1) * 1.85
        a.box(f'Recess {index + 1}', (1.51, 2.37, 0.06), (x, 0, 0.24), foot, bevel=0.1)
        root = a.empty(f'Answer tile {index + 1}', (x, 0, 0.33))
        a.box(f'Glazed edge {index + 1}', (1.4, 2.24, 0.16), (0, 0, 0), trim, bevel=0.08, parent=root)
        a.box(f'Blank answer face {index + 1}', (1.34, 2.18, 0.09), (0, 0, 0.085), ceramic, bevel=0.07, parent=root)
        # All three faces are identical before the reveal. Selection cannot leak
        # from a colour, label, badge or dimension in the question poster.
        tiles.append(root)
    selected = config['seed'] % 3

    def update(phase, frame):
        t = min(1.0, max(0.0, (phase - 0.06) / 0.40))
        reveal = t * t * (3 - 2 * t)
        tile = tiles[selected]
        tile.location.z = 0.33 + 1.05 * reveal
        tile.rotation_euler.x = math.radians(12) * reveal
        a.key(tile, frame, 'location', 'rotation_euler')
    return update
