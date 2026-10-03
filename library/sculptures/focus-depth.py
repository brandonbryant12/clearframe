"""A fixed camera shifts focus between a foreground surface and a deeper structure."""
import json
import bpy
from mathutils import Vector
import artkit as a
import camera_rig as rig


def build(config):
    ceramic = a.material('Porcelain supports', '#d7d8d2', roughness=.6, coat=.08)
    metal = a.material('Graphite details', '#303a43', metallic=.25, roughness=.4)
    amber = a.material('Near amber surface', '#bd763c', roughness=.4, coat=.16)
    blue = a.material('Far blue structure', '#4b809a', roughness=.36, coat=.2)
    camera = a.studio(config, target=(0, .05, .65), scale=6)
    camera.data.type = 'PERSP'
    camera.data.lens = 65
    a.box('Focus-study foundation', (2.15, 2.35, .12), (0, .08, .06), ceramic, bevel=.06)
    near, far = [], []
    for label, x, y in [('Near', -.43, -.55), ('Far', .40, .75)]:
        a.box(label+' pedestal', (.75, .55, .16), (x, y, .20), ceramic, bevel=.04)
    near.append(a.box('Near surface panel', (.58, .15, .82), (-.43, -.55, .70), amber, bevel=.06))
    for i in range(7):
        near.append(a.box('Near engraved bar %d' % i, (.43, .018, .018), (-.43, -.636, .40+i*.095), metal, bevel=.003))
    far.append(a.box('Far frame top', (.7, .18, .07), (.40, .75, 1.13), metal, bevel=.015))
    far.append(a.box('Far frame bottom', (.7, .18, .07), (.40, .75, .29), metal, bevel=.015))
    for i in range(7):
        far.append(a.box('Far structure rib %d' % i, (.045, .15, .74), (.12+i*.095, .75, .71), blue, bevel=.009))
    target = Vector((0, .05, .68))
    camera.location = target+Vector((.5, -7.0, 3.0))
    subjects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'Seamless stage']
    safe = (.08, .17, .92, .68 if config['width'] >= config['height'] else .66)
    framing = rig.fit_perspective(camera, subjects, target, safe)
    camera.data.dof.aperture_fstop = .10
    forward = (target-camera.location).normalized()
    points = {'near': Vector((-.43, -.63, .71)), 'far': Vector((.40, .75, .71))}
    depths = {name: (point-camera.location).dot(forward) for name, point in points.items()}
    camera.data.dof.focus_distance = depths['near']
    start = rig.camera_pose(camera, target)
    camera.data.dof.focus_distance = depths['far']
    end = rig.camera_pose(camera, target)
    camera['clearframe_camera_review'] = json.dumps({'kind': 'rack-focus', 'opening': framing, 'ending': framing,
        'heroNames': [o.name for o in near], 'systemNames': [o.name for o in subjects],
        'focusPlanes': {name: {'point': list(points[name]), 'depth': depths[name], 'subjectNames': [o.name for o in objects]}
                        for name, objects in [('near', near), ('far', far)]},
        'intent': 'Optical attention only; every claim and qualification stays crisp in native type.'})
    return rig.bind(camera, rig.make_path(start, end, dof=True))
