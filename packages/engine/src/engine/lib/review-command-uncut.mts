import { uncut } from './recording.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { who } from './review-command-common.mjs';
export async function uncutCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const r = uncut(dir, { id: o.cut, beat: o.beat }, { by: who(o) });

  return console.log(
    `${r.id}: restored ${(r.beats ?? []).join(', ') || 'nothing'} from the recording (undid ${(Array.isArray(r.of) ? r.of : [r.of]).join(', ')}).`,
  );
}
