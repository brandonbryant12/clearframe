import type { ScoreContext } from './critique-score-context.mjs';
import type { CritiqueBeat } from './critique-contracts.mjs';

export function scoreCards(ctx: ScoreContext): void {
  const { beats, tell } = ctx;
  const n = beats.length;
  // 10. Cards, not shots: type and charts on a plain field, with no place or picture behind.
  const TYPE_CARDS = [
    'title',
    'statement',
    'endcard',
    'chapter',
    'kinetic',
    'quote',
    'stat',
    'kpis',
    'bars',
    'line',
    'waffle',
    'ring',
    'delta',
    'compare',
    'list',
    'checklist',
    'magnitude',
  ];
  const card = (b: CritiqueBeat) =>
    !b.plate &&
    !b.art?.under?.length &&
    !b.props?.world &&
    !b.props?.plates &&
    (TYPE_CARDS.includes(b.block ?? '') ||
      (b.block === 'canvas' &&
        b.props?.chart &&
        !(b.props.elements ?? []).some((el) => el.type !== 'text')));
  const cards = beats.filter(card).length;
  if (cards / n >= 0.5)
    tell(
      'Slides with motion',
      `${cards} of ${n} scenes are type or a chart on a plain field. Put the numbers and words in the film's place: a chart in front of the world it describes (art.under), in a world the camera travels, or over a plate.`,
    );
  const last = beats.at(-1);
  if (last && card(last))
    tell(
      'Ends on a card',
      `the film ends on ${last.block === 'endcard' ? 'an end card' : 'a type card'}. End on the picture (the place, the subject, the world changed) with the last line over it.`,
    );
}
