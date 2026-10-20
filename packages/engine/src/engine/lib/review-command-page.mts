import { writeReviewPage } from './review-page.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { rel } from './review-command-common.mjs';
export async function pageCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const file = writeReviewPage(dir, {
    rev: o.rev ? checkId('revision', o.rev) : undefined,
  });

  return console.log(
    file ? rel(file) : 'No revisions yet: render a draft first.',
  );
}
