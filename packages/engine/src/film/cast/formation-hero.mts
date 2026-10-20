import type { FormationLayout } from './formation-layout.mjs';

import { required } from './common.mjs';
export function hero(layout: FormationLayout) {
  const { f, ids, W, tall, u, A, cx, cy, out, place } = layout;

  // One object steps forward; the rest recede into a wide ring, small and quiet. The hero stands
  // centred (its word goes below), so it still holds the frame after the word has gone.
  const others = ids.filter((id) => id !== f.hero),
    heroAt = [cx, cy - (f.word ? u * 0.08 : 0)];
  place(required(f.hero, 'hero'), heroAt[0], heroAt[1], {
    scale: f.scale ?? 2.3,
  });
  // With a word under the hero, the ring leaves the bottom clear for it.
  const gap = f.word ? 0.75 : 0,
    a0 = f.word ? Math.PI / 2 + gap : -Math.PI / 2;
  others.forEach((id, i) => {
    const a = a0 + ((i + 0.5) / others.length) * (Math.PI * 2 - 2 * gap);
    out.set(id, {
      x: cx + Math.cos(a) * (tall ? W * 0.4 : W * 0.42),
      y: cy + Math.sin(a) * (tall ? A * 0.36 : A * 0.4),
      scale: 0.6,
      rotate: 0,
      opacity: 0.35,
    });
  });
}
