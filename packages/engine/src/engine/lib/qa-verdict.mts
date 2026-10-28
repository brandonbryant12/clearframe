import type { QaResult } from './qa-contracts.mjs';
import { errorMessage } from './errors.mjs';
import type { MotionVerdict, VerdictOutcome } from './qa-assessment.mjs';
import { verdictState } from './qa-verdict-state.mjs';
import { verdictLines } from './qa-verdict-lines.mjs';
export function motionVerdict(
  dir: string,
  q: QaResult,
  { warnings = [] }: { warnings?: string[] } = {},
): MotionVerdict {
  const state = verdictState(dir, q, warnings);
  return {
    share: state.share,
    typeShare: state.typeShare,
    ready: state.ready,
    lines: verdictLines(state),
    assessment: state.assessment,
  };
}

/**
 * The verdict, or why it could not be measured. Callers report an unavailable verdict as such:
 * a film whose motion was not measured is not ready, and is never quietly treated as if it were.
 */
export function verdictOutcome(
  dir: string,
  q: QaResult,
  options: { warnings?: string[] } = {},
): VerdictOutcome {
  try {
    return { status: 'measured', verdict: motionVerdict(dir, q, options) };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: errorMessage(error).split('\n')[0] ?? 'unknown error',
    };
  }
}
