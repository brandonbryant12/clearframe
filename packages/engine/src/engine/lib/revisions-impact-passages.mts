import type { BeatChange, Passage, Timeline } from './revisions-model.mjs';
import { type Stretch, MOVED } from './revisions-impact-common.mjs';

export function flaggedStretches(B: Timeline, flagged: Set<string>): Stretch[] {
  const passages: Stretch[] = [];
  let cur: Stretch | null = null;
  for (const b of B.beats) {
    if (flagged.has(b.id)) {
      cur ??= { beats: [], before: [] };
      cur.beats.push(b.id);
    } else if (cur) {
      passages.push(cur);
      cur = null;
    }
  }
  if (cur) passages.push(cur);
  return passages;
}

// A removed beat joins the passage around where it used to be.
export function placeRemoved(
  A: Timeline,
  B: Timeline,
  passages: Stretch[],
  removed: string[],
): void {
  for (const id of removed) {
    const i = A.beats.findIndex((b) => b.id === id);
    const neighbour = [
      ...A.beats.slice(0, i).reverse(),
      ...A.beats.slice(i + 1),
    ].find((b) => B.beats.some((x) => x.id === b.id));
    let p = passages.find((q) => neighbour && q.beats.includes(neighbour.id));
    if (!p) {
      p = { beats: neighbour ? [neighbour.id] : [], before: [] };
      passages.push(p);
    }
    p.before.push(id);
  }
}

// Stretches that touch in the new timeline are one passage (a cut and the beat after it).
export function joinTouching(B: Timeline, passages: Stretch[]): void {
  const at = (id: string): number => B.beats.findIndex((b) => b.id === id);
  const order = (p: Stretch): number =>
    Math.min(...p.beats.map(at).filter((i) => i >= 0), Infinity);
  passages.sort((x, y) => order(x) - order(y));
  for (let i = 1; i < passages.length; i++) {
    const prev = passages[i - 1],
      cur = passages[i];
    const end = Math.max(...prev.beats.map(at), -Infinity);
    if (cur.beats.length && prev.beats.length && order(cur) <= end + 1) {
      prev.beats = [...new Set([...prev.beats, ...cur.beats])].sort(
        (x, y) => at(x) - at(y),
      );
      prev.before.push(...cur.before);
      passages.splice(i--, 1);
    }
  }
}

export const frameSpan = (T: Timeline, ids: string[]): number[] | null => {
  const bs = T.beats.filter((b) => ids.includes(b.id));
  return bs.length
    ? [
        Math.min(...bs.map((b) => b.startFrame)),
        Math.max(...bs.map((b) => b.startFrame + b.frames)),
      ]
    : null;
};

/**
 * Stretches of film to look at: consecutive beats that changed (content, appearance, added,
 * removed), as frame ranges in both timelines. Removed beats widen the "before" range.
 */
export function affectedPassages(
  A: Timeline,
  B: Timeline,
  changes: BeatChange[],
): Passage[] {
  const flagged = new Set(
    changes
      .filter(
        (c) =>
          !['unchanged', 'shifted'].includes(c.status) ||
          (c.reasons ?? []).includes(MOVED),
      )
      .map((c) => c.id),
  );
  const passages = flaggedStretches(B, flagged);
  placeRemoved(
    A,
    B,
    passages,
    changes.filter((c) => c.status === 'removed').map((c) => c.id),
  );
  joinTouching(B, passages);
  return passages
    .map((p) => {
      const inA = [
        ...p.beats.filter((id) => A.beats.some((b) => b.id === id)),
        ...p.before,
      ];
      const fromA = new Set(inA);
      for (const id of p.beats)
        for (const w of B.beats.find((b) => b.id === id)?.was ?? [])
          fromA.add(w);
      return {
        beats: p.beats,
        removed: p.before,
        before: frameSpan(A, [...fromA]),
        after: frameSpan(B, p.beats),
      };
    })
    .sort(
      (x, y) =>
        (x.after?.[0] ?? x.before?.[0] ?? 0) -
        (y.after?.[0] ?? y.before?.[0] ?? 0),
    );
}
