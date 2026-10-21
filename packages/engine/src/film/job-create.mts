import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobReport, JobResult, JobBeat } from './types.mjs';

import { type JobCast } from './job-types.mjs';

import { messageOf } from './guards.mjs';

import { retired } from './constants.mjs';

import { captionCues } from '../engine/lib/timing.mjs';
import { filmSettings } from './job-settings.mjs';
import { prepareBeat } from './job-beat.mjs';
import { resolveTargets } from './job-targets.mjs';
import { mirrorExitStyles } from './job-exits.mjs';
import { linkMorphs } from './job-morphs.mjs';
import { linkCasts } from './job-casts.mjs';
import { linkWorlds } from './job-worlds.mjs';
import { linkInto } from './job-into.mjs';
import { frameChrome } from './job-chrome.mjs';
import { fitGraphicTransitions } from './job-transitions.mjs';
import { filmWarnings } from './job-warnings.mjs';

/** Build the job; errors block rendering, warnings are advice (drafts demote some errors). */
export function createJob(
  sb: Storyboard,
  timing: Timing,
  { draft = false } = {},
): JobResult {
  const report: JobReport = { errors: [], warnings: [], draft };
  const film = filmSettings(sb, timing, report);
  // A retired film-wide transition is reported once, here; its beats fall back to a fade.
  const filmRetired = retired('transition', sb.transition);
  if (filmRetired) report.errors.push(filmRetired);
  const transitions = timing.beats.map((b) => {
    // A film-wide transition never applies to the first frame: the film opens on its picture.
    // A film cuts unless told otherwise: a dip between every line is a deck of slides. A beat
    // that names an element to go `into` takes that transition.
    if (sb.beats[b.index].into != null) return 'into';
    let t =
      sb.beats[b.index].transition ??
      (b.index === 0 || filmRetired ? 'cut' : (sb.transition ?? 'cut'));
    if (t === 'auto')
      t =
        b.index && timing.beats[b.index - 1].chapter !== b.chapter
          ? 'fade'
          : 'cut';
    return t;
  });
  const captions = captionCues(timing);
  const beats: JobBeat[] = [];
  // A cast's objects and where each beat left them, handed to the next beat that names the cast.
  const cast: JobCast = {};
  for (const b of timing.beats) {
    try {
      beats.push(
        prepareBeat(b, {
          sb,
          timing,
          film,
          transitions,
          captions,
          report,
          cast,
        }),
      );
    } catch (e) {
      report.errors.push(`${b.id}: ${messageOf(e)}`);
    }
  }
  resolveTargets(beats, timing, report);
  mirrorExitStyles(beats);
  linkMorphs(beats, sb, timing, report);
  linkCasts(beats, sb, timing, report, cast);
  linkWorlds(beats, sb, timing, report);
  linkInto(beats, sb, timing, report);
  const frame = frameChrome(sb, beats, report);
  fitGraphicTransitions(beats, timing, report);
  filmWarnings(sb, timing, film.theme, report);
  // A beat that failed to prepare is already reported; the timeline gap it leaves is not a second problem.
  if (
    beats.length === timing.beats.length &&
    (beats.some((b) => b.frames < 1) ||
      beats.reduce((n, b) => n + b.frames, 0) !== timing.frames)
  )
    report.errors.push(
      'Every beat must span at least one frame and cover the complete timeline.',
    );
  const job = {
    version: 2,
    title: timing.title,
    width: timing.width,
    height: timing.height,
    fps: timing.fps,
    frames: timing.frames,
    theme: film.theme,
    motion: film.motion,
    backdrop: film.backdrop,
    chrome: sb.chrome === true,
    captions: film.captions,
    caption_style: film.captionStyle,
    ...(film.texture && film.texture !== 'none'
      ? { texture: film.texture }
      : {}),
    text_motion: film.textMotion,
    ...(film.type ? { type: film.type } : {}),
    ...(frame ? { frame } : {}),
    beats,
  };
  return { job, errors: report.errors, warnings: report.warnings };
}
