import { mergeBeats } from './recording.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { who } from './review-command-common.mjs';
export async function mergeCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o, positionals } = ctx;

  const ids = positionals.slice(1, 3);

  if (ids.length !== 2) throw new Error('merge needs two adjacent beat ids.');

  const r = mergeBeats(dir, { beats: ids }, { by: who(o) });

  return console.log(
    `${ids.join(' + ')} → ${r.into} (the picture of ${ids[1]} is kept in review/edits.jsonl, not on screen).`,
  );
}
