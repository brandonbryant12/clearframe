import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';

export function truthCheckpoint(state: CheckpointState): Checkpoint {
  const { samples } = state;
  return {
    id: 'truth',
    name: 'Truth',
    ask: true,
    done: samples === 0,
    detail: samples
      ? `${samples} sample source(s) or placeholder claims remain`
      : 'every claim has a real source',
    question:
      'Are these the right claims, and are the figures and sources correct?',
  };
}
