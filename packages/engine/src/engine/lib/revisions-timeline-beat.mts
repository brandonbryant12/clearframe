import { wasOf } from './recording-model.mjs';
import { sourceSegments } from './recording-slices.mjs';

import { isRecord } from './errors.mjs';

import type {
  BeatPrints,
  Coupling,
  JobBeat,
  SourceSegment,
  TimelineBeat,
  TimelineSource,
} from './revisions-model.mjs';
import type { TimedVoice } from '../domain.mjs';
import type {
  Recorded,
  Shared,
  BeatInputs,
} from './revisions-timeline-contracts.mjs';
import { round, list, elementIds } from './revisions-timeline-common.mjs';

export function timelineSource(
  r: Recorded,
  vo: TimedVoice,
  fps: number,
): TimelineSource {
  const { meta, transcript } = r;
  const segments = sourceSegments(meta, { rate: transcript.rate, fps });
  return {
    file: meta.source.file,
    offset: meta.source.offset ?? transcript.offset ?? 0,
    segments: segments.map((s): SourceSegment => ({
      film: [
        round(vo.start + s.at, 4),
        round(vo.start + s.at + (s.to - s.from), 4),
      ],
      source: [round(s.from, 4), round(s.to, 4)],
    })),
    removed: (meta.source.removed ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      words: r.words,
      from: r.from,
      to: r.to,
      ...(r.note ? { note: r.note } : {}),
    })),
  };
}

// What a neighbour decides about this beat, so a report can say why it looks different.
export function coupling(jb: JobBeat): Coupling {
  const props = jb.props ?? {};
  return {
    exit: jb.exit,
    continues: jb.speaker?.continues ?? null,
    handoff: !!(props.viewNext || props.viewFrom),
    morph: JSON.stringify(props.elements ?? []).includes('"morph"'),
    carried: list(props.elements).some(
      (el) => isRecord(el) && Boolean(el.carried),
    ),
  };
}

export function timelineBeat(
  s: Shared,
  { jb, i, tb, b, meta, recorded }: BeatInputs,
  beatPrints: BeatPrints,
  plannedTake: string | null,
): TimelineBeat {
  const world = jb.props?.world;
  return {
    id: jb.id,
    index: i,
    chapter: tb.chapter ?? null,
    block: b.block ?? null,
    speaker: b.speaker ?? null,
    start: tb.start,
    end: tb.end,
    startFrame: jb.start_frame,
    frames: jb.frames,
    transition: jb.transition,
    exit: jb.exit,
    world: jb.block === 'canvas' && typeof world === 'string' ? world : null,
    placeholder:
      s.ctx.placeholders?.find((p) => p.beat === jb.id)?.reason ?? null,
    visual: b.visual ?? null,
    vo: tb.vo
      ? {
          text: tb.vo.text,
          start: tb.vo.start,
          end: tb.vo.end,
          timing: tb.vo.wordTiming,
          estimated: !!tb.vo.estimated,
          provider: tb.vo.provider ?? null,
          take: meta?.take?.id ?? null,
          plannedTake: recorded ? null : plannedTake,
        }
      : null,
    words: (tb.vo?.words ?? []).map((w) => ({ w: w.w, t0: w.t0, t1: w.t1 })),
    source:
      recorded && tb.vo
        ? timelineSource(recorded, tb.vo, s.ctx.timing.fps)
        : null,
    elements: elementIds(b),
    was: wasOf(b),
    coupling: coupling(jb),
    prints: beatPrints,
  };
}
