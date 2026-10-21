import { loadRevision, latestRevision } from './revisions.mjs';
import { parseTime, anchorAt, addKeep, releaseKeep, KEEPS } from './notes.mjs';

import { writeReviewPage } from './review-page.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { list, who } from './review-command-common.mjs';
export async function keepCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o, opts, positionals } = ctx;

  if (o.release) {
    const by = who(o, { need: 'keep --release' });
    const k = releaseKeep(dir, o.release, { by, said: o.said });
    writeReviewPage(dir);
    return console.log(`${k.id} (${k.what}) released by ${by.name}.`);
  }

  const what = positionals[1];

  if (!KEEPS.includes(what)) throw new Error(`keep what? ${KEEPS.join(' | ')}`);

  const by = who(o, { need: 'keep' });

  if (by.role !== 'human' && !o.reason)
    throw new Error('An agent keep needs --reason.');

  let beats = list(o.beats);

  const rev = o.rev ?? latestRevision(dir)?.id;

  if (!rev) throw new Error('No revision yet: render a draft or run snapshot.');

  const { timeline } = loadRevision(dir, checkId('revision', rev));

  if (opts.at != null) {
    const a = anchorAt(timeline, opts.at, {
      to: o.to != null ? parseTime(o.to) : undefined,
    });
    beats = a.beats;
  }

  if (o.chapter)
    beats = timeline.beats
      .filter((b) => b.chapter === o.chapter)
      .map((b) => b.id);

  const k = addKeep(dir, {
    what,
    beats: what === 'look' ? null : beats,
    revision: rev,
    by,
    said: o.said ?? o.reason,
  });

  writeReviewPage(dir);

  return console.log(
    `${k.id}: keep ${what} for ${k.scope.film ? 'the whole film' : (k.scope.beats ?? []).join(', ')} (from ${rev}). ${what === 'voice' ? 'The recording or take stays; cuts only when the person asks for them.' : ''}`,
  );
}
