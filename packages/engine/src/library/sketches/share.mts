import type { CanvasElement } from '../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../film/contracts/library.mjs';
interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    total?: number;
    count?: number;
    cols?: number;
    unit?: string;
    tone?: string;
    fix?: boolean;
  };
}
import { body, round } from '../../film/sketch-kit.mjs';

// A share of a whole, one tile each: "31 of every 100 claims came back". The whole is on screen
// from the first frame; on its word the share fills in reading order (so "nearly a third" reads
// before the number) while the figure counts up; the rest steps back; and, at the close, the
// share can turn to the good colour (what the film asks for, not a measured result). Tiles carry
// ids (share-1 …), so one can grow into the next beat's object. Moments: COUNT, ISOLATE (and FIX).
const AT = { COUNT: 1.0, ISOLATE: 2.6, FIX: 4.2 };

export default {
  name: 'share',
  keep: true,
  order: 95,
  summary:
    'A share of a whole, one tile each: the whole on screen, the share filling in reading order on its word as its figure counts up, the rest stepping back, and (with fix) the share turning to the good colour at the close.',
  use: 'One figure that is a share of people, claims, emails or accounts, or of a year: "31 percent of expense claims came back", "six in twenty of us have not named a beneficiary", "sixteen weeks of paid leave" (total 52, cols 13, unit "weeks"). Set sketchParams {total, count, cols, unit, tone, fix}; the figure prints as a percentage when total is 100 ("31%"), as "6 in 20" otherwise, or as the count and its unit ("16 weeks"); replace WHAT (what follows the figure, e.g. "of expense claims came back last year", "have not named a beneficiary") with sketchText; land COUNT, ISOLATE and, with fix, FIX on words with sketchSay. fix shows what the film asks for, not a result: say so in the narration. The figure needs a visible source.',
  params: {
    total: {
      default: 100,
      min: 10,
      max: 100,
      integer: true,
      about: 'tiles in the whole (100 shows a percentage)',
    },
    count: {
      default: 31,
      min: 1,
      max: 100,
      integer: true,
      about: 'tiles in the share',
    },
    cols: {
      default: 10,
      min: 5,
      max: 13,
      integer: true,
      figure: false,
      about: 'tiles per row (13 lays a year out as four rows of weeks)',
    },
    unit: {
      default: '',
      about:
        'what one tile is, printed after the count ("weeks" prints "16 weeks"); empty prints a percentage of 100, or "6 in 20"',
    },
    tone: {
      default: 'accent',
      oneOf: ['accent', 'negative'],
      about:
        "the share's colour: accent, or negative for something that went wrong",
    },
    fix: {
      default: false,
      about:
        'at FIX the share turns to the good colour (the close of a film that asks for a change)',
    },
  },
  build(
    w: number,
    h: number,
    { params = {} }: BuildOptions = {},
  ): SketchDrawing {
    const {
      total = 100,
      count = 31,
      cols = 10,
      tone = 'accent',
      fix = false,
      unit = '',
    } = params;
    if (count > total)
      throw new Error(
        `sketchParams.count (${count}) is more than the total (${total}) for share`,
      );
    const T = h > w * 1.1;
    // The grid uses the height a heading would take: the share is the whole picture.
    const b = T
      ? { ...body(w, h), y: round(h * 0.16), h: round(h * 0.62) }
      : { ...body(w, h), y: 170, h: 660 };
    const rows = Math.ceil(total / cols);
    // The grid as large as the body allows: the left of a wide frame, the top of a tall one.
    const cell = round(
      T
        ? Math.min(b.w / cols, (b.h - 420) / rows)
        : Math.min((b.w * 0.42) / cols, b.h / rows),
    );
    const gap = Math.max(4, round(cell * 0.16));
    const size = cell - gap;
    // Left-aligned with its figure, as an editorial chart is.
    const gx = round(b.x),
      // Centred in the height: on a tall frame with the figure and its words under the grid.
      gy = round(
        b.y +
          Math.max(
            0,
            T ? (b.h - (cell * rows + 330)) / 2 : (b.h - cell * rows) / 2,
          ),
      );
    const tile = (i: number) => ({
      x: gx + (i % cols) * cell,
      y: gy + Math.floor(i / cols) * cell,
    });
    const r = round(size * 0.18);
    const els: CanvasElement[] = [];
    // The whole, from the first frame.
    els.push({
      type: 'group',
      at: 0,
      enter: 'none',
      keys: [{ cue: 'ISOLATE', at: AT.ISOLATE, opacity: 0.32, dur: 0.6 }],
      children: Array.from(
        { length: total },
        (_, i): CanvasElement =>
          ({
            type: 'rect',
            ...tile(i),
            w: size,
            h: size,
            r,
            fill: 'surface',
            stroke: 'line',
            width: 2,
            enter: 'none',
          }) satisfies CanvasElement,
      ),
    } satisfies CanvasElement);
    // COUNT: the share, in reading order, while the figure counts up.
    const step = Math.min(0.03, 0.9 / count);
    els.push({
      type: 'group',
      cue: 'COUNT',
      at: AT.COUNT,
      stagger: step,
      enter: 'none',
      children: Array.from(
        { length: count },
        (_, i): CanvasElement =>
          ({
            type: 'rect',
            id: `share-${i + 1}`,
            ...tile(i),
            w: size,
            h: size,
            r,
            fill: tone,
            enter: 'pop',
            dur: 0.3,
          }) satisfies CanvasElement,
      ),
    } satisfies CanvasElement);
    if (fix)
      els.push({
        type: 'group',
        cue: 'FIX',
        at: AT.FIX,
        stagger: Math.min(0.03, 0.9 / count),
        enter: 'none',
        children: Array.from({ length: count }, (_, k) => count - 1 - k).map(
          (i): CanvasElement =>
            ({
              type: 'rect',
              ...tile(i),
              w: size,
              h: size,
              r,
              fill: 'positive',
              enter: 'fade',
              dur: 0.3,
            }) satisfies CanvasElement,
        ),
      } satisfies CanvasElement);
    // The figure and what it counts: right of the grid, or under it on a tall frame.
    const figure = amountSuffix(unit, total);
    const fx = T ? b.x : gx + cell * cols + round(b.w * 0.07),
      fy = T ? gy + cell * rows + 180 : round(gy + (cell * rows) / 2 + 20);
    const big = amountWidth(T, unit, total);
    // With fix, the figure and its words step back as the share turns: they are last year's.
    const recede = fix
      ? { keys: [{ cue: 'FIX', at: AT.FIX, opacity: 0.35, dur: 0.6 }] }
      : {};
    els.push({
      type: 'text',
      count: {
        from: 0,
        to: count,
        dur: Math.max(0.6, step * count + 0.3),
        ...figure,
      },
      x: fx,
      y: fy,
      size: big,
      font: 'display',
      fill: tone,
      cue: 'COUNT',
      at: AT.COUNT,
      enter: 'fade',
      dur: 0.3,
      ...recede,
    } satisfies CanvasElement);
    els.push({
      type: 'text',
      text: 'WHAT',
      x: fx,
      y: fy + (T ? 90 : 84),
      size: T ? 50 : 52,
      font: 'strong',
      fill: 'ink',
      width: round(T ? b.w : b.x + b.w - fx),
      cue: 'COUNT',
      at: AT.COUNT + 0.5,
      enter: 'rise',
      dist: 16,
      dur: 0.45,
      ...recede,
    } satisfies CanvasElement);
    return { elements: els };
  },
};

function amountWidth(T: boolean, unit: string, total: number) {
  if (T) {
    if (unit.trim()) {
      return 150;
    }
    return 190;
  }
  if (total === 100 && !unit.trim()) {
    return 200;
  }
  return 150;
}

function amountSuffix(unit: string, total: number) {
  if (unit.trim()) {
    return { suffix: ` ${unit.trim()}` };
  }
  if (total === 100) {
    return { suffix: '%' };
  }
  return { suffix: ` in ${total}` };
}
