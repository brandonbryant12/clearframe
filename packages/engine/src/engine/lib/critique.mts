import { loadStoryboard } from './project.mjs';
import { computeTiming } from './timing.mjs';
import { createJob } from '../../film/job.mjs';
import { roughStandIns } from '../../film/prepare.mjs';
import { errorMessage } from './errors.mjs';
import type { CastCarry } from '../../film/cast.mjs';
import type {
  CritiqueContext,
  CritiqueFinding,
} from './critique-contracts.mjs';
import { asDrawn } from './critique-draw.mjs';
import { withStages, family } from './critique-common.mjs';
import { filmScore } from './critique-score.mjs';
import { checkSource } from './critique-source.mjs';
import { checkPalette } from './critique-palette.mjs';
import { checkHook } from './critique-hook.mjs';
import { checkSameness } from './critique-sameness.mjs';
import { checkGeometry } from './critique-geometry.mjs';
import { checkImagery } from './critique-imagery.mjs';
import { checkTransitions } from './critique-transitions.mjs';
import { checkBeats } from './critique-beats.mjs';
import { checkStory } from './critique-story.mjs';
import { checkVoice } from './critique-voice.mjs';
import { checkDataset } from './critique-dataset.mjs';
export { withStages } from './critique-common.mjs';
export { filmScore } from './critique-score.mjs';
export { pictureFor } from './pictures.mjs';
/**
 * The critique, never a bare TypeError: an unexpected shape the checks below did not foresee (a list
 * written as one word) reports the storyboard's own errors, which `createJob` names, and the failure.
 */
export function critique(root: string) {
  try {
    return critiqueStoryboard(root);
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    const findings: CritiqueFinding[] = [];
    try {
      const sb = loadStoryboard(root),
        timing = computeTiming(root);
      const job = createJob(sb, timing, { draft: true });
      for (const x of job.errors ?? [])
        findings.push({ level: 'error', where: 'check', message: x });
    } catch (x) {
      findings.push({
        level: 'error',
        where: 'check',
        message: errorMessage(x),
      });
    }
    findings.push({
      level: 'error',
      where: 'critique',
      message: `stopped on a storyboard shape it did not expect (${e.message}); fix the errors above, then run critique again`,
    });
    return {
      summary: {
        film: 0,
        beats: 0,
        seconds: 0,
        families: 0,
        drawn: 0,
        imaged: 0,
        graphicTransitions: 0,
        tones: 0,
        warnings: 0,
        ideas: 0,
        errors: findings.length,
      },
      findings,
    };
  }
}

function critiqueStoryboard(root: string) {
  const sb = loadStoryboard(root),
    timing = computeTiming(root),
    castCarry: CastCarry = {},
    beats = withStages(
      sb,
      sb.beats.map((b) => asDrawn(b, sb.format, castCarry)),
    ),
    out: CritiqueFinding[] = [];
  const add: CritiqueContext['add'] = (level, where, message) =>
    out.push({ level, where, message });
  const t = timing.beats;
  const ctx: CritiqueContext = { root, sb, timing, beats, t, add };
  // What `check` would refuse comes first: a storyboard that cannot render has no score.
  let job: { errors?: string[]; warnings?: string[] };
  try {
    // Declared placeholders and unfinished elements are judged as a rough cut shows them, and
    // listed as unmade.
    const ready = roughStandIns(
      root,
      structuredClone(sb),
      structuredClone(timing),
      { rough: true },
    );
    job = createJob(ready.sb, ready.timing, { draft: true });
    for (const p of ready.placeholders)
      add(
        'idea',
        p.beat,
        `placeholder: ${p.reason}. Fine for a rough cut; author it before the final.`,
      );
    for (const u of ready.unfinished)
      add(
        'idea',
        u.beat,
        `${u.element} is marked unfinished${u.note ? ` (${u.note})` : ''}. Finish it before the final.`,
      );
  } catch (e) {
    job = { errors: [errorMessage(e)] };
  }
  for (const e of job.errors ?? []) add('error', 'check', e);
  for (const w of job.warnings ?? []) add('warn', 'check', w);
  checkSource(ctx);
  checkPalette(ctx);
  checkHook(ctx);
  checkSameness(ctx);
  checkGeometry(ctx);
  const { drawn, imaged } = checkImagery(ctx);
  const { transitions, graphic, tones } = checkTransitions(ctx);
  checkBeats(ctx);
  checkStory(ctx);
  checkVoice(ctx);
  checkDataset(ctx);
  const film = filmScore(sb, beats, t, transitions);
  for (const tell of film.tells)
    add('idea', 'film', `${tell.name}: ${tell.fix}`);
  const summary = {
    film: film.score,
    beats: beats.length,
    seconds: +timing.duration.toFixed(1),
    families: [...new Set(beats.map(family))].length,
    drawn,
    imaged,
    graphicTransitions: graphic,
    tones,
    warnings: out.filter((x) => x.level === 'warn').length,
    ideas: out.filter((x) => x.level === 'idea').length,
  };
  return { summary, findings: out };
}
