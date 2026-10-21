import type {
  ResolvedStoryboard as Storyboard,
  TimedBeat as TimingBeat,
  Beat as StoryboardBeat,
} from '../engine/domain.mjs';
import type { BeatLayers } from './types.mjs';

import { CAMERA_MOVES } from './constants.mjs';

import { isTarget, targetSpec } from './target.mjs';

import { unit } from './job-lens.mjs';

export function layerCamera(
  source: StoryboardBeat,
  b: TimingBeat,
  sb: Storyboard,
  out: BeatLayers,
): void {
  // The film's camera is the default for beats without their own, resolved here so a beat
  // added after `new` still follows it. A system diagram is a reading frame: it holds still
  // unless someone asks for a move.
  if (
    sb.camera != null &&
    typeof sb.camera === 'object' &&
    sb.camera.to != null
  )
    throw new Error(
      'the film camera is a default move; push to a detail (camera.to) on a beat',
    );
  // Diagrams and casts lay themselves out for a still frame (their objects move instead).
  const authoredCamera =
    source.camera ??
    sb.camera ??
    (b.block === 'canvas' &&
    (source.props?.diagram != null || source.props?.cast != null)
      ? 'none'
      : null);
  if (authoredCamera != null) {
    const camera =
      typeof authoredCamera === 'string'
        ? { move: authoredCamera }
        : structuredClone(authoredCamera);
    if (
      !camera ||
      typeof camera !== 'object' ||
      Object.keys(camera).some(
        (k) => !['move', 'amount', 'to', 'at', 'say', 'dur'].includes(k),
      ) ||
      !CAMERA_MOVES.includes(camera.move ?? 'auto') ||
      (camera.amount != null && !unit(camera.amount))
    )
      throw new Error(
        `camera must be ${CAMERA_MOVES.join('|')}, {move, amount: 0–1} or {to: [x, y, w, h], say|at, dur}`,
      );
    checkCameraDetail(camera, b);
    out.camera = camera;
  }
}

function checkCameraDetail(
  camera: NonNullable<BeatLayers['camera']>,
  b: TimingBeat,
): void {
  // A push to a detail: the picture travels from the full frame into a frame-pixel rect.
  if (camera.to != null) {
    const r = camera.to;
    if (isTarget(r)) {
      if (b.block !== 'canvas')
        throw new Error(
          'camera.to {on} frames an element of a canvas; give a frame-pixel rect on other blocks',
        );
      targetSpec(r, 'camera.to');
    } else if (
      !(
        Array.isArray(r) &&
        r.length === 4 &&
        r.every(Number.isFinite) &&
        r[2] >= 64 &&
        r[3] >= 36
      )
    )
      throw new Error(
        'camera.to must be a frame-pixel rect [x, y, w, h] (at least 64 × 36), or {on: an element id} on a canvas',
      );
    if (
      camera.dur != null &&
      !(Number.isFinite(camera.dur) && camera.dur >= 0.2 && camera.dur <= 8)
    )
      throw new Error('camera.dur must be 0.2–8 seconds');
  }
}
