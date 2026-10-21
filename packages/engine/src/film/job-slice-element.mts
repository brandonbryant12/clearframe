import { movedBy } from './job-targets.mjs';

import type { SlicePart } from './job-slice-parts.mjs';
export function sliceElement(id: string, { el, m, from }: SlicePart): void {
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
  if (keys?.length && !movedBy(state, keys))
    throw new Error(
      `${id} has keys a slice cannot follow (blur, tilt or a stretch); give it a still state before it divides`,
    );
  const axis = m.axis ?? 'x',
    [pos, size] = axis === 'x' ? (['x', 'w'] as const) : (['y', 'h'] as const);
  const scale = state.scale ?? 1;
  if (scale !== 1) throw new Error(`${id} is scaled; divide an unscaled rect`);
  const length = state[size];
  if (typeof length !== 'number')
    throw new Error(`${id} is missing its ${size} dimension`);
  const slice = {
    ...state,
    [pos]: (state[pos] ?? 0) + length * m.slice[0],
    [size]: length * (m.slice[1] - m.slice[0]),
  };
  el.morph = {
    from: { ...slice, at: 0, dur: 0, enter: 'none' },
    dur: el.morphDur ?? 0.8,
  };
  Object.assign(el, { enter: 'none', at: 0, dur: 0 });
  delete el.morphDur;
  delete from.exit;
  delete from.exitAt;
  delete from.exitDur;
}
