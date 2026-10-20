import { round } from '../util.mjs';
import { nextId, withLock } from '../store.mjs';
import { readEdits } from '../recording-model.mjs';
import {
  keptWords,
  pieceLength,
  isPad,
  slicePieces,
  spanFrames,
} from '../recording-slices.mjs';
import { filmWords, planRemoval, select } from '../recording-select.mjs';
import {
  atomically,
  context,
  recordedMeta,
  touchedFiles,
} from '../recording-context.mjs';
import type { RecordedMeta } from '../recording-model.mjs';
import type { KeptWord } from '../recording-slices.mjs';
import type {
  ContextBeat,
  EditContext,
  FilmWord,
  Selection,
  WordPos,
} from '../recording-select.mjs';
import { AGENT } from './contracts.mjs';
import type { CutPart, EditOptions, CutReport } from './contracts.mjs';
import { apply } from './apply.mjs';

// The beat loses every word it plays: it goes whole, with all the recording it plays.
export function wholeBeat(
  ctx: EditContext,
  x: ContextBeat,
  meta: RecordedMeta,
  kept: KeptWord[],
): CutPart {
  const f = spanFrames(meta, ctx.fps);
  const pieces = slicePieces(meta, { rate: ctx.src.rate, fps: ctx.fps });
  const lost = pieces.reduce((n, p) => n + pieceLength(p), 0);
  return {
    beat: x.b.id,
    deleted: true,
    frames: lost / (ctx.src.rate / ctx.fps),
    seconds: round(lost / ctx.src.rate, 3),
    span: f,
    // What goes: every word the beat still plays and all the recording it plays.
    indices: kept.map((w) => w.index),
    pieces: pieces.flatMap((p) => (isPad(p) ? [] : [[p.from, p.to]])),
  };
}

export function beatCut(
  ctx: EditContext,
  x: ContextBeat,
  mine: FilmWord[],
  id: string,
  text: string,
): CutPart {
  const meta = recordedMeta(x);
  const kept = keptWords(meta, ctx.transcript);
  const i = mine[0].k,
    j = mine[mine.length - 1].k;
  if (i === 0 && j === kept.length - 1) return wholeBeat(ctx, x, meta, kept);
  const span = spanFrames(meta, ctx.fps);
  const r = planRemoval({
    kept,
    i,
    j,
    span,
    removed: meta.source.removed ?? [],
    rate: ctx.src.rate,
    fps: ctx.fps,
  });
  if (!r)
    throw new Error(
      `Cannot cut “${text}” in ${x.b.id} without touching the neighbouring words.`,
    );
  return {
    beat: x.b.id,
    removal: {
      id,
      kind: 'words',
      words: mine.map((w) => w.w).join(' '),
      samples: r.samples,
      pad: r.pad,
      from: round(r.samples[0] / ctx.src.rate, 6),
      to: round(r.samples[1] / ctx.src.rate, 6),
    },
    frames: (r.samples[1] - r.samples[0] - r.pad) / (ctx.src.rate / ctx.fps),
    seconds: round((r.samples[1] - r.samples[0] - r.pad) / ctx.src.rate, 3),
    indices: mine.map((w) => w.index),
  };
}

/**
 * Cut words (a phrase, a sentence) out of the recording. A beat left without words is removed
 * whole. Every change is one entry in review/edits.jsonl and can be undone with uncut.
 */
export function cutWords(
  root: string,
  sel: Selection,
  { by = AGENT, note, dryRun = false }: EditOptions = {},
): CutReport {
  return withLock(root, () => {
    const ctx = context(root),
      words = filmWords(ctx);
    const [a, b] = select(ctx, words, sel, root);
    const id = nextId('c', [...readEdits(root).map((e) => e.id)]);
    const chosen = words.slice(a, b + 1);
    const text = chosen.map((w) => w.w).join(' ');
    const plan: CutPart[] = [];
    for (const x of ctx.beats) {
      const mine = chosen.filter((w) => w.beat === x.b.id);
      if (mine.length) plan.push(beatCut(ctx, x, mine, id, text));
    }
    const frames = plan.reduce((s, p) => s + p.frames, 0);
    const report: CutReport = {
      id,
      op: 'cut',
      words: text,
      beats: plan,
      frames,
      seconds: round(frames / ctx.fps, 3),
    };
    if (dryRun) return report;
    apply(root, ctx, report, { by, note });
    return report;
  });
}

/** Transcript identities of word ranges given by position ({beat, k}, inclusive) in the film now. */
export function identitiesOf(
  root: string,
  ranges: { from: WordPos; to: WordPos }[],
): number[][] {
  const ctx = context(root),
    words = filmWords(ctx);
  return ranges.map((r) => {
    const [a, b] = select(ctx, words, { from: r.from, to: r.to }, root);
    return words.slice(a, b + 1).map((w) => w.index);
  });
}

/**
 * Several cuts as one: every selection is planned against the film as it is (a selection that
 * cannot be cut stops all of them), then applied by identity; if any fails part way, every
 * file goes back. Returns the reports, in order.
 */
export function cutAll(
  root: string,
  selections: Selection[],
  opts: EditOptions = {},
): CutReport[] {
  const plans = selections.map((sel) =>
    cutWords(root, sel, { ...opts, dryRun: true }),
  );
  if (opts.dryRun) return plans;
  const beats = plans.flatMap((p) => p.beats.map((b) => b.beat));
  return atomically(root, touchedFiles(beats, ['source/words.json']), () =>
    selections.map((sel) => cutWords(root, sel, opts)),
  );
}
