import type { WeekMoments, Rectangle } from '../drawing/contracts.mjs';
import { cueWriter } from '../drawing/cues.mjs';

import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { type BuildOptions, CUES } from './common.mjs';

export function weekBase(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
) {
  const {
    days = 5,
    today = 0,
    due = 4,
    tasks = [0, 1, 3],
    after = false,
  } = params;

  if (today >= days || due >= days)
    throw new Error(
      `sketchParams for week: today and due are days 0–${days - 1} of a ${days}-day week (got today ${today}, due ${due})`,
    );

  if (today > due)
    throw new Error(
      `sketchParams.today for week must not come after due (got today ${today}, due ${due})`,
    );

  const late = tasks.filter((d) => d > due);

  if (late.length)
    throw new Error(
      `sketchParams.tasks for week must fall on or before the due day ${due} (got ${late.join(', ')})`,
    );

  const n = tasks.length;

  // Moments: the tasks a second apart, the due day after them, the consequence last.
  const AT: WeekMoments = {
    TODAY: 0.5,
    DUE: round(1.1 + (n - 1) * 0.9 + 1.2),
  };

  CUES.slice(0, n).forEach((c, i) => (AT[c] = round(1.1 + i * 0.9)));

  if (after) AT.AFTER = round(AT.DUE + 1.8);

  const cued = cueWriter(AT);

  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement =>
    ({
      type: 'text',
      text: t,
      x,
      y,
      size,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;

  const byDay: number[][] = Array.from({ length: days }, () => []);

  tasks.forEach((d, i) => byDay[d].push(i));

  const weekend = (d: number) => d >= 5;

  // A loop of marker round a day, drawn a little past a full turn and a little tilted, as a hand would.
  const ring = (cx: number, cy: number, rx: number, ry: number) => {
    const pts = [];
    for (let a = 0; a <= 1.12; a += 0.03) {
      const t = (-0.3 + a) * 2 * Math.PI,
        g = 1 + 0.07 * a;
      const [px, py] = [rx * g * Math.cos(t), ry * g * Math.sin(t)];
      pts.push(
        `${round(cx + px * 0.998 + py * 0.06)} ${round(cy + py * 0.998 - px * 0.06)}`,
      );
    }
    return `M ${pts.join(' L ')}`;
  };

  // An empty to-do box that draws itself once its card has landed.
  const box = (x: number, y: number, s: number, cue: string) =>
    ({
      type: 'rect',
      x: round(x),
      y: round(y),
      w: round(s),
      h: round(s),
      r: round(s * 0.26),
      fill: 'none',
      stroke: 'accent2',
      width: 3,
      enter: 'draw',
      dur: 0.35,
      ...cued(cue, 0.3),
    }) satisfies CanvasElement;

  // Missing the day: a copy of its label rides the arrow out of the week, shrinking and
  // fading as it goes; the consequence lands where it arrives (AFTER + LAND).
  const SLIP = 0.15,
    RIDE = 1.0,
    LAND = 0.95;

  const slip = (b: Rectangle, d: string) =>
    ({
      type: 'rect',
      ...b,
      r: round(b.h / 2),
      fill: 'accent',
      opacity: 0.75,
      enter: 'fade',
      dur: 0.15,
      ...cued('AFTER', SLIP),
      along: { d, ease: 'inOut', dur: RIDE, ...cued('AFTER', SLIP) },
      keys: [
        cued('AFTER', SLIP, { dur: RIDE, ease: 'inOut', scale: 0.7 }),
        cued('AFTER', SLIP + RIDE - 0.25, { dur: 0.3, opacity: 0 }),
      ],
    }) satisfies CanvasElement;

  // A card lands a little turned and settles square (made fresh per card: filling rewrites keys).
  const settle = (cue: string, deg: number) => [
    cued(cue, 0, { dur: 0, rotate: -deg }),
    cued(cue, 0, { dur: 1.0, ease: 'out', rotate: 0 }),
  ];

  const els: CanvasElement[] = [];

  // Pen marks keep the film's hand; the week and its cards stay crisp like a planner.
  const marks: CanvasElement[] = [];
  return {
    w,
    h,
    params,
    days,
    today,
    due,
    tasks,
    after,
    late,
    n,
    AT,
    cued,
    text,
    byDay,
    weekend,
    ring,
    box,
    SLIP,
    RIDE,
    LAND,
    slip,
    settle,
    els,
    marks,
  };
}
