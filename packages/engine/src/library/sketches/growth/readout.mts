import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { AT } from './model.mjs';

export function compactAmount(v: number) {
  if (v >= 1e9) {
    return `${+(v / 1e9).toFixed(1)}B`;
  }
  if (v >= 1e6) {
    return `${+(v / 1e6).toFixed(1)}M`;
  }
  if (v >= 1e3) {
    return `${+(v / 1e3).toFixed(1)}k`;
  }
  return v;
}

export function drawGrowthReadout({
  side,
  right,
  R,
  fs,
  yTop,
  yMid,
  base,
  text,
  els,
  putAt,
  money,
  putIn,
  grew,
  grewAt,
  count,
  cued,
  L,
  ro,
}: DrawGrowthReadoutContext) {
  if (side) {
    // Brackets beside the column mark each part's true extent; the labels keep clear of each
    // other when a part is thin.
    const bx = right + 14,
      lx = right + 40,
      lwide = R - lx;
    const ph = round(fs.value * 0.74 + fs.words + 14);
    const blocks = [
      { y: yTop, h: round(fs.total * 0.72 + fs.words + 22) },
      { y: round((yTop + yMid) / 2 - ph / 2), h: ph },
      { y: round((yMid + base) / 2 - ph / 2), h: ph },
    ];
    for (let k = 1; k < 3; k++)
      blocks[k].y = Math.max(
        blocks[k].y,
        blocks[k - 1].y + blocks[k - 1].h + 14,
      );
    const over = blocks[2].y + blocks[2].h - (base + 20);
    if (over > 0) blocks.forEach((bk) => (bk.y = round(bk.y - over)));
    const bracket = (
      y0: number,
      y1: number,
      stroke: string,
      timing: Partial<CanvasElement>,
    ): CanvasElement =>
      ({
        type: 'path',
        d: `M ${bx} ${round(y0 + 3)} L ${bx + 10} ${round(y0 + 3)} L ${bx + 10} ${round(y1 - 3)} L ${bx} ${round(y1 - 3)}`,
        fill: 'none',
        stroke,
        width: 3,
        cap: 'round',
        join: 'round',
        enter: 'draw',
        dur: 0.4,
        ...timing,
      }) satisfies CanvasElement;
    const part = (
      bk: { y: number; h: number },
      value: string,
      words: string,
      fill: string,
      timing: Partial<CanvasElement>,
    ): CanvasElement =>
      ({
        type: 'group',
        enter: 'right',
        dist: 24,
        dur: 0.45,
        ...timing,
        children: [
          text(
            value,
            lx,
            round(bk.y + fs.value * 0.74),
            fs.value,
            'bold',
            fill,
            { fit: lwide, enter: 'none' },
          ),
          text(
            words,
            lx,
            round(bk.y + fs.value * 0.74 + fs.words + 10),
            fs.words,
            'semibold',
            'ink',
            { fit: lwide, enter: 'none' },
          ),
        ],
      }) satisfies CanvasElement;
    els.push(bracket(yMid, base, 'accent2', putAt()));
    els.push(part(blocks[2], money(putIn), 'PUTIN', 'accent2', putAt()));
    // (The growth's part is named even at a 0% rate, so GROW is always a moment.)
    if (grew > 0) els.push(bracket(yTop, yMid - 3, 'accent', grewAt()));
    els.push(part(blocks[1], money(grew), 'GREW', 'accent', grewAt()));
    els.push(
      text(
        null,
        lx,
        round(blocks[0].y + fs.total * 0.72),
        fs.total,
        'bold',
        'ink',
        { count, fit: lwide, enter: 'fade', dur: 0.3, ...cued('TOTAL', 0.2) },
      ),
    );
    els.push(
      text(
        'TOTAL',
        lx,
        round(blocks[0].y + fs.total * 0.72 + fs.words + 14),
        fs.words,
        'semibold',
        'ink',
        {
          fit: lwide,
          enter: 'rise',
          dist: 14,
          dur: 0.4,
          ...cued('TOTAL', 0.5),
        },
      ),
    );
  } else {
    // Over the chart: the total and its words, then the two parts side by side, a swatch each.
    const colW = round((R - L) / 2);
    const part = (
      x: number,
      value: string,
      words: string,
      fill: string,
      timing: Partial<CanvasElement>,
    ): CanvasElement =>
      ({
        type: 'group',
        enter: 'rise',
        dist: 16,
        dur: 0.45,
        ...timing,
        children: [
          {
            type: 'rect',
            x,
            y: round(ro.parts - fs.value * 0.72),
            w: 14,
            h: round(fs.value * 0.72),
            r: 3,
            fill,
            enter: 'none',
          } satisfies CanvasElement,
          text(value, x + 28, ro.parts, fs.value, 'bold', fill, {
            fit: colW - 40,
            enter: 'none',
          }),
          text(
            words,
            x + 28,
            round(ro.parts + fs.words + 12),
            fs.words,
            'semibold',
            'ink',
            { fit: colW - 40, enter: 'none' },
          ),
        ],
      }) satisfies CanvasElement;
    els.push(part(L, money(putIn), 'PUTIN', 'accent2', putAt()));
    els.push(part(L + colW, money(grew), 'GREW', 'accent', grewAt()));
    els.push(
      text(null, L, ro.total, fs.total, 'bold', 'ink', {
        count,
        fit: R - L,
        enter: 'fade',
        dur: 0.3,
        ...cued('TOTAL', 0.2),
      }),
    );
    els.push(
      text('TOTAL', L, ro.words, fs.words + 2, 'semibold', 'ink', {
        fit: R - L,
        enter: 'rise',
        dist: 14,
        dur: 0.4,
        ...cued('TOTAL', 0.5),
      }),
    );
  }
}

export interface DrawGrowthReadoutContext {
  side: boolean;
  right: number;
  R: number;
  fs: {
    basis: number;
    total: number;
    value: number;
    words: number;
    tick: number;
    grid: number;
  };
  yTop: number;
  yMid: number;
  base: number;
  text: (
    t: string | null,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  els: CanvasElement[];
  putAt: () => { cue: 'START' | 'GROW' | 'TOTAL'; at: number; after: number };
  money: (v: number) => string;
  putIn: number;
  grew: number;
  grewAt: () => { cue: 'START' | 'GROW' | 'TOTAL'; at: number; after: number };
  count: {
    from: number;
    to: number;
    decimals: number;
    prefix: string;
    dur: number;
  };
  cued: (
    cue: keyof typeof AT,
    dt: number,
    extra?: Partial<CanvasElement>,
  ) => { cue: 'START' | 'GROW' | 'TOTAL'; at: number; after: number };
  L: number;
  ro: { total: number; words: number; parts: number };
}
