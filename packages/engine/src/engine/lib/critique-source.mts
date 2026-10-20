import {
  sourceNumbers,
  unsourcedFigures,
  authoredFigures,
} from './figures.mjs';

import type { CritiqueContext } from './critique-contracts.mjs';

export function checkSource(ctx: CritiqueContext) {
  const { root, sb, add } = ctx;
  // Figures the author typed that the source documents never state: usually an invented
  // amount to make a sketch draw money.
  const numbers = sourceNumbers(root);
  if (numbers)
    for (const b of sb.beats) {
      const loose = unsourcedFigures(b, numbers);
      if (loose.length)
        add(
          'warn',
          b.id,
          `${loose
            .slice(0, 4)
            .map(
              (f) =>
                `${f.text}${f.where.startsWith('sketchParams') ? ` (${f.where})` : ''}`,
            )
            .join(
              ', ',
            )} ${loose.length > 1 ? 'are' : 'is'} in no source document (${numbers.files.join(', ')}). Every figure comes from the source: take it out; if it is worked out from the source, say how in the beat's source line ("Benefits guide 2027; 26 × $6"); if it is a made-up example (a sample receipt), label it once on screen ("Example").`,
        );
    }
  // With no source document nothing can be checked: a round-14 enrollment film made with `new`
  // narrated a $3,000 the brief never states.
  if (!numbers) {
    const shown = sb.beats.flatMap((b) =>
      authoredFigures(b).map((f) => f.text),
    );
    if (shown.length >= 2)
      add(
        'warn',
        'film',
        `${shown.length} figures on screen (${[...new Set(shown)].slice(0, 4).join(', ')}…) and no source document to check them against: put the document they come from in source/ (\`start DIR --document FILE\` does it), so critique can name any figure it never states.`,
      );
  }
}
