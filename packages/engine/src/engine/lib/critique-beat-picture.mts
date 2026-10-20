import { pictureFor } from './pictures.mjs';

import type { BeatCheckContext } from './critique-contracts.mjs';
export function beatPicture(ctx: BeatCheckContext): void {
  const { sb, add, b, i } = ctx;
  // Type standing in for a picture: say which fill-in-the-blank picture fits its words.
  const authoredBeat = sb.beats[i];
  if (
    ['kinetic', 'statement', 'callout', 'list', 'checklist'].includes(
      authoredBeat?.block ?? '',
    ) &&
    !authoredBeat.plate
  ) {
    const fit = pictureFor(authoredBeat.vo ?? '');
    if (fit)
      add(
        'idea',
        b.id,
        fit.sketch
          ? `${fit.why}: the \`${fit.sketch}\` sketch shows that (clearframe sketch ${fit.sketch} prints the beat to paste). Words on their own read as a slide.`
          : `${fit.why}: show it with ${fit.use}. Words on their own read as a slide.`,
      );
  }
}
