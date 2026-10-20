import path from 'node:path';
import { round } from '../util.mjs';
import { nextId, withLock, writeJSONAtomic } from '../store.mjs';
import { isRecorded, logEdit, readEdits, wasOf } from '../recording-model.mjs';
import { rebuild, spanFrames } from '../recording-slices.mjs';

import { context, recordedMeta } from '../recording-context.mjs';
import type {
  AuthoredBeat,
  EditEntry,
  RecordedMeta,
} from '../recording-model.mjs';
import type { EditContext } from '../recording-select.mjs';

import { transcriptShare } from './split.mjs';
import { AGENT } from './contracts.mjs';
import type { ByOption } from './contracts.mjs';

export function mergedSlice(
  ctx: EditContext,
  a: RecordedMeta,
  b: RecordedMeta,
): RecordedMeta {
  const spf = ctx.src.rate / ctx.fps;
  const [a0, a1] = spanFrames(a, ctx.fps),
    [b0, b1] = spanFrames(b, ctx.fps);
  if (b0 < a1) throw new Error('These beats overlap on the recording.');
  const meta = structuredClone(a);
  const removed = [...(a.source.removed ?? []), ...(b.source.removed ?? [])];
  // Recording between them that no beat plays (a beat cut whole) stays out.
  if (b0 > a1)
    removed.push({
      id: 'gap',
      kind: 'gap',
      words: '',
      samples: [a1 * spf, b0 * spf],
      pad: 0,
      from: round(a1 / ctx.fps, 6),
      to: round(b0 / ctx.fps, 6),
    });
  const aw = transcriptShare(a, 'the first beat'),
    bw = transcriptShare(b, 'the second beat');
  if (aw[1] > bw[0]) throw new Error('These beats share transcript words.');
  meta.source = {
    ...meta.source,
    span: [a0, b1],
    end: b.source.end,
    words: [aw[0], bw[1]],
    removed,
  };
  if (b.alignment?.kind !== 'measured')
    meta.alignment = { ...meta.alignment, kind: 'estimated' };
  return meta;
}

/** Merge two adjacent recorded beats into the first; the second's picture is dropped. */
export function mergeBeats(
  root: string,
  { beats: [first, second] }: { beats: string[] },
  { by = AGENT }: ByOption = {},
): EditEntry {
  return withLock(root, () => {
    const ctx = context(root),
      sb = ctx.sb;
    const a = ctx.beats.find((y) => y.b.id === first),
      b = ctx.beats.find((y) => y.b.id === second);
    if (!a || !b) throw new Error(`No beat ${!a ? first : second}.`);
    if (b.index !== a.index + 1)
      throw new Error(`${first} and ${second} are not adjacent.`);
    if (!isRecorded(a.meta) || !isRecorded(b.meta))
      throw new Error('Both beats must replay the recording.');
    if ((a.b.speaker ?? null) !== (b.b.speaker ?? null))
      throw new Error('A beat has one speaker; these differ.');
    const meta = mergedSlice(ctx, recordedMeta(a), recordedMeta(b));
    const { text } = rebuild(
      root,
      first,
      meta,
      ctx.src,
      ctx.transcript,
      ctx.fps,
    );
    const merged: AuthoredBeat = {
      ...a.b,
      vo: text,
      was: [...new Set([...(wasOf(a.b) ?? []), first, second])],
    };
    sb.beats.splice(a.index, 2, merged);
    writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
    const dropped = { [second]: b.b };
    const entry: EditEntry = {
      id: nextId(
        'm',
        readEdits(root).map((e) => e.id),
      ),
      op: 'merge',
      beats: [first, second],
      into: first,
      by,
      dropped,
    };
    logEdit(root, entry);
    return entry;
  });
}
