import type { ScoreContext } from './critique-score-context.mjs';

import { family, matched } from './critique-common.mjs';

import { joined } from './critique-score-context.mjs';
export function scoreGrammar(ctx: ScoreContext): void {
  const { beats, transitions, shots, tell } = ctx;
  const n = beats.length;
  // 6. Same grammar every beat.
  const kinds = new Set(beats.map(family)).size;
  // A camera travelling through a world between two beats is its own kind of join.
  const cuts = [
    ...shots
      .slice(1)
      .map((x) =>
        matched(beats[x.i - 1], beats[x.i]) ? 'match' : transitions[x.i],
      ),
    ...beats.map((_, i) => (joined(beats, i) ? 'world' : null)).filter(Boolean),
  ];
  if (
    cuts.length >= 3 &&
    new Set(cuts).size === 1 &&
    kinds <= Math.max(2, n / 4)
  )
    tell(
      'Same grammar every beat',
      `${kinds} kind${kinds === 1 ? '' : 's'} of scene and one kind of cut. Alternate wide and close, dense and bare, and give the story's turns a different cut.`,
    );
}
