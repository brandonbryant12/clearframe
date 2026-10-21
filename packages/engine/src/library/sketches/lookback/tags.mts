import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { lookbackLine } from './line.mjs';

export function lookbackTags(context: ReturnType<typeof lookbackLine>) {
  const {
    start,
    end,
    gain,
    fmt,
    lowStart,
    cued,
    F,
    cap,
    tagD,
    tagPad,
    tagGap,
    tagH,
    tagW,
    dotR,
    x0,
    x1,
    yOf,
    text,
    els,
  } = context;

  // The two prices: a dot on the line and its value in a tag hung outside the period (above
  // and left of the first day, above and right of the last), so the line never runs under one.
  const marker = (x: number, v: number, side: number) => {
    const y = yOf(v),
      tw = tagW(v),
      tx = round(side < 0 ? x + 16 - tw : x - 16),
      ty = round(y - 40 - tagH);
    return { x, y, tw, tx, ty };
  };

  const S = marker(x0, start, -1),
    E = marker(x1, end, 1);

  const lower = lowStart ? S : E;

  const fadeBack = (cue: string, back: string | null) => [
    cued('LOWER', 0.1, { dur: 0.8, opacity: 0.32 }),
    ...(back ? [cued(back, 0.1, { dur: 0.6, opacity: 1 })] : []),
  ];

  for (const { m, cue, v } of [
    { m: S, cue: 'START', v: start },
    { m: E, cue: 'END', v: end },
  ]) {
    const higher = m !== lower;
    // Today's price comes back when the gap to it is measured.
    const back = higher && cue === 'END' && gain ? 'GAIN' : null;
    els.push({
      type: 'circle',
      cx: m.x,
      cy: m.y,
      r: dotR,
      fill: 'accent2',
      stroke: 'bg',
      width: 4,
      enter: 'pop',
      dur: 0.45,
      ...cued(cue),
      ...(higher ? { keys: fadeBack(cue, back) } : {}),
    } satisfies CanvasElement);
    els.push({
      type: 'group',
      enter: 'rise',
      dist: 26,
      dur: 0.75,
      ...cued(cue),
      ...(higher ? { keys: fadeBack(cue, back) } : {}),
      children: [
        {
          type: 'rect',
          x: m.tx,
          y: round(m.ty),
          w: m.tw,
          h: tagH,
          r: 10,
          fill: 'accent2',
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'poly',
          points: [
            [m.x - 9, round(m.ty + tagH - 1)],
            [m.x + 9, round(m.ty + tagH - 1)],
            [m.x, round(m.ty + tagH + 24)],
          ],
          closed: true,
          fill: 'accent2',
          enter: 'none',
        },
        text(
          cue === 'START' ? 'STARTLABEL' : 'ENDLABEL',
          m.tx + m.tw / 2,
          m.ty + tagPad + cap(tagD) + 2,
          tagD,
          'semibold',
          'bg',
          {
            anchor: 'middle',
            fit: round(m.tw - F.tag * 0.5),
            opacity: 0.86,
            enter: 'none',
          },
        ),
        text(
          fmt(v),
          m.tx + m.tw / 2,
          m.ty + tagPad + cap(tagD) + 2 + tagGap + cap(F.tag),
          F.tag,
          'bold',
          'bg',
          { anchor: 'middle', fit: round(m.tw - F.tag * 0.6), enter: 'none' },
        ),
      ],
    } satisfies CanvasElement);
  }
  return {
    ...context,
    gain,
    fmt,
    lowStart,
    cued,
    F,
    cap,
    tagH,
    dotR,
    x0,
    x1,
    text,
    els,
    lower,
  };
}
