import type { VerdictState } from './qa-verdict-state.mjs';
import { reportHeader } from './qa-report-header.mjs';
import { reportWords } from './qa-report-words.mjs';
import { reportLength } from './qa-report-length.mjs';
import { reportIssues } from './qa-report-issues.mjs';
export function verdictLines(state: VerdictState): string[] {
  return [
    ...reportHeader(state),
    ...reportWords(state),
    ...reportLength(state),
    ...reportIssues(state),
  ];
}
