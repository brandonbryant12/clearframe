import type { ScoreContext } from './critique-score-context.mjs';

export function scoreHeadings(ctx: ScoreContext): void {
  const { beats, tell } = ctx;
  const n = beats.length;
  // 3. Headings on every scene.
  // A heading at the bottom is still a heading: a chart with a caption under it reads as a slide.
  const headed = beats.filter(
    (b) =>
      b.props?.title &&
      !['title', 'endcard', 'chapter'].includes(b.block ?? ''),
  ).length;
  if (headed / n > 0.4)
    tell(
      'A heading on every scene',
      `${headed} of ${n} scenes carry a heading. Let the picture and the voice say it: a chart fills the frame and a narration-cued note (chart.note, or a callout cued with say) points at the finding; keep titles for chapters.`,
    );
}
