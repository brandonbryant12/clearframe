import type { QaResult } from './qa-contracts.mjs';
import { verdictState } from './qa-verdict-state.mjs';
import { verdictLines } from './qa-verdict-lines.mjs';
export function motionVerdict(
  dir: string,
  q: QaResult,
  { warnings = [] }: { warnings?: string[] } = {},
) {
  const state = verdictState(dir, q, warnings);
  return {
    share: state.share,
    typeShare: state.typeShare,
    ready: state.ready,
    lines: verdictLines(state),
  };
}
