import type { VerdictState } from './qa-verdict-state.mjs';

import { evidenceLine } from './evidence.mjs';
import { unavailableLine } from './qa-assessment.mjs';
export function reportHeader(state: VerdictState): string[] {
  const { q, s, voicedHeld, overflow, share, said } = state;
  return [
    `motion: ${status(state)} · ${s.changePerSecond} change/s; still under the voice ${Math.round(10 * (voicedHeld + overflow)) / 10} s of ${s.seconds} s (${share}%${declaredHolds(state)}): ${said}.`,
    ...(q.evidence
      ? [`  ${evidenceLine(q.evidence)}`]
      : ['  evidence: not recorded (this QA result predates bound evidence)']),
    ...unavailableLine(state.assessment),
    ...(overflow
      ? [
          `  holds: ${s.deliberateSeconds} s are declared as reading holds (pace: "hold"), more than a fifth of the film; ${overflow} s of them count as still. A reading hold is for a figure or a step that must be read, not a way past this check.`,
        ]
      : []),
  ];
}

function status({ ready, unbound, evidence }: VerdictState): string {
  if (ready) return 'READY';
  return `NOT READY${unbound ? ` (${evidence.scope} evidence)` : ''}`;
}
function declaredHolds({ s, overflow }: VerdictState): string {
  if (!s.deliberateSeconds) return '';
  return `; ${s.deliberateSeconds} s more declared as reading holds${overflow ? `, ${overflow} s of them over budget and counted above` : ''}`;
}
