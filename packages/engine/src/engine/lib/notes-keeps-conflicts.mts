import { protectedSource } from './targets.mjs';

import { readDecisions, readKeeps, type Author } from './notes-model.mjs';

import type { CutReport } from './recording-cut.mjs';

import type { KeepConflict } from './notes-keeps-contracts.mjs';

/**
 * Keeps a planned cut would break, before anything is cut. `plans` are dry-run reports (each
 * beat entry lists the transcript words it removes and, for a whole beat, the recording it
 * played). `words` breaks on any protected word; `voice` on any protected recording when the
 * agent decided the cut (a person's own cut keeps the voice). An override counts only when it
 * was passed and the person recorded it.
 */
export function keepConflicts(
  root: string,
  plans: Pick<CutReport, 'beats'>[],
  { by, overrides = [] }: { by?: Author | null; overrides?: string[] } = {},
): KeepConflict[] {
  const { words, spans } = plannedRemovals(plans);
  const granted = new Set(
    readDecisions(root)
      .filter((d) => d.action === 'override' && d.role === 'human')
      .map((d) => d.scope?.keep),
  );
  const out: KeepConflict[] = [];
  for (const k of readKeeps(root).filter(
    (x) => x.active && ['voice', 'words'].includes(x.what),
  )) {
    if (overrides.includes(k.id) && granted.has(k.id)) continue;
    if (k.what === 'voice' && by?.role === 'human') continue;
    const prot = protectedSource(
      root,
      k.revision,
      k.scope.film ? null : (k.scope.beats ?? null),
    );
    const hit = Object.entries(prot)
      .filter(
        ([, p]) =>
          p.words.some((i) => words.has(i)) ||
          (k.what === 'voice' &&
            p.spans.some(([c, d]) => spans.some(([a, b]) => a < d && b > c))),
      )
      .map(([id]) => id);
    if (hit.length) out.push({ keep: k, beats: hit });
  }
  return out;
}

export function plannedRemovals(plans: Pick<CutReport, 'beats'>[]) {
  const words = new Set<number>(),
    spans: number[][] = [];
  for (const plan of plans)
    for (const p of plan.beats ?? []) {
      for (const i of p.indices ?? []) words.add(i);
      if (p.removal) spans.push(p.removal.samples);
      for (const s of p.pieces ?? []) spans.push(s);
    }
  return { words, spans };
}
