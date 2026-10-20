import { required } from '.././drawing/contracts.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import { SAMPLES } from './common.mjs';
import type { holdLayout } from './layout.mjs';

export function holdTiming(context: ReturnType<typeof holdLayout>) {
  const { falls, AT, T, pts } = context;

  // The market is drawn in phases, each on its own moment: the wander (just after LOCK), the
  // climb (RISE) and the slide (FALL). `tip(i)` is when the line's tip reaches sample i.
  const iA = Math.round(T.A * SAMPLES),
    iB = Math.round(T.B * SAMPLES);

  const phases = [
    { cue: 'LOCK', from: 0, to: iA, delay: 0.35, dur: 0.95, len: [0] },
    {
      cue: 'RISE',
      from: iA,
      to: iB,
      delay: 0,
      dur: falls ? 1.5 : 1.8,
      len: [0],
    },
    ...(falls
      ? [{ cue: 'FALL', from: iB, to: SAMPLES, delay: 0, dur: 1.5, len: [0] }]
      : []),
  ];

  for (const p of phases) {
    p.len = [0];
    for (let i = p.from + 1; i <= p.to; i++)
      p.len.push(
        required(p.len.at(-1), 'phase length') +
          Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
      );
  }

  const phaseOf = (i: number) =>
    phases.find((p) => i > p.from && i <= p.to) ?? phases[0];

  const tip = (i: number) => {
    const p = phaseOf(i);
    return {
      cue: p.cue,
      dt: round(
        p.delay +
          (p.dur * p.len[i - p.from]) / required(p.len.at(-1), 'phase length'),
      ),
    };
  };

  // (Keys are made fresh for each element: filling a sketch rewrites them in place.)
  const recede = (opacity = 0.4) => ({
    cue: 'END',
    at: round(AT.END + 0.2),
    after: 0.2,
    dur: 0.6,
    opacity,
  });
  return { ...context, falls, AT, T, pts, iA, iB, phases, tip, recede };
}
