import type { Checkpoint } from './checkpoints-contracts.mjs';
import { checkpointState } from './checkpoints-state.mjs';
import { intentCheckpoint } from './checkpoints-item-intent.mjs';
import { truthCheckpoint } from './checkpoints-item-truth.mjs';
import { storyCheckpoint } from './checkpoints-item-story.mjs';
import { scriptCheckpoint } from './checkpoints-item-script.mjs';
import { roughCheckpoint } from './checkpoints-item-rough.mjs';
import { spendCheckpoint } from './checkpoints-item-spend.mjs';
import { pictureCheckpoint } from './checkpoints-item-picture.mjs';
import { finalCheckpoint } from './checkpoints-item-final.mjs';
export { finalMilestone } from './checkpoints-milestones.mjs';
export { coverage } from './checkpoints-coverage.mjs';
export function checkpoints(
  root: string,
  { mode = 'guided' }: { mode?: string } = {},
): Checkpoint[] {
  const state = checkpointState(root, mode);
  return [
    intentCheckpoint(state),
    truthCheckpoint(state),
    storyCheckpoint(state),
    scriptCheckpoint(state),
    roughCheckpoint(state),
    spendCheckpoint(state),
    pictureCheckpoint(state),
    finalCheckpoint(state),
  ];
}
