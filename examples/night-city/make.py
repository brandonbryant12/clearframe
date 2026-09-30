# Heat v3: one night city, explored by a travelling camera. Generates storyboard.json.
import json, os

SRC = {1: 'Synthetic Climate Lab (test) [1]', 2: 'Synthetic Materials Review (test) [2]',
       3: 'City Health Dept. (synthetic) [3]', 4: 'Cooling Interventions Meta-analysis (synthetic) [4]',
       5: 'Heat Plan Survey 2025 (synthetic) [5]'}
COOL = '#8ecae6'
HORIZON = 760

def text(t, x, y, size, **kw):
    return {'type': 'text', 'text': t, 'x': x, 'y': y, 'size': size, **kw}

def world(id, vo, view, elements, **extra):
    props = {'world': 'city', 'view': view, 'elements': elements}
    for k in ('source',):
        if k in extra: props[k] = extra.pop(k)
    return {'id': id, 'block': 'canvas', 'vo': vo, 'props': props, **extra}

# ── A: the horizon at dusk ─────────────────────────────────────────────────────────────
buildings = [(1040, 90, 180), (1135, 75, 180), (1215, 110, 200), (1400, 85, 300),
             (1490, 110, 220), (1605, 70, 160), (1680, 120, 260), (1805, 95, 190)]
ROOF = (1680, 1800, HORIZON - 260)  # the building the film keeps returning to
windows = []
for bi, (x, w, h) in enumerate(buildings):
    for r in range(2, h // 34):
        for c in range(1, w // 26):
            if (bi * 7 + r * 3 + c * 5) % 4 == 0:
                windows.append({'type': 'rect', 'x': x + c * 26 - 5, 'y': HORIZON - h + r * 34 - 18, 'w': 10, 'h': 14,
                                'fill': 'accent', 'opacity': 0.85,
                                'loop': {'type': 'pulse', 'period': 2.4 + (bi + r + c) % 5 * 0.4, 'amount': 0.25}})

def thermometer(x, color, levels):
    # levels: [(at, scaleY, dur)]; the mercury rests at full height, keyed down.
    keys = [{'at': a, 'scaleY': v, 'dur': d, 'ease': 'inOut'} for a, v, d in levels]
    return [
        {'type': 'rect', 'x': x - 15, 'y': 250, 'w': 30, 'h': 460, 'r': 15, 'fill': 'bg', 'stroke': 'muted', 'width': 3, 'enter': 'none', 'at': 0},
        {'type': 'rect', 'x': x - 7, 'y': 280, 'w': 14, 'h': 420, 'r': 7, 'fill': color, 'origin': [x, 700], 'enter': 'none', 'at': 0, 'keys': keys},
        {'type': 'circle', 'cx': x, 'cy': 718, 'r': 26, 'fill': color, 'enter': 'none', 'at': 0},
    ]

COUNTRY_X, CITY_X = 560, 1362
country_top = 700 - 420 * 0.42
city_top = 700 - 420 * 0.74
hook = [
    {'type': 'ellipse', 'cx': 960, 'cy': HORIZON, 'rx': 1100, 'ry': 460,
     'fill': {'gradient': ['accent2', 'bg'], 'radial': True, 'fade': True}, 'opacity': 0.6, 'enter': 'none', 'at': 0,
     'keys': [{'at': 0.2, 'opacity': 0.1, 'dur': 2.2}]},
    {'type': 'circle', 'cx': 960, 'cy': 640, 'r': 64, 'fill': 'accent', 'enter': 'none', 'at': 0,
     'keys': [{'at': 0.05, 'y': 200, 'dur': 1.7, 'ease': 'in'}]},
    {'type': 'rect', 'x': -4000, 'y': HORIZON, 'w': 16000, 'h': 3000, 'fill': 'surface', 'enter': 'none', 'at': 0},
    {'type': 'line', 'x1': -4000, 'y1': HORIZON, 'x2': 12000, 'y2': HORIZON, 'stroke': 'line', 'width': 2, 'enter': 'none', 'at': 0},
    {'type': 'path', 'd': f'M 80 {HORIZON} Q 260 680 440 735 Q 640 670 900 {HORIZON} Z', 'fill': 'positive', 'opacity': 0.22, 'enter': 'none', 'at': 0},
    *[{'type': 'circle', 'cx': x, 'cy': HORIZON - 34, 'r': 20, 'fill': 'positive', 'opacity': 0.45, 'enter': 'none', 'at': 0} for x in (170, 250, 700, 790)],
    *[{'type': 'rect', 'x': x, 'y': HORIZON - h, 'w': w, 'h': h, 'fill': 'surface', 'stroke': 'line', 'width': 2, 'enter': 'none', 'at': 0} for x, w, h in buildings],
    {'type': 'group', 'at': 0.9, 'stagger': 0.02, 'children': windows},
    *thermometer(COUNTRY_X, COOL, [(0.3, 0.8, 1.2), (1.5, 0.42, 1.3)]),
    *thermometer(CITY_X, 'accent2', [(0.3, 0.8, 1.2), (1.5, 0.74, 1.3)]),
    text('COUNTRYSIDE', COUNTRY_X, 812, 24, font='mono', fill='muted', anchor='middle', enter='none', at=0),
    text('CITY', CITY_X, 812, 24, font='mono', fill='muted', anchor='middle', enter='none', at=0),
    {'type': 'line', 'x1': COUNTRY_X + 20, 'y1': country_top, 'x2': 960, 'y2': country_top, 'stroke': 'muted', 'width': 2, 'dash': [6, 8], 'say': 'Seven', 'dur': 0.4},
    {'type': 'line', 'x1': 960, 'y1': city_top, 'x2': CITY_X - 20, 'y2': city_top, 'stroke': 'muted', 'width': 2, 'dash': [6, 8], 'say': 'Seven', 'dur': 0.4},
    {'type': 'path', 'd': f'M 945 {city_top} L 960 {city_top} L 960 {country_top} L 945 {country_top}', 'stroke': 'accent2', 'width': 4, 'say': 'Seven', 'dur': 0.5},
    text('7°C', 990, (city_top + country_top) / 2 + 40, 120, font='bold', fill='accent2', say='Seven',
         count={'from': 0, 'to': 7, 'suffix': '°C', 'dur': 0.5}),
    text('warmer, at night', 994, (city_top + country_top) / 2 + 92, 34, fill='ink', say='night'),
]

# ── B: a day and a night, charted in the sky ───────────────────────────────────────────
X0, X1 = 220, 1660
def hx(h): return X0 + (h - 12) / 18 * (X1 - X0)
def ty(t): return -300 - (t - 20) * 24
city_t = {12: 33, 15: 34, 18: 32, 21: 30, 24: 29, 27: 28, 30: 27}
country_t = {12: 31, 15: 32, 18: 29, 21: 24.5, 24: 22, 27: 21, 30: 20}
def trace(temps, hours):
    pts = [(hx(h), ty(temps[h])) for h in hours]
    return 'M ' + ' L '.join(f'{x:.0f} {y:.0f}' for x, y in pts)
day_h, night_h = [12, 15, 18], [18, 21, 24, 27, 30]
gap_poly = [(hx(h), ty(city_t[h])) for h in night_h] + [(hx(h), ty(country_t[h])) for h in reversed(night_h)]
chart = [
    {'type': 'rect', 'x': -4000, 'y': -4000, 'w': 16000, 'h': 4000 + HORIZON, 'fill': {'gradient': ['#3d5a78', '#1c2530'], 'angle': 90}, 'behind': True, 'enter': 'none', 'at': 0, 'opacity': 0.95,
     'keys': [{'at': 0, 'opacity': 0, 'dur': 0}, {'say': 'day', 'opacity': 1, 'dur': 0.9}, {'say': 'sunset', 'opacity': 0, 'dur': 1.4}]},
    {'type': 'line', 'x1': X0, 'y1': -300, 'x2': X1, 'y2': -300, 'stroke': 'line', 'width': 2, 'at': 0.1},
    *[text(lbl, hx(h), -262, 22, font='mono', fill='muted', anchor='middle', at=0.2) for h, lbl in ((12, 'NOON'), (18, '6 PM'), (24, 'MIDNIGHT'), (30, '6 AM'))],
    {'type': 'circle', 'cx': hx(12), 'cy': ty(34) - 110, 'r': 26, 'fill': 'accent', 'say': 'day',
     'keys': [{'say': 'small', 'x': hx(17) - hx(12), 'y': 60, 'dur': 2.2, 'ease': 'inOut'}, {'say': 'sunset', 'y': 260, 'opacity': 0, 'dur': 0.9, 'ease': 'in'}]},
    {'type': 'path', 'd': trace(country_t, day_h), 'stroke': COOL, 'width': 5, 'say': 'day', 'dur': 1.4},
    {'type': 'path', 'd': trace(city_t, day_h), 'stroke': 'accent2', 'width': 5, 'say': 'day', 'dur': 1.4},
    text('1–3°C', hx(15), ty(34) - 28, 40, font='bold', fill='ink', anchor='middle', say='three'),
    {'type': 'path', 'd': f'M {hx(24) + 14} {ty(34) - 134} A 22 22 0 1 0 {hx(24) + 14} {ty(34) - 86} A 17 17 0 1 1 {hx(24) + 14} {ty(34) - 134} Z', 'fill': 'ink', 'stroke': 'none', 'say': 'sunset', 'enter': 'pop'},
    {'type': 'path', 'd': trace(country_t, night_h), 'stroke': COOL, 'width': 5, 'say': 'sunset', 'dur': 1.8},
    {'type': 'path', 'd': trace(city_t, night_h), 'stroke': 'accent2', 'width': 5, 'say': 'sunset', 'dur': 1.8},
    {'type': 'poly', 'points': [[round(x), round(y)] for x, y in gap_poly], 'closed': True, 'fill': 'accent2', 'opacity': 0.22, 'stroke': 'none', 'enter': 'wipe', 'say': 'reach', 'dur': 0.9},
    {'type': 'path', 'd': f'M {hx(27) - 12} {ty(28)} L {hx(27)} {ty(28)} L {hx(27)} {ty(21)} L {hx(27) - 12} {ty(21)}', 'stroke': 'ink', 'width': 3, 'say': 'seven', 'dur': 0.4},
    text('7°C', hx(27) + 20, (ty(28) + ty(21)) / 2 + 22, 64, font='bold', fill='ink', say='seven'),
    text('CITY', X1 + 16, ty(27) + 8, 22, font='mono', fill='accent2', say='sunset'),
    text('COUNTRYSIDE', X1 + 16, ty(20) + 8, 22, font='mono', fill=COOL, say='sunset'),
]

# ── A, zoomed: one roof through a day ──────────────────────────────────────────────────
rx0, rx1, rtop = ROOF
OFFSTAGE = 9  # scene seconds after the camera has left the roof: tidy it for the return
roof = [
    {'type': 'rect', 'x': -4000, 'y': -4000, 'w': 16000, 'h': 4000 + HORIZON, 'fill': {'gradient': ['#3d5a78', '#1c2530'], 'angle': 90}, 'behind': True, 'enter': 'none', 'at': 0, 'opacity': 0.9,
     'keys': [{'at': 0, 'opacity': 0, 'dur': 0}, {'at': 0.1, 'opacity': 1, 'dur': 0.8}, {'say': 'after dark', 'opacity': 0, 'dur': 1.0}]},
    {'type': 'rect', 'x': rx0, 'y': rtop, 'w': rx1 - rx0, 'h': 34, 'fill': '#262626', 'stroke': 'ink', 'width': 1.5, 'at': 0.1},
    text('ROOF · ASPHALT', rx1 + 10, rtop + 21, 11, font='mono', fill='muted', at=0.2, exitAt=OFFSTAGE, exit='fade'),
    {'type': 'rect', 'x': rx0 + 2, 'y': rtop + 2, 'w': rx1 - rx0 - 4, 'h': 30, 'fill': 'accent2', 'origin': [rx0, rtop + 32], 'enter': 'none', 'at': 0,
     'keys': [{'at': 0, 'scaleY': 0.02, 'dur': 0}, {'say': 'soak', 'scaleY': 0.95, 'dur': 1.6}, {'say': 'back', 'scaleY': 0.35, 'dur': 0.9}]},
    {'type': 'circle', 'cx': rx0 - 150, 'cy': rtop - 90, 'r': 18, 'fill': 'accent', 'say': 'sunlight', 'exitSay': 'then', 'exit': 'fall'},
    {'type': 'group', 'say': 'sunlight', 'stagger': 0.1, 'exitSay': 'then', 'exit': 'fade',
     'children': [{'type': 'path', 'd': f'M {rx0 - 95 + 30 * i} {rtop - 90} L {rx0 + 14 + 28 * i} {rtop - 1}', 'stroke': 'accent', 'width': 3, 'arrow': 'end', 'head': 9, 'dur': 0.6} for i in range(4)]},
    {'type': 'path', 'd': f'M {rx0 - 8} {rtop + 16} L {rx0 - 36} {rtop + 16}', 'stroke': 'accent2', 'width': 1.5, 'say': 'almost', 'exitAt': OFFSTAGE, 'exit': 'fade'},
    text('95% absorbed', rx0 - 40, rtop + 21, 14, font='bold', fill='accent2', anchor='end', say='almost', exitAt=OFFSTAGE, exit='fade'),
    {'type': 'path', 'd': f'M {rx1 + 60} {rtop - 110} A 16 16 0 1 0 {rx1 + 60} {rtop - 76} A 12 12 0 1 1 {rx1 + 60} {rtop - 110} Z', 'fill': 'ink', 'stroke': 'none', 'say': 'after dark', 'enter': 'pop'},
    {'type': 'ellipse', 'cx': (rx0 + rx1) / 2, 'cy': rtop - 20, 'rx': 80, 'ry': 46, 'fill': {'gradient': ['accent2', 'bg'], 'radial': True, 'fade': True}, 'opacity': 0.55, 'say': 'back', 'exitAt': OFFSTAGE, 'exit': 'fade'},
    *[{'type': 'path', 'd': f'M {rx0 + 25 + 30 * i} {rtop - 4} C {rx0 + 15 + 30 * i} {rtop - 30} {rx0 + 35 + 30 * i} {rtop - 50} {rx0 + 25 + 30 * i} {rtop - 76}',
       'stroke': 'accent2', 'width': 2, 'dash': [5, 5], 'loop': {'type': 'dash', 'period': 0.8}, 'say': 'back', 'dur': 0.6, 'exitAt': OFFSTAGE, 'exit': 'fade'} for i in range(3)],
]

# ── C: the same streets from above ─────────────────────────────────────────────────────
MX, MY, SX, SY = 500, 1350, 200, 150
cols, rows = 6, 5
blocks = [{'type': 'rect', 'x': MX + SX * i + 10, 'y': MY + SY * j + 10, 'w': SX - 20, 'h': SY - 20, 'r': 6, 'fill': '#1f1f1f'}
          for i in range(cols - 1) for j in range(rows - 1)]
streets = [{'type': 'line', 'x1': MX, 'y1': MY + SY * j, 'x2': MX + SX * (cols - 1), 'y2': MY + SY * j, 'stroke': 'line', 'width': 6} for j in range(rows)] + \
          [{'type': 'line', 'x1': MX + SX * i, 'y1': MY, 'x2': MX + SX * i, 'y2': MY + SY * (rows - 1), 'stroke': 'line', 'width': 6} for i in range(cols)]
def seg(i0, j0, i1, j1): return (MX + SX * i0, MY + SY * j0, MX + SX * i1, MY + SY * j1)
hot = [seg(0, 1, 1, 1), seg(1, 1, 1, 2), seg(1, 2, 2, 2), seg(2, 2, 2, 3), seg(4, 0, 5, 0), seg(3, 3, 3, 4)]  # 6 of 49 ≈ 12%
dots_hot = [(MX + SX * 0.5, MY + SY), (MX + SX, MY + SY * 1.5), (MX + SX * 1.5, MY + SY * 2), (MX + SX * 2, MY + SY * 2.6)]
dots_other = [(MX + SX * 3.5, MY + SY * 1), (MX + SX * 4, MY + SY * 2.4), (MX + SX * 0.6, MY + SY * 4), (MX + SX * 5, MY + SY * 3.3),
              (MX + SX * 2.5, MY), (MX + SX * 4.4, MY + SY * 4)]
hotspots = [
    {'type': 'group', 'at': 0.2, 'stagger': 0.01, 'children': blocks},
    {'type': 'group', 'at': 0.3, 'stagger': 0.03, 'children': streets},
    {'type': 'group', 'say': 'twelve', 'stagger': 0.08, 'children': [
        {'type': 'line', 'x1': a, 'y1': b, 'x2': c, 'y2': d, 'stroke': 'accent2', 'width': 14, 'loop': {'type': 'pulse', 'period': 1.6, 'amount': 0.2}} for a, b, c, d in hot]},
    text('12% of streets', 1620, 1530, 52, font='bold', fill='accent2', say='twelve'),
    {'type': 'group', 'say': 'forty', 'stagger': 0.09, 'children': [
        {'type': 'circle', 'cx': x, 'cy': y, 'r': 13, 'fill': 'ink', 'stroke': 'bg', 'width': 3, 'enter': 'drop'} for x, y in dots_hot + dots_other]},
    {'type': 'circle', 'cx': 1636, 'cy': 1630, 'r': 13, 'fill': 'ink', 'say': 'forty'},
    text('40% of heat emergencies', 1662, 1642, 40, font='bold', fill='ink', say='forty'),
    text('4 of these 10 are on the hot 12%', 1620, 1700, 26, fill='muted', say='forty'),
]

# ── A, zoomed again: what cools the block ──────────────────────────────────────────────
tree_x = [1450, 1510, 1570, 1630]
OFFSTAGE_W = 14
works = [
    {'type': 'rect', 'x': rx0 + 2, 'y': rtop + 2, 'w': rx1 - rx0 - 4, 'h': 30, 'fill': COOL, 'opacity': 0.9, 'enter': 'wipe', 'say': 'cut', 'dur': 0.8},
    text('COOL ROOF', rx1 + 10, rtop + 21, 11, font='mono', fill=COOL, say='cut', exitAt=OFFSTAGE_W, exit='fade'),
    {'type': 'rect', 'x': rx0 - 2, 'y': rtop - 5, 'w': rx1 - rx0 + 4, 'h': 7, 'fill': 'ink', 'enter': 'wipe', 'say': 'Cool roofs', 'dur': 0.6},
    {'type': 'path', 'd': f'M {rx0 + 20} {rtop - 90} L {rx0 + 52} {rtop - 7}', 'stroke': 'accent', 'width': 3, 'arrow': 'end', 'head': 9, 'say': 'cut', 'dur': 0.4},
    {'type': 'path', 'd': f'M {rx0 + 64} {rtop - 7} L {rx0 + 96} {rtop - 90}', 'stroke': COOL, 'width': 3, 'arrow': 'end', 'head': 9, 'say': 'rooftop', 'dur': 0.4},
    text('20–30°C cooler roof', (rx0 + rx1) / 2, rtop - 104, 16, font='bold', fill=COOL, anchor='middle', say='thirty', exitAt=OFFSTAGE_W, exit='fade'),
    *[{'type': 'rect', 'x': x - 3, 'y': HORIZON - 34, 'w': 6, 'h': 34, 'fill': 'muted', 'say': 'Trees'} for x in tree_x],
    *[{'type': 'circle', 'cx': x, 'cy': HORIZON - 40, 'r': 15, 'fill': 'positive', 'opacity': 0.85, 'say': 'Trees', 'origin': [x, HORIZON - 40],
       'keys': [{'say': 'continuous', 'scale': 2.1, 'dur': 0.9, 'ease': 'spring'}]} for x in tree_x],
    {'type': 'rect', 'x': 1470, 'y': HORIZON - 116, 'w': 140, 'h': 28, 'r': 6, 'fill': 'bg', 'opacity': 0.85, 'say': 'canopy', 'exitAt': OFFSTAGE_W, 'exit': 'fade'},
    text('1–2°C cooler air', 1540, HORIZON - 96, 16, font='bold', fill='positive', anchor='middle', say='canopy', exitAt=OFFSTAGE_W, exit='fade'),
]

# ── D: a hundred cities ────────────────────────────────────────────────────────────────
GX, GY = 2500, 1400
def tiny(x, y):
    return f'M {x} {y + 40} L {x} {y + 22} L {x + 14} {y + 22} L {x + 14} {y + 8} L {x + 30} {y + 8} L {x + 30} {y + 26} L {x + 44} {y + 26} L {x + 44} {y + 14} L {x + 58} {y + 14} L {x + 58} {y + 40} Z'
cities = [(GX + (k % 10) * 78, GY + (k // 10) * 56) for k in range(100)]
lit = sorted({(k * 37 + 11) % 100 for k in range(18)})  # 18 scattered
gap = [
    {'type': 'group', 'at': 0.1, 'stagger': 0.006, 'children': [{'type': 'path', 'd': tiny(x, y), 'fill': 'surface', 'stroke': 'line', 'width': 1.5, 'enter': 'fade'} for x, y in cities]},
    {'type': 'group', 'say': 'eighteen', 'stagger': 0.03, 'children': [{'type': 'path', 'd': tiny(*cities[k]), 'fill': 'accent', 'stroke': 'none', 'enter': 'pop'} for k in lit]},
    text('18', 3380, 1670, 180, font='bold', fill='accent', say='only', count={'from': 0, 'to': 18, 'dur': 0.8}),
    text('of 100 cities surveyed', 3380, 1730, 36, fill='ink', say='hundred'),
    text('have a heat plan', 3380, 1776, 36, fill='muted', say='plan'),
]

# ── A, whole: the callback ─────────────────────────────────────────────────────────────
end = [
    {'type': 'ellipse', 'cx': 1128, 'cy': (city_top + country_top) / 2 + 36, 'rx': 190, 'ry': 104, 'fill': 'none', 'stroke': 'accent2', 'width': 4, 'say': 'Seven', 'dur': 0.8, 'rough': {'amount': 3}},
    text('Start with the hottest blocks.', 960, 170, 72, font='bold', fill='ink', anchor='middle', say='Start'),
    {'type': 'group', 'say': 'hottest', 'stagger': 0.12, 'children': [
        {'type': 'ellipse', 'cx': x + w / 2, 'cy': HORIZON - h, 'rx': w * 0.9, 'ry': 36, 'fill': {'gradient': ['accent2', 'bg'], 'radial': True, 'fade': True}, 'opacity': 0.8,
         'loop': {'type': 'pulse', 'period': 1.8, 'amount': 0.08}} for x, w, h in (buildings[3], buildings[6], buildings[1])]},
]

beats = [
    world('hook', 'Seven degrees. That\'s how much hotter a city night can run.', [0, 0, 1920, 1080], hook,
          source=SRC[1], lead=2.3, tail=0.5, style='intrigued, leaning in'),
    world('belief', 'It\'s only a few degrees, right?', [620, 190, 960, 540],
          [text('“Only a few degrees, right?”', 650, 330, 44, font='serif-italic', fill='ink', width=270, say='only', exitAt=4, exit='fade')],
          style='light, a little skeptical'),
    world('day-night', 'By day, the gap is small, one to three degrees. But after sunset, it can reach seven.', [0, -900, 1920, 1080], chart,
          source=f'{SRC[1]} · {SRC[2]}', style='brisk, clear'),
    world('mechanism', 'Asphalt and dark roofs soak up almost all of the sunlight, then give it back after dark.', [1420, 330, 640, 360], roof,
          source=SRC[2], style='brisk, clear', tail=0.9),
    {'id': 'turn', 'block': 'kinetic', 'transition': 'iris', 'tone': 'accent2', 'style': 'slower, lower',
     'vo': 'But the heat is not shared evenly.', 'tail': 1.0, 'props': {'mode': 'stack', 'emphasis': ['not', 'evenly'], 'emphasisStyle': 'serif', 'maxWords': 7, 'align': 'center'}},
    world('hotspots', 'In one district, twelve percent of streets produced forty percent of heat emergencies.', [250, 1110, 1920, 1080], hotspots,
          source=SRC[3], style='measured, serious', transition='iris', tail=0.6),
    world('works', 'Cool roofs cut rooftop heat by twenty to thirty degrees. Trees help too, but only as a continuous canopy.', [1405, 360, 720, 405], works,
          source=SRC[4], style='brighter, practical', tail=1.3),
    world('gap', 'Yet only eighteen of a hundred cities surveyed have a heat plan.', [2380, 1150, 1920, 1080], gap,
          source=SRC[5], style='slower, pointed', lead=0.9, tail=0.7),
    world('end', 'Seven degrees, every night. Start with the hottest blocks.', [-60, -34, 2040, 1148], end,
          style='warm, emphatic', tail=1.2),
]
sb = {
    'version': 2, 'title': 'Why city nights stay hot', 'format': {'preset': 'landscape', 'fps': 30},
    'theme': 'noir', 'backdrop': 'none', 'texture': {'grain': 0.35, 'vignette': 0.5},
    'motion': {'preset': 'spring', 'intensity': 0.6}, 'transition': 'cut', 'captions': False, 'music': False, 'sfx': 'subtle',
    'voice': {'takes': 'chapter', 'style': 'warm, curious, quietly concerned'},
    'sources': [{'id': str(k), 'title': v.rsplit(' [', 1)[0]} for k, v in SRC.items()],
    'beats': beats,
}
here = os.path.dirname(os.path.abspath(__file__))  
json.dump(sb, open(os.path.join(here, 'storyboard.json'), 'w'), indent=2, ensure_ascii=False)
print(len(beats), 'beats')
