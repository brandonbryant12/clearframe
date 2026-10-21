import { fail, fieldsOf, numberOr } from '../fields.mjs';
import type { Fields } from '../fields.mjs';
import { isRecord } from '../../engine/lib/errors.mjs';
import { findWord } from '../../engine/lib/timing.mjs';

import type { LayerCue, PlanTimingBeat } from '../types.mjs';
import { SLUG } from './contracts.mjs';
import type { PlanBuild } from './contracts.mjs';
import { beatCue, addLayer, hasHeading } from './layers.mjs';

/** A cue in one of the stage's beats ({beat, say|at}), on the stage's clock. */
export function beatOffset(
  b: PlanBuild,
  span: readonly PlanTimingBeat[],
  t0: number,
  value: Fields,
): number {
  const beat = value.beat;
  const tb = b.ctx.timing.beats.find((x) => x.id === beat);
  if (!tb || !span.includes(tb))
    throw new Error(`cue names beat ${String(beat)}, outside the stage`);
  return (
    tb.start -
    t0 +
    (value.say != null
      ? beatCue(tb)(value.say)
      : numberOr(value.at, 0, 'cue', 'at'))
  );
}

/** The first beat of the span whose narration has the word, on the stage's clock. */
export function spokenIn(
  span: readonly PlanTimingBeat[],
  t0: number,
  value: unknown,
): number {
  for (const tb of span) {
    const t = findWord(tb.vo?.words ?? [], String(value));
    if (t != null) return Math.max(0, t - t0);
  }
  throw new Error(
    `spoken cue "${String(value)}" is not in the stage's narration (${span.map((x) => x.id).join(', ')})`,
  );
}

/** A film stage's clock: seconds from its first beat, a word of any beat it spans, or {beat, say|at}. */
export function filmCue(
  b: PlanBuild,
  span: readonly PlanTimingBeat[],
  t0: number,
  frames: number,
): LayerCue {
  return (value, fallback = 0) => {
    if (value == null) return fallback;
    if (typeof value === 'number') {
      if (!(value >= 0 && value < frames / b.fps))
        throw new Error(`cue ${value} s lies outside the stage`);
      return value;
    }
    if (isRecord(value) && value.beat) return beatOffset(b, span, t0, value);
    return spokenIn(span, t0, value);
  };
}

/** Film stages: one layer across beats, on its own clock from the first beat's start. */
export function filmStages(b: PlanBuild): void {
  const { sb, timing, job } = b.ctx;
  for (const [i, raw] of (sb.stages ?? []).entries()) {
    const where = `stages[${i}]`;
    const s = fieldsOf(raw);
    if (typeof s.id !== 'string' || !SLUG.test(s.id))
      fail(where, 'needs an id (a slug)');
    const to = s.to ?? s.from;
    const [first, last] = [
      job.beats.find((x) => x.id === s.from),
      job.beats.find((x) => x.id === to),
    ];
    const [firstTiming, lastTiming] = [
      timing.beats.find((x) => x.id === s.from),
      timing.beats.find((x) => x.id === to),
    ];
    if (!first || !last || !firstTiming || !lastTiming)
      return fail(where, 'from and to must name beats');
    if (last.start_frame < first.start_frame)
      fail(where, 'to comes before from');
    const start = first.start_frame,
      frames = last.start_frame + last.frames - start;
    const t0 = start / b.fps;
    const span = timing.beats.filter(
      (x) =>
        x.start >= firstTiming.start - 1e-9 && x.end <= lastTiming.end + 1e-9,
    );
    // The stage itself is everything but its identity and span.
    const spec: Fields = Object.fromEntries(
      Object.entries(s).filter(([k]) => !['id', 'from', 'to'].includes(k)),
    );
    addLayer(b, {
      id: `stage:${s.id}`,
      spec,
      start,
      frames,
      z: spec.z ?? 'under',
      cue: filmCue(b, span, t0, frames),
      where,
      fade: [0, 0],
      heading: span.some((x) =>
        hasHeading(sb.beats.find((y) => y.id === x.id)),
      ),
      motion: job.motion,
    });
  }
}
