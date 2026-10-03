"""Bake original sculpture motion and render it in a clean background Blender."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

import bpy

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    config = json.loads(Path(args.config).read_text())
    output = Path(config['out'])
    scene_file = Path(config['sceneFile']).resolve()
    source_root = Path(config['sourceRoot']).resolve()
    if scene_file.parent != source_root or scene_file.suffix != '.py':
        raise ValueError('Scene must be a trusted built-in sculpture module.')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.render.resolution_x = config['width']
    scene.render.resolution_y = config['height']
    scene.render.resolution_percentage = 100
    scene.render.fps = config['fps']
    scene.frame_start = 1
    scene.frame_end = config['frames']
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = False
    scene.eevee.taa_render_samples = config['samples']
    scene.eevee.use_raytracing = False
    scene.eevee.use_fast_gi = True
    scene.eevee.fast_gi_quality = 0.5
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    if hasattr(scene.render, 'use_motion_blur'):
        scene.render.use_motion_blur = False
    started = time.perf_counter()
    spec = importlib.util.spec_from_file_location('clearframe_sculpture', scene_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    update = module.build(config)
    build_seconds = time.perf_counter() - started
    bake_started = time.perf_counter()
    # Bake actual transforms at every frame, plus the next loop endpoint. The
    # saved blend needs neither Python auto-execution nor a physics cache.
    for frame in range(1, config['frames'] + 2):
        scene.frame_set(frame)
        phase = config['motion']['poseSamples'][frame - 1] if config.get('motion') else (frame - 1) / config['frames']
        update(phase, frame)
    bake_seconds = time.perf_counter() - bake_started
    scene.frame_set(1)
    bpy.context.view_layer.update()
    first_matrices = {obj.name: obj.matrix_world.copy() for obj in scene.objects}
    scene.frame_set(config['frames'] + 1)
    bpy.context.view_layer.update()
    loop_error = max(abs(obj.matrix_world[r][c] - first_matrices[obj.name][r][c])
                     for obj in scene.objects for r in range(4) for c in range(4))
    if config.get('loop') and loop_error > 0.0001:
        raise ValueError(f'Loop transforms fail to close: max error {loop_error}')
    # Declared holds may not hide moving transforms, including camera/light
    # objects. This is bounded transform evidence, not a shading/pixel check.
    hold_errors = []
    for phase in config.get('motion', {}).get('phases', []):
        if phase['role'] != 'hold':
            continue
        scene.frame_set(phase['startFrame'] + 1)
        bpy.context.view_layer.update()
        baseline = {obj.name: obj.matrix_world.copy() for obj in scene.objects}
        error = 0.0
        for frame in range(phase['startFrame'] + 1, phase['endFrame'] + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            error = max(error, max(abs(obj.matrix_world[r][c] - baseline[obj.name][r][c])
                                  for obj in scene.objects for r in range(4) for c in range(4)))
        hold_errors.append({'id': phase['id'], 'frames': phase['endFrame'] - phase['startFrame'], 'maxTransformError': error})
        if error > 0.0001:
            raise ValueError(f'Declared hold {phase["id"]} has moving transforms: {error}')
    poster_frame = 1 + round((config['frames'] - 1) * config.get('pos', 0.5))
    scene.frame_set(poster_frame)
    scene.render.filepath = '//frames/frame-'
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'scene.blend'))
    metadata = {
        'version': 1, 'blenderVersion': bpy.app.version_string,
        'blenderBuildHash': bpy.app.build_hash.decode('utf8'),
        'engine': scene.render.engine, 'threads': scene.render.threads,
        'width': config['width'], 'height': config['height'], 'fps': config['fps'],
        'frames': config['frames'], 'samples': config['samples'],
        'colorManagement': {'view': scene.view_settings.view_transform, 'look': scene.view_settings.look},
        'bakedMotion': True, 'requiresAutoExec': False,
        'loopMaxTransformError': loop_error,
        'holdTransformChecks': hold_errors,
        'motionClock': config.get('motion', {}).get('clock'),
        'objects': len(scene.objects),
        'meshVertices': sum(len(obj.data.vertices) for obj in scene.objects if obj.type == 'MESH'),
        'buildSeconds': build_seconds, 'bakeSeconds': bake_seconds,
        'renderedFrames': [],
    }
    def save():
        (output / 'blender.json').write_text(json.dumps(metadata, indent=2) + '\n')
    save()
    frames = [poster_frame] if config['still'] else range(1, config['frames'] + 1)
    render_started = time.perf_counter()
    for frame in frames:
        scene.frame_set(frame)
        scene.render.filepath = str(output / 'frames' / f'frame-{frame:04d}.png')
        before = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        metadata['renderedFrames'].append({'frame': frame, 'seconds': time.perf_counter() - before})
        metadata['renderSeconds'] = time.perf_counter() - render_started
        save()
    metadata['posterFrame'] = poster_frame
    metadata['status'] = 'rendered'
    save()
    print('CLEARFRAME_BLENDER ' + json.dumps({'status': 'rendered', 'frames': len(metadata['renderedFrames']), 'seconds': metadata['renderSeconds']}), flush=True)


if __name__ == '__main__':
    main()
