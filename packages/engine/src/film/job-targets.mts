import type { Timing } from '../engine/domain.mjs';
import type {
  JobReport,
  JobBeat,
  ElementKey,
  CanvasElement,
} from './types.mjs';

import { messageOf } from './guards.mjs';

import { isTarget, targetSpec, targetRect } from './target.mjs';

/**
 * Fold where an element's keys leave it (moved, scaled, turned, faded) into its state, so a morph
 * starts there. False, leaving the state as it was, when they do what a state cannot hold (blur,
 * tilt, a stretch in one direction) or the element's position is not a field (a path).
 */
export function movedBy(state: CanvasElement, keys: ElementKey[]): boolean {
  const timing = new Set([
    'at',
    'say',
    'after',
    'dur',
    'ease',
    'hold',
    'sound',
  ]);
  const held = new Set([
    'x',
    'y',
    'scale',
    'scaleX',
    'scaleY',
    'rotate',
    'opacity',
  ]);
  if (
    keys.some((k) => Object.keys(k).some((f) => !timing.has(f) && !held.has(f)))
  )
    return false;
  const end: ElementKey = {};
  for (const key of keys)
    for (const field of [
      'x',
      'y',
      'scale',
      'scaleX',
      'scaleY',
      'rotate',
      'opacity',
    ] as const) {
      if (key[field] != null) end[field] = key[field];
    }
  const {
    x: dx = 0,
    y: dy = 0,
    scaleX = end.scale ?? 1,
    scaleY = end.scale ?? 1,
    rotate = 0,
    opacity = 1,
  } = end;
  if (Math.abs(scaleX - scaleY) > 1e-6) return false;
  const positions = {
    group: [['x'], ['y']],
    rect: [['x'], ['y']],
    text: [['x'], ['y']],
    icon: [['x'], ['y']],
    image: [['x'], ['y']],
    circle: [['cx'], ['cy']],
    ellipse: [['cx'], ['cy']],
    line: [
      ['x1', 'x2'],
      ['y1', 'y2'],
    ],
  } as const;
  const fields = Object.entries(positions).find(
    ([type]) => type === state.type,
  )?.[1];
  if (!fields && (dx || dy)) return false;
  for (const f of fields?.[0] ?? []) state[f] = (state[f] ?? 0) + dx;
  for (const f of fields?.[1] ?? []) state[f] = (state[f] ?? 0) + dy;
  if (scaleX !== 1) state.scale = (state.scale ?? 1) * scaleX;
  if (rotate) state.rotate = (state.rotate ?? 0) + rotate;
  if (opacity !== 1) state.opacity = (state.opacity ?? 1) * opacity;
  return true;
}

/**
 * Camera rects addressed to what is drawn (`{on, pad, state}` in view, viewFrom or a beat's
 * camera.to) become exact rects from the elements' own geometry. A world beat can frame what an
 * earlier beat of its world drew; a beat camera (frame pixels) needs a canvas without a view.
 */
export function resolveTargets(
  beats: JobBeat[],
  timing: Timing,
  { errors }: JobReport,
) {
  const frame = { width: timing.width, height: timing.height };
  beats.forEach((b, i) => {
    if (b.block !== 'canvas') return;
    try {
      const seen = [...(b.props.elements ?? [])];
      if (b.props.world)
        for (
          let k = i - 1;
          k >= 0 && beats[k].props?.world === b.props.world;
          k--
        )
          seen.push(...(beats[k].props.elements ?? []));
      for (const key of ['view', 'viewFrom', 'viewTall'] as const)
        if (isTarget(b.props[key]))
          b.props[key] = targetRect(
            { ...targetSpec(b.props[key], key), world: b.props.world },
            seen,
            { ...frame, where: key },
          );
      if (isTarget(b.camera?.to)) {
        // camera.to is in frame pixels: the canvas's own coordinates must be frame pixels too.
        const v = b.props.view,
          identity =
            v == null ||
            (Array.isArray(v) &&
              v.length === 4 &&
              v[0] === 0 &&
              v[1] === 0 &&
              v[2] === frame.width &&
              v[3] === frame.height &&
              !b.props.world);
        if (!identity)
          throw new Error(
            'camera.to {on} frames frame pixels; this canvas has its own view, so frame it with view: {on} or reveal instead',
          );
        b.camera.to = targetRect(targetSpec(b.camera.to, 'camera.to'), seen, {
          ...frame,
          where: 'camera.to',
        });
      }
    } catch (e) {
      errors.push(`${b.id}: ${messageOf(e)}`);
    }
  });
}
