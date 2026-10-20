import type { CanvasElement, FrameSize, Rect } from '../types.mjs';
import {
  round,
  tall,
  cue,
  num,
  axesFor,
  axisElements,
  pathOf,
  HALO,
} from './shared.mjs';
import { decodeEstimate } from './specs.mjs';
/** A seeded normal sample (Box–Muller on a small LCG), so a simulation is the same every render. */
function normals(seed: number, n: number) {
  let s = seed >>> 0 || 1;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  return Array.from(
    { length: n },
    () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()),
  );
}

/**
 * estimate: {value?: 0, spread?: 1, bias?: 0, count?: 8–60, seed?, label?, meanLabel?, trueLabel?, box?,
 *   show?: {say|at, dur}, band?: true, gather?: {say|at, dur}}
 * Simulated measurements of one quantity (value + spread × standard normal, independent, seeded):
 * each arrives in order; the average so far is drawn as a line, with a band of ±1 standard error
 * (spread/√n, for these independent samples with a known spread) that narrows as n grows. It is not
 * a confidence guarantee, and more samples shrink only random error, never bias. On gather the same
 * dots slide into a dot histogram: the spread of outcomes. `bias` centres the samples that far from
 * the true value (in the value's units): the average settles just as calmly, in the wrong place.
 */
export function estimateElements(
  input: unknown,
  frame: Partial<FrameSize> = {},
): CanvasElement[] {
  const spec = decodeEstimate(input);
  const mu = spec.value ?? 0,
    sd = spec.spread ?? 1,
    bias = spec.bias ?? 0,
    n = Math.max(8, Math.min(60, Math.round(spec.count ?? 32)));
  num(mu, 'estimate.value');
  num(bias, 'estimate.bias');
  if (!(sd > 0)) throw new Error('estimate.spread must be above 0');
  // The samples' centre: the true value, unless the sampling is biased.
  const c = mu + bias,
    z = normals(spec.seed ?? 7, n),
    xs = z.map((v) => c + sd * v);
  const means = xs.map(
    (_, i) => xs.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1),
  );
  const T = tall(frame),
    gather = spec.gather != null;
  const box = spec.box ?? estimateBox(T, gather);
  const A = axesFor(
    frame,
    box,
    [0.5, n + 0.5],
    [Math.min(mu, c) - 3.2 * sd, Math.max(mu, c) + 3.2 * sd],
  );
  const show = cue(spec.show, 0.8),
    showDur = spec.show?.dur ?? 4;
  const els: CanvasElement[] = [
    ...axisElements(A, {
      xLabel: spec.label ?? 'Each measurement',
      yLabel: null,
    }),
  ];
  // Labels are drawn last, over the dots.
  const labels: CanvasElement[] = [];
  if (spec.trueLabel) {
    els.push({
      type: 'line',
      x1: A.bx,
      y1: A.Y(mu),
      x2: A.bx + A.bw,
      y2: A.Y(mu),
      stroke: 'ink',
      width: 3,
      dash: [6, 12],
      opacity: 0.7,
      enter: 'draw',
      at: 0.4,
      dur: 0.8,
    });
    labels.push(
      // Under the line at the right end, where the band has narrowed (the average's label sits above);
      // above it when a biased average settles below.
      {
        type: 'text',
        text: spec.trueLabel,
        x: A.bx + A.bw - 10,
        y: bias < 0 ? A.Y(mu) - 26 : A.Y(mu) + A.size + 22,
        size: A.size,
        font: 'semibold',
        fill: 'ink',
        anchor: 'end',
        shadow: HALO,
        enter: 'fade',
        at: 0.6,
      },
    );
  }
  if (spec.band !== false) {
    const up = means.map((m, i) => [
        A.X(i + 1),
        A.Y(m + sd / Math.sqrt(i + 1)),
      ]),
      down = means
        .map((m, i) => [A.X(i + 1), A.Y(m - sd / Math.sqrt(i + 1))])
        .reverse();
    els.push({
      type: 'poly',
      points: [...up, ...down],
      closed: true,
      fill: 'accent',
      opacity: 0.18,
      enter: 'wipe',
      ...show,
      dur: showDur,
    });
  }
  els.push({
    type: 'path',
    d: pathOf(means.map((m, i) => [A.X(i + 1), A.Y(m)])),
    fill: 'none',
    stroke: 'accent',
    width: 7,
    cap: 'round',
    join: 'round',
    enter: 'wipe',
    ...show,
    dur: showDur,
  });
  // Bins for the gathered histogram: to the right of the plot, one row per bin of width spread/2.
  // Bins sit beside the value axis on both frame shapes, so a dot keeps its height when it gathers.
  const binW = sd / 2,
    r = T ? 9 : 11,
    gap = 2 * r + 4;
  const hx = A.bx + A.bw + (T ? 40 : 120);
  const counts: Record<number, number> = {};
  const dots: CanvasElement[] = xs.map((v, i) => {
    const cx = A.X(i + 1),
      cy = A.Y(v);
    const bin = Math.round((v - c) / binW),
      k = (counts[bin] = (counts[bin] ?? 0) + 1) - 1;
    const tx = hx + 30 + k * gap,
      ty = A.Y(c + bin * binW);
    return {
      type: 'circle',
      cx,
      cy,
      r,
      fill: 'accent2',
      opacity: 0.9,
      enter: 'pop',
      dur: 0.2,
      ...(spec.gather
        ? {
            keys: [
              {
                ...cue(spec.gather, showDur + 2),
                ...(spec.gather.say != null
                  ? { after: round(i * 0.025 * 100) / 100 }
                  : {}),
                x: tx - cx,
                y: ty - cy,
                dur: spec.gather.dur ?? 1.2,
                ease: 'smooth',
              },
            ],
          }
        : {}),
    };
  });
  els.push({
    type: 'group',
    enter: 'none',
    ...show,
    stagger: round((showDur / n) * 100) / 100,
    children: dots,
  });
  els.push(...labels);
  if (spec.meanLabel)
    els.push({
      type: 'text',
      text: spec.meanLabel,
      x: A.X(n) - 10,
      y: A.Y(means[means.length - 1]) - 34,
      size: A.size,
      font: 'semibold',
      fill: 'accent',
      anchor: 'end',
      shadow: HALO,
      enter: 'fade',
      ...(show.say != null
        ? { say: show.say, after: showDur }
        : { at: show.at + showDur }),
      dur: 0.5,
    });
  els.push({
    type: 'text',
    text: 'Simulated',
    x: A.bx + 20,
    y: A.by + 10,
    size: Math.round(A.size * 0.8),
    font: 'mono',
    fill: 'muted',
    enter: 'fade',
    at: 0.4,
  });
  return els;
}

function estimateBox(tallFrame: boolean, gather: boolean): Rect {
  if (tallFrame) return gather ? [110, 470, 600, 1000] : [130, 470, 830, 1000];
  return gather ? [200, 200, 1080, 640] : [220, 200, 1480, 640];
}
