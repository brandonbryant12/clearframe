import type { ResolvedStoryboard, TimedBeat } from '../domain.mjs';
import type { CritiqueBeat, FilmTell } from './critique-contracts.mjs';
import type { ScoreContext } from './critique-score-context.mjs';
import { scoreShots } from './critique-score-context.mjs';
import { steadyFilm } from '../../film/job.mjs';
import { scoreContinuity } from './critique-score-continuity.mjs';
import { scoreMotion } from './critique-score-motion.mjs';
import { scoreHeadings } from './critique-score-headings.mjs';
import { scoreCamera } from './critique-score-camera.mjs';
import { scoreFraming } from './critique-score-framing.mjs';
import { scoreGrammar } from './critique-score-grammar.mjs';
import { scoreLight } from './critique-score-light.mjs';
import { scoreCards } from './critique-score-cards.mjs';
import { scoreOpening } from './critique-score-opening.mjs';
import { scoreRhythm } from './critique-score-rhythm.mjs';
export function filmScore(
  sb: ResolvedStoryboard,
  beats: CritiqueBeat[],
  timed: TimedBeat[],
  transitions: string[],
) {
  const tells: FilmTell[] = [];
  if (beats.length < 3) return { score: 100, tells };
  const ctx: ScoreContext = {
    sb,
    beats,
    timed,
    transitions,
    shots: scoreShots(beats, timed),
    steady: steadyFilm(sb),
    tell: (name, fix) => {
      tells.push({ name, fix });
    },
  };
  scoreContinuity(ctx);
  scoreMotion(ctx);
  scoreHeadings(ctx);
  scoreCamera(ctx);
  scoreFraming(ctx);
  scoreGrammar(ctx);
  scoreLight(ctx);
  scoreCards(ctx);
  scoreOpening(ctx);
  scoreRhythm(ctx);
  return { score: Math.max(0, Math.round(100 - 11 * tells.length)), tells };
}
