// The motion verdict's checks, one per reason a film can be not ready, plus the auxiliary
// measurements that inform an edit without blocking it.
import {
  check,
  measuredCheck,
  type AssessmentCheck,
  type Measured,
} from './qa-assessment.mjs';
import type { QaSummary } from './qa-contracts.mjs';

export interface CheckInputs {
  evidence: { scope: string; problems: readonly string[] };
  unbound: boolean;
  stats: { share: number; held: readonly unknown[]; overflow: number };
  typeShare: number;
  typed: number;
  blank: readonly string[];
  short: boolean;
  requested: number | undefined;
  omissions: Measured<string[]>;
  narrated: number;
  unvoiced: number;
  mute: boolean;
  placeholders: number;
  fileSources: number;
  overlaps: number;
  cast: Measured<string[]>;
  broken: number;
  summary: QaSummary;
}

const count = (n: number, blocking: boolean) =>
  n
    ? ({ status: 'findings', findings: n, blocking } as const)
    : ({ status: 'passed' } as const);

export function assessmentChecks(i: CheckInputs): AssessmentCheck[] {
  const held = i.stats.held.length + (i.stats.overflow ? 1 : 0);
  return [
    check(
      'evidence-binding',
      'Is this measurement bound to the receipt of the current render?',
      count(i.unbound ? Math.max(1, i.evidence.problems.length) : 0, true),
    ),
    check(
      'still-under-voice',
      'Does the picture sit still while the voice talks (40% or more reads as narrated slides)?',
      count(held, i.stats.share >= 40),
    ),
    check(
      'words-as-picture',
      'Is the film mostly type on its own (60% or more reads as narrated slides)?',
      count(
        i.typeShare >= 50 ? i.typed : 0,
        i.typeShare >= 60 && i.stats.share < 40,
      ),
    ),
    check(
      'blank-under-voice',
      'Does the voice talk over an empty scene?',
      count(i.blank.length, true),
    ),
    lengthCheck(i),
    measuredCheck(
      'source-omissions',
      'Which facts in the source documents does a short film never say?',
      i.omissions,
      false,
    ),
    i.narrated
      ? check(
          'narration-voiced',
          'Does narrated text have a voice?',
          count(i.unvoiced, i.mute),
        )
      : check('narration-voiced', 'Does narrated text have a voice?', {
          status: 'skipped',
          reason: 'no narration',
        }),
    check(
      'placeholders',
      'Are sketch placeholders still on screen?',
      count(i.placeholders, true),
    ),
    check(
      'source-credits',
      'Does a source line show a file name instead of a source people know?',
      count(i.fileSources, true),
    ),
    overlapsCheck(i),
    check(
      'errors-in-time',
      'Did the decoded film show errors in time (one-frame pops, jumping seams, export errors)?',
      count(i.broken, true),
    ),
    audioCheck(i.summary),
  ];
}

function lengthCheck(i: CheckInputs): AssessmentCheck {
  const question = 'Is the film at least 60% of the length asked for?';
  if (!i.requested)
    return check('requested-length', question, {
      status: 'skipped',
      reason: 'the storyboard asks for no length',
    });
  return check('requested-length', question, count(Number(i.short), true));
}

/** Overlaps found by check still count when the cast measurement itself could not run. */
function overlapsCheck(i: CheckInputs): AssessmentCheck {
  const question = 'Are objects drawn on top of each other?';
  if (!i.overlaps && i.cast.status === 'unavailable')
    return check('overlaps', question, i.cast);
  return check('overlaps', question, count(i.overlaps, true));
}

function audioCheck(summary: QaSummary): AssessmentCheck {
  const question = 'Was the delivered soundtrack metered?';
  if (!summary.audio)
    return check('delivered-audio', question, {
      status: 'skipped',
      reason: 'the film has no audio stream',
    });
  if (summary.loudness)
    return check('delivered-audio', question, { status: 'passed' });
  return check('delivered-audio', question, {
    status: 'unavailable',
    reason: 'the soundtrack could not be metered',
  });
}
