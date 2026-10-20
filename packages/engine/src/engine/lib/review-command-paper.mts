import { paperEdit } from './paper.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { rel } from './review-command-common.mjs';
export async function paperCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const r = paperEdit(dir, { suggest: !!o['suggest-cuts'] });

  return console.log(
    `${rel(r.file)} (${r.beats} beats${r.suggestions != null ? `, ${r.suggestions} suggested cut(s), none applied` : ''})`,
  );
}
