import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { BlockProps, CueResolver } from './types.mjs';
import { type StagedSpec, stagedItems } from './registry.mjs';

import { type ItemCue } from './job-types.mjs';

/**
 * Staged items fit inside the beat: automatic spacing compresses, authored cues never move,
 * and a cue too late to finish its entrance fails instead of being hidden.
 */
export function stageItems(
  props: BlockProps,
  { key, offset, spacing: nominal, itemSeconds }: StagedSpec,
  {
    b,
    frame,
    at,
    authored,
    cue,
    entrance,
  }: {
    b: TimingBeat;
    frame: number;
    at: number;
    authored: ItemCue;
    cue: CueResolver;
    entrance: number;
  },
) {
  const items = stagedItems(props, key);
  const duration = itemSeconds(entrance);
  const lastStart = b.dur - frame - duration;
  if (lastStart < 0)
    throw new Error(
      `Beat is too short for its ${duration.toFixed(2)}s item entrance; extend the beat.`,
    );
  if (authored != null && at > lastStart + 1e-7)
    throw new Error(
      'Scene cue is too late to complete its item entrances; extend the beat or move the cue.',
    );
  const start = Math.min(at + offset, Math.max(at, lastStart));
  const latest = Math.max(
    authored != null ? at : 0,
    lastStart - Math.min(0.3, b.dur * 0.1),
  );
  const first = authored != null ? start : Math.min(start, latest);
  const spacing =
    items.length > 1
      ? Math.max(
          0,
          Math.min(
            nominal ?? props.stagger ?? 0,
            (latest - first) / (items.length - 1),
          ),
        )
      : 0;
  props[key] = items.map((it, i) => {
    const time = it.say == null ? first + i * spacing : cue(it.say);
    if (time > lastStart + 1e-7)
      throw new Error(
        'Item cue is too late to complete its entrance; extend the beat or move the cue.',
      );
    const { say: _say, ...rest } = it;
    return { ...rest, at: time };
  });
}
