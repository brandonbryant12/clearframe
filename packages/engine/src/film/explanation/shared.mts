import type {
  CanvasElement,
  FrameSize,
  Point,
  Rect,
  Timed,
} from '../types.mjs';
import type { FunctionSpec } from './specs.mjs';
// Visual explanation primitives: canvas props that draw an idea as a picture that changes, computed
// exactly from a stated formula or a seeded simulation, and cued to the voice. Informed by the
// explanatory grammar of Manim (3b1b/manim, MIT) — value trackers on graphs, area as accumulation,
// vector fields — but written independently for ClearFrame's canvas; no Manim code is used here.
//
//   graph       an input moves through a function; a point rides the curve and both axes follow
//   accumulate  small amounts under a rate curve lift and stack into the total they make
//   estimate    noisy measurements arrive; their running average settles and its band narrows
//   field       a flow field: arrows show the push everywhere, particles follow it
//
// Each returns plain canvas elements (lines, paths, dots, type), so they combine with everything
// else a canvas beat draws, and `place` can make any of them a panel of a board.

export const round = (v: number) => Math.round(v * 10) / 10;
export const tall = (frame: Partial<FrameSize>) =>
  (frame.height ?? 1080) > (frame.width ?? 1920) * 1.1;
export const cue = (c: Timed | undefined, fallback: number): ResolvedCue =>
  c?.say != null ? { say: c.say } : { at: c?.at ?? fallback };
export const num = (v: number, name: string) => {
  if (!Number.isFinite(v)) throw new Error(`${name} must be a number`);
  return v;
};

/** The function families a graph or a rate can follow: name → (params) → f(x). */
export const FUNCTIONS = {
  linear:
    ({ m = 1, b = 0 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      m * x + b,
  // a·x^p; a domain where that is not a real number (a negative base, a fractional p) is refused.
  power:
    ({ a = 1, p = 2 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      a * x ** p,
  exponential:
    ({ a = 1, k = 1 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      a * Math.exp(k * x),
  logistic:
    ({ L = 1, k = 1, x0 = 0 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      L / (1 + Math.exp(-k * (x - x0))),
  saturating:
    ({ L = 1, k = 1 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      L * (1 - Math.exp(-k * x)),
  log:
    ({ a = 1, k = 1 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      a * Math.log(1 + k * x),
  // An M/M/1 queue in steady state (random arrivals, one server, random service times) at
  // utilisation ρ = x, 0 ≤ ρ < 1: number in system ρ/(1−ρ) (waiting plus being served), number
  // waiting ρ²/(1−ρ), or time in system 1/(1−ρ) in units of the mean service time.
  queue: ({ measure = 'inSystem', a = 1 }: Omit<FunctionSpec, 'kind'>) => {
    const g = Object.entries({
      inSystem: (r: number) => r / (1 - r),
      waiting: (r: number) => (r * r) / (1 - r),
      time: (r: number) => 1 / (1 - r),
    }).find(([name]) => name === measure)?.[1];
    if (!g) throw new Error('queue.measure is inSystem, waiting or time');
    return (x: number) => (x >= 0 && x < 1 ? a * g(x) : NaN);
  },
  wave:
    ({ A = 1, period = 1, phase = 0 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      A * Math.sin((2 * Math.PI * x) / period + phase),
  bell:
    ({ mu = 0, sigma = 1 }: Omit<FunctionSpec, 'kind'>) =>
    (x: number) =>
      Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)),
  constant:
    ({ c = 1 }: Omit<FunctionSpec, 'kind'>) =>
    () =>
      c,
};
export function fnOf(
  spec: FunctionSpec | number,
  name: string,
): (x: number) => number {
  if (typeof spec === 'number') return () => spec;
  const make = Object.entries(FUNCTIONS).find(
    ([name]) => name === spec.kind,
  )?.[1];
  if (!make)
    throw new Error(
      `${name}.kind must be one of ${Object.keys(FUNCTIONS).join(', ')}`,
    );
  return make(spec);
}

/** A plot area and the maps from data to frame pixels; y grows upward. */
export function axesFor(
  frame: Partial<FrameSize>,
  box: Rect | undefined,
  [x0, x1]: Point,
  [y0, y1]: Point,
) {
  const T = tall(frame);
  const [bx, by, bw, bh] =
    box ?? (T ? [130, 520, 830, 900] : [260, 170, 1300, 720]);
  if (!(x1 > x0) || !(y1 > y0))
    throw new Error('domains run from a smaller to a larger number');
  const X = (x: number) => round(bx + ((x - x0) / (x1 - x0)) * bw),
    Y = (y: number) => round(by + bh - ((y - y0) / (y1 - y0)) * bh);
  const fromX = (px: number) => x0 + ((px - bx) / bw) * (x1 - x0);
  return { bx, by, bw, bh, X, Y, fromX, size: T ? 40 : 34 };
}
/** A soft halo in the background colour, so a label reads over dots, bands and curves. */
export const HALO = { dx: 0, dy: 0, blur: 6, opacity: 1, color: 'bg' };
export function axisElements(
  A: Axes,
  {
    xLabel,
    yLabel,
    at = 0,
  }: { xLabel?: string; yLabel?: string | null; at?: number },
): CanvasElement[] {
  const { bx, by, bw, bh, size } = A,
    base = by + bh;
  return [
    {
      type: 'line',
      x1: bx,
      y1: base,
      x2: bx + bw + 30,
      y2: base,
      stroke: 'muted',
      width: 4,
      arrow: 'end',
      enter: 'draw',
      at,
      dur: 0.6,
    },
    {
      type: 'line',
      x1: bx,
      y1: base,
      x2: bx,
      y2: by - 30,
      stroke: 'muted',
      width: 4,
      arrow: 'end',
      enter: 'draw',
      at,
      dur: 0.6,
    },
    ...(xLabel
      ? [
          {
            type: 'text' as const,
            text: xLabel,
            x: bx + bw,
            y: base + size * 1.6,
            size,
            font: 'semibold',
            fill: 'muted',
            anchor: 'end',
            enter: 'fade',
            at: at + 0.3,
          },
        ]
      : []),
    ...(yLabel
      ? [
          {
            type: 'text' as const,
            text: yLabel,
            x: bx + 18,
            y: by - 50,
            size,
            font: 'semibold',
            fill: 'muted',
            enter: 'fade',
            at: at + 0.3,
          },
        ]
      : []),
  ];
}
export const samples = (
  f: (x: number) => number,
  [a, b]: Point,
  n = 120,
): Point[] =>
  Array.from({ length: n + 1 }, (_, i): Point => {
    const x = a + ((b - a) * i) / n;
    return [x, f(x)];
  });
export const pathOf = (pts: Point[]) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
export const autoDomain = (ys: number[]): Point => {
  const lo = Math.min(0, ...ys),
    hi = Math.max(...ys);
  const pad = (hi - lo || 1) * 0.08;
  return [lo, hi + pad];
};

export type Axes = ReturnType<typeof axesFor>;
export type ResolvedCue =
  | { say: string; at?: never }
  | { at: number; say?: never };
