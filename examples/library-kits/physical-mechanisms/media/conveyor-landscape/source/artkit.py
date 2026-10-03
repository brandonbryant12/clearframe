"""Original scene helpers. Blender is an optional, offline asset renderer."""
import math
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view


def linear_rgba(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in values) + (1,)


def material(name, color, metallic=0.0, roughness=0.3, coat=0.25, opacity=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = linear_rgba(color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = linear_rgba(color)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = 0.22
    if opacity != 1.0:
        if not 0 < opacity < 1:
            raise ValueError('Panel opacity must be greater than zero and at most one.')
        # Stylized clear panels, not refractive optical glass. Alpha blending
        # keeps a view of the authored levels without a fluid/raytrace pass.
        bsdf.inputs['Alpha'].default_value = opacity
        mat.surface_render_method = 'BLENDED'
    return mat


def assign(obj, mat):
    obj.data.materials.append(mat)
    return obj


def empty(name, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return obj


def box(name, dimensions, location, mat, bevel=0.06, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft machined edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    if parent:
        obj.parent = parent
    return assign(obj, mat)


def sphere(name, location, radius, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    if parent:
        obj.parent = parent
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return assign(obj, mat)


def cylinder(name, location, radius, depth, mat, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    mod = obj.modifiers.new('Rounded rim', 'BEVEL')
    mod.width = min(0.06, depth * 0.2)
    mod.segments = 3
    obj.modifiers.new('Weighted rim normals', 'WEIGHTED_NORMAL')
    if parent:
        obj.parent = parent
    return assign(obj, mat)


def curve(name, points, radius, mat, closed=False, parent=None):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 1
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    spline.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return assign(obj, mat)


def ring(name, radius, tube, mat, location=(0, 0, 0), rotation=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=12, location=location,
                                   major_radius=radius, minor_radius=tube)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rotation
    if parent:
        obj.parent = parent
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return assign(obj, mat)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def fit_camera(camera, objects, safe=(.08, .15, .92, .76)):
    """Opt-in orthographic framing; reserve native copy above/below the subject.

    safe = left, bottom, right, top in normalized camera coordinates. Supply
    geometry enclosing every animated extent, then verify every baked frame.
    This fits a fixed camera; it does not retime or invent a camera move.
    """
    import json
    if camera.data.type != 'ORTHO' or len(safe) != 4 or not (0 <= safe[0] < safe[2] <= 1 and 0 <= safe[1] < safe[3] <= 1):
        raise ValueError('Framing requires an orthographic camera and a valid safe rectangle.')
    objects = list(objects)
    if not objects:
        raise ValueError('Framing requires subject geometry.')
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    def bounds():
        projected = [world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner)) for obj in objects for corner in obj.bound_box]
        return (min(p.x for p in projected), min(p.y for p in projected), max(p.x for p in projected), max(p.y for p in projected))
    before = bounds()
    camera.data.ortho_scale *= max((before[2] - before[0]) / (safe[2] - safe[0]), (before[3] - before[1]) / (safe[3] - safe[1])) * 1.01
    bpy.context.view_layer.update()
    after_scale = bounds()
    aspect = (scene.render.resolution_x * scene.render.pixel_aspect_x) / (scene.render.resolution_y * scene.render.pixel_aspect_y)
    width = camera.data.ortho_scale * min(1, aspect)
    height = camera.data.ortho_scale / max(1, aspect)
    dx = ((after_scale[0] + after_scale[2]) - (safe[0] + safe[2])) * .5 * width
    dy = ((after_scale[1] + after_scale[3]) - (safe[1] + safe[3])) * .5 * height
    camera.location += camera.rotation_euler.to_matrix() @ Vector((dx, dy, 0))
    bpy.context.view_layer.update()
    result = bounds()
    if result[0] < safe[0] - 1e-5 or result[1] < safe[1] - 1e-5 or result[2] > safe[2] + 1e-5 or result[3] > safe[3] + 1e-5:
        raise ValueError('Camera fit did not preserve the requested safe rectangle.')
    camera['clearframe_framing'] = json.dumps({'version': 1, 'safe': safe, 'initialSubjectBounds': result, 'subjectNames': [obj.name for obj in objects]})
    return result


def light(name, location, target, energy, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)
    return obj


def studio(config, target=(0, 0, 1.7), scale=9.4, dark=False):
    scene = bpy.context.scene
    colors = config['colors']
    ground = material('Palette background', colors['bg'], roughness=0.48, coat=0.08)
    box('Seamless stage', (200, 200, 0.12), (0, 0, -0.13), ground, bevel=0)
    world = bpy.data.worlds.new('Soft studio environment')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = linear_rgba(colors['bg'])
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.35 if dark else 0.55
    light('Large key', (2.2, -5.0, 8.0), target, 1400, 5.0)
    light('Soft fill', (-5.0, -1.0, 4.5), target, 1000 if dark else 700, 4.0, (0.72, 0.85, 1.0))
    light('Rim strip', (3.5, 4.0, 6.0), target, 1900 if dark else 1100, 3.5, (1.0, 0.84, 0.63))
    data = bpy.data.cameras.new('Camera')
    camera = bpy.data.objects.new('Camera', data)
    bpy.context.collection.objects.link(camera)
    camera.location = (8.0, -12.0, 8.5)
    aim(camera, target)
    data.type = 'ORTHO'
    # AUTO sensor fit uses the long axis for the orthographic scale. A portrait
    # needs more vertical world extent to retain its object's horizontal span.
    data.ortho_scale = scale if config['width'] >= config['height'] else scale * 0.8 * config['height'] / config['width']
    data.lens = 50
    scene.camera = camera
    return camera


def key(obj, frame, *paths):
    for path in paths:
        obj.keyframe_insert(data_path=path, frame=frame)


def smooth_open(phase):
    """A periodic closed → reveal → held open → close cycle."""
    value = 0.5 - 0.5 * math.cos(phase * math.tau)
    value = min(1.0, max(0.0, (value - 0.08) / 0.84))
    return value * value * (3 - 2 * value)
