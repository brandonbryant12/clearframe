import {
  loadRevision,
  impact,
  lineageOf,
  workingTimeline,
  latestRevision,
} from './revisions.mjs';
import { checkKeeps } from './notes.mjs';

import { readEdits } from './recording.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { printImpact, json } from './review-command-common.mjs';
export async function diffCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o, positionals } = ctx;

  const [a, b] = positionals.slice(1);

  const from = a
    ? loadRevision(dir, checkId('revision', a))
    : (() => {
        const latest = latestRevision(dir);
        if (!latest) throw new Error('No revisions yet.');
        return loadRevision(dir, latest.id);
      })();

  let B, lineage;

  if (!b || b === 'working') {
    B = (await workingTimeline(dir)).timeline;
    lineage = lineageOf(from.timeline, B, readEdits(dir));
  } else {
    const x = loadRevision(dir, checkId('revision', b));
    B = x.timeline;
    lineage =
      x.meta.parent === from.meta.id
        ? x.meta.lineage
        : lineageOf(from.timeline, B, readEdits(dir));
  }

  const r = impact(from.timeline, B, {
    lineage,
    from: from.meta.id,
    to: b ?? 'working',
  });

  const keeps = !b || b === 'working' ? checkKeeps(dir, B) : [];

  if (o.json) return json({ ...r, keeps });

  return console.log(
    printImpact(r) +
      (keeps.length
        ? `\nKeeps broken:\n${keeps.map((k) => `  ${k.keep} (${k.what}): ${k.message}`).join('\n')}`
        : ''),
  );
}
