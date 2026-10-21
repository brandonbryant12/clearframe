import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';
import { anyAnswered } from './checkpoints-direction.mjs';

export function intentCheckpoint(state: CheckpointState): Checkpoint {
  const { direction, decided } = state;
  return {
    id: 'intent',
    name: 'Intent',
    ask: true,
    done:
      (anyAnswered(direction, [
        'Who is watching, and what do they already believe?',
        'Audience:',
      ]) &&
        anyAnswered(direction, [
          'The one thing they should understand or do afterwards:',
          'Takeaway:',
        ])) ||
      decided('Intent'),
    detail: 'audience and takeaway in DIRECTION.md',
    question:
      'Who is this for, and what should they understand or do afterwards?',
  };
}
