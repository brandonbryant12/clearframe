import type { CanvasElement, Point } from '../types.mjs';
import type { FieldSpec } from './specs.mjs';
import { cue, pathOf } from './shared.mjs';
export type FieldFunction = (u: number, v: number) => Point;
export function fieldParticles(
  spec: FieldSpec,
  F: FieldFunction,
  P: FieldFunction,
  T: boolean,
): CanvasElement[] {
  const els: CanvasElement[] = [];
  // Particles: seeded starts, streamlines by RK4 in field space, drawn as faint trails and ridden.
  const n = Math.max(6, Math.min(40, Math.round(spec.particles ?? 18)));
  let s = (spec.seed ?? 3) >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const flow = cue(spec.flow, 1.2),
    dur = spec.flow?.dur ?? 4;
  for (let k = 0; k < n; k++) {
    let u = -0.95 + 1.9 * rnd(),
      v = -0.95 + 1.9 * rnd();
    if (spec.kind === 'drift') u = -0.98;
    const pts = streamline(u, v, F, P);
    if (pts.length < 3) continue;
    const d = pathOf(pts);
    els.push(
      {
        type: 'path',
        d,
        fill: 'none',
        stroke: 'accent',
        width: 3,
        opacity: 0.35,
        cap: 'round',
        enter: 'draw',
        ...flow,
        dur,
      },
      {
        type: 'circle',
        cx: pts[0][0],
        cy: pts[0][1],
        r: T ? 11 : 10,
        fill: 'accent2',
        enter: 'pop',
        ...flow,
        dur: 0.2,
        along: { d, ...flow, dur, ease: 'linear', loop: true },
      },
    );
  }
  return els;
}

function streamline(
  u: number,
  v: number,
  F: FieldFunction,
  P: FieldFunction,
): Point[] {
  const pts = [P(u, v)];
  const h = 0.02;
  for (let step = 0; step < 220; step++) {
    const k1 = F(u, v),
      k2 = F(u + (h / 2) * k1[0], v + (h / 2) * k1[1]),
      k3 = F(u + (h / 2) * k2[0], v + (h / 2) * k2[1]),
      k4 = F(u + h * k3[0], v + h * k3[1]);
    const du = (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      dv = (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    if (Math.hypot(du, dv) < 1e-4) break;
    u += du;
    v += dv;
    if (Math.abs(u) > 1 || Math.abs(v) > 1) break;
    if (step % 4 === 3) pts.push(P(u, v));
  }
  return pts;
}
