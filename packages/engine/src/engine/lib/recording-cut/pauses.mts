import { round } from '../util.mjs';
import { nextId, withLock } from '../store.mjs';
import { isRecorded, readEdits } from '../recording-model.mjs';
import { keptWords, spanFrames } from '../recording-slices.mjs';
import { planPause } from '../recording-select.mjs';
import { context, recordedMeta } from '../recording-context.mjs';
import type { RecordedMeta } from '../recording-model.mjs';
import type { KeptWord } from '../recording-slices.mjs';
import type {
  ContextBeat,
  EditContext,
  PlannedRemoval,
} from '../recording-select.mjs';
import { AGENT } from './contracts.mjs';
import type { CutPart, EditOptions, CutReport } from './contracts.mjs';
import { apply } from './apply.mjs';

export interface PauseOptions {
  over?: number;
  keep?: number;
  beats?: string[];
}

export interface PausePlanner {
  ctx: EditContext;
  id: string;
  plan: CutPart[];
  over: number;
  keep: number;
}

export function addPause(
  p: PausePlanner,
  x: ContextBeat,
  r: PlannedRemoval | null,
  words = '',
): void {
  if (!r) return;
  const { rate } = p.ctx.src;
  p.plan.push({
    beat: x.b.id,
    removal: {
      id: p.id,
      kind: 'pause',
      words,
      samples: r.samples,
      pad: 0,
      from: round(r.samples[0] / rate, 6),
      to: round(r.samples[1] / rate, 6),
    },
    frames: (r.samples[1] - r.samples[0]) / (rate / p.ctx.fps),
    seconds: round((r.samples[1] - r.samples[0]) / rate, 3),
    indices: [],
  });
}

export const clearOf =
  (meta: RecordedMeta, rate: number) =>
  (g0: number, g1: number): boolean =>
    !(meta.source.removed ?? []).some(
      (r) => r.samples[0] / rate < g1 && r.samples[1] / rate > g0,
    );

// A pause across the cut to the next beat: take whole frames from both edges.
export function boundaryPause(
  p: PausePlanner,
  x: ContextBeat,
  next: ContextBeat | undefined,
  kept: KeptWord[],
  span: number[],
): void {
  const { ctx, over, keep } = p,
    { rate } = ctx.src;
  if (!next || next.index !== x.index + 1 || !kept.length) return;
  const meta = recordedMeta(x),
    nextMeta = recordedMeta(next);
  const nk = keptWords(nextMeta, ctx.transcript);
  if (!nk.length) return;
  const nspan = spanFrames(nextMeta, ctx.fps).map((f) => f / ctx.fps);
  if (Math.abs(span[1] - nspan[0]) > 1e-6) return;
  const last = kept[kept.length - 1];
  const tail = span[1] - last.t1,
    head = nk[0].t0 - nspan[0];
  if (tail + head <= over || !clearOf(meta, rate)(last.t1, span[1])) return;
  const frame = 1 / ctx.fps,
    want = tail + head - keep;
  const x1 =
    Math.floor(Math.min(tail - keep / 2, want / 2) / frame + 1e-9) * frame;
  const y1 =
    Math.floor(
      Math.min(head - keep / 2, want - Math.max(0, x1)) / frame + 1e-9,
    ) * frame;
  const spf = rate / ctx.fps;
  if (x1 >= frame) {
    const end = Math.round(span[1] * ctx.fps) * spf;
    addPause(p, x, {
      samples: [end - Math.round(x1 * ctx.fps) * spf, end],
      pad: 0,
    });
  }
  if (
    y1 >= frame &&
    !(nextMeta.source.removed ?? []).some((r) => r.samples[0] / rate < nk[0].t0)
  ) {
    const start = Math.round(nspan[0] * ctx.fps) * spf;
    addPause(p, next, {
      samples: [start, start + Math.round(y1 * ctx.fps) * spf],
      pad: 0,
    });
  }
}

export function planPauses(p: PausePlanner, only: string[] | undefined): void {
  const { ctx, over, keep } = p,
    { rate } = ctx.src;
  const recorded = ctx.beats.filter(
    (x) => isRecorded(x.meta) && (!only || only.includes(x.b.id)),
  );
  for (const [n, x] of recorded.entries()) {
    const meta = recordedMeta(x);
    const kept = keptWords(meta, ctx.transcript),
      span = spanFrames(meta, ctx.fps).map((f) => f / ctx.fps);
    const clear = clearOf(meta, rate);
    for (let k = 1; k < kept.length; k++)
      if (
        kept[k].t0 - kept[k - 1].t1 > over &&
        clear(kept[k - 1].t1, kept[k].t0)
      )
        addPause(
          p,
          x,
          planPause(kept[k - 1].t1, kept[k].t0, keep, { rate, fps: ctx.fps }),
        );
    boundaryPause(p, x, recorded[n + 1], kept, span);
  }
}

/** Shorten every pause longer than `over` seconds to about `keep` (inside and between beats). */
export function tightenPauses(
  root: string,
  { over = 1.2, keep = 0.5, beats: only }: PauseOptions = {},
  { by = AGENT, note, dryRun = false }: EditOptions = {},
): CutReport {
  if (!(over > keep && keep >= 0.1))
    throw new Error(
      '--pauses-over must exceed --keep, and keep at least 0.1 s.',
    );
  return withLock(root, () => {
    const ctx = context(root),
      id = nextId(
        'c',
        readEdits(root).map((e) => e.id),
      );
    const planner: PausePlanner = { ctx, id, plan: [], over, keep };
    planPauses(planner, only);
    const plan = planner.plan;
    const report: CutReport = {
      id,
      op: 'pauses',
      words: '',
      over,
      keep,
      beats: plan,
      frames: plan.reduce((s, p) => s + p.frames, 0),
      seconds: round(plan.reduce((s, p) => s + p.frames, 0) / ctx.fps, 3),
    };
    if (dryRun || !plan.length) return report;
    apply(root, ctx, report, { by, note });
    return report;
  });
}
