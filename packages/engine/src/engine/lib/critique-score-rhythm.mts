import type { ScoreContext } from './critique-score-context.mjs';

export function scoreRhythm(ctx: ScoreContext): void {
  const { beats, shots, tell } = ctx;
  // 8. An edit set by the voice alone: every beat speaks and every shot is the same length.
  const durs = shots.map((x) => x.dur).filter((d) => d > 0);
  const mean = durs.reduce((a, b) => a + b, 0) / Math.max(1, durs.length);
  const spread =
    Math.sqrt(
      durs.reduce((a, d) => a + (d - mean) ** 2, 0) / Math.max(1, durs.length),
    ) / (mean || 1);
  if (shots.length >= 4 && beats.every((b) => b.vo) && spread < 0.3)
    tell(
      'An edit set by the voice alone',
      'every shot speaks and runs about the same length. Vary the rhythm: quick cuts into a long hold, a silent beat before the payoff, a short button at the end.',
    );
}
