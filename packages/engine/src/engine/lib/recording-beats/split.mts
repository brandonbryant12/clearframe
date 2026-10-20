import fs from 'node:fs';
import path from 'node:path';
import { round } from '../util.mjs';
import { nextId, withLock, writeJSONAtomic } from '../store.mjs';
import {
  isRecorded,
  logEdit,
  metaPath,
  readEdits,
} from '../recording-model.mjs';
import { keptWords, rebuild, spanFrames } from '../recording-slices.mjs';
import { findPhrase } from '../recording-select.mjs';
import { context } from '../recording-context.mjs';
import type {
  AuthoredBeat,
  EditEntry,
  RecordedMeta,
} from '../recording-model.mjs';
import type { EditContext } from '../recording-select.mjs';

import { AGENT } from './contracts.mjs';
import type { ByOption } from './contracts.mjs';

// The frame boundary nearest the middle of the pause, staying inside it when one exists.
export function splitFrame(g0: number, g1: number, fps: number): number {
  let f = Math.round(((g0 + g1) / 2) * fps);
  if (f / fps < g0 && Math.ceil(g0 * fps - 1e-9) / fps <= g1)
    f = Math.ceil(g0 * fps - 1e-9);
  if (f / fps > g1 && Math.floor(g1 * fps + 1e-9) / fps >= g0)
    f = Math.floor(g1 * fps + 1e-9);
  return f;
}

export function freshIds(
  root: string,
  ctx: EditContext,
  beat: string,
): string[] {
  const taken = new Set(ctx.sb.beats.map((b) => b.id));
  const fresh = (base: string): string => {
    for (let n = 0; ; n++) {
      const id = `${base}${n ? n + 1 : ''}`;
      if (!taken.has(id) && !fs.existsSync(metaPath(root, id))) {
        taken.add(id);
        return id;
      }
    }
  };
  return [fresh(`${beat}a`), fresh(`${beat}b`)];
}

export function transcriptShare(meta: RecordedMeta, beat: string): number[] {
  const words = meta.source.words;
  if (!words)
    throw new Error(
      `${beat} has no share of source/words.json; re-ingest the recording.`,
    );
  return words;
}

/** Split a recorded beat before a word (in the pause before it, on a frame boundary). */
export function splitBeat(
  root: string,
  { beat, at, nth }: { beat: string; at: string; nth?: number },
  { by = AGENT }: ByOption = {},
): EditEntry {
  return withLock(root, () => {
    const ctx = context(root),
      sb = ctx.sb;
    const x = ctx.beats.find((y) => y.b.id === beat);
    if (!x) throw new Error(`No beat ${beat}.`);
    if (!isRecorded(x.meta))
      throw new Error(
        `${beat} does not replay the recording; edit its vo text instead.`,
      );
    const source = x.meta;
    const kept = keptWords(source, ctx.transcript).map((w, k) => ({
      ...w,
      beat,
      k,
    }));
    const [k] = findPhrase(kept, at, { nth });
    if (k === 0) throw new Error('Split before a word that is not the first.');
    const { rate } = ctx.src,
      spf = rate / ctx.fps,
      [f0, f1] = spanFrames(source, ctx.fps);
    const f = splitFrame(kept[k - 1].t1, kept[k].t0, ctx.fps);
    if (!(f > f0 && f < f1))
      throw new Error('No frame boundary to split at between those words.');
    if (
      (source.source.removed ?? []).some(
        (r) => r.samples[0] < f * spf && r.samples[1] > f * spf,
      )
    )
      throw new Error('That pause was cut; split elsewhere or uncut it first.');
    const ids = freshIds(root, ctx, beat);
    // Transcript words before the split frame stay with the first part (cut ones included).
    const share = transcriptShare(source, beat);
    let split = share[0];
    while (
      split < share[1] &&
      (ctx.transcript.words[split].t0 + ctx.transcript.words[split].t1) / 2 <
        f / ctx.fps
    )
      split++;
    const authored: AuthoredBeat = x.b;
    const { id: _drop, was: _was, ...rest } = authored;
    const ranges: [number, number, number[]][] = [
      [f0, f, [share[0], split]],
      [f, f1, [split, share[1]]],
    ];
    const parts: AuthoredBeat[] = ranges.map(([a, b, w], n) => {
      const meta = structuredClone(source);
      meta.source = {
        ...meta.source,
        span: [a, b],
        start: round((meta.source.offset ?? 0) + a / ctx.fps, 4),
        end: round((meta.source.offset ?? 0) + b / ctx.fps, 4),
        words: w,
        removed: (meta.source.removed ?? []).filter(
          (r) => r.samples[0] >= a * spf && r.samples[1] <= b * spf,
        ),
      };
      const { text } = rebuild(
        root,
        ids[n],
        meta,
        ctx.src,
        ctx.transcript,
        ctx.fps,
      );
      return { id: ids[n], ...rest, vo: text, was: [beat] };
    });
    sb.beats.splice(x.index, 1, ...parts);
    writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
    const entry: EditEntry = {
      id: nextId(
        'p',
        readEdits(root).map((e) => e.id),
      ),
      op: 'split',
      beat,
      into: ids,
      by,
    };
    logEdit(root, entry);
    return entry;
  });
}
