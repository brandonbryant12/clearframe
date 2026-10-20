import type {
  ChangeStatus,
  ImpactReport,
  Timeline,
} from './revisions-model.mjs';
import {
  type ImpactOptions,
  type Compare,
  MOVED,
  round,
} from './revisions-impact-common.mjs';
import {
  beatChange,
  removedChanges,
  takeChanges,
} from './revisions-impact-beats.mjs';
import { sequenceMoves } from './revisions-impact-sequence.mjs';

import { affectedPassages } from './revisions-impact-passages.mjs';
import { changeSummary } from './revisions-impact-summary.mjs';

/**
 * What changed from timeline A to B, in plain terms: beats whose own content changed, beats
 * that only look different (a neighbour's transition, a world they share, a film setting, the
 * renderer), beats that only moved in time, and beats added or removed. Conservative: a
 * shifted beat is never called unchanged, and nothing is assumed reusable.
 */
export function impact(
  A: Timeline,
  B: Timeline,
  { lineage, from = 'A', to = 'B' }: ImpactOptions = {},
): ImpactReport {
  const before = new Map(A.beats.map((b) => [b.id, b]));
  const after = new Map(B.beats.map((b) => [b.id, b]));
  const filmA = new Map(Object.entries(A.film));
  const filmB = new Map(Object.entries(B.film));
  const film: Record<string, 'same' | 'changed'> = Object.fromEntries(
    [...filmB].map(([k, v]): [string, 'same' | 'changed'] => [
      k,
      filmA.get(k) === v ? 'same' : 'changed',
    ]),
  );
  // Revisions fingerprinted by another version of ClearFrame: assume every frame may differ.
  if ((A.printScheme ?? 0) !== (B.printScheme ?? 0)) film.renderer = 'changed';
  const global = ['look', 'renderer'].filter((k) => film[k] === 'changed');
  const c: Compare = {
    A,
    B,
    before,
    after,
    global,
    worldsChanged: new Set(),
    lineage,
  };
  const beats = B.beats.map((b) => beatChange(c, b));
  const removed = removedChanges(c);
  const order = sequenceMoves(
    A.beats.map((b) => b.id),
    B.beats.map((b) => b.id),
  );
  for (const x of beats)
    if (order.moved.includes(x.id)) (x.reasons ??= []).unshift(MOVED);
  const firstShift = beats.find((x) => x.shift && Math.abs(x.shift) > 1e-6);
  const durationDelta = round(B.duration - A.duration);
  const takes = takeChanges(beats, after, B);
  const all = [...beats, ...removed];
  const counts: Partial<Record<ChangeStatus, number>> = {};
  for (const x of all) counts[x.status] = (counts[x.status] ?? 0) + 1;
  const passages = affectedPassages(A, B, all);
  const summary = changeSummary({
    B,
    film,
    global,
    order,
    counts,
    all,
    durationDelta,
    firstShift,
    takes,
  });
  return {
    from,
    to,
    film,
    durationDelta,
    order,
    beats: all,
    counts,
    takes,
    passages,
    summary,
  };
}
