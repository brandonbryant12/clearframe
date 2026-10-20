import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';

import { roughDetail } from './checkpoints-details.mjs';
export function roughCheckpoint(state: CheckpointState): Checkpoint {
  const { rough } = state;
  return {
    id: 'rough',
    name: 'Rough cut',
    ask: true,
    done: rough.closed,
    decision: rough.human ?? (rough.closed ? rough.agent : null) ?? null,
    detail: roughDetail(rough),
    question:
      'Watch the rough cut (review/index.html): what feels wrong, where? Notes can name a time; say what to keep.',
  };
}
