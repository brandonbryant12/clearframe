import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { BlockProps } from './types.mjs';

import { type BeatContext } from './job-types.mjs';

import { normalizeProps } from './catalog.mjs';

import { cueResolver } from './job-cues.mjs';

import type { BeatBasics } from './job-beat-contracts.mjs';

import { expandBeatProps } from './job-beat-expand.mjs';
import { beatMoments } from './job-beat-moments.mjs';
import { beatReveal } from './job-beat-reveal.mjs';
export function prepareBeatProps(
  b: TimingBeat,
  ctx: BeatContext,
  basics: BeatBasics,
): BlockProps {
  const { sb, timing, film, report } = ctx;
  const { frame } = basics;
  const authoredProps = expandBeatProps(b, ctx, basics);
  const props = normalizeProps(b.block ?? '', authoredProps, {
    vertical: film.vertical,
    width: timing.width,
    height: timing.height,
    assets: sb.assets,
    // A captioned beat keeps its drawing out of the caption band where it can.
    captions: Boolean(film.captions && b.vo),
    // Spoken cues resolve before a system diagram compiles, so its derived timing is exact.
    resolve: cueResolver(b, frame),
  });
  beatMoments(b, props, report, basics);
  delete props.moments;
  beatReveal(b, props, timing, basics);
  return props;
}
