# Mosaic demo: a lighthouse laid in tesserae, square frame. Generates storyboard.json.
import json, math, os

IVORY, GOLD, CORAL, TURQ = 'ink', 'accent', 'accent2', 'positive'

def wave(y, amp=10, phase=0.0, x0=190, x1=890, step=20):
    pts = [(x, y + amp * math.sin((x - x0) / 55 + phase)) for x in range(x0, x1 + 1, step)]
    return 'M ' + ' L '.join(f'{x:.0f} {yy:.0f}' for x, yy in pts)

arch = 'M 180 952 L 180 430 A 360 360 0 0 1 900 430 L 900 952 Z'
scene = [
    # The niche, the sea and the moon assemble tile by tile.
    {'type': 'path', 'd': arch, 'fill': {'gradient': ['#4a6fd0', '#f2c27a', '#e98a5a']}, 'stroke': IVORY,
     'mosaic': {'tile': 16, 'axis': 90, 'glint': 0.12, 'flow': 'contour', 'recolor': [{'say': 'tiles', 'dur': 2.0, 'axis': 90, 'fill': {'gradient': ['#101a78', '#2233a8']}}]}, 'enter': 'assemble', 'at': 0.3, 'dur': 1.8},
    {'type': 'rect', 'x': 160, 'y': 952, 'w': 760, 'h': 42, 'fill': {'gradient': ['#cfd3dc', '#6b7280']}, 'mosaic': {'tile': 12, 'outline': False, 'axis': 90}, 'enter': 'assemble', 'at': 0.2, 'dur': 1.0},
    *[{'type': 'rect', 'x': x, 'y': y, 'w': 9, 'h': 9, 'fill': GOLD, 'enter': 'pop', 'at': 1.4 + i * 0.07,
       'glow': {'blur': 6}, 'loop': {'type': 'blink', 'period': 2.6 + i % 3 * 0.7}}
      for i, (x, y) in enumerate([(260, 520), (330, 430), (410, 360), (820, 520), (300, 640), (760, 610), (450, 250), (620, 210)])],
    {'type': 'circle', 'cx': 350, 'cy': 330, 'r': 78, 'fill': GOLD, 'mosaic': {'tile': 12, 'flow': 'rings', 'glint': 0.4, 'build': 'fly', 'from': [540, 480], 'spread': 160},
     'enter': 'assemble', 'say': 'tiles', 'dur': 1.4, 'glow': {'blur': 22, 'opacity': 0.7}},
    {'type': 'rect', 'x': 180, 'y': 760, 'w': 720, 'h': 192, 'fill': {'gradient': ['#3cc0b4', '#1c5a8c']},
     'mosaic': {'tile': 14, 'axis': 90, 'outline': False, 'glint': 0.6}, 'enter': 'assemble', 'at': 0.8, 'dur': 1.6},
    *[{'type': 'path', 'd': wave(800 + 50 * i, phase=i), 'stroke': IVORY, 'mosaic': {'tile': 7},
       'say': 'square', 'dur': 1.0, 'loop': {'type': 'float', 'period': 3 + i, 'amount': 5}} for i in range(3)],
    # The lighthouse: an ivory tower with coral bands, a gold lamp and a coral cap.
    {'type': 'poly', 'points': [[478, 790], [502, 520], [578, 520], [602, 790]], 'closed': True, 'fill': IVORY,
     'mosaic': {'tile': 11, 'flow': 'contour'}, 'enter': 'assemble', 'at': 0.3, 'dur': 1.4},
    *[{'type': 'poly', 'points': [[488 + d, y0], [492 + d * 0.9, y0 - 40], [588 - d * 0.9, y0 - 40], [592 - d, y0]], 'closed': True,
       'fill': CORAL, 'mosaic': {'tile': 7, 'outline': False}, 'enter': 'assemble', 'say': 'small', 'dur': 0.9}
      for d, y0 in ((4, 700), (14, 610))],
    {'type': 'rect', 'x': 498, 'y': 470, 'w': 84, 'h': 50, 'fill': GOLD, 'mosaic': {'tile': 7, 'outline': False},
     'enter': 'assemble', 'at': 0.0, 'dur': 0.9, 'glow': {'blur': 16}},
    {'type': 'poly', 'points': [[488, 472], [540, 430], [592, 472]], 'closed': True, 'fill': CORAL,
     'mosaic': {'tile': 7}, 'enter': 'assemble', 'say': 'time', 'dur': 0.8},
    # A beaded double border frames the whole panel.
    {'type': 'rect', 'x': 60, 'y': 60, 'w': 960, 'h': 960, 'fill': 'none', 'stroke': GOLD, 'mosaic': {'tile': 10}, 'at': 0, 'dur': 1.6, 'enter': 'draw'},
    {'type': 'rect', 'x': 84, 'y': 84, 'w': 912, 'h': 912, 'fill': 'none', 'stroke': IVORY, 'mosaic': {'tile': 8}, 'at': 0.3, 'dur': 1.6, 'enter': 'draw'},
]
light = [
    {'type': 'poly', 'points': [[545, 492], [880, 415], [880, 565]], 'closed': True,
     'fill': {'gradient': ['#fff1c2', '#fff1c2'], 'angle': 0, 'fade': True}, 'stroke': 'none', 'opacity': 0.55, 'blend': 'screen',
     'enter': 'wipe', 'say': 'Light', 'dur': 0.8,
     'origin': [545, 492], 'loop': {'type': 'sway', 'period': 5, 'amount': 6}, 'glow': {'blur': 18, 'opacity': 0.6}},
]
bob = {'loop': {'type': 'float', 'period': 3, 'amount': 4}}
boat_hull = {'type': 'poly', 'points': [[250, 850], [370, 850], [345, 885], [275, 885]], 'closed': True, 'fill': CORAL,
             'mosaic': {'tile': 8}, **bob}
boat_sail = {'type': 'poly', 'points': [[312, 845], [312, 760], [360, 845]], 'closed': True, 'fill': IVORY, 'mosaic': {'tile': 8}, **bob}
move = [
    {**boat_hull, 'enter': 'assemble', 'at': 0.1, 'dur': 0.8, 'exitSay': 'apart', 'exit': 'scatter', 'exitDur': 1.1},
    {**boat_sail, 'enter': 'assemble', 'at': 0.2, 'dur': 0.8, 'exitSay': 'apart', 'exit': 'scatter', 'exitDur': 1.1},
    {**boat_hull, 'enter': 'assemble', 'say': 'together', 'dur': 1.1},
    {**boat_sail, 'enter': 'assemble', 'say': 'together', 'dur': 1.1},
]
end = [
    {'type': 'rect', 'x': 290, 'y': 818, 'w': 500, 'h': 110, 'fill': '#0b1030', 'stroke': GOLD, 'mosaic': {'tile': 10},
     'enter': 'assemble', 'say': 'Every', 'dur': 0.9},
    {'type': 'text', 'text': 'Laid in code.', 'x': 540, 'y': 898, 'size': 76, 'font': 'serif', 'fill': GOLD,
     'anchor': 'middle', 'say': 'code', 'glow': {'blur': 8, 'opacity': 0.5}},
]

def world(id, vo, view, elements, **extra):
    return {'id': id, 'block': 'canvas', 'vo': vo, 'props': {'world': 'bay', 'view': view, 'elements': elements}, **extra}

beats = [
    world('tiles', 'Every picture in this film is laid in tiles, one small square at a time.', [0, 0, 1080, 1080], scene, lead=0.6),
    world('light', 'Light is just a few tiles that glow.', [240, 220, 680, 680], light, tail=0.4),
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
