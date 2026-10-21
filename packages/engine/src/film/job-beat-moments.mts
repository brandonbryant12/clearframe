import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { BlockProps } from './types.mjs';

import { type BeatContext } from './job-types.mjs';

import { applyMoments, namesMoments } from './moments.mjs';

import type { BeatBasics } from './job-beat-contracts.mjs';

export function beatMoments(
  b: TimingBeat,
  props: BlockProps,
  report: BeatContext['report'],
  { moments, helperFrame }: BeatBasics,
): void {
  if (b.block === 'canvas' && (moments || namesMoments(props.elements))) {
    const used = applyMoments(
      props.elements,
      moments,
      'elements',
      (m) => {
        throw new Error(m);
      },
      b.dur,
    );
    for (const name of moments?.keys() ?? [])
      if (!used.has(name) && !helperFrame.usedMoments?.has(name))
        report.warnings.push(
          `${b.id}: moment ${name} is named but nothing lands on it.`,
        );
  }
}
