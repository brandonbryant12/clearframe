"""Original open ceramic assembly; the object stays still while the view changes."""
import json
import math
import bpy
from mathutils import Vector
import artkit as a
import camera_rig as rig


def build(config):
    ceramic = a.material('Warm porcelain frame', '#d5d1c7', roughness=.62, coat=.05)
    graphite = a.material('Graphite sockets', '#39444c', metallic=.35, roughness=.43)
    blue = a.material('Blue inspection channel', '#487d97', roughness=.42, coat=.12)
    amber = a.material('Amber central shaft', '#cb793c', roughness=.42, coat=.12)
    camera = a.studio(config, target=(0, 0, 1.15), scale=12)
    camera.data.type = 'PERSP'
    camera.data.lens = 50
    a.box('Rounded assembly plinth', (4.8, 4.0, .25), (0, 0, .16), ceramic, bevel=.15)
    for z in [.55, 1.35, 2.15]:
        a.box('Rear cross member', (3.5, .34, .25), (0, 1.1, z), ceramic, bevel=.07)
        for x in [-1.57, 1.57]:
            a.box('Open side rail', (.34, 2.5, .25), (x, 0, z), ceramic, bevel=.07)
        a.box('Rear inset strip', (2.8, .025, .07), (0, .916, z), graphite, bevel=.012)
    for x in [-1.57, 1.57]:
        a.box('Rear support', (.26, .26, 2.1), (x, 1.1, 1.40), graphite, bevel=.05)
    a.cylinder('Central exposed shaft', (0, 0, 1.3), .26, 2.0, amber)
    for z in [.65, 1.55, 2.25]:
        a.cylinder('Shaft collar', (0, 0, z), .36, .10, graphite)
    a.curve('Side inspection channel', [(0, 0, 1.1), (.85, 0, 1.1), (.85, .60, 1.1), (1.8, .60, 1.1)], .13, blue)
    a.box('Side channel outlet', (.42, .58, .58), (1.72, .60, 1.1), blue, bevel=.07)
    a.box('Outlet inset', (.015, .28, .25), (1.938, .60, 1.1), graphite, bevel=.03)
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'Seamless stage']
    safe = (.09, .18, .91, .67)
    target = Vector((0, 0, 1.15))
    camera.location = target + Vector((-7.5, -12.0, 8.0))
    fit = rig.fit_perspective(camera, objects, target, safe)
    camera.location = target + (camera.location-target)*1.20
    camera.data.dof.focus_distance = (camera.location-target).length
    pose = rig.camera_pose(camera, target)
    path = rig.make_orbit(pose, 68)
    camera['clearframe_camera_review'] = json.dumps({'kind': 'orbit', 'safe': list(safe),
        'subjectNames': [o.name for o in bpy.context.scene.objects if o.type in ('MESH', 'CURVE') and o.name != 'Seamless stage'],
        'fit': fit, 'intent': 'One bounded orbit exposes a side connection; geometry is static and qualitative.'})
    return rig.bind(camera, path)
