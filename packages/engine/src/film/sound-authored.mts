import type { CanvasElement } from './types.mjs';
import type { ClockStep, SoundContext } from './sound-contracts.mjs';

import { soundHit } from './sound-hit.mjs';
export function authoredSounds(
  ctx: SoundContext,
  list: CanvasElement[] | undefined,
  outer: ClockStep[] = [],
  inherited = 0,
  stagger = 0,
): void {
  (list ?? []).forEach((el, i) => {
    const own = el.at ?? (outer.length ? inherited + i * stagger : null);
    const clock = [...outer, { fps: el.fps }];
    const hit = soundHit(ctx, clock);
    if (el.sound != null && el.sound !== false) hit(el.sound, own);
    for (const k of el.keys ?? []) if (k.sound != null) hit(k.sound, k.at);
    markSounds(el, hit);
    if (el.type === 'group')
      authoredSounds(
        ctx,
        el.children,
        [...clock, { shift: el.shift ?? 0 }],
        el.at ?? 0,
        el.stagger ?? 0,
      );
  });
}

function markSounds(el: CanvasElement, hit: ReturnType<typeof soundHit>): void {
  // A mark's sound as it lands; a stamp is pressed with a thud (it sets down in 0.2 s).
  for (const m of el.marks ?? []) {
    if (Array.isArray(m)) continue;
    const v = m.sound ?? (m.style === 'stamp' ? 'thud' : false);
    const delay = m.style === 'stamp' ? 0.15 : 0;
    if (v !== false) hit(v, m.at == null ? null : m.at + delay);
  }
}
