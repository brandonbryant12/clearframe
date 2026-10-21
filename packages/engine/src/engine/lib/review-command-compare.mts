import { compareRevisions } from './edit-loop.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { rel, printImpact, json } from './review-command-common.mjs';
export async function compareCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o, positionals } = ctx;

  const [a, b] = positionals.slice(1);

  if (!a) throw new Error('compare needs a revision: compare DIR r003 [r004]');

  const r = await compareRevisions(dir, {
    from: a,
    to: b,
    handles: o.handles == null ? 2 : Number(o.handles),
  });

  if (o.json) return json(r);

  return console.log(`${printImpact(r.report)}\ncompare page: ${rel(r.page)}`);
}
