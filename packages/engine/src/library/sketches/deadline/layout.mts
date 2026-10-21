import { calendarCue } from './cues.mjs';
import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { body, round } from '../../../film/sketch-kit.mjs';
import type { CalendarLayoutContext } from './contracts.mjs';
import { deadlineMetrics } from './metrics.mjs';

export function legendWidth(
  stacked: boolean,
  card: { x: number; y: number; w: number; h: number },
  small: boolean,
  w: number,
  gap: number,
) {
  if (stacked) {
    return card.w;
  }
  if (small) {
    return w - 240 - card.w - gap;
  }
  return 560;
}

export function cellHeight(
  stacked: boolean,
  small: boolean,
  b: { x: number; y: number; w: number; h: number },
  headH: number,
  pad: number,
  rows: number,
) {
  if (stacked) {
    return 92;
  }
  if (small) {
    return 60;
  }
  return Math.min(86, Math.floor((b.h - 4 - headH - pad) / rows));
}

export function cellWidth(
  stacked: boolean,
  w: number,
  pad: number,
  small: boolean,
) {
  if (stacked) {
    return round((w - 172 - 2 * pad) / 7);
  }
  if (small) {
    return 64;
  }
  return 116;
}

export function calendarLayout({
  firstWeekday,
  days,
  w,
  h,
  today,
}: CalendarLayoutContext) {
  const rows = Math.ceil((firstWeekday + days) / 7);
  const b = body(w, h);
  // Tall frames stack the key under the card; others set it beside the card.
  const stacked = h > w * 1.5;
  const small = !stacked && w < 1400;
  const metrics = deadlineMetrics(stacked, small);
  const pad = stacked ? 30 : 24;
  // Cells as large as the frame allows: rows share the body's height, so a five-week month
  // gets taller rows than a six-week one.
  const headH = metrics.headerHeight;
  const cw = cellWidth(stacked, w, pad, small);
  const ch = cellHeight(stacked, small, b, headH, pad, rows);
  const card = {
    x: 0,
    y: 0,
    w: round(7 * cw + 2 * pad),
    h: headH + rows * ch + pad,
  };
  const keys = today ? 3 : 2;
  const keyGap = metrics.legendGap;
  const gap = small ? 40 : 70;
  const keyW = legendWidth(stacked, card, small, w, gap);
  if (stacked)
    Object.assign(card, {
      x: round((w - card.w) / 2),
      y: round(
        b.y + Math.max(10, (b.h - card.h - 76 - (keys - 1) * keyGap - 40) / 2),
      ),
    });
  else
    Object.assign(card, {
      x: round((w - (card.w + gap + keyW)) / 2),
      y: round(b.y + (b.h - card.h) / 2),
    });
  const key = stacked
    ? { x: card.x + 44, y: card.y + card.h + 76 }
    : {
        x: card.x + card.w + gap,
        y: round(card.y + card.h / 2 - ((keys - 1) * keyGap) / 2),
      };
  const size = metrics.dayType;
  const R = round(Math.min(cw, ch) / 2 - 3);
  const cell = (d: number) => {
    const i = firstWeekday + d - 1;
    return [
      round(card.x + pad + (i % 7) * cw + cw / 2),
      round(card.y + headH + Math.floor(i / 7) * ch + ch / 2),
    ];
  };
  const text = (
    t: string,
    x: number,
    y: number,
    sz: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement =>
    ({
      type: 'text',
      ...(t == null ? {} : { text: t }),
      x,
      y,
      size: sz,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;
  const num = (d: number, fill: string, extra: ElementFields = {}) =>
    text(
      String(d),
      cell(d)[0],
      round(cell(d)[1] + size * 0.36),
      size,
      'semibold',
      fill,
      { anchor: 'middle', ...extra },
    );
  const cued = calendarCue;

  // A loop of marker round a day, drawn a little past a full turn as a hand would.
  const ring = (x: number, y: number, r: number) => {
    const pts = [];
    for (let a = 0; a <= 1.12; a += 0.04) {
      const t = (-0.32 + a) * 2 * Math.PI;
      const rr = r + 4 * a;
      pts.push(
        `${round(x + rr * Math.cos(t))} ${round(y + rr * Math.sin(t) * 0.94)}`,
      );
    }
    return `M ${pts.join(' L ')}`;
  };
  return {
    card,
    text,
    pad,
    stacked,
    small,
    cw,
    headH,
    cell,
    R,
    cued,
    num,
    ring,
    key,
    keyGap,
    keyW,
  };
}
