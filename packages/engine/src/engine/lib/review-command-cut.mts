import type { Selection } from './recording-select.mjs';
import { cutWords, cutAll, tightenPauses } from './recording.mjs';

import { writeReviewPage } from './review-page.mjs';

import { checkId, withLock } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import {
  list,
  who,
  json,
  pointedSelection,
  guardKeeps,
} from './review-command-common.mjs';
export async function cutCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const by = who(o);

  const common = {
    by,
    note: o.note ? checkId('note', o.note) : undefined,
    dryRun: !!o['dry-run'],
  };

  const overrides = list(o.override) ?? [];

  // Every path plans first, checks the keeps against what the plan removes (by identity), and
  // only then cuts, holding the review lock throughout so no other edit or keep lands between
  // the check and the cut; several cuts (the paper edit) are applied all or none.
  let result;

  if (o.paper) {
    // Struck words are the person's own marks: attribute them.
    if (by.role !== 'human' && !common.dryRun)
      throw new Error('cut --paper applies a person’s marks: pass --by NAME.');
    const { paperSelections } = await import('./paper.mjs');
    const selections = paperSelections(dir, o.paper);
    if (!selections.length)
      return console.log(
        'No struck words (~~…~~) that differ from the film as it plays now.',
      );
    result = withLock(dir, () => {
      guardKeeps(
        dir,
        cutAll(dir, selections, { ...common, dryRun: true }),
        by,
        overrides,
      );
      return cutAll(dir, selections, common);
    });
  } else if (o['pauses-over'] != null) {
    const args = {
      over: Number(o['pauses-over']),
      keep: o['keep-pause'] == null ? 0.5 : Number(o['keep-pause']),
      beats: list(o.beats),
    };
    result = withLock(dir, () => {
      guardKeeps(
        dir,
        [tightenPauses(dir, args, { ...common, dryRun: true })],
        by,
        overrides,
      );
      return [tightenPauses(dir, args, common)];
    });
  } else {
    const sel = await cutSelection(ctx);
    result = withLock(dir, () => {
      guardKeeps(
        dir,
        [cutWords(dir, sel, { ...common, dryRun: true })],
        by,
        overrides,
      );
      return [cutWords(dir, sel, common)];
    });
  }

  if (!common.dryRun) writeReviewPage(dir);

  if (o.json) return json(result);

  return console.log(
    result
      .map(
        (r) =>
          `${common.dryRun ? 'would cut' : r.id} ${r.op === 'pauses' ? `pauses over ${r.over} s down to ~${r.keep} s` : `“${r.words}”`}: ${r.frames} frame(s) (${r.seconds.toFixed(2)} s) from ${r.beats.map((p) => `${p.beat}${p.deleted ? ' (whole beat)' : ''}`).join(', ') || 'nothing'}${common.dryRun ? '' : `; later beats move ${r.seconds.toFixed(2)} s earlier. Undo: uncut DIR --cut ${r.id}`}`,
      )
      .join('\n'),
  );
}

async function cutSelection(ctx: ReviewContext): Promise<Selection> {
  const { dir, o, opts } = ctx;

  if (o.words && !o.note)
    return {
      words: o.words,
      beat: o.beat,
      nth: o.nth == null ? undefined : Number(o.nth),
    };
  else if (o.sentence != null)
    return {
      beat: checkId('beat', o.beat ?? ''),
      sentence: Number(o.sentence),
    };
  else if (opts.at != null || o.note)
    return await pointedSelection(dir, o, opts);
  else
    throw new Error(
      'cut what? --words "…", --beat ID --sentence N, --at TIME, --note nNNN, --pauses-over S or --paper FILE',
    );
}
