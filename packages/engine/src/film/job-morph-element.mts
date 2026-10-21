import type { JobBeat, CanvasElement } from './types.mjs';

import { eachElement } from './canvas.mjs';

import { movedBy } from './job-targets.mjs';

export function morphElement(
  el: CanvasElement,
  from: CanvasElement,
  beat: JobBeat,
  warnings: string[],
): void {
  const {
    morph: _morph,
    echo: _echo,
    keys,
    loop: _loop,
    along: _along,
    exitAt: _exitAt,
    exitDur: _exitDur,
    exit: _exit,
    ...state
  } = from;
  // Where keys that only move it left it (a card that slid across), the morph starts there.
  const moved = keys?.length ? movedBy(state, keys) : true;
  if (!moved)
    warnings.push(
      `${beat.id}: morph source "${el.id}" has keys; the morph starts from its unkeyed geometry.`,
    );
  el.morph = {
    from: { ...state, at: 0, dur: 0, enter: 'none' },
    dur: el.morphDur ?? 0.8,
  };
  // A group's contents arrive with it; they are already on screen across the cut, while
  // later changes inside the group (a status redrawn, a pulse) keep their own times.
  if (el.type === 'group') {
    const arrived = el.at ?? 0;
    eachElement(el.children, (child) => {
      if ((child.at ?? 0) <= arrived + 1e-6)
        Object.assign(child, { at: 0, dur: 0, enter: 'none' });
    });
  }
  Object.assign(el, { enter: 'none', at: 0, dur: 0 });
  delete el.morphDur;
  delete from.exit;
  delete from.exitAt;
  delete from.exitDur;
}
