import type { SoundContext } from './sound-contracts.mjs';

export function visualSounds(ctx: SoundContext): void {
  const { b, start, add } = ctx;
  let grows = 0;
  for (const el of [
    ...(b.block === 'canvas' ? (b.props.elements ?? []) : []),
    ...(b.art?.over ?? []),
  ]) {
    if (el.type === 'text' && typeof el.count === 'object')
      add('thud', start + (el.at ?? 0) + (el.count.dur ?? 0), 0.28, 3);
    // A bar growing into place lands with a soft tock, one per value.
    // A chart landing gets one soft tock, on its first bar: a burst of ticks is noise.
    else if (
      el.type === 'rect' &&
      ['grow', 'grow-x', 'grow-y'].includes(el.enter ?? '') &&
      grows < 1
    ) {
      add('tock', start + (el.at ?? 0) + (el.dur ?? 0.6) * 0.8, 0.12, 0);
      grows++;
    }
    // Arrivals are silent: a bloop on every icon and dot made films sound like a phone game.
  }
}
