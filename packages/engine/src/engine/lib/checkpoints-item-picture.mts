import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';

import { sheetDetail } from './checkpoints-details.mjs';
export function pictureCheckpoint(state: CheckpointState): Checkpoint {
  const { sheet, edited } = state;
  return {
    id: 'picture',
    name: 'Picture',
    ask: true,
    done: sheet > edited,
    detail: sheetDetail(sheet, edited),
    question: 'Look at the contact sheet: is this the film you imagined?',
  };
}
