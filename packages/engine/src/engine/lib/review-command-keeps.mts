import { readKeeps } from './notes.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { json } from './review-command-common.mjs';
export async function keepsCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const keeps = readKeeps(dir);

  if (o.json) return json(keeps);

  return console.log(
    keeps.length
      ? keeps
          .map(
            (k) =>
              `${k.id} ${k.active ? 'active  ' : 'released'} ${k.what.padEnd(8)} ${k.scope.film ? 'whole film' : (k.scope.beats ?? []).join(', ')}  (${k.by?.name ?? k.by?.role}${k.said ? `: “${k.said}”` : ''})`,
          )
          .join('\n')
      : 'Nothing pinned.',
  );
}
