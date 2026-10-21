import { snapshot } from './revisions.mjs';

import { writeReviewPage } from './review-page.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';

export async function snapshotCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const { revision, created } = await snapshot(dir, {
    kind: 'snapshot',
    label: o.label,
    reason: o.reason,
  });

  writeReviewPage(dir);

  return console.log(
    created
      ? `Saved ${revision.id} (no video; render to watch it).`
      : `Nothing changed since ${revision.id}.`,
  );
}
