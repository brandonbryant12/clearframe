"""An invented manifold: one control junction belongs to a connected system."""
import json
import math
import bpy
from mathutils import Vector
import artkit as a
import camera_rig as rig


def build(config):
    c = config['colors']
    ceramic = a.material('Warm mineral housings', '#d6d1c8', roughness=.62, coat=.08)
    blue = a.material('Enamel connections', '#396c8d', metallic=.25, roughness=.31)
    metal = a.material('Graphite fittings', '#303940', metallic=.64, roughness=.3)
    amber = a.material('Control wheel enamel', '#d07b39', roughness=.35, coat=.2)
    pale = a.material('Pale inspection inlay', '#c8dfe4', roughness=.42)
    camera = a.studio(config, target=(0, 0, .7), scale=12)
    camera.data.type = 'PERSP'
    camera.data.lens = 50
    a.box('Manifold foundation', (9.4, 5.6, .24), (0, .1, .16), ceramic, bevel=.16)
    for i, x in enumerate([-2.8, 0, 2.8]):
        a.box('Module housing %d' % i, (1.45, 1.55, 1.4), (x, 1.05, 1.01), ceramic, bevel=.12)
        a.box('Module top plate %d' % i, (1.22, 1.3, .08), (x, 1.05, 1.75), metal, bevel=.035)
        for z in [.7, .95, 1.2]:
            a.box('Unlettered module slot', (.8, .025, .05), (x, .264, z), metal, bevel=.015)
        a.curve('Branch pipe %d' % i, [(0, -.40, .59), (x, -.40, .59), (x, .20, .59), (x, .20, 1.4)], .115, blue)
        a.cylinder('Branch union %d' % i, (x, .20, .80), .18, .16, metal)
        a.cylinder('Outlet cap %d' % i, (x, .20, 1.48), .22, .08, pale)
    a.curve('Incoming supply', [(0, -2.45, .59), (0, -.40, .59)], .16, blue)
    hero = []
    hero.append(a.cylinder('Junction body', (0, -1.45, .72), .34, .42, metal))
    hero.append(a.cylinder('Connected control stem', (0, -1.45, 1.06), .09, .30, metal))
    hero.append(a.ring('Amber control rim', .58, .065, amber, location=(0, -1.45, 1.24)))
    hero.append(a.cylinder('Control hub', (0, -1.45, 1.24), .16, .13, amber))
    for angle in [0, math.pi/2]:
        spoke = a.box('Control wheel spoke', (1.06, .095, .10), (0, -1.45, 1.24), amber, bevel=.025)
        spoke.rotation_euler.z = angle
        hero.append(spoke)
    safe = (.08, .17, .92, .68 if config['width'] >= config['height'] else .66)
    hero_target = Vector((0, -1.45, 1.02))
    camera.location = hero_target+Vector((5, -9, 7))
    opening = rig.fit_perspective(camera, hero, hero_target, safe)
    camera.data.dof.focus_distance = (camera.location-hero_target).length
    start = rig.camera_pose(camera, hero_target)
    target = Vector((0, .05, .8))
    camera.location = target+Vector((8, -14, 11))
    subjects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'Seamless stage']
    ending = rig.fit_perspective(camera, subjects, target, safe)
    camera.data.dof.focus_distance = (camera.location-target).length
    end = rig.camera_pose(camera, target)
    camera['clearframe_camera_review'] = json.dumps({'kind': 'detail-to-system', 'opening': opening, 'ending': ending,
        'heroNames': [o.name for o in hero], 'systemNames': [o.name for o in subjects],
        'intent': 'Opening deliberately crops the wider system; the final hold retains all mesh bounds.'})
    return rig.bind(camera, rig.make_path(start, end))
