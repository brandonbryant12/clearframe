import type { CritiqueContext } from './critique-contracts.mjs';
import { CONNECTOR } from './critique-common.mjs';

export function checkStory(ctx: CritiqueContext) {
  const { timing, beats, add } = ctx;
  // Story links: "and then" chains.
  let chain: string[] = [];
  for (const b of beats.filter((x) => x.vo)) {
    if (CONNECTOR.test(b.vo ?? '')) chain = [];
    else chain.push(b.id);
    if (chain.length === 4)
      add(
        'idea',
        `${chain[0]}…${chain[3]}`,
        'Four beats in a row without a but/so/because. Link beats causally (but… therefore…) or the film becomes a list.',
      );
  }
  // A question opens a loop wherever it falls in the line ("Why did…? The audit flagged it.").
  const questions = beats.filter((b) => /\?(\s|$)/.test(b.vo ?? '')).length;
  if (timing.duration > 45 && !questions)
    add(
      'idea',
      'film',
      'No question is ever asked. Open a loop early (a question, a mystery, a flash-forward) and close it at the peak.',
    );
}
