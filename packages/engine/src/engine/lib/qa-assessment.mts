// What a motion verdict did and did not assess. The verdict's readiness is derived from these
// checks, so the record and the READY line cannot disagree. A check that could not run is
// `unavailable` with its reason, a check that does not apply is `skipped` with its reason, and
// neither is a pass. Receipt identity coverage (`evidence.coverage`) says which identity checks
// ran; it is not a judgement of picture, sound or meaning, and `unassessed` names the claims no
// automated check here answers. Human acceptance is recorded only by `accept`.
import * as Schema from 'effect/Schema';

export const AssessmentCheckStatusSchema = Schema.Literals([
  'passed',
  'findings',
  'skipped',
  'unavailable',
]);
export type AssessmentCheckStatus = typeof AssessmentCheckStatusSchema.Type;

export const AssessmentCheckSchema = Schema.Struct({
  id: Schema.String,
  question: Schema.String,
  status: AssessmentCheckStatusSchema,
  /** True when this check's result is one reason the film is not ready. */
  blocking: Schema.Boolean,
  findings: Schema.optionalKey(Schema.Int),
  reason: Schema.optionalKey(Schema.String),
});
export type AssessmentCheck = typeof AssessmentCheckSchema.Type;

export const EvidenceScopeSchema = Schema.Literals([
  'bound',
  'unbound',
  'stale',
  'invalid',
]);
export const IdentityCoverageSchema = Schema.Literals([
  'none',
  'partial',
  'full',
]);

export const AssessmentSchema = Schema.Struct({
  version: Schema.Literal(1),
  identity: Schema.Struct({
    scope: EvidenceScopeSchema,
    /** Which receipt identity checks ran; not a measure of picture, sound or meaning. */
    coverage: IdentityCoverageSchema,
    unchecked: Schema.Array(Schema.String),
  }),
  sampling: Schema.Struct({
    frames: Schema.Int,
    fps: Schema.Number,
    /** The grid every decoded frame was analysed at, smaller than the delivery size. */
    width: Schema.optionalKey(Schema.Int),
    height: Schema.optionalKey(Schema.Int),
  }),
  checks: Schema.Array(AssessmentCheckSchema),
  unassessed: Schema.Array(Schema.String),
});
export type Assessment = typeof AssessmentSchema.Type;

export const MotionVerdictSchema = Schema.Struct({
  ready: Schema.Boolean,
  /** Percent of the film the picture sits still under the voice. */
  share: Schema.Number,
  /** Percent of the film that is type on its own. */
  typeShare: Schema.Number,
  lines: Schema.Array(Schema.String),
  assessment: AssessmentSchema,
});
export type MotionVerdict = typeof MotionVerdictSchema.Type;

/** A verdict that was measured, or the reason it could not be: never an implied pass. */
export const VerdictOutcomeSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal('measured'),
    verdict: MotionVerdictSchema,
  }),
  Schema.Struct({
    status: Schema.Literal('unavailable'),
    reason: Schema.String,
  }),
]);
export type VerdictOutcome = typeof VerdictOutcomeSchema.Type;

/** The result of an auxiliary measurement that may not apply or may fail. */
export type Measured<T> =
  | { readonly status: 'ran'; readonly value: T }
  | { readonly status: 'skipped'; readonly reason: string }
  | { readonly status: 'unavailable'; readonly reason: string };

export const UNASSESSED = [
  'whether a viewer takes away the intended point (a person, with the blind review page)',
  'listening: intelligibility, balance and intended quiet (loudness and peak are measured, not heard)',
  'factual accuracy of figures, labels and quotes against the source material',
  'acceptance (recorded only by `accept`, with the person and their words)',
] as const;

export function check(
  id: string,
  question: string,
  outcome:
    | { status: 'passed' }
    | { status: 'findings'; findings: number; blocking: boolean }
    | { status: 'skipped' | 'unavailable'; reason: string },
): AssessmentCheck {
  switch (outcome.status) {
    case 'passed':
      return { id, question, status: 'passed', blocking: false };
    case 'findings':
      return {
        id,
        question,
        status: 'findings',
        blocking: outcome.blocking,
        findings: outcome.findings,
      };
    default:
      return {
        id,
        question,
        status: outcome.status,
        blocking: false,
        reason: outcome.reason,
      };
  }
}

/** A measurement's findings as a check; its own skip or failure reason when it did not run. */
export function measuredCheck<T>(
  id: string,
  question: string,
  measured: Measured<readonly T[]>,
  blocking: boolean,
): AssessmentCheck {
  if (measured.status !== 'ran') return check(id, question, measured);
  return measured.value.length
    ? check(id, question, {
        status: 'findings',
        findings: measured.value.length,
        blocking,
      })
    : check(id, question, { status: 'passed' });
}

/** Runs an auxiliary measurement; a throw is reported as unavailable, never as no findings. */
export function measure<T>(
  run: () => T | null,
  { skipped }: { skipped: string },
): Measured<T> {
  try {
    const value = run();
    return value === null
      ? { status: 'skipped', reason: skipped }
      : { status: 'ran', value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'unavailable', reason: message.split('\n')[0] };
  }
}

export function findingsOf<T>(measured: Measured<readonly T[]>): T[] {
  return measured.status === 'ran' ? [...measured.value] : [];
}

/** One line naming checks that could not run; empty when every check ran or deliberately skipped. */
export function unavailableLine(assessment: Assessment): string[] {
  const missing = assessment.checks.filter((c) => c.status === 'unavailable');
  if (!missing.length) return [];
  return [
    `  not assessed: ${missing.map((c) => `${c.id} (${c.reason})`).join('; ')}. A check that could not run is not a pass.`,
  ];
}
