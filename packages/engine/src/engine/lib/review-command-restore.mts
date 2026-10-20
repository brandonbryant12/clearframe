import { type Verification, restoreRevision } from './edit-loop.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { list, who, json } from './review-command-common.mjs';
export async function restoreCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o, positionals } = ctx;

  const rev = checkId('revision', positionals[1] ?? '');

  const by = who(o);

  if (by.role === 'human' && !o.said)
    throw new Error('restore --by NAME needs --said "their words".');

  if (by.role === 'agent' && !o.reason)
    throw new Error('restore --agent needs --reason.');

  const r = await restoreRevision(dir, {
    revision: rev,
    beats: list(o.beats),
    by: by.name,
    said: o.said ?? o.reason,
    role: by.role,
    shared: !!o.shared,
  });

  if (r.verified?.state === 'differs') process.exitCode = 1;

  if (o.json) return json(r);

  if (r.unchanged)
    return console.log(
      `The working copy already is ${rev}'s content; nothing was restored.`,
    );

  const v = r.verified;

  return console.log(
    [
      `restored ${r.restored.join(', ')} from ${rev}; the state before is ${r.restorePoint}, the restored state is ${r.now}. Undo with restore DIR ${r.restorePoint}.`,
      ...(r.aside ?? []).map(
        (a) => `  moved aside: ${a.file} → ${a.to} (${a.why})`,
      ),
      ...(r.alsoChanged ?? []).map(
        (a) => `  also changed ${a.file}, used by ${a.beats.join(', ')}`,
      ),
      ...(v ? [verificationLine(rev, v)] : []),
    ].join('\n'),
  );
}

function verificationLine(rev: string, v: Verification): string {
  if (v.state === 'exact')
    return `  verified: exactly ${rev}'s inputs, renderer and fonts`;
  if (v.state === 'inputs')
    return `  verified: ${rev}'s inputs; renderer ${v.renderer}, fonts ${v.fonts}: frames may differ from the original render`;
  const changes = [
    v.missing && `missing ${v.missing.join(', ')}`,
    v.extra && `extra ${v.extra.join(', ')}`,
    v.changed && `changed ${v.changed.join(', ')}`,
    `look ${v.look}`,
  ]
    .filter(Boolean)
    .join('; ');
  return `  NOT the same as ${rev}: ${v.error ?? changes}`;
}
