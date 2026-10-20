import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { HelperFrame } from './types.mjs';
import { rules } from './registry.mjs';

import { type BeatContext } from './job-types.mjs';

import { resolveMoments } from './moments.mjs';

import { cueResolver, timeOf } from './job-cues.mjs';

export function beatBasics(b: TimingBeat, { sb, timing }: BeatContext) {
  if (b.scene)
    throw new Error(
      'JavaScript scenes are retired. Port this beat to a native block; no browser fallback runs.',
    );
  if (b.block === 'canvas' && b.props?.kpi != null)
    throw new Error(
      'canvas kpi was retired: its extruded 3D forms decorated figures rather than showing them (and a seesaw sank on the lighter side); use the kpis or stat block, or a canvas chart',
    );
  const frame = 1 / timing.fps,
    source = sb.beats[b.index],
    spec = rules(b.block ?? '');
  const helperFrame: HelperFrame = {
    width: timing.width,
    height: timing.height,
    beatId: b.id,
    duration: b.dur,
  };
  // Named moments resolve first, from the measured words, so every structured picture and element
  // that lands on one shares its exact time (film/moments.mjs).
  const spoken = cueResolver(b, frame);
  const moments =
    b.block === 'canvas' && b.props?.moments != null
      ? resolveMoments(b.props.moments, { word: (v) => spoken(v), dur: b.dur })
      : null;
  helperFrame.moments = moments;
  helperFrame.usedMoments = new Set();
  helperFrame.when = (item, fallback = 0, where = 'cue') =>
    timeOf(item, {
      moments,
      spoken,
      fallback,
      where,
      used: helperFrame.usedMoments,
    });
  return {
    frame,
    source,
    spec,
    moments,
    helperFrame: {
      ...helperFrame,
      when: helperFrame.when,
      usedMoments: helperFrame.usedMoments,
    },
  };
}
