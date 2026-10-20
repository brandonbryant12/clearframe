import type { CastStage, CastStep, CastPose } from './contracts.mjs';

export function drawThread(
  stage: CastStage,
  step: CastStep,
  targets: Map<string, CastPose>,
): void {
  const { spec, frame, size, words, notes, until } = stage;
  const { f, k, t, stagger, dur } = step;

  const pts = [...targets.entries()]
    .map(([, p], i) => ({ ...p, settle: t + i * stagger + dur }))
    .filter((p) => (p.opacity ?? 1) > 0);
  const segments = pts.slice(1).map((b, j) => ({
    a: pts[j],
    b,
    at: Math.max(b.settle, pts[j].settle, t + dur + j * 0.12),
  }));
  const last = segments.at(-1)?.at ?? 0;
  if (frame.duration && last + 0.35 > frame.duration - 0.1)
    notes.push(
      `the thread of formation ${k + 1} (${f.form}${f.say ? ` on "${f.say}"` : ''}) would finish ${(last + 0.35 - frame.duration).toFixed(2)} s after the beat ends, so it is left out; cue the formation earlier or add tail`,
    );
  else {
    segments.forEach(({ a, b, at }, j) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1,
        inset = (size * 0.5 + 14) / d;
      words.push({
        type: 'line',
        id: `cast-thread-${k}-${j + 1}`,
        x1: a.x + (b.x - a.x) * inset,
        y1: a.y + (b.y - a.y) * inset,
        x2: b.x - (b.x - a.x) * inset,
        y2: b.y - (b.y - a.y) * inset,
        stroke: 'ink',
        width: spec.look === 'drawn' ? 4 : 3,
        cap: 'round',
        ...(spec.look === 'drawn' ? { rough: { amount: 1.2, passes: 2 } } : {}),
        at,
        enter: 'draw',
        dur: 0.35,
        ...(until(k) != null ? { exitAt: until(k), exit: 'fade' } : {}),
      });
    });
    if (until(k) == null)
      stage.carried = words
        .filter((w) => w.id?.startsWith(`cast-thread-${k}-`))
        .map(({ type, x1, y1, x2, y2, stroke, width, cap, rough }) => ({
          type,
          x1,
          y1,
          x2,
          y2,
          stroke,
          width,
          cap,
          ...(rough ? { rough } : {}),
        }));
  }
}
