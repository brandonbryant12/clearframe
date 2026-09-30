# Mosaic demo: a lighthouse laid in tesserae, square frame. Generates storyboard.json.
import json, math, os

IVORY, GOLD, CORAL, TURQ = 'ink', 'accent', 'accent2', 'positive'

def wave(y, amp=10, phase=0.0, x0=190, x1=890, step=20):
    pts = [(x, y + amp * math.sin((x - x0) / 55 + phase)) for x in range(x0, x1 + 1, step)]
    return 'M ' + ' L '.join(f'{x:.0f} {yy:.0f}' for x, yy in pts)

arch = 'M 180 980 L 180 430 A 360 360 0 0 1 900 430 L 900 980 Z'
scene = [
    # The niche, the sea and the moon assemble tile by tile.
    {'type': 'path', 'd': arch, 'fill': {'gradient': ['#2b3fa0', '#16225e']}, 'stroke': IVORY,
     'mosaic': {'tile': 18, 'axis': 90, 'glint': 0.15}, 'enter': 'assemble', 'at': 0.1, 'dur': 1.8},
    *[{'type': 'rect', 'x': x, 'y': y, 'w': 9, 'h': 9, 'fill': GOLD, 'enter': 'pop', 'at': 1.4 + i * 0.07,
       'glow': {'blur': 6}, 'loop': {'type': 'blink', 'period': 2.6 + i % 3 * 0.7}}
      for i, (x, y) in enumerate([(260, 520), (330, 430), (410, 360), (820, 520), (300, 640), (760, 610), (450, 250), (620, 210)])],
    {'type': 'circle', 'cx': 710, 'cy': 380, 'r': 78, 'fill': GOLD, 'mosaic': {'tile': 12, 'flow': 'rings', 'glint': 0.4},
     'enter': 'assemble', 'say': 'tiles', 'dur': 1.4, 'glow': {'blur': 22, 'opacity': 0.7}},
    {'type': 'rect', 'x': 180, 'y': 760, 'w': 720, 'h': 220, 'fill': {'gradient': ['#3cc0b4', '#1c5a8c']},
     'mosaic': {'tile': 16, 'axis': 90, 'outline': False, 'glint': 0.7}, 'enter': 'assemble', 'at': 0.8, 'dur': 1.6},
    *[{'type': 'path', 'd': wave(800 + 50 * i, phase=i), 'stroke': IVORY, 'mosaic': {'tile': 7},
       'say': 'square', 'dur': 1.0, 'loop': {'type': 'float', 'period': 3 + i, 'amount': 5}} for i in range(3)],
    # The lighthouse: an ivory tower with coral bands, a gold lamp and a coral cap.
    {'type': 'poly', 'points': [[478, 790], [502, 520], [578, 520], [602, 790]], 'closed': True, 'fill': IVORY,
     'mosaic': {'tile': 14}, 'enter': 'assemble', 'say': 'one', 'dur': 1.3},
    *[{'type': 'poly', 'points': [[488 + d, y0], [492 + d * 0.9, y0 - 40], [588 - d * 0.9, y0 - 40], [592 - d, y0]], 'closed': True,
       'fill': CORAL, 'mosaic': {'tile': 12, 'outline': False}, 'enter': 'assemble', 'say': 'small', 'dur': 0.9}
      for d, y0 in ((4, 700), (14, 610))],
    {'type': 'rect', 'x': 498, 'y': 470, 'w': 84, 'h': 50, 'fill': GOLD, 'mosaic': {'tile': 9, 'outline': False},
     'enter': 'assemble', 'say': 'time', 'dur': 0.8, 'glow': {'blur': 16}},
    {'type': 'poly', 'points': [[488, 472], [540, 430], [592, 472]], 'closed': True, 'fill': CORAL,
     'mosaic': {'tile': 12}, 'enter': 'assemble', 'say': 'time', 'dur': 0.8},
    # A beaded double border frames the whole panel.
    {'type': 'rect', 'x': 60, 'y': 60, 'w': 960, 'h': 960, 'fill': 'none', 'stroke': GOLD, 'mosaic': {'tile': 10}, 'at': 0, 'dur': 1.6, 'enter': 'draw'},
    {'type': 'rect', 'x': 84, 'y': 84, 'w': 912, 'h': 912, 'fill': 'none', 'stroke': IVORY, 'mosaic': {'tile': 8}, 'at': 0.3, 'dur': 1.6, 'enter': 'draw'},
]
light = [
    {'type': 'poly', 'points': [[545, 492], [900, 400], [900, 580]], 'closed': True, 'fill': '#ffe7a3', 'opacity': 0.5,
     'mosaic': {'tile': 12, 'outline': False, 'build': 'radial', 'grout': 'none'}, 'enter': 'assemble', 'say': 'Light', 'dur': 1.0,
     'origin': [545, 492], 'loop': {'type': 'sway', 'period': 5, 'amount': 6}, 'glow': {'blur': 18, 'opacity': 0.6}},
]
boat_hull = {'type': 'poly', 'points': [[250, 850], [370, 850], [345, 885], [275, 885]], 'closed': True, 'fill': CORAL,
             'mosaic': {'tile': 10}}
boat_sail = {'type': 'poly', 'points': [[312, 845], [312, 760], [360, 845]], 'closed': True, 'fill': IVORY, 'mosaic': {'tile': 10}}
move = [
    {**boat_hull, 'enter': 'assemble', 'at': 0.1, 'dur': 0.8, 'exitSay': 'apart', 'exit': 'scatter', 'exitDur': 1.1},
    {**boat_sail, 'enter': 'assemble', 'at': 0.2, 'dur': 0.8, 'exitSay': 'apart', 'exit': 'scatter', 'exitDur': 1.1},
    {**boat_hull, 'points': [[640, 850], [760, 850], [735, 885], [665, 885]], 'enter': 'assemble', 'say': 'together', 'dur': 1.1},
    {**boat_sail, 'points': [[702, 845], [702, 760], [750, 845]], 'enter': 'assemble', 'say': 'together', 'dur': 1.1},
]
end = [
    {'type': 'rect', 'x': 330, 'y': 918, 'w': 420, 'h': 74, 'r': 10, 'fill': 'bg', 'opacity': 0.8, 'say': 'Every'},
    {'type': 'text', 'text': 'Laid in code.', 'x': 540, 'y': 970, 'size': 54, 'font': 'serif-italic', 'fill': GOLD,
     'anchor': 'middle', 'say': 'code', 'glow': {'blur': 10, 'opacity': 0.6}},
]

def world(id, vo, view, elements, **extra):
    return {'id': id, 'block': 'canvas', 'vo': vo, 'props': {'world': 'bay', 'view': view, 'elements': elements}, **extra}

beats = [
    world('tiles', 'Every picture in this film is laid in tiles, one small square at a time.', [0, 0, 1080, 1080], scene, lead=0.6),
    world('light', 'Light is just a few tiles that glow.', [300, 240, 600, 600], light, tail=0.4),
    world('move', 'And because each tile is placed in code, any shape can come apart, and come back together.', [0, 0, 1080, 1080], move, tail=0.9),
    world('end', 'Every tile, laid in code.', [-40, -40, 1160, 1160], end, tail=1.2),
]
sb = {
    'version': 2, 'title': 'Laid in code', 'format': {'preset': 'square', 'fps': 30},
    'theme': 'mosaic', 'backdrop': 'mosaic', 'texture': {'grain': 0.12, 'vignette': 0.55},
    'motion': {'preset': 'gentle', 'intensity': 0.6}, 'transition': 'cut', 'captions': False, 'music': False, 'sfx': 'subtle',
    'voice': {'takes': 'chapter', 'style': 'warm storyteller, unhurried'},
    'beats': beats,
}
here = os.path.dirname(os.path.abspath(__file__))
json.dump(sb, open(os.path.join(here, 'storyboard.json'), 'w'), indent=2)
print(len(beats), 'beats')
