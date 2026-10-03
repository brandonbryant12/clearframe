"""A single ceramic marker becomes one member of an illustrative field."""
import json
import bpy
from mathutils import Vector
import artkit as a
import camera_rig as rig


def build(config):
    ceramic = a.material('Cool chalk markers', '#dbe0df', roughness=.58, coat=.1)
    blue = a.material('Blue rim enamel', '#4f8296', roughness=.35, coat=.28)
    amber = a.material('Selected marker enamel', '#bd763c', roughness=.32, coat=.3)
    metal = a.material('Gunmetal marker bases', '#424e56', metallic=.55, roughness=.4)
    camera = a.studio(config, target=(0, 0, .8), scale=14)
    camera.data.type = 'PERSP'
    camera.data.lens = 52
    a.box('Illustrative field foundation', (10.5, 7.3, .22), (0, 0, .14), ceramic, bevel=.18)
    hero, markers = [], []
    for row, y in enumerate([-2.15, 0, 2.15]):
        for col, x in enumerate([-4.0, -2.0, 0, 2.0, 4.0]):
            selected = row == 0 and col == 2
            parts = [a.cylinder('Marker base %d %d' % (row, col), (x, y, .36), .52, .18, metal),
                     a.box('Marker body %d %d' % (row, col), (.65, .65, .93), (x, y, .88), amber if selected else ceramic, bevel=.18),
                     a.cylinder('Marker crown %d %d' % (row, col), (x, y, 1.37), .37, .10, amber if selected else blue)]
            markers.extend(parts)
            if selected:
                hero.extend(parts)
    safe = (.08, .17, .92, .68 if config['width'] >= config['height'] else .66)
    target = Vector((0, -2.15, .9))
    camera.location = target+Vector((2.0, -9.0, 5.5))
    opening = rig.fit_perspective(camera, hero, target, safe)
    camera.data.dof.focus_distance = (camera.location-target).length
    camera.data.dof.aperture_fstop = 8.0
    start = rig.camera_pose(camera, target)
    target = Vector((0, 0, .65))
    camera.location = target+Vector((5.0, -17.0, 11.0))
    subjects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'Seamless stage']
    ending = rig.fit_perspective(camera, subjects, target, safe)
    camera.data.dof.focus_distance = (camera.location-target).length
    camera.data.dof.aperture_fstop = 8.0
    end = rig.camera_pose(camera, target)
    camera['clearframe_camera_review'] = json.dumps({'kind': 'hero-to-field', 'opening': opening, 'ending': ending,
        'heroNames': [o.name for o in hero], 'systemNames': [o.name for o in subjects], 'illustrativeMembers': 15,
        'intent': 'A decorative field, never a population count or measured share; all markers exist throughout.'})
    return rig.bind(camera, rig.make_path(start, end))
