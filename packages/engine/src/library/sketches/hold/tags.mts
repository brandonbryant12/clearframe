import type { CueTiming } from '.././drawing/contracts.mjs';
import { required } from '.././drawing/contracts.mjs';
import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { crisp, round } from '../../../film/sketch-kit.mjs';

import { padlock } from './common.mjs';
import type { holdExtremes } from './extremes.mjs';

export function holdTags(context: ReturnType<typeof holdExtremes>) {
  const {
    lock,
    steps,
    fmt,
    low,
    AT,
    wide,
    fs,
    L,
    tagH,
    tagW,
    gap,
    x0,
    x1,
    lockY,
    lowY,
    text,
    cued,
    els,
    tip,
    recede,
    iL,
    xs,
  } = context;

  // The tag: a padlock and the locked value, hanging at the start of the lock line; a
  // float-down hangs a second one under the step.
  const tag = (
    x: number,
    y: number,
    v: number,
    anchor: string,
    timing: CueTiming,
    extra: ElementFields = {},
  ) => {
    const tw = tagW(v);
    const tx = anchor === 'end' ? x - tw : x;
    const lockScale = wide ? 1.25 : 1.1;
    const pl = padlock(
      round(tx + tagH * 0.6),
      round(y),
      lockScale,
      'bg',
      'accent',
    );
    return crisp([
      {
        type: 'group',
        enter: 'pop',
        dur: 0.4,
        origin: [round(tx + tw / 2), round(y)],
        ...timing,
        ...extra,
        children: [
          {
            type: 'rect',
            x: tx,
            y: round(y - tagH / 2),
            w: tw,
            h: tagH,
            r: tagH / 2,
            fill: 'accent',
            enter: 'none',
          } satisfies CanvasElement,
          // The shackle starts open and snaps shut once the tag has landed.
          {
            ...pl.shackle,
            keys: [
              { at: 0, dur: 0, y: -9 },
              {
                ...timing,
                at: round(timing.at + 0.3),
                ...(timing.after != null
                  ? { after: round(timing.after + 0.3) }
                  : {}),
                dur: 0.22,
                ease: 'in',
                y: 0,
              },
            ],
          },
          pl.body,
          pl.keyhole,
          text(
            fmt(v),
            round(tx + tagH * 1.08),
            round(y + fs.tag * 0.36),
            fs.tag,
            'bold',
            'bg',
            { fit: round(tw - tagH * 1.08 - 22), enter: 'none' },
          ),
        ],
      } satisfies CanvasElement,
    ])[0];
  };

  const lockTag = { x: x0 - gap, y: lockY, anchor: 'end' };

  const pulse = () => ({
    cue: 'END',
    at: round(AT.END + 0.3),
    after: 0.3,
    dur: 0.6,
    ease: 'thereAndBack',
    scale: 1.08,
  });

  els.push(
    tag(lockTag.x, lockTag.y, lock, lockTag.anchor, cued('LOCK', 0), {
      keys: [steps ? recede(0.55) : pulse()],
    }),
  );

  els.push(
    // (Narrow frames let the words run on over the start of the window, where the market
    // still sits under the lock.)
    text(
      'LOCKED',
      wide ? lockTag.x : L,
      round(lockTag.y - tagH / 2 - 16),
      fs.label,
      'semibold',
      'ink',
      {
        anchor: wide ? 'end' : 'start',
        fit: wide ? x0 - gap - L : round(x0 - L + (x1 - x0) * 0.12),
        enter: 'rise',
        dist: 14,
        dur: 0.4,
        ...cued('LOCK', 0.3),
      },
    ),
  );

  if (steps) {
    const { dt } = tip(required(iL, 'float-down sample'));
    const sx = round(Math.min(xs + 26, x1 - tagW(low)));
    els.push(
      tag(
        sx,
        round(lowY + 34 + tagH / 2),
        low,
        'start',
        cued('FALL', round(dt + 0.6)),
        { keys: [pulse()] },
      ),
    );
  }

  // The end of the lock line, once the window has closed.
  els.push({
    type: 'circle',
    cx: x1,
    cy: steps ? lowY : lockY,
    r: 11,
    fill: 'accent',
    stroke: 'bg',
    width: 3,
    enter: 'pop',
    dur: 0.35,
    ...cued('END', 0.45),
  } satisfies CanvasElement);
  return { ...context, fmt, wide, fs, x0, x1, lockY, text, cued, els, tip };
}
