import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { NAMES } from './model.mjs';
import type { BuildOptions, CueTimes } from './model.mjs';
import { splitInputs } from './inputs.mjs';
import { splitLayout } from './layout.mjs';
import { createLane } from './lanes.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const { parts, prefix, suffix, sum, showTotal } = splitInputs(params);
  const n = parts.length;
  // Values print with the decimals they were given (at most two), with thousands separators.
  const dec = Math.min(
    2,
    Math.max(...parts.map((v) => (String(v).split('.')[1] ?? '').length)),
  );
  const fmt = (v: number) =>
    `${prefix}${Number(v.toFixed(dec)).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${suffix}`;

  const AT: CueTimes = { SPLIT: 1.2 };
  NAMES.slice(0, n).forEach((k, i) => (AT[k] = round(2.0 + i * 0.8)));
  AT.REST = round(AT[NAMES[n - 1]] + 1.3);

  var {
    wholeY,
    wholeH,
    bx,
    bw,
    laneY,
    laneH,
    wide,
    labelEnd,
    textY,
    fs,
    valueEnd,
  }: {
    wholeY: number;
    wholeH: number;
    bx: number;
    bw: number;
    laneY: (index: number) => number;
    laneH: number;
    wide: boolean;
    labelEnd: number;
    textY: (y: number, height?: number, size?: number) => number;
    fs: { whole: number; total: number; label: number; value: number };
    valueEnd: number;
  } = splitLayout(w, h, n);
  const wholeCy = round(wholeY + wholeH / 2);
  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra = {},
  ): CanvasElement =>
    ({
      type: 'text',
      ...(t == null ? {} : { text: t }),
      x,
      y,
      size,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;

  // Each part's place in the whole: its share of the sum, laid end to end.
  let run = 0;
  const seg = parts.map((v) => {
    const x = round(bx + (bw * run) / sum);
    run += v;
    return { x, w: Math.max(round(bx + (bw * run) / sum) - x, 0) };
  });
  const last = n - 1;

  const lane = createLane({
    AT,
    laneY,
    bx,
    bw,
    laneH,
    text,
    wide,
    labelEnd,
    textY,
    fs,
    fmt,
    parts,
    valueEnd,
    last,
  });

  // The highlight round the remainder's row, behind its words.
  const ry = laneY(last);
  const ring = wide
    ? {
        x: labelEnd - 440,
        y: ry - 22,
        w: valueEnd + 28 - (labelEnd - 440),
        h: laneH + 44,
      }
    : {
        x: bx - 24,
        y: textY(ry) - 52,
        w: bw + 48,
        h: ry + laneH + 22 - (textY(ry) - 52),
      };

  return {
    elements: [
      // The whole: its name, the bar and (from the values) its total.
      text(
        'WHOLE',
        wide ? labelEnd : bx,
        wide ? textY(wholeY, wholeH, fs.whole) : textY(wholeY),
        fs.whole,
        'bold',
        'ink',
        {
          anchor: wide ? 'end' : 'start',
          fit: wide ? 420 : round(bw * 0.62),
          enter: 'rise',
          at: 0.2,
          dur: 0.45,
        },
      ),
      ...(showTotal
        ? [
            text(
              fmt(sum),
              valueEnd,
              wide ? textY(wholeY, wholeH, fs.total) : textY(wholeY) + 4,
              fs.total,
              'bold',
              'ink',
              {
                anchor: 'end',
                fit: wide ? 260 : round(bw * 0.34),
                enter: 'rise',
                at: 0.75,
                dur: 0.45,
              },
            ),
          ]
        : []),
      {
        type: 'rect',
        x: bx,
        y: wholeY,
        w: bw,
        h: wholeH,
        r: 12,
        fill: 'none',
        stroke: 'line',
        width: 2,
        dash: [10, 8],
        enter: 'fade',
        cue: 'SPLIT',
        at: round(AT.SPLIT + 0.3),
        after: 0.3,
        dur: 0.5,
      } satisfies CanvasElement,
      {
        type: 'rect',
        x: bx,
        y: wholeY,
        w: bw,
        h: wholeH,
        r: 12,
        fill: 'accent',
        origin: [bx, wholeCy],
        enter: 'grow-x',
        at: 0.35,
        dur: 0.8,
        exit: 'none',
        exitCue: 'SPLIT',
        exitAt: round(AT.SPLIT + 0.05),
      } satisfies CanvasElement,
      ...parts.slice(0, last).flatMap((_, i) => lane(i)),
      // The remainder's highlight sits behind its own lane; it waits, unseen, from that part's
      // landing and fades up on REST.
      {
        type: 'rect',
        ...ring,
        r: 20,
        fill: 'wash',
        enter: 'none',
        cue: NAMES[last],
        at: AT[NAMES[last]],
        // Key opacity multiplies the element's own, so the band is drawn at 1 and keyed to 0 first.
        keys: [
          { cue: NAMES[last], at: AT[NAMES[last]], dur: 0, opacity: 0 },
          { cue: 'REST', at: AT.REST, dur: 0.5, opacity: 0.55 },
        ],
      } satisfies CanvasElement,
      ...lane(last),
      // The parts: they take the whole's place on SPLIT, part by a hair, then each drops into
      // its lane at the same x, so the lanes still tile the whole.
      ...seg.flatMap(({ x, w: sw }, i) =>
        sw < 1
          ? []
          : [
              {
                type: 'rect',
                x,
                y: wholeY,
                w: sw,
                h: wholeH,
                r: Math.min(10, round(sw / 2)),
                fill: 'accent',
                stroke: 'bg',
                width: 3,
                origin: [round(x + sw / 2), wholeCy],
                enter: 'none',
                cue: 'SPLIT',
                at: AT.SPLIT,
                keys: [
                  {
                    cue: 'SPLIT',
                    at: round(AT.SPLIT + 0.05),
                    after: 0.05,
                    dur: 0.5,
                    ease: 'out',
                    x: round((i - (n - 1) / 2) * 10),
                  },
                  {
                    cue: NAMES[i],
                    at: AT[NAMES[i]],
                    dur: 0.75,
                    ease: 'inOut',
                    x: 0,
                    y: round(laneY(i) + laneH / 2 - wholeCy),
                    scaleY: round((laneH / wholeH) * 1000) / 1000,
                  },
                  ...(i === last
                    ? []
                    : [
                        {
                          cue: 'REST',
                          at: AT.REST,
                          dur: 0.6,
                          ease: 'inOut',
                          opacity: 0.4,
                        },
                      ]),
                ],
              } satisfies CanvasElement,
            ],
      ),
      {
        type: 'rect',
        ...ring,
        r: 20,
        fill: 'none',
        stroke: 'accent',
        width: 3,
        enter: 'draw',
        cue: 'REST',
        at: AT.REST,
        dur: 0.7,
      } satisfies CanvasElement,
    ],
  };
}
