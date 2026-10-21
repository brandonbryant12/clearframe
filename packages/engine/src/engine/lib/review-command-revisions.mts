import { type RevisionMeta, listRevisions } from './revisions.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { json } from './review-command-common.mjs';
export async function revisionsCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const revs = listRevisions(dir);

  if (o.json) return json(revs);

  if (!revs.length)
    return console.log(
      'No revisions yet. Every render saves one; snapshot DIR saves the working copy.',
    );

  return console.log(
    revs
      .map((r) => {
        return `${r.id}  ${(r.createdAt ?? '').replace('T', ' ').slice(0, 16)}  ${(r.kind ?? '').padEnd(13)} ${revisionProfile(r).padEnd(9)} ${r.label ?? ''}${r.reason ? ` ${r.reason}` : ''}${r.placeholders?.length ? `  [${r.placeholders.length} placeholder(s)]` : ''}`;
      })
      .join('\n'),
  );
}

function revisionProfile(r: RevisionMeta): string {
  const video = r.videos?.find((v) => v.retained !== false);
  if (video) return video.profile ?? '—';
  if (r.videos?.length) return 'released';
  if (r.previews?.length) return 'previews';
  return '—';
}
