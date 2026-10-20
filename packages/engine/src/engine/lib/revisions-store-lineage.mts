import { editParts, type EditEntry } from './recording-model.mjs';

import type { Lineage, RevisionMeta, Timeline } from './revisions-model.mjs';

/** What changed in the beat list between two timelines: ids added (and from what) or removed. */
export function lineageOf(
  prev: Timeline | null | undefined,
  next: Timeline,
  edits: EditEntry[] = [],
): Lineage | null {
  if (!prev) return null;
  const before = new Set(prev.beats.map((b) => b.id)),
    after = new Set(next.beats.map((b) => b.id));
  const lineage: Lineage = { added: {}, removed: {}, merged: {} };
  for (const b of next.beats) {
    const from = (b.was ?? []).filter((id) => before.has(id) && id !== b.id);
    if (!before.has(b.id)) lineage.added[b.id] = { from };
    else if (from.length) lineage.merged[b.id] = { from };
  }
  for (const b of prev.beats) {
    if (after.has(b.id)) continue;
    const into = next.beats
      .filter((n) => (n.was ?? []).includes(b.id))
      .map((n) => n.id);
    const cut = [...edits]
      .reverse()
      .find(
        (e) =>
          e.op === 'cut' &&
          editParts(e).some((p) => p.beat === b.id && p.deleted),
      );
    lineage.removed[b.id] = into.length
      ? { into }
      : {
          deleted: true,
          ...(cut ? { by: cut.id, words: cut.words } : {}),
          text: b.vo?.text ?? null,
        };
  }
  return lineage;
}

// Edits made since the latest revision's last recorded edit.
export function editsSince(
  edits: EditEntry[],
  latest: RevisionMeta | undefined,
): EditEntry[] {
  return edits.filter(
    (e) =>
      !latest?.lastEdit ||
      edits.findIndex((x) => x.id === e.id) >
        edits.findIndex((x) => x.id === latest.lastEdit),
  );
}
