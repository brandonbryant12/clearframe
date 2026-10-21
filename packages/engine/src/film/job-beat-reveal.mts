import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { BlockProps } from './types.mjs';

import { type BeatContext } from './job-types.mjs';

import type { BeatBasics } from './job-beat-contracts.mjs';

export function beatReveal(
  b: TimingBeat,
  props: BlockProps,
  timing: BeatContext['timing'],
  { helperFrame }: BeatBasics,
): void {
  // reveal: open on the detail, hold, and pull back to the whole picture on its word.
  if (b.block === 'canvas' && props.reveal != null) {
    const r = props.reveal;
    props.viewFrom = {
      on: r.from,
      ...(r.pad != null ? { pad: r.pad } : {}),
      ...(r.state != null ? { state: r.state } : {}),
    };
    props.view ??= [0, 0, timing.width, timing.height];
    props.viewAt = helperFrame.when(r, 0.8, 'reveal');
    props.viewDur = r.dur ?? 1.6;
    if (props.viewAt + props.viewDur > b.dur)
      throw new Error(
        `reveal pulls back until ${(props.viewAt + props.viewDur).toFixed(2)} s, after the beat ends; cue it earlier`,
      );
    delete props.reveal;
  }
}
