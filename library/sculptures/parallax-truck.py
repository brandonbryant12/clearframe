"""Original foreground screens and a rear connection, revealed by a camera truck."""
import json
import bpy
from mathutils import Vector
import artkit as a
import camera_rig as rig


def build(config):
    portrait = config['height'] > config['width']
    half_span = 1.4 if portrait else 2.8
    screen_span = 1.1 if portrait else 2.2
    travel_half = 1.1 if portrait else 2.2
    porcelain = a.material('Warm sample base', '#d5d1c7', roughness=.62, coat=.05)
    screen = a.material('Graphite foreground screens', '#4b5760', metallic=.25, roughness=.48)
    blue = a.material('Blue rear route', '#487d97', roughness=.42, coat=.12)
    amber = a.material('Amber rear junction', '#cb793c', roughness=.42, coat=.12)
    camera = a.studio(config, target=(0, 0, 1.05), scale=12)
    camera.data.type = 'PERSP'
    camera.data.lens = 55
    a.box('Inspection bench', (4.2 if portrait else 7.2, 4.1, .25), (0, .1, .16), porcelain, bevel=.16)
    for x in [-screen_span, 0, screen_span]:
        a.box('Screen foot', (.9, .7, .18), (x, -1.05, .37), porcelain, bevel=.07)
        a.box('Foreground screen', (.44, .16, 2.3), (x, -1.05, 1.53), screen, bevel=.07)
        a.box('Screen edge inlay', (.055, .022, 1.65), (x-.18, -1.139, 1.40), porcelain, bevel=.008)
    for x in [-half_span, half_span]:
        a.cylinder('Rear route support', (x, .85, .7), .16, .85, screen)
        a.box('Rear route end', (.65, .52, .70), (x, .85, 1.18), blue, bevel=.09)
    a.curve('Continuous rear connection', [(-half_span, .85, 1.18), (-.55, .85, 1.18), (-.55, .85, 1.62), (.55, .85, 1.62), (.55, .85, 1.18), (half_span, .85, 1.18)], .12, blue)
    a.sphere('Rear amber junction', (0, .85, 1.62), .30, amber)
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'Seamless stage']
    safe = (.08, .18, .92, .67)
    target = Vector((0, 0, 1.05))
    camera.location = target + Vector((0, -14, 4.5))
    fit = rig.fit_perspective(camera, objects, target, safe)
    camera.location = target + (camera.location-target)*(1.45 if portrait else 1.35)
    camera.location.x -= travel_half
    target.x -= travel_half
    camera.data.dof.focus_distance = (camera.location-target).length
    path = rig.make_truck(rig.camera_pose(camera, target), [2*travel_half, 0, 0])
    camera['clearframe_camera_review'] = json.dumps({'kind': 'truck', 'safe': list(safe),
        'subjectNames': [o.name for o in bpy.context.scene.objects if o.type in ('MESH', 'CURVE') and o.name != 'Seamless stage'],
        'fit': fit, 'foregroundNames': [o.name for o in objects if o.name.startswith('Foreground screen')],
        'rearNames': ['Rear amber junction'],
        'intent': 'Camera and target translate equally; foreground parallax changes the visible rear connection.'})
    return rig.bind(camera, path)
