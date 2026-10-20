import { splitBeat } from './recording.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { who } from './review-command-common.mjs';
export async function splitCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  if (!o.beat || !o.before)
    throw new Error(
      'split needs --beat ID --before "first words of the second part"',
    );

  const r = splitBeat(
    dir,
    {
      beat: o.beat,
      at: o.before,
      nth: o.nth == null ? undefined : Number(o.nth),
    },
    { by: who(o) },
  );

  return console.log(
    `${o.beat} → ${(Array.isArray(r.into) ? r.into : [r.into]).join(' + ')} (both keep its picture; give the second its own).`,
  );
}
