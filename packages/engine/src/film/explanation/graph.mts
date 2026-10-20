import type { CanvasElement, FrameSize } from '../types.mjs';
import {
  cue,
  num,
  fnOf,
  axesFor,
  axisElements,
  samples,
  pathOf,
  autoDomain,
} from './shared.mjs';
import { graphSweep } from './graph-sweep.mjs';
import { graphMarks } from './graph-marks.mjs';
import { decodeGraph } from './specs.mjs';
/**
 * graph: {fn: {kind, …params}, x: {domain:[a,b], label}, y?: {domain, label}, box?,
 *   draw?: {say|at, dur}, sweep?: {from, to, say|at, dur}, marks?: [{x, label, say|at}]}
 */
export function graphElements(
  input: unknown,
  frame: Partial<FrameSize> = {},
): CanvasElement[] {
  const spec = decodeGraph(input);
  const f = fnOf(spec.fn, 'graph.fn'),
    [x0, x1] = spec.x?.domain ?? [0, 1];
  num(x0, 'graph.x.domain');
  num(x1, 'graph.x.domain');
  const pts = samples(f, [x0, x1]);
  const kind = typeof spec.fn === 'number' ? 'constant' : spec.fn.kind;
  const hint =
    kind === 'queue' ? ' (an M/M/1 queue needs 0 ≤ utilisation < 1)' : '';
  if (pts.some(([, y]) => !Number.isFinite(y)))
    throw new Error(
      `graph.fn (${kind}) is not a finite real number over x.domain ${x0}–${x1}${hint}`,
    );
  const A = axesFor(
    frame,
    spec.box,
    [x0, x1],
    spec.y?.domain ?? autoDomain(pts.map((p) => p[1])),
  );
  const drawAt = cue(spec.draw, 0.5),
    drawDur = spec.draw?.dur ?? 1.4;
  const els: CanvasElement[] = [
    ...axisElements(A, { xLabel: spec.x?.label, yLabel: spec.y?.label }),
    {
      type: 'path',
      d: pathOf(pts.map(([x, y]) => [A.X(x), A.Y(y)])),
      fill: 'none',
      stroke: 'accent',
      width: 8,
      cap: 'round',
      enter: 'draw',
      ...drawAt,
      dur: drawDur,
    },
  ];
  if (spec.sweep)
    els.push(...graphSweep(spec.sweep, f, A, [x0, x1], drawAt, drawDur));
  els.push(...graphMarks(spec.marks ?? [], f, A));
  return els;
}
