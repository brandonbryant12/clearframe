import { rules, stagedItems } from './registry.mjs';

import type { SoundContext } from './sound-contracts.mjs';

export function automaticSounds(ctx: SoundContext): void {
  const { b, level, start, add } = ctx;
  const spec = rules(b.block);
  const t = { start, cue: start + b.cue_seconds, level };
  // No automatic swells, drones or hits: trailer punctuation under a benefits or policy film
  // reads as a sales pitch. An author who wants one names it (`sound` on an element or key).
  // Only a fast flight whooshes; a slow creep is felt, not heard.
  const flight =
    b.block === 'canvas' &&
    b.props.dolly?.find(
      (k) => Math.abs(k.z ?? 0) / Math.max(0.1, k.dur ?? 1.2) > 0.8,
    );
  if (flight) add('whoosh', start + (flight.at ?? 0), 0.16, 1);
  spec.sounds?.(b, add, t);
  if (spec.tock && level !== 'subtle')
    for (const it of b.props.items
      ? stagedItems(b.props, 'items')
      : stagedItems(b.props, 'nodes'))
      if (it.at != null) add('tock', start + it.at, 0.14, 0);
  if (b.tone && level === 'punchy') add('thud', start + 0.02, 0.25, 2);
  // A world camera travelling to its next stop.
  if (
    b.block === 'canvas' &&
    b.props.viewFrom &&
    (b.props.viewDur ?? 1.2) <= 2.5
  )
    add('whoosh', start + (b.props.viewAt ?? 0), 0.18, 2);
}
