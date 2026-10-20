import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';

export function finalCheckpoint(state: CheckpointState): Checkpoint {
  const { timing, final } = state;
  return {
    id: 'final',
    name: 'Final',
    ask: true,
    // The final encode of the film as it is now, with measured words, that someone said yes to.
    done: final.closed && !timing.estimated,
    decision: final.closed ? (final.human ?? final.agent) : null,
    detail:
      timing.estimated && final.state === 'current'
        ? 'rendered with an estimated voice'
        : final.detail,
    question: 'Watch the final: ship it?',
  };
}
